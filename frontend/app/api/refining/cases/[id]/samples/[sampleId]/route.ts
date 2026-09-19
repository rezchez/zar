import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  updateSamplePacket,
  deleteSamplePacket,
  RefiningError,
} from '@/features/refining/services/refining-service';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; sampleId: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { id, sampleId } = await params;
    const body = await request.json();

    const sample = await updateSamplePacket(
      context.pb,
      id,
      sampleId,
      {
        declaredWeight: body.declaredWeight !== undefined ? Number(body.declaredWeight) : undefined,
        receivedWeight: body.receivedWeight !== undefined ? Number(body.receivedWeight) : undefined,
        purity: body.purity !== undefined ? Number(body.purity) : undefined,
        description: body.description,
      },
      context.user.id,
      request,
    );

    return NextResponse.json({ sample, message: 'پاکت نمونه با موفقیت بروزرسانی شد.' });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در ویرایش پاکت نمونه';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; sampleId: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const { id, sampleId } = await params;
    await deleteSamplePacket(context.pb, id, sampleId, context.user.id, request);
    return NextResponse.json({ message: 'پاکت نمونه با موفقیت حذف گردید.' });
  } catch (err: unknown) {
    if (err instanceof RefiningError) {
      return NextResponse.json({ message: err.message }, { status: err.statusCode });
    }
    const message = err instanceof Error ? err.message : 'خطا در حذف پاکت نمونه';
    return NextResponse.json({ message }, { status: 500 });
  }
}
