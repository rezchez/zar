'use client';

import { ArrowLeft, CreditCard } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

export default function InitialReceivedChecksCard({
  listHref = '/dashboard/documents/initial-inventory/checks-received',
}: {
  listHref?: string;
}) {
  return (
    <article
      dir="rtl"
      className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative z-10 space-y-4">
        {/* Top Header: Icon & Badge */}
        <div className="flex items-center justify-between">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 transition-transform group-hover:scale-105 dark:bg-emerald-500/25 dark:text-emerald-400">
            <CreditCard size={24} className="stroke-[2.2]" />
          </div>

          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            اسناد دریافتنی (۱۱۲۰)
          </span>
        </div>

        {/* Title & Description */}
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            موجودی اولیه چک‌های دریافتی
          </h2>
          <p className="mt-1.5 h-10 text-xs leading-5 font-medium text-slate-500 line-clamp-2 dark:text-slate-400">
            ثبت و مدیریت چک‌های دریافتنی از مشتریان قبل از دوره که هنوز در بانک وصول یا واگذار نشده‌اند
          </p>
        </div>
      </div>

      {/* Footer Action Link */}
      <div className="relative z-10 mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Link
          href={listHref}
          className="inline-flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-emerald-500 hover:text-slate-950 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-emerald-400 dark:hover:text-slate-950"
        >
          <span>ورود به مدیریت چک‌های دریافتی اول دوره</span>
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
