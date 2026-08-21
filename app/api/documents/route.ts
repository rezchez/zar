import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  serializeDocumentDetails,
  mapDocument,
} from '@/lib/document';
import {
  buildDocumentNumber,
  getActiveDocumentPrefix,
  getNextDocumentNumber,
  getNextDocumentSequenceForCustomer,
} from '@/lib/document-service';
import { jalaliDateToIso, normalizeDigits } from '@/lib/jalali';
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

  if (!hasPermission(context.user, 'document.view') && !hasPermission(context.user, 'document.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اسناد.' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    if (url.searchParams.get('inventory') === 'melted') {
      const records = await context.pb.collection('transactions').getFullList({
        filter: 'documentSubType = "incoming-molten" || documentSubType = "outgoing-molten"',
        sort: 'created',
        expand: 'customer',
      });
      const inflows = new Map<string, {
        id: string;
        weight: number;
        remainingWeight: number;
        purity: number;
        stampNumber: string;
        customerName: string;
      }>();
      for (const record of records) {
        const details = typeof record.documentDetails === 'string'
          ? (() => { try { return JSON.parse(record.documentDetails) as Record<string, unknown>; } catch { return {}; } })()
          : {};
        const weight = Math.abs(Number(record.goldAmount ?? 0));
        if (record.documentNature === 'received' && weight > 0) {
          inflows.set(record.id, {
            id: record.id,
            weight,
            remainingWeight: weight,
            purity: Number(details.purity ?? 750) || 750,
            stampNumber: String(details.stampNumber ?? ''),
            customerName: String(record.expand?.customer?.name ?? record.customerCode ?? ''),
          });
        }
        if (record.documentNature === 'paid' && typeof details.inventorySourceId === 'string') {
          const source = inflows.get(details.inventorySourceId);
          if (source) source.remainingWeight = Math.max(0, source.remainingWeight - weight);
        }
      }
      return NextResponse.json({
        inventory: [...inflows.values()].filter((item) => item.remainingWeight > 0.0000001),
      });
    }

    const customerId = url.searchParams.get('customerId') ?? '';
    if (customerId) {
      const docInfo = await getNextDocumentNumber(context.pb, customerId);
      return NextResponse.json({
        nextDocumentSequence: docInfo.sequence,
        documentNumberPrefix: docInfo.prefix,
        documentNumber: docInfo.documentNumber,
      });
    }

    const defaultPrefix = await getActiveDocumentPrefix(context.pb);
    return NextResponse.json({
      nextDocumentSequence: 1,
      documentNumberPrefix: defaultPrefix,
      documentNumber: `${defaultPrefix}1`,
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

  if (!hasPermission(context.user, 'document.create') && !hasPermission(context.user, 'document.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت سند جدید.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: 'اطلاعات سند معتبر نیست.' }, { status: 400 });
  }

  const documentDateJalali = readString(body.documentDateJalali, 20);
  const requestedStatus = body.status === 'temporary' ? 'temporary' : 'final';
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

    const documentId = readString(body.documentId, 80) || randomUUID();
    const existingDocument = await context.pb.collection('transactions').getFullList({
      filter: context.pb.filter(
        'documentId = {:documentId} && is_deleted = false',
        { documentId },
      ),
      sort: 'documentLineNumber',
    }).catch(() => []);

    if (existingDocument.length > 0) {
      return NextResponse.json({
        transactions: existingDocument.map(mapDocument),
        transaction: mapDocument(existingDocument[0]),
        documentId,
        documentNumber: String(existingDocument[0].documentNumber ?? ''),
        documentSequence: Number(existingDocument[0].documentSequence ?? 1),
        alreadyExists: true,
      }, { status: 200 });
    }

    const requestedLines = Array.isArray(body.lines) ? body.lines : [body];
    const lines = requestedLines.length ? requestedLines : [body];

    const inventoryRecords = await context.pb.collection('transactions').getFullList({
      filter: 'documentSubType = "incoming-molten" || documentSubType = "outgoing-molten"',
      sort: 'created',
    });
    const availableMelted = new Map<string, number>();
    for (const record of inventoryRecords) {
      const weight = Math.abs(Number(record.goldAmount ?? 0));
      const details = typeof record.documentDetails === 'string'
        ? (() => { try { return JSON.parse(record.documentDetails) as Record<string, unknown>; } catch { return {}; } })()
        : {};
      if (record.documentNature === 'received' && weight > 0) availableMelted.set(record.id, weight);
      if (record.documentNature === 'paid' && typeof details.inventorySourceId === 'string') {
        availableMelted.set(
          details.inventorySourceId,
          Math.max(0, (availableMelted.get(details.inventorySourceId) ?? 0) - weight),
        );
      }
    }

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
      const details = normalizeDetails(line.documentDetails);
      if (
        lineNature === 'paid'
        && line.documentSubType === 'outgoing-molten'
        && typeof details.inventorySourceId === 'string'
        && details.inventorySourceId
      ) {
        const requestedWeight = Math.abs(lineAmounts.goldAmount ?? 0);
        const availableWeight = availableMelted.get(details.inventorySourceId) ?? 0;
        if (requestedWeight > availableWeight + 0.0000001) {
          throw new Error(`وزن خروجی ردیف ${index + 1} از موجودی آبشده بیشتر است.`);
        }
        availableMelted.set(details.inventorySourceId, availableWeight - requestedWeight);
      }

      return {
        line,
        lineNature,
        lineAmounts,
        lineNumber: index + 1,
        documentDetails: details,
      };
    });

    let writer = context.pb;
    try {
      writer = await getPocketBaseServiceClient();
    } catch {
      // fallback
    }

    const activePrefix = await getActiveDocumentPrefix(writer);
    let attempts = 0;
    let finalRecords: Record<string, unknown>[] = [];
    let finalSequence = 1;
    let finalDocumentNumber = '';

    while (attempts < 5) {
      attempts++;
      finalSequence = await getNextDocumentSequenceForCustomer(writer, customer.id);
      finalDocumentNumber = buildDocumentNumber(activePrefix, finalSequence);

      const documentPayloads = preparedLines.map((prepared) => ({
        customer: customer.id,
        customerCode: Number(customer.customerCode ?? 0),
        createdBy: context.user.id,
        updatedBy: context.user.id,
        transactionType: 'document',
        status: requestedStatus,
        isOpeningBalance: false,
        sourceKey: `document:${documentId}:${prepared.lineNumber}`,
        transactionDate,
        documentId,
        documentSequence: finalSequence,
        documentNumberPrefixSnapshot: activePrefix,
        documentNumber: finalDocumentNumber,
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

      const currentCreatedRecords = [];
      try {
        for (const payload of documentPayloads) {
          currentCreatedRecords.push(await writer.collection('transactions').create(payload));
        }
        finalRecords = currentCreatedRecords as unknown as Record<string, unknown>[];
        break;
      } catch (err) {
        for (const record of currentCreatedRecords) {
          try {
            await writer.collection('transactions').delete(record.id);
          } catch {
            // ignore
          }
        }
        if (attempts >= 5) {
          throw err;
        }
      }
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_created',
      request,
      details: `سند چندردیفی شماره ${finalDocumentNumber} برای طرف‌حساب ${customer.customerCode} ثبت شد.`,
      entityType: 'transaction',
      entityId: documentId,
      entityLabel: `${customer.customerCode} - سند ${finalDocumentNumber}`,
      changes: {
        lineCount: finalRecords.length,
        documentDateJalali,
        documentSequence: finalSequence,
        documentNumberPrefixSnapshot: activePrefix,
        documentNumber: finalDocumentNumber,
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
      transactions: finalRecords.map((r) => mapDocument(r as never)),
      transaction: mapDocument(finalRecords[0] as never),
      documentId,
      documentSequence: finalSequence,
      documentNumberPrefixSnapshot: activePrefix,
      documentNumber: finalDocumentNumber,
      nextDocumentSequence: finalSequence + 1,
      registeredAt: finalRecords[0].created,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ثبت سند انجام نشد. اطلاعات سند را بررسی و دوباره تلاش کنید.';
    return NextResponse.json(
      { message },
      { status: 400 },
    );
  }
}
