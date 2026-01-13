import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getApartmentsCollection, getSubscribersCollection, getDealAlertsCollection } from '@/lib/mongodb';
import { analyzeApartment, getImageAnalysis, isExceptionalDeal } from '@/lib/ai';
import { notifyPaidSubscribers } from '@/lib/notifications';
import { getComparativeStats } from '@/lib/benchmarks';
import { UserPreferences, Apartment, Subscriber, StoredImageAnalysis } from '@/types/apartment';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const preferences: UserPreferences = body.preferences;

    if (!preferences) {
      return NextResponse.json({ error: 'User preferences required' }, { status: 400 });
    }

    const collection = await getApartmentsCollection();
    const apartmentDoc = await collection.findOne({ _id: new ObjectId(id) });

    if (!apartmentDoc) {
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    const apartment = apartmentDoc as unknown as Apartment & { storedImageAnalysis?: StoredImageAnalysis };

    // Check if we already have stored image analysis
    let storedImageAnalysis = apartment.storedImageAnalysis;
    let imageAnalysis = null;

    if (apartment.images?.length > 0) {
      // Get fresh image analysis (needed for Claude prompt)
      imageAnalysis = await getImageAnalysis(apartment.images);

      // Store it if we don't have it yet
      if (!storedImageAnalysis && imageAnalysis) {
        const overallQuality = Math.round(
          (imageAnalysis.overallCleanliness + imageAnalysis.overallLight + imageAnalysis.overallRenovation) / 3 * 10
        ) / 10;

        storedImageAnalysis = {
          overallQuality,
          cleanliness: imageAnalysis.overallCleanliness,
          light: imageAnalysis.overallLight,
          renovation: imageAnalysis.overallRenovation,
          analyzedAt: new Date()
        };

        // Store on document for future percentile calculations
        await collection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { storedImageAnalysis } }
        );
      }
    }

    // Analyze with Claude, passing the image ratings
    const analysis = await analyzeApartment(apartment, preferences, imageAnalysis);

    // Attach image analysis to response
    if (imageAnalysis) {
      analysis.imageAnalysis = imageAnalysis;
    }

    // Get deal score from analysis (now included in single Claude call)
    const dealScore = (analysis as unknown as { dealScore?: number }).dealScore || 50;

    // Get comparative stats (O(1) lookup)
    let comparativeStats = null;
    if (storedImageAnalysis) {
      comparativeStats = await getComparativeStats(apartment.price, storedImageAnalysis);
    }

    if (isExceptionalDeal(analysis, dealScore)) {
      const subscribersCollection = await getSubscribersCollection();
      const subscribers = await subscribersCollection.find({}).toArray() as unknown as Subscriber[];

      const { sent } = await notifyPaidSubscribers(subscribers, apartment, analysis, dealScore);

      const alertsCollection = await getDealAlertsCollection();
      await alertsCollection.insertOne({
        apartmentId: id,
        apartment,
        aiAnalysis: analysis,
        dealScore,
        sentAt: new Date(),
        subscribersNotified: sent,
      });
    }

    return NextResponse.json({
      apartment,
      analysis,
      dealScore,
      matchScore: analysis.overallScore,
      isExceptionalDeal: isExceptionalDeal(analysis, dealScore),
      comparativeStats,
    });
  } catch (error) {
    console.error('Error analyzing apartment:', error);
    return NextResponse.json({ error: 'Failed to analyze apartment' }, { status: 500 });
  }
}
