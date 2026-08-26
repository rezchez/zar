import { describe, expect, test } from 'bun:test';
import { normalizeDigits, parseJalaliDate, jalaliToGregorian, jalaliDateToIso, isoToJalaliString } from '../lib/jalali';

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

  test('handles Jalali boundary dates across all seasons and leap years', () => {
    // Start of year
    expect(jalaliDateToIso('1403/01/01')?.slice(0, 10)).toBe('2024-03-20');

    // End of first 6 months (31-day months)
    expect(jalaliDateToIso('1403/06/31')?.slice(0, 10)).toBe('2024-09-21');

    // Start of second 6 months (30-day months)
    expect(jalaliDateToIso('1403/07/01')?.slice(0, 10)).toBe('2024-09-22');

    // End of second 6 months in a leap year (1403 is leap year)
    expect(jalaliDateToIso('1403/12/30')?.slice(0, 10)).toBe('2025-03-20');

    // Non-leap year Esfand (1402 is non-leap)
    expect(jalaliDateToIso('1402/12/29')?.slice(0, 10)).toBe('2024-03-19');
  });

  test('round-trips birth dates accurately from historical years (1300+)', () => {
    const dates = [
      '1320/05/10',
      '1350/11/20',
      '1370/08/15',
      '1395/02/01',
      '1403/10/05',
    ];

    for (const d of dates) {
      const iso = jalaliDateToIso(d);
      expect(iso).not.toBeNull();
      const backToJalali = iso ? isoToJalaliString(iso) : '';
      expect(backToJalali).toBe(d);
    }
  });

  test('rejects invalid day/month boundary inputs', () => {
    expect(parseJalaliDate('1402/00/10')).toBeNull();
    expect(parseJalaliDate('1402/05/00')).toBeNull();
    expect(parseJalaliDate('1402/06/32')).toBeNull();
    expect(parseJalaliDate('1402/13/15')).toBeNull(); // Month 13 out of bounds
  });
});
