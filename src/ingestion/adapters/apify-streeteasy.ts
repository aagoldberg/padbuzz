import { v4 as uuidv4 } from 'uuid';
import {
  SourceAdapter,
  SourceConfig,
  RawPage,
  NormalizedListing,
  ListingUrlResult,
} from '../types';

// Apify StreetEasy listing format (from their scraper output)
// The scraper returns GraphQL-style nested data
interface ApifyStreetEasyPhoto {
  __typename: string;
  key: string;
}

interface ApifyStreetEasyNode {
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
    __typename: string;
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
  photos?: ApifyStreetEasyPhoto[];
  price?: number;
  sourceGroupLabel?: string;
  sourceType?: string;
  status?: string;
  street?: string;
  tier?: string;
  unit?: string;
  upcomingOpenHouse?: {
    __typename: string;
    startTime?: string;
    endTime?: string;
  };
  urlPath?: string;
  interestingPriceDelta?: number;
}

interface ApifyStreetEasyListing {
  __typename: string;
  node: ApifyStreetEasyNode;
  amenitiesMatch?: unknown;
  matchedAmenities?: unknown;
  missingAmenities?: unknown;
}

interface ApifyRunResponse {
  data: {
    id: string;
    status: string;
    datasetId?: string;
  };
}

interface ApifyDatasetResponse {
  items: ApifyStreetEasyListing[];
  total: number;
  offset: number;
  count: number;
}

/**
 * Adapter for StreetEasy data via Apify
 * Uses Apify's StreetEasy scraper actors to fetch listings
 */
export class ApifyStreetEasyAdapter implements SourceAdapter {
  sourceId: string;
  config: SourceConfig;

  private apiToken: string;
  private actorId: string;
  private baseUrl = 'https://api.apify.com/v2';

  constructor(config: SourceConfig) {
    this.sourceId = config.id;
    this.config = config;

    // Get Apify credentials from environment
    this.apiToken = process.env.APIFY_API_TOKEN || '';
    // Default to the free Cheerio-based scraper, can be overridden in config
    this.actorId = (config.urls.apiEndpoint as string) || 'memo23~apify-streeteasy-cheerio';

    if (!this.apiToken) {
      console.warn('APIFY_API_TOKEN not set - Apify adapter will not work');
    }
  }

