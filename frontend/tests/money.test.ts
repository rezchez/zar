import { describe, expect, test } from 'bun:test';
import { convertRialToToman, convertTomanToRial, parseLocalizedAmount, formatMoney } from '../lib/money';
import { normalizePriceString, formatPriceWithCommas, formatAmountHelperWords } from '../components/ui/price-input';
import { getAmountInPersianWords, roundAmountToDigits } from '../features/metals/services/trade-utils';

describe('Financial Math Precision & Currency tests', () => {
  test('convertRialToToman divides by 10 and floors correctly', () => {
    expect(convertRialToToman(1005)).toBe(100);
    expect(convertRialToToman(-1005)).toBe(-101); // Math.floor(-100.5) = -101
    expect(convertRialToToman(BigInt(50000))).toBe(5000);
  });

  test('convertTomanToRial multiplies by 10', () => {
    expect(convertTomanToRial(100)).toBe(1000);
    expect(convertTomanToRial(-100)).toBe(-1000);
    expect(convertTomanToRial(BigInt(5000))).toBe(50000);
  });

  test('parseLocalizedAmount handles Persian digits, commas, and spaces', () => {
    expect(parseLocalizedAmount('۱,۲۳۴')).toBe(1234);
    expect(parseLocalizedAmount(' 1,234.56 ')).toBe(1234.56);
    expect(parseLocalizedAmount('invalid')).toBe(0);
  });

  test('formatMoney outputs correctly localized string based on base currency', () => {
    expect(formatMoney(150000, 'IRR')).toContain('۱۵۰٬۰۰۰ ریال');
    expect(formatMoney(150000, 'IRT')).toContain('۱۵٬۰۰۰ تومان');
  });

  test('normalizePriceString normalizes Persian and Arabic-Indic numerals and strips commas', () => {
    expect(normalizePriceString('۱,۲۵۰,۰۰۰')).toBe('1250000');
    expect(normalizePriceString('١٢٥٠٠٠٠')).toBe('1250000');
    expect(normalizePriceString(' -۵,۰۰۰.۵۰ ')).toBe('-5000.50');
    expect(normalizePriceString('-۵,۰۰۰', false)).toBe('5000');
  });

  test('formatPriceWithCommas separates groups with commas correctly', () => {
    expect(formatPriceWithCommas('1250000')).toBe('1,250,000');
    expect(formatPriceWithCommas('-5000000')).toBe('-5,000,000');
    expect(formatPriceWithCommas('1234.56')).toBe('1,234.56');
    expect(formatPriceWithCommas('')).toBe('');
  });

  test('formatAmountHelperWords inverts currency: Rial input produces Toman written text', () => {
    // 1,030,000,000 Rials -> 103,000,000 Tomans
    expect(formatAmountHelperWords(1030000000, undefined, 'IRR')).toBe('یکصد و سه میلیون تومان');
    expect(formatAmountHelperWords(1030000000, 'ریال', 'IRR')).toBe('یکصد و سه میلیون تومان');

    // 3,328,870,216 Rials -> 332,887,021 Tomans
    expect(formatAmountHelperWords(3328870216, undefined, 'IRR')).toBe('سیصد و سی و دو میلیون و هشتصد و هشتاد و هفت هزار و بیست و یک تومان');
    expect(formatAmountHelperWords(3328870216, 'ریال')).toBe('سیصد و سی و دو میلیون و هشتصد و هشتاد و هفت هزار و بیست و یک تومان');
  });

  test('formatAmountHelperWords inverts currency: Toman input produces Rial written text', () => {
    // 103,000,000 Tomans -> 1,030,000,000 Rials
    expect(formatAmountHelperWords(103000000, undefined, 'IRT')).toBe('یک میلیارد و سی میلیون ریال');
    expect(formatAmountHelperWords(103000000, 'تومان')).toBe('یک میلیارد و سی میلیون ریال');
  });

  test('formatAmountHelperWords handles foreign currency without inversion', () => {
    expect(formatAmountHelperWords(100, 'USD')).toBe('یکصد USD');
    expect(formatAmountHelperWords(50, 'دلار')).toBe('پنجاه دلار');
  });

  test('formatAmountHelperWords handles zero, null, and empty inputs', () => {
    expect(formatAmountHelperWords(0)).toBe('');
    expect(formatAmountHelperWords(null)).toBe('');
  });

  test('getAmountInPersianWords correctly inverts currencies between IRR and IRT', () => {
    expect(getAmountInPersianWords(1030000000, 'IRR')).toBe('یکصد و سه میلیون تومان');
    expect(getAmountInPersianWords(103000000, 'IRT')).toBe('یک میلیارد و سی میلیون ریال');
    expect(getAmountInPersianWords(0, 'IRR')).toBe('');
  });

  test('roundAmountToDigits rounds numbers to specified number of trailing zero digits', () => {
    const val = 3328870216;

    // 2 digits (صدگان)
    expect(roundAmountToDigits(val, 2, 'round')).toBe(3328870200);
    expect(roundAmountToDigits(val, 2, 'ceil')).toBe(3328870300);
    expect(roundAmountToDigits(val, 2, 'floor')).toBe(3328870200);

    // 3 digits (هزارگان)
    expect(roundAmountToDigits(val, 3, 'round')).toBe(3328870000);
    expect(roundAmountToDigits(val, 3, 'ceil')).toBe(3328871000);
    expect(roundAmountToDigits(val, 3, 'floor')).toBe(3328870000);

    // 4 digits (ده‌هزارگان)
    expect(roundAmountToDigits(val, 4, 'round')).toBe(3328870000);
    expect(roundAmountToDigits(val, 4, 'ceil')).toBe(3328880000);

    // 5 digits (صدهزارگان)
    expect(roundAmountToDigits(val, 5, 'round')).toBe(3328900000);
    expect(roundAmountToDigits(val, 5, 'ceil')).toBe(3328900000);
    expect(roundAmountToDigits(val, 5, 'floor')).toBe(3328800000);

    // 6 digits (میلیون‌ها)
    expect(roundAmountToDigits(val, 6, 'round')).toBe(3329000000);

    // Edge cases: 0 digits or 0 amount
    expect(roundAmountToDigits(val, 0)).toBe(val);
    expect(roundAmountToDigits(0, 3)).toBe(0);
  });
});
