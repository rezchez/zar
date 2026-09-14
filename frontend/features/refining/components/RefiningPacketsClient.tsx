'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Filter,
  LoaderCircle,
  Package,
  RefreshCw,
  Scale,
  Search,
  X,
} from 'lucide-react';

import DatePicker from '@/components/ui/date-picker';
import { roundWeight } from '@/lib/weight';
import type { RefiningSample } from '@/features/refining/services/refining-service';

export default function RefiningPacketsClient() {
  const [packets, setPackets] = useState<RefiningSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [refinerFilter, setRefinerFilter] = useState('');

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Selected Packet for Receive Modal
  const [selectedPacket, setSelectedPacket] = useState<RefiningSample | null>(null);
  const [receivedWeight, setReceivedWeight] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadPackets() {
    setLoading(true);
    setMessage('');
    setErrorMessage('');
    try {
      const res = await fetch('/api/refining/packets?status=pending');
      const data = await res.json();
      if (res.ok && data.packets) {
        setPackets(data.packets);
      } else {
        setErrorMessage(data.message || 'خطا در دریافت پاکت‌های نزد ریگیری.');
      }
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPackets();
  }, []);

  async function handleReceiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPacket) return;

    if (!receivedWeight || Number(receivedWeight) < 0) {
      setErrorMessage('لطفاً وزن واقعی دریافت‌شده را به درستی وارد کنید.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    setErrorMessage('');

    try {
      const res = await fetch(`/api/refining/packets/${selectedPacket.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedWeight: Number(receivedWeight),
          receivedDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'ثبت دریافت پاکت با خطا مواجه شد.');
        return;
      }

      const weightDiff = data.weightDifference ?? roundWeight(selectedPacket.declaredWeight - Number(receivedWeight), 3);
      setMessage(
        `پاکت نمونه ${selectedPacket.sampleCode} با موفقیت دریافت و وارد موجودی شد. (وزن واقعی: ${receivedWeight} گرم - افت/اختلاف عملیاتی: ${weightDiff} گرم)`,
      );
      setSelectedPacket(null);
      setReceivedWeight('');
      await loadPackets();
    } catch {
      setErrorMessage('خطا در ارتباط با سرور.');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredPackets = packets.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.sampleCode.toLowerCase().includes(search.trim().toLowerCase()) ||
      (p.caseNumber && p.caseNumber.toLowerCase().includes(search.trim().toLowerCase())) ||
      (p.refinerName && p.refinerName.toLowerCase().includes(search.trim().toLowerCase()));

    const matchesRefiner = !refinerFilter || p.refiner === refinerFilter;

    return matchesSearch && matchesRefiner;
  });

  const refinerOptions = Array.from(
    new Map(
      packets.map((p) => [p.refiner, p.refinerName || 'ریگیر نامشخص']),
    ).entries(),
  );

  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="text-amber-500" size={24} />
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
              پاکت‌های نزد ریگیری
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مشاهده و مدیریت نمونه‌ها و پاکت‌های آزمایش موجود نزد ریگیری‌ها (آماده دریافت واقعی)
          </p>
        </div>

        <button
          type="button"
          onClick={loadPackets}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-bold flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={15} /> به‌روزرسانی لیست
        </button>
      </div>

      {message ? (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 size={16} /> {message}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400">
          {errorMessage}
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس شماره پاکت، شماره پرونده یا نام ریگیر..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {refinerOptions.length > 0 ? (
          <div className="flex items-center gap-2 min-w-[200px]">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <select
              value={refinerFilter}
              onChange={(e) => setRefinerFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <option value="">همه ریگیری‌ها</option>
              {refinerOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {/* Table List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center items-center text-slate-400">
            <LoaderCircle size={28} className="spin" />
          </div>
        ) : filteredPackets.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            <Package size={36} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            هیچ پاکت نمونه دریافت‌نشده‌ای نزد ریگیری‌ها یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                  <th className="py-3 px-3">شماره / انگ پاکت</th>
                  <th className="py-3 px-3">شماره پرونده</th>
                  <th className="py-3 px-3">نام ریگیر</th>
                  <th className="py-3 px-3">وزن اعلام‌شده نمونه (گرم)</th>
                  <th className="py-3 px-3">تاریخ ایجاد / تحویل</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPackets.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-mono font-extrabold text-amber-600 dark:text-amber-400">
                      {p.sampleCode}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {p.caseNumber || '—'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {p.refinerName || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono font-extrabold">
                      {p.declaredWeight.toLocaleString('fa-IR')}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {p.declaredDate || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold inline-flex items-center gap-1">
                        <Clock size={12} /> نزد ریگیر
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPacket(p);
                          setReceivedWeight(String(p.declaredWeight));
                          setReceivedDate('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold transition-colors inline-flex items-center gap-1 shadow-xs"
                      >
                        <Scale size={14} /> دریافت پاکت
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Modal */}
      {selectedPacket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setSelectedPacket(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-1">
              ثبت دریافت واقعی پاکت نمونه
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              پاکت: <span className="font-mono font-bold text-amber-600">{selectedPacket.sampleCode}</span> | ریگیر: {selectedPacket.refinerName}
            </p>

            <form onSubmit={handleReceiveSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs flex justify-between items-center">
                <span>وزن اعلام‌شده اولیه:</span>
                <span className="font-mono font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedPacket.declaredWeight} گرم
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  تاریخ واقعی دریافت
                </label>
                <DatePicker
                  value={receivedDate}
                  onValueChange={(_iso, jalali) => setReceivedDate(jalali || '')}
                  calendarType="shamsi"
                  format="yyyy/MM/dd"
                  placeholder="انتخاب تاریخ..."
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  وزن واقعی دریافت‌شده (گرم) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={receivedWeight}
                  onChange={(e) => setReceivedWeight(e.target.value)}
                  placeholder="وزن واقعی ترازو"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 font-mono"
                  required
                  autoFocus
                />
              </div>

              {receivedWeight && !isNaN(Number(receivedWeight)) ? (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>اختلاف / افت عملیاتی:</span>
                    <span className="font-mono">
                      {roundWeight(selectedPacket.declaredWeight - Number(receivedWeight), 3)} گرم
                    </span>
                  </div>
                  <p className="text-[10px] opacity-80 pt-1 border-t border-purple-500/20">
                    این وزن دریافت‌شده ({receivedWeight} گرم) وارد موجودی طلا می‌شود و اختلاف وزنی مانده حساب ریگیر را تغییر نمی‌دهد.
                  </p>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPacket(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting || !receivedWeight}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {submitting ? <LoaderCircle size={14} className="spin" /> : null}
                  ثبت دریافت و ورود به موجودی
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
