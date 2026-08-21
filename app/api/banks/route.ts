import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapBankAccount } from '@/lib/bank';
import { ensureBankAccountsCollection } from '@/lib/bank-collection';
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
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حساب‌های بانکی.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const activeOnly = url.searchParams.get('active') === 'true';

  try {
    const service = await getPocketBaseServiceClient().catch(() => null);
    if (service) await ensureBankAccountsCollection(service);

    const filter = activeOnly ? context.pb.filter('isActive = true') : '';
    const records = await context.pb.collection('bank_accounts').getFullList({
      filter,
      sort: 'bankName,accountNumber',
    });
    return NextResponse.json({ banks: records.map((record) => mapBankAccount(record)) });
  } catch (error) {
    console.error('bank_accounts_list_failed', error);
    return NextResponse.json(
      { message: 'دریافت حساب‌های بانکی انجام نشد.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.create') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ایجاد حساب بانکی جدید.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const bankName = text(body?.bankName);
  const branchName = text(body?.branchName, 120);
  const accountNumber = text(body?.accountNumber, 80);
  const accountCodeZero = text(body?.accountCodeZero, 80) || '0';
  const currency = text(body?.currency, 16).toUpperCase() || 'IRR';
  const rawBalance = body?.currentBalance ?? body?.balance ?? 0;
  const initialBalance = parseLocalizedAmount(String(rawBalance));
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;

  if (!bankName || !accountNumber || initialBalance < 0) {
    return NextResponse.json(
      { message: 'نام بانک، شماره حساب و موجودی معتبر الزامی است.' },
      { status: 400 },
    );
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureBankAccountsCollection(writer);
    const duplicate = await writer.collection('bank_accounts').getFirstListItem(
      writer.filter('accountNumber = {:accountNumber}', { accountNumber }),
    ).catch(() => null);

    if (duplicate) {
      return NextResponse.json({ message: 'این شماره حساب قبلاً ثبت شده است.' }, { status: 409 });
    }

    const record = await writer.collection('bank_accounts').create({
      bankName,
      branchName,
      accountNumber,
      balance: initialBalance,
      currentBalance: initialBalance,
      currency,
      isActive,
      accountCodeZero,
      owner: context.user.id,
      createdBy: context.user.id,
      updatedBy: context.user.id,
    });

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حساب بانکی جدید ${bankName} (${branchName}) با شماره ${accountNumber} ایجاد شد.`,
      entityType: 'bank_account',
      entityId: record.id,
      entityLabel: `${bankName} - ${accountNumber}`,
      changes: { bankName, branchName, accountNumber, balance: initialBalance, currency },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ bank: mapBankAccount(record) }, { status: 201 });
  } catch (error) {
    console.error('bank_account_create_failed', error);
    return NextResponse.json(
      { message: 'ثبت حساب بانکی انجام نشد. ابتدا کالکشن bank_accounts را در PocketBase بسازید.' },
      { status: 400 },
    );
  }
}
