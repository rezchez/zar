import { describe, expect, it } from 'bun:test';
import {
  BANK_ACCOUNT_TYPES,
  formatBankSelectOptionLabel,
  getAccountTypeLabel,
  mapBankAccount,
  type BankAccount,
} from '../features/banks/services/bank';

describe('Bank Account Type and Display Tests', () => {
  it('provides all expected bank account types', () => {
    const values = BANK_ACCOUNT_TYPES.map((t) => t.value);
    expect(values).toContain('current');
    expect(values).toContain('short_term');
    expect(values).toContain('long_term');
    expect(values).toContain('saving');
    expect(values).toContain('gharzalhasane_current');
  });

  it('correctly returns Persian label for each account type', () => {
    expect(getAccountTypeLabel('current')).toBe('جاری');
    expect(getAccountTypeLabel('short_term')).toBe('کوتاه‌مدت');
    expect(getAccountTypeLabel('long_term')).toBe('بلندمدت');
    expect(getAccountTypeLabel('saving')).toBe('قرض‌الحسنه پس‌انداز');
    expect(getAccountTypeLabel('gharzalhasane_current')).toBe('قرض‌الحسنه جاری');
    expect(getAccountTypeLabel(undefined)).toBe('جاری');
    expect(getAccountTypeLabel(null)).toBe('جاری');
    expect(getAccountTypeLabel('')).toBe('جاری');
  });

  it('maps accountType in mapBankAccount with proper fallback', () => {
    const recordWithType = {
      id: 'acc1',
      bankName: 'بانک ملت',
      accountNumber: '123456',
      accountType: 'short_term',
      balance: 1000000,
    };
    const mapped1 = mapBankAccount(recordWithType);
    expect(mapped1.accountType).toBe('short_term');

    const recordWithoutType = {
      id: 'acc2',
      bankName: 'بانک صادرات',
      accountNumber: '654321',
      balance: 500000,
    };
    const mapped2 = mapBankAccount(recordWithoutType);
    expect(mapped2.accountType).toBe('current');
  });

  it('formats bank select option label exactly as requested: "پاسارگاد جمهوری ش.ح 123456 موجودی: 100.000.000"', () => {
    const pasargadBank: BankAccount = {
      id: 'b1',
      bankName: 'بانک پاسارگاد',
      branchName: 'جمهوری',
      accountNumber: '123456',
      accountType: 'current',
      balance: 100000000,
      currentBalance: 100000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      accountCode: '111001',
      created: '',
      updated: '',
    };

    const label = formatBankSelectOptionLabel(pasargadBank, '100.000.000');
    expect(label).toBe('پاسارگاد جمهوری ش.ح 123456 موجودی: 100.000.000');
    expect(label).not.toContain('بانک پاسارگاد');
    expect(label).not.toContain('کدینگ');
    expect(label).not.toContain('[کد:');
    expect(label).not.toContain('111001');
  });

  it('formats bank select option label for non-current account types', () => {
    const melliSaving: BankAccount = {
      id: 'b2',
      bankName: 'بانک ملی ایران',
      branchName: 'شعبه مرکزی',
      accountNumber: '010567890001',
      accountType: 'saving',
      balance: 25000000,
      currentBalance: 25000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      accountCode: '111002',
      created: '',
      updated: '',
    };

    const label = formatBankSelectOptionLabel(melliSaving, '۲۵,۰۰۰,۰۰۰ ریال');
    expect(label).toBe('ملی ایران مرکزی (قرض‌الحسنه پس‌انداز) ش.ح 010567890001 موجودی: ۲۵,۰۰۰,۰۰۰ ریال');
    expect(label).not.toContain('بانک ملی');
    expect(label).not.toContain('کدینگ');
  });
});
