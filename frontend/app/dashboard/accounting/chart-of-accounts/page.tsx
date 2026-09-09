import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/components/layout/DashboardShell';
import ChartOfAccounts from '@/features/accounting/chart-of-accounts/components/ChartOfAccounts';

export default async function ChartOfAccountsPage() {
  const authContext = await getServerAuthContext();
  if (!authContext?.user) {
    redirect('/login');
  }

  return (
    <DashboardShell user={authContext.user}>
      <div className="max-w-7xl mx-auto space-y-6">
        <Suspense fallback={<div className="p-8 text-center text-slate-400 font-bold">در حال بارگذاری درختواره حساب‌ها...</div>}>
          <ChartOfAccounts />
        </Suspense>
      </div>
    </DashboardShell>
  );
}
