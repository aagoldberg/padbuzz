import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getIngestedListingsCollection } from '@/ingestion/db';
import { analyzeApartmentImages } from '@/lib/image-analysis';

/**
 * POST /api/ingestion/analyze
 * Batch analyze images for ingested listings
 *
 * Query params:
 * - limit: max listings to analyze (default 10)
 * - sourceId: only analyze from specific source
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const sourceId = searchParams.get('sourceId') || undefined;

  try {
    const collection = await getIngestedListingsCollection();

    // Find listings without image analysis that have images
    const query: Record<string, unknown> = {
      'storedImageAnalysis': { $exists: false },
      'images.0': { $exists: true }
    };

    if (sourceId) {
      query.sourceId = sourceId;
    }

    const unanalyzed = await collection.find(query).limit(limit).toArray();

    if (unanalyzed.length === 0) {
      return NextResponse.json({
        message: 'All listings already analyzed',
        analyzed: 0
      });
    }

    const results: { id: string; success: boolean; quality?: number; error?: string }[] = [];

    for (const listing of unanalyzed) {
      try {
        const images = listing.images as string[];

        // Skip if no images
        if (!images || images.length === 0) {
          results.push({ id: listing._id.toString(), success: false, error: 'No images' });
          continue;
        }

        console.log(`Analyzing listing ${listing._id} with ${images.length} images...`);

        const analysis = await analyzeApartmentImages(images.slice(0, 5)); // Limit to first 5 images

        // Calculate overall quality score
        const overallQuality = Math.round(
          (analysis.overallCleanliness + analysis.overallLight + analysis.overallRenovation) / 3 * 10
        ) / 10;

        // Store on document
        await collection.updateOne(
          { _id: new ObjectId(listing._id as string) },
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
        console.log(`  -> Quality: ${overallQuality}`);

        // Delay to avoid rate limits (2 seconds between listings)
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error analyzing listing ${listing._id}:`, errorMsg);
        results.push({ id: listing._id.toString(), success: false, error: errorMsg });

        // Longer delay on error (rate limit)
        if (errorMsg.includes('rate') || errorMsg.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    const successful = results.filter(r => r.success).length;

    return NextResponse.json({
      message: `Analyzed ${successful}/${unanalyzed.length} listings`,
      analyzed: successful,
      failed: unanalyzed.length - successful,
      results
    });
  } catch (error) {
    console.error('Batch analysis error:', error);
    return NextResponse.json({
      error: `Batch analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`
    }, { status: 500 });
  }
}

/**
 * GET /api/ingestion/analyze
 * Check analysis status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sourceId = searchParams.get('sourceId') || undefined;

  try {
    const collection = await getIngestedListingsCollection();

    const baseQuery: Record<string, unknown> = {};
    if (sourceId) {
      baseQuery.sourceId = sourceId;
    }

    const [total, analyzed, withImages] = await Promise.all([
      collection.countDocuments(baseQuery),
      collection.countDocuments({ ...baseQuery, 'storedImageAnalysis': { $exists: true } }),
      collection.countDocuments({ ...baseQuery, 'images.0': { $exists: true } })
    ]);

    const remaining = withImages - analyzed;
    const estimatedMinutes = Math.ceil(remaining * 0.5); // ~30 sec per listing

    return NextResponse.json({
      total,
      withImages,
      analyzed,
      remaining,
      percentComplete: withImages > 0 ? Math.round((analyzed / withImages) * 100) : 0,
      estimatedMinutesRemaining: estimatedMinutes
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
