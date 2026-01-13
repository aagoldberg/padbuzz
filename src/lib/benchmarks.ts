import { getPriceBenchmarksCollection } from './mongodb';
import { ComparativeStats, PriceBenchmark, StoredImageAnalysis } from '@/types/apartment';

// Get the benchmark for a given price (O(1) lookup from cached collection)
export async function getBenchmarkForPrice(price: number): Promise<PriceBenchmark | null> {
  const collection = await getPriceBenchmarksCollection();

  const benchmark = await collection.findOne({
    priceMin: { $lte: price },
    priceMax: { $gt: price }
  }) as PriceBenchmark | null;

  return benchmark;
}

// Calculate percentile rank given a value and percentile thresholds
function getPercentileRank(
  value: number,
  percentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
): number {
  if (value >= percentiles.p90) return 90 + Math.min(10, Math.round((value - percentiles.p90) * 5));
  if (value >= percentiles.p75) return 75 + Math.round((value - percentiles.p75) / (percentiles.p90 - percentiles.p75) * 15);
  if (value >= percentiles.p50) return 50 + Math.round((value - percentiles.p50) / (percentiles.p75 - percentiles.p50) * 25);
  if (value >= percentiles.p25) return 25 + Math.round((value - percentiles.p25) / (percentiles.p50 - percentiles.p25) * 25);
  if (value >= percentiles.p10) return 10 + Math.round((value - percentiles.p10) / (percentiles.p25 - percentiles.p10) * 15);
  return Math.max(1, Math.round(value / percentiles.p10 * 10));
}

// Get comparative stats for a listing (O(1) - just benchmark lookup + math)
export async function getComparativeStats(
  price: number,
  imageAnalysis: StoredImageAnalysis
): Promise<ComparativeStats | null> {
  const benchmark = await getBenchmarkForPrice(price);

  if (!benchmark || benchmark.sampleSize < 5) {
    return null; // Not enough data for meaningful comparison
  }

  const priceRange = benchmark.priceMax >= 999999
    ? `$${benchmark.priceMin.toLocaleString()}+`
    : `$${benchmark.priceMin.toLocaleString()}-$${benchmark.priceMax.toLocaleString()}`;

  return {
    imageQualityPercentile: getPercentileRank(imageAnalysis.overallQuality, benchmark.imageQuality),
    cleanerThan: getPercentileRank(imageAnalysis.cleanliness, benchmark.cleanliness),
    lighterThan: getPercentileRank(imageAnalysis.light, benchmark.light),
    moreModernThan: getPercentileRank(imageAnalysis.renovation, benchmark.renovation),
    priceRange,
    sampleSize: benchmark.sampleSize
  };
}

// Format comparative stat for display
export function formatComparison(percentile: number, metric: string): string {
  if (percentile >= 90) return `Top ${100 - percentile}% ${metric}`;
  return `${metric.charAt(0).toUpperCase() + metric.slice(1)} than ${percentile}% of listings`;
}
