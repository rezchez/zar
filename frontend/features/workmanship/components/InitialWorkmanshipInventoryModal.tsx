'use client';

import {
  AlertCircle,
  Coins,
  DollarSign,
  Flame,
  RefreshCw,
  Scale,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { dateToJalaliString, normalizeDigits } from '@/lib/jalali';
import { convertRialToToman, formatMoney, parseLocalizedAmount } from '@/lib/money';
import {
  DEFAULT_BASE_KARATS,
  metalAtBaseKarat,
  type PreciousMetalType,
  type WeightDecimalPlaces,
} from '@/lib/weight';
import {
  COMMON_WORKMANSHIP_PRESETS,
  calculateConvertedWeight,
  calculateFormulaTotalAmount,
  calculateTotalWage,
  type WageMode,
  type WorkmanshipOpeningRecord,
} from '@/lib/workmanship-inventory';

export interface InitialWorkmanshipInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editItem?: WorkmanshipOpeningRecord | null;
}

interface CurrencyOption {
  id: string;
  code: string;
  name: string;
  symbol: string;
  exchangeRate?: number;
  rate?: number;
}

const METAL_PRESETS: Record<
  PreciousMetalType,
  { label: string; symbol: string; defaultPurity: number; purityChips: number[] }
> = {
  gold: {
    label: 'طلا',
    symbol: 'Au',
    defaultPurity: 750,
    purityChips: [750, 740, 705, 875, 900],
  },
  silver: {
    label: 'نقره',
    symbol: 'Ag',
    defaultPurity: 925,
    purityChips: [925, 999, 900, 840],
  },
  platinum: {
    label: 'پلاتین',
    symbol: 'Pt',
    defaultPurity: 800,
    purityChips: [800, 950, 900, 850],
  },
};

