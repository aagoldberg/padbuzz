import { NextRequest, NextResponse } from 'next/server';
import { scheduleAllCrawls, runCrawl } from '@/ingestion/orchestrator';
import { getEnabledSources } from '@/ingestion/db';

/**
 * POST /api/ingestion/crawl
 * Trigger crawls for all enabled sources
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const async = searchParams.get('async') === 'true';
  const limit = parseInt(searchParams.get('limit') || '3', 10);

  try {
    if (async) {
      // Schedule all crawls for background processing
      const { scheduled, jobIds } = await scheduleAllCrawls();
      return NextResponse.json({
        message: `Scheduled ${scheduled} crawls`,
        jobIds,
        status: 'scheduled',
      });
    }

    // Run crawls synchronously (limited number)
    const sources = await getEnabledSources();
    const results = [];

    for (const source of sources.slice(0, limit)) {
      console.log(`Starting crawl for ${source.id}...`);
      const result = await runCrawl(source.id, {
        maxPages: 2, // Limit pages for sync crawl
        maxListings: 100,
      });
      results.push(result);
    }

    const totalListings = results.reduce((sum, r) => sum + r.listingsFound, 0);
    const totalNew = results.reduce((sum, r) => sum + r.newListings, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    return NextResponse.json({
      message: `Completed ${results.length} crawls`,
      summary: {
        sourcesCrawled: results.length,
        totalListings,
        newListings: totalNew,
        errors: totalErrors,
      },
      results,
    });
  } catch (error) {
    console.error('Crawl-all error:', error);
    return NextResponse.json(
      { error: `Crawl failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingestion/crawl
 * Get crawl status overview
 */
export async function GET() {
  try {
    const sources = await getEnabledSources();

    return NextResponse.json({
      enabledSources: sources.length,
      sources: sources.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        refreshIntervalMinutes: s.scrapeConfig.refreshIntervalMinutes,
      })),
    });
  } catch (error) {
    console.error('Error fetching crawl status:', error);
    return NextResponse.json({ error: 'Failed to fetch crawl status' }, { status: 500 });
  }
}
