import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import CustomerForm from '@/src/components/CustomerForm';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function NewCustomerPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  let nextCustomerCode = 1;
  let availableCodes: number[] = [];
  try {
    const records = await context.pb.collection('customers').getFullList({
      sort: 'customerCode',
      fields: 'customerCode',
      filter: 'is_deleted = false',
    });

    const existingCodes = new Set(records.map((r) => Number(r.customerCode)));
    const maxCode = records.length > 0 ? Math.max(...Array.from(existingCodes)) : 0;

    for (let i = 1; i < maxCode; i++) {
      if (!existingCodes.has(i)) {
        availableCodes.push(i);
      }
    }
    nextCustomerCode = maxCode + 1;
  } catch {
    nextCustomerCode = 1;
  }

  return (
    <DashboardShell user={context.user}>
      <CustomerForm nextCustomerCode={nextCustomerCode} availableCodes={availableCodes} />
    </DashboardShell>
  );
}
