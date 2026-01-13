import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getApartmentsCollection } from '@/lib/mongodb';
import { analyzeApartmentImages } from '@/lib/image-analysis';

// Batch analyze all listings that don't have stored image analysis
// Run with: POST /api/jobs/analyze-images?limit=10
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Simple auth check (for cron jobs or manual triggers)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  try {
    const collection = await getApartmentsCollection();

    // Find listings without image analysis that have images
    const unanalyzed = await collection.find({
      'storedImageAnalysis': { $exists: false },
      'images.0': { $exists: true }
    }).limit(limit).toArray();

    if (unanalyzed.length === 0) {
      return NextResponse.json({
        message: 'All listings already analyzed',
        analyzed: 0
      });
    }

    const results: { id: string; success: boolean; quality?: number }[] = [];

    for (const listing of unanalyzed) {
      try {
        const images = listing.images as string[];
        const analysis = await analyzeApartmentImages(images);

        // Calculate overall quality score
        const overallQuality = Math.round(
          (analysis.overallCleanliness + analysis.overallLight + analysis.overallRenovation) / 3 * 10
        ) / 10;

        // Store on document
        await collection.updateOne(
          { _id: new ObjectId(listing._id) },
          {
            $set: {
              storedImageAnalysis: {
                overallQuality,
                cleanliness: analysis.overallCleanliness,
                light: analysis.overallLight,
                renovation: analysis.overallRenovation,
                analyzedAt: new Date()
              }
            }
          }
        );

        results.push({ id: listing._id.toString(), success: true, quality: overallQuality });

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error analyzing listing ${listing._id}:`, error);
        results.push({ id: listing._id.toString(), success: false });
      }
    }

    const successful = results.filter(r => r.success).length;

    return NextResponse.json({
      message: `Analyzed ${successful}/${unanalyzed.length} listings`,
      analyzed: successful,
      results
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json({ error: 'Batch analysis failed' }, { status: 500 });
  }
}

// GET to check status
export async function GET() {
  try {
    const collection = await getApartmentsCollection();

    const [total, analyzed, withImages] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ 'storedImageAnalysis': { $exists: true } }),
      collection.countDocuments({ 'images.0': { $exists: true } })
    ]);

    return NextResponse.json({
      total,
      withImages,
      analyzed,
      remaining: withImages - analyzed,
      percentComplete: withImages > 0 ? Math.round((analyzed / withImages) * 100) : 0
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
