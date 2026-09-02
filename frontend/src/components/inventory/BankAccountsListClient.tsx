'use client';

import { ArrowRight, Building2, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { BankLogo } from '@/components/documents/BankLogo';
import { formatPriceWithCommas } from '@/lib/money';

import BankAccountsListModal, { type BankAccountItem } from './BankAccountsListModal';
import InitialBankInventoryModal from './InitialBankInventoryModal';

export default function BankAccountsListClient({ initialAccounts }: { initialAccounts: BankAccountItem[] }) {
  const [accounts, setAccounts] = useState<BankAccountItem[]>(initialAccounts);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);

  const filteredAccounts = accounts.filter((acc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      acc.bankName.toLowerCase().includes(q) ||
      acc.branchName.toLowerCase().includes(q) ||
      acc.accountNumber.toLowerCase().includes(q) ||
      acc.currency.toLowerCase().includes(q) ||
      (acc.currencyName && acc.currencyName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="mx-auto max-w-7xl">
      {/* Navigation Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/documents/initial-inventory"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            title="بازگشت به موجودی اول دوره"
          >
            <ArrowRight size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
              لیست موجودی اول دوره حساب‌های بانکی
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              مشاهده و تعریف تراز پایه حساب‌های بانکی
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white shadow-sm shadow-blue-500/20 transition hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>تعریف حساب جدید</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو در بانک، شعبه، شماره حساب یا ارز..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200/80 bg-white py-3 pr-11 pl-4 text-xs font-bold text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Accounts Grid / Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {filteredAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
              <Building2 size={24} />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              هیچ حساب بانکی ثبت نشده است
            </p>
            <p className="mt-1 text-xs text-slate-400">
              برای ثبت موجودی اول دوره، روی گزینه «تعریف حساب جدید» کلیک کنید.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
                <tr>
                  <th className="py-4 px-6">بانک و شعبه</th>
                  <th className="py-4 px-6">شماره حساب</th>
                  <th className="py-4 px-6">واحد پولی</th>
                  <th className="py-4 px-6">موجودی اولیه</th>
                  <th className="py-4 px-6">موجودی فعلی</th>
                  <th className="py-4 px-6">تاریخ ثبت</th>
                  <th className="py-4 px-6 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {filteredAccounts.map((acc) => (
                  <tr key={acc.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <BankLogo bankName={acc.bankName} size={28} />
                        <div>
                          <span className="block font-black text-slate-900 dark:text-white">{acc.bankName}</span>
                          {acc.branchName ? <span className="text-[11px] font-medium text-slate-400">شعبه {acc.branchName}</span> : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono font-extrabold text-slate-700 dark:text-slate-300" dir="ltr">
                      {acc.accountNumber}
                    </td>
                    <td className="py-4 px-6 font-extrabold text-blue-600 dark:text-blue-400">
                      {acc.currencySymbol || acc.currencyName || acc.currency}
                    </td>
                    <td className="py-4 px-6 font-mono font-black text-slate-900 dark:text-white">
                      {formatPriceWithCommas(acc.openingBalance)}
                    </td>
                    <td className="py-4 px-6 font-mono font-black text-emerald-600 dark:text-emerald-400">
                      {formatPriceWithCommas(acc.balance)}
                    </td>
                    <td className="py-4 px-6 font-mono font-medium text-slate-500">
                      {acc.openingBalanceDate || '-'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        type="button"
                        onClick={() => setListModalOpen(true)}
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        مدیریت
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InitialBankInventoryModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />

      <BankAccountsListModal
        isOpen={listModalOpen}
        onClose={() => setListModalOpen(false)}
        onOpenAddModal={() => setAddModalOpen(true)}
      />
    </div>
  );
}
