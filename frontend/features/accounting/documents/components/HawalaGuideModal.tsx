'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  Info,
  Scale,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

interface HawalaGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HawalaGuideModal({ isOpen, onClose }: HawalaGuideModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 text-sm font-extrabold text-amber-600 dark:text-amber-400">
              <div className="size-8 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <BookOpen size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  راهنما و آموزش «حواله به طرف‌حساب دیگر»
                </h3>
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  نحوه عملکرد و اثرگذاری حسابداری حواله طرف‌به‌طرف
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition"
              aria-label="بستن"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="max-h-[68vh] overflow-y-auto space-y-3.5 pr-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            {/* Concept Card */}
            <div className="rounded-xl border border-amber-500/25 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-slate-800 dark:text-slate-200 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold text-xs">
                <Info size={15} />
                <span>مفهوم حواله طرف‌به‌طرف چیست؟</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                حواله زمانی کاربرد دارد که دادوستد، انتقال فلز (طلا/نقره/پلاتین)، سکه، کارساخته، وجه نقد یا طلب/بدهی بین <strong>دو طرف‌حساب</strong> (مشتری مبدأ و مشتری مقصد) از طریق دفتر شما انجام می‌گیرد، بدون آن‌که موجودی فیزیکی صندوق یا تراز کل دفتر شما تغییر کند.
              </p>
            </div>

            {/* Workflow Steps */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 text-xs">
                <Users size={15} className="text-amber-600 dark:text-amber-400" />
                <span>مراحل ثبت حواله در سیستم:</span>
              </div>
              <ol className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 list-decimal list-inside pr-1">
                <li>
                  <strong>فعال‌کردن گزینه «حواله به طرف‌حساب دیگر»:</strong> هنگام ثبت ردیف در هر یک از تب‌ها (ورود فلزات، خرید/فروش طلا، سکه، کارساخته، نقد یا طلب/بدهی).
                </li>
                <li>
                  <strong>ثبت ردیف اولیه:</strong> با زدن دکمه «ثبت ردیف و انتخاب طرف‌حساب حواله» (یا کلید Enter)، ردیف اعتبارسنجی شده و پنجره انتخاب مقصد باز می‌شود.
                </li>
                <li>
                  <strong>انتخاب طرف‌حساب مقصد و تأیید:</strong> طرف‌حساب مقصد را جستجو و انتخاب کنید. پیش‌نمایش تغییر مانده‌های وزنی و مالی مقصد نمایش داده می‌شود.
                </li>
                <li>
                  <strong>ثبت نهایی سند:</strong> با کلیک روی ثبت سند، عملیات به صورت اتمیک و خودکار برای هر دو حساب اعمال خواهد شد.
                </li>
              </ol>
            </div>

            {/* Accounting Impact */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 text-xs">
                <Scale size={15} className="text-amber-600 dark:text-amber-400" />
                <span>نحوه اثرگذاری در حساب‌ها و تراز:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5">
                  <strong className="text-emerald-700 dark:text-emerald-300 block mb-1">
                    طرف‌حساب مبدأ (سند جاری):
                  </strong>
                  <span className="text-slate-600 dark:text-slate-300">
                    ردیف طبق ماهیت انتخاب‌شده در سند ثبت شده و در شرح ردیف به صورت خودکار عبارت <strong>(حواله به [نام و کد مقصد])</strong> درج می‌گردد.
                  </span>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-950/20 p-2.5">
                  <strong className="text-rose-700 dark:text-rose-300 block mb-1">
                    طرف‌حساب مقصد (سند متقابل):
                  </strong>
                  <span className="text-slate-600 dark:text-slate-300">
                    یک ردیف <strong>متقارن و معکوس</strong> (دریافت در برابر پرداخت) ثبت می‌شود و در شرح آن عبارت <strong>(حواله از [نام و کد مبدأ])</strong> درج می‌گردد.
                  </span>
                </div>
              </div>
            </div>

            {/* Invariant & Neutrality guarantee */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-2.5 flex items-start gap-2.5">
              <ShieldCheck size={18} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                <strong className="text-slate-800 dark:text-slate-200 block">
                  عدم ایجاد کسری یا ناترازی در تراز کل دفتر:
                </strong>
                از آنجا که ورود در یک حساب دقیقاً معادل خروج در حساب دیگر است، اثر کلی این عملیات بر دارایی فیزیکی صندوق یا انبار طلای شما صفر (خنثی) است و مانده معین هر دو طرف شفاف و مستند می‌ماند.
              </div>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              <CheckCircle2 size={15} />
              <span>متوجه شدم</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
