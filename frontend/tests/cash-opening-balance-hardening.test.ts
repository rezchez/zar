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
        let filtered = list;
        if (filterStr) {
          filtered = list.filter((item) => {
            if (filterStr.includes('journal_entry_id =') && item.journal_entry_id) {
              return filterStr.includes(item.journal_entry_id);
            }
            const matchVault = filterStr.includes('vault =') && item.vault && filterStr.includes(item.vault);
            const matchSourceKey = filterStr.includes('source_key =') && item.source_key && filterStr.includes(item.source_key);
            const matchCurrencyRef = filterStr.includes('currency_ref =') && item.currency_ref && filterStr.includes(item.currency_ref);
            if (filterStr.includes('||')) {
              return Boolean(matchVault || matchSourceKey || matchCurrencyRef);
            }
            if (matchVault || matchSourceKey || matchCurrencyRef) {
              return true;
            }
            if (filterStr.includes('is_opening_balance') && (item.is_opening_balance || item.transaction_type === 'opening_balance')) {
              return true;
            }
            return false;
          });
        }
        if (params.sort) {
          const sortField = params.sort.replace(/^[-+]/, '');
          const desc = params.sort.startsWith('-');
          filtered = [...filtered].sort((a, b) => {
            const valA = a[sortField] || '';
            const valB = b[sortField] || '';
            return desc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
          });
        }
        return filtered;
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

  // Helper mimicking route.ts backend logic
  async function executeCashOpeningEdit(pb: any, params: { fundId: string; date: string; amount?: number; description?: string }) {
    const existingFund = await pb.collection('cash_funds').getOne(params.fundId);
    const currencyId = String(existingFund.currency || '');
    const primarySourceKey = `opening:cash:${existingFund.id}`;
    const altSourceKey = currencyId ? `opening:cash:${currencyId}` : '';
    const amount = params.amount !== undefined ? params.amount : Number(existingFund.opening_balance || 0);

    // Step 1: Query by vault and sourceKey
    let vaultOpeningTxs: any[] = [];
    try {
      const filterConditions = ['vault = {:vaultId}', 'source_key = {:primarySk}'];
      const filterParams: Record<string, string> = {
        vaultId: existingFund.id,
        primarySk: primarySourceKey,
      };
      if (altSourceKey) {
        filterConditions.push('source_key = {:altSk}');
        filterParams.altSk = altSourceKey;
      }

      vaultOpeningTxs = await pb.collection('cash_transactions').getFullList({
        filter: pb.filter(filterConditions.join(' || '), filterParams),
      });
    } catch {
      vaultOpeningTxs = [];
    }

    // Step 2: Fallback to currency_ref lookup for legacy unmigrated rows
    if (vaultOpeningTxs.length === 0 && currencyId) {
      try {
        vaultOpeningTxs = await pb.collection('cash_transactions').getFullList({
          filter: pb.filter(
            'currency_ref = {:currencyId} && (is_opening_balance = true || transaction_type = "opening_balance")',
            { currencyId },
          ),
        });
      } catch {
        vaultOpeningTxs = [];
      }
    }

    // Canonical Record Selection Rule:
    const canonicalTx = vaultOpeningTxs.find((t: any) => t.source_key === primarySourceKey)
      || vaultOpeningTxs.find((t: any) => t.vault === existingFund.id)
      || vaultOpeningTxs[0]
      || null;

    const dateValue = params.date;
    let persistedTxId = '';

    // Resolve currency from collection or fund
    let currencyRecord: any = null;
    try {
      currencyRecord = await pb.collection('currencies').getOne(currencyId);
    } catch {}
    const currencyName = String(currencyRecord?.name || existingFund.currency_name || 'ارز نامشخص');
    let currencyCode = String(currencyRecord?.code || existingFund.code || '').trim().toUpperCase();
    let currencySymbol = String(currencyRecord?.symbol || '').trim();

    if (!currencyCode && canonicalTx?.currency) {
      currencyCode = String(canonicalTx.currency).trim().toUpperCase();
    }
    if (!currencySymbol && canonicalTx?.currency_symbol) {
      currencySymbol = String(canonicalTx.currency_symbol).trim();
    }
    if (!currencySymbol) {
      currencySymbol = currencyCode;
    }
    const finalCurrencyCode = (currencyCode || 'IRT').slice(0, 16);

    if (canonicalTx) {
      persistedTxId = canonicalTx.id;
      await pb.collection('cash_transactions').update(canonicalTx.id, {
        vault: existingFund.id,
        currency_ref: currencyId || canonicalTx.currency_ref || undefined,
        currency: finalCurrencyCode,
        currency_name: currencyName.slice(0, 32),
        currency_symbol: currencySymbol,
        amount,
        direction: 'in',
        source_key: primarySourceKey,
        transaction_type: 'opening_balance',
        is_opening_balance: true,
        date: dateValue,
        description: params.description || `موجودی اول دوره صندوق - ${currencySymbol}`,
      });

      // Strictly ONE row in cash_transactions: delete duplicates
      const duplicates = vaultOpeningTxs.filter((t: any) => t.id !== canonicalTx.id);
      for (const dup of duplicates) {
        await pb.collection('cash_transactions').delete(dup.id);
      }
    } else {
      const created = await pb.collection('cash_transactions').create({
        vault: existingFund.id,
        currency_ref: currencyId || undefined,
        currency: finalCurrencyCode,
        currency_name: currencyName.slice(0, 32),
        currency_symbol: currencySymbol,
        amount,
        direction: 'in',
        source_key: primarySourceKey,
        transaction_type: 'opening_balance',
        is_opening_balance: true,
        date: dateValue,
        description: params.description || `موجودی اول دوره صندوق - ${currencySymbol}`,
        created_by: userId,
      });
      persistedTxId = created.id;
    }

    await postCashOpeningBalance(
      {
        id: existingFund.id,
        name: existingFund.name,
        currencyId: existingFund.currency,
        accountId: existingFund.accountId,
      },
      amount,
      dateValue,
      userId,
      pb,
    );

    return { txId: persistedTxId, date: dateValue, canonicalTx };
  }

  test('9. Exact regression test (Step 15): Repeated date edits preserve exact ID across 3 consecutive edits', async () => {
    const pb = new MockPb() as any;

    const fundA = {
      id: 'FUND_A',
      name: 'صندوق دلار',
      opening_balance: 5000,
      balance: 5000,
      currency: 'curr_usd',
      currency_name: 'دلار',
      accountId: 'acc_usd',
    };
    pb.collections.set('cash_funds', [fundA]);

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_usd', code: '111001', name: 'صندوق دلار', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    // Initial state: ID = TX_A, date = 1405/01/01
    const txA = await pb.collection('cash_transactions').create({
      id: 'TX_A',
      vault: fundA.id,
      currency_ref: fundA.currency,
      currency: 'USD',
      currency_name: fundA.currency_name,
      amount: 5000,
      direction: 'in',
      source_key: `opening:cash:${fundA.id}`,
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: '1405/01/01',
      description: 'موجودی اولیه دلار',
      created: '2026-01-01T00:00:00.000Z',
    });

    expect(txA.id).toBe('TX_A');
    expect(txA.date).toBe('1405/01/01');

    // Edit 1: 1405/06/15
    const edit1 = await executeCashOpeningEdit(pb, { fundId: 'FUND_A', date: '1405/06/15' });
    let txs = pb.collections.get('cash_transactions') || [];
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe('TX_A');
    expect(txs[0].date).toBe('1405/06/15');
    expect(edit1.txId).toBe('TX_A');

    // Edit 2: 1405/06/20
    const edit2 = await executeCashOpeningEdit(pb, { fundId: 'FUND_A', date: '1405/06/20' });
    txs = pb.collections.get('cash_transactions') || [];
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe('TX_A');
    expect(txs[0].date).toBe('1405/06/20');
    expect(edit2.txId).toBe('TX_A');

    // Edit 3: 1405/06/25
    const edit3 = await executeCashOpeningEdit(pb, { fundId: 'FUND_A', date: '1405/06/25' });
    txs = pb.collections.get('cash_transactions') || [];
    expect(txs).toHaveLength(1);
    expect(txs[0].id).toBe('TX_A');
    expect(txs[0].date).toBe('1405/06/25');
    expect(edit3.txId).toBe('TX_A');
  });

  test('10. Multiple Funds test (Step 16): Editing FUND_A date leaves FUND_B untouched', async () => {
    const pb = new MockPb() as any;

    const fundA = {
      id: 'FUND_A',
      name: 'صندوق دلار',
      opening_balance: 5000,
      balance: 5000,
      currency: 'curr_usd',
      currency_name: 'دلار',
      accountId: 'acc_usd',
    };
    const fundB = {
      id: 'FUND_B',
      name: 'صندوق یورو',
      opening_balance: 8000,
      balance: 8000,
      currency: 'curr_eur',
      currency_name: 'یورو',
      accountId: 'acc_eur',
    };
    pb.collections.set('cash_funds', [fundA, fundB]);

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_usd', code: '111001', name: 'صندوق دلار', isActive: true },
      { id: 'acc_eur', code: '111002', name: 'صندوق یورو', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    // Initial transactions
    await pb.collection('cash_transactions').create({
      id: 'TX_A',
      vault: fundA.id,
      currency_ref: fundA.currency,
      amount: 5000,
      direction: 'in',
      source_key: `opening:cash:${fundA.id}`,
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: '1405/01/01',
      created: '2026-01-01T00:00:00.000Z',
    });
    await pb.collection('cash_transactions').create({
      id: 'TX_B',
      vault: fundB.id,
      currency_ref: fundB.currency,
      amount: 8000,
      direction: 'in',
      source_key: `opening:cash:${fundB.id}`,
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: '1405/01/01',
      created: '2026-01-01T00:00:00.000Z',
    });

    // Edit FUND_A date
    await executeCashOpeningEdit(pb, { fundId: 'FUND_A', date: '1405/06/15' });

    const allTxs = pb.collections.get('cash_transactions') || [];
    expect(allTxs).toHaveLength(2);

    const txA = allTxs.find((t: any) => t.id === 'TX_A');
    expect(txA).toBeDefined();
    expect(txA.date).toBe('1405/06/15');
    expect(txA.vault).toBe('FUND_A');

    const txB = allTxs.find((t: any) => t.id === 'TX_B');
    expect(txB).toBeDefined();
    expect(txB.date).toBe('1405/01/01'); // Unmodified
    expect(txB.vault).toBe('FUND_B');
  });

  test('11. Legacy duplicates handling (Step 12 & 13): Identifies canonical record, updates in place, prevents TX_D', async () => {
    const pb = new MockPb() as any;

    const fundA = {
      id: 'FUND_A',
      name: 'صندوق یورو',
      opening_balance: 1230,
      balance: 1230,
      currency: 'curr_eur',
      currency_name: 'یورو',
      accountId: 'acc_eur',
    };
    pb.collections.set('cash_funds', [fundA]);

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_eur', code: '111002', name: 'صندوق یورو', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    // Simulate pre-existing legacy duplicates without vault or source_key
    await pb.collection('cash_transactions').create({
      id: 'TX_1',
      currency_ref: 'curr_eur',
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: '1405/01/01',
      created: '2026-01-01T00:00:00.000Z',
    });
    await pb.collection('cash_transactions').create({
      id: 'TX_2',
      currency_ref: 'curr_eur',
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: '1405/06/01',
      created: '2026-06-01T00:00:00.000Z',
    });
    await pb.collection('cash_transactions').create({
      id: 'TX_3',
      currency_ref: 'curr_eur',
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: '1405/06/03',
      created: '2026-06-03T00:00:00.000Z',
    });

    let allTxs = pb.collections.get('cash_transactions') || [];
    expect(allTxs).toHaveLength(3);

    // Edit date to 1405/06/15: canonical record is updated, duplicates deleted, count becomes strictly 1
    const edit1 = await executeCashOpeningEdit(pb, { fundId: 'FUND_A', date: '1405/06/15' });

    allTxs = pb.collections.get('cash_transactions') || [];
    // Must delete duplicates; count becomes strictly 1
    expect(allTxs).toHaveLength(1);
    // Canonical record is TX_1 (earliest created)
    expect(edit1.txId).toBe('TX_1');

    const canonical = allTxs[0];
    expect(canonical.id).toBe('TX_1');
    expect(canonical.date).toBe('1405/06/15');
    expect(canonical.vault).toBe('FUND_A');
    expect(canonical.source_key).toBe('opening:cash:FUND_A');

    // Subsequent edit to 1405/06/20: count remains strictly 1 and ID remains TX_1
    const edit2 = await executeCashOpeningEdit(pb, { fundId: 'FUND_A', date: '1405/06/20' });
    allTxs = pb.collections.get('cash_transactions') || [];
    expect(allTxs).toHaveLength(1);
    expect(edit2.txId).toBe('TX_1');
    expect(allTxs[0].date).toBe('1405/06/20');
  });

  test('12. Currency preservation on edit: Does NOT convert foreign currency (GBP, EUR, USD) to IRT', async () => {
    const pb = new MockPb() as any;

    pb.collections.set('currencies', [
      { id: 'curr_gbp', name: 'پوند', code: 'GBP', symbol: '£' },
      { id: 'curr_eur', name: 'یورو', code: 'EUR', symbol: '€' },
      { id: 'curr_usd', name: 'دلار آمریکا', code: 'USD', symbol: '$' },
      { id: 'curr_irt', name: 'تومان', code: 'IRT', symbol: 'IRT' },
    ]);

    const gbpFund = {
      id: 'FUND_GBP',
      name: 'صندوق پوند',
      opening_balance: 500,
      balance: 500,
      currency: 'curr_gbp',
      currency_name: 'پوند',
      accountId: 'acc_gbp',
    };
    pb.collections.set('cash_funds', [gbpFund]);

    pb.collections.set('chart_of_accounts', [
      { id: 'acc_gbp', code: '111003', name: 'صندوق پوند', isActive: true },
      { id: 'acc_equity_3100', code: '3100', name: 'سرمایه اول دوره', isActive: true },
    ]);

    // Initial transaction created with GBP
    await pb.collection('cash_transactions').create({
      id: 'TX_GBP',
      vault: 'FUND_GBP',
      currency_ref: 'curr_gbp',
      currency: 'GBP',
      currency_name: 'پوند',
      currency_symbol: '£',
      amount: 500,
      direction: 'in',
      source_key: 'opening:cash:FUND_GBP',
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: '1405/01/01',
      created: '2026-01-01T00:00:00.000Z',
    });

    // User edits the date and amount
    const editResult = await executeCashOpeningEdit(pb, {
      fundId: 'FUND_GBP',
      date: '1405/06/15',
      amount: 600,
      description: 'موجودی ویرایش‌شده صندوق پوند',
    });

    expect(editResult.txId).toBe('TX_GBP');

    const allTxs = pb.collections.get('cash_transactions') || [];
    expect(allTxs).toHaveLength(1);

    const updatedTx = allTxs[0];
    expect(updatedTx.id).toBe('TX_GBP');
    expect(updatedTx.date).toBe('1405/06/15');
    expect(updatedTx.amount).toBe(600);
    // CRITICAL: Currency must remain GBP, NOT IRT!
    expect(updatedTx.currency).toBe('GBP');
    expect(updatedTx.currency_symbol).toBe('£');
    expect(updatedTx.currency_name).toBe('پوند');
    expect(updatedTx.currency_ref).toBe('curr_gbp');
  });
});


