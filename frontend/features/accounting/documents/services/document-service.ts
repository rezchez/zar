import type PocketBase from 'pocketbase';
import { defaultSettings, normalizeSettings } from '@/lib/settings';

export async function getActiveDocumentPrefix(pb: PocketBase): Promise<string> {
  try {
    const record = await pb.collection('app_settings').getFirstListItem('id != ""');
    if (record) {
      const norm = normalizeSettings(record as Record<string, unknown>);
      return norm.documentNumberPrefix || defaultSettings.documentNumberPrefix;
    }
  } catch {
    // ignore
  }
  return defaultSettings.documentNumberPrefix;
}

export async function getNextDocumentSequenceForCustomer(
  pb: PocketBase,
  customerId: string,
): Promise<number> {
  if (!customerId) return 1;

  try {
    const records = await pb.collection('transactions').getFullList({
      filter: pb.filter('customer = {:customerId} && is_deleted = false', { customerId }),
      sort: '-created',
    });

    let maxSequence = 0;

    for (const record of records) {
      if (typeof record.documentSequence === 'number' && Number.isFinite(record.documentSequence) && record.documentSequence > 0) {
        if (record.documentSequence > maxSequence) {
          maxSequence = record.documentSequence;
        }
      } else {
        const raw = String(record.documentNumber ?? '');
        const match = raw.match(/(\d+)$/);
        if (match) {
          const val = Number(match[1]);
          if (Number.isInteger(val) && val > maxSequence) {
            maxSequence = val;
          }
        }
      }
    }

    return maxSequence + 1;
  } catch {
    return 1;
  }
}

export function buildDocumentNumber(
  prefix: string,
  sequence: number,
): string {
  const p = (prefix || defaultSettings.documentNumberPrefix).trim();
  return `${p}${sequence}`;
}

export async function getNextDocumentNumber(
  pb: PocketBase,
  customerId: string,
): Promise<{ prefix: string; sequence: number; documentNumber: string }> {
  const prefix = await getActiveDocumentPrefix(pb);
  const sequence = await getNextDocumentSequenceForCustomer(pb, customerId);
  const documentNumber = buildDocumentNumber(prefix, sequence);
  return { prefix, sequence, documentNumber };
}

export {
  ZF_DOCUMENT_NUMBER_REGEX,
  isValidZfDocumentNumber,
  generateZfDocumentNumber,
  generateUniqueZfDocumentNumber,
} from '@/lib/document-number';

import type { RecordModel } from 'pocketbase';
import { mapCustomer, type Customer } from '@/lib/customer';
import type { DocumentNature } from '@/lib/document';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { getLineDocumentTypeLabel } from '../utils/document-helpers';

export type RecentDocumentItem = {
  documentId: string;
  documentNumber: string;
  documentSequence?: number;
  documentDateJalali: string;
  documentNature: 'received' | 'paid';
  status: string;
  customerId: string;
  customerName: string;
  customerCode: string | number;
  customer: Customer | null;
  totalGoldWeight: number;
  totalRialAmount: number;
  linesCount: number;
  created: string;
  lines: DocumentLine[];
};

