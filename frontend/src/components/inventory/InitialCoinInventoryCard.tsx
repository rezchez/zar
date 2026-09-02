'use client';

import { Coins, Lock } from 'lucide-react';
import React from 'react';

export default function InitialCoinInventoryCard() {
  return (
    <article
      dir="rtl"
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="relative z-10 space-y-4">
        {/* Top Header: Icon & Badge */}
        <div className="flex items-center justify-between">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
            <Coins size={24} className="stroke-[2.2]" />
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Lock size={12} />
            به‌زودی / در حال توسعه
          </span>
        </div>

        {/* Title & Description */}
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white">
            موجودی اولیه مسکوکات و شمش
          </h2>
          <p className="mt-1 text-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400">
            تعریف و ثبت موجودی پایه انواع سکه‌های بهار آزادی، پارسیان، شمش طلا و نقره
          </p>
        </div>
      </div>

      {/* Footer Action Link (Disabled / Placeholder) */}
      <div className="relative z-10 mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          disabled
          className="inline-flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-black text-slate-400 cursor-not-allowed dark:bg-slate-800/50 dark:text-slate-500"
        >
          <span>در حال آماده‌سازی زیرساخت</span>
          <Lock size={15} />
        </button>
      </div>
    </article>
  );
}
