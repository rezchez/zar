'use client';

import { Landmark, LoaderCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { formatRials, type BankAccount } from '@/lib/bank';
import BankLogo from '@/src/components/documents/BankLogo';

export default function BankBalancesWidget() {
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/banks', { cache: 'no-store' });
      const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'دریافت موجودی بانک‌ها انجام نشد.');
      setBanks(data.banks ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دریافت موجودی بانک‌ها انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="dashboard-panel" dir="rtl">
      <div className="dashboard-panel-heading">
        <div>
          <p className="eyebrow">حساب‌های مالی</p>
          <h2 className="flex items-center gap-2"><Landmark size={19} /> موجودی بانک‌ها</h2>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="dashboard-icon-button" aria-label="به‌روزرسانی موجودی بانک‌ها">
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {!loading && !banks.length && !error ? <p className="dashboard-empty-search">هنوز حساب بانکی ثبت نشده است.</p> : null}

      <div className="mt-4 space-y-2">
        {banks.map((bank) => (
          <div key={bank.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <BankLogo bankName={bank.bankName} size={38} />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{bank.bankName}</strong>
              <small className="text-xs text-slate-500 dark:text-slate-400">{bank.accountNumber}</small>
            </div>
            <strong className="text-sm text-emerald-700 dark:text-emerald-300">{formatRials(bank.balance)} ریال</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
