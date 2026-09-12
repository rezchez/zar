import { describe, expect, it } from 'bun:test';

import { ensureCashFundDetailInChart, ensureBankAccountDetailInChart } from '@/lib/chart-of-accounts';
import { validateIranianSheba } from '@/lib/sheba';

describe('Sheba Validation & Chart of Accounts Integration Tests', () => {
  it('validates Iranian Sheba (IBAN) format strictly', () => {
    // Valid cases
    expect(validateIranianSheba('IR123456789012345678901234').valid).toBe(true);
    expect(validateIranianSheba('123456789012345678901234').valid).toBe(true);
    expect(validateIranianSheba('').valid).toBe(true);

    // Invalid cases
    expect(validateIranianSheba('IR123456789').valid).toBe(false);
    expect(validateIranianSheba('US123456789012345678901234').valid).toBe(false);
    expect(validateIranianSheba('IR12345678901234567890123X').valid).toBe(false);
  });

  it('ensureCashFundDetailInChart returns Level 4 detail account mapped under 1110', async () => {
    const mockCreatedRecords: any[] = [];
    const mockPb = {
      collection: (name: string) => ({
        getFirstListItem: async (filter: string) => {
          if (name === 'chart_of_accounts' && filter.includes('1110')) {
            return { id: 'sys_1110', code: '1110', path: '/1000/1100/1110/' };
          }
          return null;
        },
        getFullList: async () => [
          { code: '111001' },
          { code: '111002' },
        ],
        create: async (payload: any) => {
          const rec = { id: `id_${Date.now()}`, ...payload };
          mockCreatedRecords.push(rec);
          return rec;
        },
        getOne: async (id: string) => {
          return mockCreatedRecords.find((r) => r.id === id) || null;
        },
      }),
    };

    const result = await ensureCashFundDetailInChart(mockPb as any, {
      fundName: 'صندوق اصلی تومان',
      currencyName: 'تومان',
    });

    expect(result.code).toBe('111051');
    expect(result.name).toBe('صندوق اصلی تومان');
    expect(result.path).toContain('/111051/');
  });

  it('ensureBankAccountDetailInChart maps bank account under 1110 idempotently', async () => {
    const mockPb = {
      collection: (name: string) => ({
        getFirstListItem: async (filter: string) => {
          if (filter.includes('1110')) {
            return { id: 'sys_1110', code: '1110', path: '/1000/1100/1110/' };
          }
          return null;
        },
        getFullList: async () => [
          { code: '111001' },
        ],
        create: async (payload: any) => ({ id: 'new_bank_acc_id', ...payload }),
      }),
    };

    const result = await ensureBankAccountDetailInChart(mockPb as any, {
      bankName: 'ملت',
      branchName: 'بازار',
      accountNumber: '987654321',
    });

    expect(result.code).toBe('111002');
    expect(result.name).toBe('بانک ملت - بازار (987654321)');
  });

  it('enrichAccountsWithBankAndCash sorts banks consecutively first and cash funds consecutively second', () => {
    const { enrichAccountsWithBankAndCash, buildAccountTree } = require('@/lib/chart-of-accounts');
    const baseAccounts = [
      {
        id: 'acc_1110',
        code: '1110',
        name: 'موجودی نقد و بانک',
        parentId: null,
        level: 3,
        accountType: 'asset',
        normalBalance: 'debit',
        sortOrder: 1110,
      },
    ];

    const bankInputs = [
      { id: 'b1', bankName: 'پاسارگاد', accountNumber: '11977320' },
      { id: 'b2', bankName: 'بلوبانک', accountNumber: '11850523' },
    ];

    const cashInputs = [
      { id: 'c1', name: 'صندوق یورو', currencyName: 'یورو' },
      { id: 'c2', name: 'صندوق پوند', currencyName: 'پوند' },
    ];

    const enriched = enrichAccountsWithBankAndCash(baseAccounts, bankInputs, cashInputs);
    const tree = buildAccountTree(enriched);
    const root1110 = tree.find((t: any) => t.code === '1110');
    expect(root1110).toBeDefined();
    expect(root1110.children.length).toBe(4);

    // Banks must be consecutive first (111001, 111002)
    expect(root1110.children[0].code).toBe('111001');
    expect(root1110.children[0].name).toContain('پاسارگاد');
    expect(root1110.children[1].code).toBe('111002');
    expect(root1110.children[1].name).toContain('بلوبانک');

    // Cash funds must be consecutive second (111051, 111052)
    expect(root1110.children[2].code).toBe('111051');
    expect(root1110.children[2].name).toContain('یورو');
    expect(root1110.children[3].code).toBe('111052');
    expect(root1110.children[3].name).toContain('پوند');
  });
});
