import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { ensureChecksCollection } from '@/lib/check-collection';
import { mapCheckRecord, type CheckStatus, type ChequeType } from '@/lib/check';
import { formatJalaliDate, jalaliDateToIso, normalizeDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { postPayableChequeIssue, postReceivableChequeReceipt } from '@/lib/accounting-posting-engine';
import { mapBankAccount } from '@/lib/bank';

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

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = text(url.searchParams.get('status'), 20);
  const upcomingDays = Number(url.searchParams.get('upcomingDays'));

  let filter = '';
  const filters: string[] = [];

  if (status) {
    filters.push(context.pb.filter('status = {:status}', { status }));
  }

  if (Number.isFinite(upcomingDays) && upcomingDays > 0) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + upcomingDays * 86_400_000);
    filters.push(context.pb.filter('dueDate <= {:futureDate}', { futureDate: futureDate.toISOString() }));
  }

  if (filters.length) {
    filter = filters.join(' && ');
  }

  try {
    const service = await getPocketBaseServiceClient().catch(() => null);
    if (service) await ensureChecksCollection(service);

    const records = await context.pb.collection('checks').getFullList({
      filter,
      sort: 'dueDate',
      expand: 'bankAccount,customer',
    });

    return NextResponse.json({ checks: records.map(mapCheckRecord) });
  } catch (error) {
    console.error('checks_list_failed', error);
    return NextResponse.json({ message: 'دریافت لیست چک‌ها انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const bankAccountId = text(body?.bankAccount || body?.bankAccountId, 40);
  const customerId = text(body?.customer || body?.customerId, 40);
  const rawSayadId = text(body?.sayadId || body?.checkNumber, 80);
  const normalizedSayadId = normalizeDigits(rawSayadId).replace(/\D/g, '');
  const description = text(body?.description || body?.babat, 500);
  const dueDateJalali = text(body?.dueDateJalali, 20) || text(body?.dueDate, 20);
  const issueDateJalali = text(body?.issueDateJalali, 20) || formatJalaliDate();
  const currency = text(body?.currency, 16).toUpperCase() || 'IRR';
  const amount = parseLocalizedAmount(String(body?.amount ?? 0));
  const rawStatus = text(body?.status, 20) || 'issued';
  const validStatus: CheckStatus = (
    rawStatus === 'draft' || rawStatus === 'delivered' || rawStatus === 'pending'
  ) ? (rawStatus as CheckStatus) : 'issued';
  const chequeType: ChequeType = body?.chequeType === 'receivable' ? 'receivable' : 'payable';

  if (!bankAccountId) {
    return NextResponse.json({ message: 'حساب بانکی صادرکننده/مرتبط را انتخاب کنید.' }, { status: 400 });
  }

  if (!customerId) {
    return NextResponse.json({ message: 'طرف‌حساب را انتخاب کنید.' }, { status: 400 });
  }

  if (amount <= 0) {
    return NextResponse.json({ message: 'مبلغ چک باید بزرگ‌تر از صفر باشد.' }, { status: 400 });
  }

  if (!normalizedSayadId || normalizedSayadId.length !== 16) {
    return NextResponse.json({ message: 'شناسه صیاد باید دقیقاً ۱۶ رقم باشد.' }, { status: 400 });
  }

  if (!description) {
    return NextResponse.json({ message: 'توضیحات بابت چک الزامی است.' }, { status: 400 });
  }

  const dueDateIso = jalaliDateToIso(dueDateJalali);
  if (!dueDateIso) {
    return NextResponse.json({ message: 'تاریخ سررسید معتبر نیست. نمونه: ۱۴۰۵/۰۵/۲۹' }, { status: 400 });
  }

  const issueDateIso = jalaliDateToIso(issueDateJalali) || new Date().toISOString().slice(0, 10);

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureChecksCollection(writer);

    // Duplicate Sayad ID check
    const duplicate = await writer.collection('checks').getFirstListItem(
      writer.filter('sayadId = {:sayadId}', { sayadId: normalizedSayadId }),
    ).catch(() => null);

    if (duplicate) {
      return NextResponse.json({ message: 'چک دیگری با این شناسه صیاد قبلاً ثبت شده است.' }, { status: 409 });
    }

    // Verify bank account & customer
    const rawBankAccount = await writer.collection('bank_accounts').getOne(bankAccountId, {
      expand: 'accountId',
    });
    const bankAccount = mapBankAccount(rawBankAccount);
    const customer = await writer.collection('customers').getOne(customerId);

    const documentId = text(body?.documentId, 80) || randomUUID();

    // 1. Create Check record
    const checkRecord = await writer.collection('checks').create({
      bankAccount: bankAccount.id,
      customer: customer.id,
      sayadId: normalizedSayadId,
      amount,
      currency,
      description,
      chequeType,
      issueDate: issueDateIso,
      issueDateJalali,
      dueDate: dueDateIso,
      dueDateJalali,
      status: validStatus,
      document: documentId,
      createdBy: context.user.id,
      updatedBy: context.user.id,
    });

    // 2. Execute Balanced Double-Entry Accounting Entry
    // Note: Standard Accounting rule: Issuing a cheque transfers debt to Notes Payable (2110).
    // Bank balance is NOT deducted until clearing!
    let journalResult: any = null;
    if (chequeType === 'payable') {
      journalResult = await postPayableChequeIssue(
        {
          id: checkRecord.id,
          amount,
          sayadId: normalizedSayadId,
          description,
          dueDateJalali,
          bankAccount: bankAccount.id,
          customer: customer.id,
        },
        {
          id: customer.id,
          name: customer.name,
          customerCode: Number(customer.customerCode ?? 0),
        },
        bankAccount,
        context.user.id,
        writer,
      );
    } else {
      journalResult = await postReceivableChequeReceipt(
        {
          id: checkRecord.id,
          amount,
          sayadId: normalizedSayadId,
          description,
          dueDateJalali,
          customer: customer.id,
        },
        {
          id: customer.id,
          name: customer.name,
        },
        context.user.id,
        writer,
      );
    }

    // Update check record with journalEntryId
    if (journalResult?.id) {
      await writer.collection('checks').update(checkRecord.id, {
        journalEntryId: journalResult.id,
      }).catch(() => undefined);
    }

    // 3. Customer Transaction Ledger Entry (settlementMethod: 'check')
    await writer.collection('transactions').create({
      customer: customer.id,
      customerCode: Number(customer.customerCode ?? 0),
      createdBy: context.user.id,
      updatedBy: context.user.id,
      transactionType: 'document',
      status: 'posted',
      isOpeningBalance: false,
      sourceKey: `check-issued:${checkRecord.id}`,
      transactionDate: new Date().toISOString(),
      documentId,
      documentNumber: '',
      description: `صدور چک صیادی ${normalizedSayadId} — ${description}`,
      documentNature: chequeType === 'payable' ? 'paid' : 'received',
      documentTab: 'bank',
      documentSubType: 'check-payment',
      settlementMethod: 'check',
      balanceSource: 'current',
      rialAmount: currency === 'IRR' ? (chequeType === 'payable' ? -amount : amount) : 0,
      foreignAmount: currency !== 'IRR' ? (chequeType === 'payable' ? -amount : amount) : 0,
      foreignCurrency: currency !== 'IRR' ? currency : '',
      documentDetails: JSON.stringify({
        checkId: checkRecord.id,
        sayadId: normalizedSayadId,
        bankAccountId: bankAccount.id,
        bankName: bankAccount.bankName,
        dueDateJalali,
        dueDate: dueDateIso,
        journalEntryId: journalResult?.id || null,
      }),
    }).catch(() => undefined);

    // 4. Audit Log (mask Sayad ID for security)
    const maskedSayadId = `${normalizedSayadId.slice(0, 4)}****${normalizedSayadId.slice(12)}`;
    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_created',
      request,
      details: `صدور چک صیادی ${maskedSayadId} به مبلغ ${amount} ${currency} از ${bankAccount.bankName} به نام ${customer.name}`,
      entityType: 'check',
      entityId: checkRecord.id,
      entityLabel: `چک صیاد ${maskedSayadId}`,
      changes: {
        bankAccountId: bankAccount.id,
        bankName: bankAccount.bankName,
        customerId: customer.id,
        customerName: customer.name,
        amount,
        currency,
        dueDateJalali,
        dueDate: dueDateIso,
        journalEntryId: journalResult?.id,
      },
      authenticatedClient: context.pb,
    });

    const fullCheck = await writer.collection('checks').getOne(checkRecord.id, {
      expand: 'bankAccount,customer',
    }).catch(() => checkRecord);

    return NextResponse.json({ check: mapCheckRecord(fullCheck) }, { status: 201 });
  } catch (error) {
    console.error('check_create_failed', error);
    return NextResponse.json({ message: 'ثبت چک انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید.' }, { status: 400 });
  }
}
