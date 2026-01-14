import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getIngestedListingsCollection } from '@/ingestion/db';

/**
 * GET /api/listings/[id]
 * Get a single listing by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collection = await getIngestedListingsCollection();

    let listing;

    // Try to find by MongoDB ObjectId first
    if (ObjectId.isValid(id)) {
      listing = await collection.findOne({ _id: new ObjectId(id) });
    }

    // If not found, try by listingId
    if (!listing) {
      listing = await collection.findOne({ listingId: id });
    }

    // If still not found, try by sourceListingId
    if (!listing) {
      listing = await collection.findOne({ sourceListingId: id });
    }

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    return NextResponse.json({ listing });
  } catch (error) {
    console.error('Error fetching listing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listing' },
      { status: 500 }
    );
  }
}
