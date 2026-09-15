import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getUnreceivedPackets } from '@/features/refining/services/refining-service';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const packets = await getUnreceivedPackets(context.pb);
    return NextResponse.json({ packets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در دریافت لیست پاکت‌های نمونه';
    return NextResponse.json({ message }, { status: 500 });
  }
}
