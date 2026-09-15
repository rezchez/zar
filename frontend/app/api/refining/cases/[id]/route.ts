import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  getRefiningCaseDetails,
  RefiningError,
} from '@/features/refining/services/refining-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const details = await getRefiningCaseDetails(context.pb, id);
    return NextResponse.json(details);
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در دریافت مشخصات پرونده ری‌گیری';
    return NextResponse.json({ message }, { status: 500 });
  }
}
