import { NextRequest, NextResponse } from 'next/server';
import {
  getSourcesCollection,
  getEnabledSources,
  upsertSource,
  getSourceHealthSummary,
} from '@/ingestion/db';
import { SourceConfig } from '@/ingestion/types';
import sourcesSeed from '@/ingestion/sources_seed.json';

/**
 * GET /api/ingestion/sources
 * List all sources with health status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const enabledOnly = searchParams.get('enabled') === 'true';

  try {
    const collection = await getSourcesCollection();

    const sources = enabledOnly
      ? await getEnabledSources()
      : await collection.find({}).sort({ priority: 1 }).toArray();

    // Get health metrics
    const healthData = await getSourceHealthSummary();

    // Merge health into sources
    const sourcesWithHealth = sources.map(source => {
      const health = healthData.filter(h => h.sourceId === source.id);
      const recentHealth = health[0];

      let status: 'healthy' | 'degraded' | 'failing' = 'healthy';
      if (recentHealth) {
        const failureRate = recentHealth.fetchFailures /
          Math.max(1, recentHealth.fetchAttempts);
        if (failureRate > 0.5) status = 'failing';
        else if (failureRate > 0.2) status = 'degraded';
      }

      return {
        ...source,
        health: {
          status,
          lastError: recentHealth?.lastError,
          lastErrorAt: recentHealth?.lastErrorAt,
          listingsFound: recentHealth?.listingsFound || 0,
          failureRate: recentHealth
            ? recentHealth.fetchFailures / Math.max(1, recentHealth.fetchAttempts)
            : 0,
        },
      };
    });

    return NextResponse.json({
      sources: sourcesWithHealth,
      total: sources.length,
      enabled: sources.filter(s => s.enabled).length,
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
  }
}

/**
 * POST /api/ingestion/sources
 * Add or update a source
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const source: SourceConfig = body.source;

    if (!source || !source.id || !source.name) {
      return NextResponse.json(
        { error: 'Source must have id and name' },
        { status: 400 }
      );
    }

    await upsertSource(source);

    return NextResponse.json({
      message: `Source ${source.id} saved`,
      source,
    });
  } catch (error) {
    console.error('Error saving source:', error);
    return NextResponse.json({ error: 'Failed to save source' }, { status: 500 });
  }
}

/**
 * PUT /api/ingestion/sources (seed sources)
 * Initialize sources from seed file
 */
export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  if (adminSecret && authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let seeded = 0;

    for (const source of sourcesSeed.sources) {
      // Skip excluded sources
      if (source.notes?.includes('EXCLUDE')) continue;

      await upsertSource(source as unknown as SourceConfig);
      seeded++;
    }

    return NextResponse.json({
      message: `Seeded ${seeded} sources`,
      total: sourcesSeed.sources.length,
    });
  } catch (error) {
    console.error('Error seeding sources:', error);
    return NextResponse.json({ error: 'Failed to seed sources' }, { status: 500 });
  }
}
