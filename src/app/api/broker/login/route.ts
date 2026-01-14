import { NextRequest, NextResponse } from 'next/server';
import { authenticateBroker, createSession } from '@/lib/broker-db';
import { BrokerLoginForm } from '@/types/broker';

export async function POST(request: NextRequest) {
  try {
    const body: BrokerLoginForm = await request.json();

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    const broker = await authenticateBroker(body.email, body.password);

    if (!broker) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (broker.status === 'suspended') {
      return NextResponse.json(
        { error: 'Account suspended. Please contact support.' },
        { status: 403 }
      );
    }

    // Create session
    const token = await createSession(
      broker._id!,
      request.headers.get('user-agent') || undefined
    );

    const response = NextResponse.json({
      message: 'Login successful',
      broker: {
        id: broker._id?.toString(),
        email: broker.email,
        firstName: broker.firstName,
        lastName: broker.lastName,
        status: broker.status,
        licenseVerified: broker.licenseVerified,
      },
    });

    response.cookies.set('broker_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
