'use client';

import { Check, Package, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

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
  const [unitPrice, setUnitPrice] = useState<string>('');
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

  // Sync editing item
  useEffect(() => {
    if (editingItem) {
      setSelectedGoodsTypeId(editingItem.goodsTypeId || '');
      setItemName(editingItem.itemName || '');
      setCategory(editingItem.category || 'general_goods');
      setQuantity(editingItem.quantity ? String(editingItem.quantity) : '');
      setUnit(editingItem.unit || 'عدد');
      setUnitPrice(editingItem.unitPrice ? String(editingItem.unitPrice) : '');
      setDate(editingItem.date || dateToJalaliString(new Date()));
      setStorageLocation(editingItem.storageLocation || '');
      setSku(editingItem.sku || '');
      setDescription(editingItem.description || '');
    } else {
      setSelectedGoodsTypeId('');
      setItemName('');
      setCategory('resin_casting');
      setQuantity('');
      setUnit('لیتر');
      setUnitPrice('');
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
        setUnitPrice(String(found.defaultUnitPrice));
      }
      if (found.code && !sku) {
        setSku(found.code);
      }
    }
  };

  const parsedQty = Math.max(0, Number(quantity.replace(/,/g, '')) || 0);
  const parsedUnitPrice = Math.max(0, Number(unitPrice.replace(/,/g, '')) || 0);
  const totalAmount = calculateGoodsTotalAmount(parsedQty, parsedUnitPrice);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanItemName = itemName.trim();
    if (!cleanItemName) {
      setError('نام کالا الزامی است.');
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

    setLoading(true);
    try {
      const payload = {
        id: editingItem?.id,
        goodsTypeId: selectedGoodsTypeId || undefined,
        itemName: cleanItemName,
        category,
        quantity: parsedQty,
        unit: unit.trim(),
        unitPrice: parsedUnitPrice,
        totalAmount,
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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-purple-400"
              >
                <option value="">-- کالای سفارشی / وارد کردن نام دلخواه --</option>
                {goodsTypes.map((t) => (
                  <option key={t.id} value={t.id}>
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
                  placeholder="مثلاً: رزین ریخته‌گری فوتون"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  دسته‌بندی انبار <span className="text-red-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GoodsCategory)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
                >
                  {Object.entries(GOODS_CATEGORIES).map(([key, meta]) => (
                    <option key={key} value={key}>
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
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
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
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
                  >
                    {COMMON_GOODS_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="other">سایر واحدها...</option>
                  </select>

                  {!COMMON_GOODS_UNITS.includes(unit as any) && (
                    <input
                      type="text"
                      placeholder="واحد دستی"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-24 rounded-2xl border border-slate-200 px-3 py-2 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Unit Price & Total Valuation */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ارزش واحد (ریال)
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: ۲۵,۰۰۰,۰۰۰"
                  value={unitPrice ? formatNumberWithCommas(unitPrice) : ''}
                  onChange={(e) => setUnitPrice(e.target.value.replace(/,/g, ''))}
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
                />
                {parsedUnitPrice > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    معادل: {formatNumberWithCommas(convertRialToToman(parsedUnitPrice))} تومان
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ارزش کل اولیه (ریال)
                </label>
                <div className="flex h-[42px] items-center rounded-2xl border border-slate-200/80 bg-slate-50 px-3.5 text-xs font-black text-slate-900 dark:border-slate-800 dark:bg-slate-800/80 dark:text-white">
                  {totalAmount > 0 ? formatNumberWithCommas(totalAmount) : '۰'} ریال
                </div>
                {totalAmount > 0 && (
                  <p className="mt-1 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                    معادل: {formatNumberWithCommas(convertRialToToman(totalAmount))} تومان
                  </p>
                )}
              </div>
            </div>

            {/* Date, Location, SKU */}
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تاریخ ثبت
                </label>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="۱۴۰۳/۰۱/۰۱"
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
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
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
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
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
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
                className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 transition focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-purple-400"
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
      </div>
    </div>
  );
}
