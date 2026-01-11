import { NextRequest, NextResponse } from 'next/server';
import { getApartmentsCollection } from '@/lib/mongodb';
import { mockApartments } from '@/lib/mock-data';
import { SearchFilters, Apartment } from '@/types/apartment';

const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || !process.env.MONGODB_URI;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const filters: SearchFilters = {
      minPrice: searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!, 10) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseInt(searchParams.get('maxPrice')!, 10) : undefined,
      bedrooms: searchParams.get('bedrooms') ? parseInt(searchParams.get('bedrooms')!, 10) : undefined,
      bathrooms: searchParams.get('bathrooms') ? parseInt(searchParams.get('bathrooms')!, 10) : undefined,
      neighborhoods: searchParams.get('neighborhoods')?.split(',').filter(Boolean),
      noFeeOnly: searchParams.get('noFeeOnly') === 'true',
      rentStabilizedOnly: searchParams.get('rentStabilizedOnly') === 'true',
    };

    if (USE_MOCK_DATA) {
      const filtered = filterMockApartments(mockApartments, filters);
      const paginated = filtered.slice(skip, skip + limit);

      return NextResponse.json({
        apartments: paginated,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      });
    }

    const query = buildQuery(filters);
    const collection = await getApartmentsCollection();

    const [apartments, total] = await Promise.all([
      collection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      collection.countDocuments(query),
    ]);

    return NextResponse.json({
      apartments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching apartments:', error);

    // Fallback to mock data on error
    const filtered = filterMockApartments(mockApartments, {});
    return NextResponse.json({
      apartments: filtered.slice(0, 12),
      pagination: {
        page: 1,
        limit: 12,
        total: filtered.length,
        totalPages: 1,
      },
    });
  }
}

function filterMockApartments(apartments: Apartment[], filters: SearchFilters): Apartment[] {
  return apartments.filter(apt => {
    if (filters.minPrice && apt.price < filters.minPrice) return false;
    if (filters.maxPrice && apt.price > filters.maxPrice) return false;
    if (filters.bedrooms !== undefined && apt.bedrooms < filters.bedrooms) return false;
    if (filters.bathrooms !== undefined && apt.bathrooms < filters.bathrooms) return false;
    if (filters.neighborhoods?.length && !filters.neighborhoods.includes(apt.neighborhood)) return false;
    if (filters.noFeeOnly && !apt.noFee) return false;
    if (filters.rentStabilizedOnly && !apt.rentStabilized) return false;
    return true;
  });
}

function buildQuery(filters: SearchFilters) {
  const query: Record<string, unknown> = {};

  if (filters.minPrice || filters.maxPrice) {
    query.price = {};
    if (filters.minPrice) (query.price as Record<string, number>).$gte = filters.minPrice;
    if (filters.maxPrice) (query.price as Record<string, number>).$lte = filters.maxPrice;
  }

  if (filters.bedrooms !== undefined) {
    query.bedrooms = { $gte: filters.bedrooms };
  }

  if (filters.bathrooms !== undefined) {
    query.bathrooms = { $gte: filters.bathrooms };
  }

  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    query.neighborhood = { $in: filters.neighborhoods };
  }

  if (filters.noFeeOnly) {
    query.noFee = true;
  }

  if (filters.rentStabilizedOnly) {
    query.rentStabilized = true;
  }

  return query;
}
