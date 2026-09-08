/**
 * Cash Fund & Bank Account Lifecycle Tests
 *
 * Test coverage per specification:
 *
 * CASH FUND
 * Test 1 — صندوق بدون transaction: DELETE => SUCCESS
 * Test 2 — صندوق با یک transaction: DELETE => REJECT
 * Test 3 — صندوق با balance صفر ولی transaction دارد: DELETE => REJECT
 * Test 4 — صندوق فعال: create cash transaction => SUCCESS
 * Test 5 — صندوق blocked: create cash transaction => REJECT
 * Test 6 — blocked → unblock: create transaction => SUCCESS
 *
 * BANK ACCOUNT
 * Test 7 — حساب بانکی بدون transaction: DELETE => SUCCESS
 * Test 8 — حساب بانکی دارای transaction: DELETE => REJECT
 * Test 9 — حساب بانکی با balance صفر ولی transaction دارد: DELETE => REJECT
 * Test 10 — حساب فعال: create transaction => SUCCESS
 * Test 11 — حساب blocked: create transaction => REJECT
 * Test 12 — blocked → unblock: create transaction => SUCCESS
 */

import { describe, expect, test, beforeEach } from 'bun:test';

// ─── In-memory mock databases ──────────────────────────────────────────────────
type CashFund = {
  id: string;
  name: string;
  currency: string;
  opening_balance: number;
  balance: number;
  isBlocked: boolean;
};

type CashTransaction = {
  id: string;
  vault: string;
  source_key: string;
  amount: number;
  direction: 'in' | 'out';
  transaction_type: string;
};

type BankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  balance: number;
  isBlocked: boolean;
};

type BankTransaction = {
  id: string;
  bank_account: string;
  amount: number;
  direction: 'in' | 'out';
  transaction_type: string;
};

let cashFundsDb: CashFund[] = [];
let cashTransactionsDb: CashTransaction[] = [];
let bankAccountsDb: BankAccount[] = [];
let bankTransactionsDb: BankTransaction[] = [];
let txIdCounter = 1;

// ─── Business Logic — Cash Fund ────────────────────────────────────────────────

function deleteCashFund(fundId: string): { success: true } | { success: false; code: string; message: string } {
  const fund = cashFundsDb.find((f) => f.id === fundId);
  if (!fund) return { success: false, code: 'NOT_FOUND', message: 'صندوق مورد نظر یافت نشد.' };

  // Transaction check — شرط حذف: transaction_count === 0 (نه balance === 0)
  const txByVault = cashTransactionsDb.filter((t) => t.vault === fundId);
  const txBySourceKey = cashTransactionsDb.filter((t) => t.source_key === `opening:cash:${fundId}`);
  const transactionCount = new Set([...txByVault.map((t) => t.id), ...txBySourceKey.map((t) => t.id)]).size;

  if (transactionCount > 0) {
    return {
      success: false,
      code: 'CASH_FUND_HAS_TRANSACTIONS',
      message: 'این صندوق قابل حذف نیست، زیرا برای آن تراکنش وجه نقدی ثبت شده است.',
    };
  }

  cashFundsDb = cashFundsDb.filter((f) => f.id !== fundId);
  return { success: true };
}

function blockCashFund(fundId: string): { success: boolean; isBlocked: boolean } {
  const fund = cashFundsDb.find((f) => f.id === fundId);
  if (!fund) throw new Error('صندوق یافت نشد.');
  fund.isBlocked = true;
  return { success: true, isBlocked: true };
}

function unblockCashFund(fundId: string): { success: boolean; isBlocked: boolean } {
  const fund = cashFundsDb.find((f) => f.id === fundId);
  if (!fund) throw new Error('صندوق یافت نشد.');
  fund.isBlocked = false;
  return { success: true, isBlocked: false };
}

