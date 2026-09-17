import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  settlePacketAssay,
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

    const purity = Number(body.purity);
    if (!purity || purity <= 0 || purity > 1000) {
      return NextResponse.json(
        { message: 'عیار اعلامی آزمایشگاه باید عددی بین ۱ تا ۱۰۰۰ باشد.' },
        { status: 400 },
      );
    }

    const sample = await settlePacketAssay(
      context.pb,
      id,
      purity,
      context.user.id,
      request,
    );

    return NextResponse.json({ sample });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در ثبت عیار پاکت آزمایشگاه';
    return NextResponse.json({ message }, { status: 500 });
  }
}
