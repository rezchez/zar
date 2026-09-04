'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Coins, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { PriceInput } from '@/components/ui/price-input';
import { dateToJalaliString } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';

export type CoinTypeMasterItem = {
  id: string;
  name: string;
  code?: string;
  nature: string; // 'coin' | 'bullion'
  coinSubtype?: string;
  metal: string; // 'gold' | 'silver' | 'platinum'
  unitWeight: number;
  purity: number;
  description?: string;
  isActive?: boolean;
};

export type CoinInventoryEditItem = {
  id?: string;
  itemTypeId?: string;
  itemName?: string;
  nature?: string;
  coinSubtype?: string;
  metal?: string;
  quantity?: number;
  unitWeight?: number;
  purity?: number;
  unitPrice?: number;
  date?: string;
  description?: string;
};

export default function InitialCoinInventoryModal({
  isOpen,
  onClose,
  editItem,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  editItem?: CoinInventoryEditItem | null;
  onSuccess?: () => void;
}) {
  const { settings } = useAppSettings();
  const baseKarat = Number(settings.goldBaseKarat) || 750;
  const weightPrecision = Number(settings.weightDecimalPlaces) || 3;
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [coinTypes, setCoinTypes] = useState<CoinTypeMasterItem[]>([]);
  const [selectedNature, setSelectedNature] = useState<'coin' | 'bullion'>('coin');
  const [selectedItemTypeId, setSelectedItemTypeId] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [nature, setNature] = useState<string>('coin');
  const [coinSubtype, setCoinSubtype] = useState<string>('سکه تمام طرح جدید (امامی)');
  const [metal, setMetal] = useState<string>('gold');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitWeight, setUnitWeight] = useState<string>('8.136');
  const [purity, setPurity] = useState<string>('900');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [date, setDate] = useState<string>(dateToJalaliString(new Date()));
  const [description, setDescription] = useState<string>('');

  const [loadingTypes, setLoadingTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Custom Item Creation State
  const [isCreatingCustomType, setIsCreatingCustomType] = useState(false);
  const [savingCustomType, setSavingCustomType] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customNature, setCustomNature] = useState<'coin' | 'bullion'>('coin');
  const [customSubtype, setCustomSubtype] = useState('سکه تمام طرح جدید (امامی)');
  const [customMetal, setCustomMetal] = useState('gold');
  const [customWeight, setCustomWeight] = useState('1.0');
  const [customPurity, setCustomPurity] = useState('750');

  const selectItemDetails = useCallback((typeId: string, typesList: CoinTypeMasterItem[]) => {
    setSelectedItemTypeId(typeId || '');
    const found = typesList.find((t) => t.id === typeId);
    if (found) {
      setItemName(String(found.name || ''));
      setNature(String(found.nature || 'coin'));
      setCoinSubtype(String(found.coinSubtype || ''));
      setMetal(String(found.metal || 'gold'));
      setUnitWeight(String(found.unitWeight ?? '1.0'));
      setPurity(String(found.purity ?? '750'));
    } else {
      setItemName('');
    }
  }, []);

  // Load coin types from backend & sync edit or initial selection
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function initModal() {
      setLoadingTypes(true);
      try {
        const res = await fetch('/api/coin-types', { cache: 'no-store' });
        if (!res.ok || !active) return;
        const data = await res.json();
        const activeList: CoinTypeMasterItem[] = Array.isArray(data.coinTypes)
          ? data.coinTypes.filter((t: CoinTypeMasterItem) => t.isActive !== false)
          : [];

        if (!active) return;
        setCoinTypes(activeList);

        if (editItem) {
          const itemNat = (editItem.nature || 'coin') === 'bullion' ? 'bullion' : 'coin';
          setSelectedNature(itemNat);
          setSelectedItemTypeId(String(editItem.itemTypeId || ''));
          setItemName(String(editItem.itemName || ''));
          setNature(String(editItem.nature || 'coin'));
          setCoinSubtype(String(editItem.coinSubtype || ''));
          setMetal(String(editItem.metal || 'gold'));
          setQuantity(String(editItem.quantity ?? '1'));
          setUnitWeight(String(editItem.unitWeight ?? '1.0'));
          setPurity(String(editItem.purity ?? '750'));
          setUnitPrice(editItem.unitPrice ? String(editItem.unitPrice) : '');
          setDate(editItem.date || dateToJalaliString(new Date()));
          setDescription(editItem.description || '');
          setErrorMsg(null);
        } else {
          setQuantity('1');
          setUnitPrice('');
          setDate(dateToJalaliString(new Date()));
          setDescription('');
          setErrorMsg(null);

          const defaultCoin = activeList.find((t) => (t.nature || 'coin') === 'coin');
          if (defaultCoin) {
            selectItemDetails(defaultCoin.id, activeList);
          } else {
            setSelectedItemTypeId('');
            setItemName('');
          }
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoadingTypes(false);
      }
    }

    void initModal();
    return () => { active = false; };
  }, [isOpen, editItem, selectItemDetails]);

  if (!isOpen) return null;

  const filteredCoinTypes = coinTypes.filter((t) => (t.nature || 'coin') === selectedNature);

  const numQty = Math.max(0, parseFloat(quantity) || 0);
  const numWeight = Math.max(0, parseFloat(unitWeight) || 0);
  const numPurity = Math.max(0, parseFloat(purity) || 0);
  const numUnitPrice = parseLocalizedAmount(unitPrice);

  const totalWeight = numQty * numWeight;
  const totalAmount = numQty * numUnitPrice;
  const convertedWeight = baseKarat > 0 ? (totalWeight * numPurity) / baseKarat : totalWeight;

  function handleNatureChange(newNature: 'coin' | 'bullion') {
    setSelectedNature(newNature);
    const matched = coinTypes.filter((t) => (t.nature || 'coin') === newNature);
    if (matched.length > 0) {
      selectItemDetails(matched[0].id, coinTypes);
    } else {
      setSelectedItemTypeId('');
      setItemName('');
    }
  }

  function handleTypeSelect(typeId: string) {
    selectItemDetails(typeId, coinTypes);
  }

  async function handleCreateCustomType(e: React.FormEvent) {
    e.preventDefault();
    const nameStr = typeof customName === 'string' ? customName.trim() : String(customName || '').trim();
    if (!nameStr) {
      setErrorMsg('نام عنوان جدید الزامی است.');
      return;
    }

    setSavingCustomType(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/coin-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameStr,
          nature: customNature,
          coinSubtype: customNature === 'coin' ? customSubtype : '',
          metal: customMetal,
          unitWeight: parseFloat(customWeight) || 1.0,
          purity: parseFloat(customPurity) || 750,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'ثبت سکه/شمش سفارشی با خطا مواجه شد.');
        return;
      }

      if (data.coinType) {
        const updated = [...coinTypes.filter((c) => c.id !== data.coinType.id), data.coinType];
        setCoinTypes(updated);
        setSelectedNature(data.coinType.nature || 'coin');
        selectItemDetails(data.coinType.id, updated);
        setIsCreatingCustomType(false);
        setCustomName('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت سکه/شمش سفارشی.';
      setErrorMsg(msg);
    } finally {
      setSavingCustomType(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalizedItemName = typeof itemName === 'string' ? itemName.trim() : String(itemName || '').trim();

    if (!normalizedItemName) {
      setErrorMsg('انتخاب یا ورود نام سکه/شمش الزامی است.');
      return;
    }
    if (numQty <= 0) {
      setErrorMsg('تعداد باید عددی مثبت باشد.');
      return;
    }
    if (numWeight <= 0) {
      setErrorMsg('وزن واحد باید عددی مثبت باشد.');
      return;
    }
    if (numPurity <= 0 || numPurity > 1000) {
      setErrorMsg('عیار معتبر وارد کنید (بین ۱ تا ۱۰۰۰).');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Ensure we have a persistent coin_types record ID
      let effectiveItemTypeId = selectedItemTypeId;
      if (!effectiveItemTypeId) {
        // Try creating or resolving coin_type by name if not selected
        const typeRes = await fetch('/api/coin-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: normalizedItemName,
            nature,
            coinSubtype,
            metal,
            unitWeight: numWeight,
            purity: numPurity,
          }),
        });
        if (typeRes.ok) {
          const typeData = await typeRes.json();
          if (typeData.coinType?.id) {
            effectiveItemTypeId = typeData.coinType.id;
            setSelectedItemTypeId(effectiveItemTypeId);
          }
        }
      }

      const res = await fetch('/api/accounting/opening/coin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editItem?.id,
          itemTypeId: effectiveItemTypeId,
          itemName: normalizedItemName,
          nature,
          coinSubtype,
          metal,
          quantity: numQty,
          unitWeight: numWeight,
          purity: numPurity,
          unitPrice: numUnitPrice,
          date,
          description,
          baseKarat,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'ثبت موجودی اولیه انجام نشد.');
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ثبت اطلاعات.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
              <Coins size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editItem ? 'ویرایش موجودی اولیه مسکوکات/شمش' : 'افزودن موجودی اولیه مسکوکات و شمش'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ثبت و بروزرسانی موجودی پایه سکه و شمش در سیستم
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg ? (
          <div className="mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-bold text-rose-600 dark:text-rose-400">
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nature selector tabs: سکه vs شمش */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
              نوع کالا <span className="text-rose-500">*</span>
            </label>
            <div className="flex h-10 rounded-2xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => handleNatureChange('coin')}
                className={`flex-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  selectedNature === 'coin'
                    ? 'bg-amber-500 text-slate-950 shadow-xs dark:bg-amber-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                سکه
              </button>
              <button
                type="button"
                onClick={() => handleNatureChange('bullion')}
                className={`flex-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  selectedNature === 'bullion'
                    ? 'bg-amber-500 text-slate-950 shadow-xs dark:bg-amber-400'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                شمش
              </button>
            </div>
          </div>

          {/* Item Name Dropdown + Add Custom Button */}
          <div>
            <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
              {selectedNature === 'coin' ? 'نام سکه' : 'نام شمش'} <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              {filteredCoinTypes.length > 0 ? (
                <select
                  value={selectedItemTypeId}
                  onChange={(e) => handleTypeSelect(e.target.value)}
                  disabled={loadingTypes}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {filteredCoinTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.unitWeight} گرم — عیار {t.purity})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex h-10 w-full items-center rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 px-3 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {selectedNature === 'coin' ? 'هیچ نوع سکه‌ای تعریف نشده است.' : 'هیچ نوع شمشی تعریف نشده است.'}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setCustomNature(selectedNature);
                  setIsCreatingCustomType(true);
                }}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/25 dark:text-amber-300 cursor-pointer"
                title="افزودن مورد جدید"
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Inline Custom Item Creation Form */}
          <AnimatePresence>
            {isCreatingCustomType ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-2xl border border-amber-300/80 bg-amber-50/50 p-4 dark:border-amber-700/60 dark:bg-amber-950/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 dark:text-amber-200">
                    تعریف {customNature === 'coin' ? 'سکه' : 'شمش'} جدید
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingCustomType(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      نام عنوان جدید
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder={customNature === 'coin' ? 'مثلا: سکه طلا سفارشی' : 'مثلا: شمش ۲۰ گرمی سوئیسی'}
                      className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ماهیت
                    </label>
                    <div className="flex h-9 rounded-xl border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setCustomNature('coin')}
                        className={`flex-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                          customNature === 'coin'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        سکه
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomNature('bullion')}
                        className={`flex-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                          customNature === 'bullion'
                            ? 'bg-amber-500 text-slate-950 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        شمش
                      </button>
                    </div>
                  </div>

                  {customNature === 'coin' ? (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        نوع سکه
                      </label>
                      <select
                        value={customSubtype}
                        onChange={(e) => setCustomSubtype(e.target.value)}
                        className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="سکه تمام طرح جدید (امامی)">سکه تمام طرح جدید (امامی)</option>
                        <option value="سکه تمام طرح قدیم">سکه تمام طرح قدیم</option>
                        <option value="نیم سکه">نیم سکه</option>
                        <option value="ربع سکه">ربع سکه</option>
                        <option value="سکه یک گرمی">سکه یک گرمی</option>
                        <option value="نیم سکه سال پایین">نیم سکه سال پایین</option>
                        <option value="ربع سکه سال پایین">ربع سکه سال پایین</option>
                        <option value="سکه پهلوی">سکه پهلوی</option>
                        <option value="پارسیان">پارسیان</option>
                      </select>
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      جنس فلز
                    </label>
                    <select
                      value={customMetal}
                      onChange={(e) => setCustomMetal(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="gold">طلا</option>
                      <option value="silver">نقره</option>
                      <option value="platinum">پلاتین</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      وزن واحد (گرم)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={customWeight}
                      onChange={(e) => setCustomWeight(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      عیار (در هزار)
                    </label>
                    <input
                      type="number"
                      value={customPurity}
                      onChange={(e) => setCustomPurity(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={savingCustomType}
                    onClick={handleCreateCustomType}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-amber-500 px-3 text-xs font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{savingCustomType ? 'در حال ثبت...' : 'افزودن و انتخاب'}</span>
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                تعداد <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                وزن واحد (گرم) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={unitWeight}
                onChange={(e) => setUnitWeight(e.target.value)}
                required
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                عیار (در هزار) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={purity}
                onChange={(e) => setPurity(e.target.value)}
                required
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                قیمت هر واحد ({currencySuffix})
              </label>
              <PriceInput
                value={unitPrice}
                onValueChange={(_parsed, raw) => setUnitPrice(raw)}
                placeholder="۰"
                baseCurrency={effectiveCurrency}
                currencySuffix={currencySuffix}
                showWords={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-amber-50/60 p-3 dark:bg-amber-950/30">
            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                مبلغ کل
              </span>
              <span className="mt-0.5 block font-mono text-xs font-black text-amber-900 dark:text-amber-200">
                {totalAmount > 0 ? totalAmount.toLocaleString('fa-IR') : '۰'} {currencySuffix}
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                وزن کل
              </span>
              <span className="mt-0.5 block font-mono text-xs font-black text-amber-900 dark:text-amber-200">
                {totalWeight.toFixed(weightPrecision)} گرم
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-500 dark:text-slate-400">
                معادل عیار {baseKarat}
              </span>
              <span className="mt-0.5 block font-mono text-xs font-black text-amber-900 dark:text-amber-200">
                {convertedWeight.toFixed(weightPrecision)} گرم
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                تاریخ ثبت موجودی اولیه
              </label>
              <DatePicker
                value={date}
                onValueChange={(_iso, jalali) => setDate(jalali)}
                disabled={submitting}
                placeholder="انتخاب تاریخ"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                توضیحات
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات اختیاری..."
                className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-5 py-2.5 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>{submitting ? 'در حال ثبت...' : 'ذخیره موجودی اولیه'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
