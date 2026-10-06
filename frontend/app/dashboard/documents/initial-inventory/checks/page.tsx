import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapCheckRecord, type CheckRecord } from '@/lib/check';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import UnifiedChecksClient from '@/features/checks/components/UnifiedChecksClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{ tab?: string }>;
};

export default async function InitialChecksPage({ searchParams }: PageProps) {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    redirect('/dashboard');
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const defaultTab = resolvedParams?.tab === 'received' ? 'received' : 'issued';

  let initialIssuedChecks: CheckRecord[] = [];
  let initialReceivedChecks: CheckRecord[] = [];
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

    const allOpeningChecks = records
      .filter((r: Record<string, unknown>) => r.is_opening_balance === true || r.isOpeningBalance === true)
      .map(mapCheckRecord);

    initialIssuedChecks = allOpeningChecks.filter((c) => c.chequeType !== 'receivable');
    initialReceivedChecks = allOpeningChecks.filter((c) => c.chequeType === 'receivable');
  } catch {
    initialIssuedChecks = [];
    initialReceivedChecks = [];
  }

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <UnifiedChecksClient
          initialIssuedChecks={initialIssuedChecks}
          initialReceivedChecks={initialReceivedChecks}
          defaultTab={defaultTab}
        />
      </main>
    </DashboardShell>
  );
}
