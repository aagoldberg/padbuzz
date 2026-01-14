import { NextRequest, NextResponse } from 'next/server';
import { StreetEasyPuppeteerScraper } from '@/ingestion/adapters/streeteasy-puppeteer';
import { upsertListing, recordSourceMetric } from '@/ingestion/db';

/**
 * POST /api/ingestion/scrape
 * Trigger a direct scrape of StreetEasy (no Apify needed)
 *
 * Query params:
 * - maxListings: number (default 500)
 * - borough: 'manhattan' | 'brooklyn' | 'queens' | 'bronx'
 * - minPrice: number
 * - maxPrice: number
 * - beds: comma-separated list (e.g., "0,1,2" for studio, 1BR, 2BR)
 */
export async function POST(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const maxListings = parseInt(searchParams.get('maxListings') || '500', 10);
  const borough = searchParams.get('borough') || undefined;
  const minPrice = searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!, 10) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!, 10) : undefined;
  const bedsParam = searchParams.get('beds');
  const beds = bedsParam ? bedsParam.split(',').map(b => parseInt(b, 10)) : undefined;

  try {
    console.log(`Starting StreetEasy scrape: max=${maxListings}, borough=${borough || 'all'}`);

    const scraper = new StreetEasyPuppeteerScraper();
    const result = await scraper.scrapeRentals({
      maxListings,
      borough,
      minPrice,
      maxPrice,
    });

    console.log(`Scrape complete: ${result.listings.length} listings found, ${result.pagesScraped} pages scraped`);

    // Save listings to database
    let saved = 0;
    let updated = 0;
    const saveErrors: string[] = [];

    for (const listing of result.listings) {
      try {
        const wasNew = await upsertListing(listing);
        if (wasNew) {
          saved++;
        } else {
          updated++;
        }
      } catch (error) {
        saveErrors.push(`${listing.sourceUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Record metrics
    await recordSourceMetric('streeteasy-direct', {
      fetchAttempts: result.pagesScraped,
      fetchSuccesses: result.pagesScraped - result.errors.length,
      listingsFound: result.totalFound,
      newListings: saved,
      delistedListings: 0,
    });

    return NextResponse.json({
      message: `Scraped ${result.listings.length} listings from StreetEasy`,
      totalFound: result.totalFound,
      pagesScraped: result.pagesScraped,
      saved,
      updated,
      scrapeErrors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      saveErrors: saveErrors.length > 0 ? saveErrors.slice(0, 10) : undefined,
      sample: result.listings.slice(0, 3).map(l => ({
        url: l.sourceUrl,
        price: l.price,
        beds: l.beds,
        neighborhood: l.neighborhood,
        borough: l.borough,
      })),
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ingestion/scrape
 * Get scraper status/info
 */
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    source: 'streeteasy-direct',
    description: 'Direct StreetEasy scraper (no Apify)',
    usage: {
      scrapeAll: 'POST /api/ingestion/scrape?maxListings=500',
      scrapeBrooklyn: 'POST /api/ingestion/scrape?borough=brooklyn&maxListings=200',
      scrapeFiltered: 'POST /api/ingestion/scrape?minPrice=2000&maxPrice=4000&beds=1,2',
    },
    rateLimit: '2-4 seconds between pages',
    estimatedTime: '~2 minutes per 100 listings',
  });
}
