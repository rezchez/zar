'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type { Customer } from '@/lib/customer';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import Field from '@/src/components/documents/Field';
import HawalaModal from '@/src/components/documents/HawalaModal';
import { toPersianDigits, type DateDiffInfo } from '../utils/document-helpers';

interface DocumentModalsProps {
  // Hawala modal
  hawalaLine: DocumentLine | null;
  setHawalaLine: (line: DocumentLine | null) => void;
  selectedCustomer: Customer | null;
  customers: Customer[];
  weightPrecision?: number;
  onConfirmHawala: (targetCustomer: Customer) => void | Promise<void>;
  isSubmittingHawala?: boolean;

  // Unsaved changes exit guard
  showExitModal: boolean;
  onCloseExitModal: () => void;
  onConfirmExit: () => void;

  // Deletion confirmation
  deleteConfirmLine: DocumentLine | null;
  onCloseDeleteConfirm: () => void;
  onConfirmDeleteLine: () => void;

  // Add custom currency
  showAddCurrencyModal: boolean;
  onCloseAddCurrencyModal: () => void;
  onAddCustomCurrency: (e: React.FormEvent) => void;
  newCurrencyName: string;
  setNewCurrencyName: (val: string) => void;
  newCurrencySymbol: string;
  setNewCurrencySymbol: (val: string) => void;
  newCurrencyCode: string;
  setNewCurrencyCode: (val: string) => void;
  addCurrencyError: string;
  addingCurrency: boolean;

  // Undo restoration toast
  restorationState: { line: DocumentLine; index: number } | null;
  restorationTimer: number;
  onRestoreLine: () => void;

  // Pending hawala countdown toast
  pendingHawala: {
    line: DocumentLine;
    targetCustomer: Customer;
    countdown: number;
  } | null;
  onCancelPendingHawala: () => void;

  // Document date confirmation modal
  showDateConfirmModal?: boolean;
  documentDateJalali?: string;
  dateDiffInfo?: DateDiffInfo | null;
  onConfirmDateChange?: () => void;
  onSetTodayAndCommit?: () => void;
  onCancelDateChange?: () => void;
}

