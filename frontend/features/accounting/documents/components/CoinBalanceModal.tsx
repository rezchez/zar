'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, X } from 'lucide-react';
import { faNumber } from '../utils/document-helpers';

interface CoinBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  balances: Record<string, number>;
}

export default function CoinBalanceModal({ isOpen, onClose, customerName, balances }: CoinBalanceModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const entries = Object.entries(balances)
    .filter(([, quantity]) => Math.abs(quantity) > 0.000001)
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB, 'fa'));
  const claims = entries.filter(([, quantity]) => quantity < 0);
  const debts = entries.filter(([, quantity]) => quantity > 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="coin-balance-modal-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-2xl dark:border-indigo-900 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-indigo-100 p-2 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><Coins size={18} /></span>
            <div>
              <h2 id="coin-balance-modal-title" className="text-sm font-black text-slate-900 dark:text-white">ریز طلب و بدهی سکه و شمش</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">طرف‌حساب: {customerName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="بستن">
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-3 overflow-y-auto p-4 sm:grid-cols-2 sm:p-5">
          <BalanceSection
            title="طلب سکه ما از طرف‌حساب"
            description="طرف‌حساب به ما سکه یا شمش بدهکار است."
            entries={claims.map(([name, quantity]) => [name, Math.abs(quantity)])}
            tone="emerald"
          />
          <BalanceSection
            title="بدهی سکه ما به طرف‌حساب"
            description="ما به طرف‌حساب سکه یا شمش بدهکاریم."
            entries={debts}
            tone="rose"
          />
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 sm:col-span-2">
              مانده‌ی طلب یا بدهی سکه و شمش ثبت نشده است.
            </p>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function BalanceSection({
  title,
  description,
  entries,
  tone,
}: {
  title: string;
  description: string;
  entries: Array<[string, number]>;
  tone: 'emerald' | 'rose';
}) {
  const colors = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30'
    : 'border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30';
  const textColor = tone === 'emerald'
    ? 'text-emerald-800 dark:text-emerald-200'
    : 'text-rose-800 dark:text-rose-200';

  return (
    <section className={`rounded-xl border p-3 ${colors}`}>
      <h3 className={`text-sm font-black ${textColor}`}>{title}</h3>
      <p className="mb-3 mt-1 text-[11px] text-slate-600 dark:text-slate-400">{description}</p>
      {entries.length ? (
        <ul className="space-y-2">
          {entries.map(([name, quantity]) => (
            <li key={name} className="flex items-start justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-xs dark:bg-slate-900/70">
              <span className="font-bold text-slate-800 dark:text-slate-100">{name}</span>
              <span className={`shrink-0 font-black ${textColor}`}>{faNumber(quantity, 2)} عدد</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-white/70 px-3 py-3 text-center text-xs text-slate-500 dark:bg-slate-900/50">موردی ثبت نشده است.</p>
      )}
    </section>
  );
}
