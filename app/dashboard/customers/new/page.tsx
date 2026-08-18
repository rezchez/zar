import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import CustomerForm from '@/src/components/CustomerForm';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let nextCustomerCode = 1;
  try {
    const records = await context.pb.collection('customers').getList(1, 1, {
      sort: '-customerCode',
      fields: 'customerCode',
    });
    nextCustomerCode = Number(records.items[0]?.customerCode ?? 0) + 1;
  } catch {
    nextCustomerCode = 1;
  }

  return (
    <DashboardShell user={context.user}>
      <CustomerForm nextCustomerCode={nextCustomerCode} />
    </DashboardShell>
  );
}
