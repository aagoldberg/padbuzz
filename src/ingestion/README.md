# PadBuzz Data Ingestion System

Multi-source apartment listing ingestion framework with pluggable adapters, job queue, and deduplication.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Source Configs │────▶│    Adapters     │────▶│   Raw Pages     │
│  (MongoDB)      │     │  (Craigslist,   │     │   (MongoDB)     │
│                 │     │   Generic, etc) │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Job Queue      │────▶│   Orchestrator  │────▶│  Normalized     │
│  (MongoDB)      │     │                 │     │  Listings       │
│                 │     │                 │     │  (MongoDB)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Collections

| Collection | Purpose |
|------------|---------|
| `ingestion_sources` | Source configurations (Craigslist, brokers, etc.) |
| `ingestion_raw_pages` | Raw HTML/responses from scraping |
| `ingestion_listings` | Normalized, parsed listings |
| `ingestion_jobs` | Job queue for async processing |
| `ingestion_source_health` | Per-source metrics and health data |
| `price_benchmarks` | Pre-computed percentiles for comparisons |

## API Endpoints

### Sources

```bash
# List all sources
GET /api/ingestion/sources

# List enabled sources only
GET /api/ingestion/sources?enabled=true

# Add/update a source
POST /api/ingestion/sources
Body: { "source": { ...SourceConfig } }

# Seed sources from sources_seed.json
PUT /api/ingestion/sources
```

### Crawling

```bash
# Trigger crawl for a specific source
POST /api/ingestion/crawl/craigslist-nyc
POST /api/ingestion/crawl/craigslist-nyc?maxPages=3&maxListings=100
POST /api/ingestion/crawl/craigslist-nyc?async=true  # Queue for background

# Crawl all enabled sources (sync, limited)
POST /api/ingestion/crawl?limit=3

# Schedule all crawls for background processing
POST /api/ingestion/crawl?async=true
```

### Listings

```bash
# Query listings
GET /api/ingestion/listings
GET /api/ingestion/listings?borough=Brooklyn&maxPrice=3000&beds=2
GET /api/ingestion/listings?sourceId=craigslist-nyc&status=active
GET /api/ingestion/listings?sort=price&sortOrder=asc&limit=50
```

### Jobs

```bash
# Process pending jobs
POST /api/ingestion/jobs/process?max=5

# Get job queue status
GET /api/ingestion/jobs/process
```

### Stats

```bash
# Get ingestion health metrics
GET /api/ingestion/stats
```

## Adding a New Source

### 1. Add to sources_seed.json

```json
{
  "id": "my-broker",
  "name": "My Broker Site",
  "type": "brokerage",
  "enabled": true,
  "priority": 20,
  "urls": {
    "base": "https://mybroker.com",
    "searchPath": "/rentals"
  },
  "dataAvailability": {
    "price": "high",
    "beds": "high",
    ...
  },
  "scrapeConfig": {
    "difficulty": "low",
    "rateLimit": {
      "requestsPerMinute": 5,
      "delayMs": 5000,
      "jitterMs": 2000
    },
    "refreshIntervalMinutes": 120,
    "parser": "generic-broker",
    "requiresJs": false
  }
}
```

### 2. Seed the source

```bash
curl -X PUT /api/ingestion/sources
```

### 3. Test crawl

```bash
curl -X POST /api/ingestion/crawl/my-broker?dryRun=true
```

## Creating a Custom Adapter

If the generic adapter doesn't work well, create a custom one:

```typescript
// src/ingestion/adapters/my-broker.ts
import { BaseAdapter } from './base';
import { SourceConfig, RawPage, NormalizedListing, ListingUrlResult } from '../types';

export class MyBrokerAdapter extends BaseAdapter {
  constructor(config: SourceConfig) {
    super(config);
  }

  async listListingUrls(params?: { page?: number }): Promise<ListingUrlResult[]> {
    // Custom logic to find listing URLs
  }

  async parse(rawPage: RawPage): Promise<NormalizedListing[]> {
    // Custom parsing logic
  }
}
```

Then register it:

```typescript
// src/ingestion/adapters/index.ts
import { MyBrokerAdapter } from './my-broker';

const adapterFactories: Record<string, AdapterFactory> = {
  // ...
  'my-broker': (config) => new MyBrokerAdapter(config),
};
```

## Debugging a Broken Parser

1. **Check source health**
```bash
curl /api/ingestion/stats | jq '.sourceHealth[] | select(.sourceId == "my-source")'
```

2. **View recent jobs**
```bash
curl /api/ingestion/jobs/process | jq '.recentJobs'
```

3. **Test a single URL**
```typescript
import { createAdapter } from '@/ingestion/adapters';
import { getSourceById } from '@/ingestion/db';

const config = await getSourceById('my-source');
const adapter = createAdapter(config);

// Test fetch
const rawPage = await adapter.fetch('https://example.com/listing/123');
console.log(rawPage.httpStatus, rawPage.htmlContent.substring(0, 500));

// Test parse
const listings = await adapter.parse(rawPage);
console.log(listings);
```

## Running Locally

```bash
# Start dev server
npm run dev

# Initialize sources
curl -X PUT http://localhost:3000/api/ingestion/sources

# Run a test crawl
curl -X POST "http://localhost:3000/api/ingestion/crawl/craigslist-nyc?maxPages=1&maxListings=10"

# Check stats
curl http://localhost:3000/api/ingestion/stats | jq
```

## Cron Jobs (Vercel)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/ingestion/crawl?async=true",
      "schedule": "0 */4 * * *"
    },
    {
      "path": "/api/ingestion/jobs/process?max=10",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

## Excluded Sources

Per project requirements, these sources are **excluded**:

- Zillow / StreetEasy (Zillow-owned)
- Trulia (Zillow-owned)
- HotPads (Zillow-owned)
- Facebook Marketplace (Meta)

## Source Types

| Type | Description | Examples |
|------|-------------|----------|
| `classifieds` | Open listing sites | Craigslist |
| `marketplace` | Rental-focused platforms | RentHop, LeaseBreak |
| `brokerage` | Major broker sites | Compass, Corcoran |
| `boutique-broker` | Smaller/local brokers | Bohemia Realty |
| `property-management` | Building/management sites | - |
