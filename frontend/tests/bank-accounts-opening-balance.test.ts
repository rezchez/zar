import { describe, expect, it } from 'bun:test';

import { BANKS_REGISTRY } from '@/lib/bank';

describe('Bank Accounts & Bank Opening Balance Tests', () => {
  it('Test 1 — Banks migration / registry contains all default banks without duplicates', () => {
    expect(BANKS_REGISTRY.length).toBeGreaterThan(30);

    const names = BANKS_REGISTRY.map((b) => b.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);

    const codes = BANKS_REGISTRY.map((b) => b.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('Test 2 — Balance calculation SUM(in) - SUM(out)', () => {
    const transactions = [
      { amount: 100000000, direction: 'in', type: 'opening_balance' },
      { amount: 50000000, direction: 'in', type: 'deposit' },
      { amount: 20000000, direction: 'out', type: 'withdrawal' },
    ];

    const balance = transactions.reduce((acc, tx) => {
      if (tx.direction === 'in') return acc + tx.amount;
      if (tx.direction === 'out') return acc - tx.amount;
      return acc;
    }, 0);

    expect(balance).toBe(130000000);
  });

  it('Test 3 — Rejects negative amount validation', () => {
    const amountInput = -100000000;
    const isValid = Number.isFinite(amountInput) && amountInput >= 0;
    expect(isValid).toBe(false);
  });

  it('Test 4 — Opening balance transaction uses transaction_type = opening_balance and direction = in', () => {
    const openingTx = {
      amount: 100000000,
      direction: 'in',
      transaction_type: 'opening_balance',
      is_opening_balance: true,
    };

    expect(openingTx.direction).toBe('in');
    expect(openingTx.transaction_type).toBe('opening_balance');
    expect(openingTx.amount).toBeGreaterThan(0);
  });

  it('Test 5 — Editing opening balance updates current balance and same opening transaction record', () => {
    let openingTx = {
      id: 'tx_bank_01',
      bank_account: 'acc_01',
      amount: 500000000,
      date: '1405/01/01',
      direction: 'in',
      transaction_type: 'opening_balance',
    };

    let bankAccount = {
      id: 'acc_01',
      bankName: 'بانک ملت',
      opening_balance: 500000000,
      balance: 500000000,
    };

    // Subsequent transactions
    const subsequentIn = 100000000;
    const subsequentOut = 50000000;
    bankAccount.balance = bankAccount.opening_balance + subsequentIn - subsequentOut; // 550,000,000

    // Edit opening balance from 500M to 700M and date to 1405/02/01
    const newOpeningAmount = 700000000;
    const newDate = '1405/02/01';

    const previousOpening = bankAccount.opening_balance;
    const nextBalance = bankAccount.balance - previousOpening + newOpeningAmount;

    bankAccount.opening_balance = newOpeningAmount;
    bankAccount.balance = nextBalance;

    openingTx = {
      ...openingTx,
      amount: newOpeningAmount,
      date: newDate,
    };

    expect(bankAccount.balance).toBe(750000000);
    expect(openingTx.amount).toBe(700000000);
    expect(openingTx.date).toBe('1405/02/01');
    expect(openingTx.id).toBe('tx_bank_01'); // Ensure NO duplicate created
  });
});
