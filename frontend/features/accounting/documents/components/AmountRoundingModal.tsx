'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, X, RotateCcw, Check, ArrowDown, ArrowUp, Equal } from 'lucide-react';
import { roundAmountToDigits } from '@/src/lib/trade-utils';
import { formatMoney } from '@/lib/money';
import { formatAmountHelperWords } from '@/components/ui/price-input';

export interface AmountRoundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAmount: number;
  exactCalculatedAmount?: number;
  baseCurrency: 'IRR' | 'IRT';
  initialDigits?: number;
  initialMode?: 'round' | 'ceil' | 'floor';
  initialAutoApply?: boolean;
  onApply: (
    roundedAmount: number,
    digits: number,
    mode: 'round' | 'ceil' | 'floor',
    autoApply: boolean,
  ) => void;
  onReset?: () => void;
}

const PRESET_DIGITS = [
  { digits: 2, label: '۲ رقم (صدگان)' },
  { digits: 3, label: '۳ رقم (هزارگان)' },
  { digits: 4, label: '۴ رقم (ده‌هزارگان)' },
];

export default function AmountRoundingModal({
  isOpen,
  onClose,
  currentAmount,
  exactCalculatedAmount,
  baseCurrency,
  initialDigits = 3,
  initialMode = 'round',
  initialAutoApply = false,
  onApply,
  onReset,
}: AmountRoundingModalProps) {
  const [digits, setDigits] = useState<number>(Math.min(4, Math.max(1, initialDigits)));
  const [mode, setMode] = useState<'round' | 'ceil' | 'floor'>(initialMode);
  const [autoApply, setAutoApply] = useState<boolean>(initialAutoApply);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setDigits(Math.min(4, Math.max(1, initialDigits)));
      setMode(initialMode);
      setAutoApply(initialAutoApply);
    }
  }, [isOpen, initialDigits, initialMode, initialAutoApply]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background page from scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  // Base amount to perform rounding on
  const amountToRound = exactCalculatedAmount && exactCalculatedAmount > 0
    ? exactCalculatedAmount
    : currentAmount;

  const roundedAmount = roundAmountToDigits(amountToRound, digits, mode);
  const diff = roundedAmount - amountToRound;

  // Words representations (with inverted currency logic)
  const currentWords = formatAmountHelperWords(amountToRound, undefined, baseCurrency);
  const roundedWords = formatAmountHelperWords(roundedAmount, undefined, baseCurrency);

  const handleApply = () => {
    onApply(roundedAmount, digits, mode, autoApply);
    onClose();
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
      onWheel={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rounding-modal-title"
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-slate-800/80 dark:bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 id="rounding-modal-title" className="text-sm font-black text-slate-900 dark:text-white">
                تنظیمات رند کردن مبلغ کل (محاسباتی)
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                انتخاب تعداد ارقام و نحوه گرد کردن مبلغ برای تسویه آسان‌تر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="بستن پنجره"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Current Exact Amount Box */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">مبلغ دقیق محاسباتی:</span>
              <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                {formatMoney(amountToRound, baseCurrency)}
              </span>
            </div>
            {currentWords ? (
              <div className="mt-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <span>✦ {currentWords}</span>
              </div>
            ) : null}
          </div>

          {/* Number of Digits Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
              تعداد ارقام برای رند کردن (تعداد صفرها):
            </label>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 gap-2">
              {PRESET_DIGITS.map((p) => {
                const isSelected = digits === p.digits;
                return (
                  <button
                    key={p.digits}
                    type="button"
                    onClick={() => setDigits(p.digits)}
                    className={`rounded-xl px-2.5 py-2 text-center text-xs font-extrabold transition-all border ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-white shadow-xs dark:border-amber-500 dark:bg-amber-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-600'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Stepper */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                انتخاب دلخواه تعداد ارقام:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDigits((d) => Math.max(1, d - 1))}
                  disabled={digits <= 1}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  title="کاهش یک رقم"
                >
                  -
                </button>
                <span className="w-12 text-center font-mono text-sm font-black text-slate-900 dark:text-white">
                  {digits} رقم
                </span>
                <button
                  type="button"
                  onClick={() => setDigits((d) => Math.min(4, d + 1))}
                  disabled={digits >= 4}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  title="افزایش یک رقم"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Rounding Direction / Mode */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-800 dark:text-slate-200">
              روش رند کردن:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode('round')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition-all ${
                  mode === 'round'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-500/80 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <Equal className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-black">ریاضی (نزدیک‌ترین)</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Math.round</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('ceil')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition-all ${
                  mode === 'ceil'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-500/80 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <ArrowUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black">به بالا (سقف)</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Math.ceil</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('floor')}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-center transition-all ${
                  mode === 'floor'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-2xs dark:border-amber-500/80 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60'
                }`}
              >
                <ArrowDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-black">به پایین (کف)</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Math.floor</span>
              </button>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="rounded-2xl border-2 border-amber-400/80 bg-amber-50/50 p-4 dark:border-amber-600/70 dark:bg-amber-950/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-900 dark:text-amber-300">
                مبلغ نهایی پس از رند شدن:
              </span>
              <span className="font-mono text-base sm:text-lg font-black text-amber-950 dark:text-amber-100 tabular-nums">
                {formatMoney(roundedAmount, baseCurrency)}
              </span>
            </div>

            {roundedWords ? (
              <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                <span>✦ {roundedWords}</span>
              </div>
            ) : null}

            <div className="flex items-center justify-between border-t border-amber-300/60 pt-2 text-[11px] dark:border-amber-800/60">
              <span className="text-slate-600 dark:text-slate-400 font-bold">
                تعدیل / اختلاف ناشی از رند کردن:
              </span>
              <span
                className={`font-mono font-black ${
                  diff > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : diff < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {diff > 0 ? `+${formatMoney(diff, baseCurrency)}` : diff < 0 ? `-${formatMoney(Math.abs(diff), baseCurrency)}` : 'بدون تغییر'}
              </span>
            </div>
          </div>

          {/* Auto-apply Checkbox */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-900/50">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800"
            />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              اعمال خودکار این تنظیمات رندسازی در محاسبات بعدی فروش فلزات
            </span>
          </label>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800/80 dark:bg-slate-900/50">
          <div>
            {exactCalculatedAmount !== undefined && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                title="بازنشانی مبلغ به فرمول دقیق محاسباتی"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>بازنشانی به مبلغ دقیق</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white hover:bg-amber-600 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              <Check className="h-3.5 w-3.5" />
              <span>اعمال رند کردن</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
