import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomersPageWithBalances } from '@/lib/customer-service';
import type { Customer } from '@/lib/customer';
import CustomerManagement from '@/src/components/CustomerManagementLoader';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let customers: Customer[] = [];
  let meta = { page: 1, perPage: 25, totalItems: 0, totalPages: 1 };
  try {
    const result = await getCustomersPageWithBalances(context.pb, { page: 1, perPage: 25 });
    customers = result.customers;
    meta = { page: result.page, perPage: result.perPage, totalItems: result.totalItems, totalPages: result.totalPages };
  } catch {
    customers = [];
  }

  return <DashboardShell user={context.user}><CustomerManagement initialCustomers={customers} initialMeta={meta} canDelete={context.user.role === 'admin' || context.user.role === 'manager'} /></DashboardShell>;
}
