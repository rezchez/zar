import { describe, expect, it } from 'bun:test';
import { parseTransactionBreakdown } from '@/features/customers/utils/document-breakdown';
import type { CustomerTransaction } from '@/lib/transaction';

describe('Customer Ledger Document Breakdown Tests', () => {
  it('correctly parses raw gold molten details with stamps and assay lab', () => {
    const tx = {
      id: 'tx1',
      transactionDate: '2026-10-20T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust1',
      goldAmount: 120.55,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      documentNumber: '1001',
      documentTab: 'raw-gold',
      documentSubType: 'incoming-molten',
      documentNature: 'received',
      documentDetails: JSON.stringify({
        rawKind: 'molten',
        rawWeight: 120.55,
        purity: 750,
        stampNumber: 'ANG-9872',
        labName: 'ری‌گیری عیار گستر',
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('gold-raw');
    expect(breakdown.categoryLabel).toBe('طلای آبشده');
    expect(breakdown.badgeColor).toBe('emerald');

    const labels = breakdown.attributes.map((a) => a.label);
    expect(labels).toContain('وزن ناخالص');
    expect(labels).toContain('عیار');
    expect(labels).toContain('شماره انگ');
    expect(labels).toContain('ری‌گیری (آزمایشگاه)');
  });

  it('correctly parses conditional gold with amber badge and conditional label', () => {
    const tx = {
      id: 'tx2',
      transactionDate: '2026-10-21T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust1',
      goldAmount: 50.0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      documentNumber: '1002',
      documentTab: 'raw-gold',
      documentSubType: 'incoming-conditional',
      documentDetails: JSON.stringify({
        rawKind: 'conditional',
        rawWeight: 50.0,
        purity: 750,
        isConditional: true,
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('gold-raw');
    expect(breakdown.categoryLabel).toBe('طلای آبشده شرطی');
    expect(breakdown.badgeColor).toBe('amber');

    const purityAttr = breakdown.attributes.find((a) => a.label === 'عیار موقت');
    expect(purityAttr).toBeDefined();
    expect(purityAttr?.value).toBe('750');
  });

  it('correctly parses bank check with sayad id and due date', () => {
    const tx = {
      id: 'tx3',
      transactionDate: '2026-10-22T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust2',
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 500000000,
      documentNumber: '1003',
      documentTab: 'bank',
      documentSubType: 'check-in',
      documentNature: 'received',
      documentDetails: JSON.stringify({
        checkNumber: '445566',
        sayadId: '1234567890123456',
        dueDateJalali: '1405/08/15',
        bankName: 'بانک ملت',
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('check');
    expect(breakdown.badgeColor).toBe('purple');
    expect(breakdown.categoryLabel).toBe('دریافت چک صیادی');

    const sayadAttr = breakdown.attributes.find((a) => a.label === 'شناسه صیاد');
    expect(sayadAttr?.value).toBe('1234567890123456');

    const dueAttr = breakdown.attributes.find((a) => a.label === 'سررسید چک');
    expect(dueAttr?.value).toBe('1405/08/15');
  });

  it('correctly parses discount transaction with percentage and amount', () => {
    const tx = {
      id: 'tx4',
      transactionDate: '2026-10-23T10:00:00Z',
      transactionType: 'document',
      customerId: 'cust1',
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: -10000000,
      documentNumber: '1004',
      documentTab: 'discount',
      documentSubType: 'discount-given',
      documentDetails: JSON.stringify({
        discountType: 'percentage',
        discountPercentage: 5,
        discountAmount: 10000000,
      }),
    } as unknown as CustomerTransaction;

    const breakdown = parseTransactionBreakdown(tx);
    expect(breakdown.category).toBe('discount');
    expect(breakdown.categoryLabel).toBe('تخفیف درصدی');
    expect(breakdown.badgeColor).toBe('rose');

    const pctAttr = breakdown.attributes.find((a) => a.label === 'درصد تخفیف');
    expect(pctAttr?.value).toBe('5٪');
  });
});
