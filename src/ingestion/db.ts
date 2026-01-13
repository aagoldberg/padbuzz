import { connectToDatabase } from '@/lib/mongodb';
import { Collection, ObjectId, Document } from 'mongodb';
import {
  SourceConfig,
  RawPage,
  NormalizedListing,
  CanonicalListing,
  Job,
  SourceHealth,
} from './types';

// ============================================
// COLLECTION GETTERS
// ============================================

export async function getSourcesCollection(): Promise<Collection<Document>> {
  const { db } = await connectToDatabase();
  return db.collection('ingestion_sources');
}

export async function getRawPagesCollection(): Promise<Collection<Document>> {
  const { db } = await connectToDatabase();
  return db.collection('ingestion_raw_pages');
}

export async function getIngestedListingsCollection(): Promise<Collection<Document>> {
  const { db } = await connectToDatabase();
  return db.collection('ingestion_listings');
}

export async function getCanonicalListingsCollection(): Promise<Collection<Document>> {
  const { db } = await connectToDatabase();
  return db.collection('canonical_listings');
}

export async function getJobsCollection(): Promise<Collection<Document>> {
  const { db } = await connectToDatabase();
  return db.collection('ingestion_jobs');
}

export async function getSourceHealthCollection(): Promise<Collection<Document>> {
  const { db } = await connectToDatabase();
  return db.collection('ingestion_source_health');
}

// ============================================
// SOURCE OPERATIONS
// ============================================

export async function getEnabledSources(): Promise<SourceConfig[]> {
  const collection = await getSourcesCollection();
  return collection.find({ enabled: true }).sort({ priority: 1 }).toArray() as unknown as Promise<SourceConfig[]>;
}

export async function getSourceById(sourceId: string): Promise<SourceConfig | null> {
  const collection = await getSourcesCollection();
  return collection.findOne({ id: sourceId }) as unknown as Promise<SourceConfig | null>;
}

export async function upsertSource(source: SourceConfig): Promise<void> {
  const collection = await getSourcesCollection();
  await collection.updateOne(
    { id: source.id },
    { $set: source },
    { upsert: true }
  );
}

// ============================================
// RAW PAGE OPERATIONS
// ============================================

export async function saveRawPage(rawPage: Omit<RawPage, '_id'>): Promise<string> {
  const collection = await getRawPagesCollection();
  const result = await collection.insertOne(rawPage as unknown as Document);
  return result.insertedId.toString();
}

export async function getRawPageByUrl(url: string): Promise<RawPage | null> {
  const collection = await getRawPagesCollection();
  return collection.findOne({ url }, { sort: { fetchedAt: -1 } }) as unknown as Promise<RawPage | null>;
}

export async function updateRawPageParseStatus(
  rawPageId: string,
  status: RawPage['parseStatus'],
  error?: string
): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection('ingestion_raw_pages');
  await collection.updateOne(
    { _id: new ObjectId(rawPageId) },
    {
      $set: {
        parseStatus: status,
        parsedAt: status === 'parsed' ? new Date() : undefined,
        errorMessage: error,
      },
    }
  );
}

// ============================================
// LISTING OPERATIONS
// ============================================

export async function upsertListing(listing: NormalizedListing): Promise<string> {
  const collection = await getIngestedListingsCollection();

  const existing = await collection.findOne({
    sourceId: listing.sourceId,
    sourceUrl: listing.sourceUrl,
  });

  if (existing) {
    // Update existing
    const priceChanged = existing.price !== listing.price;
    const priceHistory = existing.priceHistory || [];

    if (priceChanged) {
      priceHistory.push({ price: existing.price, date: existing.lastSeenAt });
    }

    await collection.updateOne(
      { _id: existing._id },
      {
        $set: {
          ...listing,
          listingId: existing.listingId,
          firstSeenAt: existing.firstSeenAt,
          lastSeenAt: new Date(),
          lastUpdatedAt: new Date(),
          priceHistory,
          relistDetected: existing.status === 'delisted' && listing.status === 'active',
        },
      }
    );

    return existing.listingId;
  }

  // Insert new
  const newListing = {
    ...listing,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    lastUpdatedAt: new Date(),
    isDuplicate: false,
    priceHistory: [],
  };
  delete (newListing as Record<string, unknown>)._id; // Remove _id if present
  await collection.insertOne(newListing as unknown as Document);

  return listing.listingId;
}

export async function markListingsDelisted(
  sourceId: string,
  activeUrls: string[]
): Promise<number> {
  const collection = await getIngestedListingsCollection();

  const result = await collection.updateMany(
    {
      sourceId,
      status: 'active',
      sourceUrl: { $nin: activeUrls },
    },
    {
      $set: {
        status: 'delisted',
        delistedAt: new Date(),
        lastUpdatedAt: new Date(),
      },
    }
  );

  return result.modifiedCount;
}

export async function findPotentialDuplicates(
  listing: NormalizedListing
): Promise<NormalizedListing[]> {
  const collection = await getIngestedListingsCollection();

  // Find listings with similar characteristics
  return collection
    .find({
      listingId: { $ne: listing.listingId },
      price: { $gte: listing.price * 0.95, $lte: listing.price * 1.05 },
      beds: listing.beds,
      baths: listing.baths,
      borough: listing.borough,
      isDuplicate: false,
    })
    .toArray() as unknown as Promise<NormalizedListing[]>;
}

