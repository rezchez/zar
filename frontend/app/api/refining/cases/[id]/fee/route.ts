import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  recordCaseRefiningFee,
  deleteCaseRefiningFee,
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

    const rawFee = body.refiningFee ?? body.fee;
    if (rawFee === undefined || rawFee === null || rawFee === '') {
      return NextResponse.json({ message: 'مبلغ اجرت ری‌گیری باید بزرگتر از صفر باشد.' }, { status: 400 });
    }

    const cleanStr = typeof rawFee === 'string'
      ? rawFee.replace(/[,\s]/g, '').replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      : String(rawFee);

    const feeNumber = Math.round(Number(cleanStr));
    if (isNaN(feeNumber) || feeNumber <= 0) {
      return NextResponse.json({ message: 'مبلغ اجرت ری‌گیری باید بزرگتر از صفر باشد.' }, { status: 400 });
    }

    let writer = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      writer = await getPocketBaseServiceClient();
    } catch {
      writer = context.pb;
    }

    const refiningCase = await recordCaseRefiningFee(
      writer,
      id,
      feeNumber,
      context.user.id,
      request,
    );

    return NextResponse.json({ refiningCase });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const anyErr = err as any;
    const respData = anyErr?.response?.data || anyErr?.data;
    let detail = '';
    if (respData && typeof respData === 'object') {
      detail = Object.entries(respData)
        .map(([field, val]) => `${field}: ${(val as any)?.message || String(val)}`)
        .join(' | ');
    }
    const message = detail
      ? `خطا در ثبت اجرت: ${detail}`
      : (err instanceof Error ? err.message : 'خطا در ثبت اجرت ری‌گیری');
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    let writer = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      writer = await getPocketBaseServiceClient();
    } catch {
      writer = context.pb;
    }

    const refiningCase = await deleteCaseRefiningFee(
      writer,
      id,
      context.user.id,
      request,
    );
    return NextResponse.json({ refiningCase, message: 'اجرت ری‌گیری و اسناد حسابداری مرتبط با موفقیت حذف شدند.' });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در حذف اجرت ری‌گیری';
    return NextResponse.json({ message }, { status: 500 });
  }
}
