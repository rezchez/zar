'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftRight, Search, ShieldAlert, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { type Customer } from '@/lib/customer';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

type HawalaModalProps = {
  line: DocumentLine | null;
  sourceCustomer: Customer | null;
  allCustomers: Customer[];
  weightPrecision: number;
  onClose: () => void;
  onConfirmHawala: (targetCustomer: Customer) => void;
};

export default function HawalaModal({
  line,
  sourceCustomer,
  allCustomers,
  weightPrecision,
  onClose,
  onConfirmHawala,
}: HawalaModalProps) {
  const [targetQuery, setTargetQuery] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [stage, setStage] = useState<'select' | 'confirm'>('select');

  // Reset internal state when line or modal opens/closes
  useEffect(() => {
    if (line) {
      setTargetQuery('');
      setSelectedTargetId('');
      setStage('select');
    }
  }, [line]);

  const targetCustomer = useMemo(
    () => allCustomers.find((c) => c.id === selectedTargetId) || null,
    [allCustomers, selectedTargetId],
  );

  const availableCustomers = useMemo(() => {
    const q = targetQuery.trim().toLowerCase();
    return allCustomers
      .filter((c) => c.id !== sourceCustomer?.id)
      .filter((c) => !q || `${c.name} ${c.customerCode} ${c.phone1}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allCustomers, sourceCustomer, targetQuery]);

  // Line weight/amount effect details
  const effectDetails = useMemo(() => {
    if (!line) return null;
    const isGold = line.details.metalType === 'gold';
    const rawWeight = Number(line.details.rawWeight) || 0;
    const purity = Number(line.details.purity) || 750;
    const c750 = line.converted750 || (rawWeight * purity) / 750;
    const amount = Number(line.details.totalAmount) || Number(line.details.currencyTotalAmount) || 0;
    const isReceived = line.documentNature === 'received';

    return {
      isGold,
      rawWeight,
      purity,
      c750,
      amount,
      isReceived,
      metalLabel: line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا',
    };
  }, [line]);

  // Projected balances for target customer
  const targetBalances = useMemo(() => {
    if (!targetCustomer || !effectDetails) return null;
    const direction = effectDetails.isReceived ? 1 : -1;
    const currentGold = targetCustomer.goldBalance || 0;
    const effectGold = effectDetails.isGold ? direction * effectDetails.c750 : 0;
    const projectGold = currentGold + effectGold;

    const currentRial = targetCustomer.rialBalance || 0;
    const effectRial = !effectDetails.isGold ? direction * effectDetails.amount : 0;
    const projectRial = currentRial + effectRial;

    return {
      gold: { current: currentGold, effect: effectGold, projected: projectGold },
      rial: { current: currentRial, effect: effectRial, projected: projectRial },
    };
  }, [targetCustomer, effectDetails]);

  if (!line || !sourceCustomer) return null;

  function handleStartHawala() {
    if (!targetCustomer) return;
    onConfirmHawala(targetCustomer);
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-extrabold text-amber-600 dark:text-amber-400">
              <ArrowLeftRight size={18} />
              <span>حواله ردیف سند به طرف‌حساب دیگر</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Line Summary */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-slate-500 font-bold">
              <span>طرف‌حساب مبدأ:</span>
              <strong className="text-slate-800 dark:text-slate-100">{sourceCustomer.name}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">نوع ردیف:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{line.documentTypeLabel || 'ردیف سند'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400 block">جنس / مشخصات:</span>
                <strong className="text-slate-700 dark:text-slate-200">{effectDetails?.metalLabel}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">وزن معادل ۷۵۰:</span>
                <strong className="text-slate-700 dark:text-slate-200">
                  {effectDetails?.c750 ? `${effectDetails.c750.toFixed(weightPrecision)} گرم` : '-'}
                </strong>
              </div>
              {line.details.labName && (
                <div>
                  <span className="text-slate-400 block">آزمایشگاه:</span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{line.details.labName}</span>
                </div>
              )}
              {line.details.stampNumber && (
                <div>
                  <span className="text-slate-400 block">شماره انگ/پاکت:</span>
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{line.details.stampNumber}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stage Switch */}
          {stage === 'select' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                انتخاب طرف‌حساب مقصد
              </label>
              <div className="relative">
                <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
                <input
                  value={targetQuery}
                  onChange={(e) => setTargetQuery(e.target.value)}
                  placeholder="جستجوی نام، کد یا تلفن طرف‌حساب..."
                  className="w-full h-9 pr-9 pl-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Suggestions */}
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-xl border border-slate-100 dark:border-slate-800 p-1">
                {availableCustomers.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setSelectedTargetId(c.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold transition-all ${
                      selectedTargetId === c.id
                        ? 'bg-amber-500 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-[10px] opacity-80">کد {c.customerCode}</span>
                  </button>
                ))}
              </div>

              {/* Target Customer Balance Effect */}
              {targetCustomer && targetBalances && (
                <div className="p-3 bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 rounded-xl text-xs space-y-2">
                  <span className="font-bold text-teal-800 dark:text-teal-300 block">
                    پیش‌نمایش تغییر مانده طرف‌حساب مقصد ({targetCustomer.name}):
                  </span>
                  {effectDetails?.isGold ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>مانده فعلی طلا:</span>
                        <span>{targetBalances.gold.current.toFixed(weightPrecision)} گرم</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-600">
                        <span>اثر این حواله:</span>
                        <span>
                          {targetBalances.gold.effect >= 0 ? '+' : ''}
                          {targetBalances.gold.effect.toFixed(weightPrecision)} گرم
                        </span>
                      </div>
                      <div className="flex justify-between font-extrabold text-teal-700 dark:text-teal-200 pt-1 border-t border-teal-200 dark:border-teal-900">
                        <span>مانده طلا پس از حواله:</span>
                        <span>{targetBalances.gold.projected.toFixed(weightPrecision)} گرم</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span>مانده فعلی ریال:</span>
                        <span>{targetBalances.rial.current.toLocaleString('fa-IR')} ریال</span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-600">
                        <span>اثر این حواله:</span>
                        <span>
                          {targetBalances.rial.effect >= 0 ? '+' : ''}
                          {targetBalances.rial.effect.toLocaleString('fa-IR')} ریال
                        </span>
                      </div>
                      <div className="flex justify-between font-extrabold text-teal-700 dark:text-teal-200 pt-1 border-t border-teal-200 dark:border-teal-900">
                        <span>مانده ریال پس از حواله:</span>
                        <span>{targetBalances.rial.projected.toLocaleString('fa-IR')} ریال</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={!selectedTargetId}
                  onClick={() => setStage('confirm')}
                  className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs font-bold text-slate-950 shadow-md transition-all"
                >
                  مرحله بعد
                </button>
              </div>
            </div>
          )}

          {stage === 'confirm' && targetCustomer && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs space-y-2 text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldAlert size={16} />
                  <span>تأیید انتقال حواله</span>
                </div>
                <p>
                  این ردیف از طرف‌حساب <strong>«{sourceCustomer.name}»</strong> به طرف‌حساب <strong>«{targetCustomer.name}»</strong> حواله خواهد شد. پس از تأیید، مهلت ۱۰ ثانیه‌ای لغو در پایین صفحه فعال خواهد شد.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStage('select')}
                  className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  بازگشت
                </button>
                <button
                  type="button"
                  onClick={handleStartHawala}
                  className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 shadow-md transition-all"
                >
                  تأیید و شروع حواله
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
