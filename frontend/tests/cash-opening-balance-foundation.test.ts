import { describe, expect, test } from 'bun:test';

import {
  postCashOpeningBalance,
  postJournalEntry,
} from '@/lib/accounting-posting-engine';

class MockPocketBaseService {
  public collections = new Map<string, any[]>();
  public shouldFailCollection: string | null = null;
  public failMessage = 'Simulated Database Failure';

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
        if (self.shouldFailCollection === name) {
          throw new Error(self.failMessage);
        }
        const list = self.collections.get(name) || [];
        const found = list.find((i) => i.id === id);
        if (found) return found;
        throw new Error(`Record ${id} not found in ${name}`);
      },
      async getFirstListItem(filterStr: string) {
        if (self.shouldFailCollection === name) {
          throw new Error(self.failMessage);
        }
        const list = self.collections.get(name) || [];
        for (const item of list) {
          if (filterStr.includes('sourceKey') && item.sourceKey && filterStr.includes(item.sourceKey)) {
            return item;
          }
          if (filterStr.includes('code =') && item.code && filterStr.includes(item.code)) {
            return item;
          }
        }
        throw new Error(`Record matching ${filterStr} not found in ${name}`);
      },
      async getFullList(params: any = {}) {
        if (self.shouldFailCollection === name) {
          throw new Error(self.failMessage);
        }
        return self.collections.get(name) || [];
      },
      async create(data: any) {
        if (self.shouldFailCollection === name) {
          throw new Error(self.failMessage);
        }
        const list = self.collections.get(name) || [];
        const record = {
          id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ...data,
        };
        list.push(record);
        self.collections.set(name, list);
        return record;
      },
      async update(id: string, data: any) {
        if (self.shouldFailCollection === name) {
          throw new Error(self.failMessage);
        }
        const list = self.collections.get(name) || [];
        const idx = list.findIndex((i) => i.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...data };
          return list[idx];
        }
        throw new Error(`Record ${id} not found in ${name}`);
      },
      async delete(id: string) {
        const list = self.collections.get(name) || [];
        const filtered = list.filter((i) => i.id !== id);
        self.collections.set(name, filtered);
        return true;
      },
    };
  }
}

