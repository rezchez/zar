import { normalizeDigits } from './jalali';

export const GRAMS_PER_CARAT = 0.2;
export const CARATS_PER_GRAM = 5;

export type ValuationMethod = 'total_value' | 'per_carat' | 'per_gram' | 'per_piece';

/**
 * Deterministically converts carats to grams without floating-point artifacts.
 * 1 ct = 0.2 g
 */
export function caratsToGrams(carats: number, precision = 4): number {
  if (!Number.isFinite(carats) || carats <= 0) return 0;
  const rawGrams = carats * GRAMS_PER_CARAT;
  return Number(Math.round(Number(rawGrams + 'e' + precision)) + 'e-' + precision);
}

/**
 * Deterministically converts grams to carats without floating-point artifacts.
 * 1 g = 5 ct
 */
export function gramsToCarats(grams: number, precision = 3): number {
  if (!Number.isFinite(grams) || grams <= 0) return 0;
  const rawCarats = grams * CARATS_PER_GRAM;
  return Number(Math.round(Number(rawCarats + 'e' + precision)) + 'e-' + precision);
}

/**
 * Parses user input into a clean numeric value.
 */
export function parseLocalizedGemWeight(value: string | number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;

  const normalized = normalizeDigits(String(value))
    .replace(/[,\u066C\u00A0\s]/g, '')
    .replace(/\u066B/g, '.')
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Validates maximum decimal places allowed for carat inputs.
 */
export function validateCaratPrecision(
  value: string | number,
  maxPrecision = 3,
): { valid: boolean; message?: string } {
  if (typeof value === 'number') {
    const str = value.toString();
    const parts = str.split('.');
    if (parts[1] && parts[1].length > maxPrecision) {
      return {
        valid: false,
        message: `حداکثر ${maxPrecision.toLocaleString('fa-IR')} رقم اعشار برای وزن قیراط مجاز است.`,
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
      message: `حداکثر ${maxPrecision.toLocaleString('fa-IR')} رقم اعشار برای وزن قیراط مجاز است.`,
    };
  }

  return { valid: true };
}

/**
 * Calculates average carat weight for parcels.
 */
export function calculateAverageWeight(
  totalWeightCt: number,
  quantity: number,
  precision = 3,
): number {
  const safeQty = Math.max(1, Math.round(Number(quantity) || 1));
  const safeWeight = Math.max(0, Number(totalWeightCt) || 0);
  if (safeWeight === 0) return 0;
  const avg = safeWeight / safeQty;
  return Number(Math.round(Number(avg + 'e' + precision)) + 'e-' + precision);
}

/**
 * Formats carats for display with Persian numerals.
 */
export function formatCarat(ct: number, precision = 2): string {
  if (!Number.isFinite(ct) || ct === 0) return '۰ ct';
  const rounded = Number(Math.round(Number(ct + 'e' + precision)) + 'e-' + precision);
  return `${rounded.toLocaleString('fa-IR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  })} ct`;
}

/**
 * Formats grams for gemstone display with Persian numerals.
 */
export function formatGemGram(g: number, precision = 3): string {
  if (!Number.isFinite(g) || g === 0) return '۰ g';
  const rounded = Number(Math.round(Number(g + 'e' + precision)) + 'e-' + precision);
  return `${rounded.toLocaleString('fa-IR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  })} g`;
}

/**
 * Deterministically calculates total monetary valuation (in integer IRR).
 */
export function calculateGemstoneValuation(
  method: ValuationMethod,
  quantity: number,
  weightCt: number,
  weightG: number,
  unitPrice: number,
): number {
  const safeQty = Math.max(1, Math.round(Number(quantity) || 1));
  const safeCt = Math.max(0, Number(weightCt) || 0);
  const safeG = Math.max(0, Number(weightG) || 0);
  const safePrice = Math.max(0, Math.round(Number(unitPrice) || 0));

  switch (method) {
    case 'per_carat':
      return Math.round(safeCt * safePrice);
    case 'per_gram':
      return Math.round(safeG * safePrice);
    case 'per_piece':
      return Math.round(safeQty * safePrice);
    case 'total_value':
    default:
      return safePrice;
  }
}

/**
 * Universal weight parser
 */
export function parseWeight(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }
  const str = String(value).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function formatCaratWeight(ct: number, precision = 2): string {
  if (!Number.isFinite(ct) || ct <= 0) return '0';
  const rounded = Number(Math.round(Number(ct + 'e' + precision)) + 'e-' + precision);
  return rounded.toFixed(precision).replace(/\.?0+$/, '');
}

export function formatGramWeight(g: number, precision = 3): string {
  if (!Number.isFinite(g) || g <= 0) return '0';
  const rounded = Number(Math.round(Number(g + 'e' + precision)) + 'e-' + precision);
  return rounded.toFixed(precision);
}

export type ValuationCalcParams = {
  valuationMethod: 'per_carat' | 'per_gram' | 'total_amount' | 'total_value';
  weightCt: number;
  weightG: number;
  unitCostRial: number;
  totalCostManualRial?: number;
};

export function calculateValuationTotalCost({
  valuationMethod,
  weightCt,
  weightG,
  unitCostRial,
  totalCostManualRial = 0,
}: ValuationCalcParams): number {
  const safeCt = Math.max(0, Number(weightCt) || 0);
  const safeG = Math.max(0, Number(weightG) || 0);
  const unitRial = Math.max(0, Math.round(Number(unitCostRial) || 0));
  const manualRial = Math.max(0, Math.round(Number(totalCostManualRial) || 0));

  if (valuationMethod === 'per_carat') {
    return Math.round(safeCt * unitRial);
  }
  if (valuationMethod === 'per_gram') {
    return Math.round(safeG * unitRial);
  }
  return manualRial;
}

