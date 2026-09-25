import type { RecordModel } from 'pocketbase';
import {
  emptyCustomerBalances,
  normalizeCurrencyCode,
  type CustomerBalanceValues,
} from '@/lib/customer';

export type TransactionType =
  | 'opening_balance'
  | 'document'
  | 'adjustment'
  | 'reversal';

export type TransactionStatus = 'temporary' | 'final' | 'posted' | 'voided';

export type CustomerTransaction = {
  id: string;
  customerId: string;
  customerCode: number;
  createdBy: string;
  updatedBy: string;
  sourceKey: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  isOpeningBalance: boolean;
  transactionDate: string;
  documentId: string;
  documentSequence?: number;
  documentNumberPrefixSnapshot?: string;
  documentNumber: string;
  description: string;
  goldAmount: number;
  silverAmount: number;
  platinumAmount: number;
  rialAmount: number;
  foreignAmount: number;
  tertiaryAmount: number;
  foreignCurrency: string;
  foreignCurrencySymbol: string;
  tertiaryCurrency: string;
  tertiaryCurrencySymbol: string;
  documentNature: 'received' | 'paid' | '';
  documentTab: string;
  documentSubType: string;
  documentDateJalali: string;
  settlementMethod: string;
  balanceSource: string;
  documentDetails: string;
  documentLineNumber: number;
  created: string;
  updated: string;
};

function readText(record: RecordModel, field: string) {
  return typeof record[field] === 'string' ? record[field] : '';
}

function readNumber(record: RecordModel, field: string) {
  return typeof record[field] === 'number' && Number.isFinite(record[field])
    ? record[field]
    : 0;
}

export function mapTransaction(record: RecordModel): CustomerTransaction {
  return {
    id: record.id,
    customerId: readText(record, 'customer'),
    customerCode: readNumber(record, 'customerCode'),
    createdBy: readText(record, 'createdBy'),
    updatedBy: readText(record, 'updatedBy'),
    sourceKey: readText(record, 'sourceKey'),
    transactionType: readText(record, 'transactionType') as TransactionType,
    status: readText(record, 'status') as TransactionStatus,
    isOpeningBalance: record.isOpeningBalance === true,
    transactionDate: readText(record, 'transactionDate'),
    documentId: readText(record, 'documentId'),
    documentSequence: readNumber(record, 'documentSequence') || undefined,
    documentNumberPrefixSnapshot: readText(record, 'documentNumberPrefixSnapshot') || undefined,
    documentNumber: readText(record, 'documentNumber'),
    description: readText(record, 'description'),
    goldAmount: readNumber(record, 'goldAmount'),
    silverAmount: readNumber(record, 'silverAmount'),
    platinumAmount: readNumber(record, 'platinumAmount'),
    rialAmount: readNumber(record, 'rialAmount'),
    foreignAmount: readNumber(record, 'foreignAmount'),
    tertiaryAmount: readNumber(record, 'tertiaryAmount'),
    foreignCurrency: readText(record, 'foreignCurrency'),
    foreignCurrencySymbol: readText(record, 'foreignCurrencySymbol'),
    tertiaryCurrency: readText(record, 'tertiaryCurrency'),
    tertiaryCurrencySymbol: readText(record, 'tertiaryCurrencySymbol'),
    documentNature: readText(record, 'documentNature') as 'received' | 'paid' | '',
    documentTab: readText(record, 'documentTab'),
    documentSubType: readText(record, 'documentSubType'),
    documentDateJalali: readText(record, 'documentDateJalali'),
    settlementMethod: readText(record, 'settlementMethod'),
    balanceSource: readText(record, 'balanceSource'),
    documentDetails: readText(record, 'documentDetails'),
    documentLineNumber: readNumber(record, 'documentLineNumber'),
    created: readText(record, 'created'),
    updated: readText(record, 'updated'),
  };
}

export function sumPostedTransactions(transactions: CustomerTransaction[]) {
  return transactions
    .filter((transaction) => transaction.status === 'final' || transaction.status === 'posted')
    .reduce(
      (sum, transaction) => ({
        goldAmount: sum.goldAmount + transaction.goldAmount,
        silverAmount: sum.silverAmount + transaction.silverAmount,
        platinumAmount: sum.platinumAmount + transaction.platinumAmount,
        rialAmount: sum.rialAmount + transaction.rialAmount,
        foreignAmount: sum.foreignAmount + transaction.foreignAmount,
        tertiaryAmount: sum.tertiaryAmount + transaction.tertiaryAmount,
      }),
      {
        goldAmount: 0,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 0,
        foreignAmount: 0,
        tertiaryAmount: 0,
      },
    );
}

export function calculateCustomerCurrencyBalances(
  transactions: CustomerTransaction[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const t of transactions) {
    if (t.status !== 'final' && t.status !== 'posted') continue;
    if (t.foreignAmount) {
      const code = normalizeCurrencyCode(t.foreignCurrency || 'USD');
      if (code && code !== 'IRR' && code !== 'IRT') {
        result[code] = (result[code] ?? 0) + t.foreignAmount;
      }
    }
    if (t.tertiaryAmount) {
      const code = normalizeCurrencyCode(t.tertiaryCurrency || '');
      if (code && code !== 'IRR' && code !== 'IRT') {
        result[code] = (result[code] ?? 0) + t.tertiaryAmount;
      }
    }
  }
  return result;
}

export function transactionBalancesToCustomerBalances(
  transactions: CustomerTransaction[],
): CustomerBalanceValues {
  const totals = sumPostedTransactions(transactions);
  const currencyBalances = calculateCustomerCurrencyBalances(transactions);
  return {
    goldBalance: totals.goldAmount,
    silverBalance: totals.silverAmount,
    platinumBalance: totals.platinumAmount,
    rialBalance: totals.rialAmount,
    foreignBalance: totals.foreignAmount,
    tertiaryBalance: totals.tertiaryAmount,
    currencyBalances,
  };
}

export function openingTransactionToCustomerBalances(
  transaction?: CustomerTransaction,
): CustomerBalanceValues {
  if (!transaction) return emptyCustomerBalances();
  return {
    goldBalance: transaction.goldAmount,
    silverBalance: transaction.silverAmount,
    platinumBalance: transaction.platinumAmount,
    rialBalance: transaction.rialAmount,
    foreignBalance: transaction.foreignAmount,
    tertiaryBalance: transaction.tertiaryAmount,
  };
}

export function openingBalanceSourceKey(customerId: string) {
  return `opening:${customerId}`;
}
