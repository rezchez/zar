import { redirect } from 'next/navigation';
import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import AuditRecovery from '@/src/components/AuditRecovery';

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (context.user.role !== 'admin' && context.user.role !== 'manager') redirect('/dashboard');
  return <DashboardShell user={context.user}><AuditRecovery /></DashboardShell>;
}
