'use client';

import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PriceInput } from '@/components/ui/price-input';
import type { Currency } from '@/lib/currencies';

type Vault = { id: string; currency_name: string; balance: number };

export default function CashOperation() {
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyId, setCurrencyId] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const response = await fetch('/api/cash-vault', { cache: 'no-store' });
    const data = (await response.json()) as { vaults?: Vault[] };
    if (response.ok) setVaults(data.vaults ?? []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/currencies', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as { currencies?: Currency[] };
        if (!cancelled && response.ok) {
          const loaded = data.currencies ?? [];
          setCurrencies(loaded);
          setCurrencyId((current) => loaded.some((item) => item.id === current) ? current : (loaded[0]?.id ?? ''));
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const selectedCurrency = currencies.find((item) => item.id === currencyId);
  const currency = selectedCurrency?.code ?? '';

  async function submit() {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/cash-vault', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currencyId, amount, direction, description }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message ?? 'ثبت تراکنش صندوق انجام نشد.');
      setAmount('');
      setDescription('');
      await load();
      setMessage('تراکنش صندوق با موفقیت ثبت شد.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ثبت تراکنش صندوق انجام نشد.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/50" dir="rtl">
      <div className="flex items-center gap-3">
        <Wallet className="text-emerald-600" size={24} />
        <div><h3 className="text-sm font-bold">وجه نقد چندارزی</h3><p className="text-xs text-slate-500">ورود و خروج هر ارز در دفتر صندوق ثبت می‌شود.</p></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <select value={currencyId} onChange={(event) => setCurrencyId(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
          {currencies.length === 0 ? <option value="">ارزی ثبت نشده است</option> : null}
          {currencies.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
        </select>
        <PriceInput
          value={amount}
          onValueChange={(_parsed, rawVal) => setAmount(rawVal)}
          placeholder="مبلغ"
          currencySuffix={currency || 'ریال'}
          showWords
        />
        <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="شرح" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setDirection('in')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${direction === 'in' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}><ArrowDownLeft size={15} /> ورود وجه</button>
        <button type="button" onClick={() => setDirection('out')} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${direction === 'out' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'}`}><ArrowUpRight size={15} /> خروج وجه</button>
        <button type="button" onClick={() => void submit()} disabled={loading} className="mr-auto inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{loading ? <LoaderCircle size={15} className="animate-spin" /> : null} ثبت تراکنش</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">{vaults.map((vault) => <div key={vault.id} className="rounded-xl bg-white p-3 text-xs dark:bg-slate-800"><strong>{vault.currency_name}</strong><span className="mr-2 text-slate-500">{Number(vault.balance ?? 0).toLocaleString('fa-IR')}</span></div>)}</div>
      {message ? <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{message}</p> : null}
    </section>
  );
}
