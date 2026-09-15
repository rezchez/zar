'use client';

import { Flame, Plus, RefreshCw, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { isRefinerCustomer, type Customer } from '@/lib/customer';

export default function CustomerRefiningTab({
  customer,
}: {
  customer: Customer;
}) {
  const isRefiner = isRefinerCustomer(customer);
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Form states for creating a new case
  const [caseNumber, setCaseNumber] = useState('');
  const [rawWeight, setRawWeight] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isRefiner) return;
    loadCases();
  }, [customer.id, customer.groupName]);

  async function loadCases() {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/refining/cases?counterpartyId=${customer.id}`);
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'خطا در دریافت پرونده‌های ریگیری');
        return;
      }
      setCases(data.cases || []);
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCase(e: React.FormEvent) {
    e.preventDefault();
    if (!caseNumber.trim()) return;

    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/refining/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counterpartyId: customer.id,
          caseNumber: caseNumber.trim(),
          rawWeight: Number(rawWeight) || 0,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'ثبت پرونده ریگیری با خطا مواجه شد.');
        return;
      }

      setSuccessMessage(`پرونده ریگیری ${data.case?.caseNumber || ''} با موفقیت ثبت شد.`);
      setCaseNumber('');
      setRawWeight('');
      setNotes('');
      await loadCases();
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isRefiner) {
    return null;
  }

  return (
    <section className="dashboard-panel customer-refining-panel mt-6">
      <div className="account-panel-heading flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={20} className="text-amber-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            پرونده‌های ریگیری
          </h2>
        </div>
        <button
          type="button"
          onClick={loadCases}
          disabled={loading}
          className="dashboard-secondary-button text-xs py-1.5 px-3"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          به‌روزرسانی
        </button>
      </div>

      {errorMessage ? (
        <p className="form-error mt-3 text-xs text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="account-message mt-3 text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
          {successMessage}
        </p>
      ) : null}

      {/* Form to create new refining case */}
      <form onSubmit={handleCreateCase} className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
          ثبت پرونده جدید برای ریگیر
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-col gap-1">
            شماره پرونده / انگ *
            <input
              type="text"
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              placeholder="مثلاً REF-1403-01"
              required
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </label>

          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-col gap-1">
            وزن اولیه (گرم)
            <input
              type="number"
              step="any"
              value={rawWeight}
              onChange={(e) => setRawWeight(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0.00"
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </label>

          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex flex-col gap-1">
            توضیحات
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="توضیحات..."
              className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </label>
        </div>

        <div className="flex justify-end mt-1">
          <button
            type="submit"
            disabled={submitting || !caseNumber.trim()}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5 shrink-0"
          >
            {submitting ? <LoaderCircle size={14} className="spin" /> : <Plus size={14} />}
            ایجاد پرونده ریگیری
          </button>
        </div>
      </form>

      {/* List of cases */}
      <div className="users-table-wrap mt-4">
        <table className="users-table">
          <thead>
            <tr>
              <th>شماره پرونده</th>
              <th>وضعیت</th>
              <th>وزن اولیه (گرم)</th>
              <th>وزن خالص (گرم)</th>
              <th>توضیحات</th>
            </tr>
          </thead>
          <tbody>
            {cases.length ? (
              cases.map((c) => (
                <tr key={c.id}>
                  <td className="font-mono font-bold">{c.caseNumber}</td>
                  <td>
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {c.status === 'in_progress' ? 'در حال ریگیری' : c.status}
                    </span>
                  </td>
                  <td>{c.rawWeight ? c.rawWeight.toLocaleString('fa-IR') : '—'}</td>
                  <td>{c.pureWeight ? c.pureWeight.toLocaleString('fa-IR') : '—'}</td>
                  <td>{c.notes || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  هیچ پرونده ریگیری برای این طرف‌حساب ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
