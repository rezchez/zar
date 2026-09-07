/**
 * Iranian Standard Coins & Gold Bars Catalog and Calculations Module
 * Zarfolio Financial Management System
 */

import { normalizeDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';

export type CoinCategory = 'bank_coin' | 'pahlavi_coin' | 'parsian' | 'bar' | 'custom';

export interface CoinDefinition {
  id: string;
  code?: string;
  name: string;
  category: CoinCategory;
  categoryLabel: string;
  unitWeight: number; // weight in grams
  purity: number; // in thousandths (e.g. 900, 750, 995, 999.9)
  isFixedWeight: boolean; // whether the standard weight is fixed or variable
  isFixedPurity: boolean; // whether the standard purity is fixed or variable
  description?: string;
  isActive?: boolean;
}

export const COIN_CATEGORY_LABELS: Record<CoinCategory, string> = {
  bank_coin: 'سکه‌های بانکی (بهار آزادی)',
  pahlavi_coin: 'سکه‌های پهلوی',
  parsian: 'سکه‌های پارسیان (۱۸ عیار)',
  bar: 'شمش‌های طلا (۲۴ عیار)',
  custom: 'انواع سفارشی',
};

/**
 * Standard, verified catalog of coins and gold bars in the Iranian market.
 * Purity: 900 for Bank / Pahlavi coins (21.6k), 750 for Parsian (18k), 995/999.9 for Bars (24k).
 */
export const STANDARD_COINS: CoinDefinition[] = [
  // 1. سکه‌های بانکی بهار آزادی (عیار ۹۰۰)
  {
    id: 'emami_full',
    code: 'COIN-EMAMI-FULL',
    name: 'سکه تمام بهار آزادی (امامی)',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    unitWeight: 8.136,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه تمام بهار آزادی طرح جدید (امامی) - وزن استاندارد ۸.۱۳۶ گرم با عیار ۹۰۰',
  },
  {
    id: 'bahar_azadi_old',
    code: 'COIN-BAHAR-OLD',
    name: 'سکه تمام بهار آزادی (طرح قدیم)',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    unitWeight: 8.136,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه تمام بهار آزادی طرح قدیم - وزن ۸.۱۳۶ گرم با عیار ۹۰۰',
  },
  {
    id: 'half_bahar',
    code: 'COIN-BAHAR-HALF',
    name: 'نیم سکه بهار آزادی',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    unitWeight: 4.068,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'نیم سکه بهار آزادی بانکی - وزن ۴.۰۶۸ گرم با عیار ۹۰۰',
  },
  {
    id: 'quarter_bahar',
    code: 'COIN-BAHAR-QUARTER',
    name: 'ربع سکه بهار آزادی',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    unitWeight: 2.034,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'ربع سکه بهار آزادی بانکی - وزن ۲.۰۳۴ گرم با عیار ۹۰۰',
  },
  {
    id: 'gram_coin',
    code: 'COIN-BAHAR-GRAM',
    name: 'سکه گرمی (بانک مرکزی)',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    unitWeight: 1.018,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه یک گرمی بانک مرکزی - وزن ۱.۰۱۸ گرم با عیار ۹۰۰',
  },

  // 2. سکه‌های پهلوی (عیار ۹۰۰)
  {
    id: 'pahlavi_full',
    code: 'COIN-PAHLAVI-FULL',
    name: 'سکه پهلوی (یک پهلوی)',
    category: 'pahlavi_coin',
    categoryLabel: 'سکه‌های پهلوی',
    unitWeight: 8.136,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه یک پهلوی طلا - وزن ۸.۱۳۶ گرم با عیار ۹۰۰',
  },
  {
    id: 'pahlavi_half',
    code: 'COIN-PAHLAVI-HALF',
    name: 'نیم پهلوی',
    category: 'pahlavi_coin',
    categoryLabel: 'سکه‌های پهلوی',
    unitWeight: 4.068,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه نیم پهلوی طلا - وزن ۴.۰۶۸ گرم با عیار ۹۰۰',
  },
  {
    id: 'pahlavi_quarter',
    code: 'COIN-PAHLAVI-QUARTER',
    name: 'ربع پهلوی',
    category: 'pahlavi_coin',
    categoryLabel: 'سکه‌های پهلوی',
    unitWeight: 2.034,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه ربع پهلوی طلا - وزن ۲.۰۳۴ گرم با عیار ۹۰۰',
  },

  // 3. پارسیان (عیار ۷۵۰ - ۱۸ عیار)
  {
    id: 'parsian_300',
    code: 'COIN-PARSIAN-300',
    name: 'سکه پارسیان ۰.۳۰۰ (۳۰۰ سوتی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    unitWeight: 0.3,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه پارسیان ۳۰۰ سوت - وزن ۰.۳ گرم با عیار ۷۵۰',
  },
  {
    id: 'parsian_500',
    code: 'COIN-PARSIAN-500',
    name: 'سکه پارسیان ۰.۵۰۰ (۵۰۰ سوتی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    unitWeight: 0.5,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه پارسیان نیم گرمی - وزن ۰.۵ گرم با عیار ۷۵۰',
  },
  {
    id: 'parsian_1000',
    code: 'COIN-PARSIAN-1000',
    name: 'سکه پارسیان ۱.۰۰۰ (۱ گرمی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    unitWeight: 1.0,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه پارسیان یک گرمی - وزن ۱.۰ گرم با عیار ۷۵۰',
  },
  {
    id: 'parsian_1500',
    code: 'COIN-PARSIAN-1500',
    name: 'سکه پارسیان ۱.۵۰۰ (۱.۵ گرمی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    unitWeight: 1.5,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه پارسیان یک و نیم گرمی - وزن ۱.۵ گرم با عیار ۷۵۰',
  },
  {
    id: 'parsian_2000',
    code: 'COIN-PARSIAN-2000',
    name: 'سکه پارسیان ۲.۰۰۰ (۲ گرمی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    unitWeight: 2.0,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه پارسیان دو گرمی - وزن ۲.۰ گرم با عیار ۷۵۰',
  },
  {
    id: 'parsian_custom',
    code: 'COIN-PARSIAN-CUSTOM',
    name: 'سکه پارسیان (وزن سفارشی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    unitWeight: 1.0,
    purity: 750,
    isFixedWeight: false,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه پارسیان با وزن متغیر - عیار ۷۵۰',
  },

  // 4. شمش‌های طلا (شمش ۲۴ عیار / ۹۹۵ یا ۹۹۹.۹)
  {
    id: 'bar_1g',
    code: 'BAR-GOLD-1G',
    name: 'شمش طلا ۱ گرمی',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 1.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش طلا ۱ گرمی استاندارد - عیار ۹۹۵ (۲۴ عیار)',
  },
  {
    id: 'bar_5g',
    code: 'BAR-GOLD-5G',
    name: 'شمش طلا ۵ گرمی',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 5.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش طلا ۵ گرمی استاندارد - عیار ۹۹۵',
  },
  {
    id: 'bar_10g',
    code: 'BAR-GOLD-10G',
    name: 'شمش طلا ۱۰ گرمی',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 10.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش طلا ۱۰ گرمی استاندارد - عیار ۹۹۵',
  },
  {
    id: 'bar_ounce',
    code: 'BAR-GOLD-1OUNCE',
    name: 'شمش طلا ۱ اونس (۳۱.۱۰۳۵ گرم)',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 31.1035,
    purity: 999.9,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش طلا یک اونس تروا (۳۱.۱۰۳۵ گرم) - عیار ۹۹۹.۹',
  },
  {
    id: 'bar_50g',
    code: 'BAR-GOLD-50G',
    name: 'شمش طلا ۵۰ گرمی',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 50.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش طلا ۵0 گرمی - عیار ۹۹۵',
  },
  {
    id: 'bar_100g',
    code: 'BAR-GOLD-100G',
    name: 'شمش طلا ۱۰۰ گرمی',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 100.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش طلا ۱۰۰ گرمی - عیار ۹۹۵',
  },
  {
    id: 'bar_1000g',
    code: 'BAR-GOLD-1000G',
    name: 'شمش طلا ۱ کیلوگرمی',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 1000.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش طلا یک کیلویی شمش استاندارد بین‌المللی - عیار ۹۹۵',
  },
  {
    id: 'bar_custom',
    code: 'BAR-GOLD-CUSTOM',
    name: 'شمش طلا (وزن و عیار سفارشی)',
    category: 'bar',
    categoryLabel: 'شمش‌های طلا (۲۴ عیار)',
    unitWeight: 10.0,
    purity: 995,
    isFixedWeight: false,
    isFixedPurity: false,
    isActive: true,
    description: 'شمش طلا با وزن و عیار متغیر',
  },

  // 5. نوع سفارشی
  {
    id: 'custom_coin',
    code: 'COIN-CUSTOM-ITEM',
    name: 'سکه / شمش سفارشی جدید',
    category: 'custom',
    categoryLabel: 'انواع سفارشی',
    unitWeight: 1.0,
    purity: 750,
    isFixedWeight: false,
    isFixedPurity: false,
    isActive: true,
    description: 'تعریف سکه یا شمش دلخواه با نام، وزن و عیار سفارشی',
  },
];

export interface CoinEntryRow {
  id: string;
  coinTypeId: string;
  customName?: string;
  quantity: string;
  unitWeight: string;
  purity: string;
  totalAmount: string;
  description: string;
}

export interface CalculatedCoinRow {
  id: string;
  coinTypeId: string;
  coinName: string;
  quantity: number;
  unitWeight: number;
  totalWeight: number;
  purity: number;
  converted750: number;
  totalAmount: number;
  description: string;
  isCustom: boolean;
  isFixedWeight: boolean;
  isFixedPurity: boolean;
}

export interface CoinTotals {
  totalQuantity: number;
  totalWeight: number;
  totalConverted750: number;
  totalAmount: number;
}

/**
 * Finds a coin definition by ID or returns the fallback custom definition.
 */
export function getCoinDefinition(
  coinTypeId: string,
  customCoins: CoinDefinition[] = [],
): CoinDefinition {
  const allCoins = [...STANDARD_COINS, ...customCoins];
  const found = allCoins.find((c) => c.id === coinTypeId);
  if (found) return found;
  return STANDARD_COINS.find((c) => c.id === 'custom_coin') || STANDARD_COINS[0];
}

/**
 * Safely parses a decimal string (supporting Persian digits and commas).
 */
export function parseCoinNumber(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) || !isFinite(val) ? 0 : val;
  const normalized = normalizeDigits(String(val)).replace(/,/g, '').trim();
  const parsed = parseFloat(normalized);
  return isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
}

