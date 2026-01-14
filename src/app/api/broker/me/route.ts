import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getBrokerStats, updateBroker } from '@/lib/broker-db';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const broker = await validateSession(token);

  if (!broker) {
    return NextResponse.json(
      { error: 'Session expired' },
      { status: 401 }
    );
  }

  // Get stats
  const stats = await getBrokerStats(broker._id!);

  return NextResponse.json({
    broker: {
      id: broker._id?.toString(),
      email: broker.email,
      firstName: broker.firstName,
      lastName: broker.lastName,
      phone: broker.phone,
      licenseNumber: broker.licenseNumber,
      licenseState: broker.licenseState,
      licenseVerified: broker.licenseVerified,
      brokerageName: broker.brokerageName,
      profileImage: broker.profileImage,
      bio: broker.bio,
      status: broker.status,
      createdAt: broker.createdAt,
    },
    stats,
  });
}

export async function PUT(request: NextRequest) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  const broker = await validateSession(token);

  if (!broker) {
    return NextResponse.json(
      { error: 'Session expired' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Only allow updating certain fields
    const allowedUpdates = ['firstName', 'lastName', 'phone', 'brokerageName', 'bio', 'emailNotifications'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedUpdates) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    await updateBroker(broker._id!, updates);

    return NextResponse.json({ message: 'Profile updated' });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
