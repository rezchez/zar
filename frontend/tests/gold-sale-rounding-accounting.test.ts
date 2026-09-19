import { describe, expect, it } from 'bun:test';
import {
  buildMetalSaleJournalLines,
  postMetalSale,
} from '@/lib/metal-accounting';
import { SYSTEM_ACCOUNT_CODES } from '@/lib/accounting-posting-engine';

function createMockPocketBase() {
  const store = new Map<string, any>();
  return {
    _store: store,
    filter: (str: string, params: Record<string, any>) => ({ str, params }),
    collection: (name: string) => ({
      getFirstListItem: async (f: any) => {
        for (const val of store.values()) {
          if (val._collection === name) {
            if (f?.params?.sk && val.sourceKey === f.params.sk) return val;
            if (f?.params?.code && val.code === f.params.code) return val;
            if (f?.params?.key && val.key === f.params.key) return val;
          }
        }
        return null;
      },
      getOne: async (id: string) => {
        const item = store.get(id);
        if (!item) throw new Error('Not found');
        return item;
      },
      getFullList: async (_params: any = {}) => {
        const list: any[] = [];
        for (const val of store.values()) {
          if (val._collection === name) list.push(val);
        }
        return list;
      },
      getList: async (_page = 1, _perPage = 1, _params: any = {}) => {
        const list: any[] = [];
        for (const val of store.values()) {
          if (val._collection === name) list.push(val);
        }
        return { items: list, totalItems: list.length };
      },
      create: async (data: any) => {
        const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const record = { id, ...data, _collection: name };
        store.set(id, record);
        return record;
      },
      update: async (id: string, data: any) => {
        const existing = store.get(id) || {};
        const updated = { ...existing, ...data };
        store.set(id, updated);
        return updated;
      },
      delete: async (id: string) => {
        store.delete(id);
        return true;
      },
    }),
  } as any;
}

describe('Gold Sale Rounding Accounting & Posting Tests', () => {
  it('posts journal entry and child lines for metal sale with negative rounding difference (round down)', async () => {
    const pb = createMockPocketBase();

    // Exact: 3,328,870,216 IRR, Rounded: 3,328,870,000 IRR, Difference: -216 IRR
    const result = await postMetalSale(
      {
        documentId: 'doc_sale_1',
        documentNumber: 'ZF-00100',
        entryDateJalali: '1405/06/29',
        salesRevenueRials: 3328870000,
        exactRevenueRials: 3328870216,
        roundingDifference: -216,
        weightGrams750: 25.123,
        customer: {
          id: 'cust_ali',
          name: 'علی طلافروش',
          customerCode: 101,
        },
        userId: 'usr_admin',
      },
      pb,
    );

    expect(result.id).toBeDefined();
    expect(result.sourceType).toBe('document');
    expect(result.sourceKey).toBe('metal:sale:doc_sale_1');
    expect(result.totalDebit).toBe(3328870216);
    expect(result.totalCredit).toBe(3328870216);

    // Verify child journal lines in pbc_journal_lines collection
    const lines = await pb.collection('journal_lines').getFullList();
    expect(lines.length).toBe(3);

    const customerLine = lines.find((l: any) => l.account_id === 'sys_1120' || l.account_id === '1120');
    const roundingLine = lines.find((l: any) => l.account_id === 'sys_6500' || l.account_id === '6500');
    const revenueLine = lines.find((l: any) => l.account_id === 'sys_4110' || l.account_id === '4110');

    expect(customerLine).toBeDefined();
    expect(customerLine.debit).toBe(3328870000);
    expect(customerLine.credit).toBe(0);

    expect(roundingLine).toBeDefined();
    expect(roundingLine.debit).toBe(216); // Expense debit
    expect(roundingLine.credit).toBe(0);

    expect(revenueLine).toBeDefined();
    expect(revenueLine.debit).toBe(0);
    expect(revenueLine.credit).toBe(3328870216);
  });

  it('posts journal entry and child lines for metal sale with positive rounding difference (round up)', async () => {
    const pb = createMockPocketBase();

    // Exact: 3,328,870,216 IRR, Rounded: 3,329,000,000 IRR, Difference: +129,784 IRR
    const result = await postMetalSale(
      {
        documentId: 'doc_sale_2',
        documentNumber: 'ZF-00101',
        entryDateJalali: '1405/06/29',
        salesRevenueRials: 3329000000,
        exactRevenueRials: 3328870216,
        roundingDifference: 129784,
        weightGrams750: 25.123,
        customer: {
          id: 'cust_reza',
          name: 'رضا زرگر',
          customerCode: 102,
        },
        userId: 'usr_admin',
      },
      pb,
    );

    expect(result.id).toBeDefined();
    expect(result.totalDebit).toBe(3329000000);
    expect(result.totalCredit).toBe(3329000000);

    const lines = await pb.collection('journal_lines').getFullList();
    expect(lines.length).toBe(3);

    const customerLine = lines.find((l: any) => l.account_id === 'sys_1120' || l.account_id === '1120');
    const revenueLine = lines.find((l: any) => l.account_id === 'sys_4110' || l.account_id === '4110');
    const incomeLine = lines.find((l: any) => l.account_id === 'sys_4300' || l.account_id === '4300');

    expect(customerLine).toBeDefined();
    expect(customerLine.debit).toBe(3329000000);

    expect(revenueLine).toBeDefined();
    expect(revenueLine.credit).toBe(3328870216);

    expect(incomeLine).toBeDefined();
    expect(incomeLine.credit).toBe(129784); // Other Income credit
  });

  it('verifies SYSTEM_ACCOUNT_CODES includes rounding accounts', () => {
    expect(SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE).toBe('6500');
    expect(SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME).toBe('4300');
  });
});
