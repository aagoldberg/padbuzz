// ============================================
// SOURCE CONFIGURATION TYPES
// ============================================

export type SourceType = 'classifieds' | 'marketplace' | 'brokerage' | 'boutique-broker' | 'property-management';
export type DataQuality = 'high' | 'medium' | 'low' | 'none';
export type ScrapeDifficulty = 'low' | 'medium' | 'high';

export interface RateLimitConfig {
  requestsPerMinute: number;
  delayMs: number;
  jitterMs: number;
}

export interface ScrapeConfig {
  difficulty: ScrapeDifficulty;
  rateLimit: RateLimitConfig;
  refreshIntervalMinutes: number;
  parser: string;
  requiresJs: boolean;
}

export interface DataAvailability {
  price: DataQuality;
  beds: DataQuality;
  baths: DataQuality;
  sqft: DataQuality;
  address: DataQuality;
  images: DataQuality;
  description: DataQuality;
  broker: DataQuality;
}

export interface SourceConfig {
  id: string;
  name: string;
  type: SourceType;
  enabled: boolean;
  priority: number;
  urls: {
    base: string;
    searchPath?: string;
    sitemap?: string;
    apiEndpoint?: string | null;
    categories?: string[];
    boroughFilters?: Record<string, string>;
  };
  dataAvailability: DataAvailability;
  scrapeConfig: ScrapeConfig;
  notes?: string;
}

// ============================================
// RAW PAGE STORAGE
// ============================================

export interface RawPage {
  _id?: string;
  sourceId: string;
  url: string;
  fetchedAt: Date;
  httpStatus: number;
  htmlContent: string;
  contentHash: string; // SHA256 of HTML for change detection
  extractedImageUrls: string[];
  headers?: Record<string, string>;
  errorMessage?: string;
  parseStatus: 'pending' | 'parsed' | 'failed';
  parsedAt?: Date;
}

// ============================================
// NORMALIZED LISTING
// ============================================

export type ListingStatus = 'active' | 'delisted' | 'expired' | 'unknown';

export interface NormalizedListing {
  _id?: string;
  listingId: string; // Internal UUID

  // Source tracking
  sourceId: string;
  sourceListingId?: string; // Original ID from source if available
  sourceUrl: string;
  rawPageId?: string;

  // Core fields
  title?: string;
  price: number;
  beds: number;
  baths: number;
  sqft?: number;

  // Location
  addressText: string; // Raw address as scraped
  addressNormalized?: string; // Cleaned/standardized
  neighborhood?: string;
  borough?: string;
  city: string;
  state: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;

  // Media
  images: string[];
  imageHashes?: string[]; // For dedup

  // Content
  description?: string;
  amenities: string[];

  // Broker/Contact
  brokerName?: string;
  brokerCompany?: string;
  contactPhone?: string;
  contactEmail?: string;

  // Metadata
  noFee?: boolean;
  rentStabilized?: boolean;
  availableDate?: Date;

  // StreetEasy-specific fields
  netEffectivePrice?: number;
  monthsFree?: number;
  leaseTermMonths?: number;
  furnished?: boolean;
  isNewDevelopment?: boolean;
  hasTour3d?: boolean;
  hasVideos?: boolean;
  mediaAssetCount?: number;
  buildingType?: string;
  upcomingOpenHouse?: Date;
  unit?: string;
  tier?: string; // Listing tier (e.g., "FEATURED", "STANDARD")
  priceDelta?: number; // Recent price change
  offMarketAt?: Date; // When listing went off market

  // Tracking
  status: ListingStatus;
  firstSeenAt: Date;
  lastSeenAt: Date;
  lastUpdatedAt: Date;
  delistedAt?: Date;

  // Derived (populated by analysis jobs)
  storedImageAnalysis?: {
    overallQuality: number;
    cleanliness: number;
    light: number;
    renovation: number;
    analyzedAt: Date;
  };
  priceHistory?: Array<{ price: number; date: Date }>;
  relistDetected?: boolean;

  // Dedup
  canonicalListingId?: string; // Points to master listing if duplicate
  isDuplicate: boolean;
  duplicateOf?: string;
  duplicateConfidence?: number;
}

// ============================================
// CANONICAL LISTING (Merged/Deduplicated)
// ============================================

export interface CanonicalListing {
  _id?: string;
  canonicalId: string;

  // Best data from all sources
  bestPrice: number;
  beds: number;
  baths: number;
  sqft?: number;
  addressNormalized: string;
  neighborhood?: string;
  borough?: string;

  // Aggregated
  allSourceIds: string[];
  allSourceUrls: string[];
  allImages: string[]; // Deduplicated

  // Tracking
  firstSeenAt: Date;
  lastSeenAt: Date;
  status: ListingStatus;

  // Scoring
  dataQualityScore: number; // Higher = more complete data
  sourceCount: number;
}

// ============================================
// JOB QUEUE
// ============================================

export type JobType = 'fetch' | 'parse' | 'dedup' | 'analyze' | 'refresh';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'retrying';

export interface Job {
  _id?: string;
  jobId: string;
  type: JobType;
  status: JobStatus;

  // Job-specific payload
  payload: {
    sourceId?: string;
    url?: string;
    rawPageId?: string;
    listingId?: string;
    [key: string]: unknown;
  };

  // Scheduling
  priority: number;
  scheduledFor: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Retry handling
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: Date;

  // Results
  result?: unknown;

  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// SOURCE HEALTH / METRICS
// ============================================

export interface SourceHealth {
  _id?: string;
  sourceId: string;
  date: Date; // Day granularity
  updatedAt?: Date;

  // Counts
  fetchAttempts: number;
  fetchSuccesses: number;
  fetchFailures: number;
  parseAttempts: number;
  parseSuccesses: number;
  parseFailures: number;
  listingsFound: number;
  newListings: number;
  updatedListings: number;
  delistedListings: number;
  duplicatesDetected: number;

  // Performance
  avgFetchTimeMs: number;
  avgParseTimeMs: number;

  // Errors
  lastError?: string;
  lastErrorAt?: Date;
}

// ============================================
// ADAPTER INTERFACE
// ============================================

export interface ListingUrlResult {
  url: string;
  sourceListingId?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceAdapter {
  sourceId: string;
  config: SourceConfig;

  /**
   * List all listing URLs from search/index pages
   */
  listListingUrls(params?: {
    borough?: string;
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<ListingUrlResult[]>;

  /**
   * Fetch a single page and return raw content
   */
  fetch(url: string): Promise<RawPage>;

  /**
   * Parse a raw page into normalized listings
   */
  parse(rawPage: RawPage): Promise<NormalizedListing[]>;

  /**
   * Optional: Check if page has changed since last fetch
   */
  hasChanged?(url: string, lastContentHash: string): Promise<boolean>;
}

// ============================================
// API TYPES
// ============================================

export interface ListingsQuery {
  sourceId?: string;
  borough?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  noFeeOnly?: boolean;
  status?: ListingStatus;
  since?: Date; // Only listings updated after this date
  limit?: number;
  offset?: number;
  sort?: 'price' | 'date' | 'quality';
  sortOrder?: 'asc' | 'desc';
}

export interface IngestionStats {
  totalSources: number;
  enabledSources: number;
  totalListings: number;
  activeListings: number;
  listingsLast24h: number;
  deduplicationRate: number;
  sourceHealth: Array<{
    sourceId: string;
    sourceName: string;
    status: 'healthy' | 'degraded' | 'failing';
    lastSuccessAt?: Date;
    listingsCount: number;
    failureRate: number;
  }>;
}
