'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, CheckCircle2, Coins, Loader2, Search, UserCheck, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { type Customer } from '@/lib/customer';
import { parseLocalizedAmount } from '@/lib/money';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

export type DetectedCurrencyInfo = {
  code: string;
  name: string;
  symbol: string;
  isForeign: boolean;
};

/**
 * Detects the transaction currency cleanly from line details, fund name, and customer metadata.
 */
export function detectHawalaCurrency(
  line?: DocumentLine | null,
  sourceCustomer?: Customer | null,
): DetectedCurrencyInfo {
  const candidates = [
    line?.details?.cashFundCurrency,
    line?.details?.currencyUnit,
    line?.details?.cashFundName,
    sourceCustomer?.primaryCurrency,
  ].filter(Boolean).map(String);

  for (const raw of candidates) {
    const clean = raw.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
    if (clean.includes('یورو') || clean.includes('eur') || clean.includes('€')) {
      return { code: 'EUR', name: 'یورو', symbol: '€', isForeign: true };
    }
    if (clean.includes('دلار') || clean.includes('usd') || clean.includes('$')) {
      return { code: 'USD', name: 'دلار', symbol: '$', isForeign: true };
    }
    if (clean.includes('درهم') || clean.includes('aed') || clean.includes('د.إ')) {
      return { code: 'AED', name: 'درهم', symbol: 'د.إ', isForeign: true };
    }
    if (clean.includes('پوند') || clean.includes('gbp') || clean.includes('£')) {
      return { code: 'GBP', name: 'پوند', symbol: '£', isForeign: true };
    }
    if (clean.includes('لیر') || clean.includes('try') || clean.includes('₺')) {
      return { code: 'TRY', name: 'لیر', symbol: '₺', isForeign: true };
    }
    if (clean.includes('یوان') || clean.includes('cny') || clean.includes('¥')) {
      return { code: 'CNY', name: 'یوان', symbol: '¥', isForeign: true };
    }
    if (clean.includes('تومان') || clean.includes('irt')) {
      return { code: 'IRT', name: 'تومان', symbol: 'تومان', isForeign: false };
    }
    if (clean.includes('ریال') || clean.includes('irr') || clean.includes('rial')) {
      return { code: 'IRR', name: 'ریال', symbol: 'ریال', isForeign: false };
    }
  }

  return { code: 'IRR', name: 'ریال', symbol: 'ریال', isForeign: false };
}

/**
 * Extracts all supported currencies for a customer.
 */
export function getCustomerSupportedCurrencies(customer?: Customer | null): string[] {
  if (!customer) return ['IRR'];
  const list: string[] = [];
  const add = (raw?: string) => {
    if (!raw) return;
    const clean = raw.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');
    if (clean.includes('یورو') || clean.includes('eur') || clean.includes('€')) {
      if (!list.includes('EUR')) list.push('EUR');
      return;
    }
    if (clean.includes('دلار') || clean.includes('usd') || clean.includes('$')) {
      if (!list.includes('USD')) list.push('USD');
      return;
    }
    if (clean.includes('درهم') || clean.includes('aed') || clean.includes('د.إ')) {
      if (!list.includes('AED')) list.push('AED');
      return;
    }
    if (clean.includes('پوند') || clean.includes('gbp') || clean.includes('£')) {
      if (!list.includes('GBP')) list.push('GBP');
      return;
    }
    if (clean.includes('لیر') || clean.includes('try') || clean.includes('₺')) {
      if (!list.includes('TRY')) list.push('TRY');
      return;
    }
    if (clean.includes('یوان') || clean.includes('cny') || clean.includes('¥')) {
      if (!list.includes('CNY')) list.push('CNY');
      return;
    }
    if (clean.includes('تومان') || clean.includes('irt') || clean.includes('ریال') || clean.includes('irr') || clean.includes('rial')) {
      if (!list.includes('IRR')) list.push('IRR');
      if (!list.includes('IRT')) list.push('IRT');
      return;
    }
    const upper = raw.trim().toUpperCase();
    if (!list.includes(upper)) list.push(upper);
  };

  add(customer.primaryCurrency);
  add(customer.secondaryCurrency);
  add(customer.secondaryCurrencySymbol);
  add(customer.tertiaryCurrency);
  add(customer.tertiaryCurrencySymbol);
  if (customer.currencyBalances) {
    Object.keys(customer.currencyBalances).forEach(add);
  }

  // Default to Rial/Toman if completely empty
  if (list.length === 0) {
    list.push('IRR', 'IRT');
  }

  return list;
}

/**
 * Checks whether target customer has or supports the required currency.
 */
export function isCustomerSupportingCurrency(customer: Customer | null | undefined, targetCode: string): boolean {
  if (!customer) return false;
  const target = (targetCode || 'IRR').toUpperCase();

  // If target is Rial/Toman, check if customer is a standard Rial customer
  if (target === 'IRR' || target === 'IRT') {
    const prim = (customer.primaryCurrency || '').toLowerCase();
    if (!prim || prim === 'rial' || prim === 'irr' || prim === 'irt' || prim === 'تومان' || prim === 'ریال') {
      return true;
    }
  }

  const supported = getCustomerSupportedCurrencies(customer);
  return supported.some(
    (c) => c === target || ((c === 'IRR' || c === 'IRT') && (target === 'IRR' || target === 'IRT')),
  );
}

