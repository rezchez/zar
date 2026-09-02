import { describe, expect, it } from 'bun:test';

import { validateIranianSheba } from '@/app/api/banks/route';
import { ensureCashFundDetailInChart, ensureBankAccountDetailInChart } from '@/lib/chart-of-accounts';

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

    expect(result.code).toBe('111003');
    expect(result.name).toBe('صندوق اصلی تومان');
    expect(result.path).toContain('/111003/');
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
});
