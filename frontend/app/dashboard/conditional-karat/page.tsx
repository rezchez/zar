import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import ConditionalKaratClient from '@/features/conditional-karat/components/ConditionalKaratClient';

export const dynamic = 'force-dynamic';

export default async function ConditionalKaratPage() {
  const context = await getServerAuthContext();
  if (!context) {
    redirect('/');
  }

  return (
    <DashboardShell user={context.user}>
      <ConditionalKaratClient />
    </DashboardShell>
  );
}