/**
 * Extracts the current balance of a specific currency for a customer.
 */
export function getCustomerCurrencyBalance(customer: Customer | null | undefined, currencyCode: string): number {
  if (!customer) return 0;
  const code = (currencyCode || 'IRR').toUpperCase();

  // Rial / Toman
  if (code === 'IRR' || code === 'IRT') {
    return Number(customer.rialBalance || 0);
  }

  // Check currencyBalances record if present
  if (customer.currencyBalances) {
    for (const [key, val] of Object.entries(customer.currencyBalances)) {
      if (key.toUpperCase() === code) {
        return Number(val || 0);
      }
    }
  }

  // Check foreign balance on customer if matching primary or secondary currency
  const prim = (customer.primaryCurrency || '').toUpperCase();
  const sec = (customer.secondaryCurrency || '').toUpperCase();
  const ter = (customer.tertiaryCurrency || '').toUpperCase();

  if (prim.includes(code) || (code === 'EUR' && (prim.includes('EUR') || prim.includes('یورو')))) {
    return Number(customer.foreignBalance || 0);
  }
  if (sec.includes(code) || (code === 'EUR' && (sec.includes('EUR') || sec.includes('یورو')))) {
    return Number(customer.foreignBalance || 0);
  }
  if (ter.includes(code) || (code === 'EUR' && (ter.includes('EUR') || ter.includes('یورو')))) {
    return Number(customer.tertiaryBalance || 0);
  }

  return Number(customer.foreignBalance || 0);
}

export function getCurrencyDisplayLabel(code: string): string {
  const c = (code || '').toUpperCase();
  if (c === 'EUR') return 'یورو (€)';
  if (c === 'USD') return 'دلار ($)';
  if (c === 'AED') return 'درهم (د.إ)';
  if (c === 'GBP') return 'پوند (£)';
  if (c === 'TRY') return 'لیر (₺)';
  if (c === 'CNY') return 'یوان (¥)';
  if (c === 'IRR' || c === 'IRT') return 'ریال / تومان';
  return code;
}

export function normalizeToCanonical(code?: string): string {
  return detectHawalaCurrency({ details: { cashFundCurrency: code } } as unknown as DocumentLine).code;
}

export function getCustomerCurrencies(customer?: Customer | null): string[] {
  return getCustomerSupportedCurrencies(customer);
}

type HawalaModalProps = {
  line: DocumentLine | null;
  sourceCustomer: Customer | null;
  allCustomers: Customer[];
  weightPrecision?: number;
  onClose: () => void;
  onConfirmHawala: (targetCustomer: Customer) => void | Promise<void>;
  isSubmitting?: boolean;
};

