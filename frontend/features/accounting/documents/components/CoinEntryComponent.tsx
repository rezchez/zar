'use client';

import React, { useMemo, useState } from 'react';
import {
  Coins,
  Plus,
  Trash2,
  Sparkles,
  Calculator,
  Lock,
  X,
  Check,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import {
  COIN_CATEGORY_LABELS,
  STANDARD_COINS,
  calculateCoinRow,
  calculateCoinTotals,
  createNewCoinRow,
  getCoinDefinition,
  type CoinCategory,
  type CoinDefinition,
  type CoinEntryRow,
  type CoinTotals,
} from '@/lib/coin';
import { formatMoney } from '@/lib/money';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { cn } from '@/lib/utils';

export interface CoinEntryComponentProps {
  mode?: string;
  nature?: 'paid' | 'received';
  displayTitle?: string;
  rows?: CoinEntryRow[];
  onRowsChange?: (rows: CoinEntryRow[], totals: CoinTotals) => void;
  weightPrecision?: number;
  className?: string;
  readOnly?: boolean;
}

export default function CoinEntryComponent({
  nature = 'paid',
  displayTitle = 'خروج سکه یا شمش - تعدادی',
  rows: controlledRows,
  onRowsChange,
  weightPrecision = 3,
  className = '',
  readOnly = false,
}: CoinEntryComponentProps) {
  // Internal state when not controlled
  const [internalRows, setInternalRows] = useState<CoinEntryRow[]>(() => [
    createNewCoinRow('emami_full'),
  ]);

  const [customCoins, setCustomCoins] = useState<CoinDefinition[]>([]);
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
  const [submittingCustom, setSubmittingCustom] = useState(false);

  // New custom coin form state
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState<CoinCategory>('custom');
  const [newCustomWeight, setNewCustomWeight] = useState('1.0');
  const [newCustomPurity, setNewCustomPurity] = useState('750');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  const rows = controlledRows ?? internalRows;

  // Group coins for select optgroups
  const groupedCoins = useMemo(() => {
    const all = [...STANDARD_COINS, ...customCoins];
    const groups: Record<CoinCategory, CoinDefinition[]> = {
      bank_coin: [],
      pahlavi_coin: [],
      parsian: [],
      bar: [],
      custom: [],
    };
    for (const c of all) {
      if (groups[c.category]) {
        groups[c.category].push(c);
      } else {
        groups.custom.push(c);
      }
    }
    return groups;
  }, [customCoins]);

  // Derived calculations for all rows
  const calculatedRows = useMemo(() => {
    return rows.map((r) => calculateCoinRow(r, customCoins, weightPrecision));
  }, [rows, customCoins, weightPrecision]);

  // Derived totals
  const totals = useMemo(() => {
    return calculateCoinTotals(rows, customCoins, weightPrecision);
  }, [rows, customCoins, weightPrecision]);

  // Update rows helper
  const updateRows = (newRows: CoinEntryRow[]) => {
    if (!controlledRows) {
      setInternalRows(newRows);
    }
    const newTotals = calculateCoinTotals(newRows, customCoins, weightPrecision);
    onRowsChange?.(newRows, newTotals);
  };

  // Add new blank row
  const handleAddRow = () => {
    const newRow = createNewCoinRow('emami_full');
    updateRows([...rows, newRow]);
  };

  // Remove a row
  const handleRemoveRow = (rowId: string) => {
    const updated = rows.filter((r) => r.id !== rowId);
    updateRows(updated);
  };

  // Update a single field in a row
  const handleFieldChange = (
    rowId: string,
    field: keyof CoinEntryRow,
    value: string,
  ) => {
    const updated = rows.map((r) => {
      if (r.id !== rowId) return r;

      if (field === 'coinTypeId') {
        const def = getCoinDefinition(value, customCoins);
        return {
          ...r,
          coinTypeId: value,
          unitWeight: def.isFixedWeight ? String(def.unitWeight) : r.unitWeight,
          purity: def.isFixedPurity ? String(def.purity) : r.purity,
        };
      }

      return {
        ...r,
        [field]: value,
      };
    });

    updateRows(updated);
  };

  // Submit custom coin
  const handleCreateCustomCoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustomName.trim();
    if (!name) {
      setCustomFormError('نام سکه یا شمش نمی‌تواند خالی باشد.');
      return;
    }

    const weight = parseFloat(normalizeDigits(newCustomWeight).replace(/,/g, ''));
    if (isNaN(weight) || weight <= 0) {
      setCustomFormError('وزن واحد باید عددی مثبت و بزرگتر از صفر باشد.');
      return;
    }

    const purity = parseFloat(normalizeDigits(newCustomPurity).replace(/,/g, ''));
    if (isNaN(purity) || purity <= 0 || purity > 1000) {
      setCustomFormError('عیار باید عددی بین ۱ تا ۱۰۰۰ باشد.');
      return;
    }

    setSubmittingCustom(true);
    setCustomFormError(null);

    try {
      const natureStr = newCustomCategory === 'bar' ? 'bullion' : 'coin';
      const res = await fetch('/api/coin-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nature: natureStr,
          unitWeight: weight,
          purity,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCustomFormError(data.message || 'ثبت سکه/شمش سفارشی با خطا مواجه شد.');
        return;
      }

      const created = data.coinType;
      const newDef: CoinDefinition = {
        id: created.id,
        name: created.name,
        category: newCustomCategory,
        categoryLabel: COIN_CATEGORY_LABELS[newCustomCategory] || 'انواع سفارشی',
        unitWeight: Number(created.unitWeight || weight),
        purity: Number(created.purity || purity),
        isFixedWeight: false,
        isFixedPurity: false,
        description: `نوع سفارشی تعریف‌شده توسط کاربر (${weight}g / عیار ${purity})`,
      };

      setCustomCoins((prev) => [...prev.filter((c) => c.id !== created.id), newDef]);
      setIsAddCustomModalOpen(false);
      setNewCustomName('');
      setNewCustomWeight('1.0');
      setNewCustomPurity('750');
    } catch (err) {
      setCustomFormError(err instanceof Error ? err.message : 'خطا در ثبت سکه/شمش سفارشی.');
    } finally {
      setSubmittingCustom(false);
    }
  };

  return (
    <div className={cn('space-y-4 text-right', className)} dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <Coins size={18} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
              {displayTitle}
            </h3>
            <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
              ثبت اقلام سکه، مسکوکات بهار آزادی، پارسیان و شمش‌های طلا بر اساس تعداد و وزن
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black shadow-2xs',
              nature === 'paid'
                ? 'bg-rose-500/10 text-rose-700 border border-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300'
                : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300',
            )}
          >
            {nature === 'paid' ? 'خروج اقلام (پرداخت)' : 'ورود اقلام (دریافت)'}
          </span>
        </div>
      </div>

      {/* Rows List */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {rows.map((row, index) => {
            const calc = calculatedRows[index] || calculateCoinRow(row, customCoins, weightPrecision);
            const def = getCoinDefinition(row.coinTypeId, customCoins);

            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ duration: 0.2 }}
                className="relative rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-2xs backdrop-blur-xs transition-all dark:border-slate-800/90 dark:bg-slate-900/90"
              >
                {/* Row Header Indicator */}
                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/15 text-[11px] font-black text-amber-800 dark:bg-amber-500/25 dark:text-amber-300">
                      {toPersianDigits(index + 1)}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                      {calc.coinName}
                    </span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {def.categoryLabel}
                    </span>
                  </div>

                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 cursor-pointer"
                      title="حذف ردیف"
                    >
                      <Trash2 size={13} />
                      <span className="hidden sm:inline">حذف ردیف</span>
                    </button>
                  ) : null}
                </div>

                {/* Form Fields Grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {/* 1. Coin Type Select */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      نوع سکه / شمش <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        disabled={readOnly}
                        value={row.coinTypeId}
                        onChange={(e) => handleFieldChange(row.id, 'coinTypeId', e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 text-xs font-bold text-slate-800 transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:bg-slate-900"
                      >
                        <optgroup label="سکه‌های بانکی (بهار آزادی)">
                          {groupedCoins.bank_coin.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.unitWeight} گرم - عیار {c.purity})
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="سکه‌های پهلوی">
                          {groupedCoins.pahlavi_coin.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.unitWeight} گرم - عیار {c.purity})
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="سکه‌های پارسیان (۱۸ عیار)">
                          {groupedCoins.parsian.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} {c.isFixedWeight ? `(${c.unitWeight} گرم)` : ''}
                            </option>
                          ))}
                        </optgroup>

                        <optgroup label="شمش‌های طلا (۲۴ عیار)">
                          {groupedCoins.bar.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.unitWeight} گرم - عیار {c.purity})
                            </option>
                          ))}
                        </optgroup>

                        {groupedCoins.custom.length > 0 ? (
                          <optgroup label="انواع سفارشی">
                            {groupedCoins.custom.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>

                      {!readOnly ? (
                        <button
                          type="button"
                          onClick={() => setIsAddCustomModalOpen(true)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-amber-500/10 text-amber-700 transition-all hover:bg-amber-500/20 active:scale-95 dark:border-amber-600/40 dark:bg-amber-500/20 dark:text-amber-300 cursor-pointer"
                          title="تعریف سکه یا شمش سفارشی جدید"
                        >
                          <Plus size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* 2. Custom Name (if custom coin selected) */}
                  {calc.isCustom ? (
                    <div className="space-y-1 sm:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        عنوان سکه / شمش سفارشی
                      </label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={row.customName || ''}
                        onChange={(e) => handleFieldChange(row.id, 'customName', e.target.value)}
                        placeholder="مثلاً: سکه یادبود، شمش متفرقه و..."
                        className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 text-xs font-bold text-slate-800 transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100"
                      />
                    </div>
                  ) : null}

                  {/* 3. Quantity (تعداد) */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      تعداد (قطعه) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        disabled={readOnly}
                        value={row.quantity}
                        onChange={(e) => handleFieldChange(row.id, 'quantity', e.target.value)}
                        placeholder="۱"
                        className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 text-xs font-black text-slate-900 transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100"
                      />
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        عدد
                      </span>
                    </div>
                  </div>

                  {/* 4. Unit Weight (وزن واحد) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        وزن واحد (گرم)
                      </label>
                      {calc.isFixedWeight ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400" title="وزن استاندارد ثابت">
                          <Lock size={10} />
                          استاندارد
                        </span>
                      ) : null}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        readOnly={calc.isFixedWeight || readOnly}
                        value={row.unitWeight}
                        onChange={(e) => handleFieldChange(row.id, 'unitWeight', e.target.value)}
                        placeholder="۰.۰۰۰"
                        className={cn(
                          'h-10 w-full rounded-xl border px-3 text-xs font-bold transition-all focus:outline-none',
                          calc.isFixedWeight
                            ? 'border-slate-200/50 bg-slate-100/70 text-slate-600 dark:border-slate-800/50 dark:bg-slate-800/50 dark:text-slate-300 cursor-not-allowed select-none'
                            : 'border-slate-200/80 bg-slate-50/70 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100',
                        )}
                      />
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        گرم
                      </span>
                    </div>
                  </div>

                  {/* 5. Total Weight (وزن کل محاسبه شده - Read Only) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black text-slate-800 dark:text-slate-200">
                        وزن کل محاسبه‌شده
                      </label>
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <Calculator size={10} />
                        محاسباتی
                      </span>
                    </div>
                    <div className="flex h-10 w-full items-center justify-between rounded-xl border border-amber-300/60 bg-amber-50/50 px-3 text-xs font-black text-amber-950 shadow-2xs dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200">
                      <span className="font-mono text-sm">
                        {calc.totalWeight > 0 ? calc.totalWeight.toFixed(weightPrecision) : '۰.۰۰۰'}
                      </span>
                      <span className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                        گرم
                      </span>
                    </div>
                  </div>

                  {/* 6. Purity (عیار) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        عیار
                      </label>
                      {calc.isFixedPurity ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-slate-400" title="عیار استاندارد مصوب">
                          <Lock size={10} />
                          مصوب
                        </span>
                      ) : null}
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        readOnly={calc.isFixedPurity || readOnly}
                        value={row.purity}
                        onChange={(e) => handleFieldChange(row.id, 'purity', e.target.value)}
                        placeholder="۷۵۰"
                        className={cn(
                          'h-10 w-full rounded-xl border px-3 text-xs font-bold transition-all focus:outline-none',
                          calc.isFixedPurity
                            ? 'border-slate-200/50 bg-slate-100/70 text-slate-600 dark:border-slate-800/50 dark:bg-slate-800/50 dark:text-slate-300 cursor-not-allowed select-none'
                            : 'border-slate-200/80 bg-slate-50/70 text-slate-900 focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100',
                        )}
                      />
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        در هزار
                      </span>
                    </div>
                  </div>

                  {/* 7. Converted 750 (معادل ۷۵۰ محاسبه شده - Read Only) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black text-amber-800 dark:text-amber-300">
                        تبدیل به ۷۵۰ (معادل طلای ۱۸)
                      </label>
                      <span className="flex items-center gap-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                        <Sparkles size={10} />
                        ۷۵۰
                      </span>
                    </div>
                    <div className="flex h-10 w-full items-center justify-between rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-50 to-amber-100/60 px-3 text-xs font-black text-amber-950 shadow-2xs dark:border-amber-600/60 dark:from-amber-950/40 dark:to-amber-900/30 dark:text-amber-200">
                      <span className="font-mono text-sm">
                        {calc.converted750 > 0 ? calc.converted750.toFixed(weightPrecision) : '۰.۰۰۰'}
                      </span>
                      <span className="text-[10px] font-black text-amber-800 dark:text-amber-300">
                        گرم ۷۵۰
                      </span>
                    </div>
                  </div>

                  {/* 8. Total Amount (مبلغ کل معامله ریال) */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      مبلغ کل (اختیاری)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled={readOnly}
                        value={row.totalAmount}
                        onChange={(e) => {
                          const raw = normalizeDigits(e.target.value).replace(/[^\d]/g, '');
                          const formatted = raw ? Number(raw).toLocaleString('en-US') : '';
                          handleFieldChange(row.id, 'totalAmount', formatted);
                        }}
                        placeholder="۰"
                        className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100"
                      />
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        ریال
                      </span>
                    </div>
                    {calc.totalAmount > 0 ? (
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        معادل {formatMoney(Math.floor(calc.totalAmount / 10), 'IRT')}
                      </p>
                    ) : null}
                  </div>

                  {/* 9. Description (توضیحات ردیف) */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      توضیحات ردیف
                    </label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={row.description}
                      onChange={(e) => handleFieldChange(row.id, 'description', e.target.value)}
                      placeholder="توضیحات اختیاری (شماره سریال، سال ضرب، بسته‌بندی و...)"
                      className="h-10 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 text-xs font-medium text-slate-800 transition-all focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100"
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty State */}
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
            <Coins size={36} className="text-slate-300 dark:text-slate-600 mb-2" />
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">
              هیچ ردیف سکه یا شمشی ثبت نشده است
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 mb-4">
              جهت افزودن ردیف جدید، دکمه زیر را انتخاب نمایید.
            </p>
            {!readOnly ? (
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>افزودن اولین ردیف سکه یا شمش</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Add Row Button */}
      {rows.length > 0 && !readOnly ? (
        <div className="flex justify-start pt-1">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 px-4 py-2.5 text-xs font-black text-amber-700 transition-all hover:border-amber-500 hover:bg-amber-500/10 active:scale-98 dark:text-amber-300 cursor-pointer"
          >
            <Plus size={15} />
            <span>افزودن ردیف سکه یا شمش دیگر</span>
          </button>
        </div>
      ) : null}

      {/* Live Summary Bar (کارت جمع کل اقلام) */}
      {rows.length > 0 ? (
        <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-4 shadow-sm dark:border-amber-700/50 dark:from-slate-900/90 dark:via-slate-900 dark:to-amber-950/20">
          <div className="mb-3 flex items-center justify-between border-b border-amber-200/60 pb-2 dark:border-slate-800">
            <span className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-200">
              <Calculator size={15} className="text-amber-600 dark:text-amber-400" />
              جمع کل اقلام سکه و شمش
            </span>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {toPersianDigits(rows.length)} ردیف
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total Quantity */}
            <div className="rounded-xl border border-slate-200/60 bg-white/90 p-2.5 text-center shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                جمع تعداد قطعات
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                {toPersianDigits(totals.totalQuantity)} <small className="text-[10px] font-normal">عدد</small>
              </span>
            </div>

            {/* Total Weight */}
            <div className="rounded-xl border border-slate-200/60 bg-white/90 p-2.5 text-center shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                جمع وزن ناخالص
              </span>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                {totals.totalWeight.toFixed(weightPrecision)} <small className="text-[10px] font-normal">گرم</small>
              </span>
            </div>

            {/* Total Converted 750 */}
            <div className="rounded-xl border border-amber-300/80 bg-amber-500/10 p-2.5 text-center shadow-2xs dark:border-amber-700/60 dark:bg-amber-500/20">
              <span className="block text-[10px] font-black text-amber-800 dark:text-amber-300 mb-0.5">
                جمع معادل طلای ۷۵۰ (۱۸k)
              </span>
              <span className="text-sm font-black text-amber-950 dark:text-amber-200">
                {totals.totalConverted750.toFixed(weightPrecision)} <small className="text-[10px] font-bold">گرم</small>
              </span>
            </div>

            {/* Total Amount */}
            <div className="rounded-xl border border-slate-200/60 bg-white/90 p-2.5 text-center shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                جمع کل مبلغ
              </span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 truncate block">
                {totals.totalAmount > 0 ? totals.totalAmount.toLocaleString('en-US') : '۰'}{' '}
                <small className="text-[10px] font-normal">ریال</small>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal: Define Custom Coin */}
      <AnimatePresence>
        {isAddCustomModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCustomModalOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                    <Plus size={16} />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                    تعریف نوع سکه یا شمش سفارشی
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCustomModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleCreateCustomCoin} className="space-y-3">
                {customFormError ? (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    {customFormError}
                  </div>
                ) : null}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام سکه یا شمش <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    placeholder="مثلاً: سکه یادبود ویژه، شمش ۵۰ گرمی ترکیه و..."
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    دسته‌بندی
                  </label>
                  <select
                    value={newCustomCategory}
                    onChange={(e) => setNewCustomCategory(e.target.value as CoinCategory)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="bank_coin">سکه‌های بانکی</option>
                    <option value="pahlavi_coin">سکه‌های پهلوی</option>
                    <option value="parsian">سکه‌های پارسیان</option>
                    <option value="bar">شمش‌های طلا</option>
                    <option value="custom">انواع سفارشی متفرقه</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      وزن واحد (گرم) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      required
                      value={newCustomWeight}
                      onChange={(e) => setNewCustomWeight(e.target.value)}
                      placeholder="۱.۰"
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      عیار (در هزار) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      required
                      value={newCustomPurity}
                      onChange={(e) => setNewCustomPurity(e.target.value)}
                      placeholder="۷۵۰"
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomModalOpen(false)}
                    className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCustom}
                    className="flex items-center gap-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{submittingCustom ? 'در حال ثبت...' : 'ثبت و اضافه به لیست'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
