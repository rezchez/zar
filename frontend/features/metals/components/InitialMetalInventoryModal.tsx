'use client';

import { Check, Flame, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { dateToJalaliString } from '@/lib/jalali';
import {
  type MetalInventoryType,
  type MetalOpeningRecord,
} from '@/lib/metal-inventory';
import {
  DEFAULT_BASE_KARATS,
  metalAtBaseKarat,
  roundWeight,
  validateWeightPrecision,
  type PreciousMetalType,
  type WeightDecimalPlaces,
} from '@/lib/weight';

export type InitialMetalInventoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  editItem?: MetalOpeningRecord | null;
  onSuccess?: () => void;
};

const METALS_CONFIG: Record<
  PreciousMetalType,
  { label: string; symbol: string; defaultPurity: number; presets: number[] }
> = {
  gold: {
    label: 'طلا',
    symbol: 'Au',
    defaultPurity: 750,
    presets: [750, 740, 705, 900, 995],
  },
  silver: {
    label: 'نقره',
    symbol: 'Ag',
    defaultPurity: 999,
    presets: [999, 925, 900, 840],
  },
  platinum: {
    label: 'پلاتین',
    symbol: 'Pt',
    defaultPurity: 950,
    presets: [950, 900, 850],
  },
};

const INVENTORY_TYPES_CONFIG: Record<
  MetalInventoryType,
  { label: string; description: string }
> = {
  conditional_melted: {
    label: 'آبشده شرطی',
    description: 'طلای آبشده معتبر با شماره انگ و برگه ری‌گیری رسمی',
  },
  miscellaneous_melted: {
    label: 'آبشده متفرقه',
    description: 'طلای آبشده و متفرقه بدون شرط ری‌گیری',
  },
  general_metal: {
    label: 'موجودی فلز',
    description: 'موجودی مستقیم فلز خام یا شمش پایه',
  },
};

