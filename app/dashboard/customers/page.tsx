import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomersWithBalances } from '@/lib/customer-service';
import type { Customer } from '@/lib/customer';
import CustomerManagement from '@/src/components/CustomerManagement';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let customers: Customer[] = [];
  try {
    customers = await getCustomersWithBalances(context.pb);
  } catch {
    customers = [];
  }

  return <DashboardShell user={context.user}><CustomerManagement initialCustomers={customers} canDelete={context.user.role === 'admin' || context.user.role === 'manager'} /></DashboardShell>;
}
