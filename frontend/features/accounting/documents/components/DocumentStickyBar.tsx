'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUp,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Coins,
  FileText,
  Lock,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import type { DocumentStickyHeaderData } from '@/src/context/DocumentStickyHeaderContext';
import { toPersianDigits } from '@/lib/jalali';
import DatePicker from '@/components/ui/date-picker';
import { checkDocumentDateDiff, formatJalaliDate } from '../utils/document-helpers';
import type { MetalType } from '../services/metal-settlement-service';

export interface DocumentStickyBarProps {
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
    currencies,
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
    onCurrencyChange,
    onDateChange,
    onScrollToTop,
    onScrollToCustomer,
  } = data;

  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [tempDate, setTempDate] = useState(dateJalali);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const metalInfo = METAL_LABELS[metalType] || METAL_LABELS.gold;

  const cycleMetal = () => {
    if (!onChangeMetalType) return;
    const metals: MetalType[] = ['gold', 'silver', 'platinum'];
    const nextIndex = (metals.indexOf(metalType) + 1) % metals.length;
    onChangeMetalType(metals[nextIndex]);
  };

  const isReceived = nature === 'received';

  const currencyList =
    currencies && currencies.length > 0
      ? currencies
      : [
          { code: 'IRT', name: 'تومان' },
          { code: 'IRR', name: 'ریال' },
          { code: 'USD', name: 'دلار' },
          { code: 'EUR', name: 'یورو' },
          { code: 'AED', name: 'درهم' },
        ];

  const dateDiff = checkDocumentDateDiff(dateJalali);

  const openDateModal = () => {
    setTempDate(dateJalali);
    setIsDateModalOpen(true);
  };

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

          {/* ۵. نوع ارز (با قابلیت تغییر مستقیم ارزها) */}
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
                className="relative flex items-center gap-1 shrink-0 px-2 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700/80 hover:border-amber-500/50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-xs"
                title="تغییر نوع ارز مبنا"
              >
                <Coins size={12} className="text-amber-500 shrink-0 pointer-events-none" />
                <select
                  value={currency}
                  onChange={(e) => onCurrencyChange?.(e.target.value)}
                  className="bg-transparent font-bold text-[11px] text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none pr-0.5 appearance-none select-none pl-3.5"
                  title="تغییر نوع ارز مبنا"
                  aria-label="تغییر نوع ارز"
                >
                  {currencyList.map((curr) => (
                    <option
                      key={curr.code}
                      value={curr.code}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      {curr.name ? `${curr.name} (${curr.code})` : curr.code}
                    </option>
                  ))}
                </select>
                <ChevronDown size={10} className="text-slate-400 absolute left-1.5 pointer-events-none" />
              </div>
            </motion.div>
          )}

          {/* ۶. تاریخ سند (با قابلیت کلیک و تغییر تاریخ) */}
          {passedSections.date && (
            <motion.div
              key="sticky-date"
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.85, filter: 'blur(3px)' }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="shrink-0 flex items-center"
            >
              <button
                type="button"
                onClick={openDateModal}
                className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200/90 dark:border-slate-700/80 hover:border-amber-500/50 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all cursor-pointer select-none group shadow-xs"
                title="تغییر تاریخ سند (کلیک کنید)"
              >
                <Calendar size={12} className="text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="font-mono text-[11px] font-black">{toPersianDigits(dateJalali)}</span>
                {dateDiff && (dateDiff.isPast || dateDiff.isFuture) && (
                  <span
                    className={`text-[9px] font-bold px-1 rounded ${
                      dateDiff.isPast
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300'
                    }`}
                  >
                    {dateDiff.isPast ? 'گذشته' : 'آینده'}
                  </span>
                )}
                <ChevronDown size={10} className="text-slate-400 shrink-0 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* سمت چپ: دکمه پرش به بالای فرم */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onScrollToTop}
          className="group flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 text-xs font-black hover:opacity-90 transition-all cursor-pointer shadow-sm"
          title="بازگشت به ابتدای فرم (برو به بالا)"
        >
          <ArrowUp size={13} className="shrink-0 transition-transform group-hover:-translate-y-0.5" />
          <span className="hidden sm:inline">برو به بالا</span>
        </button>
      </div>

      {/* مودال تغییر تاریخ سند متصل به document.body */}
      {mounted && isDateModalOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setIsDateModalOpen(false)}
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 8 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Calendar size={18} />
                    تغییر تاریخ سند
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDateModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer transition-colors"
                    title="بستن"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* پیش‌نمایش تاریخ انتخاب شده */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-0.5">
                      تاریخ سند:
                    </span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-sm">
                      {toPersianDigits(tempDate)}
                    </span>
                  </div>
                  {(() => {
                    const tempDiff = checkDocumentDateDiff(tempDate);
                    if (tempDiff.isPast) {
                      return (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                          تاریخ گذشته
                        </span>
                      );
                    }
                    if (tempDiff.isFuture) {
                      return (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                          تاریخ آینده
                        </span>
                      );
                    }
                    return (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        امروز
                      </span>
                    );
                  })()}
                </div>

                {/* تقویم شمسی */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    تقویم انتخاب تاریخ:
                  </label>
                  <DatePicker
                    value={tempDate}
                    onValueChange={(_iso, jalali) => {
                      if (jalali) setTempDate(jalali);
                    }}
                    calendarType="shamsi"
                    format="yyyy/MM/dd"
                    placeholder="انتخاب تاریخ سند"
                    className="w-full"
                  />
                </div>

                {/* دکمه‌های سریع: امروز و دیروز */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const today = formatJalaliDate();
                      setTempDate(today);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-center"
                  >
                    تنظیم به امروز
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const yesterday = new Date();
                      yesterday.setDate(yesterday.getDate() - 1);
                      const yJalali = formatJalaliDate(yesterday);
                      setTempDate(yJalali);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer text-center"
                  >
                    تنظیم به دیروز
                  </button>
                </div>

                {/* دکمه‌های تأیید و انصراف */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsDateModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tempDate && onDateChange) {
                        onDateChange(tempDate);
                      }
                      setIsDateModalOpen(false);
                    }}
                    className="px-4 py-2 text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md transition-colors cursor-pointer"
                  >
                    تأیید و اعمال تاریخ
                  </button>
                </div>
              </motion.div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
