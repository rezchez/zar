import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import CashFundsListClient from '@/src/components/inventory/CashFundsListClient';

export const dynamic = 'force-dynamic';

export default async function InitialCashFundsListPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    redirect('/dashboard');
  }

  let initialFunds: any[] = [];
  try {
    const funds = await context.pb.collection('cash_funds').getFullList({
      sort: '-created',
      expand: 'currency',
    }).catch(() => []);

    const txs = await context.pb.collection('cash_transactions').getFullList({
      filter: 'is_opening_balance = true || transaction_type = "opening_balance"',
    }).catch(() => []);

    const txMap = new Map<string, any>();
    for (const tx of txs) {
      if (tx.vault) txMap.set(String(tx.vault), tx);
    }

    const todayJalali = dateToJalaliString(new Date());

    initialFunds = funds.map((f: any) => {
      const currency = f.expand?.currency;
      const currencyId = String(f.currency || currency?.id || '');
      const currencyName = String(currency?.name || f.currency_name || 'ارز نامشخص');
      const currencyCode = String(currency?.code || '');
      const currencySymbol = String(currency?.symbol || '');
      const fundName = String(f.name || `صندوق ${currencyName}`).trim();

      const tx = txMap.get(f.id);
      const openingDate = String(tx?.date || (f.created ? dateToJalaliString(new Date(f.created)) : todayJalali));

      return {
        id: f.id,
        name: fundName,
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: Number(f.opening_balance ?? tx?.amount ?? 0),
        balance: Number(f.balance ?? 0),
        openingBalanceDate: openingDate,
      };
    });
  } catch {
    initialFunds = [];
  }

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <CashFundsListClient initialFunds={initialFunds} />
      </main>
    </DashboardShell>
  );
}
