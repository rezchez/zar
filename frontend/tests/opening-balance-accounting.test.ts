import { describe, expect, test } from 'bun:test';

import {
  postBankOpeningBalance,
  postCashOpeningBalance,
  postCoinOpeningInventory,
} from '@/lib/accounting-posting-engine';
import { DEFAULT_CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts';

// Mock PocketBase Service
class MockPocketBase {
  public collectionsMap = new Map<string, any[]>();

  filter(template: string, params: Record<string, any>) {
    let result = template;
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{:${k}\\}`, 'g'), `"${v}"`);
    }
    return result;
  }

  collection(name: string) {
    const self = this;
    return {
      async getOne(id: string) {
        const list = self.collectionsMap.get(name) || [];
        const item = list.find((i) => i.id === id);
        if (item) return item;
        throw new Error(`Item ${id} not found in ${name}`);
      },
      async getFirstListItem(filterStr: string) {
        const list = self.collectionsMap.get(name) || [];
        for (const item of list) {
          if (filterStr.includes('sourceKey') && item.sourceKey && filterStr.includes(item.sourceKey)) {
            return item;
          }
          if (filterStr.includes('code =') && item.code && filterStr.includes(item.code)) {
            return item;
          }
        }
        throw new Error(`Item matching ${filterStr} not found in ${name}`);
      },
      async create(data: any) {
        const list = self.collectionsMap.get(name) || [];
        const record = { id: `mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...data };
        list.push(record);
        self.collectionsMap.set(name, list);
        return record;
      },
      async update(id: string, data: any) {
        const list = self.collectionsMap.get(name) || [];
        const index = list.findIndex((i) => i.id === id);
        if (index !== -1) {
          list[index] = { ...list[index], ...data };
          return list[index];
        }
        throw new Error(`Item ${id} not found in ${name}`);
      },
    };
  }
}

