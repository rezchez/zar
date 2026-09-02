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

    const accounts = await context.pb.collection('bank_accounts').getFullList({
      sort: 'bankName,accountNumber',
      expand: 'bank,accountId',
    }).catch(() => []);

    const txs = await context.pb.collection('bank_transactions').getFullList({
      filter: 'is_opening_balance = true || transaction_type = "opening_balance"',
    }).catch(() => []);

    const txMap = new Map<string, any>();
    for (const tx of txs) {
      if (tx.bank_account) txMap.set(String(tx.bank_account), tx);
    }

    const todayJalali = dateToJalaliString(new Date());

    initialAccounts = accounts.map((acc: any) => {
      const currencyCode = String(acc.currency || 'IRR').toUpperCase();
      const currencyObj = Array.from(currencyMap.values()).find(
        (c: any) => String(c.code).toUpperCase() === currencyCode || String(c.id) === String(acc.currency),
      );
      const currencyId = String(currencyObj?.id || '');
      const currencyName = String(currencyObj?.name || (currencyCode === 'IRT' ? 'تومان' : currencyCode === 'IRR' ? 'ریال' : currencyCode));
      const currencySymbol = String(currencyObj?.symbol || (currencyCode === 'IRT' ? 'تومان' : currencyCode === 'IRR' ? 'ریال' : currencyCode));

      const tx = txMap.get(acc.id);
      const openingDate = String(tx?.date || (acc.created ? dateToJalaliString(new Date(acc.created)) : todayJalali));
      const description = String(tx?.description || '');

      return {
        id: acc.id,
        bankName: String(acc.bankName || ''),
        branchName: String(acc.branchName || ''),
        accountNumber: String(acc.accountNumber || ''),
        accountCodeZero: String(acc.accountCodeZero || '0'),
        currency: currencyCode,
        currencyId,
        currencyName,
        currencySymbol,
        openingBalance: Math.abs(Number(acc.opening_balance ?? tx?.amount ?? 0)),
        balance: Number(acc.currentBalance ?? acc.balance ?? 0),
        openingBalanceDate: openingDate,
        description,
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
