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
  POPULAR_GEMSTONES,
  type EtiquetteMountedStone,
} from '@/lib/etiquette';
import { useAppSettings } from '@/src/components/SettingsProvider';

export interface MountedStonesSectionProps {
  stones: EtiquetteMountedStone[];
  onChange: (updatedStones: EtiquetteMountedStone[]) => void;
}

export default function MountedStonesSection({
  stones,
  onChange,
}: MountedStonesSectionProps) {
  const { formatMoney, formatWeight } = useAppSettings();

  // Existing Gemstone Inventory from /api/gemstones
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showInventoryPicker, setShowInventoryPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  useEffect(() => {
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
  }, []);

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
  const handleAddFreeStone = (name: string = 'برلیان') => {
    const newStone: EtiquetteMountedStone = {
      id: `stn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      shape: 'round',
      quantity: 1,
      weightCarat: 0.1,
      weightGram: caratsToGrams(0.1),
      unitPrice: 0,
      totalPrice: 0,
      isDeducted: true,
      isFromInventory: false,
    };
    onChange([...stones, newStone]);
  };

  // Add Stone from Existing Inventory
  const handleSelectFromInventory = (invItem: any) => {
    const rawCarat = Number(invItem.weight_ct) || 0;
    const rawGram = Number(invItem.weight_g) || caratsToGrams(rawCarat);
    const unitPrice = Number(invItem.unit_price) || 0;
    const qty = Math.max(1, Number(invItem.quantity) || 1);

    const newStone: EtiquetteMountedStone = {
      id: `stn_inv_${invItem.id}_${Date.now()}`,
      gemstoneInventoryId: invItem.id,
      name: invItem.trade_name || invItem.variety || 'سنگ جواهر',
      shape: invItem.shape || 'round',
      quantity: qty,
      weightCarat: rawCarat,
      weightGram: rawGram,
      unitPrice,
      totalPrice: Math.round(unitPrice * (rawCarat > 0 ? rawCarat : qty)),
      isDeducted: true,
      isFromInventory: true,
      inventoryCode: invItem.inventory_code || undefined,
      certificateNumber: invItem.report_number || undefined,
      description: invItem.description || undefined,
    };

    onChange([...stones, newStone]);
    setShowInventoryPicker(false);
    setPickerSearch('');
  };

  // Update specific stone
  const handleUpdateStone = (index: number, updates: Partial<EtiquetteMountedStone>) => {
    const next = [...stones];
    const current = next[index];
    if (!current) return;

    let weightCarat = updates.weightCarat !== undefined ? updates.weightCarat : current.weightCarat;
    let weightGram = updates.weightGram !== undefined ? updates.weightGram : current.weightGram;

    // Sync carat and gram conversions
    if (updates.weightCarat !== undefined && updates.weightGram === undefined) {
      weightGram = caratsToGrams(updates.weightCarat);
    } else if (updates.weightGram !== undefined && updates.weightCarat === undefined) {
      weightCarat = gramsToCarats(updates.weightGram);
    }

    const qty = updates.quantity !== undefined ? updates.quantity : current.quantity;
    const uPrice = updates.unitPrice !== undefined ? updates.unitPrice : current.unitPrice;
    let tPrice = updates.totalPrice !== undefined ? updates.totalPrice : current.totalPrice;

    // Recalculate total price if unit price or weight changed
    if (updates.unitPrice !== undefined || updates.weightCarat !== undefined || updates.quantity !== undefined) {
      tPrice = Math.round(uPrice * (weightCarat > 0 ? weightCarat : qty));
    }

    next[index] = {
      ...current,
      ...updates,
      weightCarat: Number(weightCarat.toFixed(2)),
      weightGram: Number(weightGram.toFixed(3)),
      totalPrice: tPrice,
    };

    onChange(next);
  };

  // Remove stone
  const handleRemoveStone = (index: number) => {
    const next = stones.filter((_, idx) => idx !== index);
    onChange(next);
  };

  // Aggregate totals
  const totalCount = stones.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);
  const totalCarats = stones.reduce((acc, s) => acc + (Number(s.weightCarat) || 0), 0);
  const totalGrams = stones.reduce((acc, s) => acc + (Number(s.weightGram) || 0), 0);
  const totalDeductedGrams = stones
    .filter((s) => s.isDeducted !== false)
    .reduce((acc, s) => acc + (Number(s.weightGram) || 0), 0);
  const totalPrice = stones.reduce((acc, s) => acc + (Number(s.totalPrice) || 0), 0);

  return (
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Diamond size={17} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">
              سنگ‌ها و نگین‌های سوارشده روی اتیکت ({stones.length} ردیف)
            </h4>
            <p className="text-[11px] text-muted-foreground">
              امکان سوار کردن چند نوع سنگ مختلف (برلیان، باگت، یاقوت و...) از سنگ‌های موجود انبار یا آزاد
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowInventoryPicker(true)}
            className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-all shadow-xs"
          >
            <Database size={13} />
            <span>انتخاب از انبار سنگ</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddFreeStone('برلیان')}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-xs"
          >
            <Plus size={13} />
            <span>افزودن سنگ دستی</span>
          </button>
        </div>
      </div>

      {/* Popular Stone Quick Chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-muted-foreground text-[10px] ml-1">پیشنهاد سریع:</span>
        {POPULAR_GEMSTONES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => handleAddFreeStone(name)}
            className="rounded-lg bg-background border border-border/70 px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            + {name}
          </button>
        ))}
      </div>

      {/* Stones List / Table */}
      {stones.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-border/80 rounded-xl bg-background/50 space-y-2">
          <Gem size={24} className="mx-auto text-muted-foreground/60" />
          <p className="text-xs font-medium text-muted-foreground">
            هنوز سنگی روی این کار سوار نشده است.
          </p>
          <p className="text-[10px] text-slate-400">
            برای مصنوعات تک‌نگین یا پرنگین، سنگ‌ها را از انبار موجود اضافه کنید تا کسر وزن به صورت خودکار محاسبه شود.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {stones.map((s, index) => (
            <div
              key={s.id || index}
              className={`p-3 rounded-2xl border transition-all ${
                s.isFromInventory
                  ? 'border-purple-500/40 bg-purple-500/5'
                  : 'border-border/70 bg-background'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                {/* Col 1: Stone Name & Inventory Badge (3 cols) */}
                <div className="sm:col-span-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={s.name}
                      onChange={(e) => handleUpdateStone(index, { name: e.target.value })}
                      placeholder="نام سنگ (برلیان...)"
                      className="w-full rounded-xl border border-border/70 bg-card px-2.5 py-1.5 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                    {s.isFromInventory && (
                      <span
                        className="shrink-0 rounded-lg bg-purple-500/10 px-1.5 py-1 text-[9px] font-bold text-purple-700 dark:text-purple-300 border border-purple-500/20"
                        title={s.inventoryCode ? `کد انبار: ${s.inventoryCode}` : 'موجود در انبار'}
                      >
                        انبار
                      </span>
                    )}
                  </div>
                </div>

                {/* Col 2: Quantity (1 col) */}
                <div className="sm:col-span-1">
                  <label className="text-[9px] text-muted-foreground block mb-0.5 sm:hidden">
                    تعداد
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={s.quantity}
                    onChange={(e) =>
                      handleUpdateStone(index, { quantity: Math.max(1, Number(e.target.value)) })
                    }
                    className="w-full rounded-xl border border-border/70 bg-card px-2 py-1.5 text-xs font-mono font-bold text-center text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    title="تعداد سنگ"
                  />
                </div>

                {/* Col 3: Weight in Carat (2 cols) */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] text-muted-foreground block mb-0.5 sm:hidden">
                    وزن به قیراط (ct)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={s.weightCarat}
                      onChange={(e) =>
                        handleUpdateStone(index, { weightCarat: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-border/70 bg-card pr-2 pl-6 py-1.5 text-xs font-mono font-bold text-left text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground">
                      ct
                    </span>
                  </div>
                </div>

                {/* Col 4: Weight in Gram (2 cols) */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] text-muted-foreground block mb-0.5 sm:hidden">
                    وزن به گرم (g)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={s.weightGram}
                      onChange={(e) =>
                        handleUpdateStone(index, { weightGram: Number(e.target.value) })
                      }
                      className="w-full rounded-xl border border-border/70 bg-card pr-2 pl-6 py-1.5 text-xs font-mono font-bold text-left text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground">
                      g
                    </span>
                  </div>
                </div>

                {/* Col 5: Total Stone Price in IRR (2 cols) */}
                <div className="sm:col-span-2">
                  <label className="text-[9px] text-muted-foreground block mb-0.5 sm:hidden">
                    ارزش سنگ (ریال)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    min="0"
                    value={s.totalPrice || ''}
                    placeholder="ارزش (ریال)"
                    onChange={(e) =>
                      handleUpdateStone(index, { totalPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border/70 bg-card px-2 py-1.5 text-xs font-mono text-left text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Col 6: Deduct from gold & Delete button (2 cols) */}
                <div className="sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
                  <label
                    className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground cursor-pointer select-none"
                    title="آیا وزن این سنگ از وزن طلای کل کسر شود؟"
                  >
                    <input
                      type="checkbox"
                      checked={s.isDeducted}
                      onChange={(e) => handleUpdateStone(index, { isDeducted: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>کسر نگین</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleRemoveStone(index)}
                    className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors"
                    title="حذف این سنگ"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Aggregated Summary Bar */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                تعداد کل نگین‌ها: <strong className="font-mono">{totalCount}</strong> عدد
              </div>
              <div>
                مجموع قیراط: <strong className="font-mono">{totalCarats.toFixed(2)}</strong> ct
              </div>
              <div>
                مجموع کسر وزن طلا:{' '}
                <strong className="font-mono text-amber-900 dark:text-amber-200">
                  {totalDeductedGrams.toFixed(3)}
                </strong>{' '}
                گرم
              </div>
            </div>

            {totalPrice > 0 && (
              <div className="text-left font-mono font-bold text-foreground">
                ارزش کل سنگ‌ها: {formatMoney(totalPrice)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Pick from Existing Gemstone Inventory */}
      {showInventoryPicker && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-3xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-muted/40">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Database size={16} />
                </div>
                <h3 className="text-sm font-bold text-foreground">
                  انتخاب سنگ از انبار گوهرسنگ‌ها
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInventoryPicker(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={17} />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-border/60 bg-muted/10">
              <input
                type="text"
                placeholder="جستجو در نام سنگ، کد انبار، محل نگهداری..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                autoFocus
              />
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {inventoryLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  در حال دریافت اطلاعات سنگ‌های موجود...
                </div>
              ) : filteredInventory.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <Gem size={24} className="mx-auto text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    هیچ سنگ فعالی در انبار گوهرسنگ‌ها یافت نشد.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInventoryPicker(false);
                      handleAddFreeStone('برلیان');
                    }}
                    className="text-xs font-bold text-amber-600 hover:underline"
                  >
                    افزودن به صورت دستی (آزاد)
                  </button>
                </div>
              ) : (
                filteredInventory.map((item) => {
                  const carat = Number(item.weight_ct) || 0;
                  const gram = Number(item.weight_g) || caratsToGrams(carat);
                  const price = Number(item.unit_price) || 0;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFromInventory(item)}
                      className="flex items-center justify-between p-3 rounded-2xl border border-border/70 bg-card hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground group-hover:text-purple-600 transition-colors">
                            {item.trade_name || item.variety || 'گوهرسنگ'}
                          </span>
                          {item.inventory_code && (
                            <span className="font-mono text-[10px] bg-muted px-1 rounded text-muted-foreground">
                              {item.inventory_code}
                            </span>
                          )}
                          {item.shape && (
                            <span className="text-[10px] text-muted-foreground">
                              تراش: {item.shape}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          محل: {item.storage_location || 'انبار اصلی'} | موجودی:{' '}
                          {item.quantity || 1} عدد
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <div className="text-xs font-black text-foreground">
                          {carat > 0 ? `${carat} ct` : `${gram} g`}
                        </div>
                        {price > 0 && (
                          <div className="text-[10px] text-slate-500">
                            فی: {Number(price).toLocaleString('fa-IR')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end p-3 border-t border-border/80 bg-muted/20">
              <button
                type="button"
                onClick={() => setShowInventoryPicker(false)}
                className="rounded-xl border border-border px-4 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