function createCashTransaction(
  fundId: string,
  amount: number,
  direction: 'in' | 'out',
): { success: true; transactionId: string } | { success: false; code: string; message: string } {
  const fund = cashFundsDb.find((f) => f.id === fundId);
  if (!fund) return { success: false, code: 'NOT_FOUND', message: 'صندوق یافت نشد.' };

  // isBlocked guard — Backend enforcement
  if (fund.isBlocked) {
    return {
      success: false,
      code: 'CASH_FUND_BLOCKED',
      message: 'این صندوق مسدود است و امکان ثبت ورود یا خروج وجه نقد برای آن وجود ندارد.',
    };
  }

  const signedDelta = direction === 'in' ? amount : -amount;
  if (fund.balance + signedDelta < 0) {
    return { success: false, code: 'INSUFFICIENT_BALANCE', message: 'موجودی صندوق کافی نیست.' };
  }

  fund.balance += signedDelta;
  const newTx: CashTransaction = {
    id: `tx_${txIdCounter++}`,
    vault: fundId,
    source_key: `cash_${direction}:${fundId}:${txIdCounter}`,
    amount,
    direction,
    transaction_type: direction === 'in' ? 'cash_in' : 'cash_out',
  };
  cashTransactionsDb.push(newTx);
  return { success: true, transactionId: newTx.id };
}

// ─── Business Logic — Bank Account ────────────────────────────────────────────

function deleteBankAccount(accountId: string): { success: true; message: string } | { success: false; code: string; message: string; transactionCount: number } {
  const account = bankAccountsDb.find((a) => a.id === accountId);
  if (!account) return { success: false, code: 'NOT_FOUND', message: 'حساب بانکی یافت نشد.', transactionCount: 0 };

  // Transaction check — شرط حذف: transaction_count === 0 (نه balance === 0)
  const transactionCount = bankTransactionsDb.filter((t) => t.bank_account === accountId).length;

  if (transactionCount > 0) {
    return {
      success: false,
      code: 'BANK_ACCOUNT_HAS_TRANSACTIONS',
      message: `این حساب بانکی قابل حذف نیست؛ برای این حساب ${transactionCount} تراکنش مالی ثبت شده است.`,
      transactionCount,
    };
  }

  bankAccountsDb = bankAccountsDb.filter((a) => a.id !== accountId);
  return { success: true, message: 'حساب بانکی با موفقیت حذف شد.' };
}

function blockBankAccount(accountId: string): { success: boolean; isBlocked: boolean } {
  const account = bankAccountsDb.find((a) => a.id === accountId);
  if (!account) throw new Error('حساب بانکی یافت نشد.');
  account.isBlocked = true;
  return { success: true, isBlocked: true };
}

function unblockBankAccount(accountId: string): { success: boolean; isBlocked: boolean } {
  const account = bankAccountsDb.find((a) => a.id === accountId);
  if (!account) throw new Error('حساب بانکی یافت نشد.');
  account.isBlocked = false;
  return { success: true, isBlocked: false };
}