export default function HawalaModal({
  line,
  sourceCustomer,
  allCustomers,
  weightPrecision = 3,
  onClose,
  onConfirmHawala,
  isSubmitting = false,
}: HawalaModalProps) {
  const [targetQuery, setTargetQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');

  // Reset internal state when line or modal opens/closes
  useEffect(() => {
    if (line?.id) {
      setTargetQuery('');
      setSelectedTargetId('');
    }
  }, [line?.id]);

  // Detect currency info accurately from line & customer
  const currency = useMemo(() => {
    return detectHawalaCurrency(line, sourceCustomer);
  }, [line, sourceCustomer]);

  // Clean numeric amount parsing
  const numericAmount = useMemo(() => {
    if (!line) return 0;
    const rawStr = String(line.details?.totalAmount || line.details?.currencyTotalAmount || '0');
    return parseLocalizedAmount(rawStr);
  }, [line]);

  const isReceived = line?.documentNature === 'received';

  const targetCustomer = useMemo(
    () => allCustomers.find((c) => c.id === selectedTargetId) || null,
    [allCustomers, selectedTargetId],
  );

  // Filter counterparties: all customers (except sourceCustomer) are available and searchable
  const availableCustomers = useMemo(() => {
    const q = targetQuery.trim().toLowerCase();
    return allCustomers
      .filter((c) => c.id !== sourceCustomer?.id)
      .filter((c) => !q || `${c.name} ${c.customerCode ?? ''} ${c.phone1 ?? ''}`.toLowerCase().includes(q))
      .slice(0, 10);
  }, [allCustomers, sourceCustomer, targetQuery]);

  // Projected balances for target customer
  const balancePreview = useMemo(() => {
    if (!targetCustomer || !line) return null;

    // For Hawala: target customer gets the opposite effect of source customer
    // If source customer received cash (+ in fund), target customer is paid cash (- for customer balance)
    const direction = isReceived ? -1 : 1;
    const current = getCustomerCurrencyBalance(targetCustomer, currency.code);
    const effect = direction * numericAmount;
    const projected = current + effect;

    return {
      current,
      effect,
      projected,
    };
  }, [targetCustomer, line, isReceived, currency.code, numericAmount]);

  if (!line || !sourceCustomer) return null;

  function handleSubmitHawala() {
    if (!targetCustomer || isSubmitting) return;
    void onConfirmHawala(targetCustomer);
  }

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
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-extrabold text-amber-600 dark:text-amber-400">
              <ArrowLeftRight size={18} />
              <span>ثبت حواله به طرف‌حساب دیگر</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Transaction Summary Card */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-2.5">
            <div className="flex justify-between items-center text-slate-500 font-bold">
              <span>طرف‌حساب مبدأ:</span>
              <strong className="text-slate-800 dark:text-slate-100">
                {sourceCustomer.name} {sourceCustomer.customerCode ? `(کد: ${sourceCustomer.customerCode})` : ''}
              </strong>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold">نوع عملیات:</span>
              <span
                className={`font-black px-2 py-0.5 rounded-md ${
                  isReceived
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {isReceived ? 'ورود وجه نقد (دریافت)' : 'خروج وجه نقد (پرداخت)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400 block text-[11px]">صندوق وجه نقد:</span>
                <strong className="text-slate-800 dark:text-slate-200 text-xs">
                  {line.details?.cashFundName || 'صندوق وجه نقد'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">مبلغ حواله:</span>
                <strong className="text-amber-600 dark:text-amber-400 text-sm font-mono font-black">
                  {numericAmount.toLocaleString('fa-IR')} {currency.symbol}
                </strong>
              </div>
            </div>
          </div>

          {/* Target Customer Selection Section */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                انتخاب طرف‌حساب حواله (مقصد) *
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-700 dark:text-amber-300 bg-amber-500/15 dark:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                <Coins size={12} />
                <span>واحد حواله: {currency.name} ({currency.symbol})</span>
              </span>
            </div>

            <div className="relative">
              <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
              <input
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder="جستجوی نام، کد یا تلفن طرف‌حساب مقصد..."
                className="w-full h-9 pr-9 pl-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 dark:text-slate-100"
              />
            </div>

            {/* Suggestions list */}
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-100 dark:border-slate-800 p-1">
              {availableCustomers.length === 0 ? (
                <div className="py-4 px-2 text-center text-xs text-slate-400">
                  هیچ طرف‌حسابی با این مشخصات یافت نشد.
                </div>
              ) : (
                availableCustomers.map((c) => {
                  const custCurrs = getCustomerSupportedCurrencies(c).map(getCurrencyDisplayLabel).join('، ');
                  const isSelected = selectedTargetId === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setSelectedTargetId(c.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <CheckCircle2 size={14} className="text-slate-950" />}
                        <span>{c.name}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-slate-900 opacity-90' : 'opacity-75 font-normal'}`}>
                          ({custCurrs})
                        </span>
                      </div>
                      <span className="text-[10px] opacity-80">
                        {c.customerCode ? `کد ${c.customerCode}` : ''} {c.phone1 ? `· ${c.phone1}` : ''}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Target Customer Balance Effect Preview */}
            {targetCustomer && balancePreview && (
              <div className="p-3.5 bg-teal-50/70 dark:bg-teal-950/25 border border-teal-200 dark:border-teal-900/60 rounded-xl text-xs space-y-2.5">
                <div className="flex items-center justify-between text-teal-900 dark:text-teal-200 font-black text-xs border-b border-teal-200/60 dark:border-teal-900/60 pb-2">
                  <div className="flex items-center gap-1.5">
                    <UserCheck size={15} className="text-teal-600 dark:text-teal-400" />
                    <span>پیش‌نمایش تغییر مانده طرف‌حساب مقصد ({targetCustomer.name}):</span>
                  </div>
                  <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 rounded">
                    ارز: {currency.name} ({currency.symbol})
                  </span>
                </div>

                <div className="space-y-1.5 font-medium">
                  <div className="flex justify-between items-center text-slate-600 dark:text-slate-300">
                    <span>مانده فعلی {currency.name}:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                      {balancePreview.current.toLocaleString('fa-IR')} {currency.symbol}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-300">
                      اثر این حواله ({isReceived ? 'سند پرداخت نقد' : 'سند دریافت نقد'}):
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        balancePreview.effect < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {balancePreview.effect >= 0 ? '+' : '−'}
                      {Math.abs(balancePreview.effect).toLocaleString('fa-IR')} {currency.symbol}
                    </span>
                  </div>

                  <div className="flex justify-between items-center font-extrabold text-teal-800 dark:text-teal-200 pt-2 border-t border-teal-200/80 dark:border-teal-900/60">
                    <span>مانده {currency.name} پس از حواله:</span>
                    <span className="font-mono text-sm font-black text-teal-900 dark:text-teal-100">
                      {balancePreview.projected.toLocaleString('fa-IR')} {currency.symbol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!selectedTargetId || isSubmitting}
                onClick={handleSubmitHawala}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>در حال ثبت حواله...</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight size={15} />
                    <span>ثبت حواله</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
