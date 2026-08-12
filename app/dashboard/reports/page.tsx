import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import type { Customer } from '@/lib/customer';
import { getCustomersWithBalances } from '@/lib/customer-service';
import CustomerReports from '@/src/components/CustomerReports';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let customers: Customer[] = [];
  try {
    customers = await getCustomersWithBalances(context.pb);
  } catch {
    customers = [];
  }

  return (
    <DashboardShell user={context.user}>
      <CustomerReports customers={customers} />
    </DashboardShell>
  );
}
