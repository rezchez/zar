'use client';

import {
  Award,
  ChevronRight,
  Edit3,
  Eye,
  FolderTree,
  Gem,
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
import {
  CLARITY_GRADES,
  CUT_GRADES,
  GEMSTONE_SHAPES,
  GEMSTONE_SPECIES,
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
      if (selectedTab === 'diamonds' && item.category !== 'diamond') return false;
      if (selectedTab === 'sapphires' && item.species !== 'corundum_sapphire') return false;
      if (selectedTab === 'rubies' && item.species !== 'corundum_ruby') return false;
      if (selectedTab === 'emeralds' && item.species !== 'beryl_emerald') return false;
      if (selectedTab === 'colored' && item.category !== 'colored_gemstone') return false;
      if (selectedTab === 'parcels' && item.mode !== 'parcel') return false;

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
            { id: 'diamonds', label: 'الماس‌ها' },
            { id: 'sapphires', label: 'یاقوت کبود' },
            { id: 'rubies', label: 'یاقوت سرخ' },
            { id: 'emeralds', label: 'زمرد' },
            { id: 'colored', label: 'سایر سنگ‌های رنگی' },
            { id: 'parcels', label: 'بسته‌ای / بار سنگ' },
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

      {/* Gemstone Data Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <th className="px-5 py-3.5 font-bold">کد و عنوان گوهر</th>
                <th className="px-4 py-3.5 font-bold">طبقه‌بندی و گونه</th>
                <th className="px-4 py-3.5 font-bold">مشخصات درجه‌بندی</th>
                <th className="px-4 py-3.5 font-bold">تراش و شکل</th>
                <th className="px-4 py-3.5 font-bold">وزن (قیراط / گرم)</th>
                <th className="px-4 py-3.5 font-bold">شناسنامه / آزمایشگاه</th>
                <th className="px-4 py-3.5 font-bold">ارزش دفتری</th>
                <th className="px-5 py-3.5 text-center font-bold">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
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
                      {/* Code & Title */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-black text-slate-900 dark:text-white">
                              {item.itemName || speciesObj?.nameFa || 'سنگ بدون نام'}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {item.internalCode && (
                                <span className="rounded-md bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {item.internalCode}
                                </span>
                              )}
                              {item.mode === 'parcel' && (
                                <span className="rounded-md bg-purple-500/10 px-1.5 py-0.2 text-[10px] font-bold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                                  بسته‌ای ({item.pieces ?? 1} قطعه)
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
                              {item.diamondType === 'lab_grown' ? 'الماس آزمایشگاهی' : 'الماس طبیعی'}
                            </span>
                          ) : (
                            <span>{speciesObj?.nameFa || item.species}</span>
                          )}
                        </div>
                        {item.variety && (
                          <div className="text-[11px] text-slate-400">{item.variety}</div>
                        )}
                      </td>

                      {/* Grading / Color */}
                      <td className="px-4 py-4">
                        {isDiamond ? (
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

                      {/* Weights */}
                      <td className="px-4 py-4">
                        <div className="font-mono font-black text-cyan-600 dark:text-cyan-400">
                          {formatCaratWeight(item.weightCt)} ct
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {formatGramWeight(item.weightG)} g
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
                          {formatNumberWithCommas(convertRialToToman(item.totalCost))} تومان
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.valuationMethod === 'per_carat'
                            ? 'بر مبنای قیراط'
                            : item.valuationMethod === 'per_gram'
                            ? 'بر مبنای گرم'
                            : 'مبلغ مقطوع'}
                        </div>
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
