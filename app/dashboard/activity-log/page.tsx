import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import ActivityLog from '@/src/components/ActivityLog';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function ActivityLogPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    redirect('/dashboard');
  }

  return (
    <DashboardShell user={context.user}>
      <ActivityLog />
    </DashboardShell>
  );
}
