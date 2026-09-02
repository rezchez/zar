import { redirect } from 'next/navigation';
import { Layers } from 'lucide-react';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';
import InitialCashInventoryCard from '@/src/components/inventory/InitialCashInventoryCard';
import InitialBankInventoryCard from '@/src/components/inventory/InitialBankInventoryCard';

export const dynamic = 'force-dynamic';

export default async function InitialInventoryPage() {
  const context = await getServerAuthContext();
  if (!context) redirect('/');

  return (
    <DashboardShell user={context.user}>
      <main dir="rtl" className="min-h-full px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Layers size={20} />
              <span className="text-xs font-extrabold uppercase tracking-wider">مدیریت اسناد و موجودی</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              تعریف موجودی اول دوره
            </h1>
            <p className="max-w-2xl text-xs leading-6 text-slate-500 dark:text-slate-400">
              ثبت و مدیریت تراز پایه و موجودی اول دوره وجوه نقد، حساب‌های بانکی، طلا، ارز و مسکوکات
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <InitialCashInventoryCard listHref="/dashboard/documents/initial-inventory/cash" />
            <InitialBankInventoryCard listHref="/dashboard/documents/initial-inventory/bank" />
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
