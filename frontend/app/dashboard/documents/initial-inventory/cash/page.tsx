import { redirect } from 'next/navigation';
import { Banknote, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function InitialCashFundsListPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');
  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    redirect('/dashboard');
  }

  const funds = await context.pb.collection('cash_funds').getFullList({
    sort: 'currency_name',
    expand: 'currency',
  }).catch(() => []);

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center gap-3">
            <Link href="/dashboard/documents/initial-inventory" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="بازگشت">
              <ChevronRight size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">فهرست صندوق‌های وجه نقد</h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">صندوق‌ها بر اساس ارز تعریف‌شده در کالکشن ارزها</p>
            </div>
          </div>

          {funds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900">
              هنوز صندوقی ثبت نشده است.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {funds.map((fund: any) => {
                const currency = fund.expand?.currency;
                const name = String(currency?.name || fund.currency_name || 'ارز نامشخص');
                const code = String(currency?.code || '');
                const symbol = String(currency?.symbol || '');
                return (
                  <article key={fund.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Banknote size={20} />
                      </div>
                      <div>
                        <h2 className="text-sm font-black">{name}</h2>
                        <p className="text-[11px] text-slate-500">{[symbol, code].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                    <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <p className="text-[11px] font-semibold text-slate-500">موجودی</p>
                      <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                        {Number(fund.balance ?? 0).toLocaleString('fa-IR')}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </DashboardShell>
  );
}
