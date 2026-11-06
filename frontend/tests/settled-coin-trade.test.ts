import { describe, expect, it } from 'bun:test';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { getLineFinancialValues, isMetalBearingLine } from '@/features/accounting/documents/utils/document-helpers';

function createMockDetail(overrides: Partial<DetailState> = {}): DetailState {
  return {
    rawKind: 'coin',
    metalType: 'gold',
    rawWeight: '8.133',
    purity: '900',
    calculationMethod: 'weight',
    metalPriceType: 'gram18',
    metalPrice: '0',
    totalAmount: '250000000',
    labName: '',
    stampNumber: '',
    currencyUnit: 'IRT',
    currencyQuantity: '1',
    currencyUnitPrice: '250000000',
    currencyTotalAmount: '250000000',
    unsettledTrade: false,
    currencyTradeId: '',
    settlementCurrencyUnit: '',
    settlementQuantity: '0',
    settlesTradeId: '',
    inventorySourceId: '',
    coinType: 'emami_full',
    coinName: 'سکه تمام امامی (ضرب ۱۳۸۶)',
    ...overrides,
  };
}

describe('Settled Coin & Bar Trade (خرید و فروش سکه و شمش با ردیف‌های ورود و خروج متصل)', () => {
  it('correctly maps buy coin (خرید سکه) trade line and entry (ورود سکه) physical line', () => {
    const tradeLineId = 'coin-buy-1';
    const physicalLineId = 'coin-entry-1';

    const tradeLine: DocumentLine = {
      id: tradeLineId,
      documentNature: 'received',
      documentTab: 'coin',
      sourceTab: 'coin',
      documentTypeLabel: 'خرید سکه',
      documentSubType: 'receipt_buy',
      settlementMethod: 'weight',
      balanceSource: 'current',
      converted750: 9.76,
      description: 'خرید سکه امامی تمام (ضرب ۱۳۸۶)',
      details: createMockDetail({
        linkedLineId: physicalLineId,
      }),
    };

    const physicalLine: DocumentLine = {
      id: physicalLineId,
      documentNature: 'received',
      documentTab: 'coin',
      sourceTab: 'coin',
      documentTypeLabel: 'ورود سکه',
      documentSubType: 'receipt_entry',
      settlementMethod: 'weight',
      balanceSource: 'current',
      converted750: 9.76,
      description: 'ورود سکه امامی تمام (ضرب ۱۳۸۶)',
      details: createMockDetail({
        totalAmount: '0',
        currencyTotalAmount: '0',
        currencyUnitPrice: '0',
        linkedLineId: tradeLineId,
      }),
    };

    // Both lines must be linked
    expect(tradeLine.details.linkedLineId).toBe(physicalLineId);
    expect(physicalLine.details.linkedLineId).toBe(tradeLineId);

    // Both lines are metal bearing
    expect(isMetalBearingLine(tradeLine)).toBe(true);
    expect(isMetalBearingLine(physicalLine)).toBe(true);

    // Trade line carries the financial credit (طلب مشتری بابت فروش سکه)
    const tradeFin = getLineFinancialValues(tradeLine);
    expect(tradeFin.hasValue).toBe(true);
    expect(tradeFin.credit).toBe(250000000);
    expect(tradeFin.debit).toBe(0);

    // Physical entry line has zero financial effect
    const physFin = getLineFinancialValues(physicalLine);
    expect(physFin.hasValue).toBe(false);
    expect(physFin.credit).toBe(0);
    expect(physFin.debit).toBe(0);
  });

  it('correctly maps bar purchase (خرید شمش) and entry (ورود شمش) for Zioto 100g', () => {
    const tradeLineId = 'bar-buy-1';
    const physicalLineId = 'bar-entry-1';

    const tradeLine: DocumentLine = {
      id: tradeLineId,
      documentNature: 'received',
      documentTab: 'coin',
      sourceTab: 'coin',
      documentTypeLabel: 'خرید شمش',
      documentSubType: 'receipt_buy',
      settlementMethod: 'weight',
      balanceSource: 'current',
      converted750: 132.667,
      description: 'خرید شمش زیوتو (۱۰۰ گرمی)',
      details: createMockDetail({
        coinType: 'zioto_100g',
        coinName: 'شمش زیوتو (۱۰۰ گرمی)',
        rawWeight: '100',
        purity: '995',
        totalAmount: '4500000000',
        linkedLineId: physicalLineId,
      }),
    };

    const physicalLine: DocumentLine = {
      id: physicalLineId,
      documentNature: 'received',
      documentTab: 'coin',
      sourceTab: 'coin',
      documentTypeLabel: 'ورود شمش',
      documentSubType: 'receipt_entry',
      settlementMethod: 'weight',
      balanceSource: 'current',
      converted750: 132.667,
      description: 'ورود شمش زیوتو (۱۰۰ گرمی)',
      details: createMockDetail({
        coinType: 'zioto_100g',
        coinName: 'شمش زیوتو (۱۰۰ گرمی)',
        rawWeight: '100',
        purity: '995',
        totalAmount: '0',
        currencyTotalAmount: '0',
        currencyUnitPrice: '0',
        linkedLineId: tradeLineId,
      }),
    };

    expect(tradeLine.description).toBe('خرید شمش زیوتو (۱۰۰ گرمی)');
    expect(physicalLine.description).toBe('ورود شمش زیوتو (۱۰۰ گرمی)');
    expect(tradeLine.details.linkedLineId).toBe(physicalLineId);
    expect(physicalLine.details.linkedLineId).toBe(tradeLineId);
  });
});
