import { describe, expect, it } from 'bun:test';
import {
  convertToBaseWeight,
  calculateTradeSettlementStatus,
  validateDocumentSettlement,
  isUnsettledTrade,
} from '@/features/accounting/documents/services/metal-settlement-service';
import type { DocumentLine, DetailState } from '@/src/components/documents/RawGoldTab';

function createMockDetail(overrides: Partial<DetailState> = {}): DetailState {
  return {
    metalType: 'gold',
    rawKind: 'molten',
    rawWeight: '0',
    purity: '750',
    calculationMethod: 'weight',
    metalPriceType: 'gram18',
    metalPrice: '0',
    totalAmount: '0',
    labName: '',
    stampNumber: '',
    currencyUnit: 'IRR',
    currencyQuantity: '0',
    currencyUnitPrice: '0',
    currencyTotalAmount: '0',
    unsettledTrade: false,
    currencyTradeId: '',
    settlementCurrencyUnit: '',
    settlementQuantity: '0',
    settlesTradeId: '',
    inventorySourceId: '',
    ...overrides,
  };
}

function createMockLine(
  id: string,
  nature: 'received' | 'paid',
  tab: DocumentLine['documentTab'],
  detailOverrides: Partial<DetailState> = {},
): DocumentLine {
  return {
    id,
    documentNature: nature,
    documentTab: tab,
    documentSubType: '',
    settlementMethod: detailOverrides.unsettledTrade || detailOverrides.rawKind === 'unsettled' ? 'unsettled' : 'weight',
    balanceSource: 'current',
    description: 'تست سند',
    details: createMockDetail(detailOverrides),
  };
}

