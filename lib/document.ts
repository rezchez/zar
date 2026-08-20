import type { RecordModel } from 'pocketbase';

import { mapTransaction, type CustomerTransaction } from '@/lib/transaction';

export type DocumentNature = 'received' | 'paid';

export type DocumentTab =
  | 'general'
  | 'goods'
  | 'currency'
  | 'stone-main'
  | 'base'
  | 'stone'
  | 'expense'
  | 'coin'
  | 'our-claim'
  | 'bank'
  | 'cash-conversion'
  | 'gold-sale'
  | 'check'
  | 'cash'
  | 'itak'
  | 'workmanship'
  | 'raw-gold'
  | 'other';

export const documentTabs: Array<{ id: DocumentTab; label: string }> = [
  { id: 'general', label: 'ش' },
  { id: 'goods', label: 'کالا' },
  { id: 'currency', label: 'ارز' },
  { id: 'stone-main', label: 'سنگ(م)' },
  { id: 'base', label: 'پایه' },
  { id: 'stone', label: 'سنگ' },
  { id: 'expense', label: 'هزینه' },
  { id: 'coin', label: 'سکه' },
  { id: 'our-claim', label: 'طلب ما' },
  { id: 'bank', label: 'حساب بانکی' },
  { id: 'cash-conversion', label: 'پولی کردن' },
  { id: 'gold-sale', label: 'فروش طلا' },
  { id: 'check', label: 'چک' },
  { id: 'cash', label: 'وجه نقد' },
  { id: 'itak', label: 'ایتک' },
  { id: 'workmanship', label: 'کارساخت' },
  { id: 'raw-gold', label: 'طلا خام' },
  { id: 'other', label: 'سایر' },
];

export type DocumentRecord = Omit<CustomerTransaction, 'documentDetails'> & {
  documentNature: DocumentNature;
  documentTab: DocumentTab;
  documentSubType: string;
  documentDateJalali: string;
  settlementMethod: string;
  balanceSource: string;
  documentDetails: Record<string, unknown>;
};

export function mapDocument(record: RecordModel): DocumentRecord {
  const transaction = mapTransaction(record);
  let documentDetails: Record<string, unknown> = {};
  const rawDetails = typeof record.documentDetails === 'string'
    ? record.documentDetails
    : '';

  if (rawDetails) {
    try {
      const parsed = JSON.parse(rawDetails) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        documentDetails = parsed as Record<string, unknown>;
      }
    } catch {
      documentDetails = {};
    }
  }

  return {
    ...transaction,
    documentNature: record.documentNature === 'paid' ? 'paid' : 'received',
    documentTab: typeof record.documentTab === 'string'
      ? record.documentTab as DocumentTab
      : 'general',
    documentSubType: typeof record.documentSubType === 'string'
      ? record.documentSubType
      : '',
    documentDateJalali: typeof record.documentDateJalali === 'string'
      ? record.documentDateJalali
      : '',
    settlementMethod: typeof record.settlementMethod === 'string'
      ? record.settlementMethod
      : '',
    balanceSource: typeof record.balanceSource === 'string'
      ? record.balanceSource
      : '',
    documentDetails,
  };
}

export function serializeDocumentDetails(details: Record<string, unknown>) {
  return JSON.stringify(details).slice(0, 20000);
}
