import { describe, expect, it } from 'bun:test';
import {
  EXACT_PATH_LABELS,
  getBreadcrumbLabel,
  getCrumbsForPathname,
} from '@/components/layout/Breadcrumbs';

describe('Zarfolio — Breadcrumb Audit & Route Hierarchy Tests', () => {
  it('Dashboard root route generates correct single crumb', () => {
    const crumbs = getCrumbsForPathname('/dashboard');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]).toEqual({
      href: '/dashboard',
      label: 'داشبورد',
      isLast: true,
    });
  });

  it('Customer routes have accurate hierarchy and meaningful titles', () => {
    // Customers list
    const listCrumbs = getCrumbsForPathname('/dashboard/customers');
    expect(listCrumbs.map((c) => c.label)).toEqual(['داشبورد', 'طرف‌حساب‌ها']);
    expect(listCrumbs[1].isLast).toBe(true);

    // New Customer
    const newCrumbs = getCrumbsForPathname('/dashboard/customers/new');
    expect(newCrumbs.map((c) => c.label)).toEqual(['داشبورد', 'طرف‌حساب‌ها', 'افزودن طرف‌حساب جدید']);

    // Dynamic Customer ID (e.g. /dashboard/customers/rec_abc123)
    const detailCrumbs = getCrumbsForPathname('/dashboard/customers/rec_abc123');
    expect(detailCrumbs.map((c) => c.label)).toEqual(['داشبورد', 'طرف‌حساب‌ها', 'پرونده طرف‌حساب']);
  });

  it('Documents & Initial Inventory check routes reflect exact hierarchy without duplicate or erroneous labels', () => {
    // Initial inventory root
    const invRoot = getCrumbsForPathname('/dashboard/documents/initial-inventory');
    expect(invRoot.map((c) => c.label)).toEqual(['داشبورد', 'اسناد', 'تعریف موجودی اول دوره']);

    // Initial issued checks
    const checksCrumbs = getCrumbsForPathname('/dashboard/documents/initial-inventory/checks');
    expect(checksCrumbs.map((c) => c.label)).toEqual([
      'داشبورد',
      'اسناد',
      'تعریف موجودی اول دوره',
      'موجودی اولیه چک‌های صادرشده',
    ]);
    expect(checksCrumbs[3].isLast).toBe(true);
    expect(checksCrumbs[3].href).toBe('/dashboard/documents/initial-inventory/checks');

    // Initial bank
    const bankCrumbs = getCrumbsForPathname('/dashboard/documents/initial-inventory/bank');
    expect(bankCrumbs.map((c) => c.label)).toEqual([
      'داشبورد',
      'اسناد',
      'تعریف موجودی اول دوره',
      'موجودی اول دوره بانک',
    ]);

    // Initial cash
    const cashCrumbs = getCrumbsForPathname('/dashboard/documents/initial-inventory/cash');
    expect(cashCrumbs.map((c) => c.label)).toEqual([
      'داشبورد',
      'اسناد',
      'تعریف موجودی اول دوره',
      'موجودی اول دوره صندوق',
    ]);

    // Initial coin
    const coinCrumbs = getCrumbsForPathname('/dashboard/documents/initial-inventory/coin');
    expect(coinCrumbs.map((c) => c.label)).toEqual([
      'داشبورد',
      'اسناد',
      'تعریف موجودی اول دوره',
      'موجودی اول دوره مسکوکات',
    ]);
  });

  it('Accounting & Chart of Accounts routes produce accurate Persian hierarchy', () => {
    const coaCrumbs = getCrumbsForPathname('/dashboard/accounting/chart-of-accounts');
    expect(coaCrumbs.map((c) => c.label)).toEqual([
      'داشبورد',
      'عملیات مالی و حسابداری',
      'کدینگ حساب‌ها',
    ]);
  });

  it('Reports nested routes produce accurate hierarchy', () => {
    const repCrumbs = getCrumbsForPathname('/dashboard/reports/documents');
    expect(repCrumbs.map((c) => c.label)).toEqual([
      'داشبورد',
      'گزارش‌ها و ترازها',
      'گزارش اسناد',
    ]);
  });

  it('Admin & Setting routes produce accurate hierarchy', () => {
    expect(getCrumbsForPathname('/dashboard/users').map((c) => c.label)).toEqual(['داشبورد', 'مدیریت کاربران']);
    expect(getCrumbsForPathname('/dashboard/activity-log').map((c) => c.label)).toEqual(['داشبورد', 'لاگ و رویدادها']);
    expect(getCrumbsForPathname('/dashboard/audit-logs').map((c) => c.label)).toEqual(['داشبورد', 'لاگ حسابرسی']);
    expect(getCrumbsForPathname('/dashboard/settings').map((c) => c.label)).toEqual(['داشبورد', 'تنظیمات کلی سامانه']);
    expect(getCrumbsForPathname('/dashboard/account').map((c) => c.label)).toEqual(['داشبورد', 'حساب کاربری']);
  });

  it('Dynamic routes under checks or documents do NOT falsely claim to be customer files', () => {
    expect(getBreadcrumbLabel('/dashboard/checks/rec_chk123', 'rec_chk123', 'checks')).toBe('جزئیات چک');
    expect(getBreadcrumbLabel('/dashboard/documents/doc_999', 'doc_999', 'documents')).toBe('مشاهده سند');
    expect(getBreadcrumbLabel('/dashboard/unknown/xyz', 'xyz', 'unknown')).toBe('مشاهده جزئیات');
  });

  it('Every exact route in EXACT_PATH_LABELS is non-empty and well-formed', () => {
    for (const [path, label] of Object.entries(EXACT_PATH_LABELS)) {
      expect(path.startsWith('/')).toBe(true);
      expect(label.trim().length).toBeGreaterThan(0);
      expect(label).not.toContain('[object');
    }
  });
});
