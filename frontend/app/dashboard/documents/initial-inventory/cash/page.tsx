import { redirect } from 'next/navigation';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import CashFundsListClient from '@/src/components/inventory/CashFundsListClient';

export const dynamic = 'force-dynamic';

type PbRecord = Record<string, unknown>;

interface CashFundItem {
  id: string;
  name: string;
  currencyId: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  openingBalance: number;
  balance: number;
  openingBalanceDate: string;
}

export default async function InitialCashFundsListPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    redirect('/dashboard');
  }

  let initialFunds: CashFundItem[] = [];
  try {
    const currenciesList = await context.pb.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, PbRecord>(currenciesList.map((c: PbRecord) => [String(c.id), c]));

    const funds = await context.pb.collection('cash_funds').getFullList()
      .catch(() => []);

    const txs = await context.pb.collection('cash_transactions').getFullList({
      filter: 'is_opening_balance = true || transaction_type = "opening_balance" || source_key ~ "opening:cash:"',
    }).catch(async () => {
      return context.pb.collection('cash_transactions').getFullList({
        filter: 'is_opening_balance = true || transaction_type = "opening_balance"',
      }).catch(() => []);
    });

    const todayJalali = dateToJalaliString(new Date());

    initialFunds = funds.map((f: PbRecord) => {
      const expand = f.expand as Record<string, PbRecord> | undefined;
      const currency = expand?.currency || (f.currency ? currencyMap.get(String(f.currency)) : null);
      const currencyId = String(f.currency || currency?.id || '');
      const currencyName = String(currency?.name || f.currency_name || 'ارز نامشخص');
      const currencyCode = String(currency?.code || '');
      const currencySymbol = String(currency?.symbol || '');
      const fundName = String(f.name || `صندوق ${currencyName}`).trim();

      // Group transactions belonging to this fund
      const fundTxs = txs.filter((tx: PbRecord) => {
        const v = tx.vault ? String(tx.vault) : '';
        const sk = tx.source_key ? String(tx.source_key) : '';
        const cr = tx.currency_ref ? String(tx.currency_ref) : '';
        return (
          v === String(f.id) ||
          sk === `opening:cash:${String(f.id)}` ||
          (currencyId && (v === currencyId || sk === `opening:cash:${currencyId}` || cr === currencyId)) ||
          (f.currency && cr === String(f.currency))
        );
      });

      // Deterministic Canonical Record Selection:
      const canonicalTx = fundTxs.find((t: PbRecord) => t.source_key === `opening:cash:${String(f.id)}`)
        || fundTxs.find((t: PbRecord) => t.vault === String(f.id))
        || fundTxs[0]
        || null;

      const openingDate = String(canonicalTx?.date || todayJalali);

      return {
        id: String(f.id),
        name: fundName,
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        openingBalance: Math.abs(Number(f.opening_balance ?? canonicalTx?.amount ?? 0)),
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
