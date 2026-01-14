import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getBrokerListingById, updateBrokerListing, deleteBrokerListing } from '@/lib/broker-db';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const broker = await validateSession(token);
  if (!broker) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  const listing = await getBrokerListingById(id);

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  // Check ownership
  if (listing.brokerId.toString() !== broker._id?.toString()) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  return NextResponse.json({
    listing: {
      ...listing,
      _id: listing._id?.toString(),
      brokerId: listing.brokerId.toString(),
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const broker = await validateSession(token);
  if (!broker) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  try {
    const body = await request.json();

    // Build updates object
    const updates: Record<string, unknown> = {};

    // Address updates
    if (body.street || body.unit || body.city || body.zip || body.neighborhood || body.borough) {
      updates.address = {
        street: body.street,
        unit: body.unit,
        city: body.city,
        state: body.state || 'NY',
        zip: body.zip,
        neighborhood: body.neighborhood,
        borough: body.borough,
      };
    }

    // Simple fields
    const simpleFields = [
      'price', 'beds', 'baths', 'sqft', 'description', 'leaseTermMonths',
      'noFee', 'furnished', 'petPolicy', 'virtualTourUrl',
      'unitAmenities', 'buildingAmenities',
      'contactName', 'contactEmail', 'contactPhone', 'status'
    ];

    for (const field of simpleFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Date field
    if (body.availableDate) {
      updates.availableDate = new Date(body.availableDate);
    }

    // If publishing, set publishedAt
    if (body.status === 'active') {
      updates.publishedAt = new Date();
    }

    const success = await updateBrokerListing(id, broker._id!, updates);

    if (!success) {
      return NextResponse.json(
        { error: 'Listing not found or not authorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Listing updated' });
  } catch (error) {
    console.error('Update listing error:', error);
    return NextResponse.json(
      { error: 'Failed to update listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const broker = await validateSession(token);
  if (!broker) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  const success = await deleteBrokerListing(id, broker._id!);

  if (!success) {
    return NextResponse.json(
      { error: 'Listing not found or not authorized' },
      { status: 404 }
    );
  }

  return NextResponse.json({ message: 'Listing deleted' });
}
