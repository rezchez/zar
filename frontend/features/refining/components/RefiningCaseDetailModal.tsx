'use client';

import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  DollarSign,
  Flame,
  Layers,
  LoaderCircle,
  PackageOpen,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type {
  RefiningCase,
  RefiningCaseSummary,
  RefiningItem,
  RefiningSample,
} from '../types';
import { REFINING_CASE_STATUS_LABELS } from '../types';
import { formatWeight } from '@/lib/weight';
import { formatJalaliDate } from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';
import DatePicker from '@/components/ui/date-picker';
import { AssayLaboratorySelect } from '@/components/AssayLaboratorySelect';

interface RefiningCaseDetailModalProps {
  caseId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function RefiningCaseDetailModal({
  caseId,
  onClose,
  onUpdated,
}: RefiningCaseDetailModalProps) {
  const { settings } = useAppSettings();
  const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [loading, setLoading] = useState(true);
  const [refiningCase, setRefiningCase] = useState<RefiningCase | null>(null);
  const [items, setItems] = useState<RefiningItem[]>([]);
  const [samples, setSamples] = useState<RefiningSample[]>([]);
  const [summary, setSummary] = useState<RefiningCaseSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'sent' | 'output' | 'samples' | 'fee'>('summary');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Sub-modal states
  const [openDeliverModal, setOpenDeliverModal] = useState(false);
  const [deliverWeight, setDeliverWeight] = useState('');
  const [deliverPurity, setDeliverPurity] = useState('750');
  const [deliverStamp, setDeliverStamp] = useState('');
  const [deliverLab, setDeliverLab] = useState('');
  const [deliverDesc, setDeliverDesc] = useState('');
  const [deliverSubmitting, setDeliverSubmitting] = useState(false);

  const [openOutputModal, setOpenOutputModal] = useState(false);
  const [outputWeight, setOutputWeight] = useState('');
  const [outputPurity, setOutputPurity] = useState('750');
  const [outputStamp, setOutputStamp] = useState('');
  const [outputLab, setOutputLab] = useState('');
  const [outputDate, setOutputDate] = useState(formatJalaliDate(new Date()));
  const [outputDesc, setOutputDesc] = useState('');
  const [outputSubmitting, setOutputSubmitting] = useState(false);

  const [openSampleModal, setOpenSampleModal] = useState(false);
  const [sampleWeight, setSampleWeight] = useState('');
  const [samplePurity, setSamplePurity] = useState('750');
  const [sampleDesc, setSampleDesc] = useState('');
  const [sampleSubmitting, setSampleSubmitting] = useState(false);

  const [openFeeModal, setOpenFeeModal] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  // Receive sample inline
  const [receivingSampleId, setReceivingSampleId] = useState<string | null>(null);
  const [sampleReceivedWeight, setSampleReceivedWeight] = useState('');
  const [sampleReceivedDate, setSampleReceivedDate] = useState(formatJalaliDate(new Date()));
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

  // Delete Case State
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);

