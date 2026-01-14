import { NextRequest, NextResponse } from 'next/server';
import { validateSession, createBrokerListing, getBrokerListings } from '@/lib/broker-db';
import { ListingForm, BrokerListing } from '@/types/broker';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const broker = await validateSession(token);
  if (!broker) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') as BrokerListing['status'] | null;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const listings = await getBrokerListings(broker._id!, {
    status: status || undefined,
    limit,
  });

  return NextResponse.json({
    listings: listings.map(l => ({
      ...l,
      _id: l._id?.toString(),
      brokerId: l.brokerId.toString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const broker = await validateSession(token);
  if (!broker) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  try {
    const body: ListingForm = await request.json();

    // Validation
    if (!body.street || !body.city || !body.zip) {
      return NextResponse.json(
        { error: 'Address required' },
        { status: 400 }
      );
    }

    if (!body.price || body.price <= 0) {
      return NextResponse.json(
        { error: 'Valid price required' },
        { status: 400 }
      );
    }

    if (body.beds === undefined || body.beds < 0) {
      return NextResponse.json(
        { error: 'Bedrooms required' },
        { status: 400 }
      );
    }

    // Create listing
    const listing = await createBrokerListing(broker._id!, {
      address: {
        street: body.street,
        unit: body.unit,
        city: body.city,
        state: body.state || 'NY',
        zip: body.zip,
        neighborhood: body.neighborhood,
        borough: body.borough,
      },
      price: body.price,
      beds: body.beds,
      baths: body.baths || 1,
      sqft: body.sqft,
      description: body.description,
      availableDate: body.availableDate ? new Date(body.availableDate) : undefined,
      leaseTermMonths: body.leaseTermMonths,
      noFee: body.noFee || false,
      furnished: body.furnished || false,
      petPolicy: body.petPolicy || 'no_pets',
      images: [], // Will be added via photo upload
      virtualTourUrl: body.virtualTourUrl,
      unitAmenities: body.unitAmenities || [],
      buildingAmenities: body.buildingAmenities || [],
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      status: 'draft',
    });

    return NextResponse.json({
      message: 'Listing created',
      listing: {
        ...listing,
        _id: listing._id?.toString(),
        brokerId: listing.brokerId.toString(),
      },
    });
  } catch (error) {
    console.error('Create listing error:', error);
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    );
  }
}
