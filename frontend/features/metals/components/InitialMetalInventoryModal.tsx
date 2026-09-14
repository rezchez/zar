'use client';

import { Check, Flame, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import { AssayLaboratorySelect } from '@/components/AssayLaboratorySelect';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { dateToJalaliString } from '@/lib/jalali';
import {
  INVENTORY_TYPE_LABELS,
  isLabAndStampRequired,
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
  'melted' | 'conditional' | 'miscellaneous' | 'sowaleh',
  { label: string; description: string }
> = {
  melted: {
    label: 'آبشده',
    description: 'طلای آبشده قالبی با شماره انگ و برگه ری‌گیری معتبر',
  },
  conditional: {
    label: 'شرطی',
    description: 'عیار نامشخص (ثبت موقت ۷۵۰) دارای شماره انگ و برگه ری‌گیری',
  },
  miscellaneous: {
    label: 'متفرقه',
    description: 'طلای متفرقه، مستعمل و قراضه کارگاهی بدون شرط ری‌گیری',
  },
  sowaleh: {
    label: 'سواله',
    description: 'براده، خاک و سواله کارگاهی اره‌کاری و پرداخت طلا',
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
  const [inventoryType, setInventoryType] = useState<MetalInventoryType>('melted');
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

  const isConditional = inventoryType === 'conditional' || inventoryType === 'conditional_melted';

  // Sync form state on edit or open
  useEffect(() => {
    if (!isOpen) return;

    if (editItem) {
      const isCond = editItem.inventoryType === 'conditional' || editItem.inventoryType === 'conditional_melted';
      setMetal(editItem.metal);
      setInventoryType(editItem.inventoryType);
      setWeight(String(editItem.rawWeight || ''));
      setPurity(isCond ? '750' : String(editItem.purity || '750'));
      setLabName(editItem.labName || '');
      setStampNumber(editItem.stampNumber || '');
      setTotalAmount(editItem.totalAmount ? String(editItem.totalAmount) : '');
      setDate(editItem.date || dateToJalaliString(new Date()));
      setDescription(editItem.description || '');
    } else {
      setMetal('gold');
      setInventoryType('melted');
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
    if (!editItem && !isConditional) {
      setPurity(String(METALS_CONFIG[newMetal].defaultPurity));
    }
  };

  const handleInventoryTypeChange = (t: MetalInventoryType) => {
    setInventoryType(t);
    if (t === 'conditional' || t === 'conditional_melted') {
      setPurity('750');
    }
  };

  const handlePurityChange = (val: string) => {
    const clean = val
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace('٫', '.')
      .replace(/,/g, '')
      .trim();

    if (clean === '') {
      setPurity('');
      return;
    }

    if (/^\d+\.?\d*$/.test(clean)) {
      const decimalParts = clean.split('.');
      if (decimalParts.length > 1 && decimalParts[1].length > 1) {
        return;
      }
      const num = parseFloat(clean);
      if (!isNaN(num) && num > 999.9) {
        return;
      }
      setPurity(clean);
    }
  };

  // Live converted weight calculation
  const parsedWeight = Number(weight.replace(/,/g, ''));
  const effectivePurity = isConditional ? 750 : Number(purity.replace(/,/g, ''));
  const convertedWeight =
    Number.isFinite(parsedWeight) && parsedWeight > 0 && Number.isFinite(effectivePurity) && effectivePurity > 0
      ? metalAtBaseKarat(parsedWeight, effectivePurity, currentBaseKarat, weightPrecision)
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

    if (!isConditional && (!Number.isFinite(effectivePurity) || effectivePurity <= 0 || effectivePurity > 999.9)) {
      setErrorMsg('عیار باید عددی مثبت تا حداکثر ۹۹۹.۹ باشد.');
      return;
    }

    const requiresLabAndStamp = isLabAndStampRequired(inventoryType);
    if (requiresLabAndStamp) {
      const typeLabel = INVENTORY_TYPE_LABELS[inventoryType] || 'آبشده';
      if (!stampNumber.trim()) {
        setErrorMsg(`ورود شماره انگ برای طلای ${typeLabel} الزامی است.`);
        return;
      }
      if (!labName.trim()) {
        setErrorMsg(`ورود نام ری‌گیری برای طلای ${typeLabel} الزامی است.`);
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
        purity: effectivePurity,
        baseKarat: currentBaseKarat,
        labName: requiresLabAndStamp ? labName.trim() : (labName.trim() || undefined),
        stampNumber: requiresLabAndStamp ? stampNumber.trim() : (stampNumber.trim() || undefined),
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
        className="relative z-10 flex w-full max-w-3xl max-h-[90vh] flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
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
                طلا، نقره و پلاتین — آبشده، شرطی، متفرقه و سواله
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
                نوع موجودی فلز <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['melted', 'conditional', 'miscellaneous', 'sowaleh'] as const).map((t) => {
                  const cfg = INVENTORY_TYPES_CONFIG[t];
                  const isSelected =
                    inventoryType === t ||
                    (t === 'conditional' && inventoryType === 'conditional_melted') ||
                    (t === 'miscellaneous' && (inventoryType === 'miscellaneous_melted' || inventoryType === 'general_metal'));
                  const requiresStamp = t === 'melted' || t === 'conditional';
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleInventoryTypeChange(t)}
                      className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-right text-xs transition cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:border-amber-400 dark:bg-amber-400/20 dark:text-amber-200 font-black shadow-xs ring-1 ring-amber-500/30'
                          : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300 font-bold'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-extrabold">{cfg.label}</span>
                        {requiresStamp && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
                            انگ و ری‌گیری
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-400">
                        {cfg.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Melted & Conditional Fields: Stamp Number & Lab Name (Mandatory) */}
            {isLabAndStampRequired(inventoryType) && (
              <div className="grid grid-cols-1 gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/70 p-3.5 dark:border-amber-800/70 dark:bg-amber-950/40 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    شماره انگ (برچسب) <span className="text-rose-500">* (اجباری)</span>
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نام ری‌گیری (آزمایشگاه) <span className="text-rose-500">* (اجباری)</span>
                  </label>
                  <AssayLaboratorySelect
                    value={labName}
                    onChange={(val) => setLabName(val)}
                    placeholder="انتخاب یا جستجوی ری‌گیری..."
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
                    عیار (بر پایه ۱۰۰۰) <span className="text-rose-500">* (حداکثر ۹۹۹.۹)</span>
                  </label>
                  {isConditional ? (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
                      عیار موقت ۷۵۰ (نامشخص - شرطی)
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      پایه: {currentBaseKarat}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  dir="ltr"
                  disabled={isConditional}
                  readOnly={isConditional}
                  value={isConditional ? '750' : purity}
                  onChange={(e) => handlePurityChange(e.target.value)}
                  placeholder="مثال: ۷۵۰ یا ۹۹۹.۹"
                  className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 text-left text-sm font-black focus:outline-hidden ${
                    isConditional
                      ? 'border-dashed border-amber-300 bg-amber-50/70 text-amber-950 font-black cursor-not-allowed opacity-90 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200'
                      : 'border-slate-200 bg-white text-slate-900 focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                  }`}
                />

                {/* Preset Purity Buttons or Conditional Note */}
                {!isConditional ? (
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
                ) : (
                  <p className="mt-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    * عیار طلای شرطی نامشخص است و تا زمان اعلام نتیجه ری‌گیری موقتاً ۷۵۰ ثبت می‌شود.
                  </p>
                )}
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