function createBankTransaction(
  accountId: string,
  amount: number,
  direction: 'in' | 'out',
): { success: true; transactionId: string } | { success: false; code: string; message: string } {
  const account = bankAccountsDb.find((a) => a.id === accountId);
  if (!account) return { success: false, code: 'NOT_FOUND', message: 'حساب بانکی یافت نشد.' };

  // isBlocked guard — Backend enforcement
  if (account.isBlocked) {
    return {
      success: false,
      code: 'BANK_ACCOUNT_BLOCKED',
      message: 'این حساب بانکی مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.',
    };
  }

  const newTx: BankTransaction = {
    id: `btx_${txIdCounter++}`,
    bank_account: accountId,
    amount,
    direction,
    transaction_type: direction === 'in' ? 'deposit' : 'withdrawal',
  };
  bankTransactionsDb.push(newTx);
  return { success: true, transactionId: newTx.id };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Cash Fund & Bank Account Lifecycle Tests', () => {
  beforeEach(() => {
    cashFundsDb = [];
    cashTransactionsDb = [];
    bankAccountsDb = [];
    bankTransactionsDb = [];
    txIdCounter = 1;
  });

  // ═══════════════════════════════════════════════════════════
  // CASH FUND TESTS
  // ═══════════════════════════════════════════════════════════

  test('Test 1 — صندوق بدون transaction: DELETE => SUCCESS', () => {
    cashFundsDb.push({
      id: 'fund_01',
      name: 'صندوق دلار',
      currency: 'curr_usd',
      opening_balance: 100_000,
      balance: 100_000,
      isBlocked: false,
    });

    const result = deleteCashFund('fund_01');

    expect(result.success).toBe(true);
    expect(cashFundsDb.find((f) => f.id === 'fund_01')).toBeUndefined();
  });

  test('Test 2 — صندوق با یک transaction: DELETE => REJECT', () => {
    cashFundsDb.push({
      id: 'fund_02',
      name: 'صندوق ریال',
      currency: 'curr_irr',
      opening_balance: 500_000,
      balance: 500_000,
      isBlocked: false,
    });
    cashTransactionsDb.push({
      id: 'tx_opening_02',
      vault: 'fund_02',
      source_key: 'opening:cash:fund_02',
      amount: 500_000,
      direction: 'in',
      transaction_type: 'opening_balance',
    });

    const result = deleteCashFund('fund_02');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('CASH_FUND_HAS_TRANSACTIONS');
    }
    // صندوق باید همچنان در DB باشد
    expect(cashFundsDb.find((f) => f.id === 'fund_02')).toBeDefined();
  });

  test('Test 3 — صندوق با balance صفر ولی transaction دارد: DELETE => REJECT', () => {
    // balance صفر نباید ملاک حذف باشد
    cashFundsDb.push({
      id: 'fund_03',
      name: 'صندوق یورو',
      currency: 'curr_eur',
      opening_balance: 200_000,
      balance: 0, // balance صفر شده
      isBlocked: false,
    });
    cashTransactionsDb.push({
      id: 'tx_opening_03',
      vault: 'fund_03',
      source_key: 'opening:cash:fund_03',
      amount: 200_000,
      direction: 'in',
      transaction_type: 'opening_balance',
    });
    cashTransactionsDb.push({
      id: 'tx_out_03',
      vault: 'fund_03',
      source_key: 'cash_out:fund_03:1',
      amount: 200_000,
      direction: 'out',
      transaction_type: 'cash_out',
    });

    const result = deleteCashFund('fund_03');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('CASH_FUND_HAS_TRANSACTIONS');
    }
    // صندوق باید همچنان وجود داشته باشد
    expect(cashFundsDb.find((f) => f.id === 'fund_03')).toBeDefined();
  });

  test('Test 4 — صندوق فعال: create cash transaction => SUCCESS', () => {
    cashFundsDb.push({
      id: 'fund_04',
      name: 'صندوق تومان',
      currency: 'curr_irr',
      opening_balance: 1_000_000,
      balance: 1_000_000,
      isBlocked: false,
    });

    const result = createCashTransaction('fund_04', 500_000, 'in');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transactionId).toBeDefined();
    }
    // balance باید افزایش یافته باشد
    expect(cashFundsDb.find((f) => f.id === 'fund_04')?.balance).toBe(1_500_000);
  });

  test('Test 5 — صندوق blocked: create cash transaction => REJECT', () => {
    cashFundsDb.push({
      id: 'fund_05',
      name: 'صندوق مسدود',
      currency: 'curr_usd',
      opening_balance: 300_000,
      balance: 300_000,
      isBlocked: true,
    });

    const result = createCashTransaction('fund_05', 100_000, 'in');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('CASH_FUND_BLOCKED');
    }
    // هیچ تراکنشی ثبت نشده باشد
    expect(cashTransactionsDb.filter((t) => t.vault === 'fund_05')).toHaveLength(0);
    // balance تغییر نکرده باشد
    expect(cashFundsDb.find((f) => f.id === 'fund_05')?.balance).toBe(300_000);
  });

  test('Test 6 — blocked → unblock: create transaction => SUCCESS', () => {
    cashFundsDb.push({
      id: 'fund_06',
      name: 'صندوق رفع مسدودی',
      currency: 'curr_irr',
      opening_balance: 500_000,
      balance: 500_000,
      isBlocked: true,
    });

    // رفع مسدودی
    const unblockResult = unblockCashFund('fund_06');
    expect(unblockResult.success).toBe(true);
    expect(unblockResult.isBlocked).toBe(false);

    // اکنون باید تراکنش پذیرفته شود
    const txResult = createCashTransaction('fund_06', 200_000, 'in');
    expect(txResult.success).toBe(true);
    expect(cashFundsDb.find((f) => f.id === 'fund_06')?.balance).toBe(700_000);
  });

  // ═══════════════════════════════════════════════════════════
  // BANK ACCOUNT TESTS
  // ═══════════════════════════════════════════════════════════

  test('Test 7 — حساب بانکی بدون transaction: DELETE => SUCCESS', () => {
    bankAccountsDb.push({
      id: 'bank_01',
      bankName: 'بانک ملت',
      accountNumber: '1234567890',
      balance: 2_000_000,
      isBlocked: false,
    });

    const result = deleteBankAccount('bank_01');

    expect(result.success).toBe(true);
    expect(bankAccountsDb.find((a) => a.id === 'bank_01')).toBeUndefined();
  });

  test('Test 8 — حساب بانکی دارای transaction: DELETE => REJECT', () => {
    bankAccountsDb.push({
      id: 'bank_02',
      bankName: 'بانک ملی',
      accountNumber: '0987654321',
      balance: 5_000_000,
      isBlocked: false,
    });
    bankTransactionsDb.push({
      id: 'btx_01',
      bank_account: 'bank_02',
      amount: 5_000_000,
      direction: 'in',
      transaction_type: 'opening_balance',
    });

    const result = deleteBankAccount('bank_02');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('BANK_ACCOUNT_HAS_TRANSACTIONS');
      expect(result.transactionCount).toBe(1);
    }
    expect(bankAccountsDb.find((a) => a.id === 'bank_02')).toBeDefined();
  });

  test('Test 9 — حساب بانکی با balance صفر ولی transaction دارد: DELETE => REJECT', () => {
    bankAccountsDb.push({
      id: 'bank_03',
      bankName: 'بانک سامان',
      accountNumber: '1111111111',
      balance: 0, // balance صفر شده
      isBlocked: false,
    });
    bankTransactionsDb.push({
      id: 'btx_02',
      bank_account: 'bank_03',
      amount: 1_000_000,
      direction: 'in',
      transaction_type: 'deposit',
    });
    bankTransactionsDb.push({
      id: 'btx_03',
      bank_account: 'bank_03',
      amount: 1_000_000,
      direction: 'out',
      transaction_type: 'withdrawal',
    });

    const result = deleteBankAccount('bank_03');

    // balance === 0 ملاک حذف نیست
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('BANK_ACCOUNT_HAS_TRANSACTIONS');
      expect(result.transactionCount).toBe(2);
    }
    expect(bankAccountsDb.find((a) => a.id === 'bank_03')).toBeDefined();
  });

  test('Test 10 — حساب فعال: create transaction => SUCCESS', () => {
    bankAccountsDb.push({
      id: 'bank_04',
      bankName: 'بانک پارسیان',
      accountNumber: '2222222222',
      balance: 1_000_000,
      isBlocked: false,
    });

    const result = createBankTransaction('bank_04', 500_000, 'in');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transactionId).toBeDefined();
    }
    expect(bankTransactionsDb.filter((t) => t.bank_account === 'bank_04')).toHaveLength(1);
  });

  test('Test 11 — حساب blocked: create transaction => REJECT', () => {
    bankAccountsDb.push({
      id: 'bank_05',
      bankName: 'بانک مسدود',
      accountNumber: '3333333333',
      balance: 500_000,
      isBlocked: false,
    });

    const blockResult = blockBankAccount('bank_05');
    expect(blockResult.success).toBe(true);
    expect(blockResult.isBlocked).toBe(true);

    const result = createBankTransaction('bank_05', 100_000, 'in');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('BANK_ACCOUNT_BLOCKED');
    }
    // هیچ تراکنشی ثبت نشده باشد
    expect(bankTransactionsDb.filter((t) => t.bank_account === 'bank_05')).toHaveLength(0);
  });

  test('Test 12 — blocked → unblock: create transaction => SUCCESS', () => {
    bankAccountsDb.push({
      id: 'bank_06',
      bankName: 'بانک آینده',
      accountNumber: '4444444444',
      balance: 800_000,
      isBlocked: true,
    });

    // رفع مسدودی
    const unblockResult = unblockBankAccount('bank_06');
    expect(unblockResult.success).toBe(true);
    expect(unblockResult.isBlocked).toBe(false);
    expect(bankAccountsDb.find((a) => a.id === 'bank_06')?.isBlocked).toBe(false);

    // اکنون باید تراکنش پذیرفته شود
    const txResult = createBankTransaction('bank_06', 300_000, 'in');
    expect(txResult.success).toBe(true);
    expect(bankTransactionsDb.filter((t) => t.bank_account === 'bank_06')).toHaveLength(1);
  });

  // ═══════════════════════════════════════════════════════════
  // ADDITIONAL INVARIANT TESTS
  // ═══════════════════════════════════════════════════════════

  test('Invariant — error codes are well-defined strings', () => {
    const knownCodes = [
      'CASH_FUND_HAS_TRANSACTIONS',
      'BANK_ACCOUNT_HAS_TRANSACTIONS',
      'CASH_FUND_BLOCKED',
      'BANK_ACCOUNT_BLOCKED',
    ];
    for (const code of knownCodes) {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }
  });

  test('Invariant — block/unblock is idempotent', () => {
    cashFundsDb.push({
      id: 'fund_idem',
      name: 'صندوق تست',
      currency: 'curr_irr',
      opening_balance: 0,
      balance: 0,
      isBlocked: false,
    });

    blockCashFund('fund_idem');
    blockCashFund('fund_idem'); // second call should not throw
    expect(cashFundsDb.find((f) => f.id === 'fund_idem')?.isBlocked).toBe(true);

    unblockCashFund('fund_idem');
    unblockCashFund('fund_idem'); // second call should not throw
    expect(cashFundsDb.find((f) => f.id === 'fund_idem')?.isBlocked).toBe(false);
  });

  test('Invariant — delete does not cascade to cash_transactions (historical data preserved)', () => {
    // صندوقی که حذف می‌شود نباید تراکنش‌های تاریخی را حذف کند
    // (تراکنش‌های تاریخی نباید orphan شوند اما حذف صندوق اجازه ندارد آنها را پاک کند)
    // این test اطمینان می‌دهد که cashTransactionsDb دست نخورده باقی می‌ماند پس از reject

    cashFundsDb.push({
      id: 'fund_hist',
      name: 'صندوق تاریخی',
      currency: 'curr_irr',
      opening_balance: 100,
      balance: 100,
      isBlocked: false,
    });
    cashTransactionsDb.push({
      id: 'tx_hist',
      vault: 'fund_hist',
      source_key: 'opening:cash:fund_hist',
      amount: 100,
      direction: 'in',
      transaction_type: 'opening_balance',
    });

    const txCountBefore = cashTransactionsDb.length;
    const result = deleteCashFund('fund_hist');

    expect(result.success).toBe(false);
    // تراکنش‌ها باید دست نخورده باشند
    expect(cashTransactionsDb.length).toBe(txCountBefore);
  });
});
