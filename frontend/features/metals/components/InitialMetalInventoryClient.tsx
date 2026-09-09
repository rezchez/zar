'use client';

import {
  Calendar,
  ChevronRight,
  Edit3,
  Flame,
  FolderTree,
  Plus,
  RefreshCw,
  Scale,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import InitialMetalInventoryModal from './InitialMetalInventoryModal';
import { useAppSettings } from '@/src/components/SettingsProvider';
import {
  type MetalOpeningRecord,
  type MultiMetalSummary,
} from '@/lib/metal-inventory';
import { convertRialToToman } from '@/lib/money';

export type InitialMetalInventoryClientProps = {
  initialItems?: MetalOpeningRecord[];
  initialSummary?: MultiMetalSummary | null;
};

const EMPTY_SUMMARY: MultiMetalSummary = {
  gold: { rawOpening: 0, convertedOpening: 0, rawInflow: 0, rawOutflow: 0, currentRawBalance: 0, currentConvertedBalance: 0, openingCount: 0 },
  silver: { rawOpening: 0, convertedOpening: 0, rawInflow: 0, rawOutflow: 0, currentRawBalance: 0, currentConvertedBalance: 0, openingCount: 0 },
  platinum: { rawOpening: 0, convertedOpening: 0, rawInflow: 0, rawOutflow: 0, currentRawBalance: 0, currentConvertedBalance: 0, openingCount: 0 },
};

export default function InitialMetalInventoryClient({
  initialItems = [],
  initialSummary = null,
}: InitialMetalInventoryClientProps) {
  const { formatWeight, settings } = useAppSettings();
  const effectiveCurrency = (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [items, setItems] = useState<MetalOpeningRecord[]>(initialItems);
  const [summary, setSummary] = useState<MultiMetalSummary>(initialSummary || EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [filterMetal, setFilterMetal] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MetalOpeningRecord | null>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/metals', { cache: 'no-store' });
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

  const handleOpenEdit = (item: MetalOpeningRecord) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این موجودی اولیه فلز اطمینان دارید؟')) return;

    try {
      const res = await fetch(`/api/accounting/opening/metals?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        void fetchInventory();
      }
    } catch {
      //
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterMetal !== 'all' && item.metal !== filterMetal) return false;
      if (filterType !== 'all' && item.inventoryType !== filterType) return false;
      return true;
    });
  }, [items, filterMetal, filterType]);

  const metalLabels: Record<string, { label: string; symbol: string; badgeClass: string }> = {
    gold: {
      label: 'طلا',
      symbol: 'Au',
      badgeClass: 'bg-amber-500/15 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    },
    silver: {
      label: 'نقره',
      symbol: 'Ag',
      badgeClass: 'bg-slate-200/80 text-slate-800 dark:bg-slate-700/60 dark:text-slate-200 border-slate-300 dark:border-slate-600',
    },
    platinum: {
      label: 'پلاتین',
      symbol: 'Pt',
      badgeClass: 'bg-cyan-500/15 text-cyan-800 dark:bg-cyan-500/25 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800',
    },
  };

  const inventoryTypeLabels: Record<string, string> = {
    conditional_melted: 'آبشده شرطی',
    miscellaneous_melted: 'آبشده متفرقه',
    general_metal: 'موجودی فلز',
  };

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6">
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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                موجودی اول دوره فلزات و آبشده
              </h1>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-black text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                طلا، نقره و پلاتین
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ثبت و مدیریت تراز پایه آبشده شرطی، آبشده متفرقه و موجودی پایه فلزات
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1130"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FolderTree size={16} className="text-amber-600 dark:text-amber-400" />
            <span>مشاهده در درختواره (۱۱۳۰)</span>
          </Link>

          <button
            type="button"
            onClick={() => void fetchInventory()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 disabled:opacity-50"
            title="به‌روزرسانی"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400"
          >
            <Plus size={16} className="stroke-[2.5]" />
            <span>ثبت موجودی اولیه جدید</span>
          </button>
        </div>
      </div>

      {/* Multi-Metal KPI Summaries (Gold, Silver, Platinum strictly separated) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Gold Card */}
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-xs dark:border-amber-900/30 dark:from-amber-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Flame size={20} className="stroke-[2.2]" />
              <span className="font-black text-sm">موجودی اول دوره طلا (Au)</span>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
              {summary.gold.openingCount.toLocaleString('fa-IR')} رکورد
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">وزن خام:</span>
              <span className="font-black text-sm text-slate-900 dark:text-white">
                {formatWeight(summary.gold.rawOpening)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-amber-100 pt-2 dark:border-amber-900/30">
              <span className="text-slate-500 dark:text-slate-400 font-medium">معادل پایه ۷۵۰:</span>
              <span className="font-black text-sm text-amber-600 dark:text-amber-400">
                {formatWeight(summary.gold.convertedOpening)} گرم
              </span>
            </div>
          </div>
        </div>

        {/* Silver Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 shadow-xs dark:border-slate-800 dark:from-slate-800/30 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <Scale size={20} className="stroke-[2.2]" />
              <span className="font-black text-sm">موجودی اول دوره نقره (Ag)</span>
            </div>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {summary.silver.openingCount.toLocaleString('fa-IR')} رکورد
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">وزن خام:</span>
              <span className="font-black text-sm text-slate-900 dark:text-white">
                {formatWeight(summary.silver.rawOpening)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-slate-100 pt-2 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 font-medium">معادل پایه ۹۹۹:</span>
              <span className="font-black text-sm text-slate-700 dark:text-slate-200">
                {formatWeight(summary.silver.convertedOpening)} گرم
              </span>
            </div>
          </div>
        </div>

        {/* Platinum Card */}
        <div className="rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/50 to-white p-5 shadow-xs dark:border-cyan-900/30 dark:from-cyan-950/20 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
              <Flame size={20} className="stroke-[2.2]" />
              <span className="font-black text-sm">موجودی اول دوره پلاتین (Pt)</span>
            </div>
            <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-extrabold text-cyan-700 dark:text-cyan-300">
              {summary.platinum.openingCount.toLocaleString('fa-IR')} رکورد
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">وزن خام:</span>
              <span className="font-black text-sm text-slate-900 dark:text-white">
                {formatWeight(summary.platinum.rawOpening)} گرم
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs border-t border-cyan-100 pt-2 dark:border-cyan-900/30">
              <span className="text-slate-500 dark:text-slate-400 font-medium">معادل پایه ۹۵۰:</span>
              <span className="font-black text-sm text-cyan-600 dark:text-cyan-400">
                {formatWeight(summary.platinum.convertedOpening)} گرم
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="px-2 text-xs font-bold text-slate-500 dark:text-slate-400">فیلتر فلز:</span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'gold', label: 'طلا (Au)' },
            { id: 'silver', label: 'نقره (Ag)' },
            { id: 'platinum', label: 'پلاتین (Pt)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMetal(tab.id)}
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

        <div className="flex items-center gap-1.5 text-xs">
          <span className="px-2 text-xs font-bold text-slate-500 dark:text-slate-400">نوع موجودی:</span>
          {[
            { id: 'all', label: 'همه' },
            { id: 'conditional_melted', label: 'آبشده شرطی' },
            { id: 'miscellaneous_melted', label: 'آبشده متفرقه' },
            { id: 'general_metal', label: 'موجودی فلز' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                filterType === tab.id
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
                <th className="px-4 py-3.5 font-black">فلز</th>
                <th className="px-4 py-3.5 font-black">نوع موجودی</th>
                <th className="px-4 py-3.5 font-black">مشخصات ری‌گیری / انگ</th>
                <th className="px-4 py-3.5 font-black">وزن خام (گرم)</th>
                <th className="px-4 py-3.5 font-black">عیار</th>
                <th className="px-4 py-3.5 font-black">وزن معادل (پایه)</th>
                <th className="px-4 py-3.5 font-black">ارزش‌گذاری ریالی</th>
                <th className="px-4 py-3.5 font-black">تاریخ ثبت</th>
                <th className="px-4 py-3.5 font-black">توضیحات</th>
                <th className="px-4 py-3.5 text-center font-black">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium dark:divide-slate-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Flame size={32} className="stroke-1 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs font-bold">هیچ رکوردی برای موجودی اولیه فلزات یافت نشد.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const metalCfg = metalLabels[item.metal] || metalLabels.gold;
                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                    >
                      {/* Metal */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-black ${metalCfg.badgeClass}`}
                        >
                          <span>{metalCfg.label}</span>
                          <span className="font-mono text-[9px] opacity-75">({metalCfg.symbol})</span>
                        </span>
                      </td>

                      {/* Inventory Type */}
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                        {inventoryTypeLabels[item.inventoryType] || item.inventoryType}
                      </td>

                      {/* Lab & Stamp */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {item.inventoryType === 'conditional_melted' ? (
                          <div className="flex flex-col text-[11px]">
                            <span className="font-black text-slate-900 dark:text-white">
                              انگ: {item.stampNumber || '—'}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">
                              {item.labName || 'نامشخص'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Raw Weight */}
                      <td className="px-4 py-3 font-black text-slate-900 dark:text-white">
                        {formatWeight(item.rawWeight)}
                      </td>

                      {/* Purity */}
                      <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">
                        {item.purity.toLocaleString('fa-IR')}
                      </td>

                      {/* Converted Weight */}
                      <td className="px-4 py-3 font-black text-amber-600 dark:text-amber-400">
                        {formatWeight(item.convertedWeight)}
                      </td>

                      {/* Valuation */}
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {item.totalAmount > 0 ? (
                          <span className="font-bold">
                            {effectiveCurrency === 'IRT'
                              ? convertRialToToman(item.totalAmount).toLocaleString('fa-IR')
                              : item.totalAmount.toLocaleString('fa-IR')}{' '}
                            <span className="text-[10px] text-slate-400">{currencySuffix}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{item.date}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="max-w-xs truncate px-4 py-3 text-slate-500 dark:text-slate-400" title={item.description}>
                        {item.description || '—'}
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
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
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
      </div>

      {/* Modal */}
      <InitialMetalInventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editItem={editingItem}
        onSuccess={() => void fetchInventory()}
      />
    </div>
  );
}
