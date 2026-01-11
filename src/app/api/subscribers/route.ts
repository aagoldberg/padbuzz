import { NextRequest, NextResponse } from 'next/server';
import { getSubscribersCollection } from '@/lib/mongodb';
import { Subscriber } from '@/types/apartment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, phone, preferences, subscriptionTier = 'free' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const collection = await getSubscribersCollection();

    const existing = await collection.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Email already subscribed' }, { status: 409 });
    }

    const subscriber: Omit<Subscriber, '_id'> = {
      email,
      phone,
      preferences: preferences || {
        maxPrice: 5000,
        minBedrooms: 1,
        minBathrooms: 1,
        preferredNeighborhoods: [],
        mustHaveAmenities: [],
        niceToHaveAmenities: [],
        priorities: [],
        dealBreakers: [],
      },
      isPaid: subscriptionTier !== 'free',
      subscriptionTier,
      createdAt: new Date(),
      notificationSettings: {
        email: true,
        sms: !!phone,
        instantAlerts: subscriptionTier !== 'free',
      },
    };

    const result = await collection.insertOne(subscriber);

    return NextResponse.json({
      success: true,
      subscriberId: result.insertedId,
    });
  } catch (error) {
    console.error('Error creating subscriber:', error);
    return NextResponse.json({ error: 'Failed to create subscriber' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const collection = await getSubscribersCollection();
    const subscriber = await collection.findOne({ email });

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    return NextResponse.json({ subscriber });
  } catch (error) {
    console.error('Error fetching subscriber:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriber' }, { status: 500 });
  }
}
