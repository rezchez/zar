import { describe, expect, test } from 'bun:test';

import { dateToJalaliString } from '../lib/jalali';

describe('End-to-End Cash Funds Creation & Duplicate Prevention Flow', () => {
  // Database tables
  const currenciesTable: Array<{
    id: string;
    name: string;
    symbol: string;
    code: string;
  }> = [];

  const cashFundsTable: Array<{
    id: string;
    name: string;
    currency: string;
    currency_name: string;
    opening_balance: number;
    balance: number;
    created_by: string;
    created: string;
  }> = [];

  const cashTransactionsTable: Array<{
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

  // Step 1: Create Currency API Endpoint Simulation
  function createCurrencyApi(body: { name: string; symbol: string; code: string }) {
    const code = body.code.toUpperCase().trim();
    if (currenciesTable.some((c) => c.code === code)) {
      throw new Error(`ارز با کد ${code} قبلا وجود دارد.`);
    }
    const record = {
      id: `pbc_curr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: body.name.trim(),
      symbol: body.symbol.trim(),
      code,
    };
    currenciesTable.push(record);
    return record;
  }

  // Step 2: Create Cash Fund Opening Balance API Endpoint Simulation (POST /api/accounting/opening/cash)
  function createCashFundApi(body: {
    currencyId: string;
    name?: string;
    amount: number;
    date?: string;
    userId: string;
  }) {
    const currency = currenciesTable.find((c) => c.id === body.currencyId);
    if (!currency) {
      throw new Error('ارز انتخاب‌شده در کالکشن ارزها یافت نشد.');
    }

    const rawAmount = Number(body.amount);
    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      throw new Error('لطفاً مبلغ معتبری برای موجودی اولیه وارد کنید.');
    }
    const safeAmount = Math.abs(Math.round(rawAmount));

    // Duplicate Check: Single cash fund per currency
    const existingFund = cashFundsTable.find((f) => f.currency === currency.id);
    if (existingFund) {
      throw new Error('برای این واحد پولی قبلا صندوق ایجاد شده است.');
    }

    const fundId = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const fundName = body.name?.trim() || `صندوق ${currency.name}`;
    const dateValue = body.date?.trim() || dateToJalaliString(new Date());

    const fundRecord = {
      id: fundId,
      name: fundName,
      currency: currency.id,
      currency_name: currency.name,
      opening_balance: safeAmount,
      balance: safeAmount,
      created_by: body.userId,
      created: new Date().toISOString(),
    };
    cashFundsTable.push(fundRecord);

    const txRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      vault: fundId,
      currency_ref: currency.id,
      currency: currency.code,
      currency_name: currency.name,
      currency_symbol: currency.symbol,
      amount: safeAmount,
      direction: 'in' as const,
      transaction_type: 'opening_balance',
      is_opening_balance: true,
      date: dateValue,
      source_key: `opening:cash:${currency.id}`,
    };
    cashTransactionsTable.push(txRecord);

    return {
      success: true,
      fund: {
        id: fundRecord.id,
        name: fundName,
        currencyId: currency.id,
        currencyName: currency.name,
        currencyCode: currency.code,
        currencySymbol: currency.symbol,
        openingBalance: safeAmount,
        balance: safeAmount,
        openingBalanceDate: dateValue,
      },
      transaction: txRecord,
    };
  }

  // Step 3: Fetch Cash Funds List API Endpoint Simulation (GET /api/accounting/opening/cash)
  function getCashFundsListApi() {
    const currencyMap = new Map(currenciesTable.map((c) => [c.id, c]));
    const txMap = new Map(
      cashTransactionsTable
        .filter((t) => t.is_opening_balance || t.transaction_type === 'opening_balance')
        .map((t) => [t.vault, t]),
    );

    const funds = cashFundsTable.map((f) => {
      const currency = currencyMap.get(f.currency);
      const currencyId = String(f.currency || currency?.id || '');
      const currencyName = String(currency?.name || f.currency_name || 'ارز نامشخص');
      const currencyCode = String(currency?.code || '');
      const currencySymbol = String(currency?.symbol || '');
      const fundName = String(f.name || `صندوق ${currencyName}`).trim();

      const tx = txMap.get(f.id);
      const openingDate = String(tx?.date || dateToJalaliString(new Date()));

      return {
        id: f.id,
        name: fundName,
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: Math.abs(Number(f.opening_balance ?? tx?.amount ?? 0)),
        balance: Number(f.balance ?? 0),
        openingBalanceDate: openingDate,
      };
    });

    return { funds };
  }

  test('Step 1: Create new Currency Test Dollar (TUSD)', () => {
    const currency = createCurrencyApi({
      name: 'Test Dollar',
      symbol: 'TUSD',
      code: 'TUSD',
    });

    expect(currency).toBeDefined();
    expect(currency.name).toBe('Test Dollar');
    expect(currency.code).toBe('TUSD');
    expect(currency.symbol).toBe('TUSD');
  });

  test('Step 2: Create Test Cash Fund for TUSD with opening balance 5000', () => {
    const tusdCurrency = currenciesTable.find((c) => c.code === 'TUSD')!;
    const response = createCashFundApi({
      currencyId: tusdCurrency.id,
      name: 'Test Cash Fund',
      amount: 5000,
      date: '1405/01/01',
      userId: 'admin_1',
    });

    expect(response.success).toBe(true);
    expect(response.fund.name).toBe('Test Cash Fund');
    expect(response.fund.currencyCode).toBe('TUSD');
    expect(response.fund.openingBalance).toBe(5000);
    expect(response.fund.balance).toBe(5000);

    // Database assertions
    const fundInDb = cashFundsTable.find((f) => f.id === response.fund.id);
    expect(fundInDb).toBeDefined();
    expect(fundInDb?.name).toBe('Test Cash Fund');
    expect(fundInDb?.opening_balance).toBe(5000);

    const txInDb = cashTransactionsTable.find((t) => t.vault === response.fund.id);
    expect(txInDb).toBeDefined();
    expect(txInDb?.transaction_type).toBe('opening_balance');
    expect(txInDb?.direction).toBe('in');
    expect(txInDb?.amount).toBe(5000);
    expect(txInDb?.date).toBe('1405/01/01');
  });

  test('Step 3: Get cash funds list contains newly created Test Cash Fund', () => {
    const listResponse = getCashFundsListApi();
    expect(listResponse.funds.length).toBe(1);

    const fund = listResponse.funds[0];
    expect(fund.name).toBe('Test Cash Fund');
    expect(fund.currencyName).toBe('Test Dollar');
    expect(fund.currencySymbol).toBe('TUSD');
    expect(fund.openingBalance).toBe(5000);
    expect(fund.balance).toBe(5000);
    expect(fund.openingBalanceDate).toBe('1405/01/01');
  });

  test('Step 4: Creating second Cash Fund for TUSD fails with Duplicate Error', () => {
    const tusdCurrency = currenciesTable.find((c) => c.code === 'TUSD')!;

    expect(() => {
      createCashFundApi({
        currencyId: tusdCurrency.id,
        name: 'Second Cash Fund TUSD',
        amount: 2000,
        userId: 'admin_1',
      });
    }).toThrow('برای این واحد پولی قبلا صندوق ایجاد شده است.');

    // List count remains 1
    const listResponse = getCashFundsListApi();
    expect(listResponse.funds.length).toBe(1);
  });
});
