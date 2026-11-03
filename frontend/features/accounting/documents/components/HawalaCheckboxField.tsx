'use client';

import React, { useState } from 'react';
import { ArrowLeftRight, Info } from 'lucide-react';
import HawalaGuideModal from './HawalaGuideModal';

export interface HawalaCheckboxFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  hintText?: string;
}

export default function HawalaCheckboxField({
  checked,
  onChange,
  className = '',
  hintText = 'پس از ثبت ردیف، پنجره انتخاب طرف‌حساب حواله باز می‌شود',
}: HawalaCheckboxFieldProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <>
      <div
        className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 ${className}`}
      >
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked)}
              className="size-4 rounded text-amber-500 focus:ring-amber-500 focus:ring-offset-0 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 transition cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <ArrowLeftRight
                size={16}
                className={checked ? 'text-amber-500' : 'text-slate-400'}
              />
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                حواله به طرف حساب دیگر
              </span>
            </div>
          </label>

          {/* Educational Guide Trigger */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsGuideOpen(true);
            }}
            className="flex items-center justify-center size-5 rounded-full bg-slate-200/80 hover:bg-amber-500/20 text-slate-500 hover:text-amber-600 dark:bg-slate-800 dark:hover:bg-amber-500/30 dark:text-slate-400 dark:hover:text-amber-400 transition cursor-pointer shadow-2xs"
            title="آموزش و نحوه اثرگذاری حواله طرف‌به‌طرف"
            aria-label="آموزش و نحوه اثرگذاری حواله طرف‌به‌طرف"
          >
            <Info size={12} strokeWidth={2.5} />
          </button>
        </div>

        {checked && hintText && (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/20">
            {hintText}
          </span>
        )}
      </div>

      <HawalaGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </>
  );
}
