import { notFound, redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { mapCustomer } from '@/lib/customer';
import CustomerForm from '@/src/components/CustomerForm';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let record;
  try {
    record = await context.pb.collection('customers').getOne((await params).id);
  } catch {
    notFound();
  }

  return (
    <DashboardShell user={context.user}>
      <CustomerForm customer={mapCustomer(context.pb, record)} />
    </DashboardShell>
  );
}