describe('Metal Settlement Domain Service & 7 Mission Scenarios', () => {
  describe('سناریوی ۱: فروش طلای آبشده بدون تسویه (Unsettled Trade)', () => {
    it('allows registering trade without physical metal row and permits both temporary and final save', () => {
      // فروش ۱۰۰ گرم طلای آبشده بدون دریافت طلای فیزیکی در لحظه
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'unsettled',
          rawWeight: '100',
          purity: '750',
          totalAmount: '5000000000',
          unsettledTrade: true,
        }),
      ];

      expect(isUnsettledTrade(lines[0])).toBe(true);

      const analysis = calculateTradeSettlementStatus(lines);
      expect(analysis.hasUnsettledTrades).toBe(true);
      expect(analysis.items[0].settlementStatus).toBe('unsettled_trade');
      expect(analysis.items[0].tradedBaseWeight).toBe(100);
      expect(analysis.items[0].settledBaseWeight).toBe(0);
      expect(analysis.items[0].remainingBaseWeight).toBe(100);

      // اعتبارسنجی ثبت موقت
      const tempResult = validateDocumentSettlement(lines, 'temporary');
      expect(tempResult.isValid).toBe(true);
      expect(tempResult.errors).toHaveLength(0);

      // اعتبارسنجی ثبت کل: در حالت بدون تسویه، ثبت کل کاملاً مجاز است
      const finalResult = validateDocumentSettlement(lines, 'final');
      expect(finalResult.isValid).toBe(true);
      expect(finalResult.errors).toHaveLength(0);
    });
  });

  describe('سناریوی ۲: فروش طلای آبشده با تسویه کامل (Fully Settled)', () => {
    it('verifies that full physical metal outflow matches the trade and enables final save', () => {
      // ردیف ۱: فروش ۱۰۰ گرم طلا با عیار ۷۵۰
      // ردیف ۲: خروج فیزیکی ۱۰۰ گرم طلا با عیار ۷۵۰
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '100',
          purity: '750',
          totalAmount: '5000000000',
        }),
        createMockLine('line-2', 'paid', 'raw-gold', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '100',
          purity: '750',
          stampNumber: '12345',
        }),
      ];

      const analysis = calculateTradeSettlementStatus(lines);
      expect(analysis.isFullySettled).toBe(true);
      expect(analysis.items[0].settlementStatus).toBe('fully_settled');
      expect(analysis.items[0].settledBaseWeight).toBe(100);
      expect(analysis.items[0].remainingBaseWeight).toBe(0);
      expect(analysis.items[0].settlementPercentage).toBe(100);

      const finalResult = validateDocumentSettlement(lines, 'final');
      expect(finalResult.isValid).toBe(true);
      expect(finalResult.errors).toHaveLength(0);
    });

    it('considers trade fully settled if discharged directly from warehouse inventorySourceId', () => {
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '100',
          purity: '750',
          inventorySourceId: 'inventory-lot-99',
        }),
      ];

      const analysis = calculateTradeSettlementStatus(lines);
      expect(analysis.isFullySettled).toBe(true);
      expect(analysis.items[0].settlementStatus).toBe('fully_settled');
    });
  });

  describe('سناریوی ۳: فروش با تسویه ناقص (Partial Settlement)', () => {
    it('accurately tracks settled vs remaining weight, allows temporary save, and blocks final save with clear error', () => {
      // معامله ۱۰۰ گرم طلا، همراه با خروج فیزیکی فقط ۵۰ گرم
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '100',
          purity: '750',
          totalAmount: '5000000000',
        }),
        createMockLine('line-2', 'paid', 'raw-gold', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '50',
          purity: '750',
        }),
      ];

      const analysis = calculateTradeSettlementStatus(lines);
      expect(analysis.isFullySettled).toBe(false);
      expect(analysis.hasPartialSettlement).toBe(true);
      expect(analysis.items[0].settlementStatus).toBe('partially_settled');
      expect(analysis.items[0].settledBaseWeight).toBe(50);
      expect(analysis.items[0].remainingBaseWeight).toBe(50);
      expect(analysis.items[0].settlementPercentage).toBe(50);

      // ثبت موقت اجازه ذخیره می‌دهد
      const tempResult = validateDocumentSettlement(lines, 'temporary');
      expect(tempResult.isValid).toBe(true);
      expect(tempResult.errors).toHaveLength(0);

      // ثبت کل متوقف شده و هشدار کسری می‌دهد
      const finalResult = validateDocumentSettlement(lines, 'final');
      expect(finalResult.isValid).toBe(false);
      expect(finalResult.errors[0]).toContain('کسری تسویه طلا');
      expect(finalResult.errors[0]).toContain('۵۰');
    });
  });

  describe('سناریوی ۴: تسویه با طلای متفرقه با عیار متفاوت (Purity & Base Karat Conversion)', () => {
    it('converts non-750 karat scrap/misc gold accurately to base 750 karat without precision loss', () => {
      // فرمول: baseWeight = (rawWeight * purity) / 750
      // 100g at 750 = 100g base
      expect(convertToBaseWeight(100, 750, 750)).toBe(100);

      // تسویه با طلای متفرقه با عیار ۷۶۷: 97.78357g at 767 -> (97.78357 * 767) / 750 = 100g base
      const scrapRawWeight = (100 * 750) / 767;
      const baseWeightFrom767 = convertToBaseWeight(scrapRawWeight, 767, 750);
      expect(Math.abs(baseWeightFrom767 - 100)).toBeLessThan(0.001);

      // فروش ۱۰۰ گرم عیار ۷۵۰، تسویه با طلای متفرقه عیار ۷۶۷ به وزن معادل
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '100',
          purity: '750',
        }),
        createMockLine('line-2', 'paid', 'raw-gold', {
          metalType: 'gold',
          rawKind: 'misc',
          rawWeight: String(scrapRawWeight),
          purity: '767',
        }),
      ];

      const analysis = calculateTradeSettlementStatus(lines);
      expect(analysis.isFullySettled).toBe(true);
      expect(analysis.items[0].settlementStatus).toBe('fully_settled');
      expect(analysis.items[0].remainingBaseWeight).toBe(0);

      const finalResult = validateDocumentSettlement(lines, 'final');
      expect(finalResult.isValid).toBe(true);
    });

    it('never equates raw weight of different purities without conversion', () => {
      // ۱۰۰ گرم طلا با عیار ۷۴۰ نباید ۱۰۰ گرم ۷۵۰ در نظر گرفته شود (کسری دارد: 98.667g)
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '100',
          purity: '750',
        }),
        createMockLine('line-2', 'paid', 'raw-gold', {
          metalType: 'gold',
          rawKind: 'misc',
          rawWeight: '100', // ۱۰۰ گرم خام، اما عیار ۷۴۰
          purity: '740',
        }),
      ];

      const analysis = calculateTradeSettlementStatus(lines);
      expect(analysis.isFullySettled).toBe(false);
      expect(analysis.items[0].settlementStatus).toBe('partially_settled');
      // 100 * 740 / 750 = 98.66667
      expect(analysis.items[0].settledBaseWeight).toBeCloseTo(98.667, 2);
      expect(analysis.items[0].remainingBaseWeight).toBeCloseTo(1.333, 2);
    });
  });

  describe('سناریوی ۵: خرید طلا با و بدون تسویه (Purchase Flow & Errors)', () => {
    it('unsettled gold purchase succeeds in both draft and final mode', () => {
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'received', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'unsettled',
          rawWeight: '80',
          purity: '750',
          unsettledTrade: true,
        }),
      ];

      const result = validateDocumentSettlement(lines, 'final');
      expect(result.isValid).toBe(true);
    });

    it('settled gold purchase without physical receipt blocks final save with specific Persian message', () => {
      // خرید با تسویه بدون ثبت ورود فیزیکی طلا
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'received', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '80',
          purity: '750',
        }),
      ];

      const result = validateDocumentSettlement(lines, 'final');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('برای ثبت خرید با تسویه، دریافت طلا مورد معامله باید در سند ثبت شود.');
    });

    it('settled gold purchase with physical receipt succeeds in final save', () => {
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'received', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '80',
          purity: '750',
        }),
        createMockLine('line-2', 'received', 'raw-gold', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '80',
          purity: '750',
        }),
      ];

      const result = validateDocumentSettlement(lines, 'final');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('سناریوی ۶: تب بانک و ثبت سند ترکیبی (Mixed Document)', () => {
    it('handles mixed document with unsettled gold sale and bank cash receipt', () => {
      // ردیف ۱: فروش ۱۰۰ گرم طلای آبشده بدون تسویه
      // ردیف ۲: دریافت وجه به حساب بانکی به همان مبلغ
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'unsettled',
          rawWeight: '100',
          purity: '750',
          totalAmount: '4500000000',
          unsettledTrade: true,
        }),
        createMockLine('line-2', 'received', 'bank', {
          totalAmount: '4500000000',
          bankAccountId: 'bank-acc-1',
          bankOperationKind: 'receive-from-customer',
        }),
      ];

      const result = validateDocumentSettlement(lines, 'final');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.analysis.hasUnsettledTrades).toBe(true);
    });
  });

  describe('سناریوی ۷: ثبت موقت سند با وضعیت تسویه (Draft Settlement State)', () => {
    it('allows saving draft even when physical metal is missing, capturing deficit status', () => {
      // معامله با تسویه بدون ثبت ردیف فلز متناظر در حالت ثبت موقت
      const lines: DocumentLine[] = [
        createMockLine('line-1', 'paid', 'gold-sale', {
          metalType: 'gold',
          rawKind: 'molten',
          rawWeight: '100',
          purity: '750',
        }),
      ];

      // ثبت موقت باید موفق باشد
      const tempResult = validateDocumentSettlement(lines, 'temporary');
      expect(tempResult.isValid).toBe(true);
      expect(tempResult.errors).toHaveLength(0);
      expect(tempResult.analysis.hasMissingSettlementMetal).toBe(true);
      expect(tempResult.analysis.items[0].settlementStatus).toBe('no_settlement_metal');

      // اما ثبت کل همان سند باید متوقف شود
      const finalResult = validateDocumentSettlement(lines, 'final');
      expect(finalResult.isValid).toBe(false);
      expect(finalResult.errors[0]).toBe('برای ثبت فروش با تسویه، خروج طلا مورد معامله باید در سند ثبت شود.');
    });
  });

  describe('Numeric Stamp & Packet Validation', () => {
    it('strictly enforces numeric-only stamp and packet numbers', () => {
      const invalidStampLines: DocumentLine[] = [
        createMockLine('line-1', 'received', 'raw-gold', {
          rawWeight: '10',
          purity: '750',
          stampNumber: 'ENG-123', // غیرمجاز (حاوی حروف)
        }),
      ];

      const result = validateDocumentSettlement(invalidStampLines, 'final');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('شماره پاکت / انگ در ردیف ۱ همواره فقط عدد است.');
    });

    it('accepts Persian digits for stamp and normalizes them', () => {
      const persianStampLines: DocumentLine[] = [
        createMockLine('line-1', 'received', 'raw-gold', {
          rawWeight: '10',
          purity: '750',
          stampNumber: '۱۲۳۴۵۶',
        }),
      ];

      const result = validateDocumentSettlement(persianStampLines, 'final');
      expect(result.isValid).toBe(true);
    });
  });
});
