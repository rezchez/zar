const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Normalizes Persian (۰-۹) and Arabic-Indic (٠-٩) digits in a string into standard ASCII (0-9) digits.
 */
export function normalizePersianDigits(value: string): string {
  if (!value) return '';
  return value
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/**
 * Converts standard ASCII (0-9) digits in a string or number into Persian (۰-۹) digits.
 */
export function toPersianDigits(value: string | number): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return str.replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)] ?? d);
}
