import { describe, expect, it, beforeEach } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ToastProvider } from '@/components/ui/toast';
import BankOperationModal, {
  getEntityCurrencyLabel,
  formatEntityAmount,
  isSameCurrency,
  normalizeCurrencyCode,
} from '@/features/banks/components/BankOperationModal';
import BankingAccountsClient, { BankActionMenu } from '@/features/banks/components/BankingAccountsClient';
import BankAccountsListClient from '@/features/banks/components/BankAccountsListClient';
import BankTab from '@/features/accounting/documents/components/BankTab';
import { POST as transferBank } from '@/app/api/banks/transfer/route';
import { setMockAuthUser, sharedMockPb } from './setup';

function renderWithToast(ui: React.ReactElement) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(ToastProvider, null, ui),
  );
}

describe('Bank Operations & Transfers (واریز، برداشت، انتقال حساب به حساب)', () => {
  beforeEach(() => {
    setMockAuthUser({
      id: 'admin1',
      name: 'Admin User',
      email: 'admin@zarfolio.io',
      role: 'admin',
      status: 'active',
    });
  });

  const mockBankAccounts = [
    {
      id: 'bank-1',
      bankName: 'بانک ملت',
      branchName: 'شعبه مرکزی',
      accountNumber: '1234567890',
      currencyId: 'curr-irr',
      currencyName: 'ریال',
      currencyCode: 'IRR',
      currencySymbol: 'ریال',
      openingBalance: 10000000,
      balance: 10000000,
      openingBalanceDate: '1403/01/01',
      hasCheckbook: true,
    },
    {
      id: 'bank-2',
      bankName: 'بانک ملی',
      branchName: 'شعبه بازار',
      accountNumber: '0987654321',
      currencyId: 'curr-irr',
      currencyName: 'ریال',
      currencyCode: 'IRR',
      currencySymbol: 'ریال',
      openingBalance: 5000000,
      balance: 5000000,
      openingBalanceDate: '1403/01/01',
      hasVirtualCheck: true,
    },
  ];

  it('renders BankingAccountsClient with "عملیات بانکی" button in header, and BankAccountsListClient with initial inventory back button', () => {
    // 1. Dedicated Banking Accounts component (in Banking section /dashboard/banks)
    const bankingHtml = renderWithToast(
      React.createElement(BankingAccountsClient, {
        initialAccounts: mockBankAccounts,
      }),
    );

    expect(bankingHtml).toContain('عملیات بانکی');
    expect(bankingHtml).toContain('بانک ملت');
    expect(bankingHtml).toContain('بانک ملی');
    expect(bankingHtml).not.toContain('مشاهده در درختواره (۱۱۱۰)');
    expect(bankingHtml).toContain('aria-label="مشاهده در درختواره حساب‌ها (۱۱۱۰)"');
    expect(bankingHtml).toContain('aria-label="افزودن حساب بانکی جدید"');
    expect(bankingHtml).toContain('aria-label="به‌روزرسانی لیست"');
    expect(bankingHtml).not.toContain('>افزودن حساب بانکی جدید<');
    expect(bankingHtml).not.toContain('>به‌روزرسانی<');
    expect(bankingHtml).toContain('تاریخ ایجاد حساب:');
    expect(bankingHtml).not.toContain('تاریخ موجودی:');
    expect(bankingHtml).not.toContain('>موجودی اولیه<');
    expect(bankingHtml).toContain('موجودی فعلی');
    expect(bankingHtml).not.toContain('·');
    expect(bankingHtml).toContain('دسته چک فیزیکی');
    expect(bankingHtml).toContain('دسته چک دیجیتال');
    // Banking section must NOT have back button to initial inventory
    expect(bankingHtml).not.toContain('href="/dashboard/documents/initial-inventory"');

    const menuHtml = renderWithToast(
      React.createElement(BankActionMenu, {
        account: mockBankAccounts[0],
        onAction: () => {},
        defaultOpen: true,
      }),
    );
    expect(menuHtml).toContain('ویرایش حساب بانکی');
    expect(menuHtml).not.toContain('ویرایش حساب بانکی و موجودی');

    // 2. Initial Inventory Bank component (in /dashboard/documents/initial-inventory/bank)
    const initialInvHtml = renderWithToast(
      React.createElement(BankAccountsListClient, {
        initialAccounts: mockBankAccounts,
      }),
    );
    // Initial inventory section MUST have back button to /dashboard/documents/initial-inventory
    expect(initialInvHtml).toContain('href="/dashboard/documents/initial-inventory"');
    expect(initialInvHtml).toContain('موجودی اولیه');
  });

  it('renders BankOperationModal with the 3 operations: انتقال حساب به حساب، واریز صندوق به بانک، برداشت بانک به صندوق', () => {
    const html = renderWithToast(
      React.createElement(BankOperationModal, {
        isOpen: true,
        onClose: () => {},
        bankAccounts: mockBankAccounts,
        initialOperation: 'bank-to-bank',
      }),
    );

    expect(html).toContain('عملیات بانکی');
    expect(html).toContain('انتقال حساب به حساب');
    expect(html).toContain('واریز صندوق به بانک');
    expect(html).toContain('برداشت بانک به صندوق');
    expect(html).toContain('حساب بانکی مبدأ');
    expect(html).toContain('حساب بانکی مقصد');
    expect(html).toContain('ثبت عملیات بانکی');
  });

  it('verifies BankTab in DocumentForm only contains customer document operations and has guidance link', () => {
    const mockDraftLine = {
      id: 'line-1',
      sourceTab: 'bank',
      amount: 0,
      description: '',
      details: {},
    };

    const html = renderWithToast(
      React.createElement(BankTab, {
        nature: 'paid',
        selectedCustomer: { id: 'c1', name: 'جناب زرگر' } as any,
        draftLine: mockDraftLine as any,
        setDraftLine: () => {},
      }),
    );

    // Customer operations must exist
    expect(html).toContain('پرداخت چک از حساب بانکی');
    expect(html).toContain('پرداخت وجه به جناب زرگر از حساب بانکی');

    // Internal operations must NOT be present in DocumentForm tab
    expect(html).not.toContain('واریز وجه نقد از صندوق به حساب بانکی');
    expect(html).not.toContain('برداشت وجه از حساب بانکی به صندوق');

    // Guidance banner linking to bank section must be present
    expect(html).toContain('جهت انتقال حساب به حساب یا واریز و برداشت وجه با صندوق‌ها، به بخش «بانک» مراجعه نمایید.');
    expect(html).toContain('رفتن به عملیات بانکی');
  });

  it('validates POST /api/banks/transfer requirements for operations', async () => {
    // 1. Invalid operation kind rejected
    const reqInvalidKind = new Request('http://localhost/api/banks/transfer', {
      method: 'POST',
      body: JSON.stringify({ kind: 'invalid-kind', amount: 1000 }),
    });
    const resInvalidKind = await transferBank(reqInvalidKind);
    expect(resInvalidKind.status).toBe(400);

    // 2. Negative amount rejected
    const reqNegAmount = new Request('http://localhost/api/banks/transfer', {
      method: 'POST',
      body: JSON.stringify({ kind: 'bank-to-bank', amount: -100, sourceBankId: 'b1', destinationBankId: 'b2' }),
    });
    const resNegAmount = await transferBank(reqNegAmount);
    expect(resNegAmount.status).toBe(400);

    // 3. Same source and destination rejected for bank-to-bank
    const reqSameBank = new Request('http://localhost/api/banks/transfer', {
      method: 'POST',
      body: JSON.stringify({ kind: 'bank-to-bank', amount: 500, sourceBankId: 'b1', destinationBankId: 'b1' }),
    });
    const resSameBank = await transferBank(reqSameBank);
    expect(resSameBank.status).toBe(400);

    // 4. Missing destination bank for cash-to-bank rejected
    const reqMissingDest = new Request('http://localhost/api/banks/transfer', {
      method: 'POST',
      body: JSON.stringify({ kind: 'cash-to-bank', amount: 500 }),
    });
    const resMissingDest = await transferBank(reqMissingDest);
    expect(resMissingDest.status).toBe(400);

    // 5. Missing source bank for bank-to-cash rejected
    const reqMissingSource = new Request('http://localhost/api/banks/transfer', {
      method: 'POST',
      body: JSON.stringify({ kind: 'bank-to-cash', amount: 500 }),
    });
    const resMissingSource = await transferBank(reqMissingSource);
    expect(resMissingSource.status).toBe(400);
  });

  it('correctly matches and distinguishes currencies with isSameCurrency and normalizeCurrencyCode', () => {
    // Both IRR
    expect(isSameCurrency({ currencyCode: 'IRR' }, { currencyCode: 'IRR' })).toBe(true);
    expect(isSameCurrency({ currencyName: 'ریال' }, { currencySymbol: 'ریال' })).toBe(true);
    expect(isSameCurrency({ currencyCode: 'IRR' }, { currencyName: 'ریال ایران' })).toBe(true);

    // Both IRT
    expect(isSameCurrency({ currencyCode: 'IRT' }, { currencyCode: 'IRT' })).toBe(true);
    expect(isSameCurrency({ currencyName: 'تومان' }, { currencySymbol: 'تومان' })).toBe(true);
    expect(isSameCurrency({ currencyCode: 'IRT' }, { currencyName: 'تومان' })).toBe(true);

    // IRR vs IRT must NOT match
    expect(isSameCurrency({ currencyCode: 'IRR' }, { currencyCode: 'IRT' })).toBe(false);
    expect(isSameCurrency({ currencyName: 'ریال' }, { currencyName: 'تومان' })).toBe(false);

    // Foreign currencies
    expect(isSameCurrency({ currencyCode: 'USD' }, { currencyCode: 'USD' })).toBe(true);
    expect(isSameCurrency({ currencyCode: 'USD' }, { currencyCode: 'EUR' })).toBe(false);
    expect(isSameCurrency({ currencyCode: 'USD' }, { currencyCode: 'IRR' })).toBe(false);

    // Identical currencyId
    expect(isSameCurrency({ currencyId: 'cur-123' }, { currencyId: 'cur-123' })).toBe(true);

    // Null / Undefined
    expect(isSameCurrency(null, { currencyCode: 'IRR' })).toBe(false);
    expect(isSameCurrency({ currencyCode: 'IRR' }, undefined)).toBe(false);
  });

  it('renders BankOperationModal and filters destination accounts by currency', () => {
    const multiCurrencyBanks = [
      {
        id: 'bank-irr-1',
        bankName: 'بانک ملت',
        branchName: 'شعبه مرکزی',
        accountNumber: '111111',
        currencyId: 'curr-irr',
        currencyName: 'ریال',
        currencyCode: 'IRR',
        currencySymbol: 'ریال',
        balance: 10000000,
        openingBalance: 10000000,
        openingBalanceDate: '1403/01/01',
      },
      {
        id: 'bank-irr-2',
        bankName: 'بانک صادرات',
        branchName: 'شعبه بازار',
        accountNumber: '222222',
        currencyId: 'curr-irr',
        currencyName: 'ریال',
        currencyCode: 'IRR',
        currencySymbol: 'ریال',
        balance: 20000000,
        openingBalance: 20000000,
        openingBalanceDate: '1403/01/01',
      },
      {
        id: 'bank-usd-3',
        bankName: 'بانک پاسارگاد (ارزی)',
        branchName: 'شعبه بین‌الملل',
        accountNumber: '333333',
        currencyId: 'curr-usd',
        currencyName: 'دلار',
        currencyCode: 'USD',
        currencySymbol: '$',
        balance: 5000,
        openingBalance: 5000,
        openingBalanceDate: '1403/01/01',
      },
    ];

    // Bank-to-bank with bank-irr-1 as source
    const html = renderWithToast(
      React.createElement(BankOperationModal, {
        isOpen: true,
        onClose: () => {},
        bankAccounts: multiCurrencyBanks,
        preselectedBankId: 'bank-irr-1',
        initialOperation: 'bank-to-bank',
      }),
    );

    // Destination dropdown section must contain bank-irr-2 (same currency IRR)
    const destinationSection = html.split('حساب بانکی مقصد')[1] || '';
    expect(destinationSection).toContain('بانک صادرات - 222222');
    // Destination dropdown must NOT contain bank-usd-3 (different currency USD)
    expect(destinationSection).not.toContain('بانک پاسارگاد (ارزی)');

    // Bank-to-bank with bank-usd-3 as source (only 1 USD account exists)
    const htmlUsd = renderWithToast(
      React.createElement(BankOperationModal, {
        isOpen: true,
        onClose: () => {},
        bankAccounts: multiCurrencyBanks,
        preselectedBankId: 'bank-usd-3',
        initialOperation: 'bank-to-bank',
      }),
    );

    const destinationSectionUsd = htmlUsd.split('حساب بانکی مقصد')[1] || '';
    // Warning banner should be rendered indicating no matching destination account found
    expect(htmlUsd).toContain('واحد پولی یکسان');
    expect(htmlUsd).toContain('یافت نشد.');
    // Neither IRR account should be in destination options for USD source
    expect(destinationSectionUsd).not.toContain('بانک صادرات');
    expect(destinationSectionUsd).not.toContain('بانک ملت');
  });

  it('rejects transfers between different currencies in POST /api/banks/transfer', async () => {
    const originalCollection = sharedMockPb.collection;

    const mockRecords: Record<string, Record<string, any>> = {
      bank_accounts: {
        'b-irr': { id: 'b-irr', bankName: 'بانک ریالی', currency: 'IRR', balance: 50000000 },
        'b-irt': { id: 'b-irt', bankName: 'بانک تومانی', currency: 'IRT', balance: 50000000 },
      },
      cash_funds: {
        'cf-irr': { id: 'cf-irr', name: 'صندوق ریال', currency_name: 'ریال', currency: 'IRR', balance: 50000000 },
        'cf-irt': { id: 'cf-irt', name: 'صندوق تومان', currency_name: 'تومان', currency: 'IRT', balance: 50000000 },
      },
      customers: {
        c0: { id: 'c0', customerCode: 0 },
      },
      currencies: {
        irr: { id: 'irr', code: 'IRR', name: 'ریال' },
        irt: { id: 'irt', code: 'IRT', name: 'تومان' },
      },
    };

    sharedMockPb.collection = (name: string): any => ({
      getOne: async (id: string) => mockRecords[name]?.[id] || {},
      getFirstListItem: async () => mockRecords[name]?.['c0'] || { id: 'c0', customerCode: 0 },
      getFullList: async () => Object.values(mockRecords[name] || {}),
      create: async (data: any) => ({ id: 'mock_tx', ...data }),
      update: async (id: string, data: any) => ({ id, ...data }),
      delete: async () => true,
    });

    try {
      // 1. Bank-to-Bank with mismatched currency (IRR to IRT)
      const resB2B = await transferBank(
        new Request('http://localhost/api/banks/transfer', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'bank-to-bank',
            amount: 100000,
            sourceBankId: 'b-irr',
            destinationBankId: 'b-irt',
          }),
        }),
      );
      expect(resB2B.status).toBe(400);
      const b2bBody = await resB2B.json();
      expect(b2bBody.message).toContain('واحد پولی یکسان');

      // 2. Cash-to-Bank with mismatched currency (IRT fund to IRR bank)
      const resC2B = await transferBank(
        new Request('http://localhost/api/banks/transfer', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'cash-to-bank',
            amount: 100000,
            cashFundId: 'cf-irt',
            destinationBankId: 'b-irr',
          }),
        }),
      );
      expect(resC2B.status).toBe(400);
      const c2bBody = await resC2B.json();
      expect(c2bBody.message).toContain('واحد پولی یکسان');

      // 3. Bank-to-Cash with mismatched currency (IRR bank to IRT fund)
      const resB2C = await transferBank(
        new Request('http://localhost/api/banks/transfer', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'bank-to-cash',
            amount: 100000,
            sourceBankId: 'b-irr',
            cashFundId: 'cf-irt',
          }),
        }),
      );
      expect(resB2C.status).toBe(400);
      const b2cBody = await resB2C.json();
      expect(b2cBody.message).toContain('واحد پولی یکسان');
    } finally {
      sharedMockPb.collection = originalCollection;
    }
  });

  it('correctly formats foreign currency entities without appending "تومان" (e.g. صندوق پوند: ۱۵۱ پوند)', () => {
    // 1. Foreign currency entity (British Pound)
    const poundVault = {
      currencyName: 'پوند',
      currencyCode: 'GBP',
      currencySymbol: '£',
    };

    // Formatted label should be strictly 'پوند' without 'تومان' or 'ریال'
    expect(getEntityCurrencyLabel(poundVault, 'IRT')).toBe('پوند');
    expect(getEntityCurrencyLabel(poundVault, 'IRR')).toBe('پوند');

    // Amount formatting for 151 GBP should be '۱۵۱ پوند' and NOT include 'تومان'
    const formattedPoundIRT = formatEntityAmount(151, poundVault, 'IRT');
    expect(formattedPoundIRT).toBe('۱۵۱ پوند');
    expect(formattedPoundIRT).not.toContain('تومان');
    expect(formattedPoundIRT).not.toContain('ریال');

    const formattedPoundIRR = formatEntityAmount(151, poundVault, 'IRR');
    expect(formattedPoundIRR).toBe('۱۵۱ پوند');
    expect(formattedPoundIRR).not.toContain('تومان');
    expect(formattedPoundIRR).not.toContain('ریال');

    // 2. Foreign currency entity (US Dollar)
    const dollarAccount = {
      currencyName: 'دلار',
      currencyCode: 'USD',
      currencySymbol: '$',
    };
    expect(getEntityCurrencyLabel(dollarAccount, 'IRT')).toBe('دلار');
    const formattedDollar = formatEntityAmount(2500, dollarAccount, 'IRT');
    expect(formattedDollar).toBe(`${Number(2500).toLocaleString('fa-IR')} دلار`);
    expect(formattedDollar).not.toContain('تومان');

    // 3. Domestic currency entity (Rial)
    const rialAccount = {
      currencyName: 'ریال',
      currencyCode: 'IRR',
      currencySymbol: 'ریال',
    };
    // When baseCurrency is IRT (Toman), 1,000,000 Rial becomes 100,000 تومان
    expect(getEntityCurrencyLabel(rialAccount, 'IRT')).toBe('تومان');
    expect(formatEntityAmount(1000000, rialAccount, 'IRT')).toBe(`${Number(100000).toLocaleString('fa-IR')} تومان`);
    // When baseCurrency is IRR (Rial), 1,000,000 Rial remains 1,000,000 ریال
    expect(getEntityCurrencyLabel(rialAccount, 'IRR')).toBe('ریال');
    expect(formatEntityAmount(1000000, rialAccount, 'IRR')).toBe(`${Number(1000000).toLocaleString('fa-IR')} ریال`);
  });
});

