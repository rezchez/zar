import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomersWithBalances } from '@/lib/customer-service';
import { getCurrencies } from '@/lib/currencies';
import { getLatestMarketQuotes } from '@/lib/price-api';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import DocumentForm from '@/src/components/DocumentForm';

export const dynamic = 'force-dynamic';

export default async function NewDocumentPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  const [customers, currencies, quotes] = await Promise.all([
    getCustomersWithBalances(context.pb),
    getCurrencies(context.pb),
    getLatestMarketQuotes(context.pb),
  ]);

  return (
    <DashboardShell user={context.user}>
      <DocumentForm
        customers={customers}
        initialCurrencies={currencies}
        initialQuotes={quotes}
        nextDocumentNumber={1}
      />
    </DashboardShell>
  );
}
