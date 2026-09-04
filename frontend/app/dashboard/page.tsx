import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import DashboardWidgetContainer from '@/src/components/dashboard/DashboardWidgetContainer';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getServerAuth();

  if (!user) {
    redirect('/');
  }

  return (
    <DashboardShell user={user}>
      {/* سربرگ خوش‌آمدگویی */}
      <div className="dashboard-page-heading mb-6">
        <div>
          <p className="eyebrow">نمای کلی</p>
          <h1>سلام، {user.name || 'کاربر'}</h1>
          <p>وضعیت بازار، تراز طلایی و صندوق‌های مالی شما در یک نگاه.</p>
        </div>
        <span className="dashboard-status-pill">
          <span />
          بازار باز
        </span>
      </div>

      {/* کانتینر پویای ویجت‌های سفارشی‌سازی‌پذیر داشبورد */}
      <DashboardWidgetContainer />
    </DashboardShell>
  );
}
