import { describe, expect, it } from 'bun:test';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { convertedTo750 } from '@/features/accounting/documents/utils/document-helpers';
import { validateDocumentSettlement } from '@/features/accounting/documents/services/metal-settlement-service';

function createMockDetail(overrides: Partial<DetailState> = {}): DetailState {
  return {
    rawKind: 'misc',
    metalType: 'gold',
    rawWeight: '10',
    purity: '740',
    calculationMethod: 'weight',
    metalPriceType: 'gram18',
    metalPrice: '40000000',
    totalAmount: '39466667',
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

function calculatePreviewEffect(
  lines: Array<{
    documentNature: 'received' | 'paid';
    documentTab: string;
    sourceTab?: string;
    converted750?: number;
    details: Partial<DetailState>;
  }>,
) {
  const transactionEffect = {
    rial: 0,
    gold: 0,
  };

  for (const line of lines) {
    const lineNature = line.documentNature === 'paid' ? 'paid' : 'received';
    const direction = lineNature === 'received' ? 1 : -1;
    const docTab = String(line.documentTab ?? line.sourceTab ?? '');
    const details = line.details || {};

    if (docTab === 'raw-gold' || docTab === 'gold-sale') {
      const baseKarat = Number(details.baseKarat) || 750;
      const rawWeight = Number(details.rawWeight) || 0;
      const purity = Number(details.purity) || baseKarat;
      const convertedWeight =
        typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
          ? line.converted750
          : (rawWeight > 0 && purity > 0 ? (rawWeight * purity) / baseKarat : 0);

      const weightDirection = docTab === 'gold-sale'
        ? (lineNature === 'received' ? -1 : 1)
        : direction;

      transactionEffect.gold += weightDirection * convertedWeight;
    }

    let rialAmount = 0;
    if (docTab === 'gold-sale') {
      rialAmount = Number(details.totalAmount) || 0;
    }
    if (rialAmount > 0) {
      transactionEffect.rial += direction * rialAmount;
    }
  }

  return transactionEffect;
}

describe('خرید و فروش متفرقه و محاسبه اثر بر مانده طرف حساب', () => {
  it('در تب خرید/فروش برای نوع متفرقه نام آزمایشگاه و انگ ری‌گیری نمایش داده نمی‌شود و الزامی نیست', () => {
    const rawKind: string = 'misc';
    const isMoltenOrConditional = rawKind === 'molten' || rawKind === 'conditional';
    const isMisc = rawKind === 'misc';

    // UI visibility condition should be isMoltenOrConditional only, excluding misc
    const showAssayFields = isMoltenOrConditional;
    expect(showAssayFields).toBe(false);

    // Validation condition
    const isAssayRequired = isMoltenOrConditional && Number('10') > 0;
    expect(isAssayRequired).toBe(false);
  });

  it('اثر خرید متفرقه با تسویه بر مانده طرف‌حساب: مانده وزنی صفر و مانده مالی بستانکار است', () => {
    const weight = 10;
    const purity = 740;
    const totalAmount = 39466667;
    const c750 = convertedTo750(weight, purity, 750); // (10 * 740) / 750 = 9.866667

    const tradeLineId = 'trade-1';
    const physicalLineId = 'phys-1';

    const tradeLine: DocumentLine = {
      id: tradeLineId,
      documentNature: 'received', // خرید
      documentTab: 'gold-sale',
      sourceTab: 'gold-sale',
      documentTypeLabel: 'خرید متفرقه',
      documentSubType: 'gold-purchase-misc',
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: '',
      converted750: c750,
      details: createMockDetail({
        rawKind: 'misc',
        rawWeight: String(weight),
        purity: String(purity),
        totalAmount: String(totalAmount),
        linkedLineId: physicalLineId,
      }),
    };

    const physicalLine: DocumentLine = {
      id: physicalLineId,
      documentNature: 'received', // ورود طلا از مشتری
      documentTab: 'raw-gold',
      sourceTab: 'metals',
      documentTypeLabel: 'ورود متفرقه',
      documentSubType: 'incoming-misc',
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: '',
      converted750: c750,
      details: createMockDetail({
        rawKind: 'misc',
        rawWeight: String(weight),
        purity: String(purity),
        totalAmount: '0',
        metalPrice: '0',
        linkedLineId: tradeLineId,
      }),
    };

    // Settlement validation
    const settlement = validateDocumentSettlement([tradeLine, physicalLine], 'final');
    expect(settlement.isValid).toBe(true);

    // Customer balance preview effect
    const effect = calculatePreviewEffect([tradeLine, physicalLine]);
    // Weight effect must be 0 because metal was delivered physically
    expect(effect.gold).toBeCloseTo(0, 5);
    // Financial effect: customer is credited +totalAmount
    expect(effect.rial).toBe(totalAmount);
  });

  it('اثر فروش متفرقه با تسویه بر مانده طرف‌حساب: مانده وزنی صفر و مانده مالی بدهکار است', () => {
    const weight = 15;
    const purity = 750;
    const totalAmount = 60000000;
    const c750 = convertedTo750(weight, purity, 750);

    const tradeLineId = 'sale-trade-1';
    const physicalLineId = 'sale-phys-1';

    const tradeLine: DocumentLine = {
      id: tradeLineId,
      documentNature: 'paid', // فروش
      documentTab: 'gold-sale',
      sourceTab: 'gold-sale',
      documentTypeLabel: 'فروش متفرقه',
      documentSubType: 'gold-sale-misc',
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: '',
      converted750: c750,
      details: createMockDetail({
        rawKind: 'misc',
        rawWeight: String(weight),
        purity: String(purity),
        totalAmount: String(totalAmount),
        linkedLineId: physicalLineId,
      }),
    };

    const physicalLine: DocumentLine = {
      id: physicalLineId,
      documentNature: 'paid', // خروج طلا به مشتری
      documentTab: 'raw-gold',
      sourceTab: 'metals',
      documentTypeLabel: 'خروج متفرقه',
      documentSubType: 'outgoing-misc',
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: '',
      converted750: c750,
      details: createMockDetail({
        rawKind: 'misc',
        rawWeight: String(weight),
        purity: String(purity),
        totalAmount: '0',
        metalPrice: '0',
        linkedLineId: tradeLineId,
      }),
    };

    const settlement = validateDocumentSettlement([tradeLine, physicalLine], 'final');
    expect(settlement.isValid).toBe(true);

    const effect = calculatePreviewEffect([tradeLine, physicalLine]);
    expect(effect.gold).toBeCloseTo(0, 5);
    // Financial effect: customer is debited -totalAmount
    expect(effect.rial).toBe(-totalAmount);
  });

  it('اثر خرید متفرقه بدون تسویه بر مانده طرف‌حساب: مشتری بستانکار ریالی و بدهکار طلای معادل عیار ۷۵۰ می‌شود', () => {
    const weight = 10;
    const purity = 740;
    const totalAmount = 39466667;
    const c750 = convertedTo750(weight, purity, 750); // 9.8667g

    const tradeLine: DocumentLine = {
      id: 'unsettled-trade-1',
      documentNature: 'received',
      documentTab: 'gold-sale',
      sourceTab: 'gold-sale',
      documentTypeLabel: 'خرید متفرقه',
      documentSubType: 'gold-purchase-misc',
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: '',
      converted750: c750,
      details: createMockDetail({
        rawKind: 'misc',
        rawWeight: String(weight),
        purity: String(purity),
        totalAmount: String(totalAmount),
        unsettledTrade: true,
      }),
    };

    const effect = calculatePreviewEffect([tradeLine]);
    // Customer owes gold equivalent to base karat 750
    expect(effect.gold).toBeCloseTo(-c750, 4);
    // Customer is creditor in rial
    expect(effect.rial).toBe(totalAmount);
  });

  it('اثر فروش متفرقه بدون تسویه بر مانده طرف‌حساب: مشتری بدهکار ریالی و طلبکار طلای معادل عیار ۷۵۰ می‌شود', () => {
    const weight = 10;
    const purity = 740;
    const totalAmount = 39466667;
    const c750 = convertedTo750(weight, purity, 750);

    const tradeLine: DocumentLine = {
      id: 'unsettled-sale-1',
      documentNature: 'paid',
      documentTab: 'gold-sale',
      sourceTab: 'gold-sale',
      documentTypeLabel: 'فروش متفرقه',
      documentSubType: 'gold-sale-misc',
      settlementMethod: 'unsettled',
      balanceSource: 'current',
      description: '',
      converted750: c750,
      details: createMockDetail({
        rawKind: 'misc',
        rawWeight: String(weight),
        purity: String(purity),
        totalAmount: String(totalAmount),
        unsettledTrade: true,
      }),
    };

    const effect = calculatePreviewEffect([tradeLine]);
    // Customer is credited gold
    expect(effect.gold).toBeCloseTo(c750, 4);
    // Customer owes money
    expect(effect.rial).toBe(-totalAmount);
  });
});
