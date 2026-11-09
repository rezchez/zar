/**
 * Iranian Standard Coins & Gold Bars Catalog and Calculations Module
 * Zarfolio Financial Management System
 */

import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';

export type CoinCategory = 'emami_coin' | 'bahar_coin' | 'bank_coin' | 'parsian' | 'bar' | 'custom';

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

export const COIN_CATEGORY_LABELS: Record<string, string> = {
  emami_coin: 'سکه‌های امامی (طرح جدید)',
  bahar_coin: 'سکه‌های بهار آزادی',
  bank_coin: 'سکه‌های بانکی',
  parsian: 'سکه‌های پارسیان (۱۸ عیار)',
  bar: 'شمش‌های طلا (۲۴ عیار)',
  custom: 'انواع سفارشی',
};

export const COIN_TYPE_PERSIAN_NAMES: Record<string, string> = {
  emami_full: 'امامی تمام',
  emami_pre86: 'امامی تمام (قبل از ۸۶)',
  bahar_azadi_old: 'بهار آزادی طرح قدیم',
  bahar_full: 'بهار آزادی تمام',
  half_bahar: 'نیم بهار آزادی',
  half_bahar_pre86: 'نیم بهار آزادی (قبل از ۸۶)',
  quarter_bahar: 'ربع بهار آزادی',
  quarter_bahar_pre86: 'ربع بهار آزادی (قبل از ۸۶)',
  quarter_bahar_1403: 'ربع بهار آزادی ۱۴۰۳',
  gram_coin: 'یک گرمی بهار آزادی',
  gerami: 'یک گرمی بهار آزادی',
  parsian_300: 'پارسیان ۰.۳۰۰ (۳۰۰ سوتی)',
  parsian_500: 'پارسیان ۰.۵۰۰ (۵۰۰ سوتی)',
  parsian_1000: 'پارسیان ۱.۰۰۰ (۱ گرمی)',
  parsian_1500: 'پارسیان ۱.۵۰۰ (۱.۵ گرمی)',
  parsian_2000: 'پارسیان ۲.۰۰۰ (۲ گرمی)',
  zioto_1g: 'شمش زیوتو (۱ گرمی)',
  zioto_2_5g: 'شمش زیوتو (۲.۵ گرمی)',
  zioto_5g: 'شمش زیوتو (۵ گرمی)',
  zioto_10g: 'شمش زیوتو (۱۰ گرمی)',
  zioto_20g: 'شمش زیوتو (۲۰ گرمی)',
  zioto_50g: 'شمش زیوتو (۵۰ گرمی)',
  zioto_100g: 'شمش زیوتو (۱۰۰ گرمی)',
  bar_1g: 'شمش ۱ گرمی',
  bar_2_5g: 'شمش ۲.۵ گرمی',
  bar_5g: 'شمش ۵ گرمی',
  bar_10g: 'شمش ۱۰ گرمی',
  bar_20g: 'شمش ۲۰ گرمی',
  bar_50g: 'شمش ۵۰ گرمی',
  bar_100g: 'شمش ۱۰۰ گرمی',
  bar_1000g: 'شمش ۱۰۰۰ گرمی (یک کیلویی)',
};

