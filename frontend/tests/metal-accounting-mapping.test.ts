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

  it('generates accurate journal lines for metal sales with negative rounding difference (round down / expense)', () => {
    // Exact: 3,328,870,216 IRR, Rounded: 3,328,870,000 IRR, Difference: -216 IRR
    const lines = buildMetalSaleJournalLines({
      salesRevenueRials: 3328870000,
      exactRevenueRials: 3328870216,
      roundingDifference: -216,
      weightGrams750: 25.123,
      customerId: 'cust_20',
      customerName: 'جواهرات کیهان',
    });

    expect(lines.length).toBe(3);

    const customerLine = lines.find((l) => l.accountCode === '1120');
    const roundingLine = lines.find((l) => l.accountCode === '6500');
    const revenueLine = lines.find((l) => l.accountCode === '4110');

    expect(customerLine).toBeDefined();
    expect(customerLine?.debit).toBe(3328870000); // Charged to customer
    expect(customerLine?.credit).toBe(0);

    expect(roundingLine).toBeDefined();
    expect(roundingLine?.debit).toBe(216); // Other operating expense (account 6500)
    expect(roundingLine?.credit).toBe(0);
    expect(roundingLine?.description).toContain('تعدیلات و کسر ناشی از گرد کردن');

    expect(revenueLine).toBeDefined();
    expect(revenueLine?.debit).toBe(0);
    expect(revenueLine?.credit).toBe(3328870216); // Exact goods value revenue

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBe(3328870216);
    expect(totalCredit).toBe(3328870216);
    expect(totalDebit).toBe(totalCredit);
  });

  it('generates accurate journal lines for metal sales with positive rounding difference (round up / income)', () => {
    // Exact: 3,328,870,216 IRR, Rounded: 3,329,000,000 IRR, Difference: +129,784 IRR
    const lines = buildMetalSaleJournalLines({
      salesRevenueRials: 3329000000,
      exactRevenueRials: 3328870216,
      roundingDifference: 129784,
      weightGrams750: 25.123,
      customerId: 'cust_20',
      customerName: 'جواهرات کیهان',
    });

    expect(lines.length).toBe(3);

    const customerLine = lines.find((l) => l.accountCode === '1120');
    const revenueLine = lines.find((l) => l.accountCode === '4110');
    const roundingIncomeLine = lines.find((l) => l.accountCode === '4300');

    expect(customerLine).toBeDefined();
    expect(customerLine?.debit).toBe(3329000000); // Charged to customer
    expect(customerLine?.credit).toBe(0);

    expect(revenueLine).toBeDefined();
    expect(revenueLine?.debit).toBe(0);
    expect(revenueLine?.credit).toBe(3328870216); // Exact goods revenue

    expect(roundingIncomeLine).toBeDefined();
    expect(roundingIncomeLine?.debit).toBe(0);
    expect(roundingIncomeLine?.credit).toBe(129784); // Other revenue (account 4300)
    expect(roundingIncomeLine?.description).toContain('اضافه ناشی از گرد کردن');

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebit).toBe(3329000000);
    expect(totalCredit).toBe(3329000000);
    expect(totalDebit).toBe(totalCredit);
  });

  it('generates accurate journal lines for metal purchases with rounding adjustments', () => {
    // Purchase round down: Exact 100,000,500, paid 100,000,000, diff: -500 (gain)
    const linesDown = buildMetalPurchaseJournalLines({
      amountRials: 100000000,
      exactAmountRials: 100000500,
      roundingDifference: -500,
      weightGrams750: 10,
      customerId: 'supplier_1',
      customerName: 'تامین کننده طلا',
    });

    expect(linesDown.length).toBe(3);
    const invLine = linesDown.find((l) => l.accountCode === '1130');
    const supLine = linesDown.find((l) => l.accountCode === '2120');
    const incLine = linesDown.find((l) => l.accountCode === '4300');

    expect(invLine?.debit).toBe(100000500);
    expect(supLine?.credit).toBe(100000000);
    expect(incLine?.credit).toBe(500);
    expect(linesDown.reduce((s, l) => s + l.debit, 0)).toBe(linesDown.reduce((s, l) => s + l.credit, 0));
  });
});

