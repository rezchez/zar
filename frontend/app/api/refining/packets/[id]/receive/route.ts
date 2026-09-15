import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  receiveSamplePacket,
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

    const sample = await receiveSamplePacket(
      context.pb,
      id,
      {
        receivedWeight: body.receivedWeight,
        receivedDate: body.receivedDate,
        purity: body.purity,
      },
      context.user.id,
      request,
    );

    return NextResponse.json({ sample });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در دریافت پاکت نمونه';
    return NextResponse.json({ message }, { status: 500 });
  }
}