/**
 * Calculates derived metrics for a single coin entry row.
 */
export function calculateCoinRow(
  row: CoinEntryRow,
  customCoins: CoinDefinition[] = [],
  weightPrecision = 3,
): CalculatedCoinRow {
  const def = getCoinDefinition(row.coinTypeId, customCoins);
  const isCustom =
    def.category === 'custom' ||
    def.id === 'custom_coin' ||
    def.id.startsWith('custom_') ||
    !STANDARD_COINS.some((c) => c.id === def.id);

  const quantity = Math.max(0, parseCoinNumber(row.quantity));
  const rawUnitWeight = parseCoinNumber(row.unitWeight);
  const unitWeight = def.isFixedWeight ? def.unitWeight : Math.max(0, rawUnitWeight);
  const rawPurity = parseCoinNumber(row.purity);
  const purity = def.isFixedPurity ? def.purity : Math.max(0, Math.min(1000, rawPurity || 750));

  const totalWeight = quantity * unitWeight;
  const converted750 = purity > 0 ? (totalWeight * purity) / 750 : 0;
  const totalAmount = Math.max(0, parseLocalizedAmount(row.totalAmount || '0'));

  const coinName = isCustom && row.customName?.trim() ? row.customName.trim() : def.name;

  return {
    id: row.id,
    coinTypeId: row.coinTypeId,
    coinName,
    quantity,
    unitWeight: Number(unitWeight.toFixed(weightPrecision)),
    totalWeight: Number(totalWeight.toFixed(weightPrecision)),
    purity,
    converted750: Number(converted750.toFixed(weightPrecision)),
    totalAmount,
    description: row.description || '',
    isCustom,
    isFixedWeight: def.isFixedWeight,
    isFixedPurity: def.isFixedPurity,
  };
}