export function getCoinDisplayPersianName(
  coinType?: string,
  coinName?: string,
  coinTypeName?: string,
  mintYear?: string,
): string {
  const normalizedType = String(coinType || '').trim().toLowerCase();
  let baseName = '';
  if (normalizedType && COIN_TYPE_PERSIAN_NAMES[normalizedType]) {
    baseName = COIN_TYPE_PERSIAN_NAMES[normalizedType];
  } else {
    if (typeof STANDARD_COINS !== 'undefined' && Array.isArray(STANDARD_COINS)) {
      const def = STANDARD_COINS.find(
        (c) => c.id.toLowerCase() === normalizedType || c.code?.toLowerCase() === normalizedType,
      );
      if (def && def.id !== 'custom_coin' && def.name) {
        baseName = def.name;
      }
    }

    if (!baseName) {
      const rawName = String(coinTypeName || coinName || coinType || '').trim();
      if (!rawName) return '';

      const lowerName = rawName.toLowerCase();
      if (COIN_TYPE_PERSIAN_NAMES[lowerName]) {
        baseName = COIN_TYPE_PERSIAN_NAMES[lowerName];
      } else {
        if (typeof STANDARD_COINS !== 'undefined' && Array.isArray(STANDARD_COINS)) {
          const foundByName = STANDARD_COINS.find(
            (c) => c.id.toLowerCase() === lowerName || c.name.toLowerCase() === lowerName,
          );
          if (foundByName && foundByName.id !== 'custom_coin' && foundByName.name) {
            baseName = foundByName.name;
          }
        }

        if (!baseName) {
          let cleaned = rawName.replace(/^(سکه\s*های\s+|سکهٔ\s+|سکه\s+)/i, '').trim();
          if (cleaned.startsWith('تمام امامی')) {
            cleaned = cleaned.replace(/^تمام امامی/, 'امامی تمام');
          }
          cleaned = cleaned.replace(/(\d+)\s*سوت\b/g, '$1 سوتی').replace(/سوت\)/g, 'سوتی)');
          baseName = cleaned || rawName;
        }
      }
    }
  }

  // Handle mint year (e.g. "ضرب ۱۳۸۶")
  const isBar =
    baseName.includes('شمش') ||
    normalizedType.includes('bar') ||
    normalizedType.includes('zioto') ||
    normalizedType.includes('parsis');
  const isParsian = baseName.includes('پارسیان') || normalizedType.includes('parsian');
  if (isBar || isParsian) {
    // Bars and Parsian medals never have mint year
    return baseName;
  }

  const rawYear = String(mintYear || '').trim();
  if (!rawYear || rawYear === 'بدون تاریخ' || rawYear.includes('بدون تاریخ')) {
    if (normalizedType !== 'emami_full') {
      return baseName;
    }
  }

  const effectiveYear = rawYear || (normalizedType === 'emami_full' ? '۱۳۸۶' : '');
  if (
    effectiveYear &&
    effectiveYear !== 'بدون تاریخ' &&
    !baseName.includes('ضرب') &&
    !baseName.includes(effectiveYear)
  ) {
    const pYear = toPersianDigits(effectiveYear);
    return `${baseName} (ضرب ${pYear})`;
  }

  return baseName;
}

/**
 * Returns Persian operation prefix for coin lines (ورود / خروج / خرید / فروش / ...)
 */
export function getCoinOperationPrefix(
  subType?: string,
  nature: 'received' | 'paid' = 'received',
): string {
  const norm = String(subType || '').toLowerCase().trim();
  if (norm === 'receipt_entry' || norm === 'entry' || norm === 'incoming-coin') return 'ورود';
  if (norm === 'payment_exit' || norm === 'exit' || norm === 'outgoing-coin') return 'خروج';
  if (norm === 'receipt_buy' || norm === 'coin_purchase') return 'خرید';
  if (norm === 'payment_sale' || norm === 'coin_sale') return 'فروش';
  if (norm === 'receipt_unsettled_buy') return 'خرید بدون تسویه';
  if (norm === 'payment_unsettled_sale') return 'فروش بدون تسویه';
  if (norm === 'payment_claim') return 'طلب';
  if (norm === 'receipt_debt') return 'بدهی';
  return nature === 'received' ? 'ورود' : 'خروج';
}

/**
 * Formats coin/bar line title, preventing awkward text like "ورود سکه شمش ..."
 */
export function formatCoinItemTitle(opPrefix: string, coinPersianName: string): string {
  const trimmed = String(coinPersianName || '').trim();
  if (!trimmed) return `${opPrefix} مسکوکات/شمش`.trim();
  if (trimmed.startsWith('شمش') || trimmed.startsWith('سکه')) {
    return `${opPrefix} ${trimmed}`.trim();
  }
  return `${opPrefix} سکه ${trimmed}`.trim();
}

/**
 * Standard, verified catalog of coins and gold bars in the Iranian market.
 * Purity: 900 for Bank / Bahar Azadi / Emami coins (21.6k), 750 for Parsian (18k), 995/999.9 for Bars (24k).
 */
