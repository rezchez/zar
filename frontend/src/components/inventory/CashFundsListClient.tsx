'use client';

import { Banknote, Calendar, ChevronRight, Plus, RefreshCw, Wallet } from 'lucide-react';
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';

import InitialCashInventoryModal from './InitialCashInventoryModal';

export type CashFundItem = {
  id: string;
  name: string;
  currencyId: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  openingBalance: number;
  balance: number;
  openingBalanceDate: string;
};

export default function CashFundsListClient({
  initialFunds = [],
}: {
  initialFunds?: CashFundItem[];
}) {
  const [funds, setFunds] = useState<CashFundItem[]>(initialFunds);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/cash', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.funds)) {
          setFunds(data.funds);
        }
      }
    } catch {
      // Keep existing funds on fetch error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFunds();
  }, [fetchFunds]);

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
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">فهرست صندوق‌های وجه نقد</h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              صندوق‌های معرفیشده و موجودی اولیه به ازای هر ارز
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchFunds}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title="به‌روزرسانی لیست"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">به‌روزرسانی</span>
          </button>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-black text-slate-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>افزودن صندوق جدید</span>
          </button>
        </div>
      </div>

      {/* List / Grid Content */}
      {funds.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Wallet size={28} />
          </div>
          <h2 className="mt-4 text-base font-bold text-slate-800 dark:text-slate-200">
            هنوز هیچ صندوقی ثبت نشده است
          </h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            با کلیک روی دکمه زیر می‌توانید اولین صندوق وجه نقد خود را بر اساس ارزهای معرفیشده ایجاد کنید.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>ایجاد اولین صندوق</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {funds.map((fund) => {
            const currencyLabel = [fund.currencySymbol, fund.currencyCode].filter(Boolean).join(' · ');
            return (
              <article
                key={fund.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:border-amber-500/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  {/* Top Header: Fund Name & Currency */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
                        <Banknote size={22} className="stroke-[2.2]" />
                      </div>
                      <div>
                        {/* 1. نام صندوق */}
                        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {fund.name}
                        </h2>
                        {/* 2. ارز */}
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {fund.currencyName} {currencyLabel ? `(${currencyLabel})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Date section */}
                  {/* 5. تاریخ موجودی اولیه */}
                  <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    <Calendar size={13} className="text-slate-400" />
                    <span>تاریخ موجودی اولیه:</span>
                    <span className="font-mono dir-ltr">{fund.openingBalanceDate || 'ثبت نشده'}</span>
                  </div>

                  {/* Balances Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    {/* 3. موجودی اولیه */}
                    <div className="rounded-xl bg-slate-50/80 p-2.5 dark:bg-slate-800/40">
                      <span className="block text-[10px] font-bold text-slate-400">موجودی اولیه</span>
                      <span className="mt-0.5 block font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                        {Number(fund.openingBalance || 0).toLocaleString('fa-IR')} {fund.currencySymbol || fund.currencyCode}
                      </span>
                    </div>

                    {/* 4. موجودی فعلی */}
                    <div className="rounded-xl bg-amber-500/10 p-2.5 dark:bg-amber-500/15">
                      <span className="block text-[10px] font-bold text-amber-700 dark:text-amber-300">موجودی فعلی</span>
                      <span className="mt-0.5 block font-mono text-sm font-black text-amber-900 dark:text-amber-200">
                        {Number(fund.balance || 0).toLocaleString('fa-IR')} {fund.currencySymbol || fund.currencyCode}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Initial Cash Inventory Modal */}
      <InitialCashInventoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          void fetchFunds();
        }}
      />
    </div>
  );
}
