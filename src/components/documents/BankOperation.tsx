'use client';

import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Check,
  LoaderCircle,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { formatRials, type BankAccount, type BankTransferKind } from '@/lib/bank';
import BankLogo from '@/src/components/documents/BankLogo';

type BankOperationProps = {
  accountCodeZero: string;
};

type Notice = {
  tone: 'success' | 'error';
  text: string;
};

const transferOptions: Array<{
  value: BankTransferKind;
  label: string;
  icon: typeof ArrowRightLeft;
}> = [
  { value: 'bank-to-bank', label: 'انتقال حساب به حساب', icon: ArrowRightLeft },
  { value: 'cash-to-bank', label: 'واریز وجه نقد به بانک', icon: ArrowUpRight },
  { value: 'bank-to-cash', label: 'برداشت بانک به صندوق', icon: ArrowDownLeft },
];

export default function BankOperation({ accountCodeZero }: BankOperationProps) {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [kind, setKind] = useState<BankTransferKind>('bank-to-bank');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newBalance, setNewBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function loadBanks() {
    const response = await fetch('/api/banks', { cache: 'no-store' });
    const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
    if (!response.ok) throw new Error(data.message ?? 'دریافت حساب‌های بانکی انجام نشد.');
    setBanks(data.banks ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/banks', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
        if (!response.ok) throw new Error(data.message ?? 'دریافت حساب‌های بانکی انجام نشد.');
        if (!cancelled) setBanks(data.banks ?? []);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setNotice({
            tone: 'error',
            text: error instanceof Error ? error.message : 'دریافت حساب‌ها انجام نشد.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBanks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return banks;
    return banks.filter((bank) =>
      `${bank.bankName} ${bank.accountNumber}`.toLocaleLowerCase().includes(query),
    );
  }, [banks, search]);

  async function createBank() {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          bankName: newBankName,
          accountNumber: newAccountNumber,
          balance: newBalance,
          accountCodeZero,
        }),
      });
      const data = (await response.json()) as { bank?: BankAccount; message?: string };
      if (!response.ok || !data.bank) throw new Error(data.message ?? 'ثبت حساب بانکی انجام نشد.');
      setBanks((current) => [...current, data.bank as BankAccount]);
      setSelectedDestination(data.bank.id);
      setNewBankName('');
      setNewAccountNumber('');
      setNewBalance('0');
      setShowCreate(false);
      setNotice({ tone: 'success', text: 'حساب بانکی با موفقیت ثبت شد.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'ثبت حساب انجام نشد.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitTransfer() {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch('/api/banks/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          amount,
          sourceBankId: selectedSource,
          destinationBankId: selectedDestination,
          description,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'ثبت انتقال انجام نشد.');
      await loadBanks();
      setAmount('');
      setDescription('');
      setNotice({ tone: 'success', text: data.message ?? 'انتقال ثبت شد.' });
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'ثبت انتقال انجام نشد.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">حسابداری دوطرفه</p>
          <h3 className="mt-1 text-lg font-black text-slate-800 dark:text-slate-100">عملیات حساب بانکی</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20"
        >
          <Plus size={16} />
          حساب بانکی جدید
        </button>
      </div>

      {showCreate ? (
        <div className="grid gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:grid-cols-3">
          <input value={newBankName} onChange={(event) => setNewBankName(event.target.value)} placeholder="نام بانک" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <input value={newAccountNumber} onChange={(event) => setNewAccountNumber(event.target.value)} placeholder="شماره حساب" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          <div className="flex gap-2">
            <input value={newBalance} onChange={(event) => setNewBalance(event.target.value)} inputMode="decimal" placeholder="موجودی اولیه" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
            <button type="button" onClick={() => void createBank()} disabled={loading} className="rounded-xl bg-slate-900 px-3 text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
              {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
            </button>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-3">حساب جدید زیرمجموعه حساب کد صفر {accountCodeZero} ثبت می‌شود.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {transferOptions.map((option) => {
          const Icon = option.icon;
          return (
            <button
              type="button"
              key={option.value}
              onClick={() => setKind(option.value)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                kind === option.value
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Icon size={15} />
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="جست‌وجوی نام بانک یا شماره حساب..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {kind !== 'cash-to-bank' ? (
          <BankSelect label="حساب مبدأ بانکی" value={selectedSource} onChange={setSelectedSource} banks={filteredBanks} />
        ) : null}
        {kind !== 'bank-to-cash' ? (
          <BankSelect label="حساب مقصد بانکی" value={selectedDestination} onChange={setSelectedDestination} banks={filteredBanks} />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="مبلغ انتقال به ریال" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="شرح سند حسابداری" className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" />
      </div>

      <button type="button" onClick={() => void submitTransfer()} disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50">
        {loading ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRightLeft size={18} />}
        ثبت انتقال و ایجاد سند حسابداری
      </button>

      {notice ? (
        <p className={`rounded-xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}

function BankSelect({
  label,
  value,
  onChange,
  banks,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  banks: BankAccount[];
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-14 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option value="">انتخاب حساب بانکی</option>
        {banks.map((bank) => (
          <option key={bank.id} value={bank.id}>
            {bank.bankName} · {bank.accountNumber} · {formatRials(bank.balance)} ریال
          </option>
        ))}
      </select>
      {value ? (() => {
        const bank = banks.find((item) => item.id === value);
        return bank ? (
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <BankLogo bankName={bank.bankName} size={28} />
            موجودی لحظه‌ای: {formatRials(bank.balance)} ریال
          </span>
        ) : null;
      })() : null}
    </label>
  );
}
