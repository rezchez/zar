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
  generateUniqueZfDocumentNumber,
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

export type RawGoldInventoryItem = {
  id: string;
  weight: number;
  remainingWeight: number;
  purity: number;
  stampNumber: string;
  labName?: string;
  customerName: string;
  rawKind: 'molten' | 'conditional' | 'misc' | 'question';
};

export type MeltedInventoryItem = RawGoldInventoryItem;

const METAL_BASE_KARATS = {
  gold: 750,
  silver: 999,
  platinum: 950,
} as const;

const rawMetalInventoryTypes = {
  molten: 'melted',
  conditional: 'conditional',
  misc: 'miscellaneous',
  question: 'sowaleh',
  unsettled: 'general_metal',
} as const;

const rawKindFromInventoryType: Record<string, 'molten' | 'conditional' | 'misc' | 'question'> = {
  melted: 'molten',
  conditional: 'conditional',
  miscellaneous: 'misc',
  sowaleh: 'question',
};

const rawKindFromDocumentSubType: Record<string, 'molten' | 'conditional' | 'misc' | 'question'> = {
  'incoming-molten': 'molten',
  'outgoing-molten': 'molten',
  'incoming-conditional': 'conditional',
  'outgoing-conditional': 'conditional',
  'incoming-misc': 'misc',
  'outgoing-misc': 'misc',
  'incoming-question': 'question',
  'outgoing-question': 'question',
};

