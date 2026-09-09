import { normalizeDigits } from './jalali';

export type WeightDecimalPlaces = 1 | 2 | 3;

/**
 * Parses Persian or English localized weight strings or numbers into a JavaScript number (in grams).
 */
export function parseLocalizedWeight(value: string | number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;

  const normalized = normalizeDigits(String(value))
    .replace(/[,\u066C\u00A0\s]/g, '') // remove thousands separators and spaces
    .replace(/\u066B/g, '.') // convert Persian decimal separator (٫) to dot
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Validates whether the user-entered weight string exceeds the maximum allowed decimal precision.
 */
export function validateWeightPrecision(
  value: string | number,
  maxPrecision: WeightDecimalPlaces = 3,
): { valid: boolean; message?: string } {
  if (typeof value === 'number') {
    const str = value.toString();
    const parts = str.split('.');
    if (parts[1] && parts[1].length > maxPrecision) {
      return {
        valid: false,
        message: `حداکثر ${maxPrecision.toLocaleString('fa-IR')} رقم اعشار برای وزن در تنظیمات مجموعه مجاز است.`,
      };
    }
    return { valid: true };
  }

  const normalized = normalizeDigits(String(value))
    .replace(/[,\u066C\u00A0\s]/g, '')
    .replace(/\u066B/g, '.')
    .trim();

  const parts = normalized.split('.');
  if (parts.length > 2) {
    return { valid: false, message: 'فرمت عدد وزن نامعتبر است.' };
  }

  if (parts[1] && parts[1].length > maxPrecision) {
    return {
      valid: false,
      message: `حداکثر ${maxPrecision.toLocaleString('fa-IR')} رقم اعشار برای وزن در تنظیمات مجموعه مجاز است.`,
    };
  }

  return { valid: true };
}

/**
 * Converts grams (float/number) to integer milligrams (1g = 1000mg).
 */
export function gramsToMilligrams(grams: number): bigint {
  if (!Number.isFinite(grams)) return BigInt(0);
  return BigInt(Math.round(grams * 1000));
}

/**
 * Converts integer milligrams back to formatted grams string with requested precision.
 */
export function milligramsToGramsString(
  milligrams: bigint | number,
  precision: WeightDecimalPlaces = 3,
): string {
  const mg = typeof milligrams === 'bigint' ? Number(milligrams) : milligrams;
  const grams = mg / 1000;
  return formatWeight(grams, precision);
}

/**
 * Rounds weight to specific decimal places using round-half-up method without floating error.
 */
export function roundWeight(value: number, precision: WeightDecimalPlaces = 3): number {
  if (!Number.isFinite(value)) return 0;
  return Number(Math.round(Number(value + 'e' + precision)) + 'e-' + precision);
}

/**
 * Formats quantity for coins/bullion (discrete counts display as clean integers without trailing decimals).
 */
export function formatQuantity(quantity: number, isDiscrete = true): string {
  if (!Number.isFinite(quantity)) return '۰';
  if (isDiscrete || Number.isInteger(quantity)) {
    return Math.round(quantity).toLocaleString('fa-IR');
  }
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(quantity);
}

/**
 * Formats a weight number/string into Persian locale digits with strict precision.
 */
export function formatWeight(
  value: number | string,
  precision: WeightDecimalPlaces = 3,
): string {
  const num = typeof value === 'number' ? value : parseLocalizedWeight(value);
  if (!Number.isFinite(num)) return '۰';

  const rounded = roundWeight(num, precision);
  return new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping: true,
  }).format(rounded);
}

/**
 * Default base karats per precious metal standard.
 */
export const DEFAULT_BASE_KARATS = {
  gold: 750,
  silver: 999,
  platinum: 950,
} as const;

export type PreciousMetalType = keyof typeof DEFAULT_BASE_KARATS;

/**
 * Calculates converted equivalent weight at given base karat with deterministic precision rounding.
 * Eliminates IEEE-754 floating point artifacts.
 */
export function metalAtBaseKarat(
  weight: number,
  purity: number,
  baseKarat: number,
  precision: WeightDecimalPlaces = 3,
): number {
  if (!Number.isFinite(weight) || !Number.isFinite(purity) || !Number.isFinite(baseKarat) || baseKarat <= 0) {
    return 0;
  }
  return roundWeight((weight * purity) / baseKarat, precision);
}

/**
 * Calculates 750 carat gold equivalent from weight and carat with precision rounding.
 */
export function goldAt750(
  weight: number,
  carat: number,
  precision: WeightDecimalPlaces = 3,
): number {
  return metalAtBaseKarat(weight, carat, DEFAULT_BASE_KARATS.gold, precision);
}

