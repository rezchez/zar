import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { mapCheckRecord } from '@/lib/check';
import { ensureChecksCollection } from '@/lib/check-collection';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function text(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function writerFor(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  if (!context) return null;
  try {
    return await getPocketBaseServiceClient();
  } catch {
    return context.pb;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه چک الزامی است.' }, { status: 400 });
  }

  try {
    const service = await getPocketBaseServiceClient().catch(() => null);
    if (service) await ensureChecksCollection(service);

    const record = await context.pb.collection('checks').getOne(id, {
      expand: 'bankAccount,customer',
    });

    return NextResponse.json({ check: mapCheckRecord(record) });
  } catch {
    return NextResponse.json({ message: 'اطلاعات چک پیدا نشد.' }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه چک الزامی است.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = text(body?.status, 20);

  if (status && !['issued', 'paid', 'cancelled', 'returned'].includes(status)) {
    return NextResponse.json({ message: 'وضعیت چک معتبر نیست.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureChecksCollection(writer);
    const existing = await writer.collection('checks').getOne(id);

    const updatePayload: Record<string, unknown> = {
      updatedBy: context.user.id,
    };

    if (status) updatePayload.status = status;
    if (body?.description !== undefined) updatePayload.description = text(body.description, 500);

    const updated = await writer.collection('checks').update(id, updatePayload);

    const maskedSayadId = `${existing.sayadId.slice(0, 4)}****${existing.sayadId.slice(12)}`;
    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_updated',
      request,
      details: `وضعیت چک ${maskedSayadId} به ${status || existing.status} تغییر کرد.`,
      entityType: 'check',
      entityId: id,
      entityLabel: `چک صیاد ${maskedSayadId}`,
      changes: updatePayload,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ check: mapCheckRecord(updated) });
  } catch (error) {
    console.error('check_update_failed', error);
    return NextResponse.json({ message: 'تغییر وضعیت چک انجام نشد.' }, { status: 400 });
  }
}
