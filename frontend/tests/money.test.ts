import { describe, expect, test } from 'bun:test';
import { convertRialToToman, convertTomanToRial, parseLocalizedAmount, formatMoney } from '../lib/money';
import { normalizePriceString, formatPriceWithCommas } from '../components/ui/price-input';

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
});
