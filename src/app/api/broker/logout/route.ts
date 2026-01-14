import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/broker-db';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('broker_session')?.value;

  if (token) {
    await deleteSession(token);
  }

  const response = NextResponse.json({ message: 'Logged out' });

  response.cookies.set('broker_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
