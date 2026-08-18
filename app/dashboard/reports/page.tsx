import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import ReportsDashboard from '@/src/components/ReportsDashboard';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const context = await getServerAuthContext();

  if (!context) {
    redirect('/');
  }

  return (
    <DashboardShell user={context.user}>
      <ReportsDashboard />
    </DashboardShell>
  );
}
