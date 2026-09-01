import { describe, expect, test } from 'bun:test';

import { dateToJalaliString } from '../lib/jalali';

describe('Cash Funds & Cash Transactions Architecture & Rules', () => {
  // In-memory mock databases representing PocketBase collections
  const currenciesDb: Array<{ id: string; name: string; symbol: string; code: string }> = [
    { id: 'curr_usd', name: 'دلار آمریکا', symbol: '$', code: 'USD' },
    { id: 'curr_eur', name: 'یورو', symbol: '€', code: 'EUR' },
    { id: 'curr_irr', name: 'تومان', symbol: 'IRT', code: 'IRR' },
  ];

  const cashFundsDb: Array<{
    id: string;
    name: string;
    currency: string;
    currency_name: string;
    opening_balance: number;
    balance: number;
    created_by: string;
  }> = [];

  const cashTransactionsDb: Array<{
    id: string;
    vault: string;
    currency_ref: string;
    currency: string;
    currency_name: string;
    currency_symbol: string;
    amount: number;
    direction: 'in' | 'out';
    transaction_type: string;
    is_opening_balance: boolean;
    date: string;
    source_key: string;
  }> = [];

  // Service handler logic imitating POST /api/accounting/opening/cash
  function handleCashOpeningBalance(payload: {
    fundId?: string;
    currencyId?: string;
    name?: string;
    amount: number;
    date?: string;
    userId: string;
  }) {
    if (!Number.isFinite(payload.amount) || payload.amount < 0) {
      throw new Error('لطفاً مبلغ معتبری برای موجودی اولیه وارد کنید.');
    }
    const safeAmount = Math.abs(payload.amount);

    // MODE 1: EDIT EXISTING FUND
    if (payload.fundId) {
      const fund = cashFundsDb.find((f) => f.id === payload.fundId);
      if (!fund) throw new Error('صندوق مورد نظر یافت نشد.');

      const previousOpening = fund.opening_balance;
      const previousBalance = fund.balance;
      const nextBalance = previousBalance - previousOpening + safeAmount;

      if (nextBalance < 0) {
        throw new Error('موجودی صندوق نمی‌تواند منفی شود.');
      }

      fund.opening_balance = safeAmount;
      fund.balance = nextBalance;
      if (payload.name) fund.name = payload.name;

      const tx = cashTransactionsDb.find(
        (t) => t.vault === fund.id && (t.is_opening_balance || t.transaction_type === 'opening_balance'),
      );
      if (tx) {
        tx.amount = safeAmount;
        tx.direction = 'in';
        if (payload.date) tx.date = payload.date;
      }

      return { fund, transaction: tx };
    }

    // MODE 2: CREATE NEW FUND
    if (!payload.currencyId) {
      throw new Error('انتخاب ارز الزامی است.');
    }

    const currency = currenciesDb.find((c) => c.id === payload.currencyId);
    if (!currency) {
      throw new Error('ارز انتخاب‌شده در کالکشن ارزها یافت نشد.');
    }

    // Rule: Single Cash Fund per Currency Enforcement (Source of truth: currency relation)
    const existingFund = cashFundsDb.find((f) => f.currency === currency.id);
    if (existingFund) {
      throw new Error('برای این ارز قبلاً صندوق وجه نقد ایجاد شده است.');
    }

    const fundId = `fund_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fundName = payload.name || `صندوق ${currency.name}`;
    const dateValue = payload.date || dateToJalaliString(new Date());

    const fundRecord = {
      id: fundId,
      name: fundName,
      currency: currency.id,
      currency_name: currency.name,
      opening_balance: safeAmount,
      balance: safeAmount,
      created_by: payload.userId,
    };

    cashFundsDb.push(fundRecord);

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txRecord: (typeof cashTransactionsDb)[number] = {
      id: txId,
      vault: fundId,
      currency_ref: currency.id,
      currency: currency.code,
      currency_name: currency.name,
      currency_symbol: currency.symbol,
      amount: safeAmount,
      direction: 'in',
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: dateValue,
      source_key: `opening:cash:${currency.id}`,
    };

    cashTransactionsDb.push(txRecord);

    return {
      fund: fundRecord,
      transaction: txRecord,
    };
  }

  // Service handler logic imitating POST /api/cash-vault
  function handleCashTransaction(payload: {
    currencyId: string;
    amount: number;
    direction: 'in' | 'out';
    transactionType?: string;
    userId: string;
  }) {
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      throw new Error('مبلغ تراکنش باید عددی مثبت باشد.');
    }
    if (payload.direction !== 'in' && payload.direction !== 'out') {
      throw new Error('جهت تراکنش باید in یا out باشد.');
    }

    const fund = cashFundsDb.find((f) => f.currency === payload.currencyId);
    if (!fund) {
      throw new Error('صندوقی برای این ارز یافت نشد.');
    }

    const signedDelta = payload.direction === 'in' ? payload.amount : -payload.amount;
    const nextBalance = fund.balance + signedDelta;

    if (nextBalance < 0) {
      throw new Error('موجودی صندوق کافی نیست.');
    }

    fund.balance = nextBalance;

    const txRecord: (typeof cashTransactionsDb)[number] = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      vault: fund.id,
      currency_ref: payload.currencyId,
      currency: fund.currency_name,
      currency_name: fund.currency_name,
      currency_symbol: '$',
      amount: Math.abs(payload.amount),
      direction: payload.direction,
      transaction_type: payload.transactionType || (payload.direction === 'out' ? 'cash_out' : 'cash_in'),
      is_opening_balance: false,
      date: dateToJalaliString(new Date()),
      source_key: `tx:${Date.now()}`,
    };

    cashTransactionsDb.push(txRecord);

    return { fund, transaction: txRecord };
  }

  test('Test 1 — Currency reference exists in currencies collection', () => {
    const usd = currenciesDb.find((c) => c.code === 'USD');
    expect(usd).toBeDefined();
    expect(usd?.name).toBe('دلار آمریکا');
    expect(usd?.symbol).toBe('$');
  });

  test('Test 2 & 3 & 4 — Create USD Fund with Opening Balance 5000 and direction in', () => {
    const usd = currenciesDb.find((c) => c.code === 'USD')!;
    const result = handleCashOpeningBalance({
      currencyId: usd.id,
      name: 'صندوق دلار اصلی',
      amount: 5000,
      date: '1405/01/01',
      userId: 'user_1',
    });

    // Test 2: Successful creation
    expect(result.fund).toBeDefined();
    expect(result.fund.name).toBe('صندوق دلار اصلی');
    expect(result.fund.opening_balance).toBe(5000);

    // Test 3: Exactly one fund exists for USD
    const usdFunds = cashFundsDb.filter((f) => f.currency === usd.id);
    expect(usdFunds.length).toBe(1);

    // Test 4: Transaction has positive amount and direction 'in'
    const tx = cashTransactionsDb.find((t) => t.vault === result.fund.id);
    expect(tx).toBeDefined();
    expect(tx?.transaction_type).toBe('opening_balance');
    expect(tx?.direction).toBe('in');
    expect(tx?.amount).toBe(5000);
    expect(tx?.currency_ref).toBe(usd.id);
  });

  test('Test 5 — Current balance calculation using direction in/out', () => {
    const usd = currenciesDb.find((c) => c.code === 'USD')!;
    const fund = cashFundsDb.find((f) => f.currency === usd.id)!;

    // Perform Cash In 1000
    handleCashTransaction({
      currencyId: usd.id,
      amount: 1000,
      direction: 'in',
      userId: 'user_1',
    });

    // Perform Cash Out 750
    handleCashTransaction({
      currencyId: usd.id,
      amount: 750,
      direction: 'out',
      userId: 'user_1',
    });

    // Perform Cash Out 250
    handleCashTransaction({
      currencyId: usd.id,
      amount: 250,
      direction: 'out',
      userId: 'user_1',
    });

    const txs = cashTransactionsDb.filter((t) => t.vault === fund.id);

    // Calculate balance using strict direction rule: Σ(in) - Σ(out)
    const currentBalance = txs.reduce((acc, t) => {
      if (t.direction === 'in') return acc + t.amount;
      if (t.direction === 'out') return acc - t.amount;
      return acc;
    }, 0);

    // Initial: 5000 + 1000 - 750 - 250 = 5000
    expect(currentBalance).toBe(5000);
    expect(fund.balance).toBe(5000);

    // All transaction amounts MUST be strictly positive
    for (const t of txs) {
      expect(t.amount).toBeGreaterThan(0);
      expect(['in', 'out']).toContain(t.direction);
    }
  });

  test('Test 6 — Reject negative amount or invalid direction', () => {
    const usd = currenciesDb.find((c) => c.code === 'USD')!;

    expect(() => {
      handleCashTransaction({
        currencyId: usd.id,
        amount: -500,
        direction: 'out',
        userId: 'user_1',
      });
    }).toThrow('مبلغ تراکنش باید عددی مثبت باشد.');

    expect(() => {
      handleCashTransaction({
        currencyId: usd.id,
        amount: 500,
        direction: 'invalid' as any,
        userId: 'user_1',
      });
    }).toThrow('جهت تراکنش باید in یا out باشد.');
  });

  test('Test 7 — Duplicate fund creation for same currency fails', () => {
    const usd = currenciesDb.find((c) => c.code === 'USD')!;

    expect(() => {
      handleCashOpeningBalance({
        currencyId: usd.id,
        name: 'صندوق دلار شماره ۲',
        amount: 2000,
        userId: 'user_1',
      });
    }).toThrow('برای این ارز قبلاً صندوق وجه نقد ایجاد شده است.');
  });

  test('Test 8 — Creating fund for EUR (different currency) succeeds and shows in list', () => {
    const eur = currenciesDb.find((c) => c.code === 'EUR')!;

    // Ensure EUR has no funds before creation
    const eurFundsBefore = cashFundsDb.filter((f) => f.currency === eur.id);
    expect(eurFundsBefore.length).toBe(0);

    const result = handleCashOpeningBalance({
      currencyId: eur.id,
      amount: 3000,
      date: '1405/01/02',
      userId: 'user_1',
    });

    expect(result.fund).toBeDefined();
    expect(result.fund.currency).toBe(eur.id);
    expect(result.fund.opening_balance).toBe(3000);

    // Check EUR fund is visible in cash_funds list
    const eurFundsAfter = cashFundsDb.filter((f) => f.currency === eur.id);
    expect(eurFundsAfter.length).toBe(1);

    // Attempting duplicate EUR fund creation now fails
    expect(() => {
      handleCashOpeningBalance({
        currencyId: eur.id,
        amount: 1000,
        userId: 'user_1',
      });
    }).toThrow('برای این ارز قبلاً صندوق وجه نقد ایجاد شده است.');
  });

  test('Test 9 — Opening balance transaction retains direction in and positive amount', () => {
    const eur = currenciesDb.find((c) => c.code === 'EUR')!;
    const tx = cashTransactionsDb.find((t) => t.currency_ref === eur.id);

    expect(tx).toBeDefined();
    expect(tx?.direction).toBe('in');
    expect(tx?.amount).toBe(3000);
    expect(tx?.date).toBe('1405/01/02');
  });

  test('Test 10 — Editing cash opening balance updates fund balance and transaction positive amount', () => {
    const usd = currenciesDb.find((c) => c.code === 'USD')!;
    const fund = cashFundsDb.find((f) => f.currency === usd.id)!;

    const result = handleCashOpeningBalance({
      fundId: fund.id,
      amount: 7500,
      date: '1405/01/05',
      userId: 'user_1',
    });

    expect(result.fund.opening_balance).toBe(7500);
    expect(result.fund.balance).toBe(7500);

    const tx = cashTransactionsDb.find((t) => t.vault === fund.id && t.is_opening_balance);
    expect(tx?.amount).toBe(7500);
    expect(tx?.direction).toBe('in');
    expect(tx?.date).toBe('1405/01/05');
  });
});
