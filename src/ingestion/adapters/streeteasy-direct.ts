import { v4 as uuidv4 } from 'uuid';
import * as cheerio from 'cheerio';
import { NormalizedListing } from '../types';

/**
 * Direct StreetEasy Scraper
 * Scrapes rental listings directly from StreetEasy without Apify
 */

// User agents to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Random delay between requests
const randomDelay = (min: number, max: number) => delay(min + Math.random() * (max - min));

interface StreetEasyGraphQLListing {
  __typename: string;
  node: {
    __typename: string;
    id: string;
    areaName?: string;
    availableAt?: string;
    bedroomCount?: number;
    buildingType?: string;
    fullBathroomCount?: number;
    halfBathroomCount?: number;
    furnished?: boolean;
    geoPoint?: {
      latitude: number;
      longitude: number;
    };
    hasTour3d?: boolean;
    hasVideos?: boolean;
    isNewDevelopment?: boolean;
    leaseTermMonths?: number;
    livingAreaSize?: number;
    mediaAssetCount?: number;
    monthsFree?: number;
    noFee?: boolean;
    netEffectivePrice?: number;
    offMarketAt?: string;
    photos?: { key: string }[];
    price?: number;
    sourceGroupLabel?: string;
    sourceType?: string;
    status?: string;
    street?: string;
    tier?: string;
    unit?: string;
    upcomingOpenHouse?: {
      startTime?: string;
      endTime?: string;
    };
    urlPath?: string;
    interestingPriceDelta?: number;
  };
  amenitiesMatch?: number;
  matchedAmenities?: { name: string; category?: string }[];
  missingAmenities?: { name: string; category?: string }[];
}

interface ScrapeResult {
  listings: NormalizedListing[];
  totalFound: number;
  pagesScraped: number;
  errors: string[];
}

export class StreetEasyDirectScraper {
  private sourceId = 'streeteasy-direct';
  private baseUrl = 'https://streeteasy.com';

  /**
   * Scrape rental listings from StreetEasy
   */
  async scrapeRentals(options: {
    maxListings?: number;
    borough?: string;
    minPrice?: number;
    maxPrice?: number;
    beds?: number[];
  } = {}): Promise<ScrapeResult> {
    const maxListings = options.maxListings || 500;
    const errors: string[] = [];
    const allListings: NormalizedListing[] = [];
    let pagesScraped = 0;
    let totalFound = 0;

    // Build search URL
    let searchPath = '/for-rent/nyc';
    if (options.borough) {
      searchPath = `/for-rent/${options.borough.toLowerCase()}`;
    }

    // Add filters
    const filters: string[] = [];
    if (options.minPrice) filters.push(`price_min=${options.minPrice}`);
    if (options.maxPrice) filters.push(`price_max=${options.maxPrice}`);
    if (options.beds && options.beds.length > 0) {
      filters.push(`beds=${options.beds.join(',')}`);
    }

    const queryString = filters.length > 0 ? `?${filters.join('&')}` : '';

    try {
      // First, try to get data from the search page's embedded JSON
      let page = 1;
      let hasMore = true;

      while (hasMore && allListings.length < maxListings) {
        const pageUrl = `${this.baseUrl}${searchPath}${queryString}${queryString ? '&' : '?'}page=${page}`;
        console.log(`Scraping page ${page}: ${pageUrl}`);

        try {
          const pageListings = await this.scrapePage(pageUrl);

          if (pageListings.length === 0) {
            hasMore = false;
          } else {
            allListings.push(...pageListings);
            pagesScraped++;
            totalFound += pageListings.length;

            // Rate limiting - wait 2-4 seconds between pages
            if (allListings.length < maxListings) {
              await randomDelay(2000, 4000);
            }
          }

          page++;

          // Safety limit - don't go beyond 50 pages
          if (page > 50) {
            hasMore = false;
          }
        } catch (error) {
          errors.push(`Page ${page}: ${error instanceof Error ? error.message : 'Unknown error'}`);

          // If we get blocked, wait longer and retry once
          if (error instanceof Error && error.message.includes('403')) {
            console.log('Got 403, waiting 30 seconds before retry...');
            await delay(30000);

            try {
              const pageListings = await this.scrapePage(pageUrl);
              allListings.push(...pageListings);
              pagesScraped++;
            } catch {
              // Give up on this page
              hasMore = false;
            }
          } else {
            // Other error, try next page
            page++;
          }
        }
      }
    } catch (error) {
      errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      listings: allListings.slice(0, maxListings),
      totalFound,
      pagesScraped,
      errors,
    };
  }

  /**
   * Scrape a single search results page
   */
  private async scrapePage(url: string): Promise<NormalizedListing[]> {
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.parseSearchPage(html);
  }