  const handleDeleteCase = async () => {
    setDeletingCase(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در حذف پرونده ری‌گیری');
        setDeletingCase(false);
        setConfirmDelete(false);
        return;
      }
      onUpdated?.();
      onClose();
    } catch {
      setErrorBanner('خطا در برقراری ارتباط با سرور.');
      setDeletingCase(false);
      setConfirmDelete(false);
    }
  };

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRefiningCase(data.refiningCase);
        setItems(data.items || []);
        setSamples(data.samples || []);
        setSummary(data.summary || null);
      } else {
        setErrorBanner('خطا در دریافت مشخصات پرونده ری‌گیری');
      }
    } catch {
      setErrorBanner('عدم برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawW = parseFloat(deliverWeight);
    const pur = parseFloat(deliverPurity);
    if (!rawW || rawW <= 0 || !pur || pur <= 0) {
      setErrorBanner('لطفاً وزن و عیار معتبر وارد کنید.');
      return;
    }

    setDeliverSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawWeight: rawW,
          purity: pur,
          stampNumber: deliverStamp.trim(),
          labName: deliverLab.trim(),
          description: deliverDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در تحویل طلا به ریگیر');
        return;
      }

      setSuccessBanner(`طلای ارسالی به وزن ${formatWeight(rawW)} گرم با موفقیت ثبت و از انبار آزاد خارج شد.`);
      setOpenDeliverModal(false);
      setDeliverWeight('');
      setDeliverDesc('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      setErrorBanner('خطا در ارتباط با سرور.');
    } finally {
      setDeliverSubmitting(false);
    }
  };

  const handleOutputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawW = parseFloat(outputWeight);
    const pur = parseFloat(outputPurity);
    if (!rawW || rawW <= 0 || !pur || pur <= 0) {
      setErrorBanner('لطفاً وزن و عیار معتبر وارد کنید.');
      return;
    }

    setOutputSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawWeight: rawW,
          purity: pur,
          stampNumber: outputStamp.trim(),
          labName: outputLab.trim(),
          receiptDate: outputDate.trim(),
          description: outputDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در دریافت طلای خروجی');
        return;
      }

      setSuccessBanner(`طلای خروجی تصفیه‌شده به وزن ${formatWeight(rawW)} گرم با موفقیت وارد انبار طلا شد.`);
      setOpenOutputModal(false);
      setOutputWeight('');
      setOutputDesc('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      setErrorBanner('خطا در ارتباط با سرور.');
    } finally {
      setOutputSubmitting(false);
    }
  };

  const handleSampleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const decW = parseFloat(sampleWeight);
    const pur = parseFloat(samplePurity);
    if (!decW || decW <= 0) {
      setErrorBanner('لطفاً وزن اعلام‌شده پاکت نمونه را وارد کنید.');
      return;
    }

    setSampleSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          declaredWeight: decW,
          purity: pur,
          description: sampleDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در ایجاد پاکت نمونه');
        return;
      }

      setSuccessBanner(`پاکت نمونه با شناسه ${data.sample.packetNumber} صادر گردید.`);
      setOpenSampleModal(false);
      setSampleWeight('');
      setSampleDesc('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      setErrorBanner('خطا در ارتباط با سرور.');
    } finally {
      setSampleSubmitting(false);
    }
  };

  const handleReceiveSample = async (sampleId: string) => {
    const recW = parseFloat(sampleReceivedWeight);
    if (!recW || recW <= 0) {
      setErrorBanner('لطفاً وزن واقعی دریافتی پاکت را وارد کنید.');
      return;
    }

    setReceiveSubmitting(true);
    try {
      const res = await fetch(`/api/refining/packets/${sampleId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedWeight: recW,
          receivedDate: sampleReceivedDate.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در دریافت پاکت نمونه');
        return;
      }

      setSuccessBanner(`پاکت نمونه دریافت شد و وزن ${formatWeight(recW)} گرم وارد موجودی طلا گردید.`);
      setReceivingSampleId(null);
      setSampleReceivedWeight('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      setErrorBanner('خطا در ارتباط با سرور.');
    } finally {
      setReceiveSubmitting(false);
    }
  };

  const handleFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseInt(feeAmount.replace(/\D/g, ''), 10);
    if (!fee || fee <= 0) {
      setErrorBanner('لطفاً مبلغ اجرت ری‌گیری را وارد کنید.');
      return;
    }

    setFeeSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refiningFee: fee }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorBanner(data.message || 'خطا در ثبت اجرت ری‌گیری');
        return;
      }

      setSuccessBanner('اجرت ری‌گیری با موفقیت در سیستم حسابداری دوبل ثبت و بدهی ما به ریگیر منظور شد.');
      setOpenFeeModal(false);
      setFeeAmount('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      setErrorBanner('خطا در ارتباط با سرور.');
    } finally {
      setFeeSubmitting(false);
    }
  };

  const sentItems = items.filter((i) => i.itemType === 'sent_gold');
  const outputItems = items.filter((i) => i.itemType === 'output_gold');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
              <Flame size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-lg font-black text-slate-900 dark:text-white">
                  {refiningCase?.caseNumber || 'در حال بارگذاری...'}
                </h2>
                {refiningCase ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {REFINING_CASE_STATUS_LABELS[refiningCase.status] || refiningCase.status}
                  </span>
                ) : null}
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                طرف‌حساب ریگیر: {refiningCase?.refinerName || '—'} | تاریخ: {refiningCase?.date || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50/70 px-3.5 py-2 text-xs font-black text-rose-700 transition-all hover:bg-rose-100 hover:text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40"
              title="حذف پرونده ری‌گیری"
            >
              <Trash2 size={15} />
              <span>حذف پرونده</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Appica-Style Tabs Navigation */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 p-3 sm:px-6 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="overflow-x-auto scrollbar-none">
            <div className="inline-flex w-full min-w-max items-center gap-1.5 rounded-2xl bg-slate-200/60 p-1.5 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 select-none ${
                  activeTab === 'summary'
                    ? 'bg-white text-amber-800 shadow-sm dark:bg-slate-900 dark:text-amber-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/40'
                }`}
              >
                <Scale size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>خلاصه و تراز وزنی</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sent')}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 select-none ${
                  activeTab === 'sent'
                    ? 'bg-white text-amber-800 shadow-sm dark:bg-slate-900 dark:text-amber-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/40'
                }`}
              >
                <Flame size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>خروج طلا</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 font-mono text-[10px] font-black transition-colors ${
                    activeTab === 'sent'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {sentItems.length.toLocaleString('fa-IR')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('output')}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 select-none ${
                  activeTab === 'output'
                    ? 'bg-white text-emerald-800 shadow-sm dark:bg-slate-900 dark:text-emerald-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/40'
                }`}
              >
                <Sparkles size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>دریافت شرطی</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 font-mono text-[10px] font-black transition-colors ${
                    activeTab === 'output'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {outputItems.length.toLocaleString('fa-IR')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('samples')}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 select-none ${
                  activeTab === 'samples'
                    ? 'bg-white text-amber-800 shadow-sm dark:bg-slate-900 dark:text-amber-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/40'
                }`}
              >
                <PackageOpen size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>پاکت‌های نمونه</span>
                <span
                  className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 font-mono text-[10px] font-black transition-colors ${
                    activeTab === 'samples'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {samples.length.toLocaleString('fa-IR')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('fee')}
                className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black transition-all duration-200 select-none ${
                  activeTab === 'fee'
                    ? 'bg-white text-amber-800 shadow-sm dark:bg-slate-900 dark:text-amber-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/40'
                }`}
              >
                <DollarSign size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                <span>اجرت و حسابداری</span>
                {refiningCase?.feeSettled ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    ثبت‌شده
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        {/* Banners */}
        {errorBanner ? (
          <div className="m-4 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
            <button type="button" onClick={() => setErrorBanner(null)}>
              <X size={14} />
            </button>
          </div>
        ) : null}

        {successBanner ? (
          <div className="m-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successBanner}</span>
            </div>
            <button type="button" onClick={() => setSuccessBanner(null)}>
              <X size={14} />
            </button>
          </div>
        ) : null}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {loading ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <LoaderCircle size={32} className="animate-spin text-amber-500" />
              <span className="text-xs font-bold text-slate-400">در حال بارگذاری پرونده...</span>
            </div>
          ) : activeTab === 'summary' ? (
            <div className="space-y-6">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-800/60">
                  <span className="text-[11px] font-bold text-slate-400">مجموع طلای ارسالی</span>
                  <p className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-white">
                    {formatWeight(summary?.totalSentWeight || 0)}{' '}
                    <span className="text-xs font-normal">گرم</span>
                  </p>
                </div>

                <div className="rounded-3xl border border-emerald-200/60 bg-emerald-50/30 p-4 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">طلای خروجی دریافتی</span>
                  <p className="mt-1 font-mono text-lg font-black text-emerald-700 dark:text-emerald-300">
                    {formatWeight(summary?.totalOutputWeight || 0)}{' '}
                    <span className="text-xs font-normal">گرم</span>
                  </p>
                </div>

                <div className="rounded-3xl border border-amber-200/60 bg-amber-50/30 p-4 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">نمونه‌های دریافتی</span>
                  <p className="mt-1 font-mono text-lg font-black text-amber-700 dark:text-amber-300">
                    {formatWeight(summary?.totalReceivedSampleWeight || 0)}{' '}
                    <span className="text-xs font-normal">گرم</span>
                  </p>
                </div>

                <div className="rounded-3xl border border-rose-200/60 bg-rose-50/30 p-4 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/20">
                  <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">افت فرآیند ری‌گیری</span>
                  <p className="mt-1 font-mono text-lg font-black text-rose-700 dark:text-rose-300">
                    {formatWeight(summary?.totalWeightDifference || 0)}{' '}
                    <span className="text-xs font-normal">گرم</span>
                  </p>
                </div>
              </div>

              {/* Status and Refiner Debt Card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    ⚖️ طلای باقیمانده نزد ریگیر
                  </span>
                  <p className="font-mono text-2xl font-black text-amber-700 dark:text-amber-400">
                    {formatWeight(summary?.remainingWeightAtRefiner || 0)} گرم
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    این مقدار طلا تا زمان دریافت خروجی کامل نزد آزمایشگاه عیارسنجی باقی مانده است.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    💰 اجرت و بدهی ما به ریگیر
                  </span>
                  <p className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
                    {(summary?.debtToRefiner || 0).toLocaleString('fa-IR')} {currencySuffix}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    ثبت‌شده در سرفصل بستانکاران تجاری (حساب‌های پرداختنی) و کارت حساب طرف‌حساب.
                  </p>
                </div>
              </div>

              {/* Description */}
              {refiningCase?.description ? (
                <div className="rounded-3xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-800/50">
                  <span className="text-xs font-bold text-slate-400">توضیحات پرونده:</span>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {refiningCase.description}
                  </p>
                </div>
              ) : null}
            </div>
          ) : activeTab === 'sent' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  اقلام خروج طلا (تحویل‌شده به ریگیر)
                </span>
                <button
                  type="button"
                  onClick={() => setOpenDeliverModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500"
                >
                  <Plus size={14} />
                  <span>ثبت خروج طلای جدید به ریگیر</span>
                </button>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="p-3">وزن (گرم)</th>
                      <th className="p-3">عیار</th>
                      <th className="p-3">معادل ۷۵۰</th>
                      <th className="p-3">شماره انگ</th>
                      <th className="p-3">آزمایشگاه</th>
                      <th className="p-3">توضیحات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {sentItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          هنوز طلایی برای این پرونده خارج/تحویل ریگیر نشده است.
                        </td>
                      </tr>
                    ) : (
                      sentItems.map((item) => (
                        <tr key={item.id}>
                          <td className="p-3 font-mono font-black text-slate-900 dark:text-white">
                            {formatWeight(item.rawWeight)}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                            {item.purity}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                            {formatWeight(item.convertedWeight)}
                          </td>
                          <td className="p-3 font-mono">{item.stampNumber || '—'}</td>
                          <td className="p-3">{item.labName || '—'}</td>
                          <td className="p-3 text-slate-500">{item.description || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'output' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  اقلام دریافت شرطی (طلای تصفیه‌شده از ریگیر)
                </span>
                <button
                  type="button"
                  onClick={() => setOpenOutputModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-500"
                >
                  <Plus size={14} />
                  <span>ثبت دریافت شرطی</span>
                </button>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="p-3">وزن دریافتی (گرم)</th>
                      <th className="p-3">عیار نهایی</th>
                      <th className="p-3">معادل ۷۵۰</th>
                      <th className="p-3">شماره انگ</th>
                      <th className="p-3">آزمایشگاه</th>
                      <th className="p-3">تاریخ دریافت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {outputItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          هنوز طلایی به عنوان دریافت شرطی برای این پرونده ثبت نشده است.
                        </td>
                      </tr>
                    ) : (
                      outputItems.map((item) => (
                        <tr key={item.id}>
                          <td className="p-3 font-mono font-black text-emerald-700 dark:text-emerald-400">
                            {formatWeight(item.rawWeight)}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                            {item.purity}
                          </td>
                          <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                            {formatWeight(item.convertedWeight)}
                          </td>
                          <td className="p-3 font-mono font-bold">{item.stampNumber || '—'}</td>
                          <td className="p-3">{item.labName || '—'}</td>
                          <td className="p-3 font-mono">{item.receiptDate || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'samples' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  پاکت‌های نمونه ری‌گیری
                </span>
                <button
                  type="button"
                  onClick={() => setOpenSampleModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500"
                >
                  <Plus size={14} />
                  <span>صدور پاکت نمونه جدید</span>
                </button>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-right text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                    <tr>
                      <th className="p-3">شماره پاکت</th>
                      <th className="p-3">وزن اعلام‌شده</th>
                      <th className="p-3">وزن دریافتی</th>
                      <th className="p-3">افت / اختلاف</th>
                      <th className="p-3">وضعیت</th>
                      <th className="p-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {samples.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          هیچ پاکت نمونه‌ای برای این پرونده صادر نشده است.
                        </td>
                      </tr>
                    ) : (
                      samples.map((s) => (
                        <tr key={s.id}>
                          <td className="p-3 font-mono font-black text-slate-900 dark:text-white">
                            {s.packetNumber}
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                            {formatWeight(s.declaredWeight)} گرم
                          </td>
                          <td className="p-3 font-mono font-black text-emerald-700 dark:text-emerald-400">
                            {s.status === 'received' ? `${formatWeight(s.receivedWeight)} گرم` : '—'}
                          </td>
                          <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                            {s.status === 'received' ? `${formatWeight(s.weightDifference)} گرم` : '—'}
                          </td>
                          <td className="p-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                                s.status === 'received'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {s.status === 'received' ? 'دریافت‌شده' : 'نزد ریگیر'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {s.status === 'with_refiner' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReceivingSampleId(s.id);
                                  setSampleReceivedWeight(s.declaredWeight.toString());
                                }}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-500"
                              >
                                <Check size={12} />
                                <span>دریافت پاکت</span>
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400">تکمیل</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-850 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      اجرت و دستمزد خدمات ری‌گیری
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      این مبلغ در دفاتر دوبل حسابداری (سرفصل ۵۵۰۰ بدهکار) و در معین طرف‌حساب ریگیر (سرفصل ۲۱۲۰ بستانکار) به عنوان بدهی ما منظور می‌شود.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFeeAmount(refiningCase?.refiningFee ? refiningCase.refiningFee.toString() : '');
                      setOpenFeeModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500"
                  >
                    <DollarSign size={14} />
                    <span>{refiningCase?.refiningFee ? 'ویرایش اجرت' : 'ثبت اجرت ری‌گیری'}</span>
                  </button>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    مبلغ دستمزد ثبت‌شده:
                  </span>
                  <span className="font-mono text-xl font-black text-emerald-700 dark:text-emerald-400">
                    {(refiningCase?.refiningFee || 0).toLocaleString('fa-IR')} {currencySuffix}
                  </span>
                </div>

                {refiningCase?.journalEntryId ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={16} />
                    <span>سند حسابداری دوبل با موفقیت صادر و شناسه ثبت گردید.</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Modal Sub-dialogs (Deliver, Output, Sample, Fee, Receive Sample) */}
        {openDeliverModal ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">تحویل طلا به ریگیر</h4>
                <button type="button" onClick={() => setOpenDeliverModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDeliverSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن طلا (گرم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={deliverWeight}
                    onChange={(e) => setDeliverWeight(e.target.value)}
                    placeholder="مثال: ۱۰۵.۲۰۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">عیار (بر پایه ۱۰۰۰) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    required
                    value={deliverPurity}
                    onChange={(e) => setDeliverPurity(e.target.value)}
                    placeholder="۷۵۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">شماره انگ / آزمایشگاه</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={deliverStamp}
                      onChange={(e) => setDeliverStamp(e.target.value)}
                      placeholder="شماره انگ"
                      className="h-10 w-full rounded-2xl border px-3 font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      value={deliverLab}
                      onChange={(e) => setDeliverLab(e.target.value)}
                      placeholder="نام آزمایشگاه"
                      className="h-10 w-full rounded-2xl border px-3 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-black mb-1">توضیحات</label>
                  <input
                    type="text"
                    value={deliverDesc}
                    onChange={(e) => setDeliverDesc(e.target.value)}
                    placeholder="توضیحات اختیاری"
                    className="h-10 w-full rounded-2xl border px-3 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenDeliverModal(false)}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={deliverSubmitting}
                    className="h-10 rounded-2xl bg-amber-600 px-5 font-black text-white hover:bg-amber-500"
                  >
                    {deliverSubmitting ? 'در حال ثبت...' : 'تأیید و کسر از انبار آزاد'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {openOutputModal ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">ثبت دریافت شرطی (طلای تصفیه‌شده)</h4>
                <button type="button" onClick={() => setOpenOutputModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleOutputSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن طلای دریافتی (گرم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={outputWeight}
                    onChange={(e) => setOutputWeight(e.target.value)}
                    placeholder="مثال: ۹۸.۵۰۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">عیار رسمی خروجی *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    required
                    value={outputPurity}
                    onChange={(e) => setOutputPurity(e.target.value)}
                    placeholder="۷۵۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black mb-1">شماره انگ جدید</label>
                    <input
                      type="text"
                      value={outputStamp}
                      onChange={(e) => setOutputStamp(e.target.value)}
                      placeholder="شماره انگ جدید"
                      className="h-10 w-full rounded-2xl border px-3 font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-black mb-1">نام ری‌گیری (آزمایشگاه)</label>
                    <AssayLaboratorySelect
                      value={outputLab}
                      onChange={(val) => setOutputLab(val)}
                      placeholder="انتخاب یا جستجوی ری‌گیری..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-black mb-1">تاریخ دریافت</label>
                  <DatePicker
                    value={outputDate}
                    onValueChange={(_iso, jalali) => setOutputDate(jalali)}
                    calendarType="shamsi"
                    format="yyyy/MM/dd"
                    className="w-full"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenOutputModal(false)}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={outputSubmitting}
                    className="h-10 rounded-2xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-500"
                  >
                    {outputSubmitting ? 'در حال ثبت...' : 'تأیید و ورود به موجودی'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {openSampleModal ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">صدور پاکت نمونه ری‌گیری</h4>
                <button type="button" onClick={() => setOpenSampleModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSampleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن اعلام‌شده پاکت (گرم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={sampleWeight}
                    onChange={(e) => setSampleWeight(e.target.value)}
                    placeholder="مثال: ۲.۵۰۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">عیار نمونه</label>
                  <input
                    type="number"
                    step="0.1"
                    value={samplePurity}
                    onChange={(e) => setSamplePurity(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">توضیحات</label>
                  <input
                    type="text"
                    value={sampleDesc}
                    onChange={(e) => setSampleDesc(e.target.value)}
                    placeholder="توضیحات نمونه"
                    className="h-10 w-full rounded-2xl border px-3 dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenSampleModal(false)}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={sampleSubmitting}
                    className="h-10 rounded-2xl bg-amber-600 px-5 font-black text-white hover:bg-amber-500"
                  >
                    {sampleSubmitting ? 'در حال صدور...' : 'صدور پاکت نمونه'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {receivingSampleId ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">دریافت پاکت نمونه</h4>
                <button type="button" onClick={() => setReceivingSampleId(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن واقعی دریافتی (گرم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={sampleReceivedWeight}
                    onChange={(e) => setSampleReceivedWeight(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">تاریخ دریافت</label>
                  <DatePicker
                    value={sampleReceivedDate}
                    onValueChange={(_iso, jalali) => setSampleReceivedDate(jalali)}
                    calendarType="shamsi"
                    format="yyyy/MM/dd"
                    className="w-full"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/50">
                  🛡️ اختلاف وزنی نمونه فقط به عنوان افت عملیاتی گزارش می‌شود و تأثیری در حساب مالی ریگیر ندارد.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReceivingSampleId(null)}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={receiveSubmitting}
                    onClick={() => void handleReceiveSample(receivingSampleId)}
                    className="h-10 rounded-2xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-500"
                  >
                    {receiveSubmitting ? 'در حال دریافت...' : 'تأیید و ورود به موجودی'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {openFeeModal ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">ثبت اجرت و دستمزد ری‌گیری</h4>
                <button type="button" onClick={() => setOpenFeeModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleFeeSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">مبلغ اجرت ({currencySuffix}) *</label>
                  <input
                    type="text"
                    required
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    placeholder="مثال: ۲۵,۰۰۰,۰۰۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/50">
                  ⚖️ این مبلغ در حسابداری دوبل در سرفصل هزینه ثبت شده و در معین طرف‌حساب ریگیر به عنوان بدهی ما (بستانکاری ریگیر) منظور می‌گردد.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpenFeeModal(false)}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={feeSubmitting}
                    className="h-10 rounded-2xl bg-emerald-600 px-5 font-black text-white hover:bg-emerald-500"
                  >
                    {feeSubmitting ? 'در حال ثبت...' : 'تأیید و صدور سند حسابداری'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* Delete Confirmation Modal */}
        {confirmDelete ? (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/50 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">حذف پرونده ری‌گیری</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    شماره پرونده: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{refiningCase?.caseNumber}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-xs font-bold leading-relaxed text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/30 dark:text-rose-300 space-y-1.5">
                <p>⚠️ با حذف این پرونده ری‌گیری:</p>
                <ul className="list-disc pr-4 space-y-1 text-[11px] font-medium text-rose-800 dark:text-rose-300">
                  <li>تمام اقلام طلا و پاکت‌های نمونه ثبت‌شده ذیل این پرونده حذف می‌گردند.</li>
                  <li>کلیه خروج‌ها و ورودهای طلای انبار مرتبط با این پرونده به صورت کامل لغو و بازگردانی می‌شوند.</li>
                  <li>اسناد دوبل حسابداری ثبت‌شده برای اجرت ری‌گیری این پرونده به صورت خودکار حذف می‌شوند.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deletingCase}
                  className="h-10 rounded-2xl border px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCase}
                  disabled={deletingCase}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {deletingCase ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  <span>تأیید و حذف قطعی</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
