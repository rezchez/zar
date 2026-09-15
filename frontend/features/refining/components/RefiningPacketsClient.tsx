'use client';

import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  PackageOpen,
  RefreshCw,
  Scale,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { RefiningSample } from '../types';
import { formatWeight } from '@/lib/weight';
import { formatJalaliDate } from '@/lib/jalali';

export default function RefiningPacketsClient() {
  const [packets, setPackets] = useState<RefiningSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Receive Modal State
  const [selectedPacket, setSelectedPacket] = useState<RefiningSample | null>(null);
  const [receivedWeight, setReceivedWeight] = useState<string>('');
  const [receivedDate, setReceivedDate] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchPackets = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch('/api/refining/packets', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setPackets(data.packets || []);
      } else {
        setErrorBanner('خطا در دریافت لیست پاکت‌های نزد ریگیری');
      }
    } catch {
      setErrorBanner('عدم برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPackets();
  }, [fetchPackets]);

  const openReceiveModal = (packet: RefiningSample) => {
    setSelectedPacket(packet);
    setReceivedWeight(packet.declaredWeight.toString());
    setReceivedDate(formatJalaliDate(new Date()));
    setModalError(null);
  };

  const closeReceiveModal = () => {
    setSelectedPacket(null);
    setReceivedWeight('');
    setReceivedDate('');
    setModalError(null);
  };

  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPacket) return;

    const numWeight = parseFloat(receivedWeight);
    if (!numWeight || numWeight <= 0 || isNaN(numWeight)) {
      setModalError('لطفاً وزن واقعی دریافتی را به درستی وارد کنید.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/refining/packets/${selectedPacket.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receivedWeight: numWeight,
          receivedDate: receivedDate.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setModalError(data.message || 'خطا در ثبت دریافت پاکت');
        setSubmitting(false);
        return;
      }

      setSuccessBanner(
        `پاکت ${selectedPacket.packetNumber} با موفقیت دریافت شد و وزن ${formatWeight(numWeight)} گرم وارد موجودی طلا گردید.`,
      );
      closeReceiveModal();
      void fetchPackets();
    } catch {
      setModalError('خطا در ارتباط با سرور.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculated difference preview in modal
  const declared = selectedPacket?.declaredWeight || 0;
  const currentReceived = parseFloat(receivedWeight) || 0;
  const difference = currentReceived > 0 ? declared - currentReceived : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/25 dark:text-amber-400">
            <PackageOpen size={28} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              پاکت‌های نمونه نزد ریگیری
            </h1>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              مدیریت نمونه‌های عیارسنجی در انتظار دریافت و ثبت ورود قطعی به انبار طلا
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchPackets()}
            disabled={loading}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>به‌روزرسانی</span>
          </button>
        </div>
      </div>

      {/* Error & Success Messages */}
      {errorBanner ? (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span>{errorBanner}</span>
        </div>
      ) : null}

      {successBanner ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {/* Packets Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 p-4 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox size={18} className="text-amber-500" />
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                فهرست پاکت‌های در جریان
              </span>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {packets.length.toLocaleString('fa-IR')} پاکت
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-3">
            <LoaderCircle size={28} className="animate-spin text-amber-500" />
            <span className="text-xs font-bold text-slate-400">در حال دریافت اطلاعات...</span>
          </div>
        ) : packets.length === 0 ? (
          <div className="flex min-h-[250px] flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <PackageOpen size={28} />
            </div>
            <p className="text-sm font-black text-slate-700 dark:text-slate-300">
              هیچ پاکت نمونه‌ای نزد ریگیری وجود ندارد.
            </p>
            <p className="text-xs text-slate-400">
              تمام پاکت‌های صادرشده دریافت شده و وارد موجودی طلا گردیده‌اند.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 font-black text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <th className="px-4 py-3.5">شماره پاکت</th>
                  <th className="px-4 py-3.5">شماره پرونده</th>
                  <th className="px-4 py-3.5">نام ریگیر</th>
                  <th className="px-4 py-3.5">وزن اعلام‌شده (گرم)</th>
                  <th className="px-4 py-3.5">تاریخ ارسال</th>
                  <th className="px-4 py-3.5">وضعیت</th>
                  <th className="px-4 py-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {packets.map((pkt) => (
                  <tr
                    key={pkt.id}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-3.5 font-mono font-black text-slate-900 dark:text-white">
                      {pkt.packetNumber}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-600 dark:text-slate-300">
                      {pkt.caseNumber || '—'}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-slate-200">
                      {pkt.refinerName || '—'}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-black text-amber-700 dark:text-amber-400">
                      {formatWeight(pkt.declaredWeight)}{' '}
                      <span className="text-[10px] font-bold text-slate-400">گرم</span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                      {pkt.issueDate}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-black text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        نزد ریگیر
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => openReceiveModal(pkt)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-500 active:scale-95"
                      >
                        <Check size={14} />
                        <span>دریافت پاکت</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Packet Modal */}
      {selectedPacket ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400">
                  <Check size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    دریافت پاکت نمونه
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    پاکت {selectedPacket.packetNumber} — پرونده {selectedPacket.caseNumber}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReceiveModal}
                disabled={submitting}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleReceiveSubmit} className="p-6 space-y-4">
              {modalError ? (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/80 p-3 text-xs font-bold text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{modalError}</span>
                </div>
              ) : null}

              {/* Summary details */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/50">
                <div>
                  <span className="text-[11px] font-bold text-slate-400">طرف‌حساب ریگیر:</span>
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    {selectedPacket.refinerName || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400">وزن اعلام‌شده:</span>
                  <p className="font-mono font-black text-amber-700 dark:text-amber-400">
                    {formatWeight(selectedPacket.declaredWeight)} گرم
                  </p>
                </div>
              </div>

              {/* Received Weight Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
                  وزن واقعی دریافتی پاکت (گرم) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={receivedWeight}
                    onChange={(e) => setReceivedWeight(e.target.value)}
                    placeholder="مثال: ۲.۳۵۰"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 pr-10 font-mono text-sm font-bold text-slate-900 shadow-2xs transition-all focus:border-emerald-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
                  />
                  <Scale
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              {/* Received Date Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-200">
                  تاریخ دریافت پاکت <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    placeholder="۱۴۰۵/۰۶/۲۵"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 pr-10 font-mono text-sm font-bold text-slate-900 shadow-2xs transition-all focus:border-emerald-500 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-emerald-400 dark:focus:bg-slate-800 dark:focus:text-white dark:focus:ring-emerald-400/20"
                  />
                  <Calendar
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </div>

              {/* Live Difference & Operational Loss Notice */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    اختلاف وزنی (افت فرآیند ری‌گیری):
                  </span>
                  <span
                    className={`font-mono font-black ${
                      difference > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : difference < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {difference > 0 ? `+${formatWeight(difference)} افت` : difference < 0 ? `${formatWeight(Math.abs(difference))} اضافه` : '۰.۰۰۰'} گرم
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  🛡️ <strong>اصل حسابداری:</strong> این اختلاف وزن صرفاً به عنوان افت عملیاتی ثبت شده و هیچ‌گونه اثر بدهکاری یا بستانکاری بر حساب مالی ریگیر نخواهد داشت. وزن واقعی مستقیماً وارد انبار طلا می‌شود.
                </p>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeReceiveModal}
                  disabled={submitting}
                  className="h-11 rounded-2xl border border-slate-200 px-5 text-xs font-black text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-6 text-xs font-black text-white shadow-xs transition-all hover:bg-emerald-500 active:scale-95 disabled:opacity-50"
                >
                  {submitting ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  <span>تأیید و ورود به موجودی طلا</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
