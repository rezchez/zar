import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

function formatDate(value?: string) {
  if (!value) return 'هنوز ثبت نشده';

  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default async function DashboardPage() {
  const user = await getServerAuth();

  if (!user) {
    redirect('/');
  }

  return (
    <DashboardShell user={user}>
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">نمای کلی</p>
          <h1>سلام، {user.name || 'کاربر'}</h1>
          <p>وضعیت فضای کاری شما در یک نگاه.</p>
        </div>
        <span className="dashboard-status-pill">
          <span />
          فعال
        </span>
      </div>

      <div className="dashboard-stats-grid">
        <article className="dashboard-stat-card">
          <span>وضعیت حساب</span>
          <strong>فعال</strong>
          <small>حساب شما آماده استفاده است</small>
        </article>
        <article className="dashboard-stat-card">
          <span>نقش فعلی</span>
          <strong>{user.role}</strong>
          <small>سطح دسترسی حساب شما</small>
        </article>
        <article className="dashboard-stat-card">
          <span>آخرین ورود</span>
          <strong className="dashboard-stat-date">{formatDate(user.lastLoginAt)}</strong>
          <small>بر اساس رویدادهای احراز هویت</small>
        </article>
      </div>

      <section className="dashboard-panel dashboard-welcome-panel">
        <div className="dashboard-panel-heading">
          <div>
            <p className="eyebrow">شروع سریع</p>
            <h2>فضای کاری شما آماده است</h2>
          </div>
          <span className="dashboard-panel-icon">Z</span>
        </div>
        <p>
          از منوی کناری برای جابه‌جایی بین بخش‌ها استفاده کنید. امکانات پروژه،
          تیم و گزارش‌ها در مراحل بعدی به همین ساختار اضافه می‌شوند.
        </p>
      </section>
    </DashboardShell>
  );
}
