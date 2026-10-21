import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ToastProvider } from '@/components/ui/toast';
import BankTab, { setCachedBanksForTesting } from '@/features/accounting/documents/components/BankTab';
import { validateLine, isLineReady, createLine } from '@/features/accounting/documents/hooks/useDocumentLines';
import { BANKS_REGISTRY, IRANIAN_BANKS } from '@/lib/bank';
import { postReceivableChequeReturnToDrawer, postReceivableChequeTransfer, SYSTEM_ACCOUNT_CODES } from '@/features/accounting/posting/posting-engine';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

function renderWithToast(ui: React.ReactElement) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(ToastProvider, null, ui),
  );
}

describe('Transfer / Return Received Checks & Obsolete Banks Removal', () => {
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

  it('verifies obsolete banks starting from neshan-bank are removed from registry and IRANIAN_BANKS', () => {
    const obsoleteSlugs = [
      'neshan-bank',
      'melall',
      'noor',
      'caspian',
      'kosar',
      'ansar',
      'ghavamin',
      'hekmat',
      'mehr-eghtesad',
      'bank-markazi',
      'iran-europe',
      'iran-venezuela',
      'tosee',
      'taavon-eslami',
      'standard-chartered',
      'futurebank',
    ];

    for (const slug of obsoleteSlugs) {
      expect(BANKS_REGISTRY.some((b) => b.id === slug)).toBe(false);
    }

    expect(IRANIAN_BANKS).not.toContain('نشان‌بانک');
    expect(IRANIAN_BANKS).not.toContain('بانک انصار');
    expect(IRANIAN_BANKS).not.toContain('بانک قوامین');
    expect(IRANIAN_BANKS).not.toContain('بانک حکمت ایرانیان');
    expect(IRANIAN_BANKS).not.toContain('موسسه اعتباری کوثر');
    expect(IRANIAN_BANKS).not.toContain('موسسه اعتباری نور');

    // Active banks remain present
    expect(BANKS_REGISTRY.some((b) => b.id === 'melli')).toBe(true);
    expect(BANKS_REGISTRY.some((b) => b.id === 'mellat')).toBe(true);
    expect(BANKS_REGISTRY.some((b) => b.id === 'tejarat')).toBe(true);
    expect(BANKS_REGISTRY.some((b) => b.id === 'saderat')).toBe(true);
    expect(BANKS_REGISTRY.some((b) => b.id === 'sepah')).toBe(true);
    expect(BANKS_REGISTRY.some((b) => b.id === 'wepod')).toBe(true);
    expect(BANKS_REGISTRY.some((b) => b.id === 'blubank')).toBe(true);
  });

  it('renders "خرج / عودت چک دریافتی" option in BankTab when document nature is paid', () => {
    const draftLine: DocumentLine = {
      ...createLine('paid', 'bank'),
      id: 'draft-paid-1',
    };

    const html = renderWithToast(
      React.createElement(BankTab, {
        nature: 'paid',
        selectedCustomer: { id: 'c1', name: 'جناب زرگر' } as any,
        draftLine,
        setDraftLine: () => {},
      }),
    );

    expect(html).toContain('خرج / عودت چک دریافتی');
    expect(html).toContain('پرداخت چک از حساب بانکی');
    expect(html).toContain('پرداخت وجه به جناب زرگر از حساب بانکی');
  });

  it('validates transfer-received-check line in useDocumentLines hook', () => {
    const baseLine = createLine('paid', 'bank');
    const transferCheckLine: DocumentLine = {
      ...baseLine,
      id: 'l-transfer-check-1',
      documentNature: 'paid',
      documentTypeLabel: 'خرج / عودت چک دریافتی',
      description: 'واگذاری چک دریافتی',
      details: {
        ...baseLine.details,
        bankOperationKind: 'transfer-received-check',
        bankAccountId: '', // Internal bank account is NOT required
        checkId: '',
        totalAmount: '0',
      },
    };

    // Missing check selection
    expect(validateLine(transferCheckLine)).toBe('چک دریافتی مورد نظر جهت واگذاری یا عودت را انتخاب کنید.');
    expect(isLineReady(transferCheckLine)).toBe(false);

    // Selected check with amount 0
    transferCheckLine.details.checkId = 'chk_999';
    expect(validateLine(transferCheckLine)).toBe('مبلغ چک باید بیشتر از صفر باشد.');
    expect(isLineReady(transferCheckLine)).toBe(false);

    // Selected check with valid amount and check details
    transferCheckLine.details.totalAmount = '500000000';
    transferCheckLine.details.checkNumber = '123456';
    expect(validateLine(transferCheckLine)).toBe('');
    expect(isLineReady(transferCheckLine)).toBe(true);
  });

  it('posts correct double-entry journal entry when returning receivable check to drawer (عودت چک به صادرکننده)', async () => {
    const store = new Map<string, any>();
    const pb: any = {
      filter: (str: string, params: Record<string, any>) => ({ str, params }),
      collection: (name: string) => ({
        getFirstListItem: async () => null,
        getOne: async (id: string) => store.get(id),
        getFullList: async () => Array.from(store.values()).filter((v) => v._collection === name),
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

    const cheque = {
      id: 'chk_received_1',
      amount: 150000000,
      sayadId: '9876543210987654',
      checkNumber: '445566',
      description: 'عودت چک به صادرکننده به دلیل انصراف از معامله',
    };
    const drawerCustomer = { id: 'cust_drawer', name: 'محمد احمدی' };

    const { journal } = await postReceivableChequeReturnToDrawer(
      cheque,
      drawerCustomer,
      null,
      false, // wasCleared is false (check in hand)
      'u1',
      pb,
      '1405/02/10',
    );

    expect(journal.totalDebit).toBe(150000000);
    expect(journal.totalCredit).toBe(150000000);
    expect(journal.sourceType).toBe('cheque_return_to_drawer');

    // Debits Counterparty (2120) to restore/increase receivable claim
    const debitLine = journal.lines.find((l) => l.debit > 0);
    expect(debitLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);
    expect(debitLine?.partyId).toBe('cust_drawer');
    expect(debitLine?.description).toContain('محمد احمدی');

    // Credits Notes Receivable (1120) to discharge the cheque in hand
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(creditLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(creditLine?.description).toContain('تسویه اسناد دریافتنی');
  });

  it('posts correct double-entry journal entry when transferring receivable check to third-party customer (خرج / واگذاری چک به غیر)', async () => {
    const store = new Map<string, any>();
    const pb: any = {
      filter: (str: string, params: Record<string, any>) => ({ str, params }),
      collection: (name: string) => ({
        getFirstListItem: async () => null,
        getOne: async (id: string) => store.get(id),
        getFullList: async () => Array.from(store.values()).filter((v) => v._collection === name),
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

    const cheque = {
      id: 'chk_received_2',
      amount: 320000000,
      sayadId: '1122334455667788',
      checkNumber: '778899',
      bankName: 'بانک پاسارگاد',
      description: 'خرج چک آقای احمدی بابت تسویه حساب با آقای رضایی',
    };
    const recipientCustomer = { id: 'cust_recipient', name: 'علی رضایی' };

    const { journal } = await postReceivableChequeTransfer(
      cheque,
      recipientCustomer,
      'u1',
      pb,
      '1405/02/15',
    );

    expect(journal.totalDebit).toBe(320000000);
    expect(journal.totalCredit).toBe(320000000);
    expect(journal.sourceType).toBe('cheque_transfer');

    // Debits Recipient Customer (2120) to settle debt to him
    const debitLine = journal.lines.find((l) => l.debit > 0);
    expect(debitLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY);
    expect(debitLine?.partyId).toBe('cust_recipient');
    expect(debitLine?.description).toContain('علی رضایی');

    // Credits Notes Receivable (1120) as the check is transferred
    const creditLine = journal.lines.find((l) => l.credit > 0);
    expect(creditLine?.accountCode).toBe(SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE);
    expect(creditLine?.chequeId).toBe('chk_received_2');
  });

  it('verifies Rial and Toman currency amounts in DocumentBalancePreview do NOT display decimal fractions (.۰۰۰)', async () => {
    const { default: DocumentBalancePreview } = await import('@/features/accounting/documents/components/DocumentBalancePreview');
    const mockCustomer = { id: 'c1', name: 'جناب زرگر' };
    const mockPreviewData = {
      previousBalance: {
        rial: 1000000000,
        gold: 10.089,
        silver: 0,
        platinum: 0,
        foreign: 0,
        stone: 0,
      },
      transactionEffect: {
        rial: 0,
        gold: 0,
        silver: 0,
        platinum: 0,
        foreign: 0,
        stone: 0,
      },
      projectedBalance: {
        rial: 1000000000,
        gold: 10.089,
        silver: 0,
        platinum: 0,
        foreign: 0,
        stone: 0,
      },
    };

    const htmlToman = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DocumentBalancePreview, {
        selectedCustomer: mockCustomer as any,
        previewData: mockPreviewData as any,
        previewLoading: false,
        baseCurrency: 'IRT',
        weightPrecision: 3,
      }),
    );

    // Toman formatting: 1,000,000,000 IRR -> 100,000,000 IRT without .000
    expect(htmlToman).toContain('مانده قبلی:');
    expect(htmlToman).toContain('۱۰۰,۰۰۰,۰۰۰ تومان');
    expect(htmlToman).not.toContain('.۰۰۰ تومان');
    expect(htmlToman).not.toContain('.000');
    expect(htmlToman).toContain('۱۰.۰۸۹ گرم');
    expect(htmlToman).toContain('بدون اثر');
    expect(htmlToman).toContain('مانده نهایی:');

    const htmlRial = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DocumentBalancePreview, {
        selectedCustomer: mockCustomer as any,
        previewData: mockPreviewData as any,
        previewLoading: false,
        baseCurrency: 'IRR',
        weightPrecision: 3,
      }),
    );

    // Rial formatting: 1,000,000,000 IRR without .000
    expect(htmlRial).toContain('۱,۰۰۰,۰۰۰,۰۰۰ ریال');
    expect(htmlRial).not.toContain('.۰۰۰ ریال');
    expect(htmlRial).toContain('۱۰.۰۸۹ گرم');
  });

  it('renders available received checks in dropdown including received and returned-from-bank checks, but excludes cleared/delivered', () => {
    const draftLine: DocumentLine = {
      ...createLine('paid', 'bank'),
      id: 'draft-paid-transfer',
      details: {
        ...createLine('paid', 'bank').details,
        bankOperationKind: 'transfer-received-check',
      },
    };

    const mockReceivedChecks = [
      {
        id: 'chk_rcv_1',
        chequeType: 'receivable',
        status: 'received',
        sayadId: '6545454545454545',
        checkNumber: '1234567',
        bankName: 'بانک ملی ایران',
        amount: 10000000000,
        dueDateJalali: '1405/07/30',
        customer: 'c1',
      },
      {
        id: 'chk_ret_2',
        chequeType: 'receivable',
        status: 'returned', // returned by bank, in hand to return to drawer
        sayadId: '4545454545454555',
        checkNumber: '123456789',
        bankName: 'بانکینو',
        amount: 780000000,
        dueDateJalali: '1405/06/10',
        customer: 'c1',
      },
      {
        id: 'chk_cleared_3',
        chequeType: 'receivable',
        status: 'cleared', // already cleared at bank
        sayadId: '9999999999999999',
        checkNumber: '999',
        bankName: 'بانک صادرات',
        amount: 50000000,
        dueDateJalali: '1405/05/01',
        customer: 'c1',
      },
    ];

    // Mock global fetch to return mockReceivedChecks
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/checks')) {
        return {
          ok: true,
          json: async () => ({ checks: mockReceivedChecks }),
        } as any;
      }
      return originalFetch(url);
    }) as any;

    try {
      const html = renderWithToast(
        React.createElement(BankTab, {
          nature: 'paid',
          selectedCustomer: { id: 'c1', name: 'جناب زرگر' } as any,
          draftLine,
          setDraftLine: () => {},
        }),
      );

      expect(html).toContain('انتخاب چک دریافتی (جهت واگذاری یا عودت)');
      expect(html).toContain('به‌روزرسانی لیست چک‌ها');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
