import { describe, expect, it } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { ToastProvider } from '@/components/ui/toast';
import InitialBankInventoryModal from '@/features/banks/components/InitialBankInventoryModal';
import BankAccountModal from '@/features/banks/components/BankAccountModal';
import BankOpeningBalanceModal from '@/features/banks/components/BankOpeningBalanceModal';
import { BankActionMenu } from '@/features/banks/components/BankingAccountsClient';

function renderWithToast(ui: React.ReactElement) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(ToastProvider, null, ui),
  );
}

describe('Bank Account Edit & Opening Balance Separation Tests', () => {
  const mockAccount = {
    id: 'bank-101',
    bankName: 'بانک پاسارگاد',
    branchName: 'شعبه میرداماد',
    accountNumber: '5022291012345678',
    accountType: 'current',
    shebaNumber: 'IR120150000000050222910123',
    hasCheckbook: true,
    hasVirtualCheck: true,
    currencyId: 'curr-1',
    currencyName: 'ریال ایران',
    currencyCode: 'IRR',
    currencySymbol: 'ریال',
    openingBalance: 250000000,
    balance: 300000000,
    openingBalanceDate: '1403/01/15',
    description: 'حساب اصلی تنخواه و مبادلات',
  };

  it('InitialBankInventoryModal in CREATE mode renders initial balance amount inputs', () => {
    const html = renderWithToast(
      React.createElement(InitialBankInventoryModal, {
        isOpen: true,
        onClose: () => {},
        editItem: null,
      }),
    );

    expect(html).toContain('حساب پایه جدید');
    expect(html).toContain('موجودی پایه و واحد مالی');
    expect(html).toContain('تاریخ ثبت موجودی اولیه');
    expect(html).toContain('ثبت حساب بانکی');
  });

  it('BankAccountModal in EDIT mode removes initial balance editing fields and displays initial inventory button', () => {
    const html = renderWithToast(
      React.createElement(BankAccountModal, {
        isOpen: true,
        onClose: () => {},
        editItem: mockAccount,
      }),
    );

    // Title shows edit bank account
    expect(html).toContain('ویرایش حساب بانکی');
    expect(html).toContain('ذخیره تغییرات حساب بانکی');

    // Opening balance editable section should NOT be present
    expect(html).not.toContain('موجودی پایه و واحد مالی');

    // Banner and redirect button to initial inventory section must be present
    expect(html).toContain('موجودی اول دوره حساب بانکی');
    expect(html).toContain('بخش موجودی اولیه');
    expect(html).toContain('تعریف موجودی اول دوره');
    expect(html).toContain('ویرایش موجودی اولیه این حساب در بخش موجودی اول دوره');
  });

  it('BankActionMenu provides both "ویرایش حساب بانکی" and "ویرایش موجودی اولیه"', () => {
    const html = renderWithToast(
      React.createElement(BankActionMenu, {
        account: mockAccount,
        onAction: () => {},
        defaultOpen: true,
      }),
    );

    expect(html).toContain('ویرایش حساب بانکی');
    expect(html).toContain('ویرایش موجودی اولیه');
    expect(html).toContain('عملیات بانکی');
  });

  it('BankOpeningBalanceModal renders dedicated opening balance editor with account details', () => {
    const html = renderWithToast(
      React.createElement(BankOpeningBalanceModal, {
        isOpen: true,
        onClose: () => {},
        account: mockAccount,
      }),
    );

    expect(html).toContain('ویرایش موجودی اول دوره حساب بانکی');
    expect(html).toContain('بانک پاسارگاد');
    expect(html).toContain('5022291012345678');
    expect(html).toContain('مشخصات مالی موجودی پایه');
    expect(html).toContain('تاریخ ثبت موجودی اولیه');
    expect(html).toContain('شرح و توضیحات سند افتتاحیه');
    expect(html).toContain('ذخیره موجودی اول دوره');
  });
});
