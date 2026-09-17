import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import RefiningManagementClient from '@/features/refining/components/RefiningManagementClient';

export const dynamic = 'force-dynamic';

export default async function RefiningDashboardPage() {
  const context = await getServerAuthContext();
  if (!context) {
    redirect('/');
  }

  return (
    <DashboardShell user={context.user}>
      <RefiningManagementClient />
    </DashboardShell>
  );
}
