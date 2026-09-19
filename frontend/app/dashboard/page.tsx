import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import DashboardClientContainer from '@/src/components/dashboard/DashboardClientContainer';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await getServerAuth();

  if (!user) {
    redirect('/');
  }

  return (
    <DashboardShell user={user}>
      {/* سربرگ خوش‌آمدگویی */}
      <div className="dashboard-page-heading mb-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
            سلام، {user.name || 'کاربر'}
          </h1>
        </div>
      </div>

      {/* سیستم هوشمند مدیریت و Drag & Drop ویجت‌های داشبورد */}
      <DashboardClientContainer />
    </DashboardShell>
  );
}
