import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import {
  canTransitionChequeStatus,
  mapCheckRecord,
  type CheckStatus,
} from '@/lib/check';
import { ensureChecksCollection } from '@/lib/check-collection';
import { formatJalaliDate, jalaliDateToIso } from '@/lib/jalali';
import { mapBankAccount } from '@/lib/bank';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import {
  postPayableChequeClear,
  postPayableChequeReturn,
  postReceivableChequeCollection,
} from '@/lib/accounting-posting-engine';

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
  const targetStatus = text(body?.status, 20) as CheckStatus;

  const validStatuses: CheckStatus[] = [
    'draft',
    'issued',
    'delivered',
    'pending',
    'due',
    'cleared',
    'returned',
    'cancelled',
    'paid',
  ];

  if (targetStatus && !validStatuses.includes(targetStatus)) {
    return NextResponse.json({ message: 'وضعیت چک نامعتبر است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureChecksCollection(writer);
    const existing = await writer.collection('checks').getOne(id, {
      expand: 'bankAccount,customer',
    });

    const currentStatus = (existing.status as CheckStatus) || 'issued';

    // State Transition Rule Validation
    if (targetStatus && targetStatus !== currentStatus) {
      const transitionCheck = canTransitionChequeStatus(currentStatus, targetStatus);
      if (!transitionCheck.allowed) {
        return NextResponse.json(
          { message: transitionCheck.reason || 'گذار وضعیت چک مجاز نیست.' },
          { status: 400 },
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      updatedBy: context.user.id,
    };

    if (body?.description !== undefined) {
      updatePayload.description = text(body.description, 500);
    }

    // Resolve Bank Account & Customer for accounting postings
    const rawBankAccount = existing.expand?.bankAccount || (await writer.collection('bank_accounts').getOne(existing.bankAccount).catch(() => null));
    const bankAccount = rawBankAccount ? mapBankAccount(rawBankAccount as Record<string, unknown>) : null;
    const customer = existing.expand?.customer || (await writer.collection('customers').getOne(existing.customer).catch(() => null));
    const customerName = String(customer?.name || 'طرف‌حساب');

    // Handle Transition to CLEARED / PAID
    if (targetStatus === 'cleared' || targetStatus === 'paid') {
      if (currentStatus === 'cleared' || currentStatus === 'paid') {
        return NextResponse.json({ message: 'این چک قبلاً وصول شده است و نمی‌تواند دوباره وصول شود.' }, { status: 400 });
      }

      if (!bankAccount) {
        return NextResponse.json({ message: 'حساب بانکی مرتبط با چک یافت نشد.' }, { status: 400 });
      }

      const clearedDateJalali = text(body?.clearedDateJalali, 20) || formatJalaliDate();
      const clearedDateIso = jalaliDateToIso(clearedDateJalali) || new Date().toISOString().slice(0, 10);

      // Post Clearing Accounting Entry & Deduct/Credit Bank Balance
      if (existing.chequeType === 'receivable') {
        await postReceivableChequeCollection(
          {
            id: existing.id,
            amount: Number(existing.amount),
            sayadId: existing.sayadId,
            receivableAccountId: existing.receivableAccountId,
          },
          bankAccount,
          customerName,
          context.user.id,
          writer,
          clearedDateJalali,
        );
      } else {
        await postPayableChequeClear(
          {
            id: existing.id,
            amount: Number(existing.amount),
            sayadId: existing.sayadId,
            description: existing.description,
            bankAccount: bankAccount.id,
            customer: existing.customer,
            payableAccountId: existing.payableAccountId,
          },
          bankAccount,
          customerName,
          context.user.id,
          writer,
          clearedDateJalali,
        );
      }

      updatePayload.status = 'cleared';
      updatePayload.clearedDate = clearedDateIso;
      updatePayload.clearedDateJalali = clearedDateJalali;
    }

    // Handle Transition to RETURNED
    if (targetStatus === 'returned') {
      const wasCleared = currentStatus === 'cleared' || currentStatus === 'paid';
      const returnedDateJalali = text(body?.returnedDateJalali, 20) || formatJalaliDate();
      const returnedDateIso = jalaliDateToIso(returnedDateJalali) || new Date().toISOString().slice(0, 10);

      if (bankAccount && customer) {
        if (existing.chequeType !== 'receivable') {
          await postPayableChequeReturn(
            {
              id: existing.id,
              amount: Number(existing.amount),
              sayadId: existing.sayadId,
              description: existing.description,
              bankAccount: bankAccount.id,
              customer: existing.customer,
              payableAccountId: existing.payableAccountId,
            },
            bankAccount,
            { id: customer.id, name: customer.name },
            wasCleared,
            context.user.id,
            writer,
            returnedDateJalali,
          );
        }
      }

      updatePayload.status = 'returned';
      updatePayload.returnedDate = returnedDateIso;
      updatePayload.returnedDateJalali = returnedDateJalali;
    }

    // Other standard status changes (e.g. delivered, pending, due, cancelled)
    if (targetStatus && targetStatus !== 'cleared' && targetStatus !== 'paid' && targetStatus !== 'returned') {
      updatePayload.status = targetStatus;
    }

    const updated = await writer.collection('checks').update(id, updatePayload);

    const fullRecord = await writer.collection('checks').getOne(id, {
      expand: 'bankAccount,customer',
    }).catch(() => updated);

    const maskedSayadId = `${existing.sayadId.slice(0, 4)}****${existing.sayadId.slice(12)}`;
    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_updated',
      request,
      details: `وضعیت چک ${maskedSayadId} به ${targetStatus || existing.status} تغییر کرد.`,
      entityType: 'check',
      entityId: id,
      entityLabel: `چک صیاد ${maskedSayadId}`,
      changes: updatePayload,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ check: mapCheckRecord(fullRecord) });
  } catch (error: any) {
    console.error('check_update_failed', error);
    return NextResponse.json({ message: error?.message || 'تغییر وضعیت چک انجام نشد.' }, { status: 400 });
  }
}
