'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  Edit3,
  FileText,
  Filter,
  FlaskConical,
  HandCoins,
  History,
  Layers,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';

import { metalAtBaseKarat, roundWeight } from '@/lib/weight';

export type ConditionalGoldItem = {
  id: string;
  stampNumber: string;
  labName: string;
  rawWeight: number;
  purity: number;
  baseKarat: number;
  convertedWeight: number;
  direction: 'in' | 'out';
  date: string;
  customer: {
    id: string;
    name: string;
    code: string | number;
  };
  documentId: string;
  documentNumber: string;
  transactionId: string;
  status: 'pending' | 'settled' | 'other';
  description: string;
  created: string;
};

export type ConditionalMetrics = {
  pendingCount: number;
  settledCount: number;
  totalRawWeight: number;
  totalConvertedWeight: number;
};

function formatWeightNumber(val: number): string {
  return new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  }).format(val);
}

function formatDateJalali(dateStr: string): string {
  if (!dateStr) return '—';
  if (dateStr.includes('/')) return dateStr;
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export default function ConditionalKaratClient() {
  const [items, setItems] = useState<ConditionalGoldItem[]>([]);
  const [metrics, setMetrics] = useState<ConditionalMetrics>({
    pendingCount: 0,
    settledCount: 0,
    totalRawWeight: 0,
    totalConvertedWeight: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<'pending' | 'settled' | 'all'>('pending');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemForSettle, setSelectedItemForSettle] = useState<ConditionalGoldItem | null>(null);

  // Quick inputs drafts for inline settle (item.id -> purity string)
  const [inputPurities, setInputPurities] = useState<Record<string, string>>({});

  // Settle modal state
  const [modalPurity, setModalPurity] = useState('');
  const [modalNotes, setModalNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  async function loadData() {
    setLoading(true);
    setActionError('');
    try {
      const params = new URLSearchParams();
      params.set('status', statusTab);
      if (directionFilter !== 'all') params.set('direction', directionFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/conditional-karat?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        if (data.metrics) setMetrics(data.metrics);
      } else {
        setActionError(data.message || 'خطا در دریافت اطلاعات.');
      }
    } catch {
      setActionError('خطای ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [statusTab, directionFilter]);

  async function handleSettleSubmit(item: ConditionalGoldItem, purityVal: number, notes?: string) {
    if (!Number.isFinite(purityVal) || purityVal <= 0 || purityVal > 1000) {
      setActionError('عیار باید عددی بین ۱ تا ۱۰۰۰ باشد.');
      return;
    }

    setSettling(true);
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch('/api/conditional-karat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          newPurity: purityVal,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message || 'خطا در ثبت عیار قطعی.');
        return;
      }

      setActionSuccess(data.message || 'عیار با موفقیت قطعی شد.');
      setSelectedItemForSettle(null);
      // Clean up draft
      setInputPurities((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await loadData();
    } catch {
      setActionError('خطا در برقراری ارتباط با سرور.');
    } finally {
      setSettling(false);
    }
  }

  function openSettleModal(item: ConditionalGoldItem, initialPurity?: string) {
    setSelectedItemForSettle(item);
    setModalPurity(initialPurity || inputPurities[item.id] || String(item.purity || '750'));
    setModalNotes('');
    setActionError('');
  }

  // Filtered displayed items
  const displayItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const str = `${item.stampNumber} ${item.labName} ${item.customer.name} ${item.documentNumber} ${item.description}`.toLowerCase();
      return str.includes(q);
    });
  }, [items, searchQuery]);

  return (
    <div className="space-y-6 dir-rtl text-right" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold mb-2">
            <FlaskConical size={14} />
            <span>مدیریت آزمایشگاه ری‌گیری و تعیین عیار</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            عیار شرطی آبشده
          </h1>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            تمام طلاهای آبشده که عیار آن‌ها موقت یا شرطی است در این بخش قرار دارند. با درج عیار صحیح ری‌گیری، طلا از وضعیت شرطی خارج شده و تراز عیار در کل سیستم قطعی می‌گردد.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors shadow-sm"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-amber-500' : ''} />
            به‌روزرسانی
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Items */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-1">
              در انتظار عیار قطعی
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {metrics.pendingCount}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">قطعه آبشده شرطی</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        {/* Total Raw Weight */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">
              مجموع وزن ناخالص شرطی
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {formatWeightNumber(metrics.totalRawWeight)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">گرم طلای خام</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
            <Scale size={22} />
          </div>
        </div>

        {/* Total Converted Weight */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
              معادل ۷۵۰ موقت
            </span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              {formatWeightNumber(metrics.totalConvertedWeight)}
            </span>
            <span className="text-[10px] text-indigo-500/80 block mt-0.5 font-medium">گرم طلای آبشده موقت</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Coins size={22} />
          </div>
        </div>

        {/* Settled Count */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
              تعیین‌عیار و قطعی‌شده
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {metrics.settledCount}
            </span>
            <span className="text-[10px] text-emerald-500/80 block mt-0.5 font-medium">تبدیل‌شده به آبشده قطعی</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {actionError ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <X size={16} />
          <span>{actionError}</span>
        </div>
      ) : null}

      {actionSuccess ? (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <ShieldCheck size={16} />
          <span>{actionSuccess}</span>
        </div>
      ) : null}

      {/* Main Table Panel */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        {/* Filters and Search Bar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجو با شماره انگ، نام ری‌گیری، طرف حساب..."
                className="w-full h-11 pr-10 pl-10 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all placeholder:text-slate-400"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Tab */}
              <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusTab('pending')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    statusTab === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  در انتظار عیار ({metrics.pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab('settled')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    statusTab === 'settled'
                      ? 'bg-emerald-600 text-white shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  قطعی‌شده ({metrics.settledCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusTab('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    statusTab === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  همه موارد
                </button>
              </div>

              {/* Direction Filter */}
              <div className="inline-flex rounded-2xl p-1 bg-slate-100 dark:bg-slate-800/80 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setDirectionFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    directionFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  همه جهت‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setDirectionFilter('in')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    directionFilter === 'in'
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  دریافتی (ورود)
                </button>
                <button
                  type="button"
                  onClick={() => setDirectionFilter('out')}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    directionFilter === 'out'
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 shadow-sm font-black'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  پرداختی (خروج)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/40 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                <th className="py-4 px-6">شماره انگ و آزمایشگاه</th>
                <th className="py-4 px-4">طرف حساب / مشتری</th>
                <th className="py-4 px-4">جهت و تاریخ</th>
                <th className="py-4 px-4">وزن ناخالص (گرم)</th>
                <th className="py-4 px-4">عیار فعلی</th>
                <th className="py-4 px-4">معادل ۷۵۰ فعلی</th>
                <th className="py-4 px-6 text-center">ثبت عیار صحیح ری‌گیری</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-500" />
                    در حال دریافت فهرست آبشده‌های شرطی...
                  </td>
                </tr>
              ) : displayItems.length ? (
                displayItems.map((item) => {
                  const draftPurity = inputPurities[item.id] ?? '';
                  const numDraft = Number(draftPurity);
                  const hasDraft = draftPurity.trim() !== '' && Number.isFinite(numDraft) && numDraft > 0;
                  const previewConverted = hasDraft
                    ? roundWeight(metalAtBaseKarat(item.rawWeight, numDraft, item.baseKarat, 3), 3)
                    : null;
                  const previewDiff = previewConverted !== null
                    ? roundWeight(previewConverted - item.convertedWeight, 3)
                    : null;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Stamp & Lab */}
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900 dark:text-slate-100 tracking-wider font-mono">
                              {item.stampNumber ? `انگ ${item.stampNumber}` : 'فاقد شماره انگ'}
                            </span>
                            {item.status === 'pending' ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black">
                                شرطی
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black">
                                قطعی
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <FlaskConical size={12} className="text-amber-500" />
                            <span>{item.labName || 'نام آزمایشگاه نامشخص'}</span>
                          </div>
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                            <User size={13} className="text-slate-400" />
                            <span>{item.customer.name}</span>
                          </div>
                          {item.customer.code ? (
                            <span className="text-[10px] text-slate-400 block">
                              کد: {item.customer.code}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Direction & Date */}
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          {item.direction === 'in' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[11px]">
                              <ArrowDownLeft size={13} />
                              دریافتی (ورود)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-extrabold text-[11px]">
                              <ArrowUpRight size={13} />
                              پرداختی (خروج)
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {formatDateJalali(item.date)}
                          </span>
                        </div>
                      </td>

                      {/* Raw Weight */}
                      <td className="py-4 px-4">
                        <span className="font-black text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {formatWeightNumber(item.rawWeight)}
                        </span>
                        <span className="text-[10px] text-slate-400 mr-1">گرم</span>
                      </td>

                      {/* Purity */}
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                          {item.purity}
                        </span>
                      </td>

                      {/* Converted Weight */}
                      <td className="py-4 px-4">
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                          {formatWeightNumber(item.convertedWeight)}
                        </span>
                        <span className="text-[10px] text-slate-400 mr-1">گرم</span>
                      </td>

                      {/* Action: Settle Purity Field */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              step="0.1"
                              min="1"
                              max="1000"
                              placeholder={String(item.purity)}
                              value={draftPurity}
                              onChange={(e) =>
                                setInputPurities((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className="w-24 h-9 px-2 text-center text-xs font-black font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                            />
                            {hasDraft && previewDiff !== null ? (
                              <div
                                className={`absolute -bottom-4 right-0 text-[10px] font-bold whitespace-nowrap ${
                                  previewDiff >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {previewDiff >= 0 ? `+${previewDiff}` : previewDiff} گ
                              </div>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (hasDraft) {
                                openSettleModal(item, draftPurity);
                              } else {
                                openSettleModal(item);
                              }
                            }}
                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black transition-all shadow-sm ${
                              item.status === 'pending'
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 hover:shadow-amber-500/20 active:scale-95'
                                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <Sparkles size={13} />
                            {item.status === 'pending' ? 'ثبت عیار قطعی' : 'ویرایش عیار'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                    {statusTab === 'pending'
                      ? 'هیچ آبشده‌ای با عیار شرطی در انتظار ثبت وجود ندارد.'
                      : 'موردی برای نمایش یافت نشد.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Settle Karat Confirmation Modal */}
      <AnimatePresence>
        {selectedItemForSettle ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 dir-rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-right space-y-5"
              role="dialog"
              aria-modal="true"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <FlaskConical size={22} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-slate-100 text-base">
                      ثبت عیار قطعی ری‌گیری و خروج از شرطی
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      شماره انگ: {selectedItemForSettle.stampNumber || 'نامشخص'} · آزمایشگاه:{' '}
                      {selectedItemForSettle.labName || 'نامشخص'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemForSettle(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Item Details Box */}
              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-800 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold">طرف حساب:</span>
                    <span className="font-black text-slate-800 dark:text-slate-200">
                      {selectedItemForSettle.customer.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold">وزن ناخالص:</span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                      {formatWeightNumber(selectedItemForSettle.rawWeight)} گرم
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold">عیار موقت اولیه:</span>
                    <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                      {selectedItemForSettle.purity}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 font-bold">معادل ۷۵۰ قبلی:</span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                      {formatWeightNumber(selectedItemForSettle.convertedWeight)} گرم
                    </span>
                  </div>
                </div>
              </div>

              {/* New Purity Input & Live Calculation */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    عیار صحیح و قطعی ری‌گیری (بین ۱ تا ۱۰۰۰)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    required
                    value={modalPurity}
                    onChange={(e) => setModalPurity(e.target.value)}
                    placeholder="مثال: 752.4"
                    className="w-full h-12 px-4 text-center text-lg font-black font-mono rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                {/* Live Converted Weight Calculation */}
                {Number(modalPurity) > 0 ? (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-600 dark:text-slate-400">وزن معادل ۷۵۰ جدید:</span>
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                        {formatWeightNumber(
                          roundWeight(
                            metalAtBaseKarat(
                              selectedItemForSettle.rawWeight,
                              Number(modalPurity),
                              selectedItemForSettle.baseKarat,
                              3,
                            ),
                            3,
                          ),
                        )}{' '}
                        گرم
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500 dark:text-slate-400">تغییر در تراز طلا:</span>
                      {(() => {
                        const newConverted = roundWeight(
                          metalAtBaseKarat(
                            selectedItemForSettle.rawWeight,
                            Number(modalPurity),
                            selectedItemForSettle.baseKarat,
                            3,
                          ),
                          3,
                        );
                        const diff = roundWeight(
                          newConverted - selectedItemForSettle.convertedWeight,
                          3,
                        );
                        return (
                          <span
                            className={`font-mono font-black ${
                              diff >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {diff >= 0 ? `+${diff}` : diff} گرم طلا
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    یادداشت یا شماره قبض ری‌گیری (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder="مثال: قبض شماره ۴۸۲۹ ری‌گیری مرکزی"
                    className="w-full h-10 px-3 text-xs font-bold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setSelectedItemForSettle(null)}
                  disabled={settling}
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={settling || !Number(modalPurity)}
                  onClick={() =>
                    handleSettleSubmit(
                      selectedItemForSettle,
                      Number(modalPurity),
                      modalNotes,
                    )
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md disabled:opacity-50"
                >
                  {settling ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  تایید و خروج از حالت شرطی
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
