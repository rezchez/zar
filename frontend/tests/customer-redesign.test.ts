import { describe, expect, test } from 'bun:test';

import {
  getAvailableAccountCodes,
  getNextAutoCustomerCode,
} from '../lib/account-code';
import {
  findProvinceByCity,
  getCitiesByProvince,
  getProvinces,
  isValidCity,
  isValidProvince,
} from '../lib/iran-cities';
import {
  generateGroupSlug,
  isSystemGroup,
  SYSTEM_GROUPS,
} from '../lib/customer-groups';
import {
  dateToJalaliString,
  isoToJalaliString,
  jalaliDateToIso,
  parseJalaliDate,
} from '../lib/jalali';

describe('Iran Provinces & Cities Dataset', () => {
  test('returns all 31 official Iranian provinces', () => {
    const provinces = getProvinces();
    expect(provinces.length).toBe(31);
    expect(provinces).toContain('تهران');
    expect(provinces).toContain('اصفهان');
    expect(provinces).toContain('فارس');
    expect(provinces).toContain('خراسان رضوی');
  });

  test('filters cities correctly by province', () => {
    const tehranCities = getCitiesByProvince('تهران');
    expect(tehranCities).toContain('تهران');
    expect(tehranCities).toContain('شهریار');
    expect(tehranCities).toContain('ورامین');

    const esfahanCities = getCitiesByProvince('اصفهان');
    expect(esfahanCities).toContain('اصفهان');
    expect(esfahanCities).toContain('کاشان');
    expect(esfahanCities).not.toContain('تبریز');
  });

  test('validates province and city entries correctly', () => {
    expect(isValidProvince('تهران')).toBe(true);
    expect(isValidProvince('استان خیالی')).toBe(false);

    expect(isValidCity('فارس', 'شیراز')).toBe(true);
    expect(isValidCity('فارس', 'تبریز')).toBe(false);
  });

  test('finds province by city name', () => {
    expect(findProvinceByCity('تبریز')).toBe('آذربایجان شرقی');
    expect(findProvinceByCity('مراغه')).toBe('آذربایجان شرقی');
    expect(findProvinceByCity('شیراز')).toBe('فارس');
    expect(findProvinceByCity('شهر وجود ندارد')).toBeNull();
  });
});

describe('Account Code Gap Detection Algorithm', () => {
  test('locates gaps between used account codes', () => {
    const used = [52, 54];
    const available = getAvailableAccountCodes(used, undefined, 20);

    expect(available).toContain(53);
    expect(available).not.toContain(52);
    expect(available).not.toContain(54);
  });

  test('handles multiple gaps accurately', () => {
    const used = [1, 2, 3, 52, 54, 57];
    const available = getAvailableAccountCodes(used, undefined, 100);

    expect(available).toContain(4);
    expect(available).toContain(53);
    expect(available).toContain(55);
    expect(available).toContain(56);
    expect(available).toContain(58);
    expect(available).not.toContain(52);
    expect(available).not.toContain(54);
    expect(available).not.toContain(57);
  });

  test('preserves current customer code in edit mode', () => {
    const used = [52, 54, 57];
    const currentCustomerCode = 54;
    const available = getAvailableAccountCodes(used, currentCustomerCode, 20);

    expect(available).toContain(54); // Should be present because it's current customer's code
    expect(available).toContain(53);
    expect(available).toContain(55);
    expect(available).not.toContain(52);
    expect(available).not.toContain(57);
  });

  test('getNextAutoCustomerCode finds smallest available positive integer', () => {
    expect(getNextAutoCustomerCode([1, 2, 3])).toBe(4);
    expect(getNextAutoCustomerCode([1, 3, 4])).toBe(2); // Fills gap 2!
    expect(getNextAutoCustomerCode([52, 54])).toBe(1); // Fills smallest available 1!
  });
});

describe('Customer System and Custom Groups', () => {
  test('contains all 12 system groups with correct mappings', () => {
    expect(SYSTEM_GROUPS.length).toBe(12);
    const slugs = SYSTEM_GROUPS.map((g) => g.slug);
    expect(slugs).toContain('customer');
    expect(slugs).toContain('wholesaler');
    expect(slugs).toContain('stone_seller');
    expect(slugs).toContain('gold_plater');
    expect(slugs).toContain('stone_setter');
    expect(slugs).toContain('kifi');
    expect(slugs).toContain('partner');
    expect(slugs).toContain('bullion_dealer');
    expect(slugs).toContain('currency_exchange');
    expect(slugs).toContain('jeweler');
    expect(slugs).toContain('lapidary');
    expect(slugs).toContain('repairer');
  });

  test('identifies system groups correctly', () => {
    expect(isSystemGroup('مشتری')).toBe(true);
    expect(isSystemGroup('bullion_dealer')).toBe(true);
    expect(isSystemGroup('گروه دلخواه')).toBe(false);
  });

  test('generates system group slug or custom group slug', () => {
    expect(generateGroupSlug('مشتری')).toBe('customer');
    expect(generateGroupSlug('بنکدار')).toBe('wholesaler');
    expect(generateGroupSlug('همکار خاص')).toContain('custom_همکار_خاص');
  });
});

describe('Jalali Date Conversions', () => {
  test('converts ISO date string to Jalali string without timezone drift', () => {
    const isoDate = '2023-05-15';
    const jalaliStr = isoToJalaliString(isoDate);
    expect(jalaliStr).toBe('1402/02/25');

    const backToIso = jalaliDateToIso(jalaliStr);
    expect(backToIso).not.toBeNull();
    expect(backToIso?.slice(0, 10)).toBe('2023-05-15');
  });

  test('parses Jalali date input correctly', () => {
    const parsed = parseJalaliDate('۱۴۰۲/۰۵/۱۲');
    expect(parsed).toEqual({ year: 1402, month: 5, day: 12 });
  });

  test('converts Date object to formatted Jalali string', () => {
    const date = new Date('2024-03-21T12:00:00Z');
    const jalaliStr = dateToJalaliString(date);
    expect(jalaliStr).toBe('1403/01/01');
  });
});
