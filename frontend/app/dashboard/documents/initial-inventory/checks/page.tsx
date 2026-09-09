import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapCheckRecord, type CheckRecord } from '@/lib/check';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import InitialIssuedChecksClient from '@/features/checks/components/InitialIssuedChecksClient';

export const dynamic = 'force-dynamic';

export default async function InitialIssuedChecksPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    redirect('/dashboard');
  }

  let initialChecks: CheckRecord[] = [];
  try {
    const service = await getPocketBaseServiceClient().catch(() => null);
    const client = service || context.pb;
    const records = await client.collection('checks').getFullList({
      filter: 'is_opening_balance = true',
      sort: '-dueDate',
      expand: 'bankAccount,customer,created_by',
    }).catch(async () => {
      return client.collection('checks').getFullList({
        sort: '-dueDate',
        expand: 'bankAccount,customer,created_by',
      }).catch(() => []);
    });

    initialChecks = records
      .filter((r: Record<string, unknown>) => r.is_opening_balance === true || r.isOpeningBalance === true)
      .map(mapCheckRecord);
  } catch {
    initialChecks = [];
  }

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <InitialIssuedChecksClient initialChecks={initialChecks} />
      </main>
    </DashboardShell>
  );
}
