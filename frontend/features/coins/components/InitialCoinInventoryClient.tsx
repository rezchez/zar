'use client';

import { Calendar, ChevronRight, Coins, Edit3, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';

import InitialCoinInventoryModal, { type CoinInventoryEditItem } from './InitialCoinInventoryModal';

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
  const [items, setItems] = useState<CoinInventoryRecordItem[]>(initialInventory);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CoinInventoryEditItem | null>(null);

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
    <div dir="rtl" className="mx-auto max-w-5xl space-y-6">
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
          {/* Section 4: Refresh Button */}
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

          {/* Section 4: Add Button */}
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

      {/* List / Compact Grid Content (Section 3 & 20: Compact cards) */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Coins size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            هنوز هیچ موجودی اولیه‌ای برای مسکوکات و شمش ثبت نشده است
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            با کلیک روی دکمه زیر می‌توانید اولین موجودی اولیه مسکوکات یا شمش طلا و نقره خود را ثبت کنید.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-xs transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>افزودن اولین مورد</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
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
                      <h2 className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-1">
                        {item.itemName}
                      </h2>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {item.nature === 'bullion' ? 'شمش' : 'سکه'}
                        </span>
                        <span>•</span>
                        <span>{metalLabels[item.metal] || 'طلا'}</span>
                        <span>•</span>
                        <span>عیار {item.purity}</span>
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
                      {item.quantity} عدد ({item.totalWeight} گرم)
                    </span>
                  </div>

                  <div className="rounded-lg bg-amber-500/10 p-2 dark:bg-amber-500/15">
                    <span className="block text-[9px] font-bold text-amber-700 dark:text-amber-300">ارزش کل</span>
                    <span className="mt-0.5 block font-mono text-[11px] font-black text-amber-900 dark:text-amber-200">
                      {item.totalAmount > 0 ? item.totalAmount.toLocaleString('fa-IR') : '۰'}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}
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
