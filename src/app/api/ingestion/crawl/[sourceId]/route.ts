import { NextRequest, NextResponse } from 'next/server';
import { runCrawl, scheduleCrawl } from '@/ingestion/orchestrator';
import { getSourceById } from '@/ingestion/db';

/**
 * POST /api/ingestion/crawl/:sourceId
 * Trigger a crawl for a specific source
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sourceId } = await params;
  const searchParams = request.nextUrl.searchParams;

  // Check if source exists
  const source = await getSourceById(sourceId);
  if (!source) {
    return NextResponse.json({ error: `Source not found: ${sourceId}` }, { status: 404 });
  }

  // Parse options
  const maxPages = parseInt(searchParams.get('maxPages') || '5', 10);
  const maxListings = parseInt(searchParams.get('maxListings') || '500', 10);
  const dryRun = searchParams.get('dryRun') === 'true';
  const async = searchParams.get('async') === 'true';

  try {
    if (async) {
      // Schedule the crawl for background processing
      const jobId = await scheduleCrawl(sourceId, { priority: 10 });
      return NextResponse.json({
        message: `Crawl scheduled for ${sourceId}`,
        jobId,
        status: 'scheduled',
      });
    }

    // Run the crawl synchronously
    const result = await runCrawl(sourceId, { maxPages, maxListings, dryRun });

    return NextResponse.json({
      message: `Crawl completed for ${sourceId}`,
      result,
    });
  } catch (error) {
    console.error(`Crawl error for ${sourceId}:`, error);
    return NextResponse.json(
      { error: `Crawl failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingestion/crawl/:sourceId
 * Get crawl status/info for a source
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params;

  const source = await getSourceById(sourceId);
  if (!source) {
    return NextResponse.json({ error: `Source not found: ${sourceId}` }, { status: 404 });
  }

  return NextResponse.json({
    sourceId,
    sourceName: source.name,
    enabled: source.enabled,
    refreshIntervalMinutes: source.scrapeConfig.refreshIntervalMinutes,
    difficulty: source.scrapeConfig.difficulty,
    requiresJs: source.scrapeConfig.requiresJs,
  });
}
