import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import BankAccountsListClient from '@/src/components/inventory/BankAccountsListClient';

export const dynamic = 'force-dynamic';

export default async function InitialBankAccountsListPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    redirect('/dashboard');
  }

  let initialAccounts: any[] = [];
  try {
    const currenciesList = await context.pb.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, any>(currenciesList.map((c: any) => [c.id, c]));

    const accounts = await context.pb.collection('bank_accounts').getFullList().catch(() => []);

    const txs = await context.pb.collection('bank_transactions').getFullList({
      filter: 'is_opening_balance = true || transaction_type = "opening_balance"',
    }).catch(() => []);

    const txMap = new Map<string, any>();
    for (const tx of txs) {
      if (tx.bank_account) txMap.set(String(tx.bank_account), tx);
    }

    const todayJalali = dateToJalaliString(new Date());

    initialAccounts = accounts.map((acc: any) => {
      const currency = acc.expand?.currency || (acc.currency ? currencyMap.get(acc.currency) : null);
      const currencyId = String(acc.currency || currency?.id || '');
      const currencyName = String(currency?.name || acc.currency || 'ریال');
      const currencyCode = String(currency?.code || acc.currency || 'IRR');
      const currencySymbol = String(currency?.symbol || currencyCode);

      const tx = txMap.get(acc.id);
      const openingDate = String(tx?.date || (acc.created ? dateToJalaliString(new Date(acc.created)) : todayJalali));

      return {
        id: acc.id,
        bankName: String(acc.bankName || ''),
        branchName: String(acc.branchName || ''),
        accountNumber: String(acc.accountNumber || ''),
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: Math.abs(Number(tx?.amount ?? acc.opening_balance ?? 0)),
        balance: Number(acc.currentBalance ?? acc.balance ?? 0),
        openingBalanceDate: openingDate,
      };
    });
  } catch {
    initialAccounts = [];
  }

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <BankAccountsListClient initialAccounts={initialAccounts} />
      </main>
    </DashboardShell>
  );
}
