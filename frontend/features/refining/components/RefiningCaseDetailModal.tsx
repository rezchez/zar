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
<<<<<<< HEAD
=======
import DatePicker from '@/components/ui/date-picker';
import { AssayLaboratorySelect } from '@/components/AssayLaboratorySelect';
import { PriceInput } from '@/components/ui/price-input';
import { useToastManager } from '@/components/ui/toast';

type DeliveryGoldKind = 'melted' | 'miscellaneous' | 'conditional' | 'sowaleh';

const DELIVERY_KIND_LABELS: Record<DeliveryGoldKind, string> = {
  melted: 'آبشده',
  miscellaneous: 'متفرقه',
  conditional: 'شرطی',
  sowaleh: 'سواله',
};
>>>>>>> cd583e7 (fixed many bugs)

const KIND_TO_INVENTORY_PARAM: Record<DeliveryGoldKind, 'molten' | 'misc' | 'conditional' | 'question'> = {
  melted: 'molten',
  miscellaneous: 'misc',
  conditional: 'conditional',
  sowaleh: 'question',
};

interface InventoryLotItem {
  id: string;
  weight: number;
  remainingWeight: number;
  purity: number;
  stampNumber: string;
  labName?: string;
  customerName: string;
  rawKind?: 'molten' | 'conditional' | 'misc' | 'question';
}

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
  const toast = useToastManager();
  const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [loading, setLoading] = useState(true);
  const [refiningCase, setRefiningCase] = useState<RefiningCase | null>(null);
  const [items, setItems] = useState<RefiningItem[]>([]);
  const [samples, setSamples] = useState<RefiningSample[]>([]);
  const [summary, setSummary] = useState<RefiningCaseSummary | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'sent' | 'output' | 'fee'>('summary');

  // Sub-modal states
  const [openDeliverModal, setOpenDeliverModal] = useState(false);
<<<<<<< HEAD
=======
  const [deliverKind, setDeliverKind] = useState<DeliveryGoldKind>('melted');
  const [deliverLots, setDeliverLots] = useState<InventoryLotItem[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [loadingLots, setLoadingLots] = useState(false);
>>>>>>> cd583e7 (fixed many bugs)
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
  const [outputPacketNumber, setOutputPacketNumber] = useState('');
  const [outputSampleWeight, setOutputSampleWeight] = useState('2.5');
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

<<<<<<< HEAD
=======
  // Direct Settle Assay Purity Modal
  const [settlingSampleId, setSettlingSampleId] = useState<string | null>(null);
  const [settlePurityValue, setSettlePurityValue] = useState('750');
  const [settlingSubmitting, setSettlingSubmitting] = useState(false);

  // Delete Case State
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingCase, setDeletingCase] = useState(false);

  const handleDeleteCase = async () => {
    setDeletingCase(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در حذف پرونده', data.message || 'حذف پرونده ری‌گیری انجام نشد.');
        setDeletingCase(false);
        setConfirmDelete(false);
        return;
      }
      toast.success('پرونده ری‌گیری با موفقیت حذف شد', 'کلیه اطلاعات، نمونه‌ها و اسناد مرتبط لغو گردیدند.');
      onUpdated?.();
      onClose();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
      setDeletingCase(false);
      setConfirmDelete(false);
    }
  };