export default function DocumentModals({
  hawalaLine,
  setHawalaLine,
  selectedCustomer,
  customers,
  weightPrecision = 3,
  onConfirmHawala,
  isSubmittingHawala,
  showExitModal,
  onCloseExitModal,
  onConfirmExit,
  deleteConfirmLine,
  onCloseDeleteConfirm,
  onConfirmDeleteLine,
  showAddCurrencyModal,
  onCloseAddCurrencyModal,
  onAddCustomCurrency,
  newCurrencyName,
  setNewCurrencyName,
  newCurrencySymbol,
  setNewCurrencySymbol,
  newCurrencyCode,
  setNewCurrencyCode,
  addCurrencyError,
  addingCurrency,
  restorationState,
  restorationTimer,
  onRestoreLine,
  pendingHawala,
  onCancelPendingHawala,
  showDateConfirmModal = false,
  documentDateJalali = '',
  dateDiffInfo = null,
  onConfirmDateChange,
  onSetTodayAndCommit,
  onCancelDateChange,
}: DocumentModalsProps) {
  return (
    <>
      {/* 1. HAWALA TRANSFER MODAL */}
      <HawalaModal
        line={hawalaLine}
        sourceCustomer={selectedCustomer || null}
        allCustomers={customers}
        weightPrecision={weightPrecision}
        onClose={() => setHawalaLine(null)}
        onConfirmHawala={onConfirmHawala}
        isSubmitting={isSubmittingHawala}
      />

      {/* 2. UNSAVED CHANGES EXIT GUARD MODAL */}
      <AnimatePresence>
        {showExitModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  هشدار خروج از ثبت سند
                </span>
                <button
                  type="button"
                  onClick={onCloseExitModal}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs font-semibold leading-relaxed text-slate-700 dark:text-slate-300">
                شما در حال ثبت سند می‌باشید و اگر صفحه را ترک کنید، اطلاعاتی که وارد کرده‌اید ذخیره نخواهد شد. آیا از انجام این کار مطمئن هستید؟
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseExitModal}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ماندن در صفحه
                </button>
                <button
                  type="button"
                  onClick={onConfirmExit}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-500 cursor-pointer"
                >
                  ترک صفحه و حذف اطلاعات
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 3. DELETION CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmLine ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4 text-right"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <Trash2 size={16} /> تأیید حذف ردیف
                </span>
                <button
                  type="button"
                  onClick={onCloseDeleteConfirm}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              {(() => {
                const details = ((deleteConfirmLine?.details || (deleteConfirmLine as any)?.documentDetails || {}) as Record<string, unknown>);
                const desc = deleteConfirmLine?.description || '';
                const isHawala = Boolean(
                  details?.isHawala ||
                  desc.includes('حواله')
                );
                if (isHawala) {
                  let counterName = String(
                    details.hawalaCounterCustomerName ||
                    details.counterCustomerName ||
                    details.targetCustomerName ||
                    ''
                  ).trim();

                  let counterCode = String(
                    details.hawalaCounterCustomerCode ||
                    details.counterCustomerCode ||
                    details.targetCustomerCode ||
                    ''
                  ).trim();

                  // Lookup in customers list by ID if name is missing
                  if (!counterName && details.hawalaCounterCustomerId && Array.isArray(customers)) {
                    const found = customers.find((c) => c.id === details.hawalaCounterCustomerId);
                    if (found) {
                      counterName = found.name;
                      if (!counterCode && found.customerCode) {
                        counterCode = String(found.customerCode);
                      }
                    }
                  }

                  // Determine direction from desc or details
                  let direction: 'from' | 'to' | 'general' = 'general';
                  if (desc.includes('حواله به') || details.counterNature === 'paid') {
                    direction = 'to';
                  } else if (desc.includes('حواله از') || details.counterNature === 'received') {
                    direction = 'from';
                  }

                  // If counterName is still missing, extract it directly from description text:
                  // E.g. "(حواله از شخص الف کد حساب: 101)" -> "شخص الف"
                  // E.g. "(حواله به شخص ب کد حساب: 102)" -> "شخص ب"
                  if (!counterName && desc) {
                    const fromMatch = desc.match(/(?:حواله\s+از|\(حواله\s+از)\s+([^\(\)\:\n،]+?)(?:\s+کد\s*حساب|\s*[\:\(]|\s*\)|$)/);
                    const toMatch = desc.match(/(?:حواله\s+به|\(حواله\s+به)\s+([^\(\)\:\n،]+?)(?:\s+کد\s*حساب|\s*[\:\(]|\s*\)|$)/);

                    if (fromMatch && fromMatch[1]?.trim()) {
                      counterName = fromMatch[1].trim();
                      direction = 'from';
                    } else if (toMatch && toMatch[1]?.trim()) {
                      counterName = toMatch[1].trim();
                      direction = 'to';
                    }
                  }

                  // Extract counterCode from description if still missing
                  if (!counterCode && desc) {
                    const codeMatch = desc.match(/کد\s*حساب\s*[:\s]*(\d+)/);
                    if (codeMatch && codeMatch[1]) {
                      counterCode = codeMatch[1].trim();
                    }
                  }

                  // If we extracted a code, try to find canonical name in customers list
                  if (counterCode && Array.isArray(customers)) {
                    const foundByCode = customers.find((c) => String(c.customerCode) === String(counterCode));
                    if (foundByCode && foundByCode.name) {
                      counterName = foundByCode.name;
                    }
                  }

                  const codeStr = counterCode ? ` (کد حساب: ${counterCode})` : '';

                  let directionText = '';
                  if (direction === 'from') {
                    directionText = counterName
                      ? `حواله از طرف‌حساب «${counterName}»${codeStr}`
                      : 'حواله دریافتی از طرف‌حساب مقابل';
                  } else if (direction === 'to') {
                    directionText = counterName
                      ? `حواله به طرف‌حساب «${counterName}»${codeStr}`
                      : 'حواله پرداختی به طرف‌حساب مقابل';
                  } else {
                    directionText = counterName
                      ? `حواله طرف‌به‌طرف با طرف‌حساب «${counterName}»${codeStr}`
                      : 'حواله طرف‌به‌طرف';
                  }

                  const counterDisplay = counterName ? `«${counterName}»` : 'طرف‌حساب مقابل';

                  return (
                    <div className="space-y-3">
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs text-right space-y-1.5">
                        <p className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                          <span>⚠️ ردیف حواله طرف‌به‌طرف</span>
                        </p>
                        <p className="leading-relaxed">
                          این ردیف مربوط به <strong>{directionText}</strong> می‌باشد.
                        </p>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                          در صورت حذف، ردیف متناظر آن در سند {counterDisplay} نیز به‌صورت خودکار پاک خواهد شد.
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                        آیا از حذف این ردیف حواله و ردیف متناظر در سند {counterDisplay} اطمینان دارید؟
                      </p>
                    </div>
                  );
                }
                return (
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    آیا از حذف این ردیف سند اطمینان دارید؟
                  </p>
                );
              })()}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onCloseDeleteConfirm}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  لغو
                </button>
                <button
                  type="button"
                  onClick={onConfirmDeleteLine}
                  className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 cursor-pointer"
                >
                  حذف
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 4. RESTORATION TOAST WITH CIRCULAR COUNTDOWN TIMER */}
      <AnimatePresence>
        {restorationState ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 text-white shadow-2xl dark:border-slate-700"
          >
            <div className="relative grid place-items-center w-7 h-7">
              <svg className="w-7 h-7 -rotate-90">
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-slate-700"
                  fill="transparent"
                />
                <circle
                  cx="14"
                  cy="14"
                  r="11"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-amber-400 transition-all duration-1000 ease-linear"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 11}
                  strokeDashoffset={2 * Math.PI * 11 * (1 - restorationTimer / 10)}
                />
              </svg>
              <span className="absolute text-[10px] font-bold text-amber-400">
                {toPersianDigits(String(restorationTimer))}
              </span>
            </div>
            <span className="text-xs font-bold">ردیف سند حذف شد.</span>
            <button
              type="button"
              onClick={onRestoreLine}
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 transition hover:bg-amber-400 cursor-pointer"
            >
              <RotateCcw size={13} /> بازیابی
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 5. FLOATING BOTTOM-RIGHT PENDING HAWALA COUNTDOWN TOAST */}
      <AnimatePresence>
        {pendingHawala ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-2xl border border-amber-500/50 bg-slate-900 px-4 py-3 text-white shadow-2xl dark:border-amber-500/80"
          >
            <div className="relative grid place-items-center w-8 h-8">
              <svg className="w-8 h-8 -rotate-90">
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-slate-800"
                  fill="transparent"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="13"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-amber-400 transition-all duration-1000 ease-linear"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 13}
                  strokeDashoffset={2 * Math.PI * 13 * (1 - pendingHawala.countdown / 10)}
                />
              </svg>
              <span className="absolute text-[11px] font-extrabold text-amber-400">
                {toPersianDigits(String(pendingHawala.countdown))}
              </span>
            </div>

            <div className="text-right space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <ArrowLeftRight size={14} />
                <span>حواله به «{pendingHawala.targetCustomer.name}»</span>
              </div>
              <small className="text-[10px] text-slate-400 block">
                تا {toPersianDigits(String(pendingHawala.countdown))} ثانیه دیگر نهایی می‌شود
              </small>
            </div>

            <button
              type="button"
              onClick={onCancelPendingHawala}
              className="mr-2 flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition shadow-md cursor-pointer"
            >
              <X size={14} /> لغو حواله
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 6. MODAL: ADD CUSTOM CURRENCY */}
      <AnimatePresence>
        {showAddCurrencyModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right"
          >
            <motion.form
              onSubmit={onAddCustomCurrency}
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Plus size={18} /> افزودن ارز جدید
                </span>
                <button
                  type="button"
                  onClick={onCloseAddCurrencyModal}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {addCurrencyError ? (
                <p className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900">
                  {addCurrencyError}
                </p>
              ) : null}

              <Field label="نام ارز">
                <input
                  type="text"
                  value={newCurrencyName}
                  onChange={(e) => setNewCurrencyName(e.target.value)}
                  placeholder="مثال: فرانک سوئیس"
                  required
                  autoFocus
                />
              </Field>
              <Field label="نماد ارز">
                <input
                  type="text"
                  value={newCurrencySymbol}
                  onChange={(e) => setNewCurrencySymbol(e.target.value)}
                  placeholder="مثال: Fr"
                  required
                />
              </Field>
              <Field label="کد ارز">
                <input
                  type="text"
                  value={newCurrencyCode}
                  onChange={(e) => setNewCurrencyCode(e.target.value.toUpperCase())}
                  placeholder="مثال: CHF"
                  required
                  maxLength={16}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCloseAddCurrencyModal}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={addingCurrency}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md hover:bg-amber-400 disabled:opacity-60 cursor-pointer"
                >
                  {addingCurrency ? 'در حال افزودن...' : 'افزودن ارز'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 6. DOCUMENT DATE CONFIRMATION MODAL */}
      <AnimatePresence>
        {showDateConfirmModal && documentDateJalali ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <Calendar size={18} />
                  اعلان تاریخ سند
                </span>
                <button
                  type="button"
                  onClick={onCancelDateChange}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  title="بستن"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 flex items-start gap-2.5">
                  <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed space-y-1.5 flex-1">
                    <p className="font-black text-slate-800 dark:text-slate-100 text-sm">
                      از ثبت سند با تاریخ{' '}
                      <span className="font-mono text-amber-700 dark:text-amber-300 font-black text-sm px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded border border-amber-300 dark:border-amber-700 mx-0.5 inline-block">
                        {toPersianDigits(documentDateJalali)}
                      </span>{' '}
                      مطمئنی؟
                    </p>
                    {dateDiffInfo && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                        {dateDiffInfo.isPast
                          ? `این تاریخ قبل از امروز است (تاریخ امروز: ${toPersianDigits(dateDiffInfo.todayJalali)}).`
                          : dateDiffInfo.isFuture
                            ? `این تاریخ بعد از امروز است (تاریخ امروز: ${toPersianDigits(dateDiffInfo.todayJalali)}).`
                            : ''}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  ثبت سند با تاریخ گذشته یا آینده بر تراز مانده‌حساب‌ها، موجودی صندوق و گزارش‌های دوره‌ای طرف‌حساب مؤثر خواهد بود.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onCancelDateChange}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  انصراف
                </button>
                <div className="flex items-center gap-2">
                  {onSetTodayAndCommit && (
                    <button
                      type="button"
                      onClick={onSetTodayAndCommit}
                      className="rounded-xl border border-amber-500/40 bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 px-3 py-2 text-xs font-bold transition-colors cursor-pointer"
                    >
                      تنظیم به امروز و ثبت
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onConfirmDateChange}
                    className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 shadow-md transition-colors cursor-pointer"
                  >
                    بله، مطمئنم
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
