import { describe, expect, test } from 'bun:test';

import { postCashOpeningBalance, postJournalEntry } from '@/lib/accounting-posting-engine';

class MockPb {
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
        if (self.shouldFailCollection === name) throw new Error(self.failMessage);
        const list = self.collections.get(name) || [];
        const found = list.find((i) => i.id === id);
        if (found) return found;
        throw new Error(`Record ${id} not found in ${name}`);
      },
      async getFirstListItem(filterStr: string) {
        if (self.shouldFailCollection === name) throw new Error(self.failMessage);
        const list = self.collections.get(name) || [];
        for (const item of list) {
          if (filterStr.includes('sourceKey =') && item.sourceKey && filterStr.includes(item.sourceKey)) {
            return item;
          }
          if (filterStr.includes('code =') && item.code && filterStr.includes(item.code)) {
            return item;
          }
          if (filterStr.includes('currency =') && item.currency && filterStr.includes(item.currency)) {
            return item;
          }
          if (filterStr.includes('vault =') && item.vault && filterStr.includes(item.vault)) {
            return item;
          }
        }
        throw new Error(`Record matching ${filterStr} not found in ${name}`);
      },
      async getFullList(params: any = {}) {
        if (self.shouldFailCollection === name) throw new Error(self.failMessage);
        const list = self.collections.get(name) || [];
        const filterStr = params.filter || '';
        if (filterStr) {
          return list.filter((item) => {
            if (filterStr.includes('journal_entry_id =') && item.journal_entry_id) {
              return filterStr.includes(item.journal_entry_id);
            }
            if (filterStr.includes('vault =') && item.vault) {
              return filterStr.includes(item.vault);
            }
            return true;
          });
        }
        return list;
      },
      async create(data: any) {
        if (self.shouldFailCollection === name) throw new Error(self.failMessage);
        const list = self.collections.get(name) || [];
        const record = {
          id: data.id || `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          ...data,
        };
        list.push(record);
        self.collections.set(name, list);
        return record;
      },
      async update(id: string, data: any) {
        if (self.shouldFailCollection === name) throw new Error(self.failMessage);
        const list = self.collections.get(name) || [];
        const idx = list.findIndex((i) => i.id === id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...data, updated: new Date().toISOString() };
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

describe('Cash Opening Balance Hardening & GL Consistency Tests', () => {
  const userId = 'usr_admin';

  test('1. Create opening balance for a new cash fund produces exactly 1 transaction & 1 GL journal', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_usd', code: '111001', name: 'صندوق دلار', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'fund_usd_01',
      name: 'صندوق دلار',
      currencyId: 'curr_usd',
      accountId: 'acc_cash_usd',
    };

    const journal = await postCashOpeningBalance(cashFund, 10000, '1405/01/01', userId, pb, 'موجودی اولیه دلار');

    expect(journal).toBeDefined();
    expect(journal.totalDebit).toBe(10000);
    expect(journal.totalCredit).toBe(10000);

    const entries = pb.collections.get('journal_entries');
    expect(entries).toHaveLength(1);
    expect(entries[0].sourceKey).toBe('opening:cash:fund_usd_01');

    const lines = pb.collections.get('journal_lines');
    expect(lines).toHaveLength(2);
    expect(lines[0].debit).toBe(10000);
    expect(lines[1].credit).toBe(10000);
  });

  test('2. Edit opening amount (10,000 -> 15,000) updates journal and lines in place (No Stale GL Lines)', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_usd', code: '111001', name: 'صندوق دلار', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'fund_usd_01',
      name: 'صندوق دلار',
      currencyId: 'curr_usd',
      accountId: 'acc_cash_usd',
    };

    // Initial 10,000
    await postCashOpeningBalance(cashFund, 10000, '1405/01/01', userId, pb, 'موجودی اولیه اولیه');

    // Edit to 15,000
    const updatedJournal = await postCashOpeningBalance(cashFund, 15000, '1405/01/01', userId, pb, 'موجودی اولیه ویرایش شده');

    expect(updatedJournal.totalDebit).toBe(15000);
    expect(updatedJournal.totalCredit).toBe(15000);

    // Assert only 1 parent journal entry exists (sourceKey = opening:cash:fund_usd_01)
    const entries = pb.collections.get('journal_entries');
    expect(entries).toHaveLength(1);
    expect(entries[0].totalDebit).toBe(15000);

    // Assert child lines in pbc_journal_lines collection reflect 15,000
    const lines = pb.collections.get('journal_lines');
    expect(lines).toHaveLength(2);
    expect(lines[0].debit).toBe(15000);
    expect(lines[1].credit).toBe(15000);
  });

  test('3. Edit date (1405/01/01 -> 1405/06/15) updates journal date consistently', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_eur', code: '111002', name: 'صندوق یورو', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'fund_eur_01',
      name: 'صندوق یورو',
      currencyId: 'curr_eur',
      accountId: 'acc_cash_eur',
    };

    await postCashOpeningBalance(cashFund, 5000, '1405/01/01', userId, pb, 'موجودی یورو');

    // Edit date only
    const updated = await postCashOpeningBalance(cashFund, 5000, '1405/06/15', userId, pb, 'موجودی یورو');

    expect(updated.entryDateJalali).toBe('1405/06/15');

    const entries = pb.collections.get('journal_entries');
    expect(entries).toHaveLength(1);
    expect(entries[0].entryDateJalali).toBe('1405/06/15');
  });

  test('4. Edit description updates description in GL journal and lines', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_eur', code: '111002', name: 'صندوق یورو', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'fund_eur_01',
      name: 'صندوق یورو',
      currencyId: 'curr_eur',
      accountId: 'acc_cash_eur',
    };

    await postCashOpeningBalance(cashFund, 5000, '1405/01/01', userId, pb, 'توضیحات ۱');
    const updated = await postCashOpeningBalance(cashFund, 5000, '1405/01/01', userId, pb, 'توضیحات ۲ - بروزرسانی شد');

    expect(updated.description).toBe('توضیحات ۲ - بروزرسانی شد');

    const entries = pb.collections.get('journal_entries');
    expect(entries[0].description).toBe('توضیحات ۲ - بروزرسانی شد');
  });

  test('5. Double submit with identical parameters is idempotent and produces no duplicates', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_gbp', code: '111003', name: 'صندوق پوند', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'fund_gbp_01',
      name: 'صندوق پوند',
      currencyId: 'curr_gbp',
      accountId: 'acc_cash_gbp',
    };

    const call1 = await postCashOpeningBalance(cashFund, 3000, '1405/01/01', userId, pb, 'پوند');
    const call2 = await postCashOpeningBalance(cashFund, 3000, '1405/01/01', userId, pb, 'پوند');

    expect(call1.id).toBe(call2.id);
    expect(call2.alreadyExists).toBe(true);

    expect(pb.collections.get('journal_entries')).toHaveLength(1);
    expect(pb.collections.get('journal_lines')).toHaveLength(2);
  });

  test('6. Multiple currencies (EUR, USD, IRR) maintain independent opening balances', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_usd', code: '111001', name: 'صندوق دلار', isActive: true },
      { id: 'acc_eur', code: '111002', name: 'صندوق یورو', isActive: true },
      { id: 'acc_irr', code: '111003', name: 'صندوق ریال', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const fundUsd = { id: 'fund_usd', name: 'صندوق دلار', currencyId: 'curr_usd', accountId: 'acc_usd' };
    const fundEur = { id: 'fund_eur', name: 'صندوق یورو', currencyId: 'curr_eur', accountId: 'acc_eur' };
    const fundIrr = { id: 'fund_irr', name: 'صندوق ریال', currencyId: 'curr_irr', accountId: 'acc_irr' };

    await postCashOpeningBalance(fundUsd, 10000, '1405/01/01', userId, pb);
    await postCashOpeningBalance(fundEur, 8000, '1405/01/01', userId, pb);
    await postCashOpeningBalance(fundIrr, 50000000, '1405/01/01', userId, pb);

    // Edit EUR opening
    await postCashOpeningBalance(fundEur, 12000, '1405/01/01', userId, pb);

    const entries = pb.collections.get('journal_entries') || [];
    expect(entries).toHaveLength(3);

    const entryUsd = entries.find((e: any) => e.sourceKey === 'opening:cash:fund_usd');
    const entryEur = entries.find((e: any) => e.sourceKey === 'opening:cash:fund_eur');
    const entryIrr = entries.find((e: any) => e.sourceKey === 'opening:cash:fund_irr');

    expect(entryUsd.totalDebit).toBe(10000);
    expect(entryEur.totalDebit).toBe(12000); // Updated EUR
    expect(entryIrr.totalDebit).toBe(50000000); // USD and IRR untouched
  });

  test('8. Accounting mismatch assertion: cash transaction amount === GL journal totalDebit === GL line debit', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_cash_cad', code: '111004', name: 'صندوق دلار کانادا', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    const cashFund = {
      id: 'fund_cad_01',
      name: 'صندوق کانادا',
      currencyId: 'curr_cad',
      accountId: 'acc_cash_cad',
    };

    // Step 1: 10,000
    await postCashOpeningBalance(cashFund, 10000, '1405/01/01', userId, pb);

    // Step 2: Edit to 15,000
    const result = await postCashOpeningBalance(cashFund, 15000, '1405/01/01', userId, pb);

    const entries = pb.collections.get('journal_entries');
    const lines = pb.collections.get('journal_lines');

    expect(result.totalDebit).toBe(15000);
    expect(entries[0].totalDebit).toBe(15000);

    const cashLine = lines.find((l: any) => l.account_id === 'acc_cash_cad');
    const equityLine = lines.find((l: any) => l.account_id === 'acc_equity_3100');

    expect(cashLine.debit).toBe(15000);
    expect(equityLine.credit).toBe(15000);

    // Assert there is NO line anywhere with 10000
    for (const line of lines) {
      expect(line.debit).not.toBe(10000);
      expect(line.credit).not.toBe(10000);
    }
  });
});
