import { describe, expect, it } from 'bun:test';

import {
  buildDiscountJournalLines,
  DEFAULT_DISCOUNT_ACCOUNT_MAPPING,
} from '@/features/accounting/posting/discount-accounting';
import { calculateDocumentItemsFinancialBase } from '@/features/accounting/documents/components/DiscountTab';
import {
  getLineDocumentTypeLabel,
  sanitizeLineDetailsForTab,
  sanitizeDocumentLine,
} from '@/features/accounting/documents/utils/document-helpers';
import {
  createLine,
  isLineReady,
  validateLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

describe('Discount Accounting Posting (Double-Entry General Ledger)', () => {
  it('builds balanced journal lines for discount given to customer (تخفیف اعطایی)', () => {
    const lines = buildDiscountJournalLines({
      direction: 'given',
      amountRials: 50_000_000,
      discountPercentage: 5,
      baseAmountRials: 1_000_000_000,
      customerId: 'cust_123',
      customerName: 'علی محمدی',
      documentNumber: 'DOC-1001',
    });

    expect(lines).toHaveLength(2);

    // 1. Debit: Sales Discount (4160)
    const debitLine = lines.find((l) => l.debit > 0);
    expect(debitLine).toBeDefined();
    expect(debitLine?.accountCode).toBe('4160');
    expect(debitLine?.debit).toBe(50_000_000);
    expect(debitLine?.credit).toBe(0);
    expect(debitLine?.description).toContain('تخفیف اعطایی (5٪ از مبلغ پایه)');
    expect(debitLine?.description).toContain('علی محمدی');

    // 2. Credit: Notes Receivable / Counterparty (1120)
    const creditLine = lines.find((l) => l.credit > 0);
    expect(creditLine).toBeDefined();
    expect(creditLine?.accountCode).toBe('1120');
    expect(creditLine?.partyId).toBe('cust_123');
    expect(creditLine?.credit).toBe(50_000_000);
    expect(creditLine?.debit).toBe(0);
    expect(creditLine?.description).toContain('بستانکاری طرف‌حساب علی محمدی بابت تخفیف اعطایی');

    // Double-entry balance check
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it('builds balanced journal lines for discount received from customer/supplier (تخفیف دریافتی)', () => {
    const lines = buildDiscountJournalLines({
      direction: 'received',
      amountRials: 35_000_000,
      discountPercentage: 10,
      baseAmountRials: 350_000_000,
      customerId: 'supp_456',
      customerName: 'بنکداری زرین',
      documentNumber: 'DOC-1002',
    });

    expect(lines).toHaveLength(2);

    // 1. Debit: Counterparty Liability (2120)
    const debitLine = lines.find((l) => l.debit > 0);
    expect(debitLine).toBeDefined();
    expect(debitLine?.accountCode).toBe('2120');
    expect(debitLine?.partyId).toBe('supp_456');
    expect(debitLine?.debit).toBe(35_000_000);
    expect(debitLine?.credit).toBe(0);
    expect(debitLine?.description).toContain('بدهکاری طرف‌حساب بنکداری زرین بابت تخفیف دریافتی');

    // 2. Credit: Purchase Discount (5160)
    const creditLine = lines.find((l) => l.credit > 0);
    expect(creditLine).toBeDefined();
    expect(creditLine?.accountCode).toBe('5160');
    expect(creditLine?.credit).toBe(35_000_000);
    expect(creditLine?.debit).toBe(0);
    expect(creditLine?.description).toContain('تخفیف دریافتی (10٪ از مبلغ پایه)');
    expect(creditLine?.description).toContain('بنکداری زرین');

    // Double-entry balance check
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it('throws error when discount amount is zero or negative', () => {
    expect(() =>
      buildDiscountJournalLines({
        direction: 'given',
        amountRials: 0,
        customerId: 'cust_1',
        customerName: 'تست',
      }),
    ).toThrow('مبلغ تخفیف باید بزرگتر از صفر باشد.');

    expect(() =>
      buildDiscountJournalLines({
        direction: 'received',
        amountRials: -500,
        customerId: 'cust_1',
        customerName: 'تست',
      }),
    ).toThrow('مبلغ تخفیف باید بزرگتر از صفر باشد.');
  });
});

describe('calculateDocumentItemsFinancialBase', () => {
  it('correctly sums the financial base of committed lines excluding discounts', () => {
    const mockLines: DocumentLine[] = [
      {
        id: '1',
        documentNature: 'paid', // sale to customer
        documentTab: 'gold-sale',
        documentSubType: 'gold-sale-molten',
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: 'فروش آبشده',
        details: {
          metalType: 'gold',
          baseKarat: 750,
          rawKind: 'molten',
          rawWeight: '10',
          purity: '750',
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: '45000000',
          totalAmount: '450000000',
          currencyUnit: 'IRR',
          currencyQuantity: '',
          currencyUnitPrice: '',
          currencyTotalAmount: '',
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          labName: '',
          stampNumber: '',
        },
      },
      {
        id: '2',
        documentNature: 'paid', // sale of workmanship
        documentTab: 'workmanship',
        documentSubType: 'sale_manufactured',
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: 'کارساخته النگو',
        details: {
          metalType: 'gold',
          baseKarat: 750,
          rawKind: 'molten',
          rawWeight: '5',
          purity: '750',
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: '',
          totalAmount: '50000000',
          currencyUnit: 'IRR',
          currencyQuantity: '',
          currencyUnitPrice: '',
          currencyTotalAmount: '',
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          labName: '',
          stampNumber: '',
        },
      },
      {
        id: '3',
        documentNature: 'received', // existing discount line (must be excluded from base)
        documentTab: 'discount',
        documentSubType: 'discount-given',
        settlementMethod: 'cash',
        balanceSource: 'current',
        description: 'تخفیف ۵ درصدی',
        details: {
          metalType: 'gold',
          baseKarat: 750,
          rawKind: 'molten',
          rawWeight: '',
          purity: '',
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: '',
          totalAmount: '25000000',
          discountAmount: '25000000',
          currencyUnit: 'IRR',
          currencyQuantity: '',
          currencyUnitPrice: '',
          currencyTotalAmount: '',
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          labName: '',
          stampNumber: '',
        },
      },
    ];

    const result = calculateDocumentItemsFinancialBase(mockLines, 'IRR');

    // Total base must be 450,000,000 + 50,000,000 = 500,000,000 (discount line is excluded)
    expect(result.itemsTotal).toBe(500_000_000);
    expect(result.salesTotal).toBe(500_000_000);
    expect(result.purchaseTotal).toBe(0);
    expect(result.count).toBe(2);
  });
});

describe('Discount Tab Helpers & Validation', () => {
  it('returns correct document type labels for given and received discounts', () => {
    expect(getLineDocumentTypeLabel('received', 'discount')).toBe('تخفیف اعطایی');
    expect(getLineDocumentTypeLabel('paid', 'discount')).toBe('تخفیف دریافتی');
  });

  it('creates clean discount lines via createLine', () => {
    const givenLine = createLine('received', 'discount');
    expect(givenLine.documentTab).toBe('discount');
    expect(givenLine.sourceTab).toBe('discount');
    expect(givenLine.documentNature).toBe('received');
    expect(givenLine.documentSubType).toBe('discount-given');

    const receivedLine = createLine('paid', 'discount');
    expect(receivedLine.documentTab).toBe('discount');
    expect(receivedLine.sourceTab).toBe('discount');
    expect(receivedLine.documentNature).toBe('paid');
    expect(receivedLine.documentSubType).toBe('discount-received');
  });

  it('validates discount line readiness and errors properly', () => {
    const emptyLine = createLine('received', 'discount');
    expect(isLineReady(emptyLine)).toBe(false);
    expect(validateLine(emptyLine)).toBe('مبلغ تخفیف باید بیشتر از صفر باشد.');

    // With amount entered
    const validLine = {
      ...emptyLine,
      details: {
        ...emptyLine.details,
        discountAmount: '15000000',
        totalAmount: '15000000',
      },
    };
    expect(isLineReady(validLine)).toBe(true);
    expect(validateLine(validLine)).toBe('');
  });

  it('sanitizes discount details stripping alien metal and stone fields', () => {
    const dirtyLine: DocumentLine = {
      id: 'd1',
      documentNature: 'received',
      documentTab: 'discount',
      sourceTab: 'discount',
      documentSubType: 'discount-given',
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: 'تخفیف تست',
      details: {
        metalType: 'gold',
        baseKarat: 750,
        rawKind: 'molten',
        rawWeight: '25.5', // alien metal weight
        purity: '750', // alien purity
        stoneCarats: '12', // alien stone field
        calculationMethod: 'weight',
        metalPriceType: 'gram18',
        metalPrice: '5000000',
        totalAmount: '20000000',
        discountAmount: '20000000',
        discountPercentage: '10',
        discountBaseAmount: '200000000',
        currencyUnit: 'IRR',
        currencyQuantity: '',
        currencyUnitPrice: '',
        currencyTotalAmount: '',
        unsettledTrade: false,
        currencyTradeId: '',
        settlementCurrencyUnit: '',
        settlementQuantity: '',
        settlesTradeId: '',
        inventorySourceId: '',
        labName: 'آزمایشگاه تست',
        stampNumber: '12345',
      },
    };

    const sanitized = sanitizeDocumentLine(dirtyLine);
    expect(sanitized.converted750).toBe(0);
    expect(sanitized.details.rawWeight).toBe('');
    expect(sanitized.details.purity).toBe('');
    expect(sanitized.details.discountAmount).toBe('20000000');
    expect(sanitized.details.discountPercentage).toBe('10');
    expect(sanitized.details.totalAmount).toBe('20000000');
    expect(sanitized.details.discountBaseAmount).toBe('200000000');
  });
});
