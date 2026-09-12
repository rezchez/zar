'use client';

/**
 * Breadcrumbs — ناوبری مسیر (بردکرامب) پویا بر اساس آدرس فعلی.
 * RTL-friendly, آیتم‌های میانی لینک‌دار، آیتم آخر متن ساده.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Home } from 'lucide-react';

/**
 * مسیرهای دقیق جهت نگاشت سلسله‌مراتب دقیق صفحات Zarfolio
 */
export const EXACT_PATH_LABELS: Record<string, string> = {
  '/dashboard': 'داشبورد',
  '/dashboard/customers': 'طرف‌حساب‌ها',
  '/dashboard/customers/new': 'افزودن طرف‌حساب جدید',
  '/dashboard/documents': 'اسناد',
  '/dashboard/documents/new': 'ثبت سند',
  '/dashboard/documents/opening-balance': 'تراز افتتاحیه',
  '/dashboard/documents/initial-inventory': 'تعریف موجودی اول دوره',
  '/dashboard/documents/initial-inventory/checks': 'موجودی اولیه چک‌های صادرشده',
  '/dashboard/documents/initial-inventory/bank': 'موجودی اول دوره بانک',
  '/dashboard/documents/initial-inventory/cash': 'موجودی اول دوره صندوق',
  '/dashboard/documents/initial-inventory/coin': 'موجودی اول دوره مسکوکات',
  '/dashboard/documents/initial-inventory/workmanship': 'موجودی اول دوره کار ساخته',
  '/dashboard/accounting': 'عملیات مالی و حسابداری',
  '/dashboard/accounting/chart-of-accounts': 'کدینگ حساب‌ها',
  '/dashboard/reports': 'گزارش‌ها و ترازها',
  '/dashboard/reports/documents': 'گزارش اسناد',
  '/dashboard/users': 'مدیریت کاربران',
  '/dashboard/activity-log': 'لاگ و رویدادها',
  '/dashboard/audit-logs': 'لاگ حسابرسی',
  '/dashboard/settings': 'تنظیمات کلی سامانه',
  '/dashboard/account': 'حساب کاربری',
};

/**
 * نگاشت تک‌سگمنت‌ها به عنوان فال‌بک
 */
export const SEGMENT_FALLBACK_LABELS: Record<string, string> = {
  dashboard: 'داشبورد',
  customers: 'طرف‌حساب‌ها',
  new: 'ایجاد جدید',
  documents: 'اسناد',
  'initial-inventory': 'موجودی اول دوره',
  'opening-balance': 'تراز افتتاحیه',
  checks: 'چک‌های صادرشده',
  bank: 'موجودی بانک',
  cash: 'موجودی صندوق',
  coin: 'موجودی مسکوکات',
  workmanship: 'کار ساخته',
  accounting: 'حسابداری',
  'chart-of-accounts': 'کدینگ حساب‌ها',
  reports: 'گزارش‌ها و ترازها',
  users: 'مدیریت کاربران',
  settings: 'تنظیمات کلی',
  account: 'حساب کاربری',
  'activity-log': 'لاگ و رویدادها',
  'audit-logs': 'لاگ حسابرسی',
};

/**
 * تشخیص برچسب مناسب برای سگمنت در مسیر فعلی
 */
export function getBreadcrumbLabel(currentHref: string, segment: string, parentSegment?: string): string {
  // ۱. تطبیق کامل مسیر
  if (EXACT_PATH_LABELS[currentHref]) {
    return EXACT_PATH_LABELS[currentHref];
  }

  // ۲. تطبیق سگمنت شناخته‌شده
  if (SEGMENT_FALLBACK_LABELS[segment]) {
    return SEGMENT_FALLBACK_LABELS[segment];
  }

  // ۳. سگمنت‌های پویا (شناسه‌ها و پارامترها) بر اساس والد
  if (parentSegment === 'customers') {
    return 'پرونده طرف‌حساب';
  }
  if (parentSegment === 'checks') {
    return 'جزئیات چک';
  }
  if (parentSegment === 'documents') {
    return 'مشاهده سند';
  }
  if (parentSegment === 'users') {
    return 'پروفایل کاربر';
  }
  if (parentSegment === 'reports') {
    return 'گزارش';
  }
  if (parentSegment === 'banks') {
    return 'اطلاعات حساب بانکی';
  }

  return 'مشاهده جزئیات';
}

export function getCrumbsForPathname(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);

  return segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join('/')}`;
    const parentSegment = index > 0 ? segments[index - 1] : undefined;
    return {
      href,
      label: getBreadcrumbLabel(href, segment, parentSegment),
      isLast: index === segments.length - 1,
    };
  });
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = getCrumbsForPathname(pathname);

  return (
    <nav className="breadcrumbs" aria-label="مسیر صفحه" dir="rtl">
      <Link href="/dashboard" className="breadcrumbs-home" aria-label="داشبورد" title="داشبورد">
        <Home size={14} strokeWidth={1.8} />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="breadcrumbs-item">
          <ChevronLeft size={13} className="breadcrumbs-separator shrink-0" aria-hidden="true" />
          {crumb.isLast ? (
            <strong aria-current="page" className="truncate max-w-[200px] sm:max-w-none">
              {crumb.label}
            </strong>
          ) : (
            <Link href={crumb.href} className="truncate max-w-[140px] sm:max-w-none">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
