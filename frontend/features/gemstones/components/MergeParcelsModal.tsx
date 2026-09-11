'use client';

import { AlertTriangle, CheckCircle2, ChevronRight, Layers, Sparkles, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  areParcelsHomogeneous,
  calculateWeightedAverageCost,
  type GemstoneOpeningRecord,
} from '@/lib/gemstone';
import { formatCaratWeight } from '@/lib/gemstone-weight';
import { convertRialToToman, formatNumberWithCommas } from '@/lib/money';

export type MergeParcelsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedParcels: GemstoneOpeningRecord[];
};

export default function MergeParcelsModal({
  isOpen,
  onClose,
  onSuccess,
  selectedParcels,
}: MergeParcelsModalProps) {
  const [targetId, setTargetId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set default targetId when parcels change
  React.useEffect(() => {
    if (selectedParcels.length > 0 && !targetId) {
      setTargetId(selectedParcels[0].id);
    }
  }, [selectedParcels, targetId]);

  // Check mutual homogeneity
  const homogeneityCheck = useMemo(() => {
    if (selectedParcels.length < 2) {
      return { valid: false, error: 'حداقل ۲ بارخانه برای ادغام باید انتخاب شود.' };
    }
    const base = selectedParcels[0];
    for (let i = 1; i < selectedParcels.length; i++) {
      if (!areParcelsHomogeneous(base, selectedParcels[i])) {
        return {
          valid: false,
          error:
            'بسته‌های انتخابی همگن نیستند. جهت حفظ استاندارد، تنها بسته‌هایی با گونه، تراش، الک/سایز، رده رنگ و رده پاکی کاملاً یکسان می‌توانند با یکدیگر ادغام شوند.',
        };
      }
    }
    return { valid: true };
  }, [selectedParcels]);

  // Calculations for merged preview
  const preview = useMemo(() => {
    if (!homogeneityCheck.valid || selectedParcels.length === 0) return null;

    let totalCt = 0;
    let totalPieces = 0;
    let totalCostRial = 0;

    for (const p of selectedParcels) {
      const ct = Number(p.weightCt || 0);
      const pcs = Number(p.pieces ?? p.quantity ?? 0);
      const cost = Math.round(Number(p.totalAmount || p.totalCost || 0));

      const wac = calculateWeightedAverageCost(totalCt, totalCostRial, ct, cost, totalPieces, pcs);
      totalCt = wac.totalCt;
      totalPieces = wac.totalPieces || (totalPieces + pcs);
      totalCostRial = wac.totalCost;
    }

    const wacPerCtRial = totalCt > 0 ? Math.round(totalCostRial / totalCt) : 0;
    const wacPerPieceRial = totalPieces > 0 ? Math.round(totalCostRial / totalPieces) : 0;

    return {
      totalCt,
      totalPieces,
      totalCostRial,
      wacPerCtRial,
      wacPerPieceRial,
      wacPerCtToman: convertRialToToman(wacPerCtRial),
      wacPerPieceToman: convertRialToToman(wacPerPieceRial),
      totalCostToman: convertRialToToman(totalCostRial),
    };
  }, [selectedParcels, homogeneityCheck.valid]);

  if (!isOpen) return null;

  const handleMergeSubmit = async () => {
    if (!homogeneityCheck.valid || !preview) return;
    setLoading(true);
    setError(null);

    try {
      const chosenTargetId = targetId || selectedParcels[0].id;
      const sourceIds = selectedParcels.filter((p) => p.id !== chosenTargetId).map((p) => p.id);

      const res = await fetch('/api/accounting/opening/gemstones/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: chosenTargetId,
          sourceIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'خطا در ادغام بارخانه‌ها');
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای سرور در انجام عملیات');
    } finally {
      setLoading(false);
    }
  };

  const sample = selectedParcels[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs">
      <div
        dir="rtl"
        className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Layers size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                ترکیب و ادغام بارخانه‌های همگن (Parcel Pooling)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تجمیع بسته‌های هم‌گروه و محاسبه خودکار بهای تمام‌شده با میانگین موزون (WAC)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error / Inhomogeneity Alert */}
        {(!homogeneityCheck.valid || error) && (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error || homogeneityCheck.error}</span>
          </div>
        )}

        {homogeneityCheck.valid && sample && (
          <div className="mt-4 space-y-5">
            {/* Homogeneous Attributes Summary */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50 sm:grid-cols-4">
              <div>
                <span className="block text-[11px] text-slate-400">گونه / گوهر:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{sample.itemName || sample.species}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">تراش:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{sample.shape || 'گرد (Round)'}</span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">الک / سایز:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {sample.sieveSize ? `الک ${sample.sieveSize}` : `${sample.sizeMin || ''}–${sample.sizeMax || ''} ${sample.sizeUnit || 'ct'}`}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400">رده رنگ و پاکی:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {sample.colorRangeLabel || sample.colorRangeDisplay || '—'} / {sample.clarityRangeLabel || sample.clarityRangeDisplay || '—'}
                </span>
              </div>
            </div>

            {/* Parcels to merge table */}
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>بسته‌های انتخاب‌شده برای تجمیع ({selectedParcels.length} بسته):</span>
                <span className="text-[11px] font-normal text-slate-400">
                  بسته مقصد را جهت حفظ کد انبار و مشخصات اصلی انتخاب نمایید.
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">انتخاب مقصد</th>
                      <th className="p-2.5">کد انبار</th>
                      <th className="p-2.5">وزن (قیراط)</th>
                      <th className="p-2.5">تعداد (عدد)</th>
                      <th className="p-2.5">فی هر قیراط</th>
                      <th className="p-2.5">ارزش کل (تومان)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedParcels.map((p) => {
                      const isTarget = (targetId || selectedParcels[0].id) === p.id;
                      const unitPriceToman = convertRialToToman(p.unitPrice || p.costPerCarat || 0);
                      const totalToman = convertRialToToman(p.totalAmount || p.totalCost || 0);

                      return (
                        <tr
                          key={p.id}
                          onClick={() => setTargetId(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isTarget
                              ? 'bg-cyan-50/70 font-semibold dark:bg-cyan-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-2.5">
                            <input
                              type="radio"
                              name="targetParcel"
                              checked={isTarget}
                              onChange={() => setTargetId(p.id)}
                              className="size-4 text-cyan-600 focus:ring-cyan-500"
                            />
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {p.inventoryCode}
                            {isTarget && (
                              <span className="mr-2 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                                بسته اصلی (مقصد)
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-cyan-700 dark:text-cyan-300">
                            {formatCaratWeight(p.weightCt)} ct
                          </td>
                          <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                            {p.pieces ?? p.quantity ?? 1} عدد
                          </td>
                          <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">
                            {formatNumberWithCommas(unitPriceToman)} تومان
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                            {formatNumberWithCommas(totalToman)} تومان
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Merged Result Preview Card */}
            {preview && (
              <div className="rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50/50 to-blue-50/30 p-4 dark:border-cyan-800/60 dark:from-cyan-950/20 dark:to-slate-900">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-cyan-900 dark:text-cyan-300">
                  <Sparkles size={16} className="text-cyan-600 dark:text-cyan-400" />
                  <span>پیش‌نمایش بسته تجمیع‌شده نهایی با میانگین موزون (WAC):</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="rounded-xl bg-white/80 p-2.5 shadow-xs dark:bg-slate-800/80">
                    <span className="block text-[11px] text-slate-400">مجموع وزن قیراط:</span>
                    <span className="font-mono text-sm font-black text-cyan-700 dark:text-cyan-300">
                      {preview.totalCt.toFixed(4)} ct
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/80 p-2.5 shadow-xs dark:bg-slate-800/80">
                    <span className="block text-[11px] text-slate-400">مجموع تعداد قطعات:</span>
                    <span className="font-mono text-sm font-black text-slate-800 dark:text-slate-200">
                      {preview.totalPieces.toLocaleString('fa-IR')} عدد
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/80 p-2.5 shadow-xs dark:bg-slate-800/80">
                    <span className="block text-[11px] text-slate-400">میانگین موزون فی هر قیراط:</span>
                    <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                      {formatNumberWithCommas(preview.wacPerCtToman)} تومان
                    </span>
                  </div>
                  <div className="rounded-xl bg-white/80 p-2.5 shadow-xs dark:bg-slate-800/80">
                    <span className="block text-[11px] text-slate-400">مجموع ارزش ریالی / تومانی:</span>
                    <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                      {formatNumberWithCommas(preview.totalCostToman)} تومان
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleMergeSubmit}
            disabled={loading || !homogeneityCheck.valid}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-500 dark:hover:bg-cyan-600"
          >
            {loading ? (
              <span>در حال تجمیع...</span>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>تایید و ادغام بارخانه‌ها</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
