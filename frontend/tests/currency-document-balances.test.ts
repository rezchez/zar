import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import React from 'react';
import { ToastProvider } from '@/components/ui/toast';
import { renderToStaticMarkup } from 'react-dom/server';
import { POST as previewBalance } from '@/app/api/transactions/preview-balance/route';
import { POST as saveDocument } from '@/app/api/documents/route';
import { createCurrencyLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import { createSettledCurrencyLines } from '@/features/accounting/documents/utils/currency-lines';
import { getLineCurrencyValues, getLineFinancialValues, sanitizeDocumentLine } from '@/features/accounting/documents/utils/document-helpers';
import { calculateCustomerCurrencyBalances, mapTransaction, sumPostedTransactions } from '@/lib/transaction';
import DocumentBalancePreview from '@/features/accounting/documents/components/DocumentBalancePreview';
import CommittedLinesTable from '@/features/accounting/documents/components/CommittedLinesTable';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import { mapCustomerWithTransactions } from '@/lib/customer-service';
import { sharedMockPb, setMockAuthUser } from './setup';

const originalCollection = sharedMockPb.collection;
let records: Record<string, unknown>[];
const customer = { id: 'currency-customer', name: 'طرف حساب ارزی', customerCode: 11, secondaryCurrency: 'USD' } as Customer;

beforeEach(() => {
  records = [];
  setMockAuthUser({ id: 'currency-admin', name: 'مدیر', email: 'admin@example.test', role: 'admin', status: 'active' });
  sharedMockPb.collection = (name: string) => {
    const collection = originalCollection.call(sharedMockPb, name);
    if (name === 'customers') collection.getOne = async () => customer;
    if (name === 'transactions') collection.getFullList = async () => records;
    return collection;
  };
});
afterEach(() => {
  sharedMockPb.collection = originalCollection;
  setMockAuthUser(null);
});

function trade(unit: string, qty: number, amount: number, nature: 'received' | 'paid' = 'received') {
  const line = createCurrencyLine(nature, unit, 'IRT');
  line.documentSubType = nature === 'received' ? 'currency-purchase' : 'currency-sale';
  line.details = { ...line.details, currencyQuantity: String(qty), currencyTotalAmount: String(amount), currencyUnitPrice: String(amount / qty), baseCurrency: 'IRT' };
  return line;
}
async function preview(lines: DocumentLine[], extra = {}) {
  const response = await previewBalance(new Request('http://localhost/api/transactions/preview-balance', {
    method: 'POST', body: JSON.stringify({ customerId: customer.id, baseCurrency: 'IRT', lines, ...extra }),
  }));
  expect(response.status).toBe(200);
  return (await response.json()).data;
}
function savedRows(lines: DocumentLine[]) {
  return lines.map((line, index) => ({
    ...line, id: `saved-${index}`, transactionType: 'document', status: 'posted', customer: customer.id,
    documentDetails: JSON.stringify(line.details), foreignCurrency: 'USD', foreignCurrencySymbol: '$',
    // Reproduce old rows with the wrong currency metadata and duplicate cash rial amount.
    foreignAmount: line.documentTab === 'cash' ? Number(line.details.totalAmount) : 0,
    rialAmount: line.documentTab === 'cash' ? Number(line.details.totalAmount) * 10 : Number(line.details.currencyTotalAmount) * 10,
  }));
}

describe('Currency document balances', () => {
  it('nets settled USD and EUR purchases to zero foreign effect and retains the exact rial total', async () => {
    const lines = [...createSettledCurrencyLines(trade('USD', 10_000, 2_639_000_000)), ...createSettledCurrencyLines(trade('EUR', 1_000, 294_330_000))];
    const data = await preview(lines);
    expect(data.transactionEffect.rial).toBe(29_333_300_000);
    expect(data.transactionEffect.currencyBalances).toEqual({ USD: 0, EUR: 0 });
    expect(data.projectedBalance.currencyBalances).toEqual({ USD: 0, EUR: 0 });
    const mapped = savedRows(lines).map(mapTransaction);
    expect(calculateCustomerCurrencyBalances(mapped)).toEqual({ USD: 0, EUR: 0 });
    expect(sumPostedTransactions(mapped).rialAmount).toBe(29_333_300_000);
    expect(mapped.map((row) => row.foreignCurrency)).toEqual(['USD', 'USD', 'EUR', 'EUR']);
    expect(getLineCurrencyValues(lines[2]).debit).toBe(1_000);
    expect(getLineCurrencyValues(lines[3]).credit).toBe(1_000);
    expect(getLineFinancialValues(lines[3]).hasValue).toBe(false);
  });

  it('keeps prior and new obligations separate for each currency, including an edit exclusion', async () => {
    records = [
      { id: 'old-usd', status: 'posted', foreignCurrency: 'USD', foreignAmount: 200 },
      { id: 'old-eur', status: 'posted', foreignCurrency: 'EUR', foreignAmount: -50 },
      { id: 'editing-row', documentId: 'editing-doc', status: 'posted', foreignCurrency: 'EUR', foreignAmount: -999 },
      { id: 'draft', status: 'temporary', foreignCurrency: 'EUR', foreignAmount: 888 },
    ];
    const purchase = trade('EUR', 1_000, 294_330_000);
    purchase.details.unsettledTrade = true;
    const sale = trade('USD', 400, 100_000_000, 'paid');
    sale.details.unsettledTrade = true;
    const data = await preview([purchase, sale], { excludeDocumentId: 'editing-doc' });
    expect(data.previousBalance.currencyBalances).toEqual({ USD: 200, EUR: -50 });
    expect(data.transactionEffect.currencyBalances).toEqual({ EUR: -1_000, USD: 400 });
    expect(data.projectedBalance.currencyBalances).toEqual({ EUR: -1_050, USD: 600 });
    const html = renderToStaticMarkup(React.createElement(DocumentBalancePreview, { selectedCustomer: customer, previewData: data, previewLoading: false, baseCurrency: 'IRT' }));
    expect(html).toContain('یورو (EUR)');
    expect(html).toContain('دلار (USD)');
    expect(html).toContain('۱,۰۵۰.۰۰');
    expect(html).toContain('۶۰۰.۰۰');
  });

  it('does not expose a euro-only debt as the customer default dollar balance', () => {
    const transactions = [mapTransaction({ id: 'eur-only', status: 'posted', foreignCurrency: 'EUR', foreignAmount: -1_000 })];
    const mapped = mapCustomerWithTransactions(sharedMockPb as never, customer as never, transactions);
    expect(mapped.foreignBalance).toBe(0);
    expect(mapped.currencyBalances?.EUR).toBe(-1_000);
  });

  it('counts a linked unsettled claim once and a later receipt settles only that currency', async () => {
    const purchase = trade('EUR', 1_000, 294_330_000);
    purchase.details = { ...purchase.details, unsettledTrade: true, linkedLineId: 'claim' };
    const claim = { ...trade('EUR', 1_000, 0, 'paid'), id: 'claim', documentSubType: 'currency-claim', settlementMethod: 'unsettled', details: { ...purchase.details, currencyTotalAmount: '0', linkedLineId: purchase.id } } as DocumentLine;
    const data = await preview([purchase, claim]);
    expect(data.transactionEffect.currencyBalances).toEqual({ EUR: -1_000 });
    records = [{ ...savedRows([claim])[0], foreignAmount: -1_000 }];
    const receipt = createSettledCurrencyLines(trade('EUR', 1_000, 294_330_000))[1];
    receipt.details.isChildLine = false;
    delete receipt.details.linkedLineId;
    const settled = await preview([receipt]);
    expect(settled.transactionEffect.rial).toBe(0);
    expect(settled.projectedBalance.currencyBalances.EUR).toBe(0);
  });

  it('shows currency type for a settled trade even when it has no open foreign balance', () => {
    const line = trade('EUR', 1_000, 294_330_000);
    const html = renderToStaticMarkup(React.createElement(ToastProvider, null, React.createElement(CommittedLinesTable, {
      committedLines: [line], isLinesPinned: false, onTogglePin() {}, onSave: async () => {}, onCommitDraftLine() {},
      selectedCustomer: customer, effectiveDocumentNumberDisplay: 'ZF12345678', documentDateJalali: '1405/08/04',
      hasAssayOrStamp: false, hasFinancialAmounts: true, onEditLine() {}, onRemoveLine() {}, onHawalaLine() {},
    })));
    expect(html).toContain('نوع ارز');
    expect(html).toContain('EUR');
    expect(html).not.toContain('USD');
  });

  it('preserves the currency and settlement links while preparing a loaded row for editing', () => {
    const [purchase, cash] = createSettledCurrencyLines(trade('EUR', 1_000, 294_330_000));
    const cleaned = sanitizeDocumentLine(purchase, 'currency', 'IRT', 750);
    const cleanedCash = sanitizeDocumentLine(cash, 'cash', 'IRT', 750);
    expect(cleaned.details.hasChildLines).toBe(true);
    expect(cleanedCash.details.isChildLine).toBe(true);
    const [edited, editedCash] = createSettledCurrencyLines({ ...cleaned, details: { ...cleaned.details, currencyQuantity: '1200' } }, cleanedCash.id);
    expect(editedCash.id).toBe(cash.id);
    expect(getLineCurrencyValues(edited).debit).toBe(1200);
    expect(getLineCurrencyValues(editedCash).credit).toBe(1200);
  });

  it('settles sales symmetrically and keeps the foreign cash amount out of rial totals', async () => {
    const lines = createSettledCurrencyLines(trade('GBP', 250.5, 70_000_000, 'paid'));
    const data = await preview(lines);
    expect(data.transactionEffect.currencyBalances).toEqual({ GBP: 0 });
    expect(data.transactionEffect.rial).toBe(-700_000_000);
    expect(getLineCurrencyValues(lines[0]).credit).toBe(250.5);
    expect(getLineCurrencyValues(lines[1]).debit).toBe(250.5);
  });

  it('persists both settlement rows in their own currency with integer IRR amounts', async () => {
    const created: Record<string, unknown>[] = [];
    const collectionBeforeSave = sharedMockPb.collection;
    sharedMockPb.collection = (name: string) => {
      const collection = collectionBeforeSave.call(sharedMockPb, name);
      if (name === 'transactions') {
        collection.getFirstListItem = async () => null;
        collection.create = async (row: Record<string, unknown>) => {
          created.push(row);
          return { id: `saved-${created.length}`, ...row };
        };
      }
      return collection;
    };
    const lines = createSettledCurrencyLines(trade('EUR', 1_000, 294_330_000));
    const response = await saveDocument(new Request('http://localhost/api/documents', {
      method: 'POST', body: JSON.stringify({ customerId: customer.id, documentId: 'currency-save', documentNumber: 'ZF12345678', documentDateJalali: '1405/08/04', status: 'temporary', baseCurrency: 'IRT', lines: lines.map((line) => ({
        ...line, documentDetails: { ...line.details, clientLineId: line.id }, goldAmount: 0, silverAmount: 0, platinumAmount: 0, rialAmount: 0, foreignAmount: 0, tertiaryAmount: 0,
      })) }),
    }));
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(201);
    expect(created.map((row) => row.foreignCurrency)).toEqual(['EUR', 'EUR']);
    expect(created.map((row) => row.foreignAmount)).toEqual([-1_000, 1_000]);
    expect(created.map((row) => row.rialAmount)).toEqual([2_943_300_000, 0]);
    expect(created.every((row) => Number.isInteger(row.rialAmount))).toBe(true);
  });
});
