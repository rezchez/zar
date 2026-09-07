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
        <ChartOfAccounts />
      </div>
    </DashboardShell>
  );
}
