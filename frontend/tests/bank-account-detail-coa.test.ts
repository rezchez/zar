import { describe, expect, it } from 'bun:test';

import {
  ensureBankAccountDetailInChart,
  getNextDetailAccountCode,
} from '../lib/chart-of-accounts';

describe('Bank Account - Level 4 Detail under Cash & Bank (1110) Tests', () => {
  it('creates a new Level 4 Detail account under 1110 when no accountId is provided', async () => {
    const createdRecords: any[] = [];
    const mockPb = {
      collection: (name: string) => ({
        getFirstListItem: async (query: string) => {
          if (query.includes('1110')) {
            return { id: 'sys_1110', code: '1110', name: 'موجودی نقد و بانک', path: '/1000/1100/1110/' };
          }
          return null;
        },
        getOne: async (id: string) => {
          if (id === 'sys_1110') {
            return { id: 'sys_1110', code: '1110', name: 'موجودی نقد و بانک', path: '/1000/1100/1110/' };
          }
          return null;
        },
        getFullList: async () => [
          { code: '111001' },
          { code: '111002' },
        ],
        create: async (data: any) => {
          const rec = { id: `coa_detail_${data.code}`, ...data };
          createdRecords.push(rec);
          return rec;
        },
      }),
    };

    const result = await ensureBankAccountDetailInChart(mockPb as any, {
      bankName: 'ملت',
      branchName: 'مرکزی',
      accountNumber: '1234567890',
      currency: 'IRR',
      userId: 'usr_test_1',
    });

    expect(result.id).toBe('coa_detail_111003');
    expect(result.code).toBe('111003');
    expect(result.name).toBe('بانک ملت - مرکزی (1234567890)');
    expect(result.path).toBe('/1000/1100/1110/111003/');

    expect(createdRecords.length).toBe(1);
    const created = createdRecords[0];
    expect(created.level).toBe(4);
    expect(created.parentId).toBe('sys_1110');
    expect(created.accountType).toBe('asset');
    expect(created.normalBalance).toBe('debit');
    expect(created.isPostable).toBe(true);
    expect(created.description).toContain('حساب بانکی تفصیلی مربوط به ملت');
  });

  it('reuses existing detail account when valid accountId is provided', async () => {
    const mockPb = {
      collection: (name: string) => ({
        getOne: async (id: string) => {
          if (id === 'coa_detail_existing') {
            return {
              id: 'coa_detail_existing',
              code: '111001',
              name: 'بانک ملی - شعبه بازار (0987654321)',
              path: '/1000/1100/1110/111001/',
              level: 4,
            };
          }
          return null;
        },
      }),
    };

    const result = await ensureBankAccountDetailInChart(mockPb as any, {
      bankName: 'ملی',
      branchName: 'شعبه بازار',
      accountNumber: '0987654321',
      currency: 'IRR',
      existingAccountId: 'coa_detail_existing',
    });

    expect(result.id).toBe('coa_detail_existing');
    expect(result.code).toBe('111001');
    expect(result.name).toBe('بانک ملی - شعبه بازار (0987654321)');
  });

  it('correctly handles currency settings for foreign currency bank accounts', async () => {
    let createdPayload: any = null;
    const mockPb = {
      collection: (name: string) => ({
        getFirstListItem: async () => ({ id: 'sys_1110', code: '1110', path: '/1000/1100/1110/' }),
        getOne: async () => ({ id: 'sys_1110', code: '1110', path: '/1000/1100/1110/' }),
        getFullList: async () => [],
        create: async (data: any) => {
          createdPayload = data;
          return { id: `coa_detail_${data.code}`, ...data };
        },
      }),
    };

    await ensureBankAccountDetailInChart(mockPb as any, {
      bankName: 'سامان',
      accountNumber: '998877',
      currency: 'USD',
    });

    expect(createdPayload).toBeDefined();
    expect(createdPayload.isMultiCurrency).toBe(true);
    expect(createdPayload.code).toBe('111001');
    expect(createdPayload.level).toBe(4);
  });
});
