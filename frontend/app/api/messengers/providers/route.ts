import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getAvailableProviders } from '@/lib/messengers';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const providers = getAvailableProviders();
  return NextResponse.json({ providers });
}
