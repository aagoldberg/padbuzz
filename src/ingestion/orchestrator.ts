import { v4 as uuidv4 } from 'uuid';
import { createAdapter } from './adapters';
import {
  getSourceById,
  saveRawPage,
  upsertListing,
  markListingsDelisted,
  recordSourceMetric,
  updateRawPageParseStatus,
  enqueueJob,
} from './db';
import { SourceConfig, NormalizedListing, Job } from './types';

export interface CrawlResult {
  sourceId: string;
  listingsFound: number;
  newListings: number;
  updatedListings: number;
  delistedListings: number;
  errors: string[];
  duration: number;
}

/**
 * Run a full crawl for a source
 */
export async function runCrawl(
  sourceId: string,
  options?: {
    maxPages?: number;
    maxListings?: number;
    dryRun?: boolean;
  }
): Promise<CrawlResult> {
  const startTime = Date.now();
  const result: CrawlResult = {
    sourceId,
    listingsFound: 0,
    newListings: 0,
    updatedListings: 0,
    delistedListings: 0,
    errors: [],
    duration: 0,
  };

  // Get source config
  const sourceConfig = await getSourceById(sourceId);
  if (!sourceConfig) {
    result.errors.push(`Source not found: ${sourceId}`);
    return result;
  }

  if (!sourceConfig.enabled) {
    result.errors.push(`Source is disabled: ${sourceId}`);
    return result;
  }

  const adapter = createAdapter(sourceConfig);
  const maxPages = options?.maxPages || 5;
  const maxListings = options?.maxListings || 500;
  const activeUrls: string[] = [];

  try {
    // Step 1: Discover listing URLs
    console.log(`[${sourceId}] Starting crawl...`);

    for (let page = 0; page < maxPages; page++) {
      const listingUrls = await adapter.listListingUrls({ page });

      if (listingUrls.length === 0) {
        console.log(`[${sourceId}] No more listings on page ${page + 1}`);
        break;
      }

      console.log(`[${sourceId}] Found ${listingUrls.length} listings on page ${page + 1}`);

      // Step 2: Fetch and parse each listing
      for (const { url, sourceListingId } of listingUrls) {
        if (result.listingsFound >= maxListings) {
          console.log(`[${sourceId}] Reached max listings limit`);
          break;
        }

        try {
          // Fetch the listing page
          const rawPage = await adapter.fetch(url);

          if (rawPage.httpStatus !== 200) {
            result.errors.push(`Failed to fetch ${url}: ${rawPage.httpStatus}`);
            await recordSourceMetric(sourceId, { fetchFailures: 1 });
            continue;
          }

          await recordSourceMetric(sourceId, { fetchSuccesses: 1, fetchAttempts: 1 });

          if (options?.dryRun) {
            result.listingsFound++;
            activeUrls.push(url);
            continue;
          }

          // Save raw page
          const rawPageId = await saveRawPage(rawPage);

          // Parse the listing
          const listings = await adapter.parse({ ...rawPage, _id: rawPageId });

          if (listings.length === 0) {
            await updateRawPageParseStatus(rawPageId, 'failed', 'No listings extracted');
            await recordSourceMetric(sourceId, { parseFailures: 1 });
            continue;
          }

          await updateRawPageParseStatus(rawPageId, 'parsed');
          await recordSourceMetric(sourceId, { parseSuccesses: 1, parseAttempts: 1 });

          // Save listings
          for (const listing of listings) {
            const listingId = await upsertListing(listing);
            result.listingsFound++;
            activeUrls.push(listing.sourceUrl);

            // Track new vs updated
            if (listing._id) {
              result.updatedListings++;
            } else {
              result.newListings++;
            }
          }

          await recordSourceMetric(sourceId, {
            listingsFound: listings.length,
            newListings: listings.length,
          });

        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error processing ${url}: ${errorMsg}`);
          await recordSourceMetric(sourceId, {
            fetchFailures: 1,
            lastError: errorMsg,
          });
        }
      }

      if (result.listingsFound >= maxListings) break;
    }

    // Step 3: Mark missing listings as delisted
    if (!options?.dryRun && activeUrls.length > 0) {
      const delistedCount = await markListingsDelisted(sourceId, activeUrls);
      result.delistedListings = delistedCount;

      if (delistedCount > 0) {
        await recordSourceMetric(sourceId, { delistedListings: delistedCount });
      }
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown crawl error';
    result.errors.push(errorMsg);
    await recordSourceMetric(sourceId, { lastError: errorMsg });
  }

  result.duration = Date.now() - startTime;

  console.log(`[${sourceId}] Crawl complete:`, {
    found: result.listingsFound,
    new: result.newListings,
    delisted: result.delistedListings,
    errors: result.errors.length,
    duration: `${result.duration}ms`,
  });

  return result;
}

/**
 * Schedule a crawl job for a source
 */
export async function scheduleCrawl(
  sourceId: string,
  options?: {
    priority?: number;
    delay?: number;
  }
): Promise<string> {
  const jobId = uuidv4();
  const scheduledFor = new Date(Date.now() + (options?.delay || 0));

  await enqueueJob({
    jobId,
    type: 'refresh',
    status: 'pending',
    payload: { sourceId },
    priority: options?.priority || 1,
    scheduledFor,
    attempts: 0,
    maxAttempts: 3,
  });

  return jobId;
}

/**
 * Schedule crawls for all enabled sources
 */
export async function scheduleAllCrawls(): Promise<{ scheduled: number; jobIds: string[] }> {
  const { getEnabledSources } = await import('./db');
  const sources = await getEnabledSources();
  const jobIds: string[] = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    // Stagger crawls based on priority
    const delay = i * 60 * 1000; // 1 minute apart
    const jobId = await scheduleCrawl(source.id, {
      priority: source.priority,
      delay,
    });
    jobIds.push(jobId);
  }

  return { scheduled: sources.length, jobIds };
}
