import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { mapTransaction, sumPostedTransactions } from '@/lib/transaction';

const allowedTransactionTypes = new Set(['document', 'adjustment', 'reversal']);
const amountFields = [
  'goldAmount',
  'silverAmount',
  'platinumAmount',
  'rialAmount',
  'foreignAmount',
  'tertiaryAmount',
] as const;

function hasAmount(amounts: Record<string, number>) {
  return amountFields.some((field) => amounts[field] !== 0);
}

function readString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readAmount(value: unknown) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validDate(value: string) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

import { hasPermission } from '@/lib/authorization';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'transaction.view') && !hasPermission(context.user, 'customer.view')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await context.pb.collection('customers').getOne(id);
    const records = await context.pb.collection('transactions').getFullList({
      filter: context.pb.filter('customer = {:customerId}', { customerId: id }),
      sort: '-transactionDate,-created',
    });
    const transactions = records.map(mapTransaction);

    return NextResponse.json({
      transactions,
      balances: sumPostedTransactions(transactions),
    });
  } catch {
    return NextResponse.json(
      { message: 'دریافت تراکنش‌های طرف‌حساب انجام نشد.' },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'transaction.create') && !hasPermission(context.user, 'transaction.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای ایجاد تراکنش.' }, { status: 403 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const transactionType = String(body?.transactionType ?? 'document');

  if (!body || !allowedTransactionTypes.has(transactionType)) {
    return NextResponse.json(
      { message: 'نوع تراکنش معتبر نیست.' },
      { status: 400 },
    );
  }

  const transactionDate = validDate(readString(body.transactionDate, 40));
  if (!transactionDate) {
    return NextResponse.json(
      { message: 'تاریخ تراکنش معتبر نیست.' },
      { status: 400 },
    );
  }

  const amounts: Record<string, number> = {};
  for (const field of amountFields) {
    const amount = readAmount(body[field]);
    if (amount === null) {
      return NextResponse.json(
        { message: `مقدار ${field} معتبر نیست.` },
        { status: 400 },
      );
    }
    amounts[field] = amount;
  }

  try {
    const customer = await context.pb.collection('customers').getOne(id);
    const documentId = readString(body.documentId, 80);
    const sourceKey = documentId
      ? `document:${documentId}:${id}`
      : `transaction:${randomUUID()}`;

    if (!hasAmount(amounts)) {
      return NextResponse.json(
        { message: 'تراکنش باید حداقل یک مبلغ غیرصفر داشته باشد.' },
        { status: 400 },
      );
    }

    const existing = documentId
      ? await context.pb
        .collection('transactions')
        .getFirstListItem(
          context.pb.filter('sourceKey = {:sourceKey}', { sourceKey }),
        )
        .catch(() => null)
      : null;

    if (existing) {
      return NextResponse.json(
        { transaction: mapTransaction(existing), alreadyExists: true },
        { status: 200 },
      );
    }

    let transaction;
    try {
      transaction = await context.pb.collection('transactions').create({
        customer: id,
        customerCode: Number(customer.customerCode ?? 0),
        createdBy: context.user.id,
        updatedBy: context.user.id,
        transactionType,
        status: 'posted',
        isOpeningBalance: false,
        sourceKey,
        transactionDate,
        documentId,
        documentNumber: readString(body.documentNumber, 80),
        description: readString(body.description, 2000),
        ...amounts,
        foreignCurrency: String(customer.secondaryCurrency ?? ''),
        foreignCurrencySymbol: String(customer.secondaryCurrencySymbol ?? ''),
        tertiaryCurrency: String(customer.tertiaryCurrency ?? ''),
        tertiaryCurrencySymbol: String(customer.tertiaryCurrencySymbol ?? ''),
      });
    } catch (error) {
      if (!documentId) throw error;
      const concurrent = await context.pb
        .collection('transactions')
        .getFirstListItem(
          context.pb.filter('sourceKey = {:sourceKey}', { sourceKey }),
        )
        .catch(() => null);
      if (!concurrent) throw error;
      return NextResponse.json(
        { transaction: mapTransaction(concurrent), alreadyExists: true },
        { status: 200 },
      );
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_created',
      request,
      details: `تراکنش ${transactionType} برای حساب ${customer.customerCode ?? '—'} ثبت شد.`,
      entityType: 'transaction',
      entityId: transaction.id,
      entityLabel: `${customer.customerCode ?? '—'} - ${readString(body.documentNumber, 80) || 'بدون شماره سند'}`,
      changes: {
        transactionType,
        transactionDate,
        documentId,
        documentNumber: readString(body.documentNumber, 80),
        description: readString(body.description, 2000),
        amounts,
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json(
      { transaction: mapTransaction(transaction) },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { message: 'ثبت تراکنش انجام نشد.' },
      { status: 400 },
    );
  }
}