>>>>>>> cd583e7 (fixed many bugs)
  const fetchDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRefiningCase(data.refiningCase);
        setItems(data.items || []);
        setSamples(data.samples || []);
        setSummary(data.summary || null);
      } else {
        toast.error('خطا در بارگذاری پرونده', 'امکان دریافت مشخصات پرونده ری‌گیری وجود ندارد.');
      }
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }, [caseId, toast]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  // Fetch available raw gold inventory lots when deliver modal opens or deliverKind changes
  useEffect(() => {
    if (!openDeliverModal) return;
    const kindParam = KIND_TO_INVENTORY_PARAM[deliverKind];
    setLoadingLots(true);
    fetch(`/api/documents?inventory=raw-gold&kind=${kindParam}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { inventory?: InventoryLotItem[] }) => {
        setDeliverLots(data.inventory ?? []);
      })
      .catch(() => {
        setDeliverLots([]);
      })
      .finally(() => {
        setLoadingLots(false);
      });
  }, [openDeliverModal, deliverKind]);

  const handleSelectDeliverKind = (kind: DeliveryGoldKind) => {
    setDeliverKind(kind);
    setSelectedLotId('');
    setDeliverWeight('');
    setDeliverPurity('750');
    setDeliverStamp('');
    setDeliverLab('');
  };

  const handleSelectLot = (lotId: string) => {
    setSelectedLotId(lotId);
    const lot = deliverLots.find((item) => item.id === lotId);
    if (lot) {
      setDeliverWeight(String(lot.remainingWeight));
      setDeliverPurity(String(lot.purity || 750));
      setDeliverStamp(lot.stampNumber || '');
      setDeliverLab(lot.labName || '');
    } else {
      setDeliverWeight('');
      setDeliverPurity('750');
      setDeliverStamp('');
      setDeliverLab('');
    }
  };

  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawW = parseFloat(deliverWeight);
    const pur = parseFloat(deliverPurity);
    if (!rawW || rawW <= 0 || !pur || pur <= 0) {
      toast.warning('مقادیر نامعتبر', 'لطفاً وزن و عیار معتبر وارد کنید.');
      return;
    }

    if (selectedLotId) {
      const selectedLot = deliverLots.find((l) => l.id === selectedLotId);
      if (selectedLot && rawW > selectedLot.remainingWeight + 0.0000001) {
        toast.warning(
          'کسری موجودی',
          `وزن واردشده (${formatWeight(rawW)} گرم) بیشتر از موجودی قابل استفاده (${formatWeight(selectedLot.remainingWeight)} گرم) است.`
        );
        return;
      }
    }

    setDeliverSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawWeight: rawW,
          purity: pur,
<<<<<<< HEAD
=======
          inventoryType: deliverKind,
          sourceInventoryId: selectedLotId || undefined,
>>>>>>> cd583e7 (fixed many bugs)
          stampNumber: deliverStamp.trim(),
          labName: deliverLab.trim(),
          description: deliverDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در تحویل طلا', data.message || 'ثبت خروج طلا با خطا مواجه شد.');
        return;
      }

<<<<<<< HEAD
      setSuccessBanner(`طلای ارسالی به وزن ${formatWeight(rawW)} گرم با موفقیت ثبت و از انبار آزاد خارج شد.`);
=======
      toast.success(
        'خروج طلا با موفقیت ثبت شد',
        `طلای ارسالی (${DELIVERY_KIND_LABELS[deliverKind]}) به وزن ${formatWeight(rawW)} گرم از انبار آزاد خارج گردید.`
      );
>>>>>>> cd583e7 (fixed many bugs)
      setOpenDeliverModal(false);
      setSelectedLotId('');
      setDeliverWeight('');
      setDeliverDesc('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setDeliverSubmitting(false);
    }
  };

  const handleOutputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawW = parseFloat(outputWeight);
<<<<<<< HEAD
    const pur = parseFloat(outputPurity);
    if (!rawW || rawW <= 0 || !pur || pur <= 0) {
      setErrorBanner('لطفاً وزن و عیار معتبر وارد کنید.');
=======
    if (!rawW || rawW <= 0) {
      toast.warning('وزن نامعتبر', 'لطفاً وزن معتبر برای طلای دریافتی وارد کنید.');
>>>>>>> cd583e7 (fixed many bugs)
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
          packetNumber: outputPacketNumber.trim() || undefined,
          sampleDeclaredWeight: outputSampleWeight ? parseFloat(outputSampleWeight) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
<<<<<<< HEAD
        setErrorBanner(data.message || 'خطا در دریافت طلای خروجی');
        return;
      }

      setSuccessBanner(`طلای خروجی تصفیه‌شده به وزن ${formatWeight(rawW)} گرم با موفقیت وارد انبار طلا شد.`);
      setOpenOutputModal(false);
      setOutputWeight('');
=======
        toast.error('خطا در دریافت طلا', data.message || 'ثبت طلای دریافتی با خطا مواجه شد.');
        return;
      }

      toast.success(
        'طلای شرطی و پاکت ری‌گیری با موفقیت ثبت شد',
        `طلای دریافتی به وزن ${formatWeight(rawW)} گرم وارد موجودی شد${outputPacketNumber.trim() ? ` و پاکت شماره ${outputPacketNumber.trim()} در پرونده ثبت گردید` : ''}.`
      );
      setOpenOutputModal(false);
      setOutputWeight('');
      setOutputStamp('');
      setOutputLab('');
      setOutputPacketNumber('');
      setOutputSampleWeight('2.5');
>>>>>>> cd583e7 (fixed many bugs)
      setOutputDesc('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setOutputSubmitting(false);
    }
  };

  const handleSampleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const decW = parseFloat(sampleWeight);
    const pur = parseFloat(samplePurity);
    if (!decW || decW <= 0) {
      toast.warning('وزن نامعتبر', 'لطفاً وزن اعلام‌شده پاکت نمونه را وارد کنید.');
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
        toast.error('خطا در ایجاد پاکت', data.message || 'صدور پاکت نمونه با خطا مواجه شد.');
        return;
      }

      toast.success('صدور پاکت نمونه', `پاکت نمونه با شناسه ${data.sample.packetNumber} صادر گردید.`);
      setOpenSampleModal(false);
      setSampleWeight('');
      setSampleDesc('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setSampleSubmitting(false);
    }
  };

  const handleReceiveSample = async (sampleId: string) => {
    const recW = parseFloat(sampleReceivedWeight);
    if (!recW || recW <= 0) {
      toast.warning('وزن نامعتبر', 'لطفاً وزن واقعی دریافتی پاکت را وارد کنید.');
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
        toast.error('خطا در دریافت پاکت', data.message || 'ثبت دریافت پاکت نمونه با خطا مواجه شد.');
        return;
      }

<<<<<<< HEAD
      setSuccessBanner(`پاکت نمونه دریافت شد و وزن ${formatWeight(recW)} گرم وارد موجودی طلا گردید.`);
=======
      toast.success(
        'دریافت پاکت نمونه و تبدیل قطعی',
        `پاکت نمونه دریافت شد، وزن ${formatWeight(recW)} گرم وارد موجودی گردید و طلای شرطی پرونده به آبشده قطعی با عیار ${labPurity || 750} تبدیل شد.`
      );
>>>>>>> cd583e7 (fixed many bugs)
      setReceivingSampleId(null);
      setSampleReceivedWeight('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setReceiveSubmitting(false);
    }
  };

<<<<<<< HEAD
  const handleFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseInt(feeAmount.replace(/\D/g, ''), 10);
    if (!fee || fee <= 0) {
      setErrorBanner('لطفاً مبلغ اجرت ری‌گیری را وارد کنید.');
=======
  const handleSettlePuritySubmit = async (sampleId: string) => {
    const purityVal = parseFloat(settlePurityValue);
    if (!purityVal || purityVal <= 0 || purityVal > 1000) {
      toast.warning('عیار نامعتبر', 'لطفاً عیار آزمایشگاه معتبری بین ۱ تا ۱۰۰۰ وارد کنید.');
      return;
    }

    setSettlingSubmitting(true);
    try {
      const res = await fetch(`/api/refining/packets/${sampleId}/purity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purity: purityVal }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در ثبت عیار', data.message || 'ثبت عیار اعلامی آزمایشگاه با خطا مواجه شد.');
        return;
      }

      toast.success(
        'ثبت عیار قطعی آزمایشگاه',
        `عیار آزمایشگاه (${purityVal}) با موفقیت ثبت شد و طلای شرطی به آبشده قطعی تبدیل گردید.`
      );
      setSettlingSampleId(null);
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setSettlingSubmitting(false);
    }
  };

  const handleFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = parseInt(feeAmount.replace(/,/g, ''), 10);
    if (isNaN(fee) || fee < 0) {
      toast.warning('مبلغ نامعتبر', 'لطفاً مبلغ اجرت معتبر وارد کنید.');
>>>>>>> cd583e7 (fixed many bugs)
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
        toast.error('خطا در ثبت اجرت', data.message || 'ثبت اجرت ری‌گیری با خطا مواجه شد.');
        return;
      }

