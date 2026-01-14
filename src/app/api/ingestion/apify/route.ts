import { NextRequest, NextResponse } from 'next/server';
import { getSourceById, upsertListing, recordSourceMetric, markListingsDelisted } from '@/ingestion/db';
import { ApifyStreetEasyAdapter } from '@/ingestion/adapters/apify-streeteasy';
import { SourceConfig } from '@/ingestion/types';

/**
 * POST /api/ingestion/apify
 * Trigger an Apify scraper run or fetch from last dataset
 *
 * Query params:
 * - action: 'run' | 'fetch' | 'status'
 * - runId: (for status check)
 * - maxListings: number
 * - borough: 'manhattan' | 'brooklyn' | 'queens' | 'bronx'
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'fetch';
  const maxListings = parseInt(searchParams.get('maxListings') || '100', 10);
  const borough = searchParams.get('borough') || undefined;
  const runId = searchParams.get('runId') || undefined;

  try {
    // Get the StreetEasy Apify source config
    const sourceConfig = await getSourceById('streeteasy-apify');

    if (!sourceConfig) {
      return NextResponse.json(
        { error: 'StreetEasy Apify source not configured. Run PUT /api/ingestion/sources first.' },
        { status: 404 }
      );
    }

    const adapter = new ApifyStreetEasyAdapter(sourceConfig as SourceConfig);

    switch (action) {
      case 'run': {
        // Trigger a new Apify run
        const newRunId = await adapter.triggerRun({
          maxItems: maxListings,
          borough,
        });

        return NextResponse.json({
          message: 'Apify run started',
          runId: newRunId,
          checkStatusUrl: `/api/ingestion/apify?action=status&runId=${newRunId}`,
        });
      }

      case 'status': {
        if (!runId) {
          return NextResponse.json(
            { error: 'runId required for status check' },
            { status: 400 }
          );
        }

        const status = await adapter.getRunStatus(runId);
        return NextResponse.json(status);
      }

      case 'fetch':
      default: {
        // Fetch from the last dataset and save to DB
        const listings = await adapter.fetchAndNormalize({
          maxListings,
          borough,
        });

        if (listings.length === 0) {
          return NextResponse.json({
            message: 'No listings found. You may need to trigger a run first.',
            hint: 'POST /api/ingestion/apify?action=run',
            listings: [],
            saved: 0,
          });
        }

        // Save listings to database
        let saved = 0;
        let updated = 0;
        const errors: string[] = [];

        for (const listing of listings) {
          try {
            await upsertListing(listing);
            saved++;
          } catch (error) {
            errors.push(`${listing.sourceUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        // Mark listings not seen in this fetch as potentially delisted
        const activeUrls = listings.map(l => l.sourceUrl);
        const delisted = await markListingsDelisted('streeteasy-apify', activeUrls);

        // Record metrics
        await recordSourceMetric('streeteasy-apify', {
          fetchAttempts: 1,
          fetchSuccesses: 1,
          listingsFound: listings.length,
          newListings: saved,
          delistedListings: delisted,
        });

        return NextResponse.json({
          message: `Fetched ${listings.length} listings from Apify`,
          total: listings.length,
          saved,
          updated,
          delisted,
          errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
          sample: listings.slice(0, 3).map(l => ({
            url: l.sourceUrl,
            price: l.price,
            beds: l.beds,
            neighborhood: l.neighborhood,
            borough: l.borough,
          })),
        });
      }
    }
  } catch (error) {
    console.error('Apify API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common issues
    if (errorMessage.includes('APIFY_API_TOKEN')) {
      return NextResponse.json({
        error: 'APIFY_API_TOKEN environment variable not set',
        hint: 'Add APIFY_API_TOKEN to your .env.local file',
      }, { status: 500 });
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/ingestion/apify
 * Get Apify integration status
 */
export async function GET() {
  const hasToken = !!process.env.APIFY_API_TOKEN;

  const sourceConfig = await getSourceById('streeteasy-apify');

  return NextResponse.json({
    configured: hasToken && !!sourceConfig,
    hasApiToken: hasToken,
    hasSourceConfig: !!sourceConfig,
    actorId: sourceConfig?.urls?.apiEndpoint || 'memo23~apify-streeteasy-cheerio',
    usage: {
      triggerRun: 'POST /api/ingestion/apify?action=run&maxListings=100',
      checkStatus: 'POST /api/ingestion/apify?action=status&runId=<runId>',
      fetchListings: 'POST /api/ingestion/apify?action=fetch&maxListings=100',
    },
  });
}
