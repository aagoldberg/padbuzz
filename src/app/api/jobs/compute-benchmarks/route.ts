import { NextRequest, NextResponse } from 'next/server';
import { getApartmentsCollection, getPriceBenchmarksCollection } from '@/lib/mongodb';

// Price brackets for benchmarks
const PRICE_BRACKETS = [
  { min: 0, max: 1500 },
  { min: 1500, max: 2000 },
  { min: 2000, max: 2500 },
  { min: 2500, max: 3000 },
  { min: 3000, max: 3500 },
  { min: 3500, max: 4000 },
  { min: 4000, max: 5000 },
  { min: 5000, max: 7500 },
  { min: 7500, max: Infinity },
];

function calculatePercentiles(values: number[]): { p10: number; p25: number; p50: number; p75: number; p90: number } {
  if (values.length === 0) {
    return { p10: 5, p25: 5, p50: 6, p75: 7, p90: 8 }; // defaults
  }

  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const idx = Math.floor((p / 100) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  };

  return {
    p10: percentile(10),
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
  };
}

// Recompute all price benchmarks from stored image analyses
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apartmentsCollection = await getApartmentsCollection();
    const benchmarksCollection = await getPriceBenchmarksCollection();

    const results: { priceRange: string; sampleSize: number }[] = [];

    for (const bracket of PRICE_BRACKETS) {
      // Find all analyzed listings in this price range
      const query: Record<string, unknown> = {
        'storedImageAnalysis': { $exists: true },
        price: { $gte: bracket.min }
      };

      if (bracket.max !== Infinity) {
        (query.price as Record<string, number>).$lt = bracket.max;
      }

      const listings = await apartmentsCollection.find(query).toArray();

      if (listings.length < 3) {
        // Skip brackets with too few samples
        continue;
      }

      const qualities = listings.map(l => l.storedImageAnalysis.overallQuality);
      const cleanliness = listings.map(l => l.storedImageAnalysis.cleanliness);
      const light = listings.map(l => l.storedImageAnalysis.light);
      const renovation = listings.map(l => l.storedImageAnalysis.renovation);

      const benchmark = {
        priceMin: bracket.min,
        priceMax: bracket.max === Infinity ? 999999 : bracket.max,
        imageQuality: calculatePercentiles(qualities),
        cleanliness: calculatePercentiles(cleanliness),
        light: calculatePercentiles(light),
        renovation: calculatePercentiles(renovation),
        sampleSize: listings.length,
        updatedAt: new Date()
      };

      // Upsert benchmark
      await benchmarksCollection.updateOne(
        { priceMin: bracket.min, priceMax: benchmark.priceMax },
        { $set: benchmark },
        { upsert: true }
      );

      results.push({
        priceRange: `$${bracket.min}-${bracket.max === Infinity ? '+' : bracket.max}`,
        sampleSize: listings.length
      });
    }

    return NextResponse.json({
      message: `Computed ${results.length} price benchmarks`,
      benchmarks: results
    });
  } catch (error) {
    console.error('Benchmark computation error:', error);
    return NextResponse.json({ error: 'Failed to compute benchmarks' }, { status: 500 });
  }
}

// GET current benchmarks
export async function GET() {
  try {
    const benchmarksCollection = await getPriceBenchmarksCollection();
    const benchmarks = await benchmarksCollection.find({}).sort({ priceMin: 1 }).toArray();

    return NextResponse.json({ benchmarks });
  } catch (error) {
    console.error('Get benchmarks error:', error);
    return NextResponse.json({ error: 'Failed to get benchmarks' }, { status: 500 });
  }
}
