'use client';

import {
  Banknote,
  Boxes,
  Calculator,
  FileClock,
  FileSearch,
  Landmark,
  Scale,
  WalletCards,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import GooeyButton from '@/components/ui/gooey-button';

type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: typeof FileSearch;
  colorClass: string;
};

const reports: ReportDefinition[] = [
  {
    id: 'documents',
    title: 'گزارش ریز اسناد',
    description: 'مشاهده و جست‌وجوی جزئیات تمام اسناد ثبت‌شده',
    href: '/dashboard/reports/documents',
    icon: FileSearch,
    colorClass: 'bg-cyan-600',
  },
  {
    id: 'ledger',
    title: 'صورت‌حساب اشخاص',
    description: 'گردش حساب و مانده طرف‌حساب‌ها',
    href: '/dashboard/customers',
    icon: Calculator,
    colorClass: 'bg-violet-600',
  },
  {
    id: 'inventory',
    title: 'موجودی کالا و طلا',
    description: 'موجودی طلای آب‌شده، متفرقه و کالاها',
    href: '/dashboard/reports/inventory',
    icon: Boxes,
    colorClass: 'bg-amber-500',
  },
  {
    id: 'cash-bank',
    title: 'گزارش صندوق و بانک',
    description: 'دریافت‌ها، پرداخت‌ها و مانده نقدی',
    href: '/dashboard/reports/cash-bank',
    icon: Landmark,
    colorClass: 'bg-blue-600',
  },
  {
    id: 'balance-sheet',
    title: 'ترازنامه مالی',
    description: 'تصویر کلی دارایی‌ها و بدهی‌های مجموعه',
    href: '/dashboard/reports/balance-sheet',
    icon: Scale,
    colorClass: 'bg-emerald-600',
  },
  {
    id: 'profit-loss',
    title: 'گزارش سود و زیان',
    description: 'تحلیل درآمد، هزینه و سود دوره مالی',
    href: '/dashboard/reports/profit-loss',
    icon: Banknote,
    colorClass: 'bg-rose-600',
  },
  {
    id: 'temporary',
    title: 'اسناد موقت',
    description: 'بررسی اسنادی که هنوز نهایی نشده‌اند',
    href: '/dashboard/reports/temporary',
    icon: FileClock,
    colorClass: 'bg-orange-600',
  },
  {
    id: 'checks',
    title: 'چک‌های پرداختی و دریافتی',
    description: 'پیگیری وضعیت چک‌های صادره و دریافتی',
    href: '/dashboard/reports/checks',
    icon: WalletCards,
    colorClass: 'bg-teal-600',
  },
];

export default function ReportsDashboard() {
  const router = useRouter();

  return (
    <main
      dir="rtl"
      className="min-h-full bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-10"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 flex flex-col gap-3">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            داشبورد مدیریتی زر
          </p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            سیستم گزارشات حسابداری
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-500 dark:text-slate-400">
            گزارش موردنظر را انتخاب کنید تا اطلاعات مالی، اسناد و موجودی طلا را با جزئیات بررسی کنید.
          </p>
        </header>

        <section
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="گزارش‌های حسابداری"
        >
          {reports.map((report) => {
            const Icon = report.icon;

            return (
              <article
                key={report.id}
                className="group rounded-3xl border border-slate-200/80 bg-white/80 p-3 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/80"
              >
                <GooeyButton
                  colorClass={report.colorClass}
                  onClick={() => router.push(report.href)}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={23} strokeWidth={2.2} />
                    <span>{report.title}</span>
                  </span>
                </GooeyButton>
                <p className="px-2 pb-2 pt-4 text-center text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {report.description}
                </p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