describe('Cash Opening Balance Accounting Foundation Tests', () => {
  const userId = 'usr_admin_cash_test';

  test('Success: Creates parent journal_entry and child journal_lines in pbc_journal_lines collection', async () => {
    const pb = new MockPocketBaseService() as any;

    // Seed Chart of Accounts
    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_usd', code: '111001', name: 'صندوق دلار', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'csh_fund_usd_01',
      name: 'صندوق دلار اصلی',
      currencyName: 'دلار',
      accountId: 'acc_cash_usd',
    };

    const result = await postCashOpeningBalance(cashFund, 5000, '1403/01/01', userId, pb);

    expect(result.sourceType).toBe('opening_cash');
    expect(result.sourceId).toBe('csh_fund_usd_01');
    expect(result.sourceKey).toBe('opening:cash:csh_fund_usd_01');
    expect(result.totalDebit).toBe(5000);
    expect(result.totalCredit).toBe(5000);

    // Verify parent journal entry saved in DB
    const entries = pb.collections.get('journal_entries');
    expect(entries).toBeDefined();
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(result.id);

    // Verify individual child journal lines saved in pbc_journal_lines collection
    const lines = pb.collections.get('journal_lines');
    expect(lines).toBeDefined();
    expect(lines).toHaveLength(2);

    // Line 1: Debit Cash Fund (acc_cash_usd)
    expect(lines[0].journal_entry_id).toBe(result.id);
    expect(lines[0].account_id).toBe('acc_cash_usd');
    expect(lines[0].debit).toBe(5000);
    expect(lines[0].credit).toBe(0);

    // Line 2: Credit Opening Equity (acc_equity_3100)
    expect(lines[1].journal_entry_id).toBe(result.id);
    expect(lines[1].account_id).toBe('acc_equity_3100');
    expect(lines[1].debit).toBe(0);
    expect(lines[1].credit).toBe(5000);
  });

  test('Idempotency & Retry: Retrying posted cash opening returns existing journal without duplicating lines', async () => {
    const pb = new MockPocketBaseService() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_eur', code: '111002', name: 'صندوق یورو', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'csh_fund_eur_01',
      name: 'صندوق یورو',
      accountId: 'acc_cash_eur',
    };

    // First Call
    const res1 = await postCashOpeningBalance(cashFund, 2000, '1403/01/01', userId, pb);
    expect(res1.alreadyExists).toBeUndefined();

    // Verify 2 lines created
    expect(pb.collections.get('journal_lines')).toHaveLength(2);

    // Second Call (Idempotent Retry)
    const res2 = await postCashOpeningBalance(cashFund, 2000, '1403/01/01', userId, pb);
    expect(res2.alreadyExists).toBe(true);
    expect(res2.id).toBe(res1.id);

    // Lines count MUST remain exactly 2 (no duplicate lines created)
    expect(pb.collections.get('journal_lines')).toHaveLength(2);
  });

  test('Missing/Unresolved Account: Operation fails strictly without fallback or virtual entry', async () => {
    const pb = new MockPocketBaseService() as any;

    const cashFundWithoutAccount = {
      id: 'csh_fund_gbp',
      name: 'صندوق پوند بدون حساب',
      accountId: '',
    };

    expect(
      postCashOpeningBalance(cashFundWithoutAccount, 1000, '1403/01/01', userId, pb),
    ).rejects.toThrow('فاقد سرفصل حسابداری مربوطه است');

    // No orphan journal_entries or journal_lines left in DB
    expect(pb.collections.get('journal_entries')).toBeUndefined();
    expect(pb.collections.get('journal_lines')).toBeUndefined();
  });

  test('Inactive Account Resolution: Operation fails when referenced account is inactive', async () => {
    const pb = new MockPocketBaseService() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_inactive', code: '111099', name: 'صندوق غیرفعال', isActive: false },
    ]);

    const cashFund = {
      id: 'csh_fund_inactive',
      name: 'صندوق غیرفعال',
      accountId: 'acc_inactive',
    };

    expect(
      postCashOpeningBalance(cashFund, 1000, '1403/01/01', userId, pb),
    ).rejects.toThrow('غیرفعال است');
  });

  test('Simulated Journal Lines DB Failure: Full atomic rollback executed (journal entry and lines deleted)', async () => {
    const pb = new MockPocketBaseService() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_cad', code: '111003', name: 'صندوق دلار کانادا', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    // Force failure on `journal_lines` collection
    pb.shouldFailCollection = 'journal_lines';
    pb.failMessage = 'Database disk write failure on journal_lines';

    const cashFund = {
      id: 'csh_fund_cad',
      name: 'صندوق دلار کانادا',
      accountId: 'acc_cash_cad',
    };

    expect(
      postCashOpeningBalance(cashFund, 3000, '1403/01/01', userId, pb),
    ).rejects.toThrow('ثبت ردیف‌های سند حسابداری با خطا مواجه شد');

    // Rollback Verification: Parent journal entry must be cleaned up / deleted from DB
    const entries = pb.collections.get('journal_entries') || [];
    expect(entries).toHaveLength(0);
  });

  test('Unbalanced Journal Rejection: Rejects unbalanced entry before persisting', async () => {
    const pb = new MockPocketBaseService() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_1', code: '111001', name: 'حساب ۱', isActive: true },
      { id: 'acc_2', code: '3100', name: 'حساب ۲', isActive: true },
    ]);

    expect(
      postJournalEntry(
        {
          description: 'سند نامتوازن تست',
          sourceType: 'manual',
          sourceId: 'src_unbalanced',
          sourceKey: 'test:unbalanced',
          lines: [
            { accountId: 'acc_1', debit: 1000, credit: 0, description: 'بدهکار' },
            { accountId: 'acc_2', debit: 0, credit: 900, description: 'بستانکار' },
          ],
        },
        pb,
      ),
    ).rejects.toThrow('سند نامتوازن است');
  });
});
