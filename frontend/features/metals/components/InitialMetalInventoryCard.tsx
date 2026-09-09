'use client';

import { ArrowLeft, Flame } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

export type InitialMetalInventoryCardProps = {
  listHref?: string;
  className?: string;
};

export default function InitialMetalInventoryCard({
  listHref = '/dashboard/documents/initial-inventory/metals',
  className = '',
}: InitialMetalInventoryCardProps) {
  return (
    <article
      dir="rtl"
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="relative z-10 space-y-4">
        {/* Top Header: Icon & Badge */}
        <div className="flex items-center justify-between">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 transition-transform group-hover:scale-105 dark:bg-amber-500/25 dark:text-amber-400">
            <Flame size={24} className="stroke-[2.2]" />
          </div>

          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-extrabold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            طلا، نقره و پلاتین
          </span>
        </div>

        {/* Title & Description */}
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            موجودی اول دوره فلزات و آبشده
          </h2>
          <p className="mt-1.5 h-10 text-xs leading-5 font-medium text-slate-500 line-clamp-2 dark:text-slate-400">
            تعریف و ثبت آبشده شرطی، آبشده متفرقه و موجودی اولیه انواع فلزات (طلا، نقره، پلاتین)
          </p>
        </div>
      </div>

      {/* Footer Action Link */}
      <div className="relative z-10 mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Link
          href={listHref}
          className="inline-flex w-full items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-amber-400 dark:hover:text-slate-950"
        >
          <span>ورود به مدیریت موجودی اول دوره فلزات</span>
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        </Link>
      </div>
    </article>
  );
}
