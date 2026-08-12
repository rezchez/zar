import { NextResponse } from 'next/server';

import { PB_AUTH_COOKIE } from '@/lib/pocketbase';

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: PB_AUTH_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
