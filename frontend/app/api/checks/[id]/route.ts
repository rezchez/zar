import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  canTransitionChequeStatus,
  mapCheckRecord,
  type CheckStatus,
} from '@/lib/check';
import { ensureChecksCollection } from '@/lib/check-collection';
import { formatJalaliDate, jalaliDateToIso, normalizeDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';
import { mapBankAccount } from '@/lib/bank';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import {
  postPayableChequeClear,
  postPayableChequeReturn,
  postPayableChequeUnclear,
  postReceivableChequeCollection,
  postReceivableChequeUncollect,
  postReceivableChequeReturnToDrawer,
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

    const client = service || context.pb;
    const record = await client.collection('checks').getOne(id, {
      expand: 'bankAccount,customer,created_by',
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
    'clearing',
    'returned_to_drawer',
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
    const chequeType = existing.chequeType === 'receivable' ? 'receivable' : 'payable';

    // State Transition Rule Validation with allowReversal flag
    if (targetStatus && targetStatus !== currentStatus) {
      const transitionCheck = canTransitionChequeStatus(currentStatus, targetStatus, chequeType, {
        allowReversal: true,
      });
      if (!transitionCheck.allowed) {
        return NextResponse.json(
          { message: transitionCheck.reason || 'گذار وضعیت چک مجاز نیست.' },
          { status: 400 },
        );
      }
    }

    const updatePayload: Record<string, unknown> = {
      updatedBy: context.user.id,
      updated_by: context.user.id,
    };

    // Editable general fields
    if (body?.description !== undefined) {
      updatePayload.description = text(body.description, 500);
    }

    if (body?.amount !== undefined) {
      const rawAmount = String(body.amount);
      const parsedAmount = parseLocalizedAmount(rawAmount);
      if (parsedAmount > 0) {
        updatePayload.amount = parsedAmount;
      }
    }

    const rawCheckNo = text(body?.checkNumber || body?.check_number, 80);
    if (rawCheckNo) {
      const normalizedCheckNo = normalizeDigits(rawCheckNo).trim();
      if (normalizedCheckNo) {
        updatePayload.checkNumber = normalizedCheckNo;
        updatePayload.check_number = normalizedCheckNo;
      }
    }

    if (body?.sayadId !== undefined) {
      const normalizedSayad = normalizeDigits(text(body.sayadId, 80)).replace(/\D/g, '').trim();
      updatePayload.sayadId = normalizedSayad;
    }

    const dueDateJalali = text(body?.dueDateJalali || body?.dueDate, 20);
    if (dueDateJalali) {
      const dueDateIso = jalaliDateToIso(dueDateJalali);
      if (dueDateIso) {
        updatePayload.dueDateJalali = dueDateJalali;
        updatePayload.dueDate = dueDateIso;
        updatePayload.due_date = dueDateIso;
      }
    }

    const issueDateJalali = text(body?.issueDateJalali || body?.openingBalanceDateJalali || body?.issueDate, 20);
    if (issueDateJalali) {
      const issueDateIso = jalaliDateToIso(issueDateJalali);
      if (issueDateIso) {
        updatePayload.issueDateJalali = issueDateJalali;
        updatePayload.issueDate = issueDateIso;
        if (existing.is_opening_balance === true || existing.isOpeningBalance === true) {
          updatePayload.openingBalanceDateJalali = issueDateJalali;
          updatePayload.opening_balance_date = issueDateIso;
        }
      }
    }

    if (body?.bankName !== undefined) {
      const bankName = text(body.bankName, 120);
      updatePayload.bankName = bankName;
      updatePayload.bank_name = bankName;
    }

    if (body?.branchName !== undefined) {
      const branchName = text(body.branchName, 120);
      updatePayload.branchName = branchName;
      updatePayload.branch_name = branchName;
    }

    const customerId = text(body?.customer || body?.customerId, 40);
    if (customerId) {
      updatePayload.customer = customerId;
    }

    const targetBankAccountId = typeof body?.bankAccount === 'string' && body.bankAccount.trim()
      ? body.bankAccount.trim()
      : undefined;

    if (targetBankAccountId) {
      updatePayload.bankAccount = targetBankAccountId;
      updatePayload.bank_account = targetBankAccountId;
    }

    // Resolve Bank Account & Customer for accounting postings
    const effectiveBankAccountId = targetBankAccountId || existing.bankAccount;
    const rawBankAccount = effectiveBankAccountId
      ? (targetBankAccountId && targetBankAccountId !== existing.bankAccount
          ? await writer.collection('bank_accounts').getOne(targetBankAccountId).catch(() => null)
          : existing.expand?.bankAccount || (await writer.collection('bank_accounts').getOne(effectiveBankAccountId).catch(() => null)))
      : null;
    const bankAccount = rawBankAccount ? mapBankAccount(rawBankAccount as Record<string, unknown>) : null;
    const customer = existing.expand?.customer || (await writer.collection('customers').getOne(existing.customer).catch(() => null));
    const customerName = String(customer?.name || 'طرف‌حساب');

    const wasCleared = currentStatus === 'cleared' || currentStatus === 'paid';
    const isReversingFromCleared = wasCleared && targetStatus && targetStatus !== 'cleared' && targetStatus !== 'paid';

    if (isReversingFromCleared) {
      // Clear cleared dates upon reversal
      updatePayload.clearedDate = null;
      updatePayload.clearedDateJalali = null;
    }

    // 1. Handle Transition to CLEARED / PAID
    if (targetStatus === 'cleared' || targetStatus === 'paid') {
      if (wasCleared) {
        return NextResponse.json({ message: 'این چک قبلاً وصول شده است و نمی‌تواند دوباره وصول شود.' }, { status: 400 });
      }

      if (!bankAccount) {
        return NextResponse.json({ message: 'حساب بانکی مرتبط با چک یافت نشد.' }, { status: 400 });
      }

      if (bankAccount.isBlocked === true) {
        return NextResponse.json(
          {
            success: false,
            code: 'BANK_ACCOUNT_BLOCKED',
            message: 'این حساب بانکی مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.',
          },
          { status: 409 },
        );
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

    // 2. Handle Reversal from Cleared (ابطال وصول چک)
    if (isReversingFromCleared && targetStatus !== 'returned_to_drawer') {
      if (existing.chequeType === 'receivable') {
        // Receivable cheque reversal: deduct collected amount from bank balance & restore notes receivable (1120)
        if (bankAccount) {
          await postReceivableChequeUncollect(
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
            text(body?.uncollectDateJalali, 20) || formatJalaliDate(),
          );
        }
      } else {
        // Payable cheque reversal: restore paid amount back to bank balance & restore notes payable (2110)
        if (bankAccount && (targetStatus === 'pending' || targetStatus === 'issued' || targetStatus === 'cancelled')) {
          await postPayableChequeUnclear(
            {
              id: existing.id,
              amount: Number(existing.amount),
              sayadId: existing.sayadId,
              payableAccountId: existing.payableAccountId,
            },
            bankAccount,
            customerName,
            context.user.id,
            writer,
            text(body?.unclearDateJalali, 20) || formatJalaliDate(),
          );
        }
      }
    }

    // 3. Handle Transition to RETURNED_TO_DRAWER (عودت چک به صادرکننده)
    // "عودت چک یعنی برگشت دادن چک بدون وصول اون به طرف حساب و باقی ماندن طلب ما از مشتری چرا که اسناد دریافتنی تبدیل به حساب دریافتنی شده"
    if (targetStatus === 'returned_to_drawer') {
      const returnedToDrawerDateJalali = text(body?.returnedToDrawerDateJalali, 20) || formatJalaliDate();
      const returnedToDrawerDateIso = jalaliDateToIso(returnedToDrawerDateJalali) || new Date().toISOString().slice(0, 10);

      if (existing.chequeType === 'receivable') {
        const customerRecord = customer
          ? { id: customer.id, name: customer.name || 'طرف‌حساب', accountId: customer.accountId || null }
          : { id: existing.customer || 'unknown', name: customerName, accountId: null };

        await postReceivableChequeReturnToDrawer(
          {
            id: existing.id,
            amount: Number(existing.amount),
            sayadId: existing.sayadId,
            description: existing.description,
            receivableAccountId: existing.receivableAccountId,
          },
          customerRecord,
          bankAccount,
          wasCleared,
          context.user.id,
          writer,
          returnedToDrawerDateJalali,
        );
      }

      updatePayload.status = 'returned_to_drawer';
      updatePayload.returnedToDrawerDate = returnedToDrawerDateIso;
      updatePayload.returnedToDrawerDateJalali = returnedToDrawerDateJalali;
    }

    // 4. Handle Transition to RETURNED
    if (targetStatus === 'returned') {
      const returnedDateJalali = text(body?.returnedDateJalali, 20) || formatJalaliDate();
      const returnedDateIso = jalaliDateToIso(returnedDateJalali) || new Date().toISOString().slice(0, 10);

      if (bankAccount && customer && existing.chequeType !== 'receivable') {
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

      updatePayload.status = 'returned';
      updatePayload.returnedDate = returnedDateIso;
      updatePayload.returnedDateJalali = returnedDateJalali;
    }

    // 5. Handle Transition to CLEARING
    if (targetStatus === 'clearing') {
      const clearingDateJalali = text(body?.clearingDateJalali, 20) || formatJalaliDate();
      const clearingDateIso = jalaliDateToIso(clearingDateJalali) || new Date().toISOString().slice(0, 10);
      updatePayload.status = 'clearing';
      updatePayload.clearingDate = clearingDateIso;
      updatePayload.clearingDateJalali = clearingDateJalali;
    }

    // 6. Other standard status changes (e.g. delivered, pending, due, cancelled)
    if (
      targetStatus &&
      targetStatus !== 'cleared' &&
      targetStatus !== 'paid' &&
      targetStatus !== 'returned' &&
      targetStatus !== 'clearing' &&
      targetStatus !== 'returned_to_drawer'
    ) {
      updatePayload.status = targetStatus;
    }

    const updated = await writer.collection('checks').update(id, updatePayload);

    const fullRecord = await writer.collection('checks').getOne(id, {
      expand: 'bankAccount,customer',
    }).catch(() => updated);

    const maskedSayadId = `${existing.sayadId.slice(0, 4)}****${existing.sayadId.slice(12)}`;
    const auditDetails = targetStatus === 'clearing' && bankAccount
      ? `چک صیاد ${maskedSayadId} به وضعیت کلر تغییر یافت (خوابانده‌شده به حساب بانکی ${bankAccount.bankName} - ${bankAccount.accountNumber}).`
      : `وضعیت چک ${maskedSayadId} به ${targetStatus || existing.status} تغییر کرد.`;
    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_updated',
      request,
      details: auditDetails,
      entityType: 'check',
      entityId: id,
      entityLabel: `چک صیاد ${maskedSayadId}`,
      changes: updatePayload,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ check: mapCheckRecord(fullRecord) });
  } catch (error: any) {
    console.error('check_update_failed', error);
    return NextResponse.json({ message: error?.message || 'تغییر وضعیت یا مشخصات چک انجام نشد.' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'bank.delete') &&
    !hasPermission(context.user, 'bank.manage') &&
    !hasPermission(context.user, 'bank.edit')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حذف چک.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه چک الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureChecksCollection(writer);
    const existing = await writer.collection('checks').getOne(id).catch(() => null);
    if (!existing) {
      return NextResponse.json({ message: 'چک یافت نشد.' }, { status: 404 });
    }

    if (existing.status === 'cleared' || existing.status === 'paid') {
      return NextResponse.json({
        message: 'امکان حذف چک وصول‌شده وجود ندارد. ابتدا وضعیت چک را بازگردانید.',
      }, { status: 400 });
    }

    await writer.collection('checks').delete(id);

    const maskedSayadId = `${existing.sayadId.slice(0, 4)}****${existing.sayadId.slice(12)}`;
    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_deleted',
      request,
      details: `چک صیاد ${maskedSayadId} حذف شد.`,
      entityType: 'check',
      entityId: id,
      entityLabel: `چک صیاد ${maskedSayadId}`,
      changes: { deleted: true },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ success: true, message: 'چک با موفقیت حذف شد.' });
  } catch (error: any) {
    console.error('check_delete_failed', error);
    return NextResponse.json({ message: error?.message || 'حذف چک انجام نشد.' }, { status: 400 });
  }
}
