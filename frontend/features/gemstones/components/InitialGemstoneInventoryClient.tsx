'use client';

import {
  Award,
  ChevronRight,
  Edit3,
  Eye,
  FolderTree,
  Gem,
  Layers,
  Package,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import GemstoneDetailModal from './GemstoneDetailModal';
import InitialGemstoneInventoryModal from './InitialGemstoneInventoryModal';
import MergeParcelsModal from './MergeParcelsModal';
import {
  CLARITY_GRADES,
  CUT_GRADES,
  GEMSTONE_SHAPES,
  GEMSTONE_SPECIES,
  ROOT_CATEGORIES,
  type GemstoneInventorySummary,
  type GemstoneOpeningRecord,
} from '@/lib/gemstone';
import { formatCaratWeight, formatGramWeight } from '@/lib/gemstone-weight';
import { convertRialToToman, formatNumberWithCommas } from '@/lib/money';

export type InitialGemstoneInventoryClientProps = {
  initialItems?: GemstoneOpeningRecord[];
  initialSummary?: GemstoneInventorySummary | null;
};

const EMPTY_SUMMARY: GemstoneInventorySummary = {
  totalItems: 0,
  totalWeightCt: 0,
  totalWeightG: 0,
  totalValuation: 0,
  byCategory: {
    diamonds: { count: 0, totalWeightCt: 0, totalValuation: 0 },
    coloredStones: { count: 0, totalWeightCt: 0, totalValuation: 0 },
  },
  byMode: {
    singleStone: { count: 0, totalWeightCt: 0, totalValuation: 0 },
    parcel: { count: 0, totalWeightCt: 0, totalValuation: 0, totalPieces: 0 },
  },
};

export default function InitialGemstoneInventoryClient({
  initialItems = [],
  initialSummary = null,
}: InitialGemstoneInventoryClientProps) {
  const [items, setItems] = useState<GemstoneOpeningRecord[]>(initialItems);
  const [summary, setSummary] = useState<GemstoneInventorySummary>(initialSummary || EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GemstoneOpeningRecord | null>(null);
  const [selectedGemstoneForDetail, setSelectedGemstoneForDetail] = useState<GemstoneOpeningRecord | null>(null);

  // Parcel merging state
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  const selectedParcels = useMemo(
    () => items.filter((it) => selectedParcelIds.includes(it.id)),
    [items, selectedParcelIds]
  );

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/gemstones', { cache: 'no-store' });
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

  const handleOpenEdit = (item: GemstoneOpeningRecord) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleOpenDetail = (item: GemstoneOpeningRecord) => {
    setSelectedGemstoneForDetail(item);
    setDetailModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('آیا از حذف این موجودی اولیه سنگ و سند حسابداری مربوطه اطمینان دارید؟')) return;

    try {
      const res = await fetch(`/api/accounting/opening/gemstones?id=${encodeURIComponent(id)}`, {
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
      // Tab filter
      if (selectedTab === 'natural_diamonds') {
        if (item.category !== 'diamond' || item.diamondType === 'lab_grown' || item.rootCategory === 'laboratory_grown') return false;
      }
      if (selectedTab === 'lab_diamonds') {
        if (item.category !== 'diamond' || (item.diamondType !== 'lab_grown' && item.rootCategory !== 'laboratory_grown')) return false;
      }
      if (selectedTab === 'parcels' && item.mode !== 'parcel') return false;
      if (selectedTab === 'rubies_sapphires') {
        if (item.species !== 'corundum_ruby' && item.species !== 'corundum_sapphire') return false;
      }
      if (selectedTab === 'emeralds' && item.species !== 'beryl_emerald') return false;
      if (selectedTab === 'colored') {
        if (item.category !== 'colored_gemstone' && item.category !== 'other_gemstone') return false;
      }
      if (selectedTab === 'simulants') {
        if (item.rootCategory !== 'simulant' && !item.variety?.toLowerCase().includes('cz')) return false;
      }

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = (item.itemName || '').toLowerCase().includes(q);
        const matchesCode = (item.internalCode || '').toLowerCase().includes(q);
        const matchesReport = (item.certificateReportNumber || '').toLowerCase().includes(q);
        const matchesSpecies = (item.species || '').toLowerCase().includes(q);
        const matchesVariety = (item.variety || '').toLowerCase().includes(q);
        const matchesShape = (item.shape || '').toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);

        if (
          !matchesName &&
          !matchesCode &&
          !matchesReport &&
          !matchesSpecies &&
          !matchesVariety &&
          !matchesShape &&
          !matchesDesc
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, selectedTab, searchQuery]);

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
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                موجودی اول دوره سنگ‌های قیمتی و الماس
              </h1>
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-black text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
                الماس و سنگ‌های قیمتی
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ثبت و مدیریت تراز پایه انواع الماس‌های شناسنامه‌دار، سنگ‌های رنگی، یاقوت، زمرد و بسته‌ای
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1130"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FolderTree size={16} className="text-cyan-600 dark:text-cyan-400" />
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

          {selectedParcels.length >= 2 && (
            <button
              type="button"
              onClick={() => setMergeModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 transition-all animate-pulse"
            >
              <Layers size={16} />
              <span>ترکیب بارخانه‌های انتخابی ({selectedParcels.length.toLocaleString('fa-IR')} بسته)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600"
          >
            <Plus size={16} />
            <span>ثبت سنگ جدید</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Items Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">تعداد کل اقلام</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Package size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalItems.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-400">ردیف</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">اقلام ثبت‌شده در انبار گوهرها</p>
        </div>

        {/* Total Weight Carats */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مجموع وزن به قیراط</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <Gem size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-cyan-600 dark:text-cyan-400">
            {formatCaratWeight(summary.totalWeightCt)} <span className="text-xs font-normal text-slate-400">ct</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">مجموع قیراط کل سنگ‌ها</p>
        </div>

        {/* Total Weight Grams */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">معادل وزن به گرم</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Scale size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {formatGramWeight(summary.totalWeightG)} <span className="text-xs font-normal text-slate-400">g</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">محاسبه بر اساس ۱ct = ۰.۲g</p>
        </div>

        {/* Total Valuation Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">ارزش کل ریالی</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatNumberWithCommas(convertRialToToman(summary.totalValuation))}{' '}
            <span className="text-xs font-normal text-slate-400">تومان</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {formatNumberWithCommas(summary.totalValuation)} ریال (کد ۱۱۳۰۵۰)
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-800 dark:bg-slate-900">
          {[
            { id: 'all', label: 'همه اقلام' },
            { id: 'natural_diamonds', label: 'الماس طبیعی' },
            { id: 'lab_diamonds', label: 'الماس آزمایشگاهی (CVD/HPHT)' },
            { id: 'parcels', label: 'بارخانه‌های ریز (Parcels)' },
            { id: 'rubies_sapphires', label: 'یاقوت سرخ و کبود' },
            { id: 'emeralds', label: 'زمرد' },
            { id: 'colored', label: 'سایر سنگ‌های رنگی' },
            { id: 'simulants', label: 'بدل / اتمی (CZ)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                selectedTab === tab.id
                  ? 'bg-cyan-500 text-white shadow-xs dark:bg-cyan-600'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس شماره شناسنامه، کد، نام..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2 pr-10 pl-4 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
        </div>
      </div>

      {/* Selection Banner for Parcel Merging */}
      {selectedParcels.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-200 bg-purple-50/80 p-3.5 px-4 dark:border-purple-900/60 dark:bg-purple-950/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-purple-600 text-white">
              <Layers size={15} />
            </div>
            <div>
              <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                {selectedParcels.length.toLocaleString('fa-IR')} بارخانه جهت ادغام و یکپارچه‌سازی انتخاب شده است
              </span>
              <p className="text-[11px] text-purple-700 dark:text-purple-300">
                {selectedParcels.length >= 2
                  ? 'جهت بررسی همگنی و محاسبه میانگین موزون (WAC)، دکمه زیر را انتخاب کنید.'
                  : 'حداقل ۱ بارخانه دیگر را جهت ادغام انتخاب کنید.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedParcelIds([])}
              className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={() => setMergeModalOpen(true)}
              disabled={selectedParcels.length < 2}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 disabled:opacity-50"
            >
              <Layers size={14} />
              <span>ادغام بارخانه‌ها (WAC)</span>
            </button>
          </div>
        </div>
      )}

      {/* Gemstone Data Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="w-10 px-3 py-3.5 text-center">انتخاب</th>
                <th className="px-5 py-3.5">عنوان و کد گوهر</th>
                <th className="px-4 py-3.5">گونه و دسته‌بندی</th>
                <th className="px-4 py-3.5">درجه‌بندی رنگ و پاکی</th>
                <th className="px-4 py-3.5">تراش و فرم</th>
                <th className="px-4 py-3.5">وزن (ct / g)</th>
                <th className="px-4 py-3.5">شناسنامه و اصالت</th>
                <th className="px-4 py-3.5">بهای تمام‌شده و WAC</th>
                <th className="px-5 py-3.5 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Gem size={32} className="text-slate-300 dark:text-slate-600" />
                      <span className="font-bold">هیچ سنگ قیمتی در این بخش ثبت نشده است</span>
                      <p className="text-[11px] text-slate-400">
                        برای ثبت اولین موجودی اولیه گوهر، دکمه «ثبت سنگ جدید» را انتخاب کنید.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isDiamond = item.category === 'diamond';
                  const speciesObj = GEMSTONE_SPECIES.find((s) => s.id === item.species);
                  const shapeObj = GEMSTONE_SHAPES.find((sh) => sh.id === item.shape);

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      {/* Checkbox for parcel merge */}
                      <td className="px-3 py-4 text-center">
                        {item.mode === 'parcel' ? (
                          <input
                            type="checkbox"
                            checked={selectedParcelIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedParcelIds((prev) => [...prev, item.id]);
                              } else {
                                setSelectedParcelIds((prev) => prev.filter((id) => id !== item.id));
                              }
                            }}
                            className="size-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 dark:border-slate-700"
                            title="انتخاب جهت ادغام بارخانه"
                          />
                        ) : (
                          <span className="text-slate-300 dark:text-slate-700">—</span>
                        )}
                      </td>

                      {/* Code & Title */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-black text-slate-900 dark:text-white">
                              {item.itemName || speciesObj?.nameFa || 'سنگ بدون نام'}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.internalCode && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {item.internalCode}
                                </span>
                              )}
                              {item.rootCategory && (
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[9px] font-black ${
                                    item.rootCategory === 'laboratory_grown'
                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                      : item.rootCategory === 'simulant'
                                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
                                      : item.rootCategory === 'synthetic'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                      : item.rootCategory === 'treated_natural'
                                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  }`}
                                >
                                  {item.rootCategory === 'laboratory_grown'
                                    ? `آزمایشگاهی (${item.growthMethod || 'CVD'})`
                                    : item.rootCategory === 'simulant'
                                    ? 'بدل / اتمی (CZ)'
                                    : item.rootCategory === 'synthetic'
                                    ? 'سنتتیک'
                                    : item.rootCategory === 'treated_natural'
                                    ? 'بهسازی‌شده'
                                    : 'طبیعی'}
                                </span>
                              )}
                              {item.mode === 'parcel' && (
                                <span className="rounded-md bg-purple-500/10 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                                  بسته‌ای ({item.pieces ?? 1} عدد)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Classification & Species */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {isDiamond ? (
                            <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                              <Sparkles size={12} />
                              {item.diamondType === 'lab_grown' || item.rootCategory === 'laboratory_grown'
                                ? `الماس آزمایشگاهی (${item.growthMethod || 'CVD'})`
                                : 'الماس طبیعی'}
                            </span>
                          ) : (
                            <span>{speciesObj?.nameFa || item.species}</span>
                          )}
                        </div>
                        {item.variety && (
                          <div className="text-[11px] text-slate-400">{item.variety}</div>
                        )}
                        {item.mode === 'parcel' && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {item.sieveSize && (
                              <span className="rounded bg-indigo-50 px-1.5 py-0.2 font-mono text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                الک: {item.sieveSize}
                              </span>
                            )}
                            {item.sizeMin !== undefined && item.sizeMax !== undefined && (
                              <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                                سایز: {item.sizeMin}–{item.sizeMax} {item.sizeUnit || 'ct'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Grading / Color */}
                      <td className="px-4 py-4">
                        {item.mode === 'parcel' ? (
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300">
                              رنگ: {item.colorRangeDisplay || (item.colorMin && item.colorMax ? `${item.colorMin}–${item.colorMax}` : '—')}
                            </span>
                            <div className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                              پاکی: {item.clarityRangeDisplay || (item.clarityMin && item.clarityMax ? `${item.clarityMin}–${item.clarityMax}` : '—')}
                            </div>
                          </div>
                        ) : isDiamond ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              رنگ: {item.colorMode === 'fancy' ? `Fancy ${item.fancyColorHue || ''}` : item.colorGrade || '—'}
                            </span>
                            <div className="text-[11px] text-slate-400">
                              پاکی: {item.clarityGrade || '—'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {item.colorHue || '—'}
                            </span>
                            <div className="text-[11px] text-slate-400">
                              {item.treatments === 'none_detected' ? 'طبیعی بدون بهسازی' : 'بهسازی‌شده'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Shape */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {shapeObj?.nameFa || item.shape || 'نامشخص'}
                        </div>
                        {item.measurementsLength && item.measurementsWidth && (
                          <div className="font-mono text-[10px] text-slate-400">
                            {item.measurementsLength}×{item.measurementsWidth}mm
                          </div>
                        )}
                      </td>

                      {/* Weights & Count */}
                      <td className="px-4 py-4">
                        <div className="font-mono font-black text-cyan-600 dark:text-cyan-400">
                          {formatCaratWeight(item.weightCt)} ct
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {formatGramWeight(item.weightG)} g
                          {item.pieces !== undefined && item.pieces > 1 && (
                            <span className="mr-1.5 font-sans font-bold text-slate-600 dark:text-slate-300">
                              ({item.pieces} عدد)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Certificate */}
                      <td className="px-4 py-4">
                        {item.certificateLab && item.certificateLab !== 'none' ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
                                <Award size={12} />
                                {item.certificateLab}
                              </span>
                              {item.verificationStatus === 'verified' && (
                                <span className="size-1.5 rounded-full bg-emerald-500" title="استعلام تایید شده" />
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {item.certificateReportNumber || '—'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">بدون شناسنامه</span>
                        )}
                      </td>

                      {/* Valuation */}
                      <td className="px-4 py-4">
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatNumberWithCommas(convertRialToToman(item.totalCost || item.totalAmount || 0))} تومان
                        </div>
                        {item.mode === 'parcel' ? (
                          <div className="text-[10px] text-slate-500 font-mono">
                            WAC: {item.weightCt > 0 ? formatNumberWithCommas(convertRialToToman(Math.round((item.totalCost || item.totalAmount || 0) / item.weightCt))) : '—'} ت/ct
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">
                            {item.valuationMethod === 'per_carat'
                              ? 'بر مبنای قیراط'
                              : item.valuationMethod === 'per_gram'
                              ? 'بر مبنای گرم'
                              : 'مبلغ مقطوع'}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 dark:hover:bg-slate-800 dark:hover:text-cyan-400"
                            title="مشاهده شناسنامه و مشخصات کامل"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                            title="ویرایش"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(item.id)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                            title="حذف"
                          >
                            <Trash2 size={16} />
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

      {/* Creation & Edit Modal */}
      <InitialGemstoneInventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => void fetchInventory()}
        editingItem={editingItem}
        existingParcels={items.filter((it) => it.mode === 'parcel')}
      />

      {/* Merge Parcels Modal */}
      <MergeParcelsModal
        isOpen={mergeModalOpen}
        onClose={() => setMergeModalOpen(false)}
        onSuccess={() => {
          setSelectedParcelIds([]);
          setMergeModalOpen(false);
          void fetchInventory();
        }}
        selectedParcels={selectedParcels}
      />

      {/* Detailed View Modal */}
      <GemstoneDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        gemstone={selectedGemstoneForDetail}
      />
    </div>
  );
}
