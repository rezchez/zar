import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { ensureChecksCollection } from '@/lib/check-collection';
import { mapCheckRecord } from '@/lib/check';
import { jalaliDateToIso, normalizeDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';
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

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به فهرست چک‌ها.' }, { status: 403 });
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

  if (!hasPermission(context.user, 'bank.create') && !hasPermission(context.user, 'bank.manage') && !hasPermission(context.user, 'transaction.create')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به صدور چک.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const bankAccountId = text(body?.bankAccount || body?.bankAccountId, 40);
  const customerId = text(body?.customer || body?.customerId, 40);
  const rawSayadId = text(body?.sayadId || body?.checkNumber, 80);
  const normalizedSayadId = normalizeDigits(rawSayadId).replace(/\D/g, '');
  const description = text(body?.description || body?.babat, 500);
  const dueDateJalali = text(body?.dueDateJalali, 20) || text(body?.dueDate, 20);
  const currency = text(body?.currency, 16).toUpperCase() || 'IRR';
  const amount = parseLocalizedAmount(String(body?.amount ?? 0));

  if (!bankAccountId) {
    return NextResponse.json({ message: 'حساب بانکی پرداخت‌کننده را انتخاب کنید.' }, { status: 400 });
  }

  if (!customerId) {
    return NextResponse.json({ message: 'طرف‌حساب (گیرنده چک) را انتخاب کنید.' }, { status: 400 });
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

    // Verify bank account & check balance
    const bankAccount = await writer.collection('bank_accounts').getOne(bankAccountId);
    const customer = await writer.collection('customers').getOne(customerId);

    const currentBankBalance = Number(bankAccount.currentBalance ?? bankAccount.balance ?? 0);
    if (currentBankBalance < amount) {
      return NextResponse.json(
        { message: `موجودی حساب بانکی (${currentBankBalance.toLocaleString('fa-IR')} ${bankAccount.currency || 'ریال'}) برای صدور این چک کافی نیست.` },
        { status: 400 },
      );
    }

    const documentId = text(body?.documentId, 80) || randomUUID();

    // Create Check record with status 'issued'
    const checkRecord = await writer.collection('checks').create({
      bankAccount: bankAccount.id,
      customer: customer.id,
      sayadId: normalizedSayadId,
      amount,
      currency,
      description,
      dueDate: dueDateIso,
      dueDateJalali,
      status: 'issued',
      document: documentId,
      createdBy: context.user.id,
      updatedBy: context.user.id,
    });

    // Update bank balance immediately upon check issuance
    const nextBalance = currentBankBalance - amount;
    await writer.collection('bank_accounts').update(bankAccount.id, {
      balance: nextBalance,
      currentBalance: nextBalance,
      updatedBy: context.user.id,
    });

    // Create accounting transaction
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
      description: `پرداخت چک صیادی ${normalizedSayadId} — ${description}`,
      documentNature: 'paid',
      documentTab: 'bank',
      documentSubType: 'check-payment',
      settlementMethod: 'check',
      balanceSource: 'current',
      rialAmount: currency === 'IRR' ? -amount : 0,
      foreignAmount: currency !== 'IRR' ? -amount : 0,
      foreignCurrency: currency !== 'IRR' ? currency : '',
      documentDetails: JSON.stringify({
        checkId: checkRecord.id,
        sayadId: normalizedSayadId,
        bankAccountId: bankAccount.id,
        bankName: bankAccount.bankName,
        dueDateJalali,
        dueDate: dueDateIso,
      }),
    }).catch(() => undefined);

    // Audit Log (mask Sayad ID for security)
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
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ check: mapCheckRecord(checkRecord) }, { status: 201 });
  } catch (error) {
    console.error('check_create_failed', error);
    return NextResponse.json({ message: 'ثبت چک انجام نشد. اطلاعات را بررسی و دوباره تلاش کنید.' }, { status: 400 });
  }
}
