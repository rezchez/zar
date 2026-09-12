'use client';

import {
  AlertTriangle,
  Boxes,
  Calendar,
  ChevronRight,
  Edit3,
  FolderTree,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import InitialGoodsInventoryModal from './InitialGoodsInventoryModal';
import {
  GOODS_CATEGORIES,
  ALL_GOODS_CATEGORIES,
  type GoodsCategory,
  type GoodsInventorySummary,
  type GoodsOpeningRecord,
} from '@/lib/goods-inventory';
import { convertRialToToman, formatNumberWithCommas } from '@/lib/money';

export type InitialGoodsInventoryClientProps = {
  initialItems?: GoodsOpeningRecord[];
  initialSummary?: GoodsInventorySummary | null;
};

const EMPTY_SUMMARY: GoodsInventorySummary = {
  totalItems: 0,
  totalValuation: 0,
  byCategory: {
    resin_casting: { category: 'resin_casting', categoryName: 'مواد اولیه و رزین ریخته‌گری', itemCount: 0, totalQuantity: 0, totalAmount: 0 },
    gemstones: { category: 'gemstones', categoryName: 'سنگ، نگین و مروارید', itemCount: 0, totalQuantity: 0, totalAmount: 0 },
    workshop_tools: { category: 'workshop_tools', categoryName: 'ملزومات مصرفی و ابزار کارگاهی', itemCount: 0, totalQuantity: 0, totalAmount: 0 },
    packaging: { category: 'packaging', categoryName: 'جعبه و ملزومات بسته‌بندی', itemCount: 0, totalQuantity: 0, totalAmount: 0 },
    general_goods: { category: 'general_goods', categoryName: 'سایر کالاها و ملزومات', itemCount: 0, totalQuantity: 0, totalAmount: 0 },
  },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  AED: 'د.إ',
  TRY: '₺',
  GBP: '£',
  CNY: '¥',
  IRT: 'تومان',
  IRR: 'ریال',
};

export default function InitialGoodsInventoryClient({
  initialItems = [],
  initialSummary = null,
}: InitialGoodsInventoryClientProps) {
  const [items, setItems] = useState<GoodsOpeningRecord[]>(initialItems);
  const [summary, setSummary] = useState<GoodsInventorySummary>(initialSummary || EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GoodsOpeningRecord | null>(null);

  // Delete Confirmation Alert states
  const [deletingItem, setDeletingItem] = useState<GoodsOpeningRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/goods', { cache: 'no-store' });
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

  const handleOpenEdit = (item: GoodsOpeningRecord) => {
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleRequestDelete = (item: GoodsOpeningRecord) => {
    setDeleteError('');
    setDeletingItem(item);
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await fetch(`/api/accounting/opening/goods?id=${encodeURIComponent(deletingItem.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeletingItem(null);
        void fetchInventory();
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.message || 'خطا در حذف موجودی اولیه کالا.');
      }
    } catch {
      setDeleteError('خطای ارتباط با سرور در حذف موجودی.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = item.itemName.toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        const matchesLocation = (item.storageLocation || '').toLowerCase().includes(q);
        const matchesSku = (item.sku || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesLocation && !matchesSku) return false;
      }
      return true;
    });
  }, [items, selectedCategory, searchQuery]);

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
                موجودی اول دوره رزین ریخته‌گری
              </h1>
              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-black text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
                رزین و قالب‌گیری
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              ثبت و مدیریت تراز پایه انواع رزین‌های سه‌بعدی ریخته‌گری طلا و نقره، موم و مواد قالب‌گیری کارگاه (حساب ۱۱۳۰۴۰)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/accounting/chart-of-accounts?focus=1130"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FolderTree size={16} className="text-purple-600 dark:text-purple-400" />
            <span>مشاهده در درختواره (۱۱۳۰۴۰)</span>
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
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
          >
            <Plus size={16} />
            <span>ثبت موجودی اولیه رزین</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Items Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">تعداد کل اقلام رزین</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Package size={18} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalItems.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-400">ردیف</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">اقلام ثبت‌شده اول دوره</p>
        </div>

        {/* Total Valuation Card */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">ارزش کل ریالی</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Sparkles size={18} />
            </div>
          </div>
          <div className="mt-3 text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatNumberWithCommas(convertRialToToman(summary.totalValuation))} <span className="text-xs font-normal text-slate-400">تومان</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {formatNumberWithCommas(summary.totalValuation)} ریال
          </p>
        </div>

        {/* Resin & Casting Summary */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مواد و رزین ریخته‌گری (۱۱۳۰۴۰)</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Boxes size={18} />
            </div>
          </div>
          <div className="mt-3 text-lg font-black text-slate-900 dark:text-white">
            {(summary.byCategory.resin_casting?.itemCount || 0).toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-400">قلم</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            ارزش: {formatNumberWithCommas(convertRialToToman(summary.byCategory.resin_casting?.totalAmount || 0))} تومان
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="جستجوی نام کالا، کد یا قفسه..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-xs font-bold text-slate-900 shadow-2xs placeholder:text-slate-400 transition-all focus:border-purple-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-purple-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-purple-400/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              selectedCategory === 'all'
                ? 'bg-purple-600 text-white dark:bg-purple-500'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            همه دسته‌ها
          </button>
          {Object.entries(GOODS_CATEGORIES).map(([catKey, catMeta]) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                selectedCategory === catKey
                  ? 'bg-purple-600 text-white dark:bg-purple-500'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {catMeta.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-3xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
              <Package size={28} />
            </div>
            <h3 className="mt-4 text-sm font-bold text-slate-800 dark:text-slate-200">
              موجودی اولیه رزینی یافت نشد
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              برای ثبت رزین‌های ریخته‌گری سه‌بعدی و مواد قالب‌گیری روی دکمه «ثبت موجودی اولیه رزین» کلیک کنید.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 dark:bg-purple-500"
            >
              <Plus size={16} />
              <span>ثبت موجودی اولیه رزین</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 pr-6 pl-3 font-bold">#</th>
                  <th className="px-3 py-3.5 font-bold">نام کالا و شرح</th>
                  <th className="px-3 py-3.5 font-bold">دسته‌بندی و کد حساب</th>
                  <th className="px-3 py-3.5 font-bold">مقدار موجودی</th>
                  <th className="px-3 py-3.5 font-bold">ارزش واحد</th>
                  <th className="px-3 py-3.5 font-bold">ارزش کل</th>
                  <th className="px-3 py-3.5 font-bold">محل انبار</th>
                  <th className="px-3 py-3.5 font-bold">تاریخ</th>
                  <th className="py-3.5 pr-3 pl-6 text-left font-bold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredItems.map((item, idx) => {
                  const catMeta = ALL_GOODS_CATEGORIES[item.category] || ALL_GOODS_CATEGORIES.resin_casting;
                  const totalToman = convertRialToToman(item.totalAmount);
                  const unitToman = convertRialToToman(item.unitPrice);
                  const isForeign = Boolean(item.currency && item.currency !== 'IRT' && item.currency !== 'IRR');
                  const currSymbol = (item.currency && CURRENCY_SYMBOLS[item.currency.toUpperCase()]) || item.currency || '';

                  return (
                    <tr key={item.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 pr-6 pl-3 font-semibold text-slate-400">{idx + 1}</td>

                      <td className="px-3 py-3.5 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.itemName}</span>
                          {isForeign && (
                            <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {item.currency}
                            </span>
                          )}
                          {item.sku && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {item.sku}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-[11px] font-normal text-slate-400 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border ${catMeta.badgeColor}`}>
                          {catMeta.name} ({catMeta.accountCode})
                        </span>
                      </td>

                      <td className="px-3 py-3.5 font-bold text-slate-900 dark:text-white">
                        {item.quantity.toLocaleString('fa-IR')} <span className="text-[11px] font-normal text-slate-500">{item.unit}</span>
                      </td>

                      <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">
                        {isForeign && item.foreignUnitPrice ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {item.foreignUnitPrice.toLocaleString('fa-IR')} <span className="text-[11px] font-normal text-slate-500">{currSymbol}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              معادل {formatNumberWithCommas(unitToman)} تومان
                            </div>
                          </div>
                        ) : item.unitPrice > 0 ? (
                          <>
                            <span className="font-semibold">{formatNumberWithCommas(unitToman)}</span> <span className="text-[10px] text-slate-400">تومان</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-3 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                        {isForeign && item.foreignTotalAmount ? (
                          <div>
                            <div>
                              {item.foreignTotalAmount.toLocaleString('fa-IR')} <span className="text-[11px] font-normal">{currSymbol}</span>
                            </div>
                            <div className="text-[10px] font-normal text-slate-400">
                              معادل {formatNumberWithCommas(totalToman)} تومان
                            </div>
                          </div>
                        ) : item.totalAmount > 0 ? (
                          <>
                            <span>{formatNumberWithCommas(totalToman)}</span> <span className="text-[10px] text-slate-400">تومان</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-3 py-3.5 text-slate-500 dark:text-slate-400">
                        {item.storageLocation || '—'}
                      </td>

                      <td className="px-3 py-3.5 text-slate-500 dark:text-slate-400 font-mono">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} />
                          <span>{item.date}</span>
                        </div>
                      </td>

                      <td className="py-3.5 pr-3 pl-6 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-purple-600 dark:hover:bg-slate-800 dark:hover:text-purple-400"
                            title="ویرایش"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestDelete(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Creation and Edit Modal */}
      <InitialGoodsInventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => void fetchInventory()}
        editingItem={editingItem}
      />

      {/* Delete Confirmation Alert Modal */}
      {deletingItem && mounted && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleteLoading) {
              setDeletingItem(null);
              setDeleteError('');
            }
          }}
        >
          <div
            dir="rtl"
            className="relative w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 shadow-2xl dark:border-red-900/40 dark:bg-slate-900 animate-in zoom-in-95 duration-150 text-right"
          >
            <div className="flex items-center gap-3.5 mb-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                <AlertTriangle size={24} className="stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  هشدار تایید حذف موجودی اولیه
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  این عملیات غیرقابل بازگشت است
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/50 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">نام کالا یا رزین:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deletingItem.itemName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">مقدار موجودی:</span>
                <span className="font-bold text-slate-900 dark:text-white">{deletingItem.quantity.toLocaleString('fa-IR')} {deletingItem.unit}</span>
              </div>
              {deletingItem.totalAmount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">ارزش کل:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNumberWithCommas(convertRialToToman(deletingItem.totalAmount))} تومان
                  </span>
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              آیا از حذف موجودی اولیه «<strong className="text-red-600 dark:text-red-400">{deletingItem.itemName}</strong>» اطمینان دارید؟
              <br />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 block">
                با تایید این درخواست، ردیف گردش انبار اول دوره و سند حسابداری دوبل متناظر با آن به‌صورت خودکار حذف خواهد شد.
              </span>
            </p>

            {deleteError && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!deleteLoading) {
                    setDeletingItem(null);
                    setDeleteError('');
                  }
                }}
                disabled={deleteLoading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 cursor-pointer"
              >
                انصراف
              </button>

              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deleteLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>در حال حذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>تایید و حذف موجودی</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
