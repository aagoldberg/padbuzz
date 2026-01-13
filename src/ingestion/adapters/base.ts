import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  SourceAdapter,
  SourceConfig,
  RawPage,
  NormalizedListing,
  ListingUrlResult,
} from '../types';

/**
 * Base adapter with common functionality
 */
export abstract class BaseAdapter implements SourceAdapter {
  sourceId: string;
  config: SourceConfig;

  constructor(config: SourceConfig) {
    this.sourceId = config.id;
    this.config = config;
  }

  abstract listListingUrls(params?: {
    borough?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<ListingUrlResult[]>;

  abstract parse(rawPage: RawPage): Promise<NormalizedListing[]>;

  /**
   * Fetch a URL with rate limiting and error handling
   */
  async fetch(url: string): Promise<RawPage> {
    const { rateLimit } = this.config.scrapeConfig;

    // Add jitter to delay
    const jitter = Math.random() * rateLimit.jitterMs;
    await this.sleep(rateLimit.delayMs + jitter);

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      const htmlContent = await response.text();
      const contentHash = this.hashContent(htmlContent);
      const extractedImageUrls = this.extractImageUrls(htmlContent);

      return {
        sourceId: this.sourceId,
        url,
        fetchedAt: new Date(),
        httpStatus: response.status,
        htmlContent,
        contentHash,
        extractedImageUrls,
        parseStatus: 'pending',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown fetch error';

      return {
        sourceId: this.sourceId,
        url,
        fetchedAt: new Date(),
        httpStatus: 0,
        htmlContent: '',
        contentHash: '',
        extractedImageUrls: [],
        errorMessage,
        parseStatus: 'failed',
      };
    }
  }

  /**
   * Check if content has changed since last fetch
   */
  async hasChanged(url: string, lastContentHash: string): Promise<boolean> {
    // Do a lightweight HEAD request first if possible, then full fetch
    const page = await this.fetch(url);
    return page.contentHash !== lastContentHash;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  protected getHeaders(): Record<string, string> {
    return {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
    };
  }

  protected hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  protected hashImage(imageUrl: string): string {
    return crypto.createHash('md5').update(imageUrl).digest('hex');
  }

  protected extractImageUrls(html: string): string[] {
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const urls: string[] = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }

  protected generateListingId(): string {
    return uuidv4();
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected cleanPrice(priceStr: string): number | null {
    const cleaned = priceStr.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);
    return isNaN(price) ? null : price;
  }

  protected parseBeds(text: string): number {
    const match = text.match(/(\d+)\s*(?:br|bed|bedroom)/i);
    if (match) return parseInt(match[1], 10);

    if (/studio/i.test(text)) return 0;
    return 0;
  }

  protected parseBaths(text: string): number {
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)/i);
    if (match) return parseFloat(match[1]);
    return 1; // Default assumption
  }

  protected parseSqft(text: string): number | null {
    const match = text.match(/(\d+(?:,\d+)?)\s*(?:sq\.?\s*ft|sqft|sf)/i);
    if (match) {
      return parseInt(match[1].replace(',', ''), 10);
    }
    return null;
  }

  protected normalizeAddress(address: string): string {
    return address
      .replace(/\s+/g, ' ')
      .replace(/,\s*,/g, ',')
      .trim();
  }

  protected inferBoroughFromAddress(address: string): string | undefined {
    const boroughPatterns: Record<string, RegExp[]> = {
      Manhattan: [/manhattan/i, /\bnyc\b/i, /new york,?\s*ny/i, /midtown/i, /uptown/i, /downtown/i],
      Brooklyn: [/brooklyn/i, /\bbk\b/i, /williamsburg/i, /bushwick/i, /bed-?stuy/i],
      Queens: [/queens/i, /astoria/i, /long island city/i, /\blic\b/i, /flushing/i],
      Bronx: [/bronx/i, /\bbx\b/i],
      'Staten Island': [/staten island/i, /\bsi\b/i],
    };

    for (const [borough, patterns] of Object.entries(boroughPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(address)) {
          return borough;
        }
      }
    }

    return undefined;
  }

  protected inferNeighborhood(address: string, borough?: string): string | undefined {
    // Manhattan neighborhoods
    const manhattanNeighborhoods = [
      'Upper East Side', 'Upper West Side', 'Midtown', 'Chelsea', 'Greenwich Village',
      'East Village', 'West Village', 'SoHo', 'Tribeca', 'Financial District',
      'Lower East Side', 'Harlem', 'Washington Heights', 'Inwood', 'Murray Hill',
      'Gramercy', 'Flatiron', 'NoHo', 'Nolita', 'Chinatown', 'Little Italy',
    ];

    // Brooklyn neighborhoods
    const brooklynNeighborhoods = [
      'Williamsburg', 'Bushwick', 'Bed-Stuy', 'Crown Heights', 'Park Slope',
      'DUMBO', 'Brooklyn Heights', 'Greenpoint', 'Prospect Heights', 'Fort Greene',
      'Clinton Hill', 'Cobble Hill', 'Carroll Gardens', 'Red Hook', 'Sunset Park',
      'Bay Ridge', 'Flatbush', 'Prospect Lefferts Gardens', 'Ditmas Park',
    ];

    // Queens neighborhoods
    const queensNeighborhoods = [
      'Astoria', 'Long Island City', 'Sunnyside', 'Woodside', 'Jackson Heights',
      'Flushing', 'Forest Hills', 'Rego Park', 'Ridgewood',
    ];

    const allNeighborhoods = [
      ...manhattanNeighborhoods,
      ...brooklynNeighborhoods,
      ...queensNeighborhoods,
    ];

    const lowerAddress = address.toLowerCase();

    for (const neighborhood of allNeighborhoods) {
      if (lowerAddress.includes(neighborhood.toLowerCase())) {
        return neighborhood;
      }
    }

    return undefined;
  }

  protected createBaseListing(overrides: Partial<NormalizedListing>): NormalizedListing {
    return {
      listingId: this.generateListingId(),
      sourceId: this.sourceId,
      sourceUrl: '',
      price: 0,
      beds: 0,
      baths: 1,
      addressText: '',
      city: 'New York',
      state: 'NY',
      images: [],
      amenities: [],
      status: 'active',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      lastUpdatedAt: new Date(),
      isDuplicate: false,
      ...overrides,
    };
  }
}