// ============================================
// JOB QUEUE OPERATIONS
// ============================================

export async function enqueueJob(job: Omit<Job, '_id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const collection = await getJobsCollection();
  const now = new Date();

  const result = await collection.insertOne({
    ...job,
    createdAt: now,
    updatedAt: now,
  } as unknown as Document);

  return result.insertedId.toString();
}

export async function getNextJob(): Promise<Job | null> {
  const collection = await getJobsCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    {
      status: { $in: ['pending', 'retrying'] },
      scheduledFor: { $lte: now },
    },
    {
      $set: {
        status: 'running',
        startedAt: now,
        updatedAt: now,
      },
    },
    {
      sort: { priority: -1, scheduledFor: 1 },
      returnDocument: 'after',
    }
  );

  return result as unknown as Job | null;
}

export async function completeJob(jobId: string, result?: unknown): Promise<void> {
  const collection = await getJobsCollection();

  await collection.updateOne(
    { _id: new ObjectId(jobId) },
    {
      $set: {
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        result,
      },
    }
  );
}

export async function failJob(jobId: string, error: string): Promise<void> {
  const collection = await getJobsCollection();
  const job = await collection.findOne({ _id: new ObjectId(jobId) });

  if (!job) return;

  const attempts = job.attempts + 1;
  const shouldRetry = attempts < job.maxAttempts;

  // Exponential backoff: 1min, 5min, 15min, 30min
  const backoffMinutes = [1, 5, 15, 30][Math.min(attempts - 1, 3)];

  await collection.updateOne(
    { _id: new ObjectId(jobId) },
    {
      $set: {
        status: shouldRetry ? 'retrying' : 'failed',
        lastError: error,
        attempts,
        nextRetryAt: shouldRetry
          ? new Date(Date.now() + backoffMinutes * 60 * 1000)
          : undefined,
        scheduledFor: shouldRetry
          ? new Date(Date.now() + backoffMinutes * 60 * 1000)
          : job.scheduledFor,
        updatedAt: new Date(),
      },
    }
  );
}

// ============================================
// HEALTH METRICS
// ============================================

export async function recordSourceMetric(
  sourceId: string,
  metric: Partial<Omit<SourceHealth, '_id' | 'sourceId' | 'date'>>
): Promise<void> {
  const collection = await getSourceHealthCollection();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await collection.updateOne(
    { sourceId, date: today },
    {
      $inc: {
        fetchAttempts: metric.fetchAttempts || 0,
        fetchSuccesses: metric.fetchSuccesses || 0,
        fetchFailures: metric.fetchFailures || 0,
        parseAttempts: metric.parseAttempts || 0,
        parseSuccesses: metric.parseSuccesses || 0,
        parseFailures: metric.parseFailures || 0,
        listingsFound: metric.listingsFound || 0,
        newListings: metric.newListings || 0,
        updatedListings: metric.updatedListings || 0,
        delistedListings: metric.delistedListings || 0,
        duplicatesDetected: metric.duplicatesDetected || 0,
      },
      $set: {
        lastError: metric.lastError,
        lastErrorAt: metric.lastError ? new Date() : undefined,
      },
      $setOnInsert: {
        sourceId,
        date: today,
        avgFetchTimeMs: 0,
        avgParseTimeMs: 0,
      },
    },
    { upsert: true }
  );
}

export async function getSourceHealthSummary(): Promise<SourceHealth[]> {
  const collection = await getSourceHealthCollection();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return collection.find({ date: { $gte: weekAgo } }).sort({ date: -1 }).toArray() as unknown as Promise<SourceHealth[]>;
}

// ============================================
// INDEXES (run once on startup)
// ============================================

export async function ensureIndexes(): Promise<void> {
  const [rawPages, listings, jobs, health] = await Promise.all([
    getRawPagesCollection(),
    getIngestedListingsCollection(),
    getJobsCollection(),
    getSourceHealthCollection(),
  ]);

  // Raw pages indexes
  await rawPages.createIndex({ url: 1, fetchedAt: -1 });
  await rawPages.createIndex({ sourceId: 1, parseStatus: 1 });
  await rawPages.createIndex({ contentHash: 1 });

  // Listings indexes
  await listings.createIndex({ sourceId: 1, sourceUrl: 1 }, { unique: true });
  await listings.createIndex({ listingId: 1 }, { unique: true });
  await listings.createIndex({ canonicalListingId: 1 });
  await listings.createIndex({ status: 1, lastSeenAt: -1 });
  await listings.createIndex({ price: 1, beds: 1, borough: 1 }); // For dedup
  await listings.createIndex({ addressNormalized: 1 });
  await listings.createIndex(
    { borough: 1, neighborhood: 1, price: 1, beds: 1, status: 1 },
    { name: 'listing_search' }
  );

  // Jobs indexes
  await jobs.createIndex({ status: 1, scheduledFor: 1, priority: -1 });
  await jobs.createIndex({ type: 1, status: 1 });

  // Health indexes
  await health.createIndex({ sourceId: 1, date: -1 });
}
