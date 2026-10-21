import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ToastProvider } from '@/components/ui/toast';
import BankTab, { setCachedBanksForTesting } from '@/features/accounting/documents/components/BankTab';
import { validateLine, isLineReady, createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

function renderWithToast(ui: React.ReactElement) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(ToastProvider, null, ui),
  );
}

describe('BankTab Received Check vs Check Payment (دریافت چک در سند دریافتی)', () => {
  const mockBanks = [
    {
      id: 'bank-1',
      bankName: 'بانک ملت',
      branchName: 'شعبه مرکزی',
      accountNumber: '1234567890',
      currency: 'IRR',
      balance: 1000000000,
      currentBalance: 1000000000,
      hasCheckbook: true,
      hasVirtualCheck: true,
      isActive: true,
    },
  ];

  beforeEach(() => {
    setCachedBanksForTesting(mockBanks as any);
  });

  afterEach(() => {
    setCachedBanksForTesting(null);
  });

  const mockDraftLine: DocumentLine = {
    ...createLine('received', 'bank'),
    id: 'draft-line-1',
  };

  it('renders "دریافت چک" with bank name selection instead of internal bank account when document nature is received', () => {
    const html = renderWithToast(
      React.createElement(BankTab, {
        nature: 'received',
        selectedCustomer: { id: 'c1', name: 'جناب زرگر' } as any,
        draftLine: mockDraftLine,
        setDraftLine: () => {},
      }),
    );

    // In received document, check operation button MUST be "دریافت چک"
    expect(html).toContain('دریافت چک');
    expect(html).not.toContain('پرداخت چک از حساب بانکی');

    // Partner transfer option in received mode
    expect(html).toContain('دریافت وجه از جناب زرگر به حساب بانکی');
    expect(html).not.toContain('پرداخت وجه به جناب زرگر از حساب بانکی');

    // Bank field label should be "نام بانک" and include Iranian banks from BANKS_REGISTRY
    expect(html).toContain('نام بانک');
    expect(html).toContain('بانک ملی ایران');
    expect(html).toContain('بانک صادرات ایران');
    expect(html).not.toContain('حساب بانکی دریافت‌کننده');
    expect(html).not.toContain('حساب بانکی پرداخت‌کننده');
  });

  it('renders "پرداخت چک از حساب بانکی" when document nature is paid', () => {
    const html = renderWithToast(
      React.createElement(BankTab, {
        nature: 'paid',
        selectedCustomer: { id: 'c1', name: 'جناب زرگر' } as any,
        draftLine: {
          ...mockDraftLine,
          documentNature: 'paid',
        },
        setDraftLine: () => {},
      }),
    );

    // In paid document, check operation button MUST be "پرداخت چک از حساب بانکی"
    expect(html).toContain('پرداخت چک از حساب بانکی');
    expect(html).toContain('پرداخت وجه به جناب زرگر از حساب بانکی');
    expect(html).toContain('حساب بانکی پرداخت‌کننده');
    expect(html).not.toContain('دریافت وجه از جناب زرگر به حساب بانکی');
  });

  it('validates check-receipt line using validateLine and isLineReady without requiring bankAccountId', () => {
    const baseBankLine = createLine('received', 'bank');
    const checkReceiptLine: DocumentLine = {
      ...baseBankLine,
      id: 'l-rcv-check-1',
      documentNature: 'received',
      documentTypeLabel: 'دریافت چک',
      description: 'چک مشتری',
      details: {
        ...baseBankLine.details,
        bankOperationKind: 'check-receipt',
        bankAccountId: '', // Internal bank account is NOT required for received checks!
        bankName: '',
        checkNumber: '87654321',
        sayadId: '1234567890123456',
        dueDateJalali: '1405/09/20',
        totalAmount: '250000000',
      },
    };

    // Missing bank name
    expect(validateLine(checkReceiptLine)).toBe('نام بانک صادرکننده چک را انتخاب کنید.');
    expect(isLineReady(checkReceiptLine)).toBe(false);

    // With bank name selected from BANKS_REGISTRY (even without bankAccountId)
    checkReceiptLine.details.bankName = 'بانک ملت';
    expect(validateLine(checkReceiptLine)).toBe('');
    expect(isLineReady(checkReceiptLine)).toBe(true);

    // Missing check number
    checkReceiptLine.details.checkNumber = '';
    expect(validateLine(checkReceiptLine)).toBe('شماره چک الزامی است.');
    expect(isLineReady(checkReceiptLine)).toBe(false);

    // Invalid sayadId
    checkReceiptLine.details.checkNumber = '87654321';
    checkReceiptLine.details.sayadId = '1234';
    expect(validateLine(checkReceiptLine)).toBe('شناسه صیاد باید ۱۶ رقم باشد.');

    // Amount zero
    checkReceiptLine.details.sayadId = '1234567890123456';
    checkReceiptLine.details.totalAmount = '0';
    expect(validateLine(checkReceiptLine)).toBe('مبلغ چک باید بیشتر از صفر باشد.');
  });

  it('posts correct double-entry journal lines for receivable cheque receipt', async () => {
    const store = new Map<string, any>();
    const pb: any = {
      filter: (str: string, params: Record<string, any>) => ({ str, params }),
      collection: (name: string) => ({
        getFirstListItem: async (_filter: any) => {
          for (const val of store.values()) {
            if (val._collection === name) return val;
          }
          return null;
        },
        getOne: async (id: string) => {
          const item = store.get(id);
          if (!item) throw new Error('Not found');
          return item;
        },
        getFullList: async () => {
          const list: any[] = [];
          for (const val of store.values()) {
            if (val._collection === name) list.push(val);
          }
          return list;
        },
        create: async (data: any) => {
          const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const record = { id, ...data, _collection: name };
          store.set(id, record);
          return record;
        },
        update: async (id: string, data: any) => {
          const item = store.get(id) || {};
          const updated = { ...item, ...data };
          store.set(id, updated);
          return updated;
        },
      }),
    };

    const { postReceivableChequeReceipt, SYSTEM_ACCOUNT_CODES } = await import('@/lib/accounting-posting-engine');
    const cheque = {
      id: 'chk_123',
      amount: 250000000,
      sayadId: '1234567890123456',
      checkNumber: '87654321',
      bankName: 'بانک ملت',
      description: 'بابت تسویه فاکتور طلا',
      dueDateJalali: '1405/09/20',
      issueDateJalali: '1405/06/15',
      customer: 'c1',
    };
    const customer = { id: 'c1', name: 'جناب زرگر' };

    const journal = await postReceivableChequeReceipt(cheque, customer, 'u1', pb);

    expect(journal.totalDebit).toBe(250000000);
    expect(journal.totalCredit).toBe(250000000);
    expect(journal.sourceType).toBe('cheque_receive');

    // Debits 1120 Notes Receivable (اسناد دریافتنی)
    const debitLine = journal.lines.find((l) => l.debit > 0);
    expect(debitLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(debitLine?.description).toContain('اسناد دریافتنی');
    expect(debitLine?.description).toContain('بانک ملت');

    // Credits 2120 Counterparty (طرف‌حساب)
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(creditLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);
    expect(creditLine?.description).toContain('جناب زرگر');
  });
});
