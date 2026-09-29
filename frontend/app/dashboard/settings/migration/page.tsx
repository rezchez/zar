import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import TahesabMigrationSection from '@/src/components/settings/TahesabMigrationSection';

export const dynamic = 'force-dynamic';

export default async function MigrationPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    redirect('/dashboard');
  }

  return (
    <DashboardShell user={context.user}>
      <div className="p-6">
        <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">در حال بارگذاری بخش مهاجرت...</div>}>
          <TahesabMigrationSection />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