export default function InitialWorkmanshipInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  editItem,
}: InitialWorkmanshipInventoryModalProps) {
  const { settings, formatWeight } = useAppSettings();
  const weightPrecision = (Number(settings.weightDecimalPlaces) || 3) as WeightDecimalPlaces;
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [metal, setMetal] = useState<PreciousMetalType>('gold');
  const [quantity, setQuantity] = useState('1');
  const [rawWeight, setRawWeight] = useState('');
  const [purity, setPurity] = useState('750');
  const [wage, setWage] = useState('');
  const [wageMode, setWageMode] = useState<WageMode>('per_gram');
  const [wageCurrencyId, setWageCurrencyId] = useState<string>('');
  const [wageCurrencyRate, setWageCurrencyRate] = useState<string>('');
  const [metalPrice, setMetalPrice] = useState('');
  const [profitPercentage, setProfitPercentage] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [isManualTotalOverridden, setIsManualTotalOverridden] = useState(false);

  // Currencies & Storage
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [currencyAmount, setCurrencyAmount] = useState('');
  const [storageLocations, setStorageLocations] = useState<{ id: string; name: string }[]>([]);
  const [storageLocation, setStorageLocation] = useState('');

  // Date & Description
  const [date, setDate] = useState<string>(dateToJalaliString(new Date()));
  const [description, setDescription] = useState('');

  // Base karat resolution
  const currentBaseKarat = useMemo(() => {
    if (metal === 'gold') return Number(settings.goldBaseKarat) || DEFAULT_BASE_KARATS.gold;
    if (metal === 'silver') return Number(settings.silverBaseKarat) || DEFAULT_BASE_KARATS.silver;
    if (metal === 'platinum') return Number(settings.platinumBaseKarat) || DEFAULT_BASE_KARATS.platinum;
    return 750;
  }, [metal, settings.goldBaseKarat, settings.silverBaseKarat, settings.platinumBaseKarat]);

  // Load currencies and locations
  useEffect(() => {
    if (!isOpen) return;

    async function loadAuxData() {
      try {
        const [currRes, locRes] = await Promise.allSettled([
          fetch('/api/currencies'),
          fetch('/api/storage-locations'),
        ]);

        if (currRes.status === 'fulfilled' && currRes.value.ok) {
          const cData = await currRes.value.json();
          if (Array.isArray(cData.currencies)) {
            setCurrencies(cData.currencies);
          }
        }

        if (locRes.status === 'fulfilled' && locRes.value.ok) {
          const lData = await locRes.value.json();
          if (Array.isArray(lData.items)) {
            setStorageLocations(
              lData.items.map((i: any) => ({
                id: String(i.id || ''),
                name: String(i.name || i.title || ''),
              }))
            );
          }
        }
      } catch {
        // Non-blocking
      }
    }

    void loadAuxData();
  }, [isOpen]);

  // Lock body scroll and listen for Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  // Sync state on open or edit
  useEffect(() => {
    if (!isOpen) return;

    if (editItem) {
      setName(editItem.name || '');
      setMetal(editItem.metal || 'gold');
      setQuantity(String(editItem.quantity || 1));
      setRawWeight(editItem.rawWeight ? String(editItem.rawWeight) : '');
      setPurity(String(editItem.purity || 750));
      setWage(editItem.wage ? String(editItem.wage) : '');
      setWageMode(editItem.wageMode || 'per_gram');
      setWageCurrencyId(editItem.wageCurrencyId || '');
      setWageCurrencyRate(
        editItem.wageCurrencyRate
          ? String(effectiveCurrency === 'IRT' ? convertRialToToman(editItem.wageCurrencyRate) : editItem.wageCurrencyRate)
          : '',
      );
      setMetalPrice(editItem.metalPrice ? String(editItem.metalPrice) : '');
      setProfitPercentage(editItem.profitPercentage ? String(editItem.profitPercentage) : '');
      setDiscountAmount(editItem.discountAmount ? String(editItem.discountAmount) : '');
      setTotalAmount(editItem.totalAmount ? String(editItem.totalAmount) : '');
      setIsManualTotalOverridden(Boolean(editItem.totalAmount));
      setSelectedCurrencyId(editItem.currencyId || '');
      setCurrencyAmount(editItem.currencyAmount ? String(editItem.currencyAmount) : '');
      setStorageLocation(editItem.storageLocation || '');
      setDate(editItem.date || dateToJalaliString(new Date()));
      setDescription(editItem.description || '');
    } else {
      setName('');
      setMetal('gold');
      setQuantity('1');
      setRawWeight('');
      setPurity(String(METAL_PRESETS.gold.defaultPurity));
      setWage('');
      setWageMode('per_gram');
      setWageCurrencyId('');
      setWageCurrencyRate('');
      setMetalPrice('');
      setProfitPercentage('');
      setDiscountAmount('');
      setTotalAmount('');
      setIsManualTotalOverridden(false);
      setSelectedCurrencyId('');
      setCurrencyAmount('');
      setStorageLocation('');
      setDate(dateToJalaliString(new Date()));
      setDescription('');
    }
    setErrorMsg(null);
  }, [isOpen, editItem, effectiveCurrency]);

  // Switch metal
  const handleMetalChange = (newMetal: PreciousMetalType) => {
    setMetal(newMetal);
    if (!editItem) {
      setPurity(String(METAL_PRESETS[newMetal].defaultPurity));
    }
  };

  // Wage Currency resolution
  const selectedWageCurrency = useMemo(() => {
    return currencies.find((c) => c.id === wageCurrencyId) || null;
  }, [currencies, wageCurrencyId]);

  const isForeignWage = Boolean(selectedWageCurrency);

  // Parsed numeric values
  const numWeight = useMemo(() => {
    const raw = normalizeDigits(rawWeight).replace(/,/g, '');
    const v = parseFloat(raw);
    return isNaN(v) || v < 0 ? 0 : v;
  }, [rawWeight]);

  const numQuantity = useMemo(() => {
    const raw = normalizeDigits(quantity).replace(/,/g, '');
    const v = parseInt(raw, 10);
    return isNaN(v) || v <= 0 ? 1 : v;
  }, [quantity]);

  const numPurity = useMemo(() => {
    const raw = normalizeDigits(purity).replace(/,/g, '');
    const v = parseFloat(raw);
    return isNaN(v) || v <= 0 ? currentBaseKarat : v;
  }, [purity, currentBaseKarat]);

  const numWage = useMemo(() => {
    if (isForeignWage || wageMode === 'percentage') {
      const raw = normalizeDigits(wage).replace(/,/g, '');
      const v = parseFloat(raw);
      return isNaN(v) || v < 0 ? 0 : v;
    }
    return parseLocalizedAmount(wage);
  }, [wage, isForeignWage, wageMode]);

  const numWageCurrencyRate = useMemo(() => {
    return parseLocalizedAmount(wageCurrencyRate);
  }, [wageCurrencyRate]);

  const numMetalPrice = useMemo(() => {
    return parseLocalizedAmount(metalPrice);
  }, [metalPrice]);

  const numProfitPercentage = useMemo(() => {
    const raw = normalizeDigits(profitPercentage).replace(/,/g, '');
    const v = parseFloat(raw);
    return isNaN(v) || v < 0 ? 0 : v;
  }, [profitPercentage]);

  const numDiscount = useMemo(() => {
    return parseLocalizedAmount(discountAmount);
  }, [discountAmount]);

  // Derived Calculations
  const calculatedConvertedWeight = useMemo(() => {
    return calculateConvertedWeight(numWeight, numPurity, currentBaseKarat, weightPrecision);
  }, [numWeight, numPurity, currentBaseKarat, weightPrecision]);

  // Total wage in selected currency (could be IRR or foreign currency like USD)
  const calculatedTotalWageInSelectedCurrency = useMemo(() => {
    return calculateTotalWage(
      numWage,
      wageMode,
      numWeight,
      numQuantity,
      isForeignWage,
      numMetalPrice,
      calculatedConvertedWeight,
    );
  }, [numWage, wageMode, numWeight, numQuantity, isForeignWage, numMetalPrice, calculatedConvertedWeight]);

  // Total wage converted to base currency (IRR) for the valuation formula
  const calculatedTotalWageBase = useMemo(() => {
    if (!isForeignWage) {
      return calculatedTotalWageInSelectedCurrency;
    }
    if (numWageCurrencyRate > 0) {
      const rate = effectiveCurrency === 'IRT' ? numWageCurrencyRate * 10 : numWageCurrencyRate;
      return Math.round(calculatedTotalWageInSelectedCurrency * rate);
    }
    return 0;
  }, [isForeignWage, calculatedTotalWageInSelectedCurrency, numWageCurrencyRate, effectiveCurrency]);

  const formulaTotalAmount = useMemo(() => {
    return calculateFormulaTotalAmount(
      calculatedConvertedWeight,
      numMetalPrice,
      calculatedTotalWageBase,
      numProfitPercentage,
      numDiscount,
    );
  }, [calculatedConvertedWeight, numMetalPrice, calculatedTotalWageBase, numProfitPercentage, numDiscount]);

  // Auto-fill total amount if not manually overridden
  useEffect(() => {
    if (!isManualTotalOverridden && formulaTotalAmount > 0) {
      setTotalAmount(String(formulaTotalAmount));
    }
  }, [formulaTotalAmount, isManualTotalOverridden]);

  // Apply formula total button
  const handleApplyFormulaTotal = () => {
    setIsManualTotalOverridden(false);
    setTotalAmount(formulaTotalAmount > 0 ? String(formulaTotalAmount) : '');
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('لطفاً نام مصنوع یا کالای ساخته شده را وارد کنید.');
      return;
    }
    if (numWeight <= 0) {
      setErrorMsg('وزن کل کارساخته باید عددی بزرگتر از صفر باشد.');
      return;
    }
    if (numQuantity <= 0) {
      setErrorMsg('تعداد اقلام باید حداقل ۱ عدد باشد.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const selectedCurr = currencies.find((c) => c.id === selectedCurrencyId);
    const wageRateInRial = numWageCurrencyRate > 0
      ? (effectiveCurrency === 'IRT' ? numWageCurrencyRate * 10 : numWageCurrencyRate)
      : 0;

    const payload = {
      ...(editItem?.id ? { id: editItem.id } : {}),
      name: name.trim(),
      metal,
      quantity: numQuantity,
      rawWeight: numWeight,
      purity: numPurity,
      baseKarat: currentBaseKarat,
      convertedWeight: calculatedConvertedWeight,
      wage: numWage,
      wageMode,
      wageCurrencyId: wageCurrencyId || undefined,
      wageCurrencyRate: wageRateInRial,
      wageCurrencyAmount: isForeignWage ? calculatedTotalWageInSelectedCurrency : 0,
      totalWage: calculatedTotalWageBase,
      metalPrice: numMetalPrice,
      profitPercentage: numProfitPercentage,
      discountAmount: numDiscount,
      totalAmount: totalAmount ? parseLocalizedAmount(totalAmount) : formulaTotalAmount,
      currencyId: selectedCurrencyId || (isForeignWage && !selectedCurrencyId ? wageCurrencyId : undefined),
      currencyCode: selectedCurr?.code || (isForeignWage && !selectedCurrencyId ? selectedWageCurrency?.code : undefined),
      currencySymbol: selectedCurr?.symbol || (isForeignWage && !selectedCurrencyId ? selectedWageCurrency?.symbol : undefined),
      currencyAmount: currencyAmount
        ? parseLocalizedAmount(currencyAmount)
        : (isForeignWage && !currencyAmount ? calculatedTotalWageInSelectedCurrency : 0),
      storageLocation: storageLocation.trim() || undefined,
      description: description.trim(),
      date,
    };

    try {
      const res = await fetch('/api/accounting/opening/workmanship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'خطا در ذخیره اطلاعات');
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطای غیرمنتظره رخ داد.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Sparkles size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                {editItem ? 'ویرایش موجودی اول دوره کارساخته' : 'ثبت موجودی اول دوره کارساخته'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                ثبت اقلام طلای ساخته‌شده، نقره و پلاتین همراه با اجرت و وزن معادل
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="بستن"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-xs">
            {/* Form Error Banner */}
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs font-bold text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}
          {/* Section 1: Item Name & Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
              نام کالا / مصنوع <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: النگو دامله، دستبند کارتیر، انگشتر سولیتر..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
              required
            />
            {/* Quick Name Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-400">پیشنهادات سریع:</span>
              {COMMON_WORKMANSHIP_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setName(preset)}
                  className={`rounded-lg px-2 py-0.5 text-[11px] font-bold transition ${
                    name === preset
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Section 2: Metal & Karat */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Metal Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                نوع فلز <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['gold', 'silver', 'platinum'] as PreciousMetalType[]).map((m) => {
                  const cfg = METAL_PRESETS[m];
                  const isSelected = metal === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMetalChange(m)}
                      className={`flex items-center justify-center gap-1.5 rounded-2xl border py-2.5 text-xs font-bold transition ${
                        isSelected
                          ? m === 'gold'
                            ? 'border-amber-400 bg-amber-500/15 text-amber-900 dark:border-amber-500 dark:text-amber-300'
                            : m === 'silver'
                            ? 'border-slate-400 bg-slate-200/80 text-slate-900 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-100'
                            : 'border-cyan-400 bg-cyan-500/15 text-cyan-900 dark:border-cyan-500 dark:text-cyan-300'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                      }`}
                    >
                      <span>{cfg.label}</span>
                      <span className="text-[10px] opacity-70">({cfg.symbol})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Purity (عيار) & Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                  عیار کالا <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] font-bold text-slate-400">
                  مبنای تبدیل: {currentBaseKarat}
                </span>
              </div>
              <input
                type="number"
                step="any"
                value={purity}
                onChange={(e) => setPurity(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
                required
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {METAL_PRESETS[metal].purityChips.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setPurity(String(chip))}
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                      purity === String(chip)
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Quantity & Weight */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                تعداد (عدد) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
                required
              />
            </div>

            {/* Weight */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                وزن کل به گرم <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={rawWeight}
                onChange={(e) => setRawWeight(e.target.value)}
                placeholder="0.000"
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
                required
              />
            </div>

            {/* Converted Weight Display */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                وزن معادل پایه ({currentBaseKarat})
              </label>
              <div className="flex h-[42px] items-center justify-between rounded-2xl border border-amber-200/80 bg-amber-50/40 px-3.5 text-xs font-black text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <span>معادل عیار پایه:</span>
                <span className="font-mono text-sm font-black">
                  {formatWeight(calculatedConvertedWeight)} گرم
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Wage Calculation */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  محاسبه اجرت ساخت
                </span>
                <select
                  value={wageCurrencyId}
                  onChange={(e) => setWageCurrencyId(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 outline-none transition focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">پیش‌فرض سیستم ({currencySuffix})</option>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.code} ({c.symbol || c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setWageMode('per_gram')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                    wageMode === 'per_gram'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  به ازای هر گرم
                </button>
                <button
                  type="button"
                  onClick={() => setWageMode('per_item')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                    wageMode === 'per_item'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  به ازای هر عدد
                </button>
                <button
                  type="button"
                  onClick={() => setWageMode('percentage')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-black transition ${
                    wageMode === 'percentage'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  درصدی (٪)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                  {wageMode === 'percentage'
                    ? 'درصد اجرت ساخت (٪)'
                    : `نرخ اجرت (${wageMode === 'per_gram' ? 'هر گرم' : 'هر عدد'}) (${isForeignWage ? (selectedWageCurrency?.symbol || selectedWageCurrency?.code) : currencySuffix})`}
                </label>
                {wageMode === 'percentage' ? (
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max="100"
                      value={wage}
                      onChange={(e) => setWage(e.target.value)}
                      placeholder="مثال: ۷ یا ۱۲.۵"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800 pl-10 text-left font-mono"
                      dir="ltr"
                    />
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      ٪
                    </span>
                  </div>
                ) : isForeignWage ? (
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={wage}
                      onChange={(e) => setWage(e.target.value)}
                      placeholder="مثال: ۵.۵"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800 pl-10 text-left font-mono"
                      dir="ltr"
                    />
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {selectedWageCurrency?.symbol || selectedWageCurrency?.code}
                    </span>
                  </div>
                ) : (
                  <PriceInput
                    value={wage}
                    onValueChange={(_v, raw) => setWage(raw)}
                    placeholder="مبلغ اجرت..."
                    className="w-full rounded-2xl"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                  مجموع اجرت کالا {isForeignWage && `(${selectedWageCurrency?.symbol || selectedWageCurrency?.code})`}
                </label>
                <div className="flex h-[42px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <span className="text-[11px] text-slate-400">
                    {wageMode === 'percentage'
                      ? numMetalPrice > 0
                        ? `${numWage}٪ از ارزش فلز خام`
                        : 'نیازمند نرخ فلز خام (بخش ۵)'
                      : wageMode === 'per_gram'
                      ? `${numWeight} گرم × نرخ`
                      : `${numQuantity} عدد × نرخ`}
                  </span>
                  <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                    {isForeignWage ? (
                      `${calculatedTotalWageInSelectedCurrency.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${selectedWageCurrency?.symbol || selectedWageCurrency?.code}`
                    ) : (
                      `${formatMoney(
                        effectiveCurrency === 'IRT'
                          ? convertRialToToman(calculatedTotalWageInSelectedCurrency)
                          : calculatedTotalWageInSelectedCurrency,
                      )} ${currencySuffix}`
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* If foreign wage, show exchange rate input and base equivalent */}
            {isForeignWage && (
              <div className="mt-3 grid grid-cols-1 gap-4 border-t border-slate-200/60 pt-3 dark:border-slate-700/50 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                    نرخ برابری هر {selectedWageCurrency?.name || selectedWageCurrency?.code} به {currencySuffix} (اختیاری جهت ارزش‌گذاری)
                  </label>
                  <PriceInput
                    value={wageCurrencyRate}
                    onValueChange={(_v, raw) => setWageCurrencyRate(raw)}
                    placeholder={`نرخ تبدیل به ${currencySuffix}...`}
                    className="w-full rounded-2xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                    معادل ریالی/تومانی اجرت در ارزش‌گذاری
                  </label>
                  <div className="flex h-[42px] items-center justify-between rounded-2xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {calculatedTotalWageBase > 0 ? 'محاسبه شده در فرمول' : 'بدون تبدیل به ریال'}
                    </span>
                    <span className="font-mono text-sm font-black text-slate-700 dark:text-slate-300">
                      {formatMoney(
                        effectiveCurrency === 'IRT'
                          ? convertRialToToman(calculatedTotalWageBase)
                          : calculatedTotalWageBase,
                      )}{' '}
                      {currencySuffix}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Valuation & Pricing (Optional) */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <span className="mb-3 block text-xs font-black text-slate-800 dark:text-slate-200">
              ارزش‌گذاری و قیمت‌گذاری اولیه (اختیاری)
            </span>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Metal Price */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  نرخ هر گرم فلز خام ({currencySuffix})
                </label>
                <PriceInput
                  value={metalPrice}
                  onValueChange={(_v, raw) => setMetalPrice(raw)}
                  placeholder="مظنه / نرخ هر گرم"
                  className="w-full rounded-xl"
                />
              </div>

              {/* Profit % */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  درصد سود (%)
                </label>
                <input
                  type="number"
                  step="any"
                  value={profitPercentage}
                  onChange={(e) => setProfitPercentage(e.target.value)}
                  placeholder="مثال: ۷"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
                />
              </div>

              {/* Discount */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  مبلغ تخفیف ({currencySuffix})
                </label>
                <PriceInput
                  value={discountAmount}
                  onValueChange={(_v, raw) => setDiscountAmount(raw)}
                  placeholder="مبلغ تخفیف"
                  className="w-full rounded-xl"
                />
              </div>
            </div>

            {/* Total Amount & Formula Suggestion */}
            <div className="mt-3 flex flex-col gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/50 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">
                  مبلغ برآورد فرمول:
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white">
                  {formatMoney(
                    effectiveCurrency === 'IRT'
                      ? convertRialToToman(formulaTotalAmount)
                      : formulaTotalAmount,
                  )}{' '}
                  {currencySuffix}
                </span>
                {isManualTotalOverridden && (
                  <button
                    type="button"
                    onClick={handleApplyFormulaTotal}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline dark:text-amber-400"
                  >
                    <RefreshCw size={12} />
                    بازنشانی به فرمول
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <label className="shrink-0 text-xs font-black text-slate-700 dark:text-slate-300">
                  ارزش کل نهایی ({currencySuffix}):
                </label>
                <PriceInput
                  value={totalAmount}
                  onValueChange={(_v, raw) => {
                    setTotalAmount(raw);
                    setIsManualTotalOverridden(true);
                  }}
                  placeholder="مبلغ ارزش کل"
                  className="w-48 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Section 6: Currency & Storage Location */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Currency Select */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                ارز مرتبط (اختیاری)
              </label>
              <select
                value={selectedCurrencyId}
                onChange={(e) => setSelectedCurrencyId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-amber-400"
              >
                <option value="">پیش‌فرض سیستم ({currencySuffix})</option>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.code} ({c.symbol || c.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Foreign Currency Amount */}
            {selectedCurrencyId && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  مقدار ارزی
                </label>
                <PriceInput
                  value={currencyAmount}
                  onValueChange={(_v, raw) => setCurrencyAmount(raw)}
                  placeholder="مقدار ارز خارجی..."
                  className="w-full rounded-2xl"
                />
              </div>
            )}

            {/* Storage Location */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                محل نگهداری / ویترین / گاوصندوق
              </label>
              {storageLocations.length > 0 ? (
                <select
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-amber-400"
                >
                  <option value="">انتخاب محل نگهداری...</option>
                  {storageLocations.map((loc) => (
                    <option key={loc.id || loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="مثال: گاوصندوق اصلی، ویترین ۱"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
                />
              )}
            </div>
          </div>

          {/* Section 7: Date & Description */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                تاریخ ثبت سند <span className="text-rose-500">*</span>
              </label>
              <DatePicker value={date} onValueChange={(_iso, jalali) => setDate(jalali)} />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                توضیحات و مشخصات تکمیلی
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات اختیاری، نام سازنده، مدل و ویژگی‌ها..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
              />
            </div>
          </div>
          </div>

          {/* Modal Action Buttons - Fixed Footer */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-2.5 text-xs font-black text-slate-950 shadow-md transition hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              <span>{editItem ? 'بروزرسانی ردیف کارساخته' : 'ثبت موجودی اولیه کارساخته'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
