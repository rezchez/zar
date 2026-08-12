import { notFound, redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomerWithBalances } from '@/lib/customer-service';
import type { CustomerTransaction } from '@/lib/transaction';
import CustomerForm from '@/src/components/CustomerForm';
import CustomerTransactionLedger from '@/src/components/CustomerTransactionLedger';
import DashboardShell from '@/src/components/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let record;
  let transactions: CustomerTransaction[] = [];
  let customer;
  try {
    record = await context.pb.collection('customers').getOne((await params).id);
    const hydrated = await getCustomerWithBalances(context.pb, record);
    customer = hydrated.customer;
    transactions = hydrated.transactions;
  } catch {
    notFound();
  }

  return (
    <DashboardShell user={context.user}>
      <CustomerForm customer={customer} />
      <CustomerTransactionLedger
        customerId={record.id}
        initialTransactions={transactions}
      />
    </DashboardShell>
  );
}
