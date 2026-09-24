'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Settings,
  X,
  RotateCcw,
  Check,
  ArrowDown,
  ArrowUp,
  Equal,
  Power,
  PowerOff,
  Ban,
  SlidersHorizontal,
} from 'lucide-react';
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
  initialEnabled?: boolean;
  onApply: (
    roundedAmount: number,
    digits: number,
    mode: 'round' | 'ceil' | 'floor',
    autoApply: boolean,
    enabled?: boolean,
  ) => void;
  onReset?: () => void;
  onDisable?: () => void;
}

const PRESET_DIGITS = [
  { digits: 2, label: '۲ رقم (صدگان)', detail: '۱۰۰ ریال (۱۰ ت)' },
  { digits: 3, label: '۳ رقم (هزارگان)', detail: '۱,۰۰۰ ریال (۱۰۰ ت)', recommended: true },
  { digits: 4, label: '۴ رقم (ده‌هزارگان)', detail: '۱۰,۰۰۰ ریال (۱,۰۰۰ ت)' },
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
  initialEnabled = true,
  onApply,
  onReset,
  onDisable,
}: AmountRoundingModalProps) {
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [digits, setDigits] = useState<number>(Math.min(4, Math.max(1, initialDigits)));
  const [mode, setMode] = useState<'round' | 'ceil' | 'floor'>(initialMode);
  const [autoApply, setAutoApply] = useState<boolean>(initialAutoApply);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setEnabled(initialEnabled);
      setDigits(Math.min(4, Math.max(1, initialDigits)));
      setMode(initialMode);
      setAutoApply(initialAutoApply);
    }
  }, [isOpen, initialEnabled, initialDigits, initialMode, initialAutoApply]);

  // Handle keyboard shortcuts (Escape to close, Enter to submit)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        // Prevent default submit when not inside an input/button
        const target = e.target as HTMLElement | null;
        if (target && target.tagName !== 'BUTTON' && target.tagName !== 'INPUT') {
          e.preventDefault();
          handleApply();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, enabled, digits, mode, autoApply, exactCalculatedAmount, currentAmount]);

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

  // If enabled, compute rounded amount; if disabled, maintain exact amount
  const roundedAmount = enabled
    ? roundAmountToDigits(amountToRound, digits, mode)
    : amountToRound;

  const diff = enabled ? roundedAmount - amountToRound : 0;

  // Words representations
  const exactWords = formatAmountHelperWords(amountToRound, undefined, baseCurrency);
  const finalWords = enabled
    ? formatAmountHelperWords(roundedAmount, undefined, baseCurrency)
    : exactWords;

  const handleApply = () => {
    if (!enabled) {
      if (onDisable) {
        onDisable();
      } else {
        onApply(amountToRound, digits, mode, false, false);
      }
      onClose();
      return;
    }
    onApply(roundedAmount, digits, mode, autoApply, true);
    onClose();
  };

  const handleQuickDisable = () => {
    setEnabled(false);
    if (onDisable) {
      onDisable();
    } else {
      onApply(amountToRound, digits, mode, false, false);
    }
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
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h3 id="rounding-modal-title" className="text-sm font-black text-slate-900 dark:text-white">
                تنظیمات رند کردن مبلغ کل (محاسباتی)
              </h3>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                مدیریت گرد کردن مبلغ برای تسویه حساب آسان‌تر و هماهنگی فاکتور
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
          {/* Enable / Disable Master Switch Card */}
          <div
            className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
              enabled
                ? 'border-amber-400/80 bg-amber-50/50 dark:border-amber-600/60 dark:bg-amber-950/20 shadow-2xs'
                : 'border-slate-200 bg-slate-100/70 dark:border-slate-800 dark:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  enabled
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                {enabled ? <Power className="h-4.5 w-4.5" /> : <PowerOff className="h-4.5 w-4.5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white">
                    وضعیت رندسازی مبلغ:
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black ${
                      enabled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {enabled ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {enabled
                    ? 'مبلغ کل بر اساس تعداد ارقام و روش انتخابی زیر گرد می‌شود.'
                    : 'رندسازی خاموش است و مبلغ دقیق فرمول محاسباتی ثبت خواهد شد.'}
                </p>
              </div>
            </div>

            {/* Accessible RTL Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((prev) => !prev)}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                enabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              title={enabled ? 'غیرفعال کردن رندسازی' : 'فعال کردن رندسازی'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? '-translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Current Exact Calculated Amount Box */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">مبلغ دقیق محاسباتی (فرمول):</span>
              <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                {formatMoney(amountToRound, baseCurrency)}
              </span>
            </div>
            {exactWords ? (
              <div className="mt-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <span>✦ {exactWords}</span>
              </div>
            ) : null}
          </div>

          {/* Options Container (Dimmed when disabled) */}
          <div
            className={`space-y-4 transition-all duration-200 ${
              !enabled ? 'opacity-40 grayscale pointer-events-none select-none' : ''
            }`}
          >
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
                      disabled={!enabled}
                      onClick={() => setDigits(p.digits)}
                      className={`relative flex flex-col items-center justify-center rounded-xl p-2.5 text-center transition-all border ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500 text-white shadow-xs dark:border-amber-500 dark:bg-amber-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50/50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-amber-600'
                      }`}
                    >
                      {p.recommended && (
                        <span
                          className={`absolute -top-2 left-2 rounded-full px-1.5 py-0.2 text-[9px] font-black ${
                            isSelected
                              ? 'bg-slate-900 text-amber-300 dark:bg-black dark:text-amber-200'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-300'
                          }`}
                        >
                          پیشنهادی
                        </span>
                      )}
                      <span className="text-xs font-black">{p.label}</span>
                      <span
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? 'text-amber-100 dark:text-amber-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {p.detail}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Stepper */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  تنظیم دستی تعداد ارقام (۱ تا ۴):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!enabled || digits <= 1}
                    onClick={() => setDigits((d) => Math.max(1, d - 1))}
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
                    disabled={!enabled || digits >= 4}
                    onClick={() => setDigits((d) => Math.min(4, d + 1))}
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
                  disabled={!enabled}
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
                  disabled={!enabled}
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
                  disabled={!enabled}
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
          </div>

          {/* Live Preview Card */}
          <div
            className={`rounded-2xl border-2 p-4 transition-all space-y-2 ${
              enabled
                ? 'border-amber-400/80 bg-amber-50/50 dark:border-amber-600/70 dark:bg-amber-950/30'
                : 'border-slate-300 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-black ${
                  enabled ? 'text-amber-900 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {enabled ? 'مبلغ نهایی پس از رند شدن:' : 'مبلغ اعمالی (بدون رند کردن):'}
              </span>
              <span
                className={`font-mono text-base sm:text-lg font-black tabular-nums ${
                  enabled ? 'text-amber-950 dark:text-amber-100' : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatMoney(roundedAmount, baseCurrency)}
              </span>
            </div>

            {finalWords ? (
              <div
                className={`text-xs font-bold ${
                  enabled ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>✦ {finalWords}</span>
              </div>
            ) : null}

            <div
              className={`flex items-center justify-between border-t pt-2 text-[11px] ${
                enabled
                  ? 'border-amber-300/60 dark:border-amber-800/60'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span className="text-slate-600 dark:text-slate-400 font-bold">
                تعدیل / اختلاف ناشی از رند کردن:
              </span>
              <span
                className={`font-mono font-black ${
                  !enabled || diff === 0
                    ? 'text-slate-600 dark:text-slate-400'
                    : diff > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {!enabled
                  ? 'بدون تغییر (رندسازی غیرفعال)'
                  : diff > 0
                    ? `+${formatMoney(diff, baseCurrency)} (اضافه به فاکتور)`
                    : diff < 0
                      ? `-${formatMoney(Math.abs(diff), baseCurrency)} (کسر / تخفیف)`
                      : 'بدون تغییر (۰)'}
              </span>
            </div>
          </div>

          {/* Auto-apply Checkbox */}
          <label
            className={`flex items-center gap-2.5 cursor-pointer select-none rounded-xl border p-2.5 transition-all ${
              !enabled
                ? 'opacity-40 grayscale pointer-events-none border-slate-200 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-900/30'
                : 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50'
            }`}
          >
            <input
              type="checkbox"
              disabled={!enabled}
              checked={autoApply && enabled}
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
          <div className="flex items-center gap-2">
            {/* Quick Disable Rounding Button */}
            <button
              type="button"
              onClick={handleQuickDisable}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 transition-colors"
              title="غیرفعال‌سازی سریع رندسازی و بازگشت به مبلغ دقیق"
            >
              <Ban className="h-3.5 w-3.5" />
              <span>غیرفعال‌سازی رند</span>
            </button>

            {exactCalculatedAmount !== undefined && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                title="بازنشانی مبلغ به فرمول دقیق محاسباتی"
              >
                <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                <span>بازنشانی به فرمول</span>
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
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white shadow-md active:scale-95 transition-all ${
                enabled
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                  : 'bg-slate-700 hover:bg-slate-800 shadow-slate-700/20 dark:bg-slate-600 dark:hover:bg-slate-500'
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              <span>{enabled ? 'اعمال رند کردن' : 'ثبت و غیرفعال‌سازی رند'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
