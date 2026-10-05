'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Landmark, ShieldAlert } from 'lucide-react';
import BankLogo from '@/src/components/documents/BankLogo';
import {
  type BankAccount,
  getAccountTypeLabel,
} from '@/lib/bank';
import { formatCurrencyAmount } from '@/lib/money';

export interface BankAccountSelectProps {
  value: string;
  onChange: (bankId: string) => void;
  banks: BankAccount[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  error?: boolean;
}

export default function BankAccountSelect({
  value,
  onChange,
  banks,
  placeholder = 'انتخاب حساب بانکی...',
  disabled = false,
  className = '',
  triggerClassName = '',
  id,
  error = false,
}: BankAccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const selectId = id || generatedId;

  const selectedBank = banks.find((b) => b.id === value) || null;

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const formatBankDisplay = (bank: BankAccount) => {
    const cleanBankName = (bank.bankName || '').replace(/^بانک\s+/, '').trim();
    const cleanBranch = bank.branchName ? bank.branchName.replace(/^شعبه\s+/, '').trim() : '';
    const branchPart = cleanBranch ? ` ${cleanBranch}` : '';
    const typePart = bank.accountType && bank.accountType !== 'current' ? ` (${getAccountTypeLabel(bank.accountType)})` : '';
    const accNum = bank.accountNumber ? ` ش.ح ${bank.accountNumber}` : '';
    const formattedBalance = formatCurrencyAmount(bank.currentBalance ?? bank.balance, bank.currency);
    return {
      title: `${cleanBankName}${branchPart}${typePart}`,
      accountNumber: accNum,
      balance: formattedBalance,
      fullText: `${cleanBankName}${branchPart}${typePart}${accNum} موجودی: ${formattedBalance}`,
    };
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full text-right ${className}`}
      dir="rtl"
    >
      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 rounded-xl border transition-all cursor-pointer select-none text-right ${
          error
            ? 'border-rose-400 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/20'
            : isOpen
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-white dark:bg-slate-900 shadow-sm'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
        } ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''
        } ${triggerClassName || 'h-10 text-xs'}`}
      >
        {selectedBank ? (
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <div className="shrink-0 flex items-center justify-center">
              <BankLogo bankName={selectedBank.bankName} size={22} />
            </div>
            <div className="flex items-center gap-1.5 truncate text-xs font-bold text-slate-800 dark:text-slate-100">
              <span className="truncate">{formatBankDisplay(selectedBank).title}</span>
              {selectedBank.accountNumber ? (
                <span className="shrink-0 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                  {formatBankDisplay(selectedBank).accountNumber}
                </span>
              ) : null}
              <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-extrabold mr-1 text-[11px]">
                (موجودی: {formatBankDisplay(selectedBank).balance})
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
            <Landmark size={18} className="shrink-0 text-slate-400" />
            <span className="text-xs font-medium">{placeholder}</span>
          </div>
        )}

        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-500' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1.5 w-full min-w-[280px] max-w-full rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 max-h-64 overflow-y-auto"
        >
          {banks.length === 0 ? (
            <div className="p-3 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
              هیچ حساب بانکی دارای دسته چک یافت نشد.
            </div>
          ) : (
            banks.map((bank) => {
              const isSelected = bank.id === value;
              const { title, accountNumber, balance } = formatBankDisplay(bank);

              return (
                <button
                  key={bank.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={bank.isBlocked === true}
                  onClick={() => {
                    onChange(bank.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl text-right transition-colors cursor-pointer ${
                    bank.isBlocked
                      ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40 text-slate-400'
                      : isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 font-bold border border-amber-200/60 dark:border-amber-800/60'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="shrink-0 flex items-center justify-center">
                      <BankLogo bankName={bank.bankName} size={26} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {title}
                        </span>
                        {bank.isBlocked ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 px-1 py-0.2 rounded">
                            <ShieldAlert size={10} />
                            مسدود
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        {accountNumber ? (
                          <span className="font-mono">{accountNumber}</span>
                        ) : null}
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold mr-auto">
                          موجودی: {balance}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="shrink-0 flex items-center justify-center size-5 rounded-full bg-amber-500 text-white">
                      <Check size={12} className="stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
