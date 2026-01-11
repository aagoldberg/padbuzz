import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getApartmentsCollection, getSubscribersCollection, getDealAlertsCollection } from '@/lib/mongodb';
import { analyzeApartment, analyzeApartmentImages, calculateDealScore, isExceptionalDeal } from '@/lib/ai';
import { notifyPaidSubscribers } from '@/lib/notifications';
import { UserPreferences, Apartment, Subscriber } from '@/types/apartment';

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
    const apartment = await collection.findOne({ _id: new ObjectId(id) }) as Apartment | null;

    if (!apartment) {
      return NextResponse.json({ error: 'Apartment not found' }, { status: 404 });
    }

    const [analysis, imageAnalysis] = await Promise.all([
      analyzeApartment(apartment, preferences),
      apartment.images?.length > 0
        ? analyzeApartmentImages(apartment.images, apartment)
        : Promise.resolve([]),
    ]);

    analysis.imageAnalysis = imageAnalysis;

    const dealScore = await calculateDealScore(apartment, analysis);

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
    });
  } catch (error) {
    console.error('Error analyzing apartment:', error);
    return NextResponse.json({ error: 'Failed to analyze apartment' }, { status: 500 });
  }
}
