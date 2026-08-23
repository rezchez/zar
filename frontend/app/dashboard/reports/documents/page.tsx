import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import CustomerLedgerReport from '@/src/components/reports/CustomerLedgerReport';
import { getCustomersWithBalances } from '@/lib/customer-service';

export const dynamic = 'force-dynamic';

export default async function DocumentsReportPage() {
  const context = await getServerAuthContext();

  if (!context) {
    redirect('/');
  }

  // Load all customers for the filter dropdown.
  const customers = await getCustomersWithBalances(context.pb);

  return (
    <DashboardShell user={context.user}>
      <CustomerLedgerReport availableCustomers={customers} />
    </DashboardShell>
  );
}
