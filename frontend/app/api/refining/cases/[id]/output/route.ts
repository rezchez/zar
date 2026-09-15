import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  receiveOutputGold,
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

    const item = await receiveOutputGold(
      context.pb,
      id,
      {
        rawWeight: body.rawWeight,
        purity: body.purity,
        stampNumber: body.stampNumber,
        labName: body.labName,
        receiptDate: body.receiptDate,
        description: body.description,
      },
      context.user.id,
      request,
    );

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در دریافت طلای خروجی';
    return NextResponse.json({ message }, { status: 500 });
  }
}
