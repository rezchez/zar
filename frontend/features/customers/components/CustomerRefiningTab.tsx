'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  FileText,
  Flame,
  LoaderCircle,
  Package,
  Plus,
  Scale,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import DatePicker from '@/components/ui/date-picker';
import type { Customer } from '@/lib/customer';
import type {
  RefiningCase,
  RefiningItem,
  RefiningOperation,
  RefiningSample,
} from '@/features/refining/services/refining-service';

export default function CustomerRefiningTab({ customer }: { customer: Customer }) {
  const [cases, setCases] = useState<RefiningCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [goldBalance, setGoldBalance] = useState<{
    totalSentWeight: number;
    totalReceivedOutputWeight: number;
    pendingSampleWeight: number;
    receivedSampleWeight: number;
    currentGoldAtRefiner: number;
  }>({
    totalSentWeight: 0,
    totalReceivedOutputWeight: 0,
    pendingSampleWeight: 0,
    receivedSampleWeight: 0,
    currentGoldAtRefiner: 0,
  });

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Selected Case Detail State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseDetailLoading, setCaseDetailLoading] = useState(false);
  const [caseData, setCaseData] = useState<{
    case: RefiningCase;
    items: RefiningItem[];
    samples: RefiningSample[];
    operations: RefiningOperation[];
  } | null>(null);

  // Modals
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [newCaseDesc, setNewCaseDesc] = useState('');
  const [submittingCase, setSubmittingCase] = useState(false);

  // Action Modals for Selected Case
  const [activeModal, setActiveModal] = useState<
    'send_gold' | 'process_result' | 'receive_gold' | 'receive_sample' | 'service_fee' | null
  >(null);

  // Send Gold Form State
  const [sendWeight, setSendWeight] = useState('');
  const [sendGrade, setSendGrade] = useState('750');
  const [sendDesc, setSendDesc] = useState('');

  // Process Result Form State
  const [outWeight, setOutputWeight] = useState('');
  const [outGrade, setOutputGrade] = useState('750');
  const [sampleCode, setSampleCode] = useState('');
  const [sampleWeight, setSampleWeight] = useState('');
  const [stampNumber, setStampNumber] = useState('');

  // Receive Gold Form State
  const [receiveItemId, setReceiveItemId] = useState('');
  const [recWeight, setRecWeight] = useState('');
  const [recGrade, setRecGrade] = useState('750');

  // Receive Sample Form State
  const [recSampleId, setRecSampleId] = useState('');
  const [recSampleDeclaredWeight, setRecSampleDeclaredWeight] = useState(0);
  const [recSampleWeight, setRecSampleWeight] = useState('');
  const [recSampleDate, setRecSampleDate] = useState('');

  // Service Fee Form State
  const [feeAmount, setFeeAmount] = useState('');
  const [feeDesc, setFeeDesc] = useState('');

  const [actionLoading, setActionLoading] = useState(false);

  async function loadCases() {
    setLoading(true);
    try {
      const res = await fetch(`/api/refining/cases?refinerId=${customer.id}`);
      const data = await res.json();
      if (res.ok && data.cases) {
        setCases(data.cases);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  async function loadCaseDetail(caseId: string) {
    setCaseDetailLoading(true);
    try {
      const res = await fetch(`/api/refining/cases/${caseId}`);
      const data = await res.json();
      if (res.ok && data.case) {
        setCaseData(data);
        if (data.goldBalance) {
          setGoldBalance(data.goldBalance);
        }
      }
    } catch {
      //
    } finally {
      setCaseDetailLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, [customer.id]);

  useEffect(() => {
    if (selectedCaseId) {
      loadCaseDetail(selectedCaseId);
    } else {
      setCaseData(null);
    }
  }, [selectedCaseId]);

  async function handleCreateCase(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingCase(true);
    setMessage('');
    setErrorMessage('');

    try {
      const res = await fetch('/api/refining/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refinerId: customer.id,
          description: newCaseDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'ثبت پرونده با خطا مواجه شد.');
        return;
      }

      setMessage(`پرونده جدید با شماره ${data.case.caseNumber} ایجاد شد.`);
      setIsCreateCaseOpen(false);
      setNewCaseDesc('');
      await loadCases();
      setSelectedCaseId(data.case.id);
    } catch {
      setErrorMessage('خطا در ارتباط با سرور.');
    } finally {
      setSubmittingCase(false);
    }
  }

  async function handleSendGoldSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    setActionLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/refining/cases/${selectedCaseId}/send-gold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputWeight: Number(sendWeight),
          inputGrade: Number(sendGrade),
          description: sendDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'ثبت تحویل طلا ناموفق بود.');
        return;
      }

      setMessage('تحویل طلا به ریگیر ثبت شد و از موجودی آزاد کسر گردید.');
      setActiveModal(null);
      setSendWeight('');
      setSendDesc('');
      await loadCaseDetail(selectedCaseId);
      await loadCases();
    } catch {
      setErrorMessage('خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleProcessSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    setActionLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/refining/cases/${selectedCaseId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outputWeight: Number(outWeight),
          outputGrade: Number(outGrade),
          sampleCode,
          declaredSampleWeight: Number(sampleWeight || 0),
          stampNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'ثبت نتیجه ریگیری ناموفق بود.');
        return;
      }

      setMessage('نتیجه ریگیری و اطلاعات نمونه ثبت گردید.');
      setActiveModal(null);
      setOutputWeight('');
      setSampleCode('');
      setSampleWeight('');
      setStampNumber('');
      await loadCaseDetail(selectedCaseId);
      await loadCases();
    } catch {
      setErrorMessage('خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReceiveGoldSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId || !receiveItemId) return;
    setActionLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/refining/cases/${selectedCaseId}/receive-gold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: receiveItemId,
          receivedWeight: Number(recWeight),
          receivedGrade: Number(recGrade),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'دریافت طلای خروجی ناموفق بود.');
        return;
      }

      setMessage('طلای خروجی ریگیری دریافت و وارد موجودی شد.');
      setActiveModal(null);
      setRecWeight('');
      await loadCaseDetail(selectedCaseId);
      await loadCases();
    } catch {
      setErrorMessage('خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReceiveSampleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recSampleId) return;
    setActionLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/refining/packets/${recSampleId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedWeight: Number(recSampleWeight),
          receivedDate: recSampleDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'دریافت پاکت نمونه ناموفق بود.');
        return;
      }

      setMessage(
        `پاکت نمونه با موفقیت دریافت شد. (وزن واقعی: ${recSampleWeight} گرم - افت/اختلاف: ${data.weightDifference || 0} گرم)`,
      );
      setActiveModal(null);
      setRecSampleWeight('');
      if (selectedCaseId) await loadCaseDetail(selectedCaseId);
      await loadCases();
    } catch {
      setErrorMessage('خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleServiceFeeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCaseId) return;
    setActionLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/refining/cases/${selectedCaseId}/service-fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(feeAmount),
          description: feeDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.message || 'ثبت هزینه و اجرت با خطا مواجه شد.');
        return;
      }

      setMessage('هزینه و اجرت خدمات ریگیری به عنوان بدهی ما به ریگیر در سند حسابداری ثبت شد.');
      setActiveModal(null);
      setFeeAmount('');
      setFeeDesc('');
      await loadCaseDetail(selectedCaseId);
      await loadCases();
    } catch {
      setErrorMessage('خطا در ارتباط با سرور.');
    } finally {
      setActionLoading(false);
    }
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    open: { label: 'جدید (باز)', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    delivered: { label: 'تحویل به ریگیر', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    processing: { label: 'در حال ریگیری', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
    partially_received: { label: 'بخشی دریافت‌شده', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
    completed: { label: 'تکمیل‌شده', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Flame size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">طلای نزد ریگیر</p>
            <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {goldBalance.currentGoldAtRefiner.toLocaleString('fa-IR')} <span className="text-xs font-normal">گرم</span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">کل پرونده‌ها</p>
            <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {cases.length.toLocaleString('fa-IR')} <span className="text-xs font-normal">پرونده</span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Package size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">پاکت‌های در انتظار</p>
            <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {goldBalance.pendingSampleWeight.toLocaleString('fa-IR')} <span className="text-xs font-normal">گرم</span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <DollarSign size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">مانده اجرت ریگیر (بدهی ما)</p>
            <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              {Math.abs(customer.rialBalance || 0).toLocaleString('fa-IR')} <span className="text-xs font-normal">ریال</span>
            </p>
          </div>
        </div>
      </div>

      {message ? <p className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400">{message}</p> : null}
      {errorMessage ? <p className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-600 dark:text-rose-400">{errorMessage}</p> : null}

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cases List Column */}
        <div className={selectedCaseId ? 'lg:col-span-5' : 'lg:col-span-12'}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Flame className="text-amber-500" size={20} />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  پرونده‌های ریگیری {customer.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateCaseOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Plus size={15} /> پرونده جدید
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center items-center text-slate-400">
                <LoaderCircle size={24} className="spin" />
              </div>
            ) : cases.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                هیچ پرونده ریگیری برای این طرف‌حساب ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {cases.map((c) => {
                  const isSelected = c.id === selectedCaseId;
                  const st = statusLabels[c.status] || { label: c.status, color: 'bg-slate-100 text-slate-600' };

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-extrabold text-xs text-amber-600 dark:text-amber-400">
                          {c.caseNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>تاریخ: {c.createdDate || '—'}</span>
                        {c.description ? <span className="truncate max-w-[150px]">{c.description}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Case Detail Panel Column */}
        {selectedCaseId ? (
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs relative">
              <button
                type="button"
                onClick={() => setSelectedCaseId(null)}
                className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
                title="بستن جزییات"
              >
                <X size={18} />
              </button>

              {caseDetailLoading || !caseData ? (
                <div className="py-20 flex justify-center items-center text-slate-400">
                  <LoaderCircle size={28} className="spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Case Header */}
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                    <p className="text-xs text-slate-400 font-bold">جزئیات پرونده ریگیری</p>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 font-mono">
                      {caseData.case.caseNumber}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      ریگیر: <span className="font-bold text-slate-700 dark:text-slate-300">{customer.name}</span> | تاریخ ایجاد: {caseData.case.createdDate}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveModal('send_gold')}
                      className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Send size={14} /> تحویل طلا به ریگیر
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal('process_result')}
                      className="px-3 py-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Flame size={14} /> ثبت نتیجه ذوب و عیارسنجی
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal('receive_gold')}
                      className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <Coins size={14} /> دریافت طلای خروجی
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal('service_fee')}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-bold flex items-center gap-1.5 transition-colors"
                    >
                      <DollarSign size={14} /> ثبت هزینه و اجرت
                    </button>
                  </div>

                  {/* Items List */}
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Scale size={15} /> اقلام ورودی و خروجی پرونده
                    </h4>
                    {caseData.items.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">هیچ آیتم طلایی ثبت نشده است.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                              <th className="py-2 px-2">نوع</th>
                              <th className="py-2 px-2">جهت</th>
                              <th className="py-2 px-2">وزن (گرم)</th>
                              <th className="py-2 px-2">عیار</th>
                              <th className="py-2 px-2">شماره انگ</th>
                              <th className="py-2 px-2">وضعیت</th>
                              <th className="py-2 px-2">عملیات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {caseData.items.map((item) => (
                              <tr key={item.id}>
                                <td className="py-2 px-2 font-bold">{item.itemType}</td>
                                <td className="py-2 px-2">
                                  {item.direction === 'input' ? (
                                    <span className="text-amber-600 font-bold">تحویل‌داده (ورودی)</span>
                                  ) : (
                                    <span className="text-emerald-600 font-bold">خروجی ریگیری</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 font-mono font-bold">
                                  {(item.direction === 'input' ? item.inputWeight : item.outputWeight).toLocaleString('fa-IR')}
                                </td>
                                <td className="py-2 px-2 font-mono font-bold">
                                  {item.direction === 'input' ? item.inputGrade : item.outputGrade}
                                </td>
                                <td className="py-2 px-2 font-mono">{item.stampNumber || '—'}</td>
                                <td className="py-2 px-2">
                                  {item.status === 'received' ? (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                      <CheckCircle2 size={12} /> دریافت‌شده
                                    </span>
                                  ) : (
                                    <span className="text-amber-600 font-bold flex items-center gap-1">
                                      <Clock size={12} /> نزد ریگیر
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2">
                                  {item.direction === 'output' && item.status !== 'received' ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReceiveItemId(item.id);
                                        setRecWeight(String(item.outputWeight));
                                        setRecGrade(String(item.outputGrade));
                                        setActiveModal('receive_gold');
                                      }}
                                      className="px-2 py-1 rounded bg-emerald-500 text-slate-950 text-[10px] font-extrabold hover:bg-emerald-400"
                                    >
                                      دریافت
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Sample Packets Section */}
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                      <Package size={15} /> پاکت‌های نمونه و آزمایش
                    </h4>
                    {caseData.samples.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">هیچ پاکت نمونه‌ای ثبت نشده است.</p>
                    ) : (
                      <div className="space-y-2">
                        {caseData.samples.map((sample) => (
                          <div
                            key={sample.id}
                            className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                                پاکت / انگ: {sample.sampleCode}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                وزن اعلام‌شده: <span className="font-bold text-slate-700 dark:text-slate-300 font-mono">{sample.declaredWeight} گرم</span>
                                {sample.receivedWeight != null ? (
                                  <>
                                    {' '} | وزن واقعی دریافت‌شده: <span className="font-bold text-emerald-600 font-mono">{sample.receivedWeight} گرم</span>
                                    {' '} | افت: <span className="font-bold text-rose-500 font-mono">{roundWeight(sample.declaredWeight - sample.receivedWeight, 3)} گرم</span>
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <div>
                              {sample.status === 'received' ? (
                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                                  دریافت‌شده
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecSampleId(sample.id);
                                    setRecSampleDeclaredWeight(sample.declaredWeight);
                                    setRecSampleWeight(String(sample.declaredWeight));
                                    setActiveModal('receive_sample');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-bold transition-colors"
                                >
                                  دریافت پاکت
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal: Create Case */}
      {isCreateCaseOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setIsCreateCaseOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-4">
              ایجاد پرونده ریگیری جدید
            </h3>
            <form onSubmit={handleCreateCase} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  ریگیر
                </label>
                <input
                  type="text"
                  value={customer.name}
                  disabled
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  توضیحات پرونده (اختیاری)
                </label>
                <textarea
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  placeholder="توضیحات اولیه..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateCaseOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submittingCase}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {submittingCase ? <LoaderCircle size={14} className="spin" /> : null}
                  ایجاد پرونده
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Send Gold */}
      {activeModal === 'send_gold' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-4">
              تحویل طلا به ریگیر
            </h3>
            <form onSubmit={handleSendGoldSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  وزن واقعی تحویلی (گرم) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={sendWeight}
                  onChange={(e) => setSendWeight(e.target.value)}
                  placeholder="مثلاً 100.5"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  عیار واقعی طلای تحویلی *
                </label>
                <input
                  type="number"
                  step="any"
                  value={sendGrade}
                  onChange={(e) => setSendGrade(e.target.value)}
                  placeholder="750"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  توضیحات (اختیاری)
                </label>
                <input
                  type="text"
                  value={sendDesc}
                  onChange={(e) => setSendDesc(e.target.value)}
                  placeholder="توضیحات..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !sendWeight}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? <LoaderCircle size={14} className="spin" /> : null}
                  ثبت تحویل
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Process Result */}
      {activeModal === 'process_result' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-4">
              ثبت نتیجه ذوب و عیارسنجی
            </h3>
            <form onSubmit={handleProcessSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    وزن خروجی (گرم) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={outWeight}
                    onChange={(e) => setOutputWeight(e.target.value)}
                    placeholder="100.0"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    عیار واقعی خروجی *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={outGrade}
                    onChange={(e) => setOutputGrade(e.target.value)}
                    placeholder="750"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  شماره انگ / شناسه آزمایش
                </label>
                <input
                  type="text"
                  value={stampNumber}
                  onChange={(e) => setStampNumber(e.target.value)}
                  placeholder="مثلاً 123456"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                  اطلاعات پاکت نمونه آزمایش (اختیاری)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      شماره پاکت نمونه
                    </label>
                    <input
                      type="text"
                      value={sampleCode}
                      onChange={(e) => setSampleCode(e.target.value)}
                      placeholder="کد/شماره پاکت"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                      وزن اعلام‌شده نمونه (گرم)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={sampleWeight}
                      onChange={(e) => setSampleWeight(e.target.value)}
                      placeholder="0.5"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !outWeight || !outGrade}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? <LoaderCircle size={14} className="spin" /> : null}
                  ثبت نتیجه
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Receive Gold */}
      {activeModal === 'receive_gold' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-4">
              دریافت طلای خروجی ریگیری
            </h3>
            <form onSubmit={handleReceiveGoldSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  وزن واقعی دریافت‌شده (گرم) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={recWeight}
                  onChange={(e) => setRecWeight(e.target.value)}
                  placeholder="وزن واقعی"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  عیار واقعی *
                </label>
                <input
                  type="number"
                  step="any"
                  value={recGrade}
                  onChange={(e) => setRecGrade(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                با ثبت دریافت، این مقدار طلا مستقیماً وارد موجودی آزاد فروشگاه شما می‌گردد.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !recWeight}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? <LoaderCircle size={14} className="spin" /> : null}
                  ثبت ورود به موجودی
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Receive Sample */}
      {activeModal === 'receive_sample' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-4">
              دریافت پاکت نمونه آزمایش
            </h3>
            <form onSubmit={handleReceiveSampleSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs space-y-1">
                <p>وزن اعلام‌شده اولیه: <span className="font-bold font-mono">{recSampleDeclaredWeight} گرم</span></p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  تاریخ واقعی دریافت
                </label>
                <DatePicker
                  value={recSampleDate}
                  onValueChange={(_iso, jalali) => setRecSampleDate(jalali || '')}
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
                  value={recSampleWeight}
                  onChange={(e) => setRecSampleWeight(e.target.value)}
                  placeholder="وزن واقعی ترازو"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                  required
                />
              </div>

              {recSampleWeight ? (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 space-y-1">
                  <p>
                    اختلاف/افت عملیاتی: <span className="font-bold font-mono">{roundWeight(recSampleDeclaredWeight - Number(recSampleWeight), 3)} گرم</span>
                  </p>
                  <p className="text-[10px] opacity-80">
                    این اختلاف وزنی صرفاً ثبت گردیده و بدهی یا طلبی برای ریگیر ایجاد نمی‌کند.
                  </p>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !recSampleWeight}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? <LoaderCircle size={14} className="spin" /> : null}
                  ثبت دریافت و ورود به موجودی
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Modal: Service Fee */}
      {activeModal === 'service_fee' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-4">
              ثبت هزینه و اجرت خدمات ریگیری
            </h3>
            <form onSubmit={handleServiceFeeSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  مبلغ اجرت / هزینه (ریال) *
                </label>
                <input
                  type="number"
                  step="any"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="مثلاً 5000000"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  توضیحات
                </label>
                <input
                  type="text"
                  value={feeDesc}
                  onChange={(e) => setFeeDesc(e.target.value)}
                  placeholder="اجرت ذوب و عیارسنجی..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                این مبلغ به عنوان بدهی ریالی ما به طرف‌حساب ({customer.name}) در سند حسابداری ثبت و مانده حساب او را بستانکار می‌کند.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !feeAmount}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? <LoaderCircle size={14} className="spin" /> : null}
                  ثبت هزینه و افزایش بدهی
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
