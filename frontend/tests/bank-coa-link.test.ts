import { describe, expect, it } from 'bun:test';
import { mapBankAccount } from '@/lib/bank';

describe('Bank Account & Chart of Accounts Linkage', () => {
  it('maps BankAccount with direct accountId and expanded account data', () => {
    const rawRecord = {
      id: 'bnk_01',
      bankName: 'بانک پاسارگاد',
      branchName: 'شعبه سعادت‌آباد',
      accountNumber: '1010101010',
      balance: 50000000,
      currentBalance: 50000000,
      accountCodeZero: '0',
      currency: 'IRR',
      isActive: true,
      accountId: 'coa_rec_1110',
      expand: {
        accountId: {
          id: 'coa_rec_1110',
          code: '111001',
          name: 'بانک پاسارگاد شعبه سعادت‌آباد',
          path: 'دارایی‌ها > دارایی‌های جاری > موجودی نقد و بانک > بانک پاسارگاد',
        },
      },
    };

    const mapped = mapBankAccount(rawRecord);

    expect(mapped.id).toBe('bnk_01');
    expect(mapped.bankName).toBe('بانک پاسارگاد');
    expect(mapped.accountId).toBe('coa_rec_1110');
    expect(mapped.accountCode).toBe('111001');
    expect(mapped.accountName).toBe('بانک پاسارگاد شعبه سعادت‌آباد');
    expect(mapped.accountPath).toBe('دارایی‌ها > دارایی‌های جاری > موجودی نقد و بانک > بانک پاسارگاد');
  });

  it('handles bank account without linked coding account gracefully', () => {
    const rawRecord = {
      id: 'bnk_02',
      bankName: 'بانک سامان',
      accountNumber: '2020202020',
      balance: 10000000,
    };

    const mapped = mapBankAccount(rawRecord);

    expect(mapped.id).toBe('bnk_02');
    expect(mapped.accountId).toBeNull();
    expect(mapped.accountCode).toBeNull();
    expect(mapped.accountName).toBeNull();
  });
});
