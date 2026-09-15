import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  createRefiningCase,
  getRefiningCasesByRefiner,
  mapRefiningCase,
  RefiningError,
} from '@/features/refining/services/refining-service';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const refinerId = searchParams.get('refinerId');

    if (refinerId) {
      const cases = await getRefiningCasesByRefiner(context.pb, refinerId);
      return NextResponse.json({ cases });
    }

    const records = await context.pb.collection('refining_cases').getFullList({
      sort: '-created',
      expand: 'refiner',
    }).catch(() => []);

    const cases = records.map((r) => mapRefiningCase(r));
    return NextResponse.json({ cases });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطا در دریافت پرونده‌های ری‌گیری';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const refiningCase = await createRefiningCase(
      context.pb,
      {
        refinerId: body.refinerId,
        date: body.date,
        description: body.description,
      },
      context.user.id,
      request,
    );

    return NextResponse.json({ refiningCase }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در ایجاد پرونده ری‌گیری';
    return NextResponse.json({ message }, { status: 500 });
  }
}
