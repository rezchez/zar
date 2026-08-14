'use client';

/**
 * Breadcrumbs — ناوبری مسیر (بردکرامب) پویا بر اساس آدرس فعلی.
 * RTL-friendly, آیتم‌های میانی لینک‌دار، آیتم آخر متن ساده.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, Home } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'داشبورد',
  customers: 'طرف‌حساب‌ها',
  new: 'ایجاد جدید',
  documents: 'اسناد',
  reports: 'گزارشات',
  users: 'مدیریت کاربران',
  settings: 'تنظیمات کلی',
  account: 'حساب کاربری',
  'activity-log': 'لاگ برنامه',
};

function labelFor(segment: string) {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // شناسه‌های داینامیک (مثل /customers/[id]) به عنوان پرونده نمایش داده می‌شوند
  return 'پرونده طرف‌حساب';
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join('/')}`,
    label: labelFor(segment),
    isLast: index === segments.length - 1,
  }));

  return (
    <nav className="breadcrumbs" aria-label="مسیر صفحه">
      <Link href="/dashboard" className="breadcrumbs-home" aria-label="داشبورد">
        <Home size={14} strokeWidth={1.8} />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="breadcrumbs-item">
          <ChevronLeft size={13} className="breadcrumbs-separator" aria-hidden="true" />
          {crumb.isLast ? (
            <strong aria-current="page">{crumb.label}</strong>
          ) : (
            <Link href={crumb.href}>{crumb.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}
