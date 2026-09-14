import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import RefiningPacketsClient from '@/features/refining/components/RefiningPacketsClient';

export const dynamic = 'force-dynamic';

export default async function RefiningPacketsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  return (
    <DashboardShell user={context.user}>
      <RefiningPacketsClient />
    </DashboardShell>
  );
}
