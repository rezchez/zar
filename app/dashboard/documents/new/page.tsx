import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  return (
    <DashboardShell user={context.user}>
      <section className="dashboard-panel dashboard-coming-soon">
        <p className="eyebrow">دسترسی سریع</p>
        <h1>ثبت سند</h1>
        <p>بخش ثبت اسناد در مرحله بعدی ساخته می‌شود و از همین مسیر در دسترس خواهد بود.</p>
      </section>
    </DashboardShell>
  );
}