describe('Opening Balance Accounting Foundation & Integration Tests', () => {
  const userId = 'usr_admin_test_01';

  test('Chart of Accounts contains default Opening Capital (3100) and Gold Inventory (1130)', () => {
    const openingEquity = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === '3100');
    expect(openingEquity).toBeDefined();
    expect(openingEquity?.accountType).toBe('equity');

    const goldInventory = DEFAULT_CHART_OF_ACCOUNTS.find((a) => a.code === '1130');
    expect(goldInventory).toBeDefined();
    expect(goldInventory?.accountType).toBe('asset');
    expect(goldInventory?.requiresWeight).toBe(true);
  });

  test('Bank Opening Balance: posts balanced double-entry journal (DEBIT bank detail, CREDIT 3100)', async () => {
    const pb = new MockPocketBase() as any;

    const mockBankAccount = {
      id: 'bnk_melli_01',
      bankName: 'بانک ملی ایران',
      accountNumber: '0102030405001',
      accountId: 'sys_1110_detail_01',
    };

    const result = await postBankOpeningBalance(
      mockBankAccount,
      1_000_000_000, // 1 Billion Rials
      '1403/01/01',
      userId,
      pb,
    );

    expect(result.sourceType).toBe('opening_bank');
    expect(result.sourceId).toBe('bnk_melli_01');
    expect(result.sourceKey).toBe('opening:bank:bnk_melli_01');
    expect(result.totalDebit).toBe(1_000_000_000);
    expect(result.totalCredit).toBe(1_000_000_000);
    expect(result.lines).toHaveLength(2);

    // Line 1: Debit Bank Account
    expect(result.lines[0].accountId).toBe('sys_1110_detail_01');
    expect(result.lines[0].debit).toBe(1_000_000_000);
    expect(result.lines[0].credit).toBe(0);

    // Line 2: Credit Opening Capital (3100)
    expect(result.lines[1].accountCode).toBe('3100');
    expect(result.lines[1].debit).toBe(0);
    expect(result.lines[1].credit).toBe(1_000_000_000);
  });

  test('Cash Fund Opening Balance: posts balanced double-entry journal (DEBIT cash detail, CREDIT 3100)', async () => {
    const pb = new MockPocketBase() as any;

    const mockCashFund = {
      id: 'csh_vault_rial',
      name: 'صندوق اصلی ریالی',
      currencyName: 'ریال',
      accountId: 'sys_1110_detail_cash_01',
    };

    const result = await postCashOpeningBalance(
      mockCashFund,
      500_000_000, // 500 Million Rials
      '1403/01/01',
      userId,
      pb,
    );

    expect(result.sourceType).toBe('opening_cash');
    expect(result.sourceId).toBe('csh_vault_rial');
    expect(result.sourceKey).toBe('opening:cash:csh_vault_rial');
    expect(result.totalDebit).toBe(500_000_000);
    expect(result.totalCredit).toBe(500_000_000);
    expect(result.lines).toHaveLength(2);

    // Line 1: Debit Cash Fund
    expect(result.lines[0].accountId).toBe('sys_1110_detail_cash_01');
    expect(result.lines[0].debit).toBe(500_000_000);
    expect(result.lines[0].credit).toBe(0);

    // Line 2: Credit Opening Capital (3100)
    expect(result.lines[1].accountCode).toBe('3100');
    expect(result.lines[1].debit).toBe(0);
    expect(result.lines[1].credit).toBe(500_000_000);
  });

  test('Coin/Bullion Opening Inventory: posts balanced double-entry journal (DEBIT 1130, CREDIT 3100)', async () => {
    const pb = new MockPocketBase() as any;

    const mockInventory = {
      id: 'coin_emami_20',
      itemName: 'سکه تمام طرح جدید (امامی)',
      quantity: 20,
      totalAmount: 900_000_000, // 900 Million Rials
    };

    const result = await postCoinOpeningInventory(
      mockInventory,
      '1403/01/01',
      userId,
      pb,
    );

    expect(result.sourceType).toBe('opening_coin');
    expect(result.sourceId).toBe('coin_emami_20');
    expect(result.sourceKey).toBe('opening:coin:coin_emami_20');
    expect(result.totalDebit).toBe(900_000_000);
    expect(result.totalCredit).toBe(900_000_000);

    // Line 1: Debit Gold Inventory (1130)
    expect(result.lines[0].accountCode).toBe('1130');
    expect(result.lines[0].debit).toBe(900_000_000);
    expect(result.lines[0].credit).toBe(0);

    // Line 2: Credit Opening Capital (3100)
    expect(result.lines[1].accountCode).toBe('3100');
    expect(result.lines[1].debit).toBe(0);
    expect(result.lines[1].credit).toBe(900_000_000);
  });

  test('Idempotency & Retry: Repeating opening post returns existing journal without duplicating lines', async () => {
    const pb = new MockPocketBase() as any;

    const mockBankAccount = {
      id: 'bnk_mellat_01',
      bankName: 'بانک ملت',
      accountNumber: '99887766',
    };

    // First Call
    const res1 = await postBankOpeningBalance(mockBankAccount, 200_000_000, '1403/01/01', userId, pb);
    expect(res1.alreadyExists).toBeUndefined();

    // Verify record was saved in mock DB
    const list = pb.collectionsMap.get('journal_entries');
    expect(list).toBeDefined();
    expect(list.length).toBe(1);

    // Second Call with same sourceKey (idempotent retry)
    const res2 = await postBankOpeningBalance(mockBankAccount, 200_000_000, '1403/01/01', userId, pb);
    expect(res2.alreadyExists).toBe(true);
    expect(res2.id).toBe(res1.id);
    expect(res2.totalDebit).toBe(res1.totalDebit);
    expect(res2.totalCredit).toBe(res1.totalCredit);
  });

  test('Integration Test: Combined BANK + CASH + COIN opening operations result in balanced double-entry accounting', async () => {
    const pb = new MockPocketBase() as any;

    // 1. Bank Opening: 1,000,000,000 IRR
    const bankJournal = await postBankOpeningBalance(
      { id: 'bnk_01', bankName: 'بانک پاسارگاد', accountNumber: '111', accountId: 'acc_bnk_01' },
      1_000_000_000,
      '1403/01/01',
      userId,
      pb,
    );

    // 2. Cash Opening: 500,000,000 IRR
    const cashJournal = await postCashOpeningBalance(
      { id: 'csh_01', name: 'صندوق ریالی', accountId: 'acc_csh_01' },
      500_000_000,
      '1403/01/01',
      userId,
      pb,
    );

    // 3. Coin Opening: 900,000,000 IRR
    const coinJournal = await postCoinOpeningInventory(
      { id: 'coin_01', itemName: 'سکه امامی', quantity: 20, totalAmount: 900_000_000 },
      '1403/01/01',
      userId,
      pb,
    );

    // Verify individual journals are balanced
    expect(bankJournal.totalDebit).toBe(bankJournal.totalCredit);
    expect(cashJournal.totalDebit).toBe(cashJournal.totalCredit);
    expect(coinJournal.totalDebit).toBe(coinJournal.totalCredit);

    // Aggregate Double-Entry Verification across entire system opening balance
    const aggregateTotalDebit = bankJournal.totalDebit + cashJournal.totalDebit + coinJournal.totalDebit;
    const aggregateTotalCredit = bankJournal.totalCredit + cashJournal.totalCredit + coinJournal.totalCredit;

    expect(aggregateTotalDebit).toBe(2_400_000_000); // 2.4 Billion IRR
    expect(aggregateTotalCredit).toBe(2_400_000_000); // 2.4 Billion IRR
    expect(aggregateTotalDebit - aggregateTotalCredit).toBe(0); // SUM(Debit) == SUM(Credit)
  });
});
