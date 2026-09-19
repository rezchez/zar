import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  updateRefiningItem,
  deleteRefiningItem,
  RefiningError,
} from '@/features/refining/services/refining-service';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { id, itemId } = await params;
    const body = await request.json();

    const item = await updateRefiningItem(
      context.pb,
      id,
      itemId,
      {
        rawWeight: body.rawWeight !== undefined ? Number(body.rawWeight) : undefined,
        purity: body.purity !== undefined ? Number(body.purity) : undefined,
        stampNumber: body.stampNumber,
        labName: body.labName,
        description: body.description,
        receiptDate: body.receiptDate,
      },
      context.user.id,
      request,
    );

    return NextResponse.json({ item, message: 'ردیف با موفقیت بروزرسانی شد.' });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در ویرایش ردیف طلا';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { id, itemId } = await params;
    await deleteRefiningItem(context.pb, id, itemId, context.user.id, request);
    return NextResponse.json({ message: 'ردیف طلا با موفقیت حذف و انبار بروزرسانی شد.' });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در حذف ردیف طلا';
    return NextResponse.json({ message }, { status: 500 });
  }
}