  /**
   * List listing URLs from the most recent Apify dataset
   */
  async listListingUrls(params?: {
    borough?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<ListingUrlResult[]> {
    const listings = await this.fetchFromApify(params);

    return listings.map(listing => {
      const node = listing.node;
      const url = node?.urlPath
        ? `https://streeteasy.com${node.urlPath}`
        : `https://streeteasy.com/rental/${node?.id || ''}`;

      return {
        url,
        sourceListingId: node?.id,
        metadata: {
          price: node?.price,
          beds: node?.bedroomCount,
          neighborhood: node?.areaName,
        },
      };
    });
  }

  /**
   * Fetch is a no-op for Apify - data comes from their datasets
   * We return a synthetic RawPage with the JSON data
   */
  async fetch(url: string): Promise<RawPage> {
    // For Apify, we don't fetch individual URLs
    // The data is already in the dataset
    return {
      sourceId: this.sourceId,
      url,
      fetchedAt: new Date(),
      httpStatus: 200,
      htmlContent: '', // No HTML - data is structured
      contentHash: '',
      extractedImageUrls: [],
      parseStatus: 'pending',
    };
  }

  /**
   * Parse is also a pass-through - Apify data is already structured
   */
  async parse(rawPage: RawPage): Promise<NormalizedListing[]> {
    // For Apify, parsing happens in fetchAndNormalize
    // This method exists to satisfy the interface
    return [];
  }

  /**
   * Main method: Fetch listings from Apify and normalize them
   */
  async fetchAndNormalize(params?: {
    maxListings?: number;
    borough?: string;
    minPrice?: number;
    maxPrice?: number;
    beds?: number;
  }): Promise<NormalizedListing[]> {
    const apifyListings = await this.fetchFromApify(params);
    return apifyListings.map(listing => this.normalizeApifyListing(listing));
  }

  /**
   * Trigger a new Apify actor run
   */
  async triggerRun(input?: {
    searchUrl?: string;
    maxItems?: number;
    borough?: string;
  }): Promise<string> {
    if (!this.apiToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // Build search URL based on params
    let searchUrl = 'https://streeteasy.com/for-rent/nyc';

    if (input?.borough) {
      const boroughPaths: Record<string, string> = {
        'manhattan': 'manhattan',
        'brooklyn': 'brooklyn',
        'queens': 'queens',
        'bronx': 'bronx',
        'staten-island': 'staten-island',
      };
      const path = boroughPaths[input.borough.toLowerCase()];
      if (path) {
        searchUrl = `https://streeteasy.com/for-rent/${path}`;
      }
    }

    const response = await fetch(
      `${this.baseUrl}/acts/${this.actorId}/runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          startUrls: [{ url: input?.searchUrl || searchUrl }],
          maxItems: input?.maxItems || 100,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Apify run failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as ApifyRunResponse;
    return data.data.id;
  }

  /**
   * Get the status of an Apify run
   */
  async getRunStatus(runId: string): Promise<{ status: string; datasetId?: string }> {
    const response = await fetch(
      `${this.baseUrl}/acts/${this.actorId}/runs/${runId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get run status: ${response.status}`);
    }

    const data = (await response.json()) as ApifyRunResponse;
    return {
      status: data.data.status,
      datasetId: data.data.datasetId,
    };
  }

  /**
   * Wait for an Apify run to complete
   */
  async waitForRun(runId: string, timeoutMs = 300000): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < timeoutMs) {
      const { status, datasetId } = await this.getRunStatus(runId);

      if (status === 'SUCCEEDED' && datasetId) {
        return datasetId;
      }

      if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(`Apify run ${status}`);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Apify run timed out');
  }

  /**
   * Fetch listings from the most recent dataset or a specific one
   */
  private async fetchFromApify(params?: {
    datasetId?: string;
    maxListings?: number;
    borough?: string;
  }): Promise<ApifyStreetEasyListing[]> {
    if (!this.apiToken) {
      throw new Error('APIFY_API_TOKEN not configured');
    }

    // If no specific dataset, get the last run's dataset
    const datasetId = params?.datasetId || 'default';
    const limit = params?.maxListings || 1000;

    const response = await fetch(
      `${this.baseUrl}/acts/${this.actorId}/runs/last/dataset/items?token=${this.apiToken}&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('No Apify dataset found - you may need to trigger a run first');
        return [];
      }
      throw new Error(`Apify fetch failed: ${response.status}`);
    }

    const listings = (await response.json()) as ApifyStreetEasyListing[];

    // Filter by borough if specified
    if (params?.borough) {
      const boroughLower = params.borough.toLowerCase();
      return listings.filter(l =>
        l.borough?.toLowerCase() === boroughLower ||
        l.neighborhood?.toLowerCase().includes(boroughLower)
      );
    }

    return listings;
  }

  /**
   * Convert Apify listing to our normalized format
   */
  private normalizeApifyListing(apify: ApifyStreetEasyListing): NormalizedListing {
    const node = apify.node;
    if (!node) {
      throw new Error('Invalid Apify listing: missing node');
    }

    const price = node.price || node.netEffectivePrice || 0;
    const beds = node.bedroomCount || 0;
    const baths = (node.fullBathroomCount || 0) + (node.halfBathroomCount || 0) * 0.5;
    const sqft = node.livingAreaSize || undefined;

    // Build the full URL
    const sourceUrl = node.urlPath
      ? `https://streeteasy.com${node.urlPath}`
      : `https://streeteasy.com/rental/${node.id}`;

    // Build image URLs from photo keys
    const images = (node.photos || []).map(photo =>
      `https://photos.zillowstatic.com/fp/${photo.key}-se_extra_large_1500_800.webp`
    );

    // Build address from street + unit
    const addressText = node.unit
      ? `${node.street || ''} #${node.unit}`
      : node.street || '';

    // Infer borough from neighborhood
    const borough = this.inferBoroughFromNeighborhood(node.areaName || '');

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
      addressNormalized: this.normalizeAddress(addressText),
      neighborhood: node.areaName,
      borough,
      city: 'New York',
      state: 'NY',
      latitude: node.geoPoint?.latitude,
      longitude: node.geoPoint?.longitude,

      images,
      amenities: [],

      brokerCompany: node.sourceGroupLabel,

      noFee: node.noFee,
      availableDate: node.availableAt ? new Date(node.availableAt) : undefined,

      // StreetEasy-specific fields
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

      status: node.status === 'ACTIVE' ? 'active' : 'unknown',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastUpdatedAt: new Date(),
      isDuplicate: false,
    };
  }

  private extractListingId(url: string): string {
    // StreetEasy URLs are like: https://streeteasy.com/rental/1234567
    const match = url.match(/\/rental\/(\d+)/);
    return match ? match[1] : '';
  }

  private parsePrice(price: number | string | undefined): number {
    if (typeof price === 'number') return price;
    if (!price) return 0;

    const cleaned = String(price).replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }

  private parseBeds(beds: number | string | undefined): number {
    if (typeof beds === 'number') return beds;
    if (!beds) return 0;

    const str = String(beds).toLowerCase();
    if (str.includes('studio')) return 0;

    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseBaths(baths: number | string | undefined): number {
    if (typeof baths === 'number') return baths;
    if (!baths) return 1;

    const match = String(baths).match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 1;
  }

  private parseSqft(sqft: number | string | undefined): number | null {
    if (typeof sqft === 'number') return sqft;
    if (!sqft) return null;

    const cleaned = String(sqft).replace(/[^0-9]/g, '');
    const value = parseInt(cleaned, 10);
    return isNaN(value) ? null : value;
  }

  private normalizeAddress(address: string): string {
    return address
      .replace(/\s+/g, ' ')
      .replace(/,\s*,/g, ',')
      .trim();
  }

  private inferBoroughFromNeighborhood(neighborhood: string): string | undefined {
    const lower = neighborhood.toLowerCase();

    const manhattanNeighborhoods = [
      'upper east side', 'upper west side', 'midtown', 'chelsea', 'greenwich village',
      'east village', 'west village', 'soho', 'tribeca', 'financial district',
      'lower east side', 'harlem', 'washington heights', 'inwood', 'murray hill',
      'gramercy', 'flatiron', 'noho', 'nolita', 'chinatown', 'little italy',
      'battery park', 'hells kitchen', 'kips bay', 'sutton place', 'yorkville',
    ];

    const brooklynNeighborhoods = [
      'williamsburg', 'bushwick', 'bed-stuy', 'bedford-stuyvesant', 'crown heights',
      'park slope', 'dumbo', 'brooklyn heights', 'greenpoint', 'prospect heights',
      'fort greene', 'clinton hill', 'cobble hill', 'carroll gardens', 'red hook',
      'sunset park', 'bay ridge', 'flatbush', 'prospect lefferts gardens', 'ditmas park',
      'boerum hill', 'gowanus', 'windsor terrace', 'kensington',
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
