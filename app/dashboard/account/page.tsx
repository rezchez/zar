import { redirect } from 'next/navigation';

import { getServerAuth } from '@/lib/auth';
import AccountSettings from '@/src/components/AccountSettings';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getServerAuth();

  if (!user) {
    redirect('/');
  }

  return (
    <DashboardShell user={user}>
      <AccountSettings user={user} />
    </DashboardShell>
  );
}