export default function InitialMetalInventoryModal({
  isOpen,
  onClose,
  editItem,
  onSuccess,
}: InitialMetalInventoryModalProps) {
  const { settings, formatWeight } = useAppSettings();
  const weightPrecision = (Number(settings.weightDecimalPlaces) || 3) as WeightDecimalPlaces;
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [metal, setMetal] = useState<PreciousMetalType>('gold');
  const [inventoryType, setInventoryType] = useState<MetalInventoryType>('conditional_melted');
  const [weight, setWeight] = useState<string>('');
  const [purity, setPurity] = useState<string>('750');
  const [labName, setLabName] = useState<string>('');
  const [stampNumber, setStampNumber] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [date, setDate] = useState<string>(dateToJalaliString(new Date()));
  const [description, setDescription] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getBaseKarat = useCallback(
    (m: PreciousMetalType) => {
      if (m === 'gold' && settings.goldBaseKarat) return Number(settings.goldBaseKarat);
      if (m === 'silver' && settings.silverBaseKarat) return Number(settings.silverBaseKarat);
      if (m === 'platinum' && settings.platinumBaseKarat) return Number(settings.platinumBaseKarat);
      return DEFAULT_BASE_KARATS[m] || 750;
    },
    [settings],
  );

  const currentBaseKarat = getBaseKarat(metal);

  // Sync form state on edit or open
  useEffect(() => {
    if (!isOpen) return;

    if (editItem) {
      setMetal(editItem.metal);
      setInventoryType(editItem.inventoryType);
      setWeight(String(editItem.rawWeight || ''));
      setPurity(String(editItem.purity || '750'));
      setLabName(editItem.labName || '');
      setStampNumber(editItem.stampNumber || '');
      setTotalAmount(editItem.totalAmount ? String(editItem.totalAmount) : '');
      setDate(editItem.date || dateToJalaliString(new Date()));
      setDescription(editItem.description || '');
    } else {
      setMetal('gold');
      setInventoryType('conditional_melted');
      setWeight('');
      setPurity(String(METALS_CONFIG.gold.defaultPurity));
      setLabName('');
      setStampNumber('');
      setTotalAmount('');
      setDate(dateToJalaliString(new Date()));
      setDescription('');
    }
    setErrorMsg(null);
  }, [isOpen, editItem]);

  // Update default purity when metal changes in create mode
  const handleMetalChange = (newMetal: PreciousMetalType) => {
    setMetal(newMetal);
    if (!editItem) {
      setPurity(String(METALS_CONFIG[newMetal].defaultPurity));
    }
  };

  // Live converted weight calculation
  const parsedWeight = Number(weight.replace(/,/g, ''));
  const parsedPurity = Number(purity.replace(/,/g, ''));
  const convertedWeight =
    Number.isFinite(parsedWeight) && parsedWeight > 0 && Number.isFinite(parsedPurity) && parsedPurity > 0
      ? metalAtBaseKarat(parsedWeight, parsedPurity, currentBaseKarat, weightPrecision)
      : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setErrorMsg('لطفاً وزن معتبر و مثبت وارد کنید.');
      return;
    }

    const precisionCheck = validateWeightPrecision(weight, weightPrecision);
    if (!precisionCheck.valid) {
      setErrorMsg(precisionCheck.message || `حداکثر ${weightPrecision} رقم اعشار برای وزن مجاز است.`);
      return;
    }

    if (!Number.isFinite(parsedPurity) || parsedPurity <= 0 || parsedPurity > 1000) {
      setErrorMsg('عیار باید عددی بین ۱ تا ۱۰۰۰ باشد.');
      return;
    }

    if (inventoryType === 'conditional_melted') {
      if (!stampNumber.trim()) {
        setErrorMsg('ورود شماره انگ برای آبشده شرطی الزامی است.');
        return;
      }
      if (!labName.trim()) {
        setErrorMsg('ورود نام ری‌گیری برای آبشده شرطی الزامی است.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        id: editItem?.id,
        metal,
        inventoryType,
        weight: parsedWeight,
        purity: parsedPurity,
        baseKarat: currentBaseKarat,
        labName: inventoryType === 'conditional_melted' ? labName.trim() : undefined,
        stampNumber: inventoryType === 'conditional_melted' ? stampNumber.trim() : undefined,
        totalAmount: totalAmount ? Number(totalAmount.replace(/,/g, '')) : 0,
        date,
        description: description.trim(),
      };

      const res = await fetch('/api/accounting/opening/metals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ثبت موجودی اولیه انجام نشد.');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطای نامشخص در ثبت موجودی اولیه.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div
        dir="rtl"
        className="relative z-10 flex w-full max-w-xl max-h-[90vh] flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
              <Flame size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editItem ? 'ویرایش موجودی اول دوره فلزات و آبشده' : 'ثبت موجودی اول دوره فلزات و آبشده'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                طلا، نقره و پلاتین — آبشده شرطی، آبشده متفرقه و موجودی فلز
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto p-5 sm:p-6 space-y-4">
            {errorMsg && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* 1. Metal Selector */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                نوع فلز <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['gold', 'silver', 'platinum'] as const).map((m) => {
                  const cfg = METALS_CONFIG[m];
                  const isSelected = metal === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMetalChange(m)}
                      className={`flex items-center justify-center gap-2 rounded-2xl border py-2.5 px-3 text-xs font-black transition cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-sm'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>{cfg.label}</span>
                      <span className="font-mono text-[10px] opacity-80">({cfg.symbol})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Inventory Type Selector */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                نوع موجودی <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(['conditional_melted', 'miscellaneous_melted', 'general_metal'] as const).map((t) => {
                  const cfg = INVENTORY_TYPES_CONFIG[t];
                  const isSelected = inventoryType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setInventoryType(t)}
                      className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-right text-xs transition cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:border-amber-400 dark:bg-amber-400/20 dark:text-amber-200 font-black shadow-xs'
                          : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 font-bold'
                      }`}
                    >
                      <span className="text-xs font-extrabold">{cfg.label}</span>
                      <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-400">
                        {cfg.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Conditional Melted Fields: Stamp Number & Lab Name */}
            {inventoryType === 'conditional_melted' && (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-amber-300/70 bg-amber-50/60 p-3.5 dark:border-amber-800/60 dark:bg-amber-950/30 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره انگ (برچسب) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={stampNumber}
                    onChange={(e) => setStampNumber(e.target.value)}
                    placeholder="مثال: ۱۲۳۴۵"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نام ری‌گیری (آزمایشگاه) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    placeholder="مثال: ری‌گیری ملت"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            )}

            {/* 4. Weight & Purity */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  وزن خام (گرم) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="مثال: ۱۲۵.۴۵۰"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-black text-slate-900 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    عیار (بر پایه ۱۰۰۰) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    پایه: {currentBaseKarat}
                  </span>
                </div>
                <input
                  type="text"
                  dir="ltr"
                  value={purity}
                  onChange={(e) => setPurity(e.target.value)}
                  placeholder="مثال: ۷۵۰"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-black text-slate-900 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                {/* Preset Purity Buttons */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {METALS_CONFIG[metal].presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPurity(String(p))}
                      className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:bg-amber-100 hover:text-amber-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Converted Weight Indicator */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">
                  وزن معادل بر پایه {currentBaseKarat}:
                </span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                  {formatWeight(convertedWeight)} گرم
                </span>
              </div>
            </div>

            {/* 5. Monetary Valuation (Optional) & Date */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ارزش‌گذاری ریالی کل (اختیاری)
                </label>
                <div className="mt-1.5">
                  <PriceInput
                    value={totalAmount}
                    onValueChange={(_val, rawValue) => setTotalAmount(rawValue)}
                    placeholder="۰"
                    currencySuffix={currencySuffix}
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  در صورت درج، سند دوبل افتتاحیه (۱۱۳۰ بدهکار / ۳۱۰۰ بستانکار) صادر می‌شود.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تاریخ موجودی اولیه
                </label>
                <div className="mt-1.5">
                  <DatePicker
                    value={date}
                    onValueChange={(_iso, jalali) => setDate(jalali)}
                    disabled={submitting}
                    placeholder="انتخاب تاریخ"
                  />
                </div>
              </div>
            </div>

            {/* 6. Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                توضیحات (اختیاری)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات اضافی، محل نگهداری در گاوصندوق، شماره رسید..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-900 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Footer - Fixed */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
            >
              <Check size={16} />
              <span>{submitting ? 'در حال ثبت...' : editItem ? 'ذخیره تغییرات' : 'ثبت موجودی اولیه'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
