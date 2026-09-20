'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  History,
  Check,
  X,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  UserRound,
  FlaskConical,
  RotateCcw,
  Tag,
} from 'lucide-react';
import type { MeltedInventoryItem, DocumentLineMinimal } from '@/lib/inventory-reservation';
import { getInventoryItemAvailability } from '@/lib/inventory-reservation';

export type RawOperationKind = 'molten' | 'misc' | 'conditional' | 'question' | 'coin' | 'unsettled';

type MetalInventoryPickerProps = {
  selectedId: string;
  rawKind: RawOperationKind;
  inventory: MeltedInventoryItem[];
  committedLines?: DocumentLineMinimal[];
  editingLineId?: string | null;
  baseKarat?: number;
  weightPrecision?: number;
  faNumber: (value: number, fractionDigits?: number) => string;
  onSelect: (item: MeltedInventoryItem, availableWeight: number) => void;
  onClear: () => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

const KIND_NAMES: Record<string, string> = {
  molten: 'آبشده',
  misc: 'متفرقه',
  conditional: 'شرطی',
  question: 'سواله',
};

export default function MetalInventoryPicker({
  selectedId,
  rawKind,
  inventory = [],
  committedLines = [],
  editingLineId = null,
  baseKarat = 750,
  weightPrecision = 3,
  faNumber,
  onSelect,
  onClear,
  label,
  placeholder,
  disabled = false,
}: MetalInventoryPickerProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(rawKind || 'molten');
  const [searchQuery, setSearchQuery] = useState('');
  const [markedIds, setMarkedIds] = useState<Set<string>>(new Set());
  const [historyItem, setHistoryItem] = useState<MeltedInventoryItem | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background page from scrolling when picker modal or history modal is open
  useEffect(() => {
    if (!isOpen && !historyItem) return;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen, historyItem]);

  // Sync activeTab when rawKind changes from parent
  useEffect(() => {
    if (rawKind && ['molten', 'misc', 'conditional', 'question'].includes(rawKind)) {
      setActiveTab(rawKind);
    }
  }, [rawKind]);

  // Find currently selected item if any
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return inventory.find((item) => item.id === selectedId) ?? null;
  }, [selectedId, inventory]);

  const selectedAvailability = useMemo(() => {
    if (!selectedItem) return null;
    return getInventoryItemAvailability(selectedItem, committedLines, editingLineId);
  }, [selectedItem, committedLines, editingLineId]);

  // Counts by kind across entire inventory
  const countsByKind = useMemo(() => {
    const counts = { molten: 0, misc: 0, conditional: 0, question: 0 };
    for (const item of inventory) {
      const k = (item.rawKind || 'molten') as keyof typeof counts;
      if (counts[k] !== undefined) counts[k]++;
    }
    return counts;
  }, [inventory]);

  // Filtered list for active tab and search query
  const tabItems = useMemo(() => {
    return inventory.filter((item) => {
      const itemKind = item.rawKind || 'molten';
      return itemKind === activeTab;
    });
  }, [inventory, activeTab]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tabItems;

    return tabItems.filter((item) => {
      const stamp = (item.stampNumber || '').toLowerCase();
      const lab = (item.labName || '').toLowerCase();
      const customer = (item.customerName || '').toLowerCase();
      return stamp.includes(query) || lab.includes(query) || customer.includes(query);
    });
  }, [tabItems, searchQuery]);

  // Calculations for summary footer (all items in active tab)
  const tabSummary = useMemo(() => {
    let stampedCount = 0;
    let totalScaleWeight = 0;
    let totalConvertedWeight = 0;

    for (const item of tabItems) {
      const { availableRemaining } = getInventoryItemAvailability(item, committedLines, editingLineId);
      if (item.stampNumber && item.stampNumber.trim() !== '') {
        stampedCount++;
      }
      totalScaleWeight += availableRemaining;
      const purity = Number(item.purity || 750) || 750;
      totalConvertedWeight += (availableRemaining * purity) / baseKarat;
    }

    return {
      totalCount: tabItems.length,
      stampedCount,
      totalScaleWeight,
      totalConvertedWeight,
    };
  }, [tabItems, committedLines, editingLineId, baseKarat]);

  // Calculations for marked items
  const markedSummary = useMemo(() => {
    if (markedIds.size === 0) return null;

    let markedScaleSum = 0;
    let markedConvertedSum = 0;
    let count = 0;

    for (const item of inventory) {
      if (markedIds.has(item.id)) {
        count++;
        const { availableRemaining } = getInventoryItemAvailability(item, committedLines, editingLineId);
        markedScaleSum += availableRemaining;
        const purity = Number(item.purity || 750) || 750;
        markedConvertedSum += (availableRemaining * purity) / baseKarat;
      }
    }

    return { count, markedScaleSum, markedConvertedSum };
  }, [markedIds, inventory, committedLines, editingLineId, baseKarat]);

  // Toggle mark for single item
  const toggleMark = (id: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all or deselect all for currently filtered items
  const toggleSelectAllFiltered = () => {
    const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((item) => markedIds.has(item.id));
    setMarkedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const item of filteredItems) {
          next.delete(item.id);
        }
      } else {
        for (const item of filteredItems) {
          next.add(item.id);
        }
      }
      return next;
    });
  };

  const handleSelectItem = (item: MeltedInventoryItem) => {
    const { availableRemaining } = getInventoryItemAvailability(item, committedLines, editingLineId);
    if (availableRemaining <= 0 && item.id !== selectedId) return;
    onSelect(item, availableRemaining);
    setIsOpen(false);
  };

  const kindLabel = KIND_NAMES[rawKind] || 'فلزات';
  const displayPlaceholder = placeholder || `انتخاب از موجودی ${kindLabel} صندوق...`;

  return (
    <div className="space-y-1">
      {/* TRIGGER FIELD */}
      {selectedItem ? (
        <div className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50/60 p-2.5 transition-all dark:border-amber-700/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-0.5 text-xs font-black text-white shadow-2xs">
                <Tag size={12} />
                {selectedItem.stampNumber ? `انگ: ${selectedItem.stampNumber}` : 'بدون انگ'}
              </span>
              {selectedItem.labName ? (
                <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-slate-700 shadow-2xs dark:bg-slate-800 dark:text-slate-200">
                  {selectedItem.labName}
                </span>
              ) : null}
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                دریافت از: <strong className="text-slate-900 dark:text-white">{selectedItem.customerName || 'موجودی اولیه'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setHistoryItem(selectedItem)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs"
                title="مشاهده ریز گردش و تاریخچه این قطعه"
              >
                <History size={14} className="text-amber-600 dark:text-amber-400" />
                <span>گردش</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                disabled={disabled}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-400 bg-amber-100 px-2.5 text-xs font-bold text-amber-900 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/60 dark:text-amber-100 shadow-2xs"
              >
                <Layers size={14} />
                <span>تغییر</span>
              </button>
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs"
                title="حذف انتخاب"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 border-t border-amber-200/80 dark:border-amber-900/40">
            <span>
              وزن قابل انتخاب: <strong className="font-mono text-emerald-700 dark:text-emerald-400">{faNumber(selectedAvailability?.availableRemaining ?? selectedItem.remainingWeight, weightPrecision)}</strong> گرم
            </span>
            <span>
              وزن اولیه: <span className="font-mono">{faNumber(selectedAvailability?.initialWeight ?? selectedItem.weight, weightPrecision)}</span> گرم
            </span>
            <span>
              عیار قطعه: <span className="font-mono">{selectedItem.purity || 750}</span>
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 text-right text-xs font-bold text-slate-700 transition-all hover:border-amber-500 hover:bg-amber-50/40 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-400 dark:hover:bg-slate-800/80"
        >
          <span className="flex items-center gap-2 truncate">
            <Layers size={16} className="text-amber-500 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400 truncate">{displayPlaceholder}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <span>{countsByKind[rawKind as keyof typeof countsByKind] ?? 0}</span>
            <span>موجود</span>
          </span>
        </button>
      )}

      {/* FULL MODAL DIALOG */}
      {mounted && isOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
              onClick={() => setIsOpen(false)}
              onWheel={(e) => e.stopPropagation()}
            >
              <div
                className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
                dir="rtl"
              >
            {/* MODAL HEADER */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    انتخاب از موجودی فلزات برای خروج
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    قطعه مورد نظر را انتخاب کنید یا چند مورد را جهت مشاهده مجموع وزن مارک کنید.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* TABS & SEARCH CONTROLS */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 dark:border-slate-800 bg-white dark:bg-slate-950">
              {/* CATEGORY TABS */}
              <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                {(['molten', 'misc', 'conditional', 'question'] as const).map((kind) => {
                  const isActive = activeTab === kind;
                  const count = countsByKind[kind] || 0;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setActiveTab(kind)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
                        isActive
                          ? 'bg-white text-amber-700 shadow-xs dark:bg-slate-800 dark:text-amber-400'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>{KIND_NAMES[kind]}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                          isActive
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* SEARCH INPUT */}
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو با شماره انگ، نام ری‌گیری یا طرف‌حساب..."
                  className="h-9 w-full rounded-xl border border-slate-300 bg-slate-50 pr-9 pl-8 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            </div>

            {/* FLOATING MARKED SUMMARY BAR */}
            {markedSummary && markedSummary.count > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-white shadow-xs">
                <div className="flex flex-wrap items-center gap-4 text-xs font-black">
                  <span className="flex items-center gap-1 bg-black/20 rounded-md px-2 py-0.5">
                    ✓ <strong>{faNumber(markedSummary.count)}</strong> مورد مارک‌شده
                  </span>
                  <span>
                    مجموع وزن ترازویی: <strong className="font-mono text-sm underline decoration-white/50">{faNumber(markedSummary.markedScaleSum, weightPrecision)}</strong> گرم
                  </span>
                  <span>
                    مجموع عیار معیار ({baseKarat}): <strong className="font-mono text-sm underline decoration-white/50">{faNumber(markedSummary.markedConvertedSum, weightPrecision)}</strong> گرم
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMarkedIds(new Set())}
                  className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 text-xs font-bold hover:bg-white/30 transition-all text-white"
                >
                  <RotateCcw size={13} />
                  <span>لغو مارک‌ها</span>
                </button>
              </div>
            ) : null}

            {/* MAIN TABLE */}
            <div className="flex-1 overflow-auto max-h-[55vh]">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                  <FlaskConical size={36} className="mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-bold">هیچ موجودی فعالی در این بخش یافت نشد.</p>
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-2 text-xs font-bold text-amber-600 hover:underline dark:text-amber-400"
                    >
                      پاک کردن فیلتر جستجو
                    </button>
                  ) : null}
                </div>
              ) : (
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 font-extrabold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      <th className="w-10 px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={filteredItems.length > 0 && filteredItems.every((item) => markedIds.has(item.id))}
                          onChange={toggleSelectAllFiltered}
                          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          title="انتخاب همه / لغو همه"
                        />
                      </th>
                      <th className="w-12 px-2 py-2.5 text-center">ردیف</th>
                      <th className="px-3 py-2.5">نام ری‌گیری و شماره انگ</th>
                      <th className="px-3 py-2.5">طرف‌حساب دریافتی</th>
                      <th className="px-3 py-2.5">وزن ترازویی (گرم)</th>
                      <th className="px-3 py-2.5">تبدیل به عیار معیار ({baseKarat})</th>
                      <th className="w-28 px-3 py-2.5 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold">
                    {filteredItems.map((item, index) => {
                      const { initialWeight, currentReserved, availableRemaining } =
                        getInventoryItemAvailability(item, committedLines, editingLineId);
                      const isSelected = item.id === selectedId;
                      const isMarked = markedIds.has(item.id);
                      const isExhausted = availableRemaining <= 0 && !isSelected;
                      const purity = Number(item.purity || 750) || 750;
                      const convertedWeight = (availableRemaining * purity) / baseKarat;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => {
                            if (!isExhausted) handleSelectItem(item);
                          }}
                          className={`transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-amber-100/70 dark:bg-amber-950/40 font-bold'
                              : isMarked
                                ? 'bg-amber-50/80 dark:bg-amber-950/20'
                                : index % 2 === 0
                                  ? 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/60'
                                  : 'bg-slate-50/60 dark:bg-slate-900/30 hover:bg-slate-100/70 dark:hover:bg-slate-900/60'
                          } ${isExhausted ? 'opacity-50 cursor-not-allowed bg-slate-100/50 dark:bg-slate-900/50' : ''}`}
                        >
                          {/* CHECKBOX */}
                          <td
                            className="px-3 py-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isMarked}
                              onChange={() => toggleMark(item.id)}
                              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>

                          {/* ROW NUMBER */}
                          <td className="px-2 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                            {index + 1}
                          </td>

                          {/* ASSAY & ENG */}
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.stampNumber ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-black text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                  انگ: {item.stampNumber}
                                </span>
                              ) : (
                                <span className="rounded-md bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  بدون انگ
                                </span>
                              )}
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {item.labName || 'ری‌گیری نامشخص'}
                              </span>
                            </div>
                          </td>

                          {/* CUSTOMER */}
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <UserRound size={13} className="text-slate-400 shrink-0" />
                              <span className="font-bold">{item.customerName || 'موجودی اول دوره'}</span>
                            </div>
                          </td>

                          {/* SCALE WEIGHT */}
                          <td className="px-3 py-2.5">
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                                {faNumber(availableRemaining, weightPrecision)} گرم
                              </span>
                              {currentReserved > 0 || initialWeight !== availableRemaining ? (
                                <span className="text-[10px] text-slate-400 font-normal">
                                  اولیه: {faNumber(initialWeight, weightPrecision)}g
                                  {currentReserved > 0 ? ` | خروج موقت: ${faNumber(currentReserved, weightPrecision)}g` : ''}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* CONVERTED TO BASE KARAT */}
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                                {faNumber(convertedWeight, weightPrecision)} گرم
                              </span>
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                عیار {purity}
                              </span>
                            </div>
                          </td>

                          {/* ACTIONS */}
                          <td
                            className="px-3 py-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              {/* HISTORY BUTTON */}
                              <button
                                type="button"
                                onClick={() => setHistoryItem(item)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:border-amber-500 hover:text-amber-600 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 shadow-2xs"
                                title="مشاهده گردش و تاریخچه پرداخت‌ها"
                              >
                                <History size={14} />
                              </button>

                              {/* SELECT BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleSelectItem(item)}
                                disabled={isExhausted}
                                className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-black transition-all ${
                                  isSelected
                                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                                    : isExhausted
                                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-800'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs'
                                }`}
                              >
                                <Check size={13} />
                                <span>{isSelected ? 'انتخاب شده' : 'انتخاب'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* MODAL FOOTER SUMMARY */}
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">تعداد آبشده‌های دارای انگ:</span>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-xs font-extrabold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    {faNumber(tabSummary.stampedCount)} عدد (از {faNumber(tabSummary.totalCount)})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">مجموع وزن ترازویی:</span>
                  <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                    {faNumber(tabSummary.totalScaleWeight, weightPrecision)} گرم
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">مجموع وزن عیار معیار ({baseKarat}):</span>
                  <span className="font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                    {faNumber(tabSummary.totalConvertedWeight, weightPrecision)} گرم
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {/* HISTORY / TURNOVER MODAL */}
      {mounted && historyItem
        ? createPortal(
            <MetalInventoryHistoryModal
              item={historyItem}
              baseKarat={baseKarat}
              weightPrecision={weightPrecision}
              faNumber={faNumber}
              onClose={() => setHistoryItem(null)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

// SUB-MODAL: HISTORY / TURNOVER SUMMARY
type HistoryModalProps = {
  item: MeltedInventoryItem;
  baseKarat: number;
  weightPrecision: number;
  faNumber: (value: number, fractionDigits?: number) => string;
  onClose: () => void;
};

function MetalInventoryHistoryModal({
  item,
  baseKarat,
  weightPrecision,
  faNumber,
  onClose,
}: HistoryModalProps) {
  const historyEntries = item.history ?? [];

  // Calculate total receipts and total payouts from history if available
  const initialEntry = historyEntries.find((h) => h.type === 'received');
  const paidEntries = historyEntries.filter((h) => h.type === 'paid');

  const totalPaidWeight = paidEntries.reduce((sum, h) => sum + Math.abs(h.weight), 0);
  const initialWeight = initialEntry?.weight ?? item.weight;

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
              <History size={18} />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                خلاصه گردش و سابقه قطعه
              </h4>
              <p className="text-[11px] font-bold text-slate-500">
                {item.stampNumber ? `شماره انگ: ${item.stampNumber}` : 'بدون انگ'} · {item.labName || 'ری‌گیری نامشخص'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-3 gap-2.5 p-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs">
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-bold">وزن اولیه دریافت</span>
            <strong className="mt-1 block font-mono text-sm font-black text-slate-900 dark:text-white">
              {faNumber(initialWeight, weightPrecision)} گرم
            </strong>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-center dark:border-rose-900/40 dark:bg-rose-950/20 shadow-2xs">
            <span className="text-rose-600 dark:text-rose-400 block text-[11px] font-bold">مجموع پرداخت‌ها (خروج)</span>
            <strong className="mt-1 block font-mono text-sm font-black text-rose-700 dark:text-rose-300">
              {faNumber(totalPaidWeight, weightPrecision)} گرم
            </strong>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-center dark:border-emerald-900/40 dark:bg-emerald-950/20 shadow-2xs">
            <span className="text-emerald-600 dark:text-emerald-400 block text-[11px] font-bold">مانده قابل استفاده</span>
            <strong className="mt-1 block font-mono text-sm font-black text-emerald-700 dark:text-emerald-300">
              {faNumber(item.remainingWeight, weightPrecision)} گرم
            </strong>
          </div>
        </div>

        {/* TIMELINE LIST */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <h5 className="text-xs font-black text-slate-700 dark:text-slate-300">
            مراحل ورود و خروج:
          </h5>

          {historyEntries.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <p>اطلاعات اولیه:</p>
              <p className="mt-1 font-bold">
                دریافت‌شده از طرف‌حساب: {item.customerName || 'موجودی اولیه'} به وزن {faNumber(item.weight, weightPrecision)} گرم
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {historyEntries.map((entry, idx) => {
                const isReceipt = entry.type === 'received';
                return (
                  <div
                    key={entry.id || idx}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs ${
                      isReceipt
                        ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                        : 'border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                          isReceipt
                            ? 'bg-emerald-500 text-white'
                            : 'bg-rose-500 text-white'
                        }`}
                      >
                        {isReceipt ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 dark:text-white font-extrabold">
                            {isReceipt ? 'دریافت اولیه (ورود به صندوق)' : `مرحله پرداخت ${idx} (خروج از صندوق)`}
                          </strong>
                          {entry.date ? (
                            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-500 shadow-2xs dark:bg-slate-800 dark:text-slate-400">
                              {entry.date}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 font-bold text-slate-700 dark:text-slate-300">
                          {isReceipt ? 'از شخص:' : 'به شخص:'} <strong>{entry.customerName || 'نامشخص'}</strong>
                        </p>
                        {entry.description ? (
                          <p className="mt-0.5 text-[11px] text-slate-500">{entry.description}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span
                        className={`font-mono text-sm font-black ${
                          isReceipt ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {isReceipt ? '+' : '-'}{faNumber(Math.abs(entry.weight), weightPrecision)} گرم
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-left dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
