import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomersWithBalances } from '@/lib/customer-service';
import { getNextDocumentNumber } from '@/lib/document-service';
import DashboardShell from '@/src/components/DashboardShell';
import DocumentForm from '@/src/components/DocumentForm';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  // Keep requests on the authenticated PocketBase client ordered. This
  // avoids SDK request autocancellation and gives the page a clear failure
  // boundary when the database is temporarily unavailable.
  const customers = await getCustomersWithBalances(context.pb);
  const nextDocumentNumber = await getNextDocumentNumber(context.pb);

  return (
    <DashboardShell user={context.user}>
      <DocumentForm
        customers={customers}
        nextDocumentNumber={nextDocumentNumber}
      />
    </DashboardShell>
  );
}
