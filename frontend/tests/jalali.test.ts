import { describe, expect, test } from 'bun:test';
import { normalizeDigits, parseJalaliDate, jalaliToGregorian, jalaliDateToIso } from '../lib/jalali';

describe('Jalali date utilities', () => {
  test('normalizeDigits removes Persian/Arabic variations', () => {
    expect(normalizeDigits('۱۴۰۲')).toBe('1402');
    expect(normalizeDigits('١٤٠٢')).toBe('1402');
  });

  test('parseJalaliDate captures basic boundaries', () => {
    expect(parseJalaliDate('1402/13/01')).toBeNull(); // Month out of bounds
    expect(parseJalaliDate('1402/05/32')).toBeNull(); // Day out of bounds for max standard month
    expect(parseJalaliDate('1402/10/10')).toEqual({ year: 1402, month: 10, day: 10 });
  });

  test('jalaliToGregorian outputs correctly', () => {
    const result = jalaliToGregorian('1402/10/11');
    expect(result?.year).toBe(2024);
    expect(result?.month).toBe(1);
    expect(result?.day).toBe(1);
  });

  test('jalaliDateToIso creates a valid ISO string', () => {
    const iso = jalaliDateToIso('1402/10/11');
    expect(iso).toContain('2024-01-01');
  });
});
