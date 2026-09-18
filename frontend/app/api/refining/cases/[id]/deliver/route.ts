import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import {
  deliverGoldToRefiner,
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

    const item = await deliverGoldToRefiner(
      context.pb,
      id,
      {
        rawWeight: body.rawWeight,
        purity: body.purity,
        inventoryType: body.inventoryType,
        sourceInventoryId: body.sourceInventoryId,
        stampNumber: body.stampNumber,
        labName: body.labName,
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
    const message = err instanceof Error ? err.message : 'خطا در تحویل طلا به ریگیر';
    return NextResponse.json({ message }, { status: 500 });
  }
}
