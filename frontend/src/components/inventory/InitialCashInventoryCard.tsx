'use client';

import { Banknote, List, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

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
      <div
        dir="rtl"
        className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${className}`}
      >
        {/* Header Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/20">
              <Banknote size={24} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                موجودی اولیه وجوه نقد صندوق
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                اسکناسهای داخل صندوق شامل تومان و ارز
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 grid grid-cols-2 gap-3 pt-2">
          {listHref ? (
            <Link
              href={listHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <List size={16} />
              <span>لیست</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleListClick}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-4 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <List size={16} />
              <span>لیست</span>
            </button>
          )}

          {addHref ? (
            <Link
              href={addHref}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 shadow-sm shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>افزودن</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleAddClick}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 shadow-sm shadow-amber-500/20 transition hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>افزودن</span>
            </button>
          )}
        </div>
      </div>

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
