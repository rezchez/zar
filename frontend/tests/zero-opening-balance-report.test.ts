import { describe, expect, it } from 'bun:test';
import { isZeroOpeningBalanceTransaction, mapTransaction } from '@/lib/transaction';

function transaction(overrides: Record<string, unknown> = {}) {
  return mapTransaction({
    id: 'tx-1',
    transactionType: 'opening_balance',
    isOpeningBalance: true,
    sourceKey: 'opening:customer-1',
    goldAmount: 0,
    silverAmount: 0,
    platinumAmount: 0,
    rialAmount: 0,
    foreignAmount: 0,
    tertiaryAmount: 0,
    ...overrides,
  });
}

describe('zero opening balances in the comprehensive ledger report', () => {
  it('recognizes an opening balance with no amount in any balance field', () => {
    expect(isZeroOpeningBalanceTransaction(transaction())).toBe(true);
  });

  it('keeps an opening balance when any account amount is non-zero', () => {
    expect(isZeroOpeningBalanceTransaction(transaction({ goldAmount: 0.001 }))).toBe(false);
    expect(isZeroOpeningBalanceTransaction(transaction({ rialAmount: 1 }))).toBe(false);
    expect(isZeroOpeningBalanceTransaction(transaction({ foreignAmount: 1 }))).toBe(false);
  });

  it('does not classify a zero-valued regular transaction as an opening balance', () => {
    expect(
      isZeroOpeningBalanceTransaction(
        transaction({ transactionType: 'document', isOpeningBalance: false, sourceKey: 'document:1' }),
      ),
    ).toBe(false);
  });
});
