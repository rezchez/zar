import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_METAL_ACCOUNT_MAPPING,
  resolveMetalAccountMapping,
  buildMetalPurchaseJournalLines,
  buildMetalSaleJournalLines,
} from '@/lib/metal-accounting';

describe('Metal Accounting Account Mapping', () => {
  it('provides complete default mapping matching standard Iranian chart of accounts', () => {
    expect(DEFAULT_METAL_ACCOUNT_MAPPING.metalInventoryAccountId).toBe('1130');
    expect(DEFAULT_METAL_ACCOUNT_MAPPING.goldSalesRevenueAccountId).toBe('4110');
    expect(DEFAULT_METAL_ACCOUNT_MAPPING.goldCostOfSalesAccountId).toBe('5200');
    expect(DEFAULT_METAL_ACCOUNT_MAPPING.counterpartyLiabilityAccountId).toBe('2120');
    expect(DEFAULT_METAL_ACCOUNT_MAPPING.counterpartyReceivableAccountId).toBe('1120');
  });

  it('generates balanced journal template lines for metal purchases', () => {
    const lines = buildMetalPurchaseJournalLines({
      amountRials: 150000000,
      weightGrams750: 25.5,
      customerId: 'cust_12',
      customerName: 'جواهر فروشی الماس',
    });

    expect(lines.length).toBe(2);
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    expect(totalDebit).toBe(150000000);
    expect(totalCredit).toBe(150000000);
    expect(totalDebit).toBe(totalCredit);
  });

  it('generates balanced journal template lines for metal sales', () => {
    const lines = buildMetalSaleJournalLines({
      salesRevenueRials: 200000000,
      costOfSalesRials: 180000000,
      weightGrams750: 30,
      customerId: 'cust_15',
      customerName: 'طلافروشی امید',
    });

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    expect(totalDebit).toBe(200000000);
    expect(totalCredit).toBe(200000000);
    expect(totalDebit).toBe(totalCredit);
  });
});
