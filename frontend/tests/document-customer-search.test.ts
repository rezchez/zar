import { describe, expect, it } from 'bun:test';
import { normalizeDigits } from '@/lib/jalali';

function getCustomerGroupBadge(groupName?: string) {
  const name = (groupName || '').trim();
  if (!name) return null;
  if (name === 'ریگیر') {
    return {
      label: 'ریگیر',
      classes: 'bg-amber-100 text-amber-900 border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    };
  }
  if (name === 'همکار' || name === 'بنکدار') {
    return {
      label: name,
      classes: 'bg-blue-100 text-blue-900 border-blue-300/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    };
  }
  if (name === 'supplier' || name === 'تأمین‌کننده') {
    return {
      label: 'تأمین‌کننده',
      classes: 'bg-purple-100 text-purple-900 border-purple-300/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    };
  }
  if (name === 'customer' || name === 'مشتری' || name === 'خریدار') {
    return {
      label: 'مشتری',
      classes: 'bg-emerald-100 text-emerald-900 border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    };
  }
  return {
    label: name,
    classes: 'bg-slate-100 text-slate-800 border-slate-300/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  };
}

function filterCustomers(customers: any[], customerQuery: string, isDropdownOpen: boolean) {
  const rawQuery = customerQuery.trim().toLocaleLowerCase();
  const normalizedQuery = normalizeDigits(rawQuery);

  if (!rawQuery) {
    return isDropdownOpen ? customers.slice(0, 8) : [];
  }

  return customers.filter((customer) => {
    const name = (customer.name || '').toLocaleLowerCase();
    const englishName = (customer.englishName || '').toLocaleLowerCase();
    const code = normalizeDigits(String(customer.customerCode || ''));
    const p1 = normalizeDigits(customer.phone1 || '');
    const p2 = normalizeDigits(customer.phone2 || '');
    const p3 = normalizeDigits(customer.phone3 || '');
    const group = (customer.groupName || '').toLocaleLowerCase();
    const city = (customer.city || '').toLocaleLowerCase();
    const nationalId = normalizeDigits(customer.nationalId || '');

    return (
      name.includes(rawQuery) ||
      englishName.includes(rawQuery) ||
      code.includes(normalizedQuery) ||
      p1.includes(normalizedQuery) ||
      p2.includes(normalizedQuery) ||
      p3.includes(normalizedQuery) ||
      group.includes(rawQuery) ||
      city.includes(rawQuery) ||
      nationalId.includes(normalizedQuery)
    );
  }).slice(0, 10);
}

describe('DocumentForm Customer Search & Selection Tests', () => {
  const mockCustomers = [
    { id: '1', customerCode: 101, name: 'آزمایشگاه ریگیری زرین', groupName: 'ریگیر', phone1: '09121111111', city: 'تهران' },
    { id: '2', customerCode: 102, name: 'بنکداری شمس', groupName: 'بنکدار', phone1: '09122222222', city: 'اصفهان' },
    { id: '3', customerCode: 103, name: 'طلافروشی همکار البرز', groupName: 'همکار', phone1: '09123333333', city: 'کرج' },
    { id: '4', customerCode: 104, name: 'علی رضایی', groupName: 'مشتری', phone1: '09124444444', city: 'تهران' },
  ];

  it('correctly maps customer group badge styles and labels', () => {
    const refinerBadge = getCustomerGroupBadge('ریگیر');
    expect(refinerBadge).not.toBeNull();
    expect(refinerBadge?.label).toBe('ریگیر');
    expect(refinerBadge?.classes).toContain('bg-amber-100');

    const partnerBadge = getCustomerGroupBadge('همکار');
    expect(partnerBadge?.label).toBe('همکار');
    expect(partnerBadge?.classes).toContain('bg-blue-100');

    const customerBadge = getCustomerGroupBadge('مشتری');
    expect(customerBadge?.label).toBe('مشتری');
    expect(customerBadge?.classes).toContain('bg-emerald-100');

    expect(getCustomerGroupBadge('')).toBeNull();
  });

  it('filters customers by group name (e.g. typing ریگیر)', () => {
    const results = filterCustomers(mockCustomers, 'ریگیر', true);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('آزمایشگاه ریگیری زرین');
  });

  it('filters customers by phone number using Persian or English digits', () => {
    // English digits
    const resultsEn = filterCustomers(mockCustomers, '0912222', true);
    expect(resultsEn.length).toBe(1);
    expect(resultsEn[0].name).toBe('بنکداری شمس');

    // Persian digits
    const resultsFa = filterCustomers(mockCustomers, '۰۹۱۲۲۲۲', true);
    expect(resultsFa.length).toBe(1);
    expect(resultsFa[0].name).toBe('بنکداری شمس');
  });

  it('filters customers by customer code (both Persian and English digits)', () => {
    expect(filterCustomers(mockCustomers, '103', true)[0].name).toBe('طلافروشی همکار البرز');
    expect(filterCustomers(mockCustomers, '۱۰۳', true)[0].name).toBe('طلافروشی همکار البرز');
  });

  it('shows default top customers when dropdown is open and query is empty', () => {
    const results = filterCustomers(mockCustomers, '', true);
    expect(results.length).toBe(4);

    const closedResults = filterCustomers(mockCustomers, '', false);
    expect(closedResults.length).toBe(0);
  });

  it('isRefinerGroup recognizes all common Persian variants and synonyms of refiner', () => {
    const { isRefinerGroup } = require('@/lib/customer-groups');
    expect(isRefinerGroup('ریگیر')).toBe(true);
    expect(isRefinerGroup('ری‌گیر')).toBe(true); // with ZWNJ
    expect(isRefinerGroup('ریگیری')).toBe(true);
    expect(isRefinerGroup('ری‌گیری')).toBe(true); // with ZWNJ
    expect(isRefinerGroup(' کارگاه ری‌گیری ')).toBe(true);
    expect(isRefinerGroup('آزمایشگاه ریگیر')).toBe(true);
    expect(isRefinerGroup('refiner')).toBe(true);
    expect(isRefinerGroup('refining')).toBe(true);
    expect(isRefinerGroup('ريگير')).toBe(true); // Arabic yeh

    expect(isRefinerGroup('مشتری')).toBe(false);
    expect(isRefinerGroup('همکار')).toBe(false);
    expect(isRefinerGroup('بنکدار')).toBe(false);
    expect(isRefinerGroup('')).toBe(false);
    expect(isRefinerGroup(undefined)).toBe(false);
  });
});
