import { NextResponse } from 'next/server';
import {
  getSourcesCollection,
  getIngestedListingsCollection,
  getSourceHealthSummary,
} from '@/ingestion/db';

/**
 * GET /api/ingestion/stats
 * Get ingestion system health and metrics
 */
export async function GET() {
  try {
    const [sources, listings, health] = await Promise.all([
      getSourcesCollection(),
      getIngestedListingsCollection(),
      getSourceHealthSummary(),
    ]);

    // Count sources
    const [totalSources, enabledSources] = await Promise.all([
      sources.countDocuments({}),
      sources.countDocuments({ enabled: true }),
    ]);

    // Count listings
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalListings, activeListings, listingsLast24h, duplicateListings] = await Promise.all([
      listings.countDocuments({}),
      listings.countDocuments({ status: 'active', isDuplicate: false }),
      listings.countDocuments({ lastSeenAt: { $gte: dayAgo } }),
      listings.countDocuments({ isDuplicate: true }),
    ]);

    // Calculate deduplication rate
    const deduplicationRate = totalListings > 0
      ? duplicateListings / totalListings
      : 0;

    // Get source-level stats
    const allSources = await sources.find({}).toArray();

    const sourceHealth = await Promise.all(
      allSources.map(async (source) => {
        const sourceHealthRecords = health.filter(h => h.sourceId === source.id);
        const recentHealth = sourceHealthRecords[0];

        const listingsCount = await listings.countDocuments({
          sourceId: source.id,
          status: 'active',
        });

        let status: 'healthy' | 'degraded' | 'failing' = 'healthy';
        let failureRate = 0;

        if (recentHealth) {
          failureRate = recentHealth.fetchFailures /
            Math.max(1, recentHealth.fetchAttempts);
          if (failureRate > 0.5) status = 'failing';
          else if (failureRate > 0.2) status = 'degraded';
        }

        return {
          sourceId: source.id,
          sourceName: source.name,
          enabled: source.enabled,
          status: source.enabled ? status : 'disabled' as const,
          lastSuccessAt: recentHealth?.updatedAt,
          listingsCount,
          failureRate: Math.round(failureRate * 100) / 100,
          newListingsToday: recentHealth?.newListings || 0,
        };
      })
    );

    // Aggregate stats by day for chart data
    const dailyStats = health.reduce((acc, h) => {
      const dateKey = h.date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, fetched: 0, parsed: 0, new: 0, failed: 0 };
      }
      acc[dateKey].fetched += h.fetchSuccesses || 0;
      acc[dateKey].parsed += h.parseSuccesses || 0;
      acc[dateKey].new += h.newListings || 0;
      acc[dateKey].failed += h.fetchFailures || 0;
      return acc;
    }, {} as Record<string, { date: string; fetched: number; parsed: number; new: number; failed: number }>);

    const stats = {
      totalSources,
      enabledSources,
      totalListings,
      activeListings,
      listingsLast24h,
      deduplicationRate: Math.round(deduplicationRate * 100) / 100,
      sourceHealth: sourceHealth.sort((a, b) => b.listingsCount - a.listingsCount),
      dailyStats: Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date)),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