<<<<<<< HEAD
      setSuccessBanner('اجرت ری‌گیری با موفقیت در سیستم حسابداری دوبل ثبت و بدهی ما به ریگیر منظور شد.');
=======
      toast.success('ثبت اجرت ری‌گیری', 'اجرت ری‌گیری با موفقیت ثبت و سند حسابداری دوبل صادر گردید.');
>>>>>>> cd583e7 (fixed many bugs)
      setOpenFeeModal(false);
      setFeeAmount('');
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
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
                {refiningCase?.stampNumber ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title="شماره انگ">
                    انگ: {refiningCase.stampNumber}
                  </span>
                ) : null}
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                طرف‌حساب ریگیر: {refiningCase?.refinerName || '—'} | تاریخ: {refiningCase?.date || '—'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

<<<<<<< HEAD
        {/* Nav Tabs */}
        <div className="flex shrink-0 border-b border-slate-100 bg-slate-50/60 px-5 text-xs font-black dark:border-slate-800 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`border-b-2 py-3 px-4 transition-all ${
              activeTab === 'summary'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            خلاصه و تراز وزنی
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sent')}
            className={`border-b-2 py-3 px-4 transition-all ${
              activeTab === 'sent'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            طلای ارسالی ({sentItems.length.toLocaleString('fa-IR')})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('output')}
            className={`border-b-2 py-3 px-4 transition-all ${
              activeTab === 'output'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            طلای خروجی ({outputItems.length.toLocaleString('fa-IR')})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('samples')}
            className={`border-b-2 py-3 px-4 transition-all ${
              activeTab === 'samples'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            پاکت‌های نمونه ({samples.length.toLocaleString('fa-IR')})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fee')}
            className={`border-b-2 py-3 px-4 transition-all ${
              activeTab === 'fee'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            اجرت و حسابداری
          </button>
=======
        {/* Delete Confirmation Alert Banner */}
        {confirmDelete ? (
          <div className="m-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs font-bold text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span>
                آیا از حذف کامل این پرونده، اقلام ارسالی، پاکت‌های نمونه، ورودی‌های انبار و اسناد دوبل حسابداری مرتبط با آن اطمینان دارید؟ این عملیات غیرقابل بازگشت است.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deletingCase}
                className="h-8 rounded-xl border border-rose-200 bg-white px-3 text-[11px] font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleDeleteCase}
                disabled={deletingCase}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-rose-600 px-3 text-[11px] font-black text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deletingCase ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{deletingCase ? 'در حال حذف...' : 'تأیید حذف پرونده'}</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Tab Navigation - Appica UI Pill Track Style */}
        <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1.5 scrollbar-none dark:bg-slate-800/80" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'summary'}
              onClick={() => setActiveTab('summary')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                activeTab === 'summary'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Flame size={15} className={activeTab === 'summary' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'} />
              <span>خلاصه و سوابق</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'sent'}
              onClick={() => setActiveTab('sent')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                activeTab === 'sent'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Send size={15} className={activeTab === 'sent' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'} />
              <span>خروج طلا</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'sent'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700/80 dark:text-slate-300'
              }`}>
                {sentItems.length.toLocaleString('fa-IR')}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'output'}
              onClick={() => setActiveTab('output')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                activeTab === 'output'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <ArrowDownLeft size={15} className={activeTab === 'output' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'} />
              <span>دریافت شرطی و پاکت ری‌گیری</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'output'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700/80 dark:text-slate-300'
              }`}>
                {outputItems.length.toLocaleString('fa-IR')}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'fee'}
              onClick={() => setActiveTab('fee')}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-black transition-all ${
                activeTab === 'fee'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <DollarSign size={15} className={activeTab === 'fee' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'} />
              <span>اجرت ری‌گیری</span>
            </button>
          </div>
>>>>>>> cd583e7 (fixed many bugs)
        </div>

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
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">طلای شرطی دریافت شده</span>
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
                    {(summary?.remainingWeightAtRefiner || 0) <= 0.0001 || refiningCase?.status === 'completed'
                      ? 'فرآیند ری‌گیری، دریافت پاکت و عیارسنجی تکمیل شده و هیچ طلایی نزد ریگیر باقی نمانده است.'
                      : 'این مقدار طلا تا زمان دریافت کامل خروجی و پاکت نمونه، نزد آزمایشگاه عیارسنجی باقی مانده است.'}
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

              {/* Received Sample Packets History & Assay Settlement */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      <Inbox size={15} />
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                        سوابق پاکت‌های نمونه دریافتی و عیارسنجی ری‌گیری
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        پاکت‌های نمونه دریافت شده از ریگیر و نتیجه عیارسنجی (پایان ری‌گیری)
                      </p>
                    </div>
                  </div>
                  {samples.some((s) => s.status === 'received') ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <CheckCircle2 size={13} />
                      <span>عیارسنجی انجام‌شده (پایان ری‌گیری)</span>
                    </span>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="p-3">شماره پاکت</th>
                        <th className="p-3">وزن اعلامی</th>
                        <th className="p-3">وزن دریافتی</th>
                        <th className="p-3">افت / اختلاف</th>
                        <th className="p-3">عیار قطعی آزمایشگاه</th>
                        <th className="p-3">تاریخ دریافت</th>
                        <th className="p-3">وضعیت فرآیند</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {samples.filter((s) => s.status === 'received').length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            هنوز عیارسنجی نهایی برای پاکت‌های نمونه این پرونده تکمیل نشده است.
                          </td>
                        </tr>
                      ) : (
                        samples
                          .filter((s) => s.status === 'received')
                          .map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-mono font-black text-slate-900 dark:text-white">
                                {s.packetNumber}
                              </td>
                              <td className="p-3 font-mono font-bold text-amber-700 dark:text-amber-400">
                                {formatWeight(s.declaredWeight)} گرم
                              </td>
                              <td className="p-3 font-mono font-black text-emerald-700 dark:text-emerald-400">
                                {formatWeight(s.receivedWeight)} گرم
                              </td>
                              <td className="p-3 font-mono font-bold text-rose-600 dark:text-rose-400">
                                {formatWeight(s.weightDifference)} گرم
                              </td>
                              <td className="p-3 font-mono font-black text-amber-600 dark:text-amber-400">
                                {s.purity}
                              </td>
                              <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                {s.receivedDate || '—'}
                              </td>
                              <td className="p-3">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                  <Check size={11} />
                                  <span>تکمیل و ورود به انبار</span>
                                </span>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
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
<<<<<<< HEAD
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  لیست اقلام طلای تحویل‌شده به ریگیر
                </span>
=======
                <div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    اقلام طلای ارسالی / تحویل‌شده به ریگیر
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    این اقلام مستقیماً از انبار آزاد طلا خارج شده و تا زمان بازگشت، در تعهد ریگیر قرار دارند.
                  </p>
                </div>
>>>>>>> cd583e7 (fixed many bugs)
                <button
                  type="button"
                  onClick={() => setOpenDeliverModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500"
                >
                  <Plus size={14} />
                  <span>تحویل طلای جدید به ریگیر</span>
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
                          هنوز طلایی برای این پرونده تحویل ریگیر نشده است.
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
<<<<<<< HEAD
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                  طلای تصفیه‌شده دریافتی از ریگیر
                </span>
                <button
                  type="button"
                  onClick={() => setOpenOutputModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-500"
                >
                  <Plus size={14} />
                  <span>ثبت دریافت طلای خروجی</span>
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
                          هنوز طلای خروجی برای این پرونده دریافت و ثبت نشده است.
                        </td>
=======
            <div className="space-y-6">
              {/* Part 1: Conditional Gold Outputs Received */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                      اقلام دریافت شرطی (طلای تصفیه‌شده از ریگیر)
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      عیار این طلا به صورت موقت ۷۵۰ ثبت می‌شود و شماره پاکت اعلامی ریگیر نیز همزمان در پرونده ثبت می‌گردد.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenOutputModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-500"
                  >
                    <Plus size={14} />
                    <span>ثبت دریافت شرطی و پاکت ری‌گیری</span>
                  </button>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <table className="w-full text-right text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                      <tr>
                        <th className="p-3">وزن دریافتی (گرم)</th>
                        <th className="p-3">نوع موجودی</th>
                        <th className="p-3">عیار</th>
                        <th className="p-3">معادل ۷۵۰</th>
                        <th className="p-3">شماره انگ</th>
                        <th className="p-3">آزمایشگاه</th>
                        <th className="p-3">تاریخ دریافت</th>
>>>>>>> cd583e7 (fixed many bugs)
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {outputItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            هنوز طلایی به عنوان دریافت شرطی برای این پرونده ثبت نشده است.
                          </td>
<<<<<<< HEAD
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
=======
                        </tr>
                      ) : (
                        outputItems.map((item) => (
                          <tr key={item.id}>
                            <td className="p-3 font-mono font-black text-emerald-700 dark:text-emerald-400">
                              {formatWeight(item.rawWeight)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                                  item.inventoryType === 'melted'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {item.inventoryType === 'melted' ? 'آبشده قطعی' : 'شرطی (موقت)'}
                              </span>
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

              {/* Part 2: Integrated Sample Packets and Assay Results */}
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                      <Inbox size={15} />
                    </span>
                    <div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        پاکت‌های نمونه ری‌گیری و ثبت عیار قطعی
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        با دریافت پاکت و ثبت عیار اعلامی آزمایشگاه، طلای شرطی پرونده به صورت خودکار به آبشده تبدیل می‌شود.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenSampleModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <Plus size={13} />
                    <span>صدور پاکت دستی جدید</span>
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
                        <th className="p-3">عیار آزمایشگاه</th>
                        <th className="p-3">وضعیت</th>
                        <th className="p-3 text-center">عملیات</th>
>>>>>>> cd583e7 (fixed many bugs)
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {samples.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            هیچ پاکت نمونه‌ای برای این پرونده ثبت نشده است. هنگام ثبت دریافت طلای شرطی، شماره پاکت اعلامی ریگیر را ثبت نمایید.
                          </td>
<<<<<<< HEAD
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
=======
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
                            <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">
                              {s.purity ? s.purity : '۷۵۰ (موقت)'}
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
                              <div className="flex items-center justify-center gap-1.5">
                                {s.status === 'with_refiner' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReceivingSampleId(s.id);
                                      setSampleReceivedWeight(s.declaredWeight.toString());
                                      setSampleLabPurity(s.purity ? s.purity.toString() : '750');
                                    }}
                                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-emerald-500"
                                  >
                                    <Check size={12} />
                                    <span>دریافت پاکت</span>
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSettlingSampleId(s.id);
                                    setSettlePurityValue(s.purity ? s.purity.toString() : '750');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-xl bg-amber-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-emerald-500"
                                  title="ثبت یا ویرایش عیار اعلامی آزمایشگاه و تبدیل طلای شرطی به آبشده"
                                >
                                  <span>ثبت عیار</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
>>>>>>> cd583e7 (fixed many bugs)
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200/80 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-800/60 space-y-4">
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
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-800/60 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">تحویل طلا به ریگیر</h4>
                <button type="button" onClick={() => setOpenDeliverModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDeliverSubmit} className="space-y-3.5 text-xs">
                <div>
<<<<<<< HEAD
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
=======
                  <label className="block font-black mb-1.5 text-slate-700 dark:text-slate-300">
                    نوع طلای ارسالی به ریگیر *
                  </label>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع طلای ارسالی">
                    {[
                      { id: 'melted' as DeliveryGoldKind, title: 'طلای آبشده', icon: FlaskConical },
                      { id: 'miscellaneous' as DeliveryGoldKind, title: 'طلای متفرقه', icon: Gem },
                      { id: 'conditional' as DeliveryGoldKind, title: 'طلای شرطی', icon: HandCoins },
                      { id: 'sowaleh' as DeliveryGoldKind, title: 'طلای سواله', icon: FlaskConical },
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const active = deliverKind === opt.id;
                      return (
                        <button
                          type="button"
                          key={opt.id}
                          role="radio"
                          aria-checked={active}
                          onClick={() => handleSelectDeliverKind(opt.id)}
                          className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-right transition-all ${
                            active
                              ? 'border-amber-500 bg-amber-500/10 text-amber-700 shadow-xs dark:border-amber-500/80 dark:text-amber-300'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-xl text-xs ${
                              active
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <Icon size={14} />
                          </span>
                          <strong className="block text-[11px] font-bold">{opt.title}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inventory Lot Selection (Connecting to Inventory) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-black text-slate-700 dark:text-slate-300">
                      انتخاب از موجودی انبار ({DELIVERY_KIND_LABELS[deliverKind]})
                    </label>
                    {loadingLots ? (
                      <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                        <LoaderCircle size={12} className="animate-spin" />
                        در حال بارگذاری موجودی...
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {deliverLots.filter((l) => l.remainingWeight > 0.0000001).length.toLocaleString('fa-IR')} قلم موجود در انبار
                        {deliverLots.some((l) => l.remainingWeight > 0.0000001) ? (
                          <span className="text-amber-600 dark:text-amber-400 mr-1">
                            ({formatWeight(deliverLots.reduce((s, l) => s + (l.remainingWeight > 0 ? l.remainingWeight : 0), 0))} گرم)
                          </span>
                        ) : null}
                      </span>
                    )}
                  </div>
                  <select
                    value={selectedLotId}
                    onChange={(e) => handleSelectLot(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 text-xs font-bold border-slate-200 bg-white text-slate-800 focus:border-amber-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">-- انتخاب از موجودی‌های انبار (یا ثبت دستی) --</option>
                    {deliverLots.map((lot) => {
                      const isDepleted = lot.remainingWeight <= 0.0000001;
                      const label = `${lot.stampNumber ? `انگ: ${lot.stampNumber} · ` : ''}${lot.labName ? `ری‌گیری: ${lot.labName} · ` : ''}${lot.customerName || 'موجودی'} (موجودی: ${formatWeight(lot.remainingWeight)} گرم${lot.purity ? ` | عیار: ${lot.purity}` : ''})`;
                      return (
                        <option key={lot.id} value={lot.id} disabled={isDepleted}>
                          {label} {isDepleted ? '- پایان موجودی' : ''}
                        </option>
                      );
                    })}
                  </select>
                  {selectedLotId ? (
                    <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                      <span>✓ طلا از موجودی انبار انتخاب شد (کسر مستقیم از انبار).</span>
                      {(() => {
                        const lot = deliverLots.find((l) => l.id === selectedLotId);
                        return lot ? <span>حداکثر موجودی قابل برداشت: {formatWeight(lot.remainingWeight)} گرم</span> : null;
                      })()}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-black mb-1 text-slate-700 dark:text-slate-300">وزن طلا (گرم) *</label>
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
                    <label className="block font-black mb-1 text-slate-700 dark:text-slate-300">
                      عیار (بر پایه ۱۰۰۰) *
                      {selectedLotId ? (
                        <span className="mr-1 text-[10px] text-amber-600 dark:text-amber-400">(بر اساس عیار انبار)</span>
                      ) : null}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="1000"
                      required
                      readOnly={Boolean(selectedLotId)}
                      disabled={Boolean(selectedLotId)}
                      value={deliverPurity}
                      onChange={(e) => setDeliverPurity(e.target.value)}
                      placeholder="۷۵۰"
                      className={`h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800 ${
                        selectedLotId ? 'bg-slate-100 text-slate-500 cursor-not-allowed dark:bg-slate-800/80 dark:text-slate-400' : ''
                      }`}
>>>>>>> cd583e7 (fixed many bugs)
                    />
                  </div>
                </div>

<<<<<<< HEAD
=======
                <div>
                  <label className="block font-black mb-1 text-slate-700 dark:text-slate-300">شماره انگ / آزمایشگاه ری‌گیری</label>
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

>>>>>>> cd583e7 (fixed many bugs)
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
<<<<<<< HEAD
                <h4 className="text-sm font-black text-slate-900 dark:text-white">دریافت طلای خروجی تصفیه‌شده</h4>
=======
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  ثبت دریافت شرطی و پاکت ری‌گیری
                </h4>
>>>>>>> cd583e7 (fixed many bugs)
                <button type="button" onClick={() => setOpenOutputModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleOutputSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن طلای خروجی (گرم) *</label>
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

<<<<<<< HEAD
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
=======
                {/* Packet Number announced by Refiner */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/30 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Inbox size={15} className="text-amber-600 dark:text-amber-400" />
                    <label className="font-black text-slate-800 dark:text-slate-200 text-xs">
                      شماره پاکت ری‌گیری (اعلامی ریگیر / آزمایشگاه)
                    </label>
                  </div>
                  <input
                    type="text"
                    value={outputPacketNumber}
                    onChange={(e) => setOutputPacketNumber(e.target.value)}
                    placeholder="مثال: PKT-1403-8872 یا شماره پاکت ریگیر"
                    className="h-10 w-full rounded-xl border border-amber-300/80 bg-white px-3 font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none dark:border-amber-700/60 dark:bg-slate-900 dark:text-white"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>وزن اعلام‌شده نمونه (گرم):</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={outputSampleWeight}
                      onChange={(e) => setOutputSampleWeight(e.target.value)}
                      placeholder="۲.۵"
                      className="h-7 w-20 rounded-lg border px-2 text-center font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                {/* Conditional Notice - Purity is automatically 750 until packet assay results arrive */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-200 space-y-1">
                  <div className="flex items-center justify-between font-black">
                    <span>عیار موقت طلای شرطی:</span>
                    <span className="font-mono text-amber-700 dark:text-amber-400">۷۵۰</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    این طلا به عنوان «شرطی» با عیار موقت ۷۵۰ وارد انبار می‌شود. پس از اعلام نتیجه آزمایشگاه، با ثبت عیار پاکت به آبشده قطعی با عیار واقعی تبدیل خواهد شد.
                  </p>
>>>>>>> cd583e7 (fixed many bugs)
                </div>

                <div>
                  <label className="block font-black mb-1">شماره انگ و آزمایشگاه</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={outputStamp}
                      onChange={(e) => setOutputStamp(e.target.value)}
                      placeholder="شماره انگ جدید"
                      className="h-10 w-full rounded-2xl border px-3 font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="text"
                      value={outputLab}
                      onChange={(e) => setOutputLab(e.target.value)}
                      placeholder="نام ری‌گیری"
                      className="h-10 w-full rounded-2xl border px-3 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-black mb-1">تاریخ دریافت</label>
                  <input
                    type="text"
                    value={outputDate}
                    onChange={(e) => setOutputDate(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-mono dark:border-slate-700 dark:bg-slate-800"
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
                  <input
                    type="text"
                    value={sampleReceivedDate}
                    onChange={(e) => setSampleReceivedDate(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-mono dark:border-slate-700 dark:bg-slate-800"
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
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-800/60 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">ثبت اجرت و دستمزد ری‌گیری</h4>
                <button type="button" onClick={() => setOpenFeeModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleFeeSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">مبلغ اجرت ({currencySuffix}) *</label>
                  <PriceInput
                    name="feeAmount"
                    value={feeAmount}
                    onValueChange={(_parsed, rawVal) => setFeeAmount(rawVal)}
                    currencySuffix={currencySuffix}
                    baseCurrency="IRR"
                    placeholder="مثال: ۲۵,۰۰۰,۰۰۰"
                    required
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="rounded-2xl bg-slate-100 p-3 text-[11px] leading-relaxed text-slate-800 dark:bg-slate-700/50 dark:text-slate-300">
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
      </div>
    </div>
  );
}
