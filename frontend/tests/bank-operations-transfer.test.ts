import { describe, expect, it, beforeEach } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ToastProvider } from '@/components/ui/toast';
import BankOperationModal from '@/features/banks/components/BankOperationModal';
import BankAccountsListClient from '@/features/banks/components/BankAccountsListClient';
import BankTab from '@/features/accounting/documents/components/BankTab';
import { POST as transferBank } from '@/app/api/banks/transfer/route';
import { setMockAuthUser } from './setup';

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
    },
  ];

  it('renders BankAccountsListClient with "عملیات بانکی" button in header and row actions', () => {
    const html = renderWithToast(
      React.createElement(BankAccountsListClient, {
        initialAccounts: mockBankAccounts,
      }),
    );

    expect(html).toContain('عملیات بانکی');
    expect(html).toContain('افزودن حساب بانکی جدید');
    expect(html).toContain('بانک ملت');
    expect(html).toContain('بانک ملی');
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
});
