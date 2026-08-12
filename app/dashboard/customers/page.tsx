import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { mapCustomer, type Customer } from '@/lib/customer';
import CustomerManagement from '@/src/components/CustomerManagement';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let customers: Customer[] = [];
  try {
    const records = await context.pb.collection('customers').getFullList({ sort: '-customerCode' });
    customers = records.map((record) => mapCustomer(context.pb, record));
  } catch {
    customers = [];
  }

  return <DashboardShell user={context.user}><CustomerManagement initialCustomers={customers} canDelete={context.user.role === 'admin' || context.user.role === 'manager'} /></DashboardShell>;
}