export function transactionRecordToDocumentLine(
  record: Record<string, unknown> | RecordModel,
): DocumentLine {
  let details: DetailState = {
    metalType: 'gold',
    rawKind: 'molten',
    rawWeight: '',
    purity: '',
    calculationMethod: 'weight',
    metalPriceType: 'gram18',
    metalPrice: '',
    totalAmount: '',
    labName: '',
    stampNumber: '',
    currencyUnit: '',
    currencyQuantity: '',
    currencyUnitPrice: '',
    currencyTotalAmount: '',
    unsettledTrade: false,
    currencyTradeId: '',
    settlementCurrencyUnit: '',
    settlementQuantity: '',
    settlesTradeId: '',
    inventorySourceId: '',
  };

  const rawDetails = record.documentDetails;
  if (typeof rawDetails === 'string' && rawDetails.trim()) {
    try {
      const parsed = JSON.parse(rawDetails);
      if (parsed && typeof parsed === 'object') {
        details = { ...details, ...parsed };
      }
    } catch {}
  } else if (rawDetails && typeof rawDetails === 'object') {
    details = { ...details, ...(rawDetails as object) };
  }

  const goldAmount = typeof record.goldAmount === 'number' ? record.goldAmount : 0;
  const rialAmount = typeof record.rialAmount === 'number' ? record.rialAmount : 0;

  if (!details.rawWeight && goldAmount !== 0) {
    details.rawWeight = String(Math.abs(goldAmount));
  }
  if (!details.totalAmount && rialAmount !== 0) {
    details.totalAmount = String(Math.abs(rialAmount));
  }

  const nature = (record.documentNature === 'paid' ? 'paid' : 'received') as DocumentNature;
  const tab = (typeof record.documentTab === 'string' ? record.documentTab : 'raw-gold') as DocumentLine['documentTab'];
  const subType = typeof record.documentSubType === 'string' ? record.documentSubType : '';
  const desc = typeof record.description === 'string' ? record.description : '';

  const label = (details as any).documentTypeLabel || getLineDocumentTypeLabel(
    nature,
    tab,
    details.rawKind,
    details.unsettledTrade,
    (details as any).refiningOpKind,
    (details as any).workmanshipOptionId,
    (details as any).workmanshipSubType,
  );

  return {
    id: String(record.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2))),
    documentNature: nature,
    documentTab: tab,
    sourceTab: (details as any).sourceTab || tab,
    documentSubType: subType,
    documentTypeLabel: label,
    converted750: details.convertedWeight
      ? Number(details.convertedWeight)
      : (goldAmount !== 0 ? Math.abs(goldAmount) : undefined),
    settlementMethod: (record.settlementMethod || 'weight') as DocumentLine['settlementMethod'],
    balanceSource: 'current',
    description: desc,
    details,
  };
}

export async function getRecentDocuments(
  pb: PocketBase,
  limit = 10,
): Promise<RecentDocumentItem[]> {
  try {
    const listResult = await pb.collection('transactions').getList(1, 200, {
      filter: 'is_deleted = false && (transactionType = "document" || documentId != "")',
      sort: '-created',
      expand: 'customer',
    });

    const docMap = new Map<string, RecentDocumentItem>();

    for (const record of listResult.items) {
      const docId = String(record.documentId || record.documentNumber || record.id);
      if (!docId) continue;

      const line = transactionRecordToDocumentLine(record);
      (line as any).documentLineNumber = typeof record.documentLineNumber === 'number' ? record.documentLineNumber : 1;
      const gold = Math.abs(Number(record.goldAmount) || 0);
      const rial = Math.abs(Number(record.rialAmount) || 0);

      if (!docMap.has(docId)) {
        if (docMap.size >= limit) {
          continue;
        }

        const customerRecord = record.expand?.customer as RecordModel | undefined;
        let customer: Customer | null = null;
        if (customerRecord) {
          try {
            customer = mapCustomer(pb, customerRecord);
          } catch {
            customer = {
              id: customerRecord.id || '',
              name: (customerRecord as any).name || '',
              customerCode: (customerRecord as any).customerCode || '',
            } as any;
          }
        }
        const customerName = customer?.name || String(record.expand?.customer?.name || record.customerCode || 'عمومی');
        const customerCode = customer?.customerCode ?? record.expand?.customer?.customerCode ?? record.customerCode ?? '';

        docMap.set(docId, {
          documentId: String(record.documentId || record.id),
          documentNumber: String(record.documentNumber ?? ''),
          documentSequence: typeof record.documentSequence === 'number' ? record.documentSequence : undefined,
          documentDateJalali: String(record.documentDateJalali ?? ''),
          documentNature: record.documentNature === 'paid' ? 'paid' : 'received',
          status: String(record.status || 'posted'),
          customerId: String(record.customer || ''),
          customerName,
          customerCode,
          customer,
          totalGoldWeight: gold,
          totalRialAmount: rial,
          linesCount: 1,
          created: String(record.created || ''),
          lines: [line],
        });
      } else {
        const existingDoc = docMap.get(docId)!;
        existingDoc.lines.push(line);
        existingDoc.linesCount += 1;
        existingDoc.totalGoldWeight += gold;
        existingDoc.totalRialAmount += rial;
      }
    }

    for (const doc of docMap.values()) {
      doc.lines.sort((a, b) => ((a as any).documentLineNumber || 0) - ((b as any).documentLineNumber || 0));
    }

    return Array.from(docMap.values()).slice(0, limit);
  } catch (err) {
    console.error('Failed to get recent documents:', err);
    return [];
  }
}


