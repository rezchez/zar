'use client';

import { ArrowLeft, Banknote, List, Plus } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';

import CashFundsListModal from './CashFundsListModal';
import InitialCashInventoryModal from './InitialCashInventoryModal';

export type InitialCashInventoryCardProps = {
  onList?: () => void;
  onAdd?: () => void;
  listHref?: string;
  addHref?: string;
  enableModal?: boolean;
  className?: string;
};

export default function InitialCashInventoryCard({
  onList,
  onAdd,
  listHref,
  addHref,
  enableModal = true,
  className = '',
}: InitialCashInventoryCardProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);

  function handleListClick() {
    if (onList) {
      onList();
      return;
    }
    if (enableModal) {
      setListModalOpen(true);
    }
  }

  function handleAddClick() {
    if (onAdd) {
      onAdd();
      return;
    }
    if (enableModal) {
      setAddModalOpen(true);
    }
  }

  return (
    <>
      <article
        dir="rtl"
        className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 ${className}`}
      >
        <div className="relative z-10 space-y-4">
          {/* Top Header: Icon & Badge */}
          <div className="flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 transition-transform group-hover:scale-105 dark:bg-amber-500/25 dark:text-amber-400">
              <Banknote size={24} className="stroke-[2.2]" />
            </div>

            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-extrabold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              وجوه نقد و صندوق
            </span>
          </div>

          {/* Title & Description */}
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              موجودی اولیه وجوه نقد صندوق
            </h2>
            <p className="mt-1 text-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400">
              اسکناسهای داخل صندوق شامل تومان و ارز
            </p>
          </div>
        </div>

        {/* Footer Action Links / Buttons */}
        <div className="relative z-10 mt-6 flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {listHref ? (
            <Link
              href={listHref}
              className="inline-flex flex-1 items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-amber-400 dark:hover:text-slate-950"
            >
              <span>ورود به مدیریت و لیست صندوق‌ها</span>
              <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleListClick}
              className="inline-flex flex-1 items-center justify-between rounded-2xl bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-amber-400 dark:hover:text-slate-950"
            >
              <span>لیست صندوق‌ها</span>
              <List size={16} />
            </button>
          )}

          {addHref ? (
            <Link
              href={addHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 px-3.5 py-2.5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
              title="افزودن"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>افزودن</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleAddClick}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 px-3.5 py-2.5 text-xs font-black text-slate-950 shadow-sm transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
              title="افزودن"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>افزودن</span>
            </button>
          )}
        </div>
      </article>

      {/* Initial Cash Inventory Add Modal */}
      {enableModal && (
        <InitialCashInventoryModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {/* Cash Funds List & Edit Modal */}
      {enableModal && (
        <CashFundsListModal
          isOpen={listModalOpen}
          onClose={() => setListModalOpen(false)}
          onOpenAddModal={() => setAddModalOpen(true)}
        />
      )}
    </>
  );
}
