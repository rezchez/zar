'use client';

import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Edit3,
  Flame,
  FolderTree,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import InitialWorkmanshipInventoryModal from './InitialWorkmanshipInventoryModal';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { convertRialToToman, formatMoney } from '@/lib/money';
import {
  type WageMode,
  type WorkmanshipInventorySummary,
  type WorkmanshipOpeningRecord,
} from '@/lib/workmanship-inventory';

export interface InitialWorkmanshipInventoryClientProps {
  initialItems?: WorkmanshipOpeningRecord[];
  initialSummary?: WorkmanshipInventorySummary | null;
}

const EMPTY_SUMMARY: WorkmanshipInventorySummary = {
  totalItems: 0,
  totalPieces: 0,
  gold: { totalWeight: 0, convertedWeight: 0, pieces: 0, totalWage: 0 },
  silver: { totalWeight: 0, convertedWeight: 0, pieces: 0, totalWage: 0 },
  platinum: { totalWeight: 0, convertedWeight: 0, pieces: 0, totalWage: 0 },
  totalValuationRial: 0,
  byCurrency: {},
};

export default function InitialWorkmanshipInventoryClient({
  initialItems = [],
  initialSummary = null,
}: InitialWorkmanshipInventoryClientProps) {
  const { formatWeight, settings } = useAppSettings();
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [items, setItems] = useState<WorkmanshipOpeningRecord[]>(initialItems);
  const [summary, setSummary] = useState<WorkmanshipInventorySummary>(
    initialSummary || EMPTY_SUMMARY,
  );
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMetal, setFilterMetal] = useState<string>('all');
  const [filterWageMode, setFilterWageMode] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPerPage] = useState(50);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkmanshipOpeningRecord | null>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/workmanship', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch {
      // keep current state
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

  const handleOpenEdit = (item: WorkmanshipOpeningRecord) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`آیا از حذف موجودی اول دوره «${name}» اطمینان دارید؟`)) return;

    try {
      const res = await fetch(
        `/api/accounting/opening/workmanship?id=${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        },
      );
      if (res.ok) {
        void fetchInventory();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'خطا در حذف رکورد');
      }
    } catch {
      alert('خطا در برقراری ارتباط با سرور.');
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (filterMetal !== 'all' && item.metal !== filterMetal) return false;
      if (filterWageMode !== 'all' && item.wageMode !== filterWageMode) return false;
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchLoc = (item.storageLocation || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDesc && !matchLoc) return false;
      }
      return true;
    });
  }, [items, filterMetal, filterWageMode, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, page, pageSize, totalPages]);

  const metalLabels: Record<
    string,
    { label: string; symbol: string; badgeClass: string; karatBase: string }
  > = {
    gold: {
      label: 'طلا',
      symbol: 'Au',
      badgeClass:
        'bg-amber-500/15 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300 border-amber-300 dark:border-amber-800',
      karatBase: '۷۵۰',
    },
    silver: {
      label: 'نقره',
      symbol: 'Ag',
      badgeClass:
        'bg-slate-200/80 text-slate-800 dark:bg-slate-700/60 dark:text-slate-200 border-slate-300 dark:border-slate-600',
      karatBase: '۹۲۵',
    },
    platinum: {
      label: 'پلاتین',
      symbol: 'Pt',
      badgeClass:
        'bg-cyan-500/15 text-cyan-800 dark:bg-cyan-500/25 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
      karatBase: '۸۰۰',
    },
  };

  return (
    <div dir="rtl" className="mx-auto max-w-7xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/documents/initial-inventory"
            className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="بازگشت به موجودی اول دوره"
          >
            <ChevronRight size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                موجودی اول دوره کارساخته
              </h1>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                مصنوعات طلا و جواهر
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ثبت و مدیریت اقلام طلای ساخته‌شده، نقره و پلاتین به همراه اجرت و وزن معادل عیار پایه
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1140"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FolderTree size={16} className="text-amber-600 dark:text-amber-400" />
            <span>درختواره کارساخته (۱۱۴۰)</span>
          </Link>

          <button
            type="button"
            onClick={() => void fetchInventory()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50"
            title="به‌روزرسانی داده‌ها"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>ثبت کارساخته جدید</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Pieces & Items Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Sparkles size={20} className="stroke-[2.2] text-amber-500" />
              <span className="font-black text-sm">مجموع اقلام و تعداد</span>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {summary.totalItems.toLocaleString('fa-IR')} ردیف
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">تعداد کل مصنوعات:</span>
              <span className="font-black text-sm text-slate-900 dark:text-white">
                {summary.totalPieces.toLocaleString('fa-IR')} عدد
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-slate-100 pt-2 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium">ارزش کل اولیه:</span>
              <span className="font-black text-xs text-amber-600 dark:text-amber-400">
                {formatMoney(
                  effectiveCurrency === 'IRT'
                    ? convertRialToToman(summary.totalValuationRial)
                    : summary.totalValuationRial,
                )}{' '}
                {currencySuffix}
              </span>
            </div>
          </div>
        </div>

        {/* Gold Summary Card */}
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-xs dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Flame size={20} className="stroke-[2.2]" />
              <span className="font-black text-sm">کارساخته طلا (Au)</span>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
              {summary.gold.pieces.toLocaleString('fa-IR')} عدد
            </span>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">وزن ناخالص:</span>
              <span className="font-black text-slate-900 dark:text-white">
                {formatWeight(summary.gold.totalWeight)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">معادل عیار ۷۵۰:</span>
              <span className="font-black text-amber-600 dark:text-amber-400">
                {formatWeight(summary.gold.convertedWeight)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-amber-100 pt-1.5 dark:border-amber-900/30">
              <span className="text-slate-500 dark:text-slate-400 font-medium">مجموع اجرت:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {formatMoney(
                  effectiveCurrency === 'IRT'
                    ? convertRialToToman(summary.gold.totalWage)
                    : summary.gold.totalWage,
                )}{' '}
                {currencySuffix}
              </span>
            </div>
          </div>
        </div>

        {/* Silver Summary Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 shadow-xs dark:border-slate-800 dark:from-slate-800/30 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Scale size={20} className="stroke-[2.2]" />
              <span className="font-black text-sm">کارساخته نقره (Ag)</span>
            </div>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {summary.silver.pieces.toLocaleString('fa-IR')} عدد
            </span>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">وزن ناخالص:</span>
              <span className="font-black text-slate-900 dark:text-white">
                {formatWeight(summary.silver.totalWeight)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">معادل عیار ۹۲۵:</span>
              <span className="font-black text-slate-700 dark:text-slate-200">
                {formatWeight(summary.silver.convertedWeight)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-slate-100 pt-1.5 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium">مجموع اجرت:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {formatMoney(
                  effectiveCurrency === 'IRT'
                    ? convertRialToToman(summary.silver.totalWage)
                    : summary.silver.totalWage,
                )}{' '}
                {currencySuffix}
              </span>
            </div>
          </div>
        </div>

        {/* Platinum Summary Card */}
        <div className="rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/50 to-white p-5 shadow-xs dark:border-cyan-900/30 dark:from-cyan-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
              <Flame size={20} className="stroke-[2.2]" />
              <span className="font-black text-sm">کارساخته پلاتین (Pt)</span>
            </div>
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-extrabold text-cyan-700 dark:text-cyan-300">
              {summary.platinum.pieces.toLocaleString('fa-IR')} عدد
            </span>
          </div>
          <div className="mt-4 space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">وزن ناخالص:</span>
              <span className="font-black text-slate-900 dark:text-white">
                {formatWeight(summary.platinum.totalWeight)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">معادل عیار ۸۰۰:</span>
              <span className="font-black text-cyan-600 dark:text-cyan-400">
                {formatWeight(summary.platinum.convertedWeight)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-cyan-100 pt-1.5 dark:border-cyan-900/30">
              <span className="text-slate-500 dark:text-slate-400 font-medium">مجموع اجرت:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {formatMoney(
                  effectiveCurrency === 'IRT'
                    ? convertRialToToman(summary.platinum.totalWage)
                    : summary.platinum.totalWage,
                )}{' '}
                {currencySuffix}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {/* Search */}
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="جستجو در نام کالا، کد یا محل نگهداری..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-amber-400 dark:focus:bg-slate-800"
          />
          <Search
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>

        {/* Metal filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-1 text-xs font-bold text-slate-500 dark:text-slate-400">فلز:</span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'gold', label: 'طلا' },
            { id: 'silver', label: 'نقره' },
            { id: 'platinum', label: 'پلاتین' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterMetal(tab.id);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 font-bold transition ${
                filterMetal === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Wage mode filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="px-1 text-xs font-bold text-slate-500 dark:text-slate-400">نوع اجرت:</span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'per_gram', label: 'هر گرم' },
            { id: 'per_item', label: 'هر عدد' },
            { id: 'percentage', label: 'درصدی (٪)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilterWageMode(tab.id);
                setPage(1);
              }}
              className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                filterWageMode === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Records Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3.5 font-black">کد ردیف</th>
                <th className="px-4 py-3.5 font-black">نام کالا / مصنوع</th>
                <th className="px-4 py-3.5 font-black">فلز</th>
                <th className="px-4 py-3.5 font-black">تعداد</th>
                <th className="px-4 py-3.5 font-black">وزن خام (گرم)</th>
                <th className="px-4 py-3.5 font-black">عیار</th>
                <th className="px-4 py-3.5 font-black">وزن معادل پایه</th>
                <th className="px-4 py-3.5 font-black">اجرت و نوع</th>
                <th className="px-4 py-3.5 font-black">مجموع اجرت</th>
                <th className="px-4 py-3.5 font-black">ارزش‌گذاری کل</th>
                <th className="px-4 py-3.5 font-black">محل نگهداری</th>
                <th className="px-4 py-3.5 font-black">تاریخ ثبت</th>
                <th className="px-4 py-3.5 text-center font-black">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Sparkles size={32} className="stroke-1 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs font-bold">هیچ رکوردی برای موجودی اولیه کارساخته یافت نشد.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const metalCfg = metalLabels[item.metal] || metalLabels.gold;
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      {/* Code */}
                      <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-500">
                        {item.code || '—'}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-black text-slate-900 dark:text-white">
                          {item.name}
                        </div>
                        {item.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </td>

                      {/* Metal */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-black ${metalCfg.badgeClass}`}
                        >
                          <span>{metalCfg.label}</span>
                          <span className="font-mono text-[9px] opacity-75">({metalCfg.symbol})</span>
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        {item.quantity.toLocaleString('fa-IR')} عدد
                      </td>

                      {/* Raw Weight */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        {formatWeight(item.rawWeight)}
                      </td>

                      {/* Purity */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-600 dark:text-slate-300">
                        {item.purity}
                      </td>

                      {/* Converted Weight */}
                      <td className="px-4 py-3 font-mono font-black text-amber-600 dark:text-amber-400">
                        {formatWeight(item.convertedWeight)}
                        <span className="mr-1 text-[10px] text-slate-400">({item.baseKarat})</span>
                      </td>

                      {/* Wage & Mode */}
                      <td className="px-4 py-3">
                        {item.wageMode === 'percentage' ? (
                          <div className="font-mono font-black text-amber-600 dark:text-amber-400">
                            {item.wage} ٪
                          </div>
                        ) : item.wageCurrencyCode ? (
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {item.wage.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              {item.wageCurrencySymbol || item.wageCurrencyCode}
                            </span>
                          </div>
                        ) : (
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatMoney(
                              effectiveCurrency === 'IRT'
                                ? convertRialToToman(item.wage)
                                : item.wage,
                            )}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {item.wageMode === 'percentage'
                            ? 'درصدی از فلز'
                            : item.wageMode === 'per_gram'
                            ? 'هر گرم'
                            : 'هر عدد'}
                        </span>
                      </td>

                      {/* Total Wage */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {item.wageCurrencyCode ? (
                          <div>
                            <div className="text-amber-600 dark:text-amber-400">
                              {(item.wageCurrencyAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
                              {item.wageCurrencySymbol || item.wageCurrencyCode}
                            </div>
                            {item.totalWage > 0 && (
                              <div className="text-[11px] text-slate-400 font-normal">
                                {formatMoney(
                                  effectiveCurrency === 'IRT'
                                    ? convertRialToToman(item.totalWage)
                                    : item.totalWage,
                                )}{' '}
                                {currencySuffix}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {formatMoney(
                              effectiveCurrency === 'IRT'
                                ? convertRialToToman(item.totalWage)
                                : item.totalWage,
                            )}{' '}
                            {currencySuffix}
                          </>
                        )}
                      </td>

                      {/* Total Valuation */}
                      <td className="px-4 py-3">
                        {item.totalAmount > 0 ? (
                          <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {formatMoney(
                              effectiveCurrency === 'IRT'
                                ? convertRialToToman(item.totalAmount)
                                : item.totalAmount,
                            )}{' '}
                            {currencySuffix}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                        {item.currencyCode && item.currencyAmount > 0 && (
                          <div className="text-[10px] text-slate-400">
                            {formatMoney(item.currencyAmount)} {item.currencySymbol || item.currencyCode}
                          </div>
                        )}
                      </td>

                      {/* Storage Location */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {item.storageLocation || '—'}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {item.date || '—'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800 dark:hover:text-amber-400"
                            title="ویرایش"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item.id, item.name)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPerPage}
          itemLabel="قلم کارساخته"
        />
      </div>

      {/* Modal for Create/Edit */}
      <InitialWorkmanshipInventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editItem={editingItem}
        onSuccess={() => void fetchInventory()}
      />
    </div>
  );
}
