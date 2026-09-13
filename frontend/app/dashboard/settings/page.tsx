import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import ProgramSettings from '@/src/components/ProgramSettings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    redirect('/dashboard');
  }

  return (
    <DashboardShell user={context.user}>
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">در حال بارگذاری تنظیمات...</div>}>
        <ProgramSettings />
      </Suspense>
    </DashboardShell>
  );
}
