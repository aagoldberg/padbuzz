import { NextRequest, NextResponse } from 'next/server';
import { createBroker, createSession } from '@/lib/broker-db';
import { BrokerRegisterForm } from '@/types/broker';

export async function POST(request: NextRequest) {
  try {
    const body: BrokerRegisterForm = await request.json();

    // Validation
    if (!body.email || !body.password || !body.firstName || !body.lastName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (body.password !== body.confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    if (body.password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (!body.licenseNumber || !body.licenseState) {
      return NextResponse.json(
        { error: 'License information required' },
        { status: 400 }
      );
    }

    // Create broker
    const broker = await createBroker({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      licenseNumber: body.licenseNumber,
      licenseState: body.licenseState,
      brokerageName: body.brokerageName,
    });

    // Create session
    const token = await createSession(
      broker._id!,
      request.headers.get('user-agent') || undefined
    );

    // Set cookie
    const response = NextResponse.json({
      message: 'Account created successfully',
      broker: {
        id: broker._id?.toString(),
        email: broker.email,
        firstName: broker.firstName,
        lastName: broker.lastName,
        status: broker.status,
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
    console.error('Registration error:', error);

    if (error instanceof Error && error.message === 'Email already registered') {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