export const STANDARD_COINS: CoinDefinition[] = [
  // 1. سکه‌های امامی (طرح جدید - عیار ۹۰۰ / ۲۲ عیار)
  {
    id: 'emami_full',
    code: 'COIN-EMAMI-86',
    name: 'سکه تمام امامی (ضرب ۱۳۸۶)',
    category: 'emami_coin',
    categoryLabel: 'سکه‌های امامی (طرح جدید)',
    unitWeight: 8.133,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه تمام امامی طرح جدید - سال ضرب ۱۳۸۶ (استاندارد اصلی بازار) - وزن ۸.۱۳۳ گرم با عیار ۹۰۰',
  },
  {
    id: 'emami_pre86',
    code: 'COIN-EMAMI-PRE86',
    name: 'سکه تمام امامی (قبل از ۸۶)',
    category: 'emami_coin',
    categoryLabel: 'سکه‌های امامی (طرح جدید)',
    unitWeight: 8.133,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه تمام امامی طرح جدید - سال ضرب قبل از ۱۳۸۶ (زیر ۸۶) - وزن ۸.۱۳۳ گرم با عیار ۹۰۰',
  },

  // 2. سکه‌های بهار آزادی (عیار ۹۰۰ / ۲۲ عیار)
  {
    id: 'bahar_azadi_old',
    code: 'COIN-BAHAR-OLD',
    name: 'سکه تمام بهار آزادی (طرح قدیم)',
    category: 'bahar_coin',
    categoryLabel: 'سکه‌های بهار آزادی',
    unitWeight: 8.133,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه تمام بهار آزادی طرح قدیم (ضرب سال‌های ۱۳۵۸ الی ۱۳۷۰) - وزن ۸.۱۳۳ گرم با عیار ۹۰۰',
  },
  {
    id: 'half_bahar',
    code: 'COIN-BAHAR-HALF-86',
    name: 'نیم سکه بهار آزادی (ضرب ۱۳۸۶)',
    category: 'bahar_coin',
    categoryLabel: 'سکه‌های بهار آزادی',
    unitWeight: 4.066,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'نیم سکه بهار آزادی بانکی - سال ضرب ۱۳۸۶ (استاندارد بازار) - وزن ۴.۰۶۶ گرم با عیار ۹۰۰',
  },
  {
    id: 'half_bahar_pre86',
    code: 'COIN-BAHAR-HALF-PRE86',
    name: 'نیم سکه بهار آزادی (قبل از ۸۶)',
    category: 'bahar_coin',
    categoryLabel: 'سکه‌های بهار آزادی',
    unitWeight: 4.066,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'نیم سکه بهار آزادی بانکی - سال ضرب قبل از ۱۳۸۶ (زیر ۸۶) - وزن ۴.۰۶۶ گرم با عیار ۹۰۰',
  },
  {
    id: 'quarter_bahar',
    code: 'COIN-BAHAR-QUARTER-86',
    name: 'ربع سکه بهار آزادی (ضرب ۱۳۸۶)',
    category: 'bahar_coin',
    categoryLabel: 'سکه‌های بهار آزادی',
    unitWeight: 2.033,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'ربع سکه بهار آزادی بانکی - سال ضرب ۱۳۸۶ (استاندارد بازار) - وزن ۲.۰۳۳ گرم با عیار ۹۰۰',
  },
  {
    id: 'quarter_bahar_pre86',
    code: 'COIN-BAHAR-QUARTER-PRE86',
    name: 'ربع سکه بهار آزادی (قبل از ۸۶)',
    category: 'bahar_coin',
    categoryLabel: 'سکه‌های بهار آزادی',
    unitWeight: 2.033,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'ربع سکه بهار آزادی بانکی - سال ضرب قبل از ۱۳۸۶ (زیر ۸۶) - وزن ۲.۰۳۳ گرم با عیار ۹۰۰',
  },
  {
    id: 'quarter_bahar_1403',
    code: 'COIN-BAHAR-QUARTER-1403',
    name: 'ربع سکه بهار آزادی (ضرب ۱۴۰۳)',
    category: 'bahar_coin',
    categoryLabel: 'سکه‌های بهار آزادی',
    unitWeight: 2.033,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'ربع سکه بهار آزادی بانکی - سال ضرب جدید ۱۴۰۳ بانک مرکزی - وزن ۲.۰۳۳ گرم با عیار ۹۰۰',
  },
  {
    id: 'gram_coin',
    code: 'COIN-BAHAR-GRAM',
    name: 'سکه یک گرمی بهار آزادی (بانک مرکزی)',
    category: 'bahar_coin',
    categoryLabel: 'سکه‌های بهار آزادی',
    unitWeight: 1.018,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'سکه یک گرمی بهار آزادی بانک مرکزی - بدون تاریخ ضرب - وزن ۱.۰۱۸ گرم با عیار ۹۰۰',
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
    description: 'سکه پارسیان ۳۰۰ سوتی - وزن ۰.۳ گرم با عیار ۷۵۰',
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
    id: 'zioto_1g',
    code: 'BAR-ZIOTO-1G',
    name: 'شمش زیوتو (۱ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    unitWeight: 1.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش زیوتو ۱ گرمی - عیار ۹۹۵',
  },
  {
    id: 'zioto_2_5g',
    code: 'BAR-ZIOTO-2.5G',
    name: 'شمش زیوتو (۲.۵ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    unitWeight: 2.5,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش زیوتو ۲.۵ گرمی - عیار ۹۹۵',
  },
  {
    id: 'zioto_5g',
    code: 'BAR-ZIOTO-5G',
    name: 'شمش زیوتو (۵ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    unitWeight: 5.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش زیوتو ۵ گرمی - عیار ۹۹۵',
  },
  {
    id: 'zioto_10g',
    code: 'BAR-ZIOTO-10G',
    name: 'شمش زیوتو (۱۰ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    unitWeight: 10.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش زیوتو ۱۰ گرمی - عیار ۹۹۵',
  },
  {
    id: 'zioto_50g',
    code: 'BAR-ZIOTO-50G',
    name: 'شمش زیوتو (۵۰ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    unitWeight: 50.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش زیوتو ۵۰ گرمی - عیار ۹۹۵',
  },
  {
    id: 'zioto_100g',
    code: 'BAR-ZIOTO-100G',
    name: 'شمش زیوتو (۱۰۰ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    unitWeight: 100.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش زیوتو ۱۰۰ گرمی - عیار ۹۹۵',
  },
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
    id: 'parsis_1g',
    code: 'BAR-PARSIS-1G',
    name: 'شمش پارسیس (۱ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های پارسیس (عیار ۹۹۹.۹)',
    unitWeight: 1.0,
    purity: 999.9,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش پارسیس ۱ گرمی - عیار ۹۹۹.۹',
  },
  {
    id: 'parsis_2_5g',
    code: 'BAR-PARSIS-2.5G',
    name: 'شمش پارسیس (۲.۵ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های پارسیس (عیار ۹۹۹.۹)',
    unitWeight: 2.5,
    purity: 999.9,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش پارسیس ۲.۵ گرمی - عیار ۹۹۹.۹',
  },
  {
    id: 'parsis_5g',
    code: 'BAR-PARSIS-5G',
    name: 'شمش پارسیس (۵ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های پارسیس (عیار ۹۹۹.۹)',
    unitWeight: 5.0,
    purity: 999.9,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش پارسیس ۵ گرمی - عیار ۹۹۹.۹',
  },
  {
    id: 'parsis_10g',
    code: 'BAR-PARSIS-10G',
    name: 'شمش پارسیس (۱۰ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های پارسیس (عیار ۹۹۹.۹)',
    unitWeight: 10.0,
    purity: 999.9,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش پارسیس ۱۰ گرمی - عیار ۹۹۹.۹',
  },
  {
    id: 'parsis_50g',
    code: 'BAR-PARSIS-50G',
    name: 'شمش پارسیس (۵۰ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های پارسیس (عیار ۹۹۹.۹)',
    unitWeight: 50.0,
    purity: 999.9,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش پارسیس ۵۰ گرمی - عیار ۹۹۹.۹',
  },
  {
    id: 'parsis_100g',
    code: 'BAR-PARSIS-100G',
    name: 'شمش پارسیس (۱۰۰ گرمی)',
    category: 'bar',
    categoryLabel: 'شمش‌های پارسیس (عیار ۹۹۹.۹)',
    unitWeight: 100.0,
    purity: 999.9,
    isFixedWeight: true,
    isFixedPurity: true,
    isActive: true,
    description: 'شمش پارسیس ۱۰۰ گرمی - عیار ۹۹۹.۹',
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
