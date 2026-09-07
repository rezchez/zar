import { numberToPersianWords } from '@/lib/money';
import { normalizeDigits } from '@/lib/jalali';

export const MESGHAL_17_TO_GRAM_18 = 4.3318;
export const TROY_OUNCE_GRAMS = 31.1035;

/**
 * Parses localized comma-separated string or raw number to clean numeric value.
 */
export function parseNumericValue(value: string | number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;
  const normalized = normalizeDigits(String(value)).replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats integer or decimal value with 3-digit comma separation.
 */
export function formatWithCommas(value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';
  const num = parseNumericValue(value);
  if (num === 0 && String(value).trim() !== '0') return String(value);

  const parts = String(value).replace(/,/g, '').split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${formattedInteger}${decimalPart}`;
}

/**
 * Returns localized currency unit label based on base currency setting.
 */
export function getCurrencyUnitLabel(baseCurrency: 'IRR' | 'IRT' = 'IRR'): string {
  return baseCurrency === 'IRT' ? 'تومان' : 'ریال';
}

/**
 * Converts a numeric amount to Persian words with the active currency unit.
 */
export function getAmountInPersianWords(
  amount: string | number,
  baseCurrency: 'IRR' | 'IRT' = 'IRR',
): string {
  const num = parseNumericValue(amount);
  if (!num || num <= 0) return '';
  const words = numberToPersianWords(num);
  const unit = getCurrencyUnitLabel(baseCurrency);
  return `${words} ${unit}`;
}

/**
 * Calculates linked prices across Gram 18, Mesghal 17, and Troy Ounce.
 */
export function convertPricesFromGram18(gram18Price: number): {
  gram18: number;
  mesghal17: number;
  ounceUsd: number;
} {
  if (gram18Price <= 0) {
    return { gram18: 0, mesghal17: 0, ounceUsd: 0 };
  }
  return {
    gram18: Math.round(gram18Price),
    mesghal17: Math.round(gram18Price * MESGHAL_17_TO_GRAM_18),
    ounceUsd: Math.round(gram18Price * TROY_OUNCE_GRAMS),
  };
}

export function convertPricesFromMesghal17(mesghal17Price: number): {
  gram18: number;
  mesghal17: number;
  ounceUsd: number;
} {
  if (mesghal17Price <= 0) {
    return { gram18: 0, mesghal17: 0, ounceUsd: 0 };
  }
  const gram18 = mesghal17Price / MESGHAL_17_TO_GRAM_18;
  return {
    gram18: Math.round(gram18),
    mesghal17: Math.round(mesghal17Price),
    ounceUsd: Math.round(gram18 * TROY_OUNCE_GRAMS),
  };
}

export function convertPricesFromOunceUsd(ouncePrice: number): {
  gram18: number;
  mesghal17: number;
  ounceUsd: number;
} {
  if (ouncePrice <= 0) {
    return { gram18: 0, mesghal17: 0, ounceUsd: 0 };
  }
  const gram18 = ouncePrice / TROY_OUNCE_GRAMS;
  return {
    gram18: Math.round(gram18),
    mesghal17: Math.round(gram18 * MESGHAL_17_TO_GRAM_18),
    ounceUsd: Math.round(ouncePrice),
  };
}
