'use client';

import {
  Calendar,
  ChevronRight,
  Coins,
  Edit3,
  FolderTree,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import InitialCoinInventoryModal, { type CoinInventoryEditItem } from './InitialCoinInventoryModal';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAppSettings } from '@/components/shared/SettingsProvider';
import { convertRialToToman, formatMoney } from '@/lib/money';
import { formatQuantity } from '@/lib/weight';

export type CoinInventoryRecordItem = {
  id: string;
  itemTypeId: string;
  itemName: string;
  nature: string;
  metal: string;
  quantity: number;
  unitWeight: number;
  purity: number;
  unitPrice: number;
  totalAmount: number;
  totalWeight: number;
  convertedWeight: number;
  date: string;
  description?: string;
};

export default function InitialCoinInventoryClient({
  initialInventory = [],
}: {
  initialInventory?: CoinInventoryRecordItem[];
}) {
  const { formatWeight, settings } = useAppSettings();
  const effectiveCurrency = (settings?.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [items, setItems] = useState<CoinInventoryRecordItem[]>(initialInventory);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CoinInventoryEditItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNature, setFilterNature] = useState<'all' | 'coin' | 'bullion'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const summaryMetrics = useMemo(() => {
    let coinCount = 0;
    let coinWeight = 0;
    let bullionCount = 0;
    let bullionWeight = 0;
    let totalValueRial = 0;

    for (const it of items) {
      if (it.nature === 'bullion') {
        bullionCount += Number(it.quantity || 0);
        bullionWeight += Number(it.totalWeight || 0);
      } else {
        coinCount += Number(it.quantity || 0);
        coinWeight += Number(it.totalWeight || 0);
      }
      totalValueRial += Number(it.totalAmount || 0);
    }

    return {
      coinCount,
      coinWeight,
      bullionCount,
      bullionWeight,
      totalValueRial,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (filterNature !== 'all' && item.nature !== filterNature) return false;
      if (q) {
        const matchName = (item.itemName || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [items, filterNature, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize, totalPages]);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/coin', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.coinInventory)) {
          setItems(data.coinInventory);
        }
      }
    } catch {
      // keep existing items
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (item: CoinInventoryRecordItem) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این موجودی اولیه اطمینان دارید؟')) return;

    try {
      const res = await fetch(`/api/accounting/opening/coin?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        void fetchInventory();
      }
    } catch {
      //
    }
  };

  const metalLabels: Record<string, string> = {
    gold: 'طلا',
    silver: 'نقره',
    platinum: 'پلاتین',
  };

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/documents/initial-inventory"
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="بازگشت"
          >
            <ChevronRight size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              مدیریت موجودی اولیه مسکوکات و شمش
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              تعریف و مدیریت موجودی اول دوره انواع سکه‌های بهار آزادی، پارسیان، شمش طلا و نقره
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1130"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            title="مشاهده ساختار تفصیلی مسکوکات و شمش در درختواره کدینگ حساب‌ها (۱۱۳۰)"
          >
            <FolderTree size={16} className="text-amber-500" />
            <span className="hidden sm:inline">مشاهده در درختواره (۱۱۳۰)</span>
          </Link>

          <button
            type="button"
            onClick={fetchInventory}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            title="بروزرسانی لیست"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">بروزرسانی</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>افزودن مسکوکات و شمش</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Coins KPI */}
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white p-5 shadow-xs dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Coins size={20} className="stroke-[2.2]" />
              <span className="text-sm font-black">موجودی مسکوکات (سکه)</span>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
              {summaryMetrics.coinCount.toLocaleString('fa-IR')} قطعه
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">مجموع وزن خام:</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {formatWeight(summaryMetrics.coinWeight)} گرم
            </span>
          </div>
        </div>

        {/* Bullion KPI */}
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 shadow-xs dark:border-slate-800 dark:from-slate-800/30 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Scale size={20} className="stroke-[2.2]" />
              <span className="text-sm font-black">موجودی شمش استاندارد</span>
            </div>
            <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-black text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {summaryMetrics.bullionCount.toLocaleString('fa-IR')} قطعه
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">مجموع وزن خام:</span>
            <span className="font-mono font-black text-slate-900 dark:text-white">
              {formatWeight(summaryMetrics.bullionWeight)} گرم
            </span>
          </div>
        </div>

        {/* Total Value KPI */}
        <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/50 to-white p-5 shadow-xs dark:border-emerald-900/30 dark:from-emerald-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">مجموع ارزش برآوردی</span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-700 dark:text-emerald-300">
              کل اقلام
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">برآورد ریالی/تومانی:</span>
            <span className="font-mono font-black text-emerald-700 dark:text-emerald-300 text-sm">
              {formatMoney(
                effectiveCurrency === 'IRT'
                  ? convertRialToToman(summaryMetrics.totalValueRial)
                  : summaryMetrics.totalValueRial,
                effectiveCurrency,
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Filters, Search and View Switcher */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-1 text-xs font-bold text-slate-500 dark:text-slate-400">فیلتر ماهیت:</span>
          {[
            { id: 'all', label: `همه (${items.length.toLocaleString('fa-IR')})` },
            { id: 'coin', label: `مسکوکات (${summaryMetrics.coinCount.toLocaleString('fa-IR')})` },
            { id: 'bullion', label: `شمش (${summaryMetrics.bullionCount.toLocaleString('fa-IR')})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterNature(tab.id as any);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 font-bold transition cursor-pointer ${
                filterNature === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو در عنوان، شرح یا فلز..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-1.5 pr-8 pl-3 text-xs text-slate-800 placeholder-slate-400 transition focus:border-amber-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
            />
            <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="نمایش جدولی"
              aria-label="نمایش جدولی"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="نمایش کارتی"
              aria-label="نمایش کارتی"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Counter & Page Info */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
        <div>
          نمایش {filteredItems.length.toLocaleString('fa-IR')} از {items.length.toLocaleString('fa-IR')} قلم
          {totalPages > 1 && ` (صفحه ${page.toLocaleString('fa-IR')} از ${totalPages.toLocaleString('fa-IR')})`}
        </div>
      </div>

      {/* Content Area */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Coins size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            موردی برای نمایش یافت نشد
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            با تغییر فیلترها یا جستجو می‌توانید نتایج دیگری را مشاهده کنید.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'table' ? (
            /* Table View */
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 pr-4 pl-2 font-bold">#</th>
                      <th className="px-3 py-3.5">عنوان و شرح</th>
                      <th className="px-3 py-3.5">ماهیت و کدینگ</th>
                      <th className="px-3 py-3.5">فلز و عیار</th>
                      <th className="px-3 py-3.5">تعداد</th>
                      <th className="px-3 py-3.5">وزن واحد</th>
                      <th className="px-3 py-3.5">وزن کل</th>
                      <th className="px-3 py-3.5">معادل ۷۵۰</th>
                      <th className="px-3 py-3.5">ارزش کل ({currencySuffix})</th>
                      <th className="px-3 py-3.5">تاریخ</th>
                      <th className="py-3.5 pr-2 pl-4 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-medium">
                    {paginatedItems.map((item, idx) => {
                      const totalMoney = effectiveCurrency === 'IRT'
                        ? convertRialToToman(item.totalAmount)
                        : item.totalAmount;

                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                        >
                          {/* # */}
                          <td className="py-3.5 pr-4 pl-2 font-semibold text-slate-400">
                            {(page - 1) * pageSize + idx + 1}
                          </td>

                          {/* Title & Description */}
                          <td className="px-3 py-3.5 font-bold text-slate-900 dark:text-white">
                            <div>{item.itemName}</div>
                            {item.description && (
                              <div className="text-[10px] font-normal text-slate-400 truncate max-w-xs mt-0.5">
                                {item.description}
                              </div>
                            )}
                          </td>

                          {/* Nature & Coding */}
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px]">
                                {item.nature === 'bullion' ? 'شمش استاندارد' : 'مسکوکات (سکه)'}
                              </span>
                              <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[9px] font-bold text-sky-600 dark:text-sky-400">
                                تفضیل ۲ (۱۱۳۰)
                              </span>
                            </div>
                          </td>

                          {/* Metal & Purity */}
                          <td className="px-3 py-3.5 text-slate-700 dark:text-slate-300 text-[11px]">
                            <span>{metalLabels[item.metal] || 'طلا'}</span> · <span>عیار {item.purity}</span>
                          </td>

                          {/* Quantity */}
                          <td className="px-3 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                            {formatQuantity(item.quantity)} عدد
                          </td>

                          {/* Unit Weight */}
                          <td className="px-3 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {formatWeight(item.unitWeight)} گرم
                          </td>

                          {/* Total Weight */}
                          <td className="px-3 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                            {formatWeight(item.totalWeight)} گرم
                          </td>

                          {/* Converted Weight (750) */}
                          <td className="px-3 py-3.5 font-mono font-extrabold text-amber-600 dark:text-amber-400">
                            {formatWeight(item.convertedWeight)} گرم
                          </td>

                          {/* Total Amount */}
                          <td className="px-3 py-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {item.totalAmount > 0 ? formatMoney(totalMoney, effectiveCurrency) : '۰'}
                          </td>

                          {/* Date */}
                          <td className="px-3 py-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {item.date || '—'}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 pr-2 pl-4 text-left">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="inline-flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                                title="ویرایش"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="inline-flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-rose-500 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedItems.map((item, idx) => {
                const totalMoney = effectiveCurrency === 'IRT'
                  ? convertRialToToman(item.totalAmount)
                  : item.totalAmount;

                return (
                  <article
                    key={item.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all hover:border-amber-500/40 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      {/* Header: Title, Nature Badge & Actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
                            <Coins size={18} className="stroke-[2.2]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-400">
                                #{(page - 1) * pageSize + idx + 1}
                              </span>
                              <h2 className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-1">
                                {item.itemName}
                              </h2>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {item.nature === 'bullion' ? 'شمش' : 'سکه'}
                              </span>
                              <span>•</span>
                              <span>{metalLabels[item.metal] || 'طلا'}</span>
                              <span>•</span>
                              <span>عیار {item.purity}</span>
                              <span className="rounded bg-sky-500/10 px-1.5 py-0.2 text-[9px] font-bold text-sky-600 dark:text-sky-400">
                                تفضیل ۲ (۱۱۳۰)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="inline-flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex size-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-rose-500 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-800 cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                        <Calendar size={12} className="text-slate-400" />
                        <span>تاریخ موجودی اولیه:</span>
                        <span className="font-mono dir-ltr">{item.date || 'ثبت نشده'}</span>
                      </div>

                      {/* Metrics Grid */}
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <div className="rounded-lg bg-slate-50/80 p-2 dark:bg-slate-800/40">
                          <span className="block text-[9px] font-bold text-slate-400">تعداد / وزن کل</span>
                          <span className="mt-0.5 block font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            {formatQuantity(item.quantity)} عدد ({formatWeight(item.totalWeight)} گرم)
                          </span>
                        </div>

                        <div className="rounded-lg bg-amber-500/10 p-2 dark:bg-amber-500/15">
                          <span className="block text-[9px] font-bold text-amber-700 dark:text-amber-300">ارزش کل</span>
                          <span className="mt-0.5 block font-mono text-[11px] font-black text-amber-900 dark:text-amber-200">
                            {item.totalAmount > 0 ? formatMoney(totalMoney, effectiveCurrency) : '۰'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredItems.length}
              pageSize={pageSize}
              pageSizeOptions={[25, 50, 100, 200]}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
              itemLabel="قلم مسکوکات و شمش"
            />
          </div>
        </div>
      )}

      {/* Initial Coin Inventory Modal */}
      <InitialCoinInventoryModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        onSuccess={() => {
          void fetchInventory();
        }}
      />
    </div>
  );
}
