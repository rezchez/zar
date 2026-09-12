'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Package,
  Plus,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import { getCurrencyDisplayName, type Currency } from '@/lib/currencies';
import {
  calculateGoodsTotalAmount,
  COMMON_GOODS_UNITS,
  GOODS_CATEGORIES,
  ALL_GOODS_CATEGORIES,
  type GoodsCategory,
  type GoodsOpeningRecord,
  type GoodsTypeRecord,
} from '@/lib/goods-inventory';
import { dateToJalaliString } from '@/lib/jalali';
import { convertRialToToman, formatNumberWithCommas } from '@/lib/money';

export type InitialGoodsInventoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingItem?: GoodsOpeningRecord | null;
};

interface MarketQuote {
  symbol: string;
  title: string;
  price: number;
  unit?: string;
}

export default function InitialGoodsInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  editingItem,
}: InitialGoodsInventoryModalProps) {
  const [goodsTypes, setGoodsTypes] = useState<GoodsTypeRecord[]>([]);
  const [selectedGoodsTypeId, setSelectedGoodsTypeId] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [category, setCategory] = useState<GoodsCategory>('resin_casting');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<string>('لیتر');

  // Currency collection states (strictly loaded from the PocketBase currencies collection)
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');

  // Add Currency modal states
  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [addCurrencyError, setAddCurrencyError] = useState('');

  // Pricing states
  const [unitPrice, setUnitPrice] = useState<string>(''); // in Toman or Rial for domestic
  const [foreignUnitPrice, setForeignUnitPrice] = useState<string>(''); // in foreign currency (e.g. USD)
  const [exchangeRate, setExchangeRate] = useState<string>(''); // in Toman (e.g. 95,000)
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);

  // Date and extra info
  const [date, setDate] = useState<string>(dateToJalaliString(new Date()));
  const [storageLocation, setStorageLocation] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load goods types presets
  useEffect(() => {
    if (!isOpen) return;
    async function loadGoodsTypes() {
      try {
        const res = await fetch('/api/goods-types', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setGoodsTypes(data.items);
          }
        }
      } catch {
        // non-blocking
      }
    }
    void loadGoodsTypes();
  }, [isOpen]);

  // Load currencies collection from PocketBase (/api/currencies)
  useEffect(() => {
    if (!isOpen) return;

    async function loadCurrencies() {
      setCurrenciesLoading(true);
      try {
        const res = await fetch('/api/currencies', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.currencies)) {
            const list: Currency[] = data.currencies;
            setCurrencies(list);

            setSelectedCurrencyId((curr) => {
              if (curr && list.some((c) => c.id === curr || c.code === curr)) {
                return curr;
              }
              if (editingItem?.currencyId && list.some((c) => c.id === editingItem.currencyId)) {
                return editingItem.currencyId;
              }
              if (editingItem?.currency) {
                const found = list.find((c) => c.code.toUpperCase() === editingItem.currency?.toUpperCase());
                if (found) return found.id;
              }
              // Default to Toman (IRT) or first available
              const irt = list.find((c) => c.code.toUpperCase() === 'IRT' || c.name.includes('تومان'));
              return irt ? irt.id : (list[0]?.id || '');
            });
          }
        }
      } catch {
        setCurrencies([]);
      } finally {
        setCurrenciesLoading(false);
      }
    }

    async function loadLiveQuotes() {
      try {
        const res = await fetch('/api/price-api/quotes', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.quotes)) {
            setQuotes(data.quotes);
          }
        }
      } catch {
        // non-blocking
      }
    }

    void loadCurrencies();
    void loadLiveQuotes();
  }, [isOpen, editingItem]);

  // Sync editing item
  useEffect(() => {
    if (editingItem) {
      setSelectedGoodsTypeId(editingItem.goodsTypeId || '');
      setItemName(editingItem.itemName || '');
      setCategory(editingItem.category || 'resin_casting');
      setQuantity(editingItem.quantity ? String(editingItem.quantity) : '');
      setUnit(editingItem.unit || 'لیتر');
      setDate(editingItem.date || dateToJalaliString(new Date()));
      setStorageLocation(editingItem.storageLocation || '');
      setSku(editingItem.sku || '');
      setDescription(editingItem.description || '');

      if (editingItem.currencyId) {
        setSelectedCurrencyId(editingItem.currencyId);
      }

      const itemCurrency = editingItem.currency ? editingItem.currency.toUpperCase() : 'IRT';
      if (itemCurrency !== 'IRT' && itemCurrency !== 'IRR') {
        // Foreign currency
        setForeignUnitPrice(editingItem.foreignUnitPrice ? String(editingItem.foreignUnitPrice) : '');
        setExchangeRate(
          editingItem.currencyRate ? String(convertRialToToman(editingItem.currencyRate)) : '',
        );
        setUnitPrice('');
      } else if (itemCurrency === 'IRR') {
        setUnitPrice(editingItem.unitPrice ? String(editingItem.unitPrice) : '');
        setForeignUnitPrice('');
        setExchangeRate('');
      } else {
        // IRT (Toman)
        setUnitPrice(
          editingItem.unitPrice ? String(convertRialToToman(editingItem.unitPrice)) : '',
        );
        setForeignUnitPrice('');
        setExchangeRate('');
      }
    } else {
      setSelectedGoodsTypeId('');
      setItemName('');
      setCategory('resin_casting');
      setQuantity('');
      setUnit('لیتر');
      setUnitPrice('');
      setForeignUnitPrice('');
      setExchangeRate('');
      setDate(dateToJalaliString(new Date()));
      setStorageLocation('');
      setSku('');
      setDescription('');
    }
    setError(null);
  }, [editingItem, isOpen]);

  // Auto-fill when a predefined goods type is picked
  const handleSelectGoodsType = (typeId: string) => {
    setSelectedGoodsTypeId(typeId);
    const found = goodsTypes.find((t) => t.id === typeId);
    if (found) {
      setItemName(found.name);
      setCategory(found.category);
      setUnit(found.unit);
      if (found.defaultUnitPrice && found.defaultUnitPrice > 0) {
        if (activeCurrency?.code === 'IRR') {
          setUnitPrice(String(found.defaultUnitPrice));
        } else {
          setUnitPrice(String(convertRialToToman(found.defaultUnitPrice)));
        }
      }
      if (found.code && !sku) {
        setSku(found.code);
      }
    }
  };

  const activeCurrency = useMemo(() => {
    return (
      currencies.find((c) => c.id === selectedCurrencyId || c.code === selectedCurrencyId) || null
    );
  }, [currencies, selectedCurrencyId]);

  const isForeign = activeCurrency ? (activeCurrency.code !== 'IRT' && activeCurrency.code !== 'IRR') : false;

  // Find live quote rate in Toman for current selected currency if available
  const liveMarketRateInToman = useMemo(() => {
    if (!isForeign || quotes.length === 0 || !activeCurrency) return null;
    const code = activeCurrency.code.toUpperCase();
    const found = quotes.find((q) => {
      const s = String(q.symbol || '').toUpperCase();
      const t = String(q.title || '').toLowerCase();
      if (code === 'USD') return s.includes('USD') || t.includes('دلار');
      if (code === 'EUR') return s.includes('EUR') || t.includes('یورو');
      if (code === 'AED') return s.includes('AED') || t.includes('درهم');
      return s === code || t.includes(code.toLowerCase());
    });
    if (!found || !found.price) return null;
    const raw = Number(found.price);
    if (raw <= 0) return null;
    if (found.unit?.includes('ریال') || raw > 200_000) {
      return Math.round(raw / 10);
    }
    return Math.round(raw);
  }, [isForeign, quotes, activeCurrency]);

  // Handle adding custom currency (matches DocumentForm in ثبت سند)
  async function handleAddCustomCurrency(e: React.FormEvent) {
    e.preventDefault();
    setAddCurrencyError('');
    const name = newCurrencyName.trim();
    const symbol = newCurrencySymbol.trim();
    const code = newCurrencyCode.trim().toUpperCase() || symbol;

    if (!name) {
      setAddCurrencyError('نام ارز الزامی است.');
      return;
    }
    if (!symbol) {
      setAddCurrencyError('نماد ارز الزامی است.');
      return;
    }
    if (!code) {
      setAddCurrencyError('کد ارز الزامی است.');
      return;
    }

    if (
      currencies.some(
        (c) =>
          c.name.toLocaleLowerCase('fa-IR') === name.toLocaleLowerCase('fa-IR') ||
          c.code.toUpperCase() === code,
      )
    ) {
      setAddCurrencyError(`ارزی با نام «${name}» یا کد «${code}» از قبل وجود دارد.`);
      return;
    }

    setAddingCurrency(true);
    try {
      const res = await fetch('/api/currencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, symbol, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'ثبت ارز انجام نشد.');
      }
      const created = data.currency as Currency;
      setCurrencies((prev) => [...prev, created]);
      setSelectedCurrencyId(created.id);
      setNewCurrencyName('');
      setNewCurrencySymbol('');
      setNewCurrencyCode('');
      setShowAddCurrencyModal(false);
    } catch (err) {
      setAddCurrencyError(err instanceof Error ? err.message : 'خطا در ثبت ارز جدید.');
    } finally {
      setAddingCurrency(false);
    }
  }

  // Numerical calculations
  const parsedQty = Math.max(0, Number(quantity.replace(/,/g, '')) || 0);
  const parsedForeignPrice = Math.max(0, parseFloat(foreignUnitPrice.replace(/,/g, '')) || 0);
  const parsedExchangeRateInToman = Math.max(0, Number(exchangeRate.replace(/,/g, '')) || 0);
  const parsedDomesticPrice = Math.max(0, Number(unitPrice.replace(/,/g, '')) || 0);

  // Financial calculations
  let calculatedForeignTotal = 0;
  let calculatedUnitPriceInRial = 0;
  let calculatedTotalAmountInRial = 0;

  if (isForeign) {
    calculatedForeignTotal = Number((parsedQty * parsedForeignPrice).toFixed(4));
    const rateInRial = parsedExchangeRateInToman * 10;
    calculatedUnitPriceInRial = Math.round(parsedForeignPrice * rateInRial);
    calculatedTotalAmountInRial = Math.round(parsedQty * calculatedUnitPriceInRial);
  } else if (activeCurrency?.code === 'IRR') {
    calculatedUnitPriceInRial = Math.round(parsedDomesticPrice);
    calculatedTotalAmountInRial = Math.round(parsedQty * calculatedUnitPriceInRial);
  } else {
    // Default IRT (Toman)
    calculatedUnitPriceInRial = Math.round(parsedDomesticPrice * 10);
    calculatedTotalAmountInRial = Math.round(parsedQty * calculatedUnitPriceInRial);
  }

  const calculatedTotalAmountInToman = convertRialToToman(calculatedTotalAmountInRial);
  const calculatedUnitPriceInToman = convertRialToToman(calculatedUnitPriceInRial);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanItemName = itemName.trim();
    if (!cleanItemName) {
      setError('نام کالا یا رزین الزامی است.');
      return;
    }

    if (parsedQty <= 0) {
      setError('مقدار یا تعداد کالا باید بزرگتر از صفر باشد.');
      return;
    }

    if (!unit.trim()) {
      setError('واحد شمارش یا سنجش الزامی است.');
      return;
    }

    if (isForeign) {
      if (parsedForeignPrice <= 0) {
        setError(`ارزش واحد ارزی (${activeCurrency?.symbol || activeCurrency?.code}) الزامی است.`);
        return;
      }
      if (parsedExchangeRateInToman <= 0) {
        setError('نرخ برابری ارز به تومان الزامی است.');
        return;
      }
    }

    setLoading(true);
    try {
      const rateInRial = isForeign ? parsedExchangeRateInToman * 10 : undefined;

      const payload = {
        id: editingItem?.id,
        goodsTypeId: selectedGoodsTypeId || undefined,
        itemName: cleanItemName,
        category,
        quantity: parsedQty,
        unit: unit.trim(),
        unitPrice: calculatedUnitPriceInRial,
        totalAmount: calculatedTotalAmountInRial,
        currency: activeCurrency?.code || 'IRT',
        currencyId: activeCurrency?.id || undefined,
        currencyRate: rateInRial,
        foreignUnitPrice: isForeign ? parsedForeignPrice : undefined,
        foreignTotalAmount: isForeign ? calculatedForeignTotal : undefined,
        date: date.trim(),
        storageLocation: storageLocation.trim(),
        sku: sku.trim(),
        description: description.trim(),
      };

      const res = await fetch('/api/accounting/opening/goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'خطا در ثبت موجودی اولیه کالا.');
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-xl max-h-[92vh] flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-5 sm:p-6 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-600 dark:bg-purple-500/25 dark:text-purple-400">
              <Package size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white sm:text-lg">
                {editingItem ? 'ویرایش موجودی اولیه رزین ریخته‌گری' : 'ثبت موجودی اولیه رزین ریخته‌گری'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                انواع رزین‌های سه‌بعدی ریخته‌گری، موم و مواد قالب‌گیری کارگاه طلاسازی (حساب ۱۱۳۰۴۰)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Quick Type Selection Preset */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                انتخاب از الگوهای پیش‌فرض صنف طلا
              </label>
              <select
                value={selectedGoodsTypeId}
                onChange={(e) => handleSelectGoodsType(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
              >
                <option value="" className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  -- کالای سفارشی / وارد کردن نام دلخواه --
                </option>
                {goodsTypes.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {t.name} ({ALL_GOODS_CATEGORIES[t.category]?.name || t.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Item Name & Category */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  نام کالا / شرح قلم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: رزین ریخته‌گری فوتون قرمز"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  دسته‌بندی انبار <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GoodsCategory)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                >
                  {Object.entries(GOODS_CATEGORIES).map(([key, meta]) => (
                    <option
                      key={key}
                      value={key}
                      className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {meta.name} ({meta.accountCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  مقدار / تعداد موجودی <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  placeholder="مثلاً: ۵"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  واحد سنجش / شمارش <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={COMMON_GOODS_UNITS.includes(unit as any) ? unit : 'other'}
                    onChange={(e) => {
                      if (e.target.value !== 'other') {
                        setUnit(e.target.value);
                      }
                    }}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                  >
                    {COMMON_GOODS_UNITS.map((u) => (
                      <option
                        key={u}
                        value={u}
                        className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      >
                        {u}
                      </option>
                    ))}
                    <option
                      value="other"
                      className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    >
                      سایر واحدها...
                    </option>
                  </select>

                  {!COMMON_GOODS_UNITS.includes(unit as any) && (
                    <input
                      type="text"
                      placeholder="واحد دستی"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-24 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Currency Selector (Directly from currencies collection with add currency [+] button) */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                نوع ارز <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedCurrencyId}
                  onChange={(e) => setSelectedCurrencyId(e.target.value)}
                  disabled={currenciesLoading || currencies.length === 0}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                >
                  {currencies.length === 0 ? (
                    <option value="">
                      {currenciesLoading ? 'در حال دریافت ارزها از کالکشن...' : 'ارزی در کالکشن ثبت نشده است'}
                    </option>
                  ) : (
                    currencies.map((curr) => (
                      <option key={curr.id} value={curr.id}>
                        {getCurrencyDisplayName(curr)} ({curr.code})
                      </option>
                    ))
                  )}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setAddCurrencyError('');
                    setShowAddCurrencyModal(true);
                  }}
                  className="flex size-[42px] shrink-0 items-center justify-center rounded-2xl bg-amber-500 font-bold text-slate-950 shadow-sm transition hover:bg-amber-400"
                  title="افزودن ارز جدید"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {/* Pricing Inputs */}
            {isForeign ? (
              /* Foreign Currency: Unit Price & Exchange Rate */
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      ارزش واحد ارزی ({activeCurrency?.symbol || activeCurrency?.code}) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder={`مثلاً: ۴۵.۵ (${activeCurrency?.symbol || activeCurrency?.code})`}
                        value={foreignUnitPrice}
                        onChange={(e) => setForeignUnitPrice(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                      />
                      <span className="pointer-events-none absolute left-3.5 top-2.5 font-mono text-xs font-bold text-slate-400">
                        {activeCurrency?.symbol || activeCurrency?.code}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                      نرخ برابری هر {activeCurrency?.name || activeCurrency?.code} به تومان <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثلاً: ۹۵,۰۰۰"
                      value={exchangeRate ? formatNumberWithCommas(exchangeRate) : ''}
                      onChange={(e) => setExchangeRate(e.target.value.replace(/,/g, ''))}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                    />

                    {/* Live Market Rate Suggestion if available */}
                    {liveMarketRateInToman && liveMarketRateInToman > 0 && (
                      <div className="mt-1.5 flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <TrendingUp size={13} className="text-emerald-500" />
                          نرخ بازار: {formatNumberWithCommas(liveMarketRateInToman)} تومان
                        </span>
                        <button
                          type="button"
                          onClick={() => setExchangeRate(String(liveMarketRateInToman))}
                          className="font-bold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline"
                        >
                          اعمال نرخ روز
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Foreign Valuation Summary Card */}
                {(parsedForeignPrice > 0 || calculatedForeignTotal > 0) && (
                  <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-800/60">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                      خلاصه محاسبات ارزی و ریالی
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <span className="text-[10px] text-slate-400">ارزش کل ارزی:</span>
                        <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">
                          {calculatedForeignTotal.toLocaleString('fa-IR')} {activeCurrency?.symbol || activeCurrency?.code}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">معادل ارزش به تومان:</span>
                        <div className="text-xs font-black text-purple-600 dark:text-purple-400 mt-0.5">
                          {formatNumberWithCommas(calculatedTotalAmountInToman)} تومان
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">ارزش ثبت در سیستم مالی:</span>
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                          {formatNumberWithCommas(calculatedTotalAmountInRial)} ریال
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Domestic Currency: IRT or IRR */
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ارزش واحد ({activeCurrency?.code === 'IRR' ? 'ریال' : 'تومان'})
                  </label>
                  <input
                    type="text"
                    placeholder={activeCurrency?.code === 'IRR' ? 'مثلاً: ۲۵,۰۰۰,۰۰۰' : 'مثلاً: ۲,۵۰۰,۰۰۰'}
                    value={unitPrice ? formatNumberWithCommas(unitPrice) : ''}
                    onChange={(e) => setUnitPrice(e.target.value.replace(/,/g, ''))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                  />
                  {parsedDomesticPrice > 0 && (
                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      معادل:{' '}
                      {activeCurrency?.code === 'IRR'
                        ? `${formatNumberWithCommas(calculatedUnitPriceInToman)} تومان`
                        : `${formatNumberWithCommas(calculatedUnitPriceInRial)} ریال`}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    ارزش کل اولیه ({activeCurrency?.code === 'IRR' ? 'ریال' : 'تومان'})
                  </label>
                  <div className="flex h-[42px] items-center rounded-2xl border border-slate-200/80 bg-slate-50 px-3.5 text-xs font-black text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white">
                    {activeCurrency?.code === 'IRR'
                      ? `${calculatedTotalAmountInRial > 0 ? formatNumberWithCommas(calculatedTotalAmountInRial) : '۰'} ریال`
                      : `${calculatedTotalAmountInToman > 0 ? formatNumberWithCommas(calculatedTotalAmountInToman) : '۰'} تومان`}
                  </div>
                  {calculatedTotalAmountInRial > 0 && (
                    <p className="mt-1 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                      معادل:{' '}
                      {activeCurrency?.code === 'IRR'
                        ? `${formatNumberWithCommas(calculatedTotalAmountInToman)} تومان`
                        : `${formatNumberWithCommas(calculatedTotalAmountInRial)} ریال`}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Date (DatePicker), Location, SKU */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تاریخ ثبت موجودی اولیه <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={date}
                  onValueChange={(_iso, jalali) => setDate(jalali)}
                  placeholder="انتخاب تاریخ ثبت"
                  calendarType="shamsi"
                  clearable={false}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  محل نگهداری / قفسه
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: قفسه A1 کارگاه"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  کد شناسه / بارکد (SKU)
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: RES-01"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                توضیحات و مشخصات تکمیلی
              </label>
              <textarea
                rows={2}
                placeholder="توضیحات یا ویژگی‌های خاص کالا..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
              />
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-purple-700 disabled:opacity-50"
            >
              <Check size={16} />
              <span>{loading ? 'در حال ثبت...' : editingItem ? 'بروزرسانی موجودی' : 'ثبت موجودی اولیه کالا'}</span>
            </button>
          </div>
        </form>

        {/* Add Currency Modal (Identical to DocumentForm component in ثبت سند) */}
        <AnimatePresence>
          {showAddCurrencyModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 text-right"
              onClick={() => setShowAddCurrencyModal(false)}
            >
              <motion.form
                onSubmit={handleAddCustomCurrency}
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <Plus size={18} /> افزودن ارز جدید
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddCurrencyModal(false)}
                    className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    <X size={18} />
                  </button>
                </div>

                {addCurrencyError && (
                  <p className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                    {addCurrencyError}
                  </p>
                )}

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نام ارز <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCurrencyName}
                    onChange={(e) => setNewCurrencyName(e.target.value)}
                    placeholder="مثال: فرانک سوئیس"
                    required
                    autoFocus
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-amber-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    نماد ارز <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCurrencySymbol}
                    onChange={(e) => setNewCurrencySymbol(e.target.value)}
                    placeholder="مثال: CHF"
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-amber-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    کد ارز (لاتین) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCurrencyCode}
                    onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
                    placeholder="مثال: CHF"
                    required
                    maxLength={16}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-amber-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 uppercase"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddCurrencyModal(false)}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={addingCurrency}
                    className="rounded-2xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md hover:bg-amber-400 disabled:opacity-60"
                  >
                    {addingCurrency ? 'در حال ثبت...' : 'افزودن ارز'}
                  </button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
