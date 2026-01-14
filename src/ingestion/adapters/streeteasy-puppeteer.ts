import { v4 as uuidv4 } from 'uuid';
import { NormalizedListing } from '../types';

// Dynamic imports for Puppeteer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puppeteer: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chromium: any = null;

async function getBrowser() {
  // Check if we're in a serverless environment
  const isServerless = process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.VERCEL;

  if (isServerless) {
    // Serverless: use puppeteer-core + chromium
    if (!puppeteer) {
      puppeteer = await import('puppeteer-core');
    }
    if (!chromium) {
      chromium = (await import('@sparticuz/chromium')).default;
    }
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  } else {
    // Local: use puppeteer-core with system Chrome
    if (!puppeteer) {
      puppeteer = await import('puppeteer-core');
    }

    const executablePath =
      process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome';

    return puppeteer.launch({
      executablePath,
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ],
    });
  }
}

interface ScrapeResult {
  listings: NormalizedListing[];
  totalFound: number;
  pagesScraped: number;
  errors: string[];
}

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class StreetEasyPuppeteerScraper {
  private sourceId = 'streeteasy-direct';
  private baseUrl = 'https://streeteasy.com';

  /**
   * Scrape rental listings using Puppeteer
   */
  async scrapeRentals(options: {
    maxListings?: number;
    borough?: string;
    minPrice?: number;
    maxPrice?: number;
  } = {}): Promise<ScrapeResult> {
    const maxListings = options.maxListings || 500;
    const errors: string[] = [];
    const allListings: NormalizedListing[] = [];
    let pagesScraped = 0;
    let totalFound = 0;

    let browser;
    try {
      console.log('Launching browser...');
      browser = await getBrowser();
      const page = await browser.newPage();

      // Set realistic viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Evasion: Override webdriver detection
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // @ts-expect-error - Chrome-specific
        window.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });

      // Block unnecessary resources for speed
      await page.setRequestInterception(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        if (['image', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Build search URL
      let searchPath = '/for-rent/nyc';
      if (options.borough) {
        searchPath = `/for-rent/${options.borough.toLowerCase()}`;
      }

      const filters: string[] = [];
      if (options.minPrice) filters.push(`price_min=${options.minPrice}`);
      if (options.maxPrice) filters.push(`price_max=${options.maxPrice}`);
      const queryString = filters.length > 0 ? `?${filters.join('&')}` : '';

      let pageNum = 1;
      let hasMore = true;

      while (hasMore && allListings.length < maxListings && pageNum <= 30) {
        const pageUrl = `${this.baseUrl}${searchPath}${queryString}${queryString ? '&' : '?'}page=${pageNum}`;
        console.log(`Scraping page ${pageNum}: ${pageUrl}`);

        try {
          await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

          // Wait for listings to load
          await page.waitForSelector('[data-testid="search-results"], .searchResults, .listings', {
            timeout: 10000,
          }).catch(() => null);

          // Extract data from the page
          const pageData = await page.evaluate(() => {
            const listings: Array<{
              id: string;
              url: string;
              price: number;
              beds: number;
              baths: number;
              sqft?: number;
              address: string;
              neighborhood: string;
              noFee: boolean;
              images: string[];
            }> = [];

            // Method 1: Try __NEXT_DATA__
            const nextDataEl = document.querySelector('script#__NEXT_DATA__');
            if (nextDataEl) {
              try {
                const nextData = JSON.parse(nextDataEl.textContent || '');
                const edges =
                  nextData?.props?.pageProps?.searchResults?.edges ||
                  nextData?.props?.pageProps?.listings?.edges ||
                  nextData?.props?.pageProps?.data?.searchResults?.edges ||
                  [];

                for (const edge of edges) {
                  const node = edge?.node;
                  if (node?.id && node?.price) {
                    listings.push({
                      id: node.id,
                      url: node.urlPath
                        ? `https://streeteasy.com${node.urlPath}`
                        : `https://streeteasy.com/rental/${node.id}`,
                      price: node.price || node.netEffectivePrice || 0,
                      beds: node.bedroomCount || 0,
                      baths: (node.fullBathroomCount || 0) + (node.halfBathroomCount || 0) * 0.5,
                      sqft: node.livingAreaSize,
                      address: node.unit ? `${node.street || ''} #${node.unit}` : node.street || '',
                      neighborhood: node.areaName || '',
                      noFee: node.noFee || false,
                      images: (node.photos || []).map(
                        (p: { key: string }) =>
                          `https://photos.zillowstatic.com/fp/${p.key}-se_extra_large_1500_800.webp`
                      ),
                    });
                  }
                }
              } catch (e) {
                console.error('Failed to parse __NEXT_DATA__', e);
              }
            }

            // Method 2: Parse HTML if no data found
            if (listings.length === 0) {
              document.querySelectorAll('[data-testid="listing-card"], .listingCard').forEach((card) => {
                const link = card.querySelector('a[href*="/rental/"], a[href*="/building/"]') as HTMLAnchorElement;
                const priceEl = card.querySelector('[data-testid="price"], .price');
                const addressEl = card.querySelector('[data-testid="address"], .address');
                const neighborhoodEl = card.querySelector('[data-testid="neighborhood"], .neighborhood');
                const img = card.querySelector('img') as HTMLImageElement;

                if (link && priceEl) {
                  const priceMatch = priceEl.textContent?.match(/[\$]?([\d,]+)/);
                  const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;
                  const detailsText = card.textContent || '';
                  const bedsMatch = detailsText.toLowerCase().match(/(\d+)\s*(?:bed|br|bd)/);
                  const bathsMatch = detailsText.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:bath|ba)/);

                  listings.push({
                    id: link.href.match(/\/rental\/(\d+)/)?.[1] || Math.random().toString(),
                    url: link.href,
                    price,
                    beds: detailsText.toLowerCase().includes('studio')
                      ? 0
                      : bedsMatch
                      ? parseInt(bedsMatch[1], 10)
                      : 0,
                    baths: bathsMatch ? parseFloat(bathsMatch[1]) : 1,
                    address: addressEl?.textContent?.trim() || '',
                    neighborhood: neighborhoodEl?.textContent?.trim() || '',
                    noFee: detailsText.toLowerCase().includes('no fee'),
                    images: img?.src ? [img.src] : [],
                  });
                }
              });
            }

            return listings;
          });

          if (pageData.length === 0) {
            console.log('No listings found on page, stopping');
            hasMore = false;
          } else {
            // Convert to normalized listings
            for (const data of pageData) {
              allListings.push({
                listingId: uuidv4(),
                sourceId: this.sourceId,
                sourceListingId: data.id,
                sourceUrl: data.url,
                title: `${data.beds === 0 ? 'Studio' : `${data.beds}BR`} in ${data.neighborhood || 'NYC'}`,
                price: data.price,
                beds: data.beds,
                baths: data.baths,
                sqft: data.sqft,
                addressText: data.address,
                addressNormalized: data.address,
                neighborhood: data.neighborhood,
                borough: this.inferBorough(data.neighborhood),
                city: 'New York',
                state: 'NY',
                images: data.images,
                amenities: [],
                noFee: data.noFee,
                status: 'active',
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                lastUpdatedAt: new Date(),
                isDuplicate: false,
              });
            }

            pagesScraped++;
            totalFound += pageData.length;
            console.log(`Found ${pageData.length} listings on page ${pageNum}, total: ${allListings.length}`);
          }

          pageNum++;

          // Rate limit - wait 2-4 seconds between pages
          if (hasMore && allListings.length < maxListings) {
            const waitTime = 2000 + Math.random() * 2000;
            console.log(`Waiting ${Math.round(waitTime)}ms before next page...`);
            await delay(waitTime);
          }
        } catch (error) {
          errors.push(`Page ${pageNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.error(`Error on page ${pageNum}:`, error);

          // Try to continue with next page
          pageNum++;

          if (errors.length > 5) {
            console.log('Too many errors, stopping');
            hasMore = false;
          }
        }
      }
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    return {
      listings: allListings.slice(0, maxListings),
      totalFound,
      pagesScraped,
      errors,
    };
  }

  private inferBorough(neighborhood: string): string | undefined {
    const lower = neighborhood.toLowerCase();

    const manhattanNeighborhoods = [
      'upper east side', 'upper west side', 'midtown', 'chelsea', 'greenwich village',
      'east village', 'west village', 'soho', 'tribeca', 'financial district',
      'lower east side', 'harlem', 'washington heights', 'inwood', 'murray hill',
      'gramercy', 'flatiron', 'noho', 'nolita', 'chinatown', 'little italy',
      'battery park', 'hells kitchen', 'kips bay', 'sutton place', 'yorkville',
      'lenox hill', 'carnegie hill', 'manhattan valley', 'morningside heights',
    ];

    const brooklynNeighborhoods = [
      'williamsburg', 'bushwick', 'bed-stuy', 'bedford-stuyvesant', 'crown heights',
      'park slope', 'dumbo', 'brooklyn heights', 'greenpoint', 'prospect heights',
      'fort greene', 'clinton hill', 'cobble hill', 'carroll gardens', 'red hook',
      'sunset park', 'bay ridge', 'flatbush', 'prospect lefferts', 'ditmas park',
      'boerum hill', 'gowanus', 'windsor terrace', 'kensington', 'bensonhurst',
    ];

    const queensNeighborhoods = [
      'astoria', 'long island city', 'lic', 'sunnyside', 'woodside', 'jackson heights',
      'flushing', 'forest hills', 'rego park', 'ridgewood', 'elmhurst', 'corona',
    ];

    const bronxNeighborhoods = [
      'south bronx', 'mott haven', 'hunts point', 'fordham', 'riverdale',
      'kingsbridge', 'morris park', 'pelham bay',
    ];

    for (const n of manhattanNeighborhoods) {
      if (lower.includes(n)) return 'Manhattan';
    }
    for (const n of brooklynNeighborhoods) {
      if (lower.includes(n)) return 'Brooklyn';
    }
    for (const n of queensNeighborhoods) {
      if (lower.includes(n)) return 'Queens';
    }
    for (const n of bronxNeighborhoods) {
      if (lower.includes(n)) return 'Bronx';
    }

    return undefined;
  }
}
