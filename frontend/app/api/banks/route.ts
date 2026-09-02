import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapBankAccount } from '@/lib/bank';
import { ensureBankAccountsCollection } from '@/lib/bank-collection';
import { ensureBankAccountDetailInChart } from '@/lib/chart-of-accounts';
import { parseLocalizedAmount } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function text(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validateIranianSheba(sheba: string): { valid: boolean; error?: string } {
  const clean = sheba.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!clean) return { valid: true }; // Optional field

  const norm = clean.startsWith('IR') ? clean : `IR${clean}`;
  if (!/^IR[0-9]{24}$/.test(norm)) {
    return { valid: false, error: 'شماره شبا باید با IR شروع شده و شامل ۲۴ رقم باشد (مثال: IR123456789012345678901234).' };
  }
  return { valid: true };
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
      expand: 'accountId',
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
  const rawSheba = text(body?.shebaNumber || body?.iban, 34);
  const hasCheckbook = Boolean(body?.hasCheckbook);
  const hasVirtualCheck = Boolean(body?.hasVirtualCheck);
  const accountCodeZero = text(body?.accountCodeZero, 80) || '0';
  const currency = text(body?.currency, 16).toUpperCase() || 'IRR';
  const rawBalance = body?.currentBalance ?? body?.balance ?? 0;
  const initialBalance = parseLocalizedAmount(String(rawBalance));
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true;
  const explicitAccountId = body?.accountId ? text(body.accountId, 40) : null;

  if (!bankName || !accountNumber || initialBalance < 0) {
    return NextResponse.json(
      { message: 'نام بانک، شماره حساب و موجودی معتبر الزامی است.' },
      { status: 400 },
    );
  }

  if (rawSheba) {
    const shebaValidation = validateIranianSheba(rawSheba);
    if (!shebaValidation.valid) {
      return NextResponse.json({ message: shebaValidation.error }, { status: 400 });
    }
  }

  const normSheba = rawSheba ? (rawSheba.toUpperCase().startsWith('IR') ? rawSheba.toUpperCase() : `IR${rawSheba.toUpperCase()}`) : '';

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

    let linkedAccountId: string | null = null;
    try {
      const detailAccount = await ensureBankAccountDetailInChart(writer, {
        bankName,
        branchName,
        accountNumber,
        currency,
        existingAccountId: explicitAccountId || null,
        userId: context.user.id,
      });
      if (detailAccount?.id && detailAccount.id.trim().length > 0) {
        linkedAccountId = detailAccount.id;
      }
    } catch (err) {
      console.warn('ensureBankAccountDetailInChart failed, proceeding without linked account:', err);
    }

    const record = await writer.collection('bank_accounts').create({
      bankName,
      branchName,
      accountNumber,
      shebaNumber: normSheba,
      hasCheckbook,
      hasVirtualCheck,
      balance: initialBalance,
      currentBalance: initialBalance,
      currency,
      isActive,
      accountId: linkedAccountId || null,
      accountCodeZero,
      owner: context.user.id,
      createdBy: context.user.id,
      updatedBy: context.user.id,
    });

    const fullRecord = await writer.collection('bank_accounts').getOne(record.id, {
      expand: 'accountId',
    }).catch(() => record);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حساب بانکی جدید ${bankName} (${branchName}) با شماره ${accountNumber} ایجاد شد.`,
      entityType: 'bank_account',
      entityId: record.id,
      entityLabel: `${bankName} - ${accountNumber}`,
      changes: { bankName, branchName, accountNumber, shebaNumber: normSheba, hasCheckbook, hasVirtualCheck, balance: initialBalance, currency, accountId: linkedAccountId },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ bank: mapBankAccount(fullRecord) }, { status: 201 });
  } catch (error: any) {
    console.error('bank_account_create_failed', error);
    return NextResponse.json(
      { message: error?.message || 'ثبت حساب بانکی انجام نشد.' },
      { status: 400 },
    );
  }
}
