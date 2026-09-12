import { describe, expect, it } from 'bun:test';

import {
  COMMON_WORKMANSHIP_PRESETS,
  calculateConvertedWeight,
  calculateFormulaTotalAmount,
  calculateTotalWage,
  calculateWorkmanshipSummary,
  type WageMode,
  type WorkmanshipOpeningRecord,
} from '@/lib/workmanship-inventory';
import {
  DEFAULT_BASE_KARATS,
  metalAtBaseKarat,
  roundWeight,
  type PreciousMetalType,
} from '@/lib/weight';

describe('Zarfolio — Opening Inventory for Manufactured Jewelry (موجودی اول دوره کارساخته)', () => {
  describe('Layer 1: Wage Calculation Logic (اجرت هر گرم در برابر هر عدد)', () => {
    it('calculates total wage with per_gram mode', () => {
      // 10.5 grams with wage rate 150,000 IRR per gram -> 1,575,000 IRR
      const totalWage = calculateTotalWage(150_000, 'per_gram', 10.5, 2);
      expect(totalWage).toBe(1_575_000);
    });

    it('calculates total wage with per_item mode regardless of weight', () => {
      // 3 items with wage rate 500,000 IRR per piece -> 1,500,000 IRR
      const totalWage = calculateTotalWage(500_000, 'per_item', 25.8, 3);
      expect(totalWage).toBe(1_500_000);
    });

    it('handles zero or negative wage gracefully', () => {
      expect(calculateTotalWage(0, 'per_gram', 10, 1)).toBe(0);
      expect(calculateTotalWage(-50_000, 'per_gram', 10, 1)).toBe(0);
      expect(calculateTotalWage(100_000, 'per_gram', 0, 1)).toBe(0);
    });

    it('rounds total wage to nearest integer (IRR)', () => {
      // 2.333 grams * 155,555 IRR = 362,909.815 -> 362,910
      const totalWage = calculateTotalWage(155_555, 'per_gram', 2.333, 1);
      expect(totalWage).toBe(362_910);
    });

    it('supports foreign currency wage per gram with decimal precision (e.g., USD)', () => {
      // 10.5 grams * $5.50 per gram = $57.75
      const totalWageUSD = calculateTotalWage(5.5, 'per_gram', 10.5, 1, true);
      expect(totalWageUSD).toBe(57.75);

      // 3.333 grams * $12.45 per gram = 41.49585 -> 41.5
      const totalWageUSD2 = calculateTotalWage(12.45, 'per_gram', 3.333, 1, true);
      expect(totalWageUSD2).toBe(41.5);
    });

    it('supports foreign currency wage per item with decimal precision (e.g., USD)', () => {
      // 4 pieces * $25.50 per piece = $102.00
      const totalWageUSD = calculateTotalWage(25.5, 'per_item', 20, 4, true);
      expect(totalWageUSD).toBe(102);
    });

    it('calculates total wage with percentage mode: (convertedWeight * metalPrice) * (wage / 100)', () => {
      // 10 grams converted gold, metal price 40,000,000 IRR/g -> metal value = 400,000,000 IRR
      // Wage = 7.5% -> totalWage = 400,000,000 * 0.075 = 30,000,000 IRR
      const totalWage = calculateTotalWage(7.5, 'percentage', 10, 1, false, 40_000_000, 10);
      expect(totalWage).toBe(30_000_000);

      // Falls back to rawWeight if convertedWeight is not provided
      const totalWageRaw = calculateTotalWage(10, 'percentage', 5, 1, false, 20_000_000);
      // 5g * 20,000,000 * 10% = 10,000,000 IRR
      expect(totalWageRaw).toBe(10_000_000);

      // Returns 0 if metal price is 0
      const totalWageZeroMetal = calculateTotalWage(10, 'percentage', 5, 1, false, 0);
      expect(totalWageZeroMetal).toBe(0);
    });

    it('supports foreign currency percentage wage with decimal precision', () => {
      // 10g * $80/g = $800 metal value, 12.5% wage = $100.00
      const totalWageUSD = calculateTotalWage(12.5, 'percentage', 10, 1, true, 80, 10);
      expect(totalWageUSD).toBe(100);
    });
  });

  describe('Layer 2: Weight Conversion to Base Karat (تبدیل به عیار پایه)', () => {
    it('calculates converted weight for 18k gold at 750 base karat', () => {
      // 10 grams of 750 gold -> 10.000g at 750
      expect(calculateConvertedWeight(10, 750, 750, 3)).toBe(10);

      // 10 grams of 740 gold -> (10 * 740) / 750 = 9.8666... -> 9.867g
      expect(calculateConvertedWeight(10, 740, 750, 3)).toBe(9.867);

      // 15.5 grams of 705 gold -> (15.5 * 705) / 750 = 14.570g
      expect(calculateConvertedWeight(15.5, 705, 750, 3)).toBe(14.57);
    });

    it('calculates converted weight for silver at 925 base karat', () => {
      // 50 grams of 925 silver at 925 base -> 50.000g
      expect(calculateConvertedWeight(50, 925, 925, 3)).toBe(50);

      // 100 grams of 999 silver at 925 base -> (100 * 999) / 925 = 108.000g
      expect(calculateConvertedWeight(100, 999, 925, 3)).toBe(108);
    });

    it('calculates converted weight for platinum at 800 base karat', () => {
      // 20 grams of 950 platinum at 800 base -> (20 * 950) / 800 = 23.750g
      expect(calculateConvertedWeight(20, 950, 800, 3)).toBe(23.75);

      // 10 grams of 800 platinum at 800 base -> 10.000g
      expect(calculateConvertedWeight(10, 800, 800, 3)).toBe(10);
    });

    it('returns zero for invalid weight, purity, or base karat', () => {
      expect(calculateConvertedWeight(0, 750, 750)).toBe(0);
      expect(calculateConvertedWeight(-10, 750, 750)).toBe(0);
      expect(calculateConvertedWeight(10, 0, 750)).toBe(0);
      expect(calculateConvertedWeight(10, 750, 0)).toBe(0);
    });
  });

  describe('Layer 3: Valuation & Pricing Formula (محاسبه ارزش کل بر اساس فرمول)', () => {
    it('computes total formula amount: (convertedWeight * metalPrice) + totalWage + profit - discount', () => {
      // Converted Weight: 10g
      // Metal Price: 40,000,000 IRR / g -> metal total = 400,000,000 IRR
      // Total Wage: 20,000,000 IRR
      // Base Cost: 420,000,000 IRR
      // Profit: 7% -> 29,400,000 IRR
      // Discount: 5,000,000 IRR
      // Total = 420,000,000 + 29,400,000 - 5,000,000 = 444,400,000 IRR
      const total = calculateFormulaTotalAmount(10, 40_000_000, 20_000_000, 7, 5_000_000);
      expect(total).toBe(444_400_000);
    });

    it('floors total amount at zero if discount exceeds gross value', () => {
      const total = calculateFormulaTotalAmount(1, 10_000, 5_000, 0, 100_000);
      expect(total).toBe(0);
    });

    it('works when optional parameters (metal price, profit, discount) are omitted', () => {
      const total = calculateFormulaTotalAmount(5, 0, 1_000_000);
      expect(total).toBe(1_000_000);
    });
  });

  describe('Layer 4: Summary Aggregation & Analytics (تجمیع و خلاصه‌سازی آماری)', () => {
    const mockItems: WorkmanshipOpeningRecord[] = [
      {
        id: 'wrk_1',
        code: 'WRK-000001',
        name: 'النگو دامله',
        metal: 'gold',
        quantity: 3,
        rawWeight: 15.5,
        purity: 750,
        baseKarat: 750,
        convertedWeight: 15.5,
        wage: 100_000,
        wageMode: 'per_gram',
        totalWage: 1_550_000,
        metalPrice: 40_000_000,
        profitPercentage: 5,
        discountAmount: 0,
        goldenPercentage: 0,
        totalAmount: 652_575_000,
        date: '1403/01/01',
        isOpeningBalance: true,
        currencyAmount: 0,
        description: '',
      },
      {
        id: 'wrk_2',
        code: 'WRK-000002',
        name: 'انگشتر سولیتر',
        metal: 'gold',
        quantity: 1,
        rawWeight: 4.5,
        purity: 740,
        baseKarat: 750,
        convertedWeight: 4.44,
        wage: 500_000,
        wageMode: 'per_item',
        totalWage: 500_000,
        metalPrice: 40_000_000,
        profitPercentage: 0,
        discountAmount: 0,
        goldenPercentage: 0,
        totalAmount: 178_100_000,
        currencyId: 'curr_usd',
        currencyCode: 'USD',
        currencySymbol: '$',
        currencyAmount: 250,
        date: '1403/01/02',
        isOpeningBalance: true,
        description: '',
      },
      {
        id: 'wrk_3',
        code: 'WRK-000003',
        name: 'دستبند نقره',
        metal: 'silver',
        quantity: 2,
        rawWeight: 30,
        purity: 925,
        baseKarat: 925,
        convertedWeight: 30,
        wage: 20_000,
        wageMode: 'per_gram',
        totalWage: 600_000,
        metalPrice: 800_000,
        profitPercentage: 0,
        discountAmount: 0,
        goldenPercentage: 0,
        totalAmount: 24_600_000,
        date: '1403/01/03',
        isOpeningBalance: true,
        currencyAmount: 0,
        description: '',
      },
      {
        id: 'wrk_4',
        code: 'WRK-000004',
        name: 'پلاک پلاتین',
        metal: 'platinum',
        quantity: 1,
        rawWeight: 8,
        purity: 950,
        baseKarat: 800,
        convertedWeight: 9.5,
        wage: 300_000,
        wageMode: 'per_gram',
        totalWage: 2_400_000,
        metalPrice: 35_000_000,
        profitPercentage: 0,
        discountAmount: 0,
        goldenPercentage: 0,
        totalAmount: 334_900_000,
        date: '1403/01/04',
        isOpeningBalance: true,
        currencyAmount: 0,
        description: '',
      },
    ];

    it('aggregates total items and total pieces accurately', () => {
      const summary = calculateWorkmanshipSummary(mockItems);
      expect(summary.totalItems).toBe(4);
      // Pieces: 3 + 1 + 2 + 1 = 7
      expect(summary.totalPieces).toBe(7);
    });

    it('strictly separates gold, silver, and platinum summaries', () => {
      const summary = calculateWorkmanshipSummary(mockItems);

      // Gold: 15.5g + 4.5g = 20.0g raw
      expect(summary.gold.totalWeight).toBe(20);
      // Converted: 15.5 + 4.44 = 19.94g
      expect(summary.gold.convertedWeight).toBe(19.94);
      expect(summary.gold.pieces).toBe(4);
      expect(summary.gold.totalWage).toBe(2_050_000);

      // Silver: 30g raw, 30g converted, 2 pieces
      expect(summary.silver.totalWeight).toBe(30);
      expect(summary.silver.convertedWeight).toBe(30);
      expect(summary.silver.pieces).toBe(2);
      expect(summary.silver.totalWage).toBe(600_000);

      // Platinum: 8g raw, 9.5g converted, 1 piece
      expect(summary.platinum.totalWeight).toBe(8);
      expect(summary.platinum.convertedWeight).toBe(9.5);
      expect(summary.platinum.pieces).toBe(1);
      expect(summary.platinum.totalWage).toBe(2_400_000);
    });

    it('sums total valuation in Rials across all items', () => {
      const summary = calculateWorkmanshipSummary(mockItems);
      // 652_575_000 + 178_100_000 + 24_600_000 + 334_900_000 = 1,190,175,000 IRR
      expect(summary.totalValuationRial).toBe(1_190_175_000);
    });

    it('groups foreign currency amounts by currency code', () => {
      const summary = calculateWorkmanshipSummary(mockItems);
      expect(summary.byCurrency.USD).toBeDefined();
      expect(summary.byCurrency.USD.totalAmount).toBe(250);
      expect(summary.byCurrency.USD.count).toBe(1);
      expect(summary.byCurrency.USD.symbol).toBe('$');
    });
  });

  describe('Layer 5: Common Presets & System Invariants (پیش‌فرض‌ها و الزامات)', () => {
    it('provides standard Persian jewelry presets matching WorkmanshipTab', () => {
      expect(COMMON_WORKMANSHIP_PRESETS).toContain('النگو');
      expect(COMMON_WORKMANSHIP_PRESETS).toContain('انگشتر');
      expect(COMMON_WORKMANSHIP_PRESETS).toContain('دستبند');
      expect(COMMON_WORKMANSHIP_PRESETS).toContain('سرویس طلا');
      expect(COMMON_WORKMANSHIP_PRESETS).toContain('نیم‌ست');
      expect(COMMON_WORKMANSHIP_PRESETS).toContain('ساعت طلا');
      expect(COMMON_WORKMANSHIP_PRESETS.length).toBe(12);
    });

    it('verifies default base karats', () => {
      expect(DEFAULT_BASE_KARATS.gold).toBe(750);
      expect(DEFAULT_BASE_KARATS.silver).toBe(999);
      expect(DEFAULT_BASE_KARATS.platinum).toBe(950);
    });
  });
});
