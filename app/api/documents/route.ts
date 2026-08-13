import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import {
  serializeDocumentDetails,
} from '@/lib/document';
import { getNextDocumentNumber } from '@/lib/document-service';
import { jalaliDateToIso, normalizeDigits } from '@/lib/jalali';
import { mapDocument } from '@/lib/document';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

const amountFields = [
  'goldAmount',
  'silverAmount',
  'platinumAmount',
  'rialAmount',
  'foreignAmount',
  'tertiaryAmount',
] as const;

function readString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function readAmount(value: unknown) {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = typeof value === 'number'
    ? value
    : Number(normalizeDigits(String(value)).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function hasAmount(amounts: Record<string, number>) {
  return amountFields.some((field) => amounts[field] !== 0);
}

function normalizeDetails(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
      .map(([key, item]) => [key.slice(0, 50), item]),
  );
}

async function resolveCustomer(
  pb: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>['pb'],
  body: Record<string, unknown>,
) {
  const customerId = readString(body.customerId, 40);
  if (customerId) return pb.collection('customers').getOne(customerId);

  const code = readAmount(body.customerCode);
  if (!code || !Number.isInteger(code) || code < 1) return null;

  return pb.collection('customers').getFirstListItem(
    pb.filter('customerCode = {:customerCode}', { customerCode: code }),
  );
}

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const customerId = new URL(request.url).searchParams.get('customerId') ?? '';
    return NextResponse.json({
      nextDocumentNumber: await getNextDocumentNumber(context.pb, customerId || undefined),
    });
  } catch {
    return NextResponse.json(
      { message: 'شماره سند بعدی دریافت نشد.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: 'اطلاعات سند معتبر نیست.' }, { status: 400 });
  }

  const documentDateJalali = readString(body.documentDateJalali, 20);
  const transactionDate = jalaliDateToIso(documentDateJalali);
  if (!transactionDate) {
    return NextResponse.json(
      { message: 'تاریخ سند را به‌صورت صحیح وارد کنید؛ نمونه: ۱۴۰۵/۰۵/۲۲' },
      { status: 400 },
    );
  }

  try {
    const customer = await resolveCustomer(context.pb, body);
    if (!customer) {
      return NextResponse.json(
        { message: 'طرف‌حساب انتخاب نشده یا کد حساب پیدا نشد.' },
        { status: 400 },
      );
    }

    // The number is assigned on the server so two browser tabs cannot
    // accidentally reuse a stale number shown in the form.
    const documentNumber = String(await getNextDocumentNumber(context.pb, customer.id));
    const documentId = readString(body.documentId, 80) || randomUUID();
    const requestedLines = Array.isArray(body.lines) ? body.lines : [body];
    const lines = requestedLines.length
      ? requestedLines
      : [body];

    const preparedLines = lines.map((rawLine, index) => {
      const line = rawLine && typeof rawLine === 'object' && !Array.isArray(rawLine)
        ? rawLine as Record<string, unknown>
        : {};
      const lineNature = line.documentNature === 'paid' ? 'paid' : 'received';
      const lineAmounts: Record<string, number> = {};

      for (const field of amountFields) {
        const amount = readAmount(line[field]);
        if (amount === null) {
          throw new Error(`مقدار ${field} در ردیف ${index + 1} معتبر نیست.`);
        }
        lineAmounts[field] = Math.abs(amount) * (lineNature === 'received' ? 1 : -1);
      }

      if (!hasAmount(lineAmounts)) {
        throw new Error(`ردیف ${index + 1} باید حداقل یک مبلغ یا وزن غیرصفر داشته باشد.`);
      }

      return {
        line,
        lineNature,
        lineAmounts,
        lineNumber: index + 1,
        documentDetails: normalizeDetails(line.documentDetails),
      };
    });

    const documentPayloads = preparedLines.map((prepared) => ({
      customer: customer.id,
      customerCode: Number(customer.customerCode ?? 0),
      createdBy: context.user.id,
      updatedBy: context.user.id,
      transactionType: 'document',
      status: 'posted',
      isOpeningBalance: false,
      sourceKey: `document:${documentId}:${prepared.lineNumber}`,
      transactionDate,
      documentId,
      documentNumber,
      description: readString(prepared.line.description ?? body.description, 2000),
      documentNature: prepared.lineNature,
      documentTab: readString(prepared.line.documentTab ?? body.documentTab, 40) || 'general',
      documentSubType: readString(prepared.line.documentSubType ?? body.documentSubType, 80),
      documentDateJalali,
      settlementMethod: readString(prepared.line.settlementMethod ?? body.settlementMethod, 20) || 'mixed',
      balanceSource: readString(prepared.line.balanceSource ?? body.balanceSource, 20) || 'current',
      documentDetails: serializeDocumentDetails(prepared.documentDetails),
      documentLineNumber: prepared.lineNumber,
      ...prepared.lineAmounts,
      foreignCurrency: String(customer.secondaryCurrency ?? ''),
      foreignCurrencySymbol: String(customer.secondaryCurrencySymbol ?? ''),
      tertiaryCurrency: String(customer.tertiaryCurrency ?? ''),
      tertiaryCurrencySymbol: String(customer.tertiaryCurrencySymbol ?? ''),
    }));

    let writer = context.pb;
    try {
      writer = await getPocketBaseServiceClient();
    } catch {
      // The authenticated client remains a safe fallback when the service
      // credentials are not available in a development environment.
    }

    const records = [];
    try {
      for (const payload of documentPayloads) {
        records.push(await writer.collection('transactions').create(payload));
      }
    } catch (error) {
      for (const record of records) {
        try {
          await writer.collection('transactions').delete(record.id);
        } catch {
          // Best-effort rollback keeps a failed multi-line document invisible.
        }
      }
      throw error;
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_created',
      request,
      details: `سند چندردیفی شماره ${documentNumber} برای طرف‌حساب ${customer.customerCode} ثبت شد.`,
      entityType: 'transaction',
      entityId: documentId,
      entityLabel: `${customer.customerCode} - سند ${documentNumber}`,
      changes: {
        lineCount: records.length,
        documentDateJalali,
        documentNumber,
        lines: preparedLines.map((line) => ({
          lineNumber: line.lineNumber,
          documentNature: line.lineNature,
          amounts: line.lineAmounts,
          details: line.documentDetails,
        })),
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      transactions: records.map(mapDocument),
      transaction: mapDocument(records[0]),
      documentId,
      documentNumber,
      registeredAt: records[0].created,
    }, { status: 201 });
  } catch (error) {
    console.error('document_create_failed', error);
    return NextResponse.json(
      { message: 'ثبت سند انجام نشد. اطلاعات سند را بررسی و دوباره تلاش کنید.' },
      { status: 400 },
    );
  }
}
