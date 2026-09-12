import { DEFAULT_BASE_KARATS, metalAtBaseKarat, roundWeight, type PreciousMetalType, type WeightDecimalPlaces } from './weight';

export type WageMode = 'per_gram' | 'per_item' | 'percentage';

export interface WorkmanshipOpeningRecord {
  id: string;
  code: string;
  name: string;
  metal: PreciousMetalType;
  quantity: number;
  rawWeight: number;
  purity: number;
  baseKarat: number;
  convertedWeight: number;
  wage: number;
  wageMode: WageMode;
  totalWage: number;
  wageCurrencyId?: string;
  wageCurrencyCode?: string;
  wageCurrencySymbol?: string;
  wageCurrencyRate?: number;
  wageCurrencyAmount?: number;
  metalPrice: number;
  profitPercentage: number;
  discountAmount: number;
  goldenPercentage: number;
  totalAmount: number;
  currencyId?: string;
  currencyCode?: string;
  currencySymbol?: string;
  currencyAmount: number;
  storageLocation?: string;
  description: string;
  date: string;
  isOpeningBalance: boolean;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export interface MetalGroupSummary {
  totalWeight: number;
  convertedWeight: number;
  pieces: number;
  totalWage: number;
}

export interface WorkmanshipInventorySummary {
  totalItems: number;
  totalPieces: number;
  gold: MetalGroupSummary;
  silver: MetalGroupSummary;
  platinum: MetalGroupSummary;
  totalValuationRial: number;
  byCurrency: Record<string, { totalAmount: number; count: number; symbol?: string; name?: string }>;
}

export const COMMON_WORKMANSHIP_PRESETS = [
  'النگو',
  'انگشتر',
  'دستبند',
  'زنجیر',
  'گردنبند',
  'گوشواره',
  'سرویس طلا',
  'نیم‌ست',
  'مدال / پلاک',
  'تک‌پوش',
  'پابند',
  'ساعت طلا',
] as const;

/**
 * Calculates total wage based on wage rate, mode, weight, pieces, and metal price.
 * - per_gram: rawWeight * wage
 * - per_item: quantity * wage
 * - percentage: (convertedWeight || rawWeight) * metalPrice * (wage / 100)
 * Supports foreign currency (e.g. USD, EUR, AED) rounding to 2 decimal places.
 */
export function calculateTotalWage(
  wage: number,
  wageMode: WageMode,
  rawWeight: number,
  quantity: number = 1,
  isForeignCurrency: boolean = false,
  metalPrice: number = 0,
  convertedWeight?: number,
): number {
  if (wage <= 0) return 0;
  let raw = 0;
  if (wageMode === 'percentage') {
    const weightToUse = (convertedWeight !== undefined && convertedWeight > 0) ? convertedWeight : rawWeight;
    const baseMetalValue = weightToUse * (metalPrice > 0 ? metalPrice : 0);
    raw = baseMetalValue * (wage / 100);
  } else if (wageMode === 'per_item') {
    raw = (quantity > 0 ? quantity : 1) * wage;
  } else {
    // per_gram
    raw = rawWeight * wage;
  }

  if (isForeignCurrency) {
    return Math.round(raw * 100) / 100;
  }
  return Math.round(raw);
}

/**
 * Calculates converted weight based on metal purity and base karat.
 */
export function calculateConvertedWeight(
  rawWeight: number,
  purity: number,
  baseKarat: number,
  precision: WeightDecimalPlaces = 3,
): number {
  if (rawWeight <= 0 || purity <= 0 || baseKarat <= 0) return 0;
  return metalAtBaseKarat(rawWeight, purity, baseKarat, precision);
}

/**
 * Calculates suggested formula total amount:
 * (convertedWeight * metalPrice) + totalWage + profit - discount
 */
export function calculateFormulaTotalAmount(
  convertedWeight: number,
  metalPrice: number,
  totalWage: number,
  profitPercentage: number = 0,
  discountAmount: number = 0,
): number {
  const metalTotal = Math.round(convertedWeight * (metalPrice > 0 ? metalPrice : 0));
  const baseCost = metalTotal + totalWage;
  const profitAmount = profitPercentage > 0 ? Math.round(baseCost * (profitPercentage / 100)) : 0;
  const gross = baseCost + profitAmount;
  return Math.max(0, gross - (discountAmount > 0 ? discountAmount : 0));
}

/**
 * Aggregates summary analytics across all workmanship opening records.
 */
export function calculateWorkmanshipSummary(
  items: WorkmanshipOpeningRecord[],
  precision: WeightDecimalPlaces = 3,
): WorkmanshipInventorySummary {
  const summary: WorkmanshipInventorySummary = {
    totalItems: items.length,
    totalPieces: 0,
    gold: { totalWeight: 0, convertedWeight: 0, pieces: 0, totalWage: 0 },
    silver: { totalWeight: 0, convertedWeight: 0, pieces: 0, totalWage: 0 },
    platinum: { totalWeight: 0, convertedWeight: 0, pieces: 0, totalWage: 0 },
    totalValuationRial: 0,
    byCurrency: {},
  };

  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const rawW = Number(item.rawWeight) || 0;
    const convW = Number(item.convertedWeight) || 0;
    const wage = Number(item.totalWage) || 0;
    const totalAmt = Number(item.totalAmount) || 0;

    summary.totalPieces += qty;
    summary.totalValuationRial += totalAmt;

    const metal = (item.metal || 'gold').toLowerCase() as PreciousMetalType;
    if (metal === 'gold' || metal === 'silver' || metal === 'platinum') {
      summary[metal].totalWeight += rawW;
      summary[metal].convertedWeight += convW;
      summary[metal].pieces += qty;
      summary[metal].totalWage += wage;
    }

    // Currency grouping (main currency or wage currency)
    const currCode = item.currencyCode || item.wageCurrencyCode;
    const currAmount = item.currencyAmount > 0 ? item.currencyAmount : (item.wageCurrencyAmount || 0);
    const currSymbol = item.currencySymbol || item.wageCurrencySymbol || currCode;
    if (currCode && currAmount > 0) {
      const code = currCode.toUpperCase();
      if (!summary.byCurrency[code]) {
        summary.byCurrency[code] = {
          totalAmount: 0,
          count: 0,
          symbol: currSymbol,
        };
      }
      summary.byCurrency[code].totalAmount += currAmount;
      summary.byCurrency[code].count += 1;
    }
  }

  // Round summary weights
  summary.gold.totalWeight = roundWeight(summary.gold.totalWeight, precision);
  summary.gold.convertedWeight = roundWeight(summary.gold.convertedWeight, precision);
  summary.silver.totalWeight = roundWeight(summary.silver.totalWeight, precision);
  summary.silver.convertedWeight = roundWeight(summary.silver.convertedWeight, precision);
  summary.platinum.totalWeight = roundWeight(summary.platinum.totalWeight, precision);
  summary.platinum.convertedWeight = roundWeight(summary.platinum.convertedWeight, precision);

  return summary;
}
