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
    const currencyMap = new Map<string, any>();
    for (const c of currenciesList) {
      if (c.id) currencyMap.set(String(c.id).toLowerCase(), c);
      if (c.code) currencyMap.set(String(c.code).toUpperCase(), c);
      if (c.name) currencyMap.set(String(c.name).trim(), c);
    }

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
      const tx = txMap.get(acc.id);
      const rawCurr = String(acc.currency || '').trim();
      let currency = acc.expand?.currency
        || (rawCurr ? currencyMap.get(rawCurr.toLowerCase()) || currencyMap.get(rawCurr.toUpperCase()) || currencyMap.get(rawCurr) : null);

      if (!currency && tx) {
        const txRef = String(tx.currency_ref || '').trim();
        const txCode = String(tx.currency || '').trim();
        currency = (txRef ? currencyMap.get(txRef.toLowerCase()) : null)
          || (txCode ? currencyMap.get(txCode.toUpperCase()) || currencyMap.get(txCode) : null);
      }

      if (!currency) {
        currency = currencyMap.get('IRR') || currencyMap.get('IRT') || null;
      }

      const currencyId = String(currency?.id || acc.currency || '');
      const currencyCode = String(currency?.code || acc.currency || 'IRR').toUpperCase();
      const currencyName = String(currency?.name || (currencyCode === 'IRT' ? 'تومان' : 'ریال ایران'));
      const currencySymbol = String(currency?.symbol || (currencyCode === 'IRT' ? 'تومان' : 'ریال'));

      const openingDate = String(tx?.date || (acc.created ? dateToJalaliString(new Date(acc.created)) : todayJalali));

      return {
        id: acc.id,
        bankName: String(acc.bankName || ''),
        branchName: String(acc.branchName || ''),
        accountNumber: String(acc.accountNumber || ''),
        accountType: String(acc.accountType || 'current'),
        shebaNumber: String(acc.shebaNumber || ''),
        hasCheckbook: Boolean(acc.hasCheckbook),
        hasVirtualCheck: Boolean(acc.hasVirtualCheck),
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: Math.abs(Number(tx?.amount ?? acc.opening_balance ?? 0)),
        balance: Number(acc.currentBalance ?? acc.balance ?? 0),
        openingBalanceDate: openingDate,
        description: String(tx?.description || ''),
        isBlocked: acc.isBlocked === true,
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
