'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Database,
  Diamond,
  Gem,
  Plus,
  Scale,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  caratsToGrams,
  gramsToCarats,
  type EtiquetteMountedStone,
  type EtiquetteType,
} from '@/lib/etiquette';
import { useAppSettings } from '@/src/components/SettingsProvider';

export interface MountedStonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  stones: EtiquetteMountedStone[];
  onSave: (stones: EtiquetteMountedStone[]) => void;
  etiquetteType?: EtiquetteType;
}

const JEWELRY_POPULAR_STONES = [
  'برلیان (تراش گرد)',
  'الماس باگت',
  'الماس مارکیز',
  'الماس پرنسس',
  'زمرد کلمبیا',
  'یاقوت برمه',
  'مروارید اصل',
];

const GEMSTONE_POPULAR_STONES = [
  'یاقوت سرخ (Ruby)',
  'یاقوت کبود (Sapphire)',
  'زمرد طبیعی',
  'فیروزه نیشابور',
  'عقیق یمانی',
  'توپاز سوئیسی',
  'زیرکونیا / اتمی',
  'آمتیست',
];

export default function MountedStonesModal({
  isOpen,
  onClose,
  stones: initialStones,
  onSave,
  etiquetteType = 'gemstone',
}: MountedStonesModalProps) {
  const { formatMoney, formatWeight } = useAppSettings();

  // Local draft stones list
  const [localStones, setLocalStones] = useState<EtiquetteMountedStone[]>([]);

  // Existing Gemstone Inventory from /api/gemstones
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Sync initial stones on modal open
  useEffect(() => {
    if (isOpen) {
      setLocalStones(JSON.parse(JSON.stringify(initialStones || [])));
    }
  }, [isOpen, initialStones]);

  // Load gemstones inventory
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchInventory = async () => {
      setInventoryLoading(true);
      try {
        const res = await fetch('/api/gemstones', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data?.items)) {
            setInventoryList(data.items);
          }
        }
      } catch (e) {
        console.error('Failed to load gemstone inventory:', e);
      } finally {
        if (isMounted) setInventoryLoading(false);
      }
    };

    void fetchInventory();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const popularChips =
    etiquetteType === 'jewelry' ? JEWELRY_POPULAR_STONES : GEMSTONE_POPULAR_STONES;

  // Filter inventory
  const filteredInventory = inventoryList.filter((item) => {
    if (!pickerSearch.trim()) return true;
    const q = pickerSearch.trim().toLowerCase();
    const tradeName = (item.trade_name || item.name || '').toLowerCase();
    const invCode = (item.inventory_code || '').toLowerCase();
    const variety = (item.variety || '').toLowerCase();
    const location = (item.storage_location || '').toLowerCase();
    return (
      tradeName.includes(q) || invCode.includes(q) || variety.includes(q) || location.includes(q)
    );
  });

  // Add Free-form Stone Row
  const handleAddStone = (name: string = 'سنگ') => {
    const defaultName =
      name !== 'سنگ'
        ? name
        : etiquetteType === 'jewelry'
        ? 'برلیان (تراش گرد)'
        : 'یاقوت سرخ';

    const newStone: EtiquetteMountedStone = {
      id: `stn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: defaultName,
      shape: 'round',
      quantity: 1,
      weightCarat: 0.2,
      weightGram: caratsToGrams(0.2),
      unitPrice: 0,
      totalPrice: 0,
      isDeducted: true,
      isFromInventory: false,
    };
    setLocalStones([...localStones, newStone]);
  };

  // Add Stone from Existing Inventory
  const handleSelectFromInventory = (invItem: any) => {
    const rawCarat = Number(invItem.weight_ct) || 0;
    const rawGram = Number(invItem.weight_g) || caratsToGrams(rawCarat);
    const costPerCt = Number(invItem.cost_per_ct) || 0;

    const newStone: EtiquetteMountedStone = {
      id: `inv_${invItem.id}_${Date.now()}`,
      gemstoneInventoryId: invItem.id,
      gemstoneTypeId: invItem.gemstone_type_id || undefined,
      name: invItem.trade_name || invItem.name || 'سنگ موجود در انبار',
      shape: invItem.shape || 'round',
      quantity: Math.max(1, Number(invItem.quantity) || 1),
      weightCarat: rawCarat,
      weightGram: rawGram,
      unitPrice: costPerCt,
      totalPrice: Math.round(costPerCt * rawCarat),
      isDeducted: true,
      isFromInventory: true,
      inventoryCode: invItem.inventory_code || undefined,
      certificateNumber: invItem.certificate_number || undefined,
    };

    setLocalStones([...localStones, newStone]);
    setShowInventoryPicker(false);
  };

  // Update stone field
  const handleUpdateStone = (
    index: number,
    field: keyof EtiquetteMountedStone,
    value: any,
  ) => {
    const updated = [...localStones];
    const current = { ...updated[index] };

    if (field === 'weightCarat') {
      const ct = Number(value) || 0;
      current.weightCarat = ct;
      current.weightGram = caratsToGrams(ct);
      if (current.unitPrice > 0) {
        current.totalPrice = Math.round(current.unitPrice * ct);
      }
    } else if (field === 'weightGram') {
      const g = Number(value) || 0;
      current.weightGram = g;
      current.weightCarat = gramsToCarats(g);
      if (current.unitPrice > 0) {
        current.totalPrice = Math.round(current.unitPrice * current.weightCarat);
      }
    } else if (field === 'unitPrice') {
      const p = Number(value) || 0;
      current.unitPrice = p;
      current.totalPrice = Math.round(p * (current.weightCarat || 1));
    } else {
      (current as any)[field] = value;
    }

    updated[index] = current;
    setLocalStones(updated);
  };

  const handleRemoveStone = (index: number) => {
    setLocalStones(localStones.filter((_, i) => i !== index));
  };

  // Summaries
  let totalCarat = 0;
  let totalDeductedGram = 0;
  let totalStoneCount = 0;
  let totalStonePrice = 0;

  for (const s of localStones) {
    totalCarat += Number(s.weightCarat || 0);
    totalStoneCount += Number(s.quantity || 1);
    totalStonePrice += Number(s.totalPrice || 0);
    if (s.isDeducted) {
      totalDeductedGram += Number(s.weightGram || 0);
    }
  }

  const handleApply = () => {
    onSave(localStones);
    onClose();
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {etiquetteType === 'jewelry' ? <Diamond size={20} /> : <Gem size={20} />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {etiquetteType === 'jewelry'
                  ? 'مدیریت و سوار کردن جواهرات و برلیان'
                  : 'مدیریت و سوار کردن سنگ‌ها و نگین‌ها'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                افزودن انواع مختلف سنگ روی اتیکت، محاسبه قیراط، کسر از طلا و انتخاب از انبار گوهرها
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Action Row: Quick Add & Inventory Picker */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40">
            <div>
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                سنگ‌های پرکاربرد (افزودن سریع):
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {popularChips.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleAddStone(name)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <Plus size={12} className="text-amber-500" />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInventoryPicker(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-black rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 transition cursor-pointer shadow-xs"
              >
                <Database size={14} className="text-amber-400 dark:text-amber-600" />
                <span>انتخاب از موجودی سنگ‌ها ({inventoryList.length} بسته)</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddStone()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition cursor-pointer shadow-xs"
              >
                <Plus size={15} />
                <span>افزودن سنگ آزاد</span>
              </button>
            </div>
          </div>

          {/* List of Stones */}
          {localStones.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <Sparkles size={32} className="text-slate-400 dark:text-slate-600 mb-2" />
              <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                هنوز هیچ سنگی روی این اتیکت سوار نشده است.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                برای افزودن، از چیپ‌های بالا استفاده کنید یا سنگ مورد نظر را از انبار گوهرها انتخاب نمایید.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {localStones.map((stone, idx) => (
                <div
                  key={stone.id || idx}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800/40 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={stone.name}
                        onChange={(e) => handleUpdateStone(idx, 'name', e.target.value)}
                        placeholder="نام و نوع سنگ..."
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-hidden"
                      />
                      {stone.isFromInventory && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                          <Check size={10} />
                          انبار ({stone.inventoryCode || 'کد انبار'})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={stone.isDeducted}
                          onChange={(e) => handleUpdateStone(idx, 'isDeducted', e.target.checked)}
                          className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 h-4 w-4"
                        />
                        <span>کسر از وزن طلا</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveStone(idx)}
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                        title="حذف این سنگ"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Inputs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        تعداد نگین
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={stone.quantity || ''}
                        onChange={(e) =>
                          handleUpdateStone(idx, 'quantity', Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        وزن (قیراط)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={stone.weightCarat || ''}
                        onChange={(e) => handleUpdateStone(idx, 'weightCarat', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        معادل به گرم
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={stone.weightGram || ''}
                        onChange={(e) => handleUpdateStone(idx, 'weightGram', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        قیمت هر قیراط (ریال)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={stone.unitPrice || ''}
                        onChange={(e) => handleUpdateStone(idx, 'unitPrice', e.target.value)}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 text-center"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        قیمت کل سنگ
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={stone.totalPrice || ''}
                        onChange={(e) =>
                          handleUpdateStone(idx, 'totalPrice', Math.max(0, Number(e.target.value) || 0))
                        }
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Summary & Actions */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
            <div>
              <span>تعداد کل نگین‌ها: </span>
              <span className="font-black text-amber-600 dark:text-amber-400">
                {totalStoneCount} عدد
              </span>
            </div>
            <div>
              <span>وزن قیراطی: </span>
              <span className="font-black text-amber-600 dark:text-amber-400">
                {totalCarat.toFixed(2)} ct
              </span>
            </div>
            <div>
              <span>کسر از طلا: </span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">
                {totalDeductedGram.toFixed(3)} گرم
              </span>
            </div>
            <div>
              <span>ارزش سنگ‌ها: </span>
              <span className="font-black text-slate-900 dark:text-white">
                {formatMoney(totalStonePrice)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md transition cursor-pointer"
            >
              تأیید و اعمال روی اتیکت
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: Gemstone Inventory Picker */}
      {showInventoryPicker && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-amber-500" />
                <h4 className="text-sm font-black">انتخاب سنگ از انبار گوهرها</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowInventoryPicker(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="جستجو بر اساس نام سنگ، کد انبار، واریته یا محل نگهداری..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {inventoryLoading ? (
                <p className="text-center py-6 text-xs text-slate-500">در حال بارگذاری انبار...</p>
              ) : filteredInventory.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-500">
                  هیچ سنگی در انبار با این مشخصات یافت نشد.
                </p>
              ) : (
                filteredInventory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectFromInventory(item)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500/80 bg-white dark:bg-slate-800/50 cursor-pointer transition shadow-2xs hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-slate-900 dark:text-white">
                          {item.trade_name || item.name}
                        </span>
                        {item.inventory_code && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {item.inventory_code}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        تراش: {item.shape || 'نامشخص'} | واریته: {item.variety || 'عمومی'} | محل: {item.storage_location || 'صندوق'}
                      </p>
                    </div>

                    <div className="text-left">
                      <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                        {Number(item.weight_ct || 0).toFixed(2)} ct ({Number(item.weight_g || 0).toFixed(3)} گرم)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.cost_per_ct ? `${formatMoney(item.cost_per_ct)} / قیراط` : 'بدون فی'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