/**
 * Calculates sum totals across multiple coin rows.
 */
export function calculateCoinTotals(
  rows: CoinEntryRow[],
  customCoins: CoinDefinition[] = [],
  weightPrecision = 3,
): CoinTotals {
  let totalQuantity = 0;
  let totalWeight = 0;
  let totalConverted750 = 0;
  let totalAmount = 0;

  for (const row of rows) {
    const calc = calculateCoinRow(row, customCoins, weightPrecision);
    totalQuantity += calc.quantity;
    totalWeight += calc.totalWeight;
    totalConverted750 += calc.converted750;
    totalAmount += calc.totalAmount;
  }

  return {
    totalQuantity,
    totalWeight: Number(totalWeight.toFixed(weightPrecision)),
    totalConverted750: Number(totalConverted750.toFixed(weightPrecision)),
    totalAmount,
  };
}

/**
 * Creates a new blank coin entry row.
 */
export function createNewCoinRow(defaultCoinTypeId = 'emami_full'): CoinEntryRow {
  const def = getCoinDefinition(defaultCoinTypeId);
  return {
    id: `coin_row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    coinTypeId: def.id,
    customName: '',
    quantity: '1',
    unitWeight: String(def.unitWeight),
    purity: String(def.purity),
    totalAmount: '',
    description: '',
  };
}
