import { describe, expect, it } from 'bun:test';
import { mapBankAccount, type BankAccount } from '@/lib/bank';

describe('Bank Check Payment Filtering & Checkbook Eligibility Tests', () => {
  const mockBankRecords = [
    {
      id: 'bank-1',
      bankName: 'بانک ملی',
      branchName: 'مرکزی',
      accountNumber: '1111',
      balance: 50_000_000,
      currency: 'IRR',
      hasCheckbook: true,
      hasVirtualCheck: false,
    },
    {
      id: 'bank-2',
      bankName: 'بانک ملت',
      branchName: 'ونک',
      accountNumber: '2222',
      balance: 100_000_000,
      currency: 'IRR',
      hasCheckbook: false,
      hasVirtualCheck: true,
    },
    {
      id: 'bank-3',
      bankName: 'بانک صادرات',
      branchName: 'تجریش',
      accountNumber: '3333',
      balance: 30_000_000,
      currency: 'IRR',
      hasCheckbook: true,
      hasVirtualCheck: true,
    },
    {
      id: 'bank-4',
      bankName: 'بانک سامان',
      branchName: 'سعادت‌آباد',
      accountNumber: '4444',
      balance: 10_000_000,
      currency: 'IRR',
      hasCheckbook: false,
      hasVirtualCheck: false,
    },
    {
      id: 'bank-5',
      bankName: 'بلوبانک',
      branchName: 'آنلاین',
      accountNumber: '5555',
      balance: 20_000_000,
      currency: 'IRR',
      // no checkbook properties specified
    },
  ];

  it('mapBankAccount correctly maps hasCheckbook and hasVirtualCheck booleans', () => {
    const bank1 = mapBankAccount(mockBankRecords[0]);
    expect(bank1.hasCheckbook).toBe(true);
    expect(bank1.hasVirtualCheck).toBe(false);

    const bank2 = mapBankAccount(mockBankRecords[1]);
    expect(bank2.hasCheckbook).toBe(false);
    expect(bank2.hasVirtualCheck).toBe(true);

    const bank3 = mapBankAccount(mockBankRecords[2]);
    expect(bank3.hasCheckbook).toBe(true);
    expect(bank3.hasVirtualCheck).toBe(true);

    const bank4 = mapBankAccount(mockBankRecords[3]);
    expect(bank4.hasCheckbook).toBe(false);
    expect(bank4.hasVirtualCheck).toBe(false);

    const bank5 = mapBankAccount(mockBankRecords[4]);
    expect(bank5.hasCheckbook).toBe(false);
    expect(bank5.hasVirtualCheck).toBe(false);
  });

  it('filters banks for check-payment to only those with physical checkbook OR virtual check', () => {
    const accounts: BankAccount[] = mockBankRecords.map(mapBankAccount);

    const checkPaymentBanks = accounts.filter(
      (b) => Boolean(b.hasCheckbook || b.hasVirtualCheck),
    );

    // bank-1 (physical), bank-2 (virtual), bank-3 (both) must be included
    expect(checkPaymentBanks.length).toBe(3);
    expect(checkPaymentBanks.map((b) => b.id)).toEqual(['bank-1', 'bank-2', 'bank-3']);

    // bank-4 (neither) and bank-5 (neither) must be strictly excluded
    expect(checkPaymentBanks.some((b) => b.id === 'bank-4')).toBe(false);
    expect(checkPaymentBanks.some((b) => b.id === 'bank-5')).toBe(false);
  });

  it('leaves all banks available for other operations (transfer, deposit, withdrawal)', () => {
    const accounts: BankAccount[] = mockBankRecords.map(mapBankAccount);

    // Other kinds e.g. bank-to-bank or pay-to-customer should not filter by checkbook
    const transferBanks = accounts;
    expect(transferBanks.length).toBe(5);
  });

  it('rejects check issuance for accounts that lack physical or virtual checkbook', () => {
    const accounts: BankAccount[] = mockBankRecords.map(mapBankAccount);

    function validateCheckIssuance(account: BankAccount) {
      if (!account.hasCheckbook && !account.hasVirtualCheck) {
        throw new Error('حساب بانکی انتخاب شده دارای دسته چک فیزیکی یا مجازی فعال نیست.');
      }
      return true;
    }

    // Should succeed for eligible accounts
    expect(() => validateCheckIssuance(accounts[0])).not.toThrow();
    expect(() => validateCheckIssuance(accounts[1])).not.toThrow();
    expect(() => validateCheckIssuance(accounts[2])).not.toThrow();

    // Should throw for ineligible accounts
    expect(() => validateCheckIssuance(accounts[3])).toThrow(
      'حساب بانکی انتخاب شده دارای دسته چک فیزیکی یا مجازی فعال نیست.',
    );
    expect(() => validateCheckIssuance(accounts[4])).toThrow(
      'حساب بانکی انتخاب شده دارای دسته چک فیزیکی یا مجازی فعال نیست.',
    );
  });
});
