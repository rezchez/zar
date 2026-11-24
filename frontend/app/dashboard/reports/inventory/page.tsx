import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import InventoryReportClient from '@/src/components/reports/InventoryReportClient';

export const dynamic = 'force-dynamic';

export default async function InventoryReportPage() {
  const context = await getServerAuthContext();

  if (!context) {
    redirect('/');
  }

  if (
    !hasPermission(context.user, 'document.view') &&
    !hasPermission(context.user, 'document.manage') &&
    !hasPermission(context.user, 'transaction.view') &&
    context.user.role !== 'admin'
  ) {
    redirect('/dashboard');
  }

  return (
    <DashboardShell user={context.user}>
      <div className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8">
        <InventoryReportClient />
      </div>
    </DashboardShell>
  );
}