function parseDetails(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function metalAmount(record: Record<string, unknown>, metal: string) {
  if (metal === 'silver') return Math.abs(Number(record.silverAmount ?? 0));
  if (metal === 'platinum') return Math.abs(Number(record.platinumAmount ?? 0));
  return Math.abs(Number(record.goldAmount ?? 0));
}

function metalInventoryType(rawKind: unknown) {
  return rawMetalInventoryTypes[rawKind as keyof typeof rawMetalInventoryTypes] ?? 'general_metal';
}

/** Dedicated metal ledger, with a non-duplicating legacy-transactions fallback for raw gold items. */
export async function getRawGoldInventory(
  pb: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>['pb'],
  kind?: 'molten' | 'conditional' | 'misc' | 'question',
) {
  const targetInvType = kind ? rawMetalInventoryTypes[kind] : null;

  const invFilter = targetInvType
    ? `metal = "gold" && inventory_type = "${targetInvType}" && is_deleted != true`
    : 'metal = "gold" && (inventory_type = "melted" || inventory_type = "conditional" || inventory_type = "miscellaneous" || inventory_type = "sowaleh") && is_deleted != true';

  const txFilter = kind
    ? `(documentSubType = "incoming-${kind}" || documentSubType = "outgoing-${kind}")`
    : '(documentSubType = "incoming-molten" || documentSubType = "outgoing-molten" || documentSubType = "incoming-conditional" || documentSubType = "outgoing-conditional" || documentSubType = "incoming-misc" || documentSubType = "outgoing-misc" || documentSubType = "incoming-question" || documentSubType = "outgoing-question")';

  const [inventoryRecords, transactionRecords] = await Promise.all([
    pb.collection('metal_inventory').getFullList({
      filter: invFilter,
      sort: 'created',
      expand: 'customer',
    }).catch(() => []),
    pb.collection('transactions').getFullList({
      filter: txFilter,
      sort: 'created',
      expand: 'customer',
    }).catch(() => []),
  ]);

  const available = new Map<string, RawGoldInventoryItem>();
  const linkedTransactionIds = new Set<string>();
  for (const record of inventoryRecords) {
    const transactionId = String(record.transaction_id ?? '');
    if (transactionId) linkedTransactionIds.add(transactionId);
    const weight = Math.abs(Number(record.raw_weight ?? 0));
    const invType = String(record.inventory_type ?? '');
    const itemKind = rawKindFromInventoryType[invType] ?? 'molten';
    if (String(record.direction) === 'in' && weight > 0) {
      available.set(record.id, {
        id: record.id,
        weight,
        remainingWeight: weight,
        purity: Number(record.purity ?? 750) || 750,
        stampNumber: String(record.stamp_number ?? ''),
        labName: String(record.lab_name ?? ''),
        customerName: String(record.expand?.customer?.name ?? (record.is_opening_balance ? 'موجودی اول دوره' : '')),
        rawKind: itemKind,
      });
    }
  }
  for (const record of inventoryRecords) {
    if (String(record.direction) !== 'out') continue;
    const source = available.get(String(record.source_inventory_id ?? ''));
    if (source) source.remainingWeight = Math.max(0, source.remainingWeight - Math.abs(Number(record.raw_weight ?? 0)));
  }
  for (const record of transactionRecords) {
    if (linkedTransactionIds.has(record.id) || record.is_deleted === true) continue;
    const details = parseDetails(record.documentDetails);
    const weight = Math.abs(Number(record.goldAmount ?? 0));
    const subType = String(record.documentSubType ?? '');
    const itemKind = rawKindFromDocumentSubType[subType] ?? (details.rawKind as 'molten' | 'conditional' | 'misc' | 'question') ?? 'molten';
    if (record.documentNature === 'received' && weight > 0) {
      available.set(record.id, {
        id: record.id,
        weight,
        remainingWeight: weight,
        purity: Number(details.purity ?? 750) || 750,
        stampNumber: String(details.stampNumber ?? ''),
        labName: String(details.labName ?? ''),
        customerName: String(record.expand?.customer?.name ?? (record.isOpeningBalance ? 'موجودی اول دوره' : (record.customerCode ?? ''))),
        rawKind: itemKind,
      });
    }
    if (record.documentNature === 'paid') {
      const source = available.get(String(details.inventorySourceId ?? ''));
      if (source) source.remainingWeight = Math.max(0, source.remainingWeight - weight);
    }
  }
  const result = [...available.values()].filter((item) => item.remainingWeight > 0.0000001);
  if (kind) {
    return result.filter((item) => item.rawKind === kind);
  }
  return result;
}

export async function getMeltedInventory(pb: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>['pb']) {
  return getRawGoldInventory(pb, 'molten');
}

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
    const inventoryParam = url.searchParams.get('inventory');
    if (inventoryParam === 'melted' || inventoryParam === 'raw-gold') {
      const kindParam = url.searchParams.get('kind') as 'molten' | 'conditional' | 'misc' | 'question' | null;
      const targetKind = inventoryParam === 'melted' ? 'molten' : (kindParam || undefined);
      return NextResponse.json({
        inventory: await getRawGoldInventory(context.pb, targetKind),
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
  // UI labels are temporary/final while the transactions collection stores
  // accounting states as draft/posted.
  const requestedStatus = body.status === 'temporary' ? 'draft' : 'posted';
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
    // The document ID is the user-facing idempotency token; sourceKey is the
    // storage-level guard used for each row. Check both before creating a
    // financial document so a retry can never create another first line.
    const existingFirstLine = await context.pb.collection('transactions').getFirstListItem(
      context.pb.filter(
        'sourceKey = {:sourceKey} && is_deleted = false',
        { sourceKey: `document:${documentId}:1` },
      ),
    ).catch(() => null);
    const existingDocument = await context.pb.collection('transactions').getFullList({
      filter: context.pb.filter(
        'documentId = {:documentId} && is_deleted = false',
        { documentId },
      ),
      sort: 'documentLineNumber',
    }).catch(() => []);

    if (existingDocument.length > 0 || existingFirstLine) {
      const records = existingDocument.length > 0 ? existingDocument : (existingFirstLine ? [existingFirstLine] : []);
      const primaryRecord = records[0];
      return NextResponse.json({
        transactions: records.map(mapDocument),
        transaction: primaryRecord ? mapDocument(primaryRecord) : null,
        documentId,
        documentNumber: String(primaryRecord?.documentNumber ?? ''),
        documentSequence: Number(primaryRecord?.documentSequence ?? 1),
        alreadyExists: true,
      }, { status: 200 });
    }

    const requestedLines = Array.isArray(body.lines) ? body.lines : [body];
    const lines = requestedLines.length ? requestedLines : [body];

    const rawGoldInventoryItems = await getRawGoldInventory(context.pb);
    const availableRawGold = new Map(
      rawGoldInventoryItems.map((item) => [item.id, item.remainingWeight]),
    );
    const rawGoldInventoryMap = new Map(
      rawGoldInventoryItems.map((item) => [item.id, item]),
    );

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
      if (line.documentTab === 'raw-gold') {
        const metal = String(details.metalType ?? 'gold');
        const rawKind = String(details.rawKind ?? 'molten');
        const weight = metalAmount(lineAmounts, metal);
        const purity = readAmount(details.purity);
        if (!['gold', 'silver', 'platinum'].includes(metal) || !Object.hasOwn(rawMetalInventoryTypes, rawKind)) {
          throw new Error(`مشخصات فلز در ردیف ${index + 1} معتبر نیست.`);
        }
        if (weight <= 0 || purity === null || purity < 1 || purity > 1000) {
          throw new Error(`وزن یا عیار فلز در ردیف ${index + 1} معتبر نیست.`);
        }
      }
      if (
        lineNature === 'paid'
        && typeof details.inventorySourceId === 'string'
        && details.inventorySourceId
      ) {
        const requestedWeight = Math.abs(lineAmounts.goldAmount ?? 0);
        const availableWeight = availableRawGold.get(details.inventorySourceId) ?? 0;
        if (requestedWeight > availableWeight + 0.0000001) {
          const kindTitle = details.rawKind === 'conditional'
            ? 'شرطی'
            : details.rawKind === 'misc'
              ? 'متفرقه'
              : details.rawKind === 'question'
                ? 'سواله'
                : 'آبشده';
          throw new Error(`وزن خروجی ردیف ${index + 1} از موجودی ${kindTitle} بیشتر است.`);
        }
        availableRawGold.set(details.inventorySourceId, availableWeight - requestedWeight);

        // Populate & enforce assay lab, stamp, and purity directly from the source inventory record
        const sourceItem = rawGoldInventoryMap.get(details.inventorySourceId);
        if (sourceItem) {
          // Purity must be strictly locked to the source lot's purity
          details.purity = sourceItem.purity;
          if (sourceItem.labName) {
            details.labName = (sourceItem.labName ?? '').trim();
          }
          if (sourceItem.stampNumber) {
            details.stampNumber = (sourceItem.stampNumber ?? '').trim();
          }
        }
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

    // Validate that referenced cash funds and bank accounts are not blocked
    for (const prepared of preparedLines) {
      const fundId = typeof prepared.documentDetails.cashFundId === 'string' ? prepared.documentDetails.cashFundId : null;
      if (fundId) {
        const fund = await writer.collection('cash_funds').getOne(fundId).catch(() => null);
        if (fund && fund.isBlocked === true) {
          return NextResponse.json(
            {
              success: false,
              code: 'CASH_FUND_BLOCKED',
              message: 'این صندوق مسدود است و امکان ثبت ورود یا خروج وجه نقد برای آن وجود ندارد.',
            },
            { status: 409 },
          );
        }
      }

      const bankId = typeof prepared.documentDetails.bankAccountId === 'string' ? prepared.documentDetails.bankAccountId : null;
      if (bankId) {
        const bankAcc = await writer.collection('bank_accounts').getOne(bankId).catch(() => null);
        if (bankAcc && bankAcc.isBlocked === true) {
          return NextResponse.json(
            {
              success: false,
              code: 'BANK_ACCOUNT_BLOCKED',
              message: 'این حساب بانکی مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.',
            },
            { status: 409 },
          );
        }
      }
    }

    const activePrefix = await getActiveDocumentPrefix(writer);
    const metalTypes = await writer.collection('metal_types').getFullList({ fields: 'id,code,base_karat' }).catch(() => []);
    const metalTypeByCode = new Map(metalTypes.map((record) => [String(record.code), record]));
    let attempts = 0;
    let finalRecords: Record<string, unknown>[] = [];
    let finalSequence = 1;
    let finalDocumentNumber = '';

    while (attempts < 5) {
      attempts++;
      finalSequence = await getNextDocumentSequenceForCustomer(writer, customer.id);
      const usedNumbers = new Set<string>();
      const lineDocumentNumbers: string[] = [];
      for (let i = 0; i < preparedLines.length; i++) {
        const num = await generateUniqueZfDocumentNumber(writer, 10, usedNumbers);
        lineDocumentNumbers.push(num);
      }
      finalDocumentNumber = lineDocumentNumbers[0] || '';

      const documentPayloads = preparedLines.map((prepared, idx) => ({
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
        documentNumber: lineDocumentNumbers[idx],
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
      const currentCreatedInventoryRecords = [];
      try {
        for (const payload of documentPayloads) {
          currentCreatedRecords.push(await writer.collection('transactions').create(payload));
        }
        for (let index = 0; index < preparedLines.length; index++) {
          const prepared = preparedLines[index];
          if (prepared.line.documentTab !== 'raw-gold') continue;
          const metal = String(prepared.documentDetails.metalType ?? 'gold') as keyof typeof METAL_BASE_KARATS;
          const rawWeight = metalAmount(prepared.lineAmounts, metal);
          if (rawWeight <= 0) continue;
          const metalType = metalTypeByCode.get(metal);
          const baseKarat = Number(metalType?.base_karat ?? METAL_BASE_KARATS[metal]);
          const purity = Number(prepared.documentDetails.purity);
          const sourceKey = `document:${documentId}:${prepared.lineNumber}:metal`;
          const existingInventory = await writer.collection('metal_inventory').getFirstListItem(
            writer.filter('source_key = {:sourceKey}', { sourceKey }),
          ).catch(() => null);
          if (existingInventory) continue;
          currentCreatedInventoryRecords.push(await writer.collection('metal_inventory').create({
            metal_type: metalType?.id ?? '',
            metal,
            inventory_type: metalInventoryType(prepared.documentDetails.rawKind),
            direction: prepared.lineNature === 'received' ? 'in' : 'out',
            transaction_type: String(prepared.line.documentSubType ?? ''),
            raw_weight: rawWeight,
            purity,
            base_karat: baseKarat,
            converted_weight: (rawWeight * purity) / baseKarat,
            lab_name: readString(prepared.documentDetails.labName, 120),
            stamp_number: readString(prepared.documentDetails.stampNumber, 80),
            total_amount: Math.round(Math.abs(readAmount(prepared.documentDetails.totalAmount) ?? 0)),
            date: documentDateJalali,
            description: readString(prepared.line.description ?? body.description, 500),
            document_id: documentId,
            transaction_id: currentCreatedRecords[index].id,
            customer: customer.id,
            source_inventory_id: readString(prepared.documentDetails.inventorySourceId, 40),
            source_key: sourceKey,
            is_opening_balance: false,
            is_deleted: false,
            created_by: context.user.id,
            updated_by: context.user.id,
          }));
        }
        finalRecords = currentCreatedRecords as unknown as Record<string, unknown>[];
        break;
      } catch (err) {
        for (const record of currentCreatedInventoryRecords) {
          try {
            await writer.collection('metal_inventory').delete(record.id);
          } catch {
            // ignore
          }
        }
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
