import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomersWithBalances } from '@/lib/customer-service';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import DocumentForm from '@/src/components/DocumentForm';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  const customers = await getCustomersWithBalances(context.pb);

  return (
    <DashboardShell user={context.user}>
      <DocumentForm
        customers={customers}
        nextDocumentNumber={1}
      />
    </DashboardShell>
  );
}