  /**
   * Parse search results page HTML to extract listings
   */
  private parseSearchPage(html: string): NormalizedListing[] {
    const $ = cheerio.load(html);
    const listings: NormalizedListing[] = [];

    // Method 1: Look for __NEXT_DATA__ JSON (Next.js apps embed data here)
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const pageProps = nextData?.props?.pageProps;

        // Look for listings in various possible locations
        const searchResults =
          pageProps?.searchResults?.edges ||
          pageProps?.listings?.edges ||
          pageProps?.data?.searchResults?.edges ||
          [];

        for (const edge of searchResults) {
          try {
            const listing = this.normalizeGraphQLListing(edge);
            if (listing) {
              listings.push(listing);
            }
          } catch (e) {
            console.warn('Failed to parse listing:', e);
          }
        }

        if (listings.length > 0) {
          return listings;
        }
      } catch (e) {
        console.warn('Failed to parse __NEXT_DATA__:', e);
      }
    }

    // Method 2: Look for Apollo state (GraphQL cache)
    const apolloScript = $('script').filter((_, el) => {
      const text = $(el).html() || '';
      return text.includes('__APOLLO_STATE__') || text.includes('window.__RELAY_STORE__');
    }).first().html();

    if (apolloScript) {
      try {
        // Extract JSON from script
        const match = apolloScript.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});/);
        if (match) {
          const apolloState = JSON.parse(match[1]);
          // Parse Apollo state for listings
          for (const key of Object.keys(apolloState)) {
            if (key.includes('Rental') || key.includes('Listing')) {
              const data = apolloState[key];
              if (data?.id && data?.price) {
                try {
                  const listing = this.normalizeApolloListing(data);
                  if (listing) {
                    listings.push(listing);
                  }
                } catch (e) {
                  console.warn('Failed to parse Apollo listing:', e);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse Apollo state:', e);
      }
    }

    // Method 3: Parse HTML directly (fallback)
    if (listings.length === 0) {
      // Look for listing cards
      $('[data-testid="listing-card"], .listingCard, .SearchResultsListItem').each((_, el) => {
        try {
          const listing = this.parseListingCard($, $(el));
          if (listing) {
            listings.push(listing);
          }
        } catch (e) {
          console.warn('Failed to parse listing card:', e);
        }
      });
    }

    return listings;
  }

  /**
   * Parse a listing card from HTML
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseListingCard($: cheerio.CheerioAPI, card: any): NormalizedListing | null {
    // Extract link
    const link = card.find('a[href*="/rental/"], a[href*="/building/"]').first();
    const href = link.attr('href');
    if (!href) return null;

    const sourceUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
    const sourceListingId = this.extractListingId(sourceUrl);

    // Extract price
    const priceText = card.find('[data-testid="price"], .price, .listing-price').first().text();
    const price = this.parsePrice(priceText);
    if (!price) return null;

    // Extract beds/baths
    const detailsText = card.find('[data-testid="beds-baths"], .details, .listing-details').text();
    const beds = this.parseBeds(detailsText);
    const baths = this.parseBaths(detailsText);

    // Extract address
    const address = card.find('[data-testid="address"], .address, .listing-address').first().text().trim();

    // Extract neighborhood
    const neighborhood = card.find('[data-testid="neighborhood"], .neighborhood').first().text().trim();

    // Extract image
    const img = card.find('img').first();
    const imageUrl = img.attr('src') || img.attr('data-src');
    const images = imageUrl ? [imageUrl] : [];

    // Check for no-fee
    const noFee = card.text().toLowerCase().includes('no fee');

    return {
      listingId: uuidv4(),
      sourceId: this.sourceId,
      sourceListingId,
      sourceUrl,
      title: `${beds === 0 ? 'Studio' : `${beds}BR`} in ${neighborhood || 'NYC'}`,
      price,
      beds,
      baths,
      addressText: address,
      addressNormalized: address,
      neighborhood,
      borough: this.inferBorough(neighborhood),
      city: 'New York',
      state: 'NY',
      images,
      amenities: [],
      noFee,
      status: 'active',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastUpdatedAt: new Date(),
      isDuplicate: false,
    };
  }

  /**
   * Normalize a GraphQL listing from __NEXT_DATA__
   */
  private normalizeGraphQLListing(edge: StreetEasyGraphQLListing): NormalizedListing | null {
    const node = edge?.node;
    if (!node?.id) return null;

    const price = node.price || node.netEffectivePrice || 0;
    if (!price) return null;

    const beds = node.bedroomCount || 0;
    const baths = (node.fullBathroomCount || 0) + (node.halfBathroomCount || 0) * 0.5;
    const sqft = node.livingAreaSize || undefined;

    const sourceUrl = node.urlPath
      ? `${this.baseUrl}${node.urlPath}`
      : `${this.baseUrl}/rental/${node.id}`;

    const images = (node.photos || []).map(photo =>
      `https://photos.zillowstatic.com/fp/${photo.key}-se_extra_large_1500_800.webp`
    );

    const addressText = node.unit
      ? `${node.street || ''} #${node.unit}`
      : node.street || '';

    return {
      listingId: uuidv4(),
      sourceId: this.sourceId,
      sourceListingId: node.id,
      sourceUrl,
      title: `${beds === 0 ? 'Studio' : `${beds}BR`} in ${node.areaName || 'NYC'}`,
      price,
      beds,
      baths,
      sqft,
      addressText,
      addressNormalized: addressText,
      neighborhood: node.areaName,
      borough: this.inferBorough(node.areaName || ''),
      city: 'New York',
      state: 'NY',
      latitude: node.geoPoint?.latitude,
      longitude: node.geoPoint?.longitude,
      images,
      amenities: (edge.matchedAmenities || []).map(a => a.name),
      brokerCompany: node.sourceGroupLabel,
      noFee: node.noFee,
      availableDate: node.availableAt ? new Date(node.availableAt) : undefined,
      netEffectivePrice: node.netEffectivePrice,
      monthsFree: node.monthsFree,
      leaseTermMonths: node.leaseTermMonths,
      furnished: node.furnished,
      isNewDevelopment: node.isNewDevelopment,
      hasTour3d: node.hasTour3d,
      hasVideos: node.hasVideos,
      mediaAssetCount: node.mediaAssetCount,
      buildingType: node.buildingType,
      upcomingOpenHouse: node.upcomingOpenHouse?.startTime
        ? new Date(node.upcomingOpenHouse.startTime)
        : undefined,
      unit: node.unit,
      tier: node.tier,
      priceDelta: node.interestingPriceDelta,
      offMarketAt: node.offMarketAt ? new Date(node.offMarketAt) : undefined,
      status: node.status === 'ACTIVE' ? 'active' : 'unknown',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastUpdatedAt: new Date(),
      isDuplicate: false,
    };
  }

  /**
   * Normalize an Apollo state listing
   */
  private normalizeApolloListing(data: Record<string, unknown>): NormalizedListing | null {
    const id = data.id as string;
    const price = (data.price || data.netEffectivePrice) as number;
    if (!id || !price) return null;

    const beds = (data.bedroomCount || 0) as number;
    const baths = ((data.fullBathroomCount || 0) as number) + ((data.halfBathroomCount || 0) as number) * 0.5;
    const sqft = data.livingAreaSize as number | undefined;
    const urlPath = data.urlPath as string;
    const sourceUrl = urlPath ? `${this.baseUrl}${urlPath}` : `${this.baseUrl}/rental/${id}`;
    const areaName = data.areaName as string;
    const street = data.street as string;
    const unit = data.unit as string;
    const addressText = unit ? `${street || ''} #${unit}` : street || '';

    return {
      listingId: uuidv4(),
      sourceId: this.sourceId,
      sourceListingId: id,
      sourceUrl,
      title: `${beds === 0 ? 'Studio' : `${beds}BR`} in ${areaName || 'NYC'}`,
      price,
      beds,
      baths,
      sqft,
      addressText,
      addressNormalized: addressText,
      neighborhood: areaName,
      borough: this.inferBorough(areaName || ''),
      city: 'New York',
      state: 'NY',
      images: [],
      amenities: [],
      noFee: data.noFee as boolean,
      status: 'active',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastUpdatedAt: new Date(),
      isDuplicate: false,
    };
  }

  private extractListingId(url: string): string {
    const match = url.match(/\/rental\/(\d+)/);
    return match ? match[1] : uuidv4();
  }

  private parsePrice(text: string): number {
    if (!text) return 0;
    const match = text.match(/[\$]?([\d,]+)/);
    return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
  }

  private parseBeds(text: string): number {
    if (!text) return 0;
    const lower = text.toLowerCase();
    if (lower.includes('studio')) return 0;
    const match = lower.match(/(\d+)\s*(?:bed|br|bd)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseBaths(text: string): number {
    if (!text) return 1;
    const match = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(?:bath|ba)/);
    return match ? parseFloat(match[1]) : 1;
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
      'sheepshead bay', 'brighton beach', 'coney island', 'gravesend',
    ];

    const queensNeighborhoods = [
      'astoria', 'long island city', 'lic', 'sunnyside', 'woodside', 'jackson heights',
      'flushing', 'forest hills', 'rego park', 'ridgewood', 'elmhurst', 'corona',
      'bayside', 'jamaica', 'kew gardens', 'woodhaven', 'ozone park',
    ];

    const bronxNeighborhoods = [
      'south bronx', 'mott haven', 'hunts point', 'fordham', 'riverdale',
      'kingsbridge', 'morris park', 'pelham bay', 'throggs neck', 'parkchester',
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
