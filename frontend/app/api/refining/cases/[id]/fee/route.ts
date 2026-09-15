import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  recordCaseRefiningFee,
  RefiningError,
} from '@/features/refining/services/refining-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const refiningCase = await recordCaseRefiningFee(
      context.pb,
      id,
      body.refiningFee,
      context.user.id,
      request,
    );

    return NextResponse.json({ refiningCase });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در ثبت اجرت ری‌گیری';
    return NextResponse.json({ message }, { status: 500 });
  }
}
