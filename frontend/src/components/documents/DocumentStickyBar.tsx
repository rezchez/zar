'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  Calendar,
  Coins,
  FileText,
  Lock,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import type { DocumentStickyHeaderData } from '@/src/context/DocumentStickyHeaderContext';
import { toPersianDigits } from '@/lib/jalali';
import type { MetalType } from '@/features/accounting/documents/services/metal-settlement-service';

interface DocumentStickyBarProps {
  data: DocumentStickyHeaderData;
  onOpenMobileMenu?: () => void;
}

const METAL_LABELS: Record<MetalType, { label: string; badgeClass: string }> = {
  gold: {
    label: 'طلا ۷۵۰',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
  },
  silver: {
    label: 'نقره ۹۹۹',
    badgeClass: 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-300/80',
  },
  platinum: {
    label: 'پلاتین',
    badgeClass: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30 hover:bg-sky-500/25',
  },
};

export default function DocumentStickyBar({ data }: DocumentStickyBarProps) {
  const {
    customer,
    documentNumber,
    nature,
    metalType,
    currency,
    dateJalali,
    isCustomerLocked,
    passedSections = {
      customer: true,
      documentNumber: true,
      nature: true,
      metalType: true,
      currency: true,
      date: true,
    },
    onToggleNature,
    onChangeMetalType,
    onScrollToTop,
    onScrollToCustomer,
  } = data;

  const metalInfo = METAL_LABELS[metalType] || METAL_LABELS.gold;

  const cycleMetal = () => {
    if (!onChangeMetalType) return;
    const metals: MetalType[] = ['gold', 'silver', 'platinum'];
    const nextIndex = (metals.indexOf(metalType) + 1) % metals.length;
    onChangeMetalType(metals[nextIndex]);
  };

  const isReceived = nature === 'received';

  return (
    <div className="flex items-center justify-between gap-2 sm:gap-3 w-full min-w-0 py-1" dir="rtl">
      {/* سمت راست: بخش‌های فرم که اسکرول شده‌اند به صورت دانه‌ای و تدریجی با انیمیشن اضافه می‌شوند */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 overflow-x-auto no-scrollbar py-0.5">
        <AnimatePresence>
          {/* ۱. طرف‌حساب */}
          {passedSections.customer && (
            <motion.div
              key="sticky-customer"
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 flex items-center"
            >
              <button
                type="button"
                onClick={onScrollToCustomer}
                className={`group flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none shadow-sm ${
                  customer
                    ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-slate-800 dark:text-slate-100'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 animate-pulse'
                }`}
                title={customer ? `طرف‌حساب: ${customer.name} (کلیک جهت اسکرول و ویرایش)` : 'انتخاب طرف‌حساب (الزامی)'}
              >
                <div className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {customer ? <User size={12} /> : <Users size={12} />}
                </div>
                <span className="truncate max-w-[120px] sm:max-w-[170px] text-xs font-black">
                  {customer ? customer.name : 'انتخاب طرف‌حساب'}
                </span>
                {customer?.customerCode != null && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 px-1 rounded">
                    {toPersianDigits(customer.customerCode)}
                  </span>
                )}
                {isCustomerLocked && (
                  <span title="طرف‌حساب قفل است" className="inline-flex">
                    <Lock size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  </span>
                )}
              </button>
            </motion.div>
          )}

          {/* ۲. شناسه / شماره فاکتور */}
          {passedSections.documentNumber && (
            <motion.div
              key="sticky-doc-number"
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 flex items-center"
            >
              <div
                className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 select-none"
                title={`شماره فاکتور / شناسه سند: ${documentNumber || '۱'}`}
              >
                <FileText size={12} className="text-slate-400 shrink-0" />
                <span className="text-[10px] text-slate-400 hidden md:inline">فاکتور:</span>
                <span className="font-mono font-black text-amber-700 dark:text-amber-400">
                  {toPersianDigits(documentNumber || '۱')}
                </span>
              </div>
            </motion.div>
          )}

          {/* ۳. نوع سند (ماهیت: دریافتی / پرداختی) */}
          {passedSections.nature && (
            <motion.div
              key="sticky-nature"
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 flex items-center"
            >
              <button
                type="button"
                onClick={onToggleNature}
                className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-xl border text-xs font-black transition-all cursor-pointer select-none shadow-sm ${
                  isReceived
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/25'
                    : 'bg-rose-500/15 border-rose-500/30 text-rose-800 dark:text-rose-300 hover:bg-rose-500/25'
                }`}
                title="ماهیت سند (کلیک جهت تغییر به دریافتی / پرداختی)"
              >
                {isReceived ? (
                  <ArrowDownLeft size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <ArrowUpRight size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{isReceived ? 'دریافتی (ورود)' : 'پرداختی (خروج)'}</span>
              </button>
            </motion.div>
          )}

          {/* ۴. جنس فلز */}
          {passedSections.metalType && (
            <motion.div
              key="sticky-metal-type"
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 flex items-center"
            >
              <button
                type="button"
                onClick={cycleMetal}
                className={`flex items-center gap-1 shrink-0 px-2 py-1 rounded-xl border text-xs font-black transition-all cursor-pointer select-none ${metalInfo.badgeClass}`}
                title="جنس فلز مبنا (کلیک جهت تغییر به طلا / نقره / پلاتین)"
              >
                <Sparkles size={12} className="shrink-0" />
                <span>{metalInfo.label}</span>
              </button>
            </motion.div>
          )}

          {/* ۵. نوع ارز */}
          {passedSections.currency && (
            <motion.div
              key="sticky-currency"
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 flex items-center"
            >
              <div
                className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 text-xs font-bold text-slate-700 dark:text-slate-200 select-none"
                title={`واحد پول / ارز: ${currency}`}
              >
                <Coins size={12} className="text-amber-500 shrink-0" />
                <span className="font-bold text-[11px]">
                  {currency === 'IRT' ? 'تومان' : currency === 'IRR' ? 'ریال' : currency}
                </span>
              </div>
            </motion.div>
          )}

          {/* ۶. تاریخ سند */}
          {passedSections.date && (
            <motion.div
              key="sticky-date"
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 flex items-center"
            >
              <div
                className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 text-xs font-bold text-slate-600 dark:text-slate-300 select-none"
                title={`تاریخ سند: ${dateJalali}`}
              >
                <Calendar size={12} className="text-slate-400 shrink-0" />
                <span className="font-mono text-[11px]">{toPersianDigits(dateJalali)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* سمت چپ: دکمه پرش به بالای فرم (سربرگ اصلی) */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onScrollToTop}
          className="group flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 text-xs font-black hover:opacity-90 transition-all cursor-pointer shadow-sm"
          title="بازگشت به ابتدای فرم و مشاهده کامل سربرگ"
        >
          <ArrowUp size={13} className="shrink-0 transition-transform group-hover:-translate-y-0.5" />
          <span className="hidden sm:inline">سربرگ</span>
        </button>
      </div>
    </div>
  );
}
