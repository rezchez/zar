import { redirect } from 'next/navigation';

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
      <ProgramSettings />
    </DashboardShell>
  );
}
