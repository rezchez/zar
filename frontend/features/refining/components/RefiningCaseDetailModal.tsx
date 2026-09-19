'use client';

import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  DollarSign,
  Flame,
  Inbox,
  Layers,
  LoaderCircle,
  PackageOpen,
  Pencil,
  Plus,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  Trash2,
  X,
  FlaskConical,
  Gem,
  HandCoins,
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
import { formatJalaliDate, normalizeDigits } from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';
import DatePicker from '@/components/ui/date-picker';
import { AssayLaboratorySelect } from '@/components/AssayLaboratorySelect';
import { PriceInput } from '@/components/ui/price-input';
import { useToastManager } from '@/components/ui/toast';
import SentGoldTable from './SentGoldTable';
import OutputGoldTable from './OutputGoldTable';
import SamplePacketsTable from './SamplePacketsTable';
import SummaryPacketsTable from './SummaryPacketsTable';

type DeliveryGoldKind = 'melted' | 'miscellaneous' | 'conditional' | 'sowaleh';

const DELIVERY_KIND_LABELS: Record<DeliveryGoldKind, string> = {
  melted: 'آبشده',
  miscellaneous: 'متفرقه',
  conditional: 'شرطی',
  sowaleh: 'سواله',
};

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
  const [deliverKind, setDeliverKind] = useState<DeliveryGoldKind>('melted');
  const [deliverLots, setDeliverLots] = useState<InventoryLotItem[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [loadingLots, setLoadingLots] = useState(false);
  const [deliverWeight, setDeliverWeight] = useState('');
  const [deliverPurity, setDeliverPurity] = useState('750');
  const [deliverStamp, setDeliverStamp] = useState('');
  const [deliverLab, setDeliverLab] = useState('');
  const [deliverDesc, setDeliverDesc] = useState('');
  const [deliverSubmitting, setDeliverSubmitting] = useState(false);

  const [openOutputModal, setOpenOutputModal] = useState(false);
  const [outputWeight, setOutputWeight] = useState('');
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

  // Receive sample inline & Settle Assay Purity
  const [receivingSampleId, setReceivingSampleId] = useState<string | null>(null);
  const [sampleReceivedWeight, setSampleReceivedWeight] = useState('');
  const [sampleLabPurity, setSampleLabPurity] = useState('750');
  const [sampleReceivedDate, setSampleReceivedDate] = useState(formatJalaliDate(new Date()));
  const [receiveSubmitting, setReceiveSubmitting] = useState(false);

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

  // Delete Fee State & Handler
  const [confirmDeleteFee, setConfirmDeleteFee] = useState(false);
  const [deletingFee, setDeletingFee] = useState(false);

  const handleDeleteFee = async () => {
    setDeletingFee(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/fee`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در حذف اجرت', data.message || 'حذف اجرت ری‌گیری با خطا مواجه شد.');
        return;
      }
      toast.success('حذف اجرت ری‌گیری', 'اجرت ری‌گیری حذف و اسناد حسابداری و گردش حساب ریگیر لغو گردیدند.');
      setConfirmDeleteFee(false);
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setDeletingFee(false);
    }
  };

  // Item (Sent Gold / Output Gold) Edit & Delete States & Handlers
  const [editingItem, setEditingItem] = useState<RefiningItem | null>(null);
  const [editItemWeight, setEditItemWeight] = useState('');
  const [editItemPurity, setEditItemPurity] = useState('');
  const [editItemStamp, setEditItemStamp] = useState('');
  const [editItemLab, setEditItemLab] = useState('');
  const [editItemDesc, setEditItemDesc] = useState('');
  const [editItemDate, setEditItemDate] = useState('');
  const [editItemSubmitting, setEditItemSubmitting] = useState(false);

  const [deletingItem, setDeletingItem] = useState<RefiningItem | null>(null);
  const [deleteItemSubmitting, setDeleteItemSubmitting] = useState(false);

  const openEditItemModal = (item: RefiningItem) => {
    setEditingItem(item);
    setEditItemWeight(item.rawWeight.toString());
    setEditItemPurity(item.purity.toString());
    setEditItemStamp(item.stampNumber || '');
    setEditItemLab(item.labName || '');
    setEditItemDesc(item.description || '');
    setEditItemDate(item.receiptDate || formatJalaliDate(new Date()));
  };

  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const w = parseFloat(normalizeDigits(editItemWeight).replace(/,/g, ''));
    const p = parseFloat(normalizeDigits(editItemPurity).replace(/,/g, ''));

    if (!w || isNaN(w) || w <= 0) {
      toast.warning('وزن نامعتبر', 'لطفاً وزن معتبر و بزرگتر از صفر وارد کنید.');
      return;
    }
    if (!p || isNaN(p) || p <= 0 || p > 1000) {
      toast.warning('عیار نامعتبر', 'لطفاً عیار معتبر بین ۱ تا ۱۰۰۰ وارد کنید.');
      return;
    }

    setEditItemSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/items/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawWeight: w,
          purity: p,
          stampNumber: editItemStamp.trim(),
          labName: editItemLab.trim(),
          description: editItemDesc.trim(),
          receiptDate: editItemDate.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در ویرایش ردیف', data.message || 'ویرایش ردیف با خطا مواجه شد.');
        return;
      }

      toast.success('ویرایش ردیف طلا', 'ردیف طلا با موفقیت ویرایش شد و انبار بروز گردید.');
      setEditingItem(null);
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setEditItemSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    setDeleteItemSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/items/${deletingItem.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در حذف ردیف', data.message || 'حذف ردیف طلا با خطا مواجه شد.');
        return;
      }
      toast.success('حذف ردیف طلا', 'ردیف طلا با موفقیت حذف شد و انبار بروز گردید.');
      setDeletingItem(null);
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setDeleteItemSubmitting(false);
    }
  };

  // Sample Packet Edit & Delete States & Handlers
  const [editingSample, setEditingSample] = useState<RefiningSample | null>(null);
  const [editSampleDeclared, setEditSampleDeclared] = useState('');
  const [editSampleReceived, setEditSampleReceived] = useState('');
  const [editSamplePurity, setEditSamplePurity] = useState('');
  const [editSampleDesc, setEditSampleDesc] = useState('');
  const [editSampleSubmitting, setEditSampleSubmitting] = useState(false);

  const [deletingSample, setDeletingSample] = useState<RefiningSample | null>(null);
  const [deleteSampleSubmitting, setDeleteSampleSubmitting] = useState(false);

  const openEditSampleModal = (sample: RefiningSample) => {
    setEditingSample(sample);
    setEditSampleDeclared(sample.declaredWeight.toString());
    setEditSampleReceived(sample.receivedWeight ? sample.receivedWeight.toString() : '');
    setEditSamplePurity(sample.purity ? sample.purity.toString() : '750');
    setEditSampleDesc(sample.description || '');
  };

  const handleEditSampleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSample) return;

    const declaredW = parseFloat(normalizeDigits(editSampleDeclared).replace(/,/g, ''));
    if (!declaredW || isNaN(declaredW) || declaredW <= 0) {
      toast.warning('وزن نامعتبر', 'وزن اعلام‌شده نمونه باید بزرگتر از صفر باشد.');
      return;
    }

    const p = parseFloat(normalizeDigits(editSamplePurity).replace(/,/g, ''));
    if (!p || isNaN(p) || p <= 0 || p > 1000) {
      toast.warning('عیار نامعتبر', 'عیار باید بین ۱ تا ۱۰۰۰ باشد.');
      return;
    }

    const recW = editSampleReceived ? parseFloat(normalizeDigits(editSampleReceived).replace(/,/g, '')) : undefined;

    setEditSampleSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/samples/${editingSample.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          declaredWeight: declaredW,
          receivedWeight: recW,
          purity: p,
          description: editSampleDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در ویرایش پاکت', data.message || 'ویرایش پاکت نمونه با خطا مواجه شد.');
        return;
      }

      toast.success('ویرایش پاکت نمونه', 'اطلاعات پاکت نمونه با موفقیت بروزرسانی شد.');
      setEditingSample(null);
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setEditSampleSubmitting(false);
    }
  };

  const handleDeleteSample = async () => {
    if (!deletingSample) return;
    setDeleteSampleSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/samples/${deletingSample.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در حذف پاکت', data.message || 'حذف پاکت با خطا مواجه شد.');
        return;
      }
      toast.success('حذف پاکت نمونه', 'پاکت نمونه با موفقیت حذف گردید.');
      setDeletingSample(null);
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setDeleteSampleSubmitting(false);
    }
  };

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
          inventoryType: deliverKind,
          sourceInventoryId: selectedLotId || undefined,
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

      toast.success(
        'خروج طلا با موفقیت ثبت شد',
        `طلای ارسالی (${DELIVERY_KIND_LABELS[deliverKind]}) به وزن ${formatWeight(rawW)} گرم از انبار آزاد خارج گردید.`
      );
      setOpenDeliverModal(false);
      setSelectedLotId('');
      setDeliverWeight('');
      setDeliverStamp('');
      setDeliverLab('');
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
    if (!rawW || rawW <= 0) {
      toast.warning('وزن نامعتبر', 'لطفاً وزن معتبر برای طلای دریافتی وارد کنید.');
      return;
    }

    setOutputSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/output`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawWeight: rawW,
          purity: 750, // Temporary default 750 for conditional gold
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
    const labPurity = parseFloat(sampleLabPurity);
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
          purity: labPurity && labPurity > 0 ? labPurity : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در دریافت پاکت', data.message || 'ثبت دریافت پاکت نمونه با خطا مواجه شد.');
        return;
      }

      toast.success(
        'دریافت پاکت نمونه و تبدیل قطعی',
        `پاکت نمونه دریافت شد، وزن ${formatWeight(recW)} گرم وارد موجودی گردید و طلای شرطی پرونده به آبشده قطعی با عیار ${labPurity || 750} تبدیل شد.`
      );
      setReceivingSampleId(null);
      setSampleReceivedWeight('');
      setSampleLabPurity('750');
      void fetchDetails();
      onUpdated?.();
    } catch {
      toast.error('خطای شبکه', 'عدم برقراری ارتباط با سرور.');
    } finally {
      setReceiveSubmitting(false);
    }
  };

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
    const cleanFee = normalizeDigits(feeAmount).replace(/,/g, '').trim();
    const parsedFee = Number(cleanFee);
    if (!parsedFee || isNaN(parsedFee) || parsedFee <= 0) {
      toast.warning('مبلغ نامعتبر', 'لطفاً مبلغ اجرت معتبر و بزرگتر از صفر وارد کنید.');
      return;
    }

    // Persist natively in IRR; convert from Toman if active currency is IRT
    const feeInIrr = settings.baseCurrency === 'IRT' ? Math.round(parsedFee * 10) : Math.round(parsedFee);

    setFeeSubmitting(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}/fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refiningFee: feeInIrr,
          fee: feeInIrr,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('خطا در ثبت اجرت', data.message || 'ثبت اجرت ری‌گیری با خطا مواجه شد.');
        return;
      }

      toast.success('ثبت اجرت ری‌گیری', 'اجرت ری‌گیری با موفقیت ثبت و سند حسابداری دوبل صادر گردید.');
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
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                طرف‌حساب: <strong className="text-slate-800 dark:text-slate-200">{refiningCase?.refinerName || '—'}</strong>
                {refiningCase?.date ? ` — تاریخ: ${refiningCase.date}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Delete Case Trigger Button */}
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              title="حذف پرونده ری‌گیری"
              className="rounded-2xl p-2.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash2 size={18} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl p-2.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={20} />
            </button>
          </div>
        </div>

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
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-2xs dark:border-slate-800 dark:bg-slate-800/60">
                  <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">مجموع طلای ارسالی</span>
                  <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {formatWeight(summary?.totalSentWeight || 0)}{' '}
                    <span className="text-[11px] font-normal text-slate-400">گرم</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 px-3.5 py-2.5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <span className="text-[10.5px] font-bold text-emerald-800 dark:text-emerald-300">طلای شرطی دریافت شده</span>
                  <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300">
                    {formatWeight(summary?.totalOutputWeight || 0)}{' '}
                    <span className="text-[11px] font-normal text-emerald-600/70 dark:text-emerald-400/70">گرم</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 px-3.5 py-2.5 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
                  <span className="text-[10.5px] font-bold text-amber-800 dark:text-amber-300">نمونه‌های دریافتی</span>
                  <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-amber-700 dark:text-amber-300">
                    {formatWeight(summary?.totalReceivedSampleWeight || 0)}{' '}
                    <span className="text-[11px] font-normal text-amber-600/70 dark:text-amber-400/70">گرم</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-rose-200/60 bg-rose-50/40 px-3.5 py-2.5 shadow-2xs dark:border-rose-900/40 dark:bg-rose-950/20">
                  <span className="text-[10.5px] font-bold text-rose-800 dark:text-rose-300">افت فرآیند ری‌گیری</span>
                  <p className="mt-0.5 font-mono text-sm sm:text-base font-black text-rose-700 dark:text-rose-300">
                    {formatWeight(summary?.totalWeightDifference || 0)}{' '}
                    <span className="text-[11px] font-normal text-rose-600/70 dark:text-rose-400/70">گرم</span>
                  </p>
                </div>
              </div>

              {/* Status and Refiner Debt Card */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-amber-200/60 bg-amber-50/30 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>⚖️</span>
                      <span>طلای باقیمانده نزد ریگیر</span>
                    </span>
                    <span className="font-mono text-base font-black text-amber-700 dark:text-amber-400">
                      {formatWeight(summary?.remainingWeightAtRefiner || 0)} <span className="text-xs font-normal">گرم</span>
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {(summary?.remainingWeightAtRefiner || 0) <= 0.0001 || refiningCase?.status === 'completed'
                      ? 'فرآیند ری‌گیری، دریافت پاکت و عیارسنجی تکمیل شده و هیچ طلایی نزد ریگیر باقی نمانده است.'
                      : 'این مقدار طلا تا زمان دریافت کامل خروجی و پاکت نمونه، نزد آزمایشگاه عیارسنجی باقی مانده است.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/30 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/15 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>💰</span>
                      <span>اجرت و بدهی ما به ریگیر</span>
                    </span>
                    <span className="font-mono text-base font-black text-emerald-700 dark:text-emerald-400">
                      {(settings.baseCurrency === 'IRT' ? Math.floor((summary?.debtToRefiner || 0) / 10) : (summary?.debtToRefiner || 0)).toLocaleString('fa-IR')} <span className="text-xs font-normal">{currencySuffix}</span>
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
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

                <SummaryPacketsTable samples={samples} />
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
                <div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    اقلام طلای ارسالی / تحویل‌شده به ریگیر
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    این اقلام مستقیماً از انبار آزاد طلا خارج شده و تا زمان بازگشت، در تعهد ریگیر قرار دارند.
                  </p>
                </div>
              </div>

              <SentGoldTable
                items={sentItems}
                onOpenDeliverModal={() => setOpenDeliverModal(true)}
                onEditItem={openEditItemModal}
                onDeleteItem={setDeletingItem}
              />
            </div>
          ) : activeTab === 'output' ? (
            <div className="space-y-6">
              {/* Part 1: Conditional Gold Outputs Received */}
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    اقلام دریافت شرطی (طلای تصفیه‌شده از ریگیر)
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    عیار این طلا به صورت موقت ۷۵۰ ثبت می‌شود و شماره پاکت اعلامی ریگیر نیز همزمان در پرونده ثبت می‌گردد.
                  </p>
                </div>

                <OutputGoldTable
                  items={outputItems}
                  onOpenOutputModal={() => setOpenOutputModal(true)}
                  onEditItem={openEditItemModal}
                  onDeleteItem={setDeletingItem}
                />
              </div>

              {/* Part 2: Integrated Sample Packets and Assay Results */}
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
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

                <SamplePacketsTable
                  samples={samples}
                  onOpenSampleModal={() => setOpenSampleModal(true)}
                  onReceiveSample={(s) => {
                    setReceivingSampleId(s.id);
                    setSampleReceivedWeight(s.declaredWeight.toString());
                    setSampleLabPurity(s.purity ? s.purity.toString() : '750');
                  }}
                  onSettlePurity={(s) => {
                    setSettlingSampleId(s.id);
                    setSettlePurityValue(s.purity ? s.purity.toString() : '750');
                  }}
                  onEditSample={openEditSampleModal}
                  onDeleteSample={setDeletingSample}
                />
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
                  <div className="flex items-center gap-2">
                    {refiningCase?.refiningFee ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteFee(true)}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs font-black text-rose-700 shadow-xs transition-all hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                      >
                        <Trash2 size={14} />
                        <span>حذف اجرت</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        const currentFeeStr = refiningCase?.refiningFee
                          ? (settings.baseCurrency === 'IRT' ? Math.floor(refiningCase.refiningFee / 10).toString() : refiningCase.refiningFee.toString())
                          : '';
                        setFeeAmount(currentFeeStr);
                        setOpenFeeModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-black text-white shadow-xs transition-all hover:bg-amber-500"
                    >
                      <DollarSign size={14} />
                      <span>{refiningCase?.refiningFee ? 'ویرایش اجرت' : 'ثبت اجرت ری‌گیری'}</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    مبلغ دستمزد ثبت‌شده:
                  </span>
                  <span className="font-mono text-xl font-black text-emerald-700 dark:text-emerald-400">
                    {(settings.baseCurrency === 'IRT' ? Math.floor((refiningCase?.refiningFee || 0) / 10) : (refiningCase?.refiningFee || 0)).toLocaleString('fa-IR')} {currencySuffix}
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

              <form onSubmit={handleDeliverSubmit} className="space-y-4 text-xs">
                {/* Gold Type Selection - Inspired by RawMetalOperationTypeSelector */}
                <div>
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
                    />
                  </div>
                </div>

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
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  ثبت دریافت شرطی و پاکت ری‌گیری
                </h4>
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
                    {outputSubmitting ? 'در حال ثبت...' : 'تأیید و ورود به موجودی شرطی'}
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
                <h4 className="text-sm font-black text-slate-900 dark:text-white">صدور پاکت نمونه برای ری‌گیری</h4>
                <button type="button" onClick={() => setOpenSampleModal(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSampleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن اعلام‌شده نمونه (گرم) *</label>
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
                <h4 className="text-sm font-black text-slate-900 dark:text-white">دریافت پاکت نمونه و اعلام نتیجه ری‌گیری</h4>
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
                  <label className="block font-black mb-1">عیار اعلامی آزمایشگاه (نتیجه ری‌گیری)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    value={sampleLabPurity}
                    onChange={(e) => setSampleLabPurity(e.target.value)}
                    placeholder="۷۵۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
                    ⚡ با ثبت این عیار، طلای شرطی پرونده به آبشده قطعی با همین عیار تبدیل می‌شود.
                  </span>
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

        {settlingSampleId ? (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">ثبت عیار آزمایشگاه و تبدیل به آبشده</h4>
                <button type="button" onClick={() => setSettlingSampleId(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">عیار قطعی اعلامی آزمایشگاه *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    required
                    value={settlePurityValue}
                    onChange={(e) => setSettlePurityValue(e.target.value)}
                    placeholder="۷۵۰"
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="rounded-2xl bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                  ✨ با ثبت این عیار، تمام اقلام طلای شرطی این پرونده در انبار طلا به «آبشده قطعی» با عیار اعلام‌شده تبدیل شده و معادل ۷۵۰ آن‌ها مجدداً محاسبه می‌شود.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettlingSampleId(null)}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    disabled={settlingSubmitting}
                    onClick={() => void handleSettlePuritySubmit(settlingSampleId)}
                    className="h-10 rounded-2xl bg-amber-600 px-5 font-black text-white hover:bg-amber-500"
                  >
                    {settlingSubmitting ? 'در حال ثبت...' : 'ثبت عیار و تبدیل به آبشده'}
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
                    baseCurrency={settings.baseCurrency || 'IRR'}
                    showWords
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

        {/* Delete Fee Confirmation Modal */}
        {confirmDeleteFee ? (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/50 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">حذف اجرت ری‌گیری</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    پرونده شماره: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{refiningCase?.caseNumber}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-xs font-bold leading-relaxed text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/30 dark:text-rose-300 space-y-1.5">
                <p>⚠️ با حذف اجرت ری‌گیری:</p>
                <ul className="list-disc pr-4 space-y-1 text-[11px] font-medium text-rose-800 dark:text-rose-300">
                  <li>سند دوبل حسابداری ثبت‌شده در سرفصل هزینه‌ها (۵۵۰۰) و بستانکاران (۲۱۲۰) به طور کامل حذف خواهد شد.</li>
                  <li>مبلغ اجرت از صورت‌حساب و بدهی ما به ریگیر در کارت معین طرف‌حساب کسر می‌گردد.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteFee(false)}
                  disabled={deletingFee}
                  className="h-10 rounded-2xl border px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleDeleteFee}
                  disabled={deletingFee}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {deletingFee ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  <span>تأیید و حذف اجرت</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Edit Item Modal (Sent Gold or Output Gold) */}
        {editingItem ? (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Pencil size={18} className="text-amber-500" />
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    {editingItem.itemType === 'sent_gold' ? 'ویرایش طلای تحویلی به ریگیر' : 'ویرایش طلای دریافتی از ریگیر'}
                  </h4>
                </div>
                <button type="button" onClick={() => setEditingItem(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleEditItemSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن طلا (گرم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={editItemWeight}
                    onChange={(e) => setEditItemWeight(e.target.value)}
                    required
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">عیار طلا (بر پایه ۱۰۰۰) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    value={editItemPurity}
                    onChange={(e) => setEditItemPurity(e.target.value)}
                    required
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">شماره انگ</label>
                  <input
                    type="text"
                    value={editItemStamp}
                    onChange={(e) => setEditItemStamp(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                    placeholder="اختیاری"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">نام آزمایشگاه / ریگیری</label>
                  <AssayLaboratorySelect
                    value={editItemLab}
                    onChange={(val) => setEditItemLab(val)}
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">توضیحات</label>
                  <input
                    type="text"
                    value={editItemDesc}
                    onChange={(e) => setEditItemDesc(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800/50">
                  ℹ️ با تغییر وزن یا عیار، معادل ۷۵۰ و موجودی متناظر در انبار طلا به صورت خودکار اصلاح خواهد شد.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingItem(null)}
                    disabled={editItemSubmitting}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={editItemSubmitting}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-amber-600 px-5 font-black text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {editItemSubmitting ? <LoaderCircle size={14} className="animate-spin" /> : null}
                    <span>ثبت تغییرات</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* Delete Item Confirmation Modal */}
        {deletingItem ? (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/50 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    حذف {deletingItem.itemType === 'sent_gold' ? 'طلای ارسالی به ریگیر' : 'طلای دریافتی'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    وزن: <span className="font-mono font-bold">{formatWeight(deletingItem.rawWeight)} گرم</span> | عیار: <span className="font-mono font-bold">{deletingItem.purity}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-xs font-bold leading-relaxed text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/30 dark:text-rose-300">
                ⚠️ با حذف این ردیف، گردش موجودی متناظر در انبار طلای سامانه به صورت خودکار معکوس شده و مانده پرونده مجدداً محاسبه می‌گردد.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  disabled={deleteItemSubmitting}
                  className="h-10 rounded-2xl border px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleDeleteItem}
                  disabled={deleteItemSubmitting}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {deleteItemSubmitting ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  <span>تأیید و حذف ردیف</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Edit Sample Modal */}
        {editingSample ? (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Pencil size={18} className="text-amber-500" />
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">
                    ویرایش پاکت نمونه {editingSample.packetNumber}
                  </h4>
                </div>
                <button type="button" onClick={() => setEditingSample(null)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleEditSampleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-black mb-1">وزن اعلام‌شده نمونه (گرم) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={editSampleDeclared}
                    onChange={(e) => setEditSampleDeclared(e.target.value)}
                    required
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                {editingSample.status === 'received' ? (
                  <div>
                    <label className="block font-black mb-1">وزن واقعی دریافتی (گرم)</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      value={editSampleReceived}
                      onChange={(e) => setEditSampleReceived(e.target.value)}
                      className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="block font-black mb-1">عیار آزمایشگاه (بر پایه ۱۰۰۰)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="1000"
                    value={editSamplePurity}
                    onChange={(e) => setEditSamplePurity(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-mono font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-black mb-1">توضیحات پاکت</label>
                  <input
                    type="text"
                    value={editSampleDesc}
                    onChange={(e) => setEditSampleDesc(e.target.value)}
                    className="h-10 w-full rounded-2xl border px-3 font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>

                <div className="rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-slate-800/50">
                  ℹ️ با تغییر وزن اعلامی یا دریافتی، کسر و افت ری‌گیری و مانده طلا نزد ریگیر بروزرسانی می‌گردد.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingSample(null)}
                    disabled={editSampleSubmitting}
                    className="h-10 rounded-2xl border px-4 font-bold"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={editSampleSubmitting}
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-amber-600 px-5 font-black text-white hover:bg-amber-500 disabled:opacity-50"
                  >
                    {editSampleSubmitting ? <LoaderCircle size={14} className="animate-spin" /> : null}
                    <span>ثبت تغییرات</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {/* Delete Sample Confirmation Modal */}
        {deletingSample ? (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900/50 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:bg-rose-500/25 dark:text-rose-400">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">حذف پاکت نمونه</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    شماره پاکت: <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{deletingSample.packetNumber}</span>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-xs font-bold leading-relaxed text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/30 dark:text-rose-300">
                ⚠️ با حذف این پاکت نمونه، رکورد آن لغو شده و در صورت ورود نمونه به انبار، موجودی متناظر معکوس می‌گردد.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingSample(null)}
                  disabled={deleteSampleSubmitting}
                  className="h-10 rounded-2xl border px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSample}
                  disabled={deleteSampleSubmitting}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {deleteSampleSubmitting ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  <span>تأیید و حذف پاکت</span>
                </button>
              </div>
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
