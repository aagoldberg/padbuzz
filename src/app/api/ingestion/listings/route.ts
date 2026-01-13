import { NextRequest, NextResponse } from 'next/server';
import { getIngestedListingsCollection } from '@/ingestion/db';
import { ListingsQuery } from '@/ingestion/types';

/**
 * GET /api/ingestion/listings
 * Query ingested listings with filters
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Parse query parameters
  const query: ListingsQuery = {
    sourceId: searchParams.get('sourceId') || undefined,
    borough: searchParams.get('borough') || undefined,
    neighborhood: searchParams.get('neighborhood') || undefined,
    minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!, 10) : undefined,
    maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!, 10) : undefined,
    beds: searchParams.get('beds') ? parseInt(searchParams.get('beds')!, 10) : undefined,
    baths: searchParams.get('baths') ? parseFloat(searchParams.get('baths')!) : undefined,
    noFeeOnly: searchParams.get('noFeeOnly') === 'true',
    status: (searchParams.get('status') as ListingsQuery['status']) || 'active',
    since: searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined,
    limit: Math.min(parseInt(searchParams.get('limit') || '50', 10), 200),
    offset: parseInt(searchParams.get('offset') || '0', 10),
    sort: (searchParams.get('sort') as ListingsQuery['sort']) || 'date',
    sortOrder: (searchParams.get('sortOrder') as ListingsQuery['sortOrder']) || 'desc',
  };

  try {
    const collection = await getIngestedListingsCollection();

    // Build MongoDB filter
    const filter: Record<string, unknown> = {
      isDuplicate: false, // Only show canonical listings
    };

    if (query.sourceId) filter.sourceId = query.sourceId;
    if (query.borough) filter.borough = query.borough;
    if (query.neighborhood) {
      filter.neighborhood = { $regex: query.neighborhood, $options: 'i' };
    }
    if (query.status) filter.status = query.status;
    if (query.noFeeOnly) filter.noFee = true;
    if (query.beds !== undefined) filter.beds = { $gte: query.beds };
    if (query.baths !== undefined) filter.baths = { $gte: query.baths };

    // Price range
    if (query.minPrice || query.maxPrice) {
      filter.price = {};
      if (query.minPrice) (filter.price as Record<string, number>).$gte = query.minPrice;
      if (query.maxPrice) (filter.price as Record<string, number>).$lte = query.maxPrice;
    }

    // Date filter
    if (query.since) {
      filter.lastSeenAt = { $gte: query.since };
    }

    // Sort
    const sortField = query.sort === 'price' ? 'price' :
                      query.sort === 'quality' ? 'storedImageAnalysis.overallQuality' :
                      'lastSeenAt';
    const sortDir = query.sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [listings, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ [sortField]: sortDir })
        .skip(query.offset || 0)
        .limit(query.limit || 50)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return NextResponse.json({
      listings,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: (query.offset || 0) + listings.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}
