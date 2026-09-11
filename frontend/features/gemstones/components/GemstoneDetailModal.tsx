'use client';

import {
  Award,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Gem,
  Info,
  MapPin,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

import {
  CLARITY_GRADES,
  COLORED_HUES,
  COLOR_ORIGINS,
  CUT_GRADES,
  D_Z_COLORS,
  FANCY_INTENSITIES,
  FLUORESCENCE_GRADES,
  GEMSTONE_SHAPES,
  GEMSTONE_SPECIES,
  GEMSTONE_TREATMENTS,
  ORIGIN_COUNTRIES,
  ORIGIN_SOURCES,
  POLISH_SYMMETRY_GRADES,
  SATURATIONS,
  TONES,
  TRANSPARENCIES,
  ROOT_CATEGORIES,
  isLondonBlueTopaz,
  type GemstoneOpeningRecord,
} from '@/lib/gemstone';
import { formatCaratWeight, formatGramWeight } from '@/lib/gemstone-weight';
import {
  convertRialToToman,
  formatNumberWithCommas,
  SUPPORTED_CURRENCIES,
} from '@/lib/money';

export type GemstoneDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  gemstone: GemstoneOpeningRecord | null;
};

export default function GemstoneDetailModal({
  isOpen,
  onClose,
  gemstone,
}: GemstoneDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !gemstone) return null;

  const isDiamond = gemstone.category === 'diamond';
  const isParcel = gemstone.mode === 'parcel';

  const speciesObj = GEMSTONE_SPECIES.find((s) => s.id === gemstone.species);
  const shapeObj = GEMSTONE_SHAPES.find((s) => s.id === gemstone.shape);
  const cutObj = CUT_GRADES.find((c) => c.id === gemstone.cutGrade);
  const polishObj = POLISH_SYMMETRY_GRADES.find((p) => p.id === gemstone.polish);
  const symmObj = POLISH_SYMMETRY_GRADES.find((s) => s.id === gemstone.symmetry);
  const fluorObj = FLUORESCENCE_GRADES.find((f) => f.id === gemstone.fluorescence);
  const treatObj = GEMSTONE_TREATMENTS.find((t) => t.id === gemstone.treatments);
  const originObj = ORIGIN_COUNTRIES.find((o) => o.id === gemstone.origin);
  const originSourceObj = ORIGIN_SOURCES.find((os) => os.id === gemstone.originSource);
  const transpObj = TRANSPARENCIES.find((t) => t.id === gemstone.transparency);
  const toneObj = TONES.find((t) => t.id === gemstone.tone);
  const satObj = SATURATIONS.find((s) => s.id === gemstone.saturation);

  const rootCategoryObj = ROOT_CATEGORIES.find((rc) => rc.id === gemstone.rootCategory);

  const handleCopyReportNumber = () => {
    if (gemstone.certificateReportNumber) {
      void navigator.clipboard.writeText(gemstone.certificateReportNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Gem size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {gemstone.itemName || speciesObj?.nameFa || 'شناسنامه گوهر'}
                </h3>
                {gemstone.internalCode && (
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {gemstone.internalCode}
                  </span>
                )}
                {/* Root Category Badge */}
                {rootCategoryObj && (
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-black ${
                      gemstone.rootCategory === 'laboratory_grown'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                        : gemstone.rootCategory === 'simulant'
                        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-300'
                        : gemstone.rootCategory === 'synthetic'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : gemstone.rootCategory === 'treated_natural'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}
                  >
                    {rootCategoryObj.labelFa}
                    {gemstone.growthMethod && ` (${gemstone.growthMethod})`}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {isDiamond
                  ? gemstone.diamondType === 'lab_grown' || gemstone.rootCategory === 'laboratory_grown'
                    ? `الماس آزمایشگاهی (${gemstone.growthMethod || 'CVD / HPHT'})`
                    : 'الماس طبیعی (Natural Diamond)'
                  : `${speciesObj?.nameFa || ''} ${gemstone.variety ? `— ${gemstone.variety}` : ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] font-extrabold text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
              {isParcel ? 'بسته‌ای (بار سنگ)' : 'تک سنگ'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-6 text-xs">

          {/* Lab-Grown Diamond Dossier */}
          {(gemstone.rootCategory === 'laboratory_grown' || gemstone.diamondType === 'lab_grown') && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-3.5 space-y-2 dark:border-purple-900/60 dark:bg-purple-950/20">
              <span className="flex items-center gap-1.5 text-xs font-black text-purple-900 dark:text-purple-300">
                <SparklesIcon className="size-4 text-purple-600" />
                مشخصات تخصصی الماس آزمایشگاهی (Lab-Grown Diamond Dossier)
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">روش سنتز (Growth Method)</span>
                  <div className="font-bold text-purple-950 dark:text-purple-200">
                    {gemstone.growthMethod || 'CVD'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">بهسازی پس از رشد</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.postGrowthTreatment === 'none_detected'
                      ? 'بدون بهسازی (None Detected)'
                      : gemstone.postGrowthTreatment === 'detected'
                      ? 'دارای بهسازی (Detected)'
                      : 'نامشخص'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">حکاکی لیزری شناسه</span>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.laserInscription || 'ثبت نشده'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Melee Diamond Bar-Khaneh Parcel Pool Dossier */}
          {isParcel && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3.5 space-y-2 dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-indigo-950 dark:text-indigo-200">
                  <Tag size={14} className="text-indigo-600 dark:text-indigo-400" />
                  مشخصات بارخانه الماس و حوضچه همگن (Parcel Pool Dossier)
                </span>
                {gemstone.lotNumber && (
                  <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-mono text-[10px] font-bold text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                    بچ: {gemstone.lotNumber}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">محدوده سایز / الک</span>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.sizeMin !== undefined && gemstone.sizeMax !== undefined
                      ? `${gemstone.sizeMin} – ${gemstone.sizeMax} ${gemstone.sizeUnit || 'ct'}`
                      : '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">محدوده رنگی (Color Range)</span>
                  <div className="font-mono font-black text-cyan-700 dark:text-cyan-300">
                    {gemstone.colorRangeDisplay || (gemstone.colorMin && gemstone.colorMax ? `${gemstone.colorMin}–${gemstone.colorMax}` : '—')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">محدوده پاکی (Clarity Range)</span>
                  <div className="font-mono font-black text-indigo-700 dark:text-indigo-300">
                    {gemstone.clarityRangeDisplay || (gemstone.clarityMin && gemstone.clarityMax ? `${gemstone.clarityMin}–${gemstone.clarityMax}` : '—')}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">تعداد سنگ</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.pieces ?? 1} عدد
                  </div>
                </div>
              </div>

              {gemstone.poolIdentityKey && (
                <div className="pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                  <span className="text-[10px] text-slate-400">کلید هویتی حوضچه (Pool Identity Key): </span>
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {gemstone.poolIdentityKey}
                  </code>
                </div>
              )}
            </div>
          )}
          {/* Certificate Banner (if applicable) */}
          {gemstone.certificateLab && gemstone.certificateLab !== 'none' && (
            <div className="flex items-center justify-between rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 dark:border-cyan-900/50 dark:bg-cyan-950/20">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/25 dark:text-cyan-400">
                  <Award size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-cyan-900 dark:text-cyan-200">
                      شناسنامه معتبر {gemstone.certificateLab.toUpperCase()}
                    </span>
                    {gemstone.verificationStatus === 'verified' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck size={12} />
                        تایید شده
                      </span>
                    )}
                    {gemstone.verificationStatus === 'not_checked' && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        استعلام نشده
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                    <span>شماره گزارش: <strong className="font-mono text-slate-900 dark:text-white">{gemstone.certificateReportNumber || '—'}</strong></span>
                    {gemstone.certificateDate && <span>تاریخ صدور: {gemstone.certificateDate}</span>}
                  </div>
                </div>
              </div>

              {gemstone.certificateReportNumber && (
                <button
                  type="button"
                  onClick={handleCopyReportNumber}
                  className="flex items-center gap-1 rounded-xl border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-bold text-cyan-800 shadow-2xs hover:bg-cyan-50 dark:border-cyan-800 dark:bg-slate-800 dark:text-cyan-200 dark:hover:bg-slate-700"
                >
                  {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copied ? 'کپی شد' : 'کپی شماره'}</span>
                </button>
              )}
            </div>
          )}

          {/* Weight & Geometry Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-medium text-slate-400">وزن به قیراط (ct)</span>
              <div className="mt-1 text-base font-black text-cyan-600 dark:text-cyan-400">
                {formatCaratWeight(gemstone.weightCt)} <span className="text-xs font-normal">ct</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-medium text-slate-400">وزن معادل به گرم (g)</span>
              <div className="mt-1 text-base font-black text-slate-800 dark:text-slate-200">
                {formatGramWeight(gemstone.weightG)} <span className="text-xs font-normal">g</span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-medium text-slate-400">تراش و شکل هندسی</span>
              <div className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                {shapeObj?.nameFa || gemstone.shape || 'نامشخص'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-[11px] font-medium text-slate-400">تعداد سنگ (عدد)</span>
              <div className="mt-1 font-bold text-slate-800 dark:text-slate-200">
                {gemstone.pieces ?? 1} عدد
              </div>
            </div>
          </div>

          {/* Measurements if present */}
          {gemstone.measurementsLength && gemstone.measurementsWidth && (
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300">
              <span className="font-medium">ابعاد هندسی سنگ (طول × عرض × عمق):</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {gemstone.measurementsLength} × {gemstone.measurementsWidth}
                {gemstone.measurementsDepth ? ` × ${gemstone.measurementsDepth}` : ''} mm
              </span>
            </div>
          )}

          {/* Detailed Gemological Quality Breakdown */}
          {isDiamond ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <SparklesIcon className="size-4 text-cyan-500" />
                درجه‌بندی الماس بر اساس استاندارد جهانی 4Cs
              </h4>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">درجه رنگ (Color)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.colorMode === 'fancy'
                      ? `Fancy ${gemstone.fancyColorIntensity || ''} ${gemstone.fancyColorHue || ''}`
                      : gemstone.colorGrade || 'نامشخص'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">درجه پاکی (Clarity)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.clarityGrade || 'نامشخص'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">کیفیت تراش (Cut)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {cutObj?.nameFa || gemstone.cutGrade || '—'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">فلورسانس (Fluorescence)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {fluorObj?.nameFa || gemstone.fluorescence || 'None'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">پولیش (Polish)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {polishObj?.nameFa || gemstone.polish || '—'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">تقارن (Symmetry)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {symmObj?.nameFa || gemstone.symmetry || '—'}
                  </div>
                </div>

                {gemstone.tablePercentage && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">میز (Table %)</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {gemstone.tablePercentage}%
                    </div>
                  </div>
                )}

                {gemstone.depthPercentage && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">عمق (Depth %)</span>
                    <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {gemstone.depthPercentage}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="flex items-center gap-2 text-xs font-black text-slate-900 dark:text-white">
                <Info size={14} className="text-cyan-500" />
                ویژگی‌های گوهرشناسی سنگ رنگی
              </h4>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">گونه / خانواده</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {speciesObj?.nameFa || gemstone.species}
                  </div>
                </div>

                {gemstone.variety && (
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400">واریته</span>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {gemstone.variety}
                    </div>
                  </div>
                )}

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">رنگ و فام (Hue)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.colorHue || '—'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">شفافیت (Transparency)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {transpObj?.nameFa || gemstone.transparency || '—'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">بهسازی و بهینه‌سازی (Treatments)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {treatObj?.nameFa || gemstone.treatments || 'نامشخص'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">مبدا جغرافیایی (Origin)</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {originObj?.nameFa || gemstone.origin || 'نامشخص'}
                    {originSourceObj && (
                      <span className="mr-1 text-[10px] font-normal text-slate-400">
                        ({originSourceObj.nameFa})
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">تن و اشباع رنگ</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {toneObj?.nameFa || gemstone.tone || '—'} / {satObj?.nameFa || gemstone.saturation || '—'}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400">پاکی ظاهری</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.clarityDescription || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Financials & Valuation */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <h4 className="flex items-center gap-2 text-xs font-black text-emerald-900 dark:text-emerald-300">
              <Scale size={14} />
              ارزش‌گذاری و بهای تمام‌شده دفتری
            </h4>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">مبنای ارزش‌گذاری</span>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {gemstone.valuationMethod === 'per_carat'
                    ? 'بر مبنای نرخ هر قیراط'
                    : gemstone.valuationMethod === 'per_gram'
                    ? 'بر مبنای نرخ هر گرم'
                    : 'مبلغ کل مقطوع'}
                </div>
              </div>

              {gemstone.costPerCarat ? (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">نرخ هر قیراط</span>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.currency && gemstone.currency !== 'IRT' && gemstone.currency !== 'IRR'
                      ? `${formatNumberWithCommas(gemstone.costPerCarat)} ${SUPPORTED_CURRENCIES[gemstone.currency]?.symbol || gemstone.currency}`
                      : `${formatNumberWithCommas(convertRialToToman(gemstone.costPerCarat))} تومان`}
                  </div>
                </div>
              ) : null}

              {gemstone.costPerGram ? (
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">نرخ هر گرم</span>
                  <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {gemstone.currency && gemstone.currency !== 'IRT' && gemstone.currency !== 'IRR'
                      ? `${formatNumberWithCommas(gemstone.costPerGram)} ${SUPPORTED_CURRENCIES[gemstone.currency]?.symbol || gemstone.currency}`
                      : `${formatNumberWithCommas(convertRialToToman(gemstone.costPerGram))} تومان`}
                  </div>
                </div>
              ) : null}

              <div className="col-span-2 space-y-0.5 sm:col-span-3">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  بهای تمام‌شده کل {gemstone.currency ? `(${SUPPORTED_CURRENCIES[gemstone.currency]?.faName || gemstone.currency})` : '(ثبت در حساب ۱۱۳۰۵۰)'}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                    {gemstone.currency && gemstone.currency !== 'IRT' && gemstone.currency !== 'IRR'
                      ? `${formatNumberWithCommas(gemstone.totalCost ?? gemstone.totalAmount ?? 0)} ${SUPPORTED_CURRENCIES[gemstone.currency]?.symbol || gemstone.currency}`
                      : `${formatNumberWithCommas(convertRialToToman(gemstone.totalCost ?? gemstone.totalAmount ?? 0))} تومان`}
                  </span>
                  {(!gemstone.currency || gemstone.currency === 'IRT' || gemstone.currency === 'IRR') && (
                    <span className="text-[11px] font-mono text-slate-400">
                      ({formatNumberWithCommas(gemstone.totalCost ? gemstone.totalCost * 10 : gemstone.totalAmount ?? 0)} ریال)
                    </span>
                  )}
                </div>
              </div>

              {isParcel && (
                <div className="col-span-2 sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                  <div className="flex items-center justify-between rounded-xl bg-white/60 p-2 text-[11px] dark:bg-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-bold">میانگین موزون نرخ هر قیراط (WAC/ct):</span>
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                      {(() => {
                        const isForeign = gemstone.currency && gemstone.currency !== 'IRT' && gemstone.currency !== 'IRR';
                        const currSymbol = isForeign ? (SUPPORTED_CURRENCIES[gemstone.currency!]?.symbol || gemstone.currency) : 'تومان';
                        if (gemstone.wacPerCarat) {
                          return `${formatNumberWithCommas(isForeign ? gemstone.wacPerCarat : convertRialToToman(gemstone.wacPerCarat))} ${currSymbol}`;
                        }
                        if (gemstone.weightCt > 0) {
                          const totalVal = isForeign
                            ? (gemstone.totalCost ?? gemstone.totalAmount ?? 0)
                            : convertRialToToman(gemstone.totalCost ? gemstone.totalCost * 10 : gemstone.totalAmount ?? 0);
                          return `${formatNumberWithCommas(Math.round(totalVal / gemstone.weightCt))} ${currSymbol}`;
                        }
                        return '—';
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white/60 p-2 text-[11px] dark:bg-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400 font-bold">میانگین موزون نرخ هر عدد (WAC/pc):</span>
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                      {(() => {
                        const isForeign = gemstone.currency && gemstone.currency !== 'IRT' && gemstone.currency !== 'IRR';
                        const currSymbol = isForeign ? (SUPPORTED_CURRENCIES[gemstone.currency!]?.symbol || gemstone.currency) : 'تومان';
                        if (gemstone.wacPerPiece) {
                          return `${formatNumberWithCommas(isForeign ? gemstone.wacPerPiece : convertRialToToman(gemstone.wacPerPiece))} ${currSymbol}`;
                        }
                        if (gemstone.pieces && gemstone.pieces > 0) {
                          const totalVal = isForeign
                            ? (gemstone.totalCost ?? gemstone.totalAmount ?? 0)
                            : convertRialToToman(gemstone.totalCost ? gemstone.totalCost * 10 : gemstone.totalAmount ?? 0);
                          return `${formatNumberWithCommas(Math.round(totalVal / gemstone.pieces))} ${currSymbol}`;
                        }
                        return '—';
                      })()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Storage & Notes */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-slate-600 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" />
              <span>محل نگهداری: <strong>{gemstone.storageLocation || 'گاوصندوق اصلی'}</strong></span>
            </div>
            {gemstone.acquisitionDate && (
              <div className="flex items-center gap-2">
                <Tag size={14} className="text-slate-400" />
                <span>تاریخ تملک: <strong>{gemstone.acquisitionDate}</strong></span>
              </div>
            )}
          </div>

          {gemstone.description && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-3.5 dark:border-slate-800 dark:bg-slate-800/20">
              <span className="text-[10px] font-bold text-slate-400">توضیحات و یادداشت گوهرشناسی:</span>
              <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {gemstone.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 dark:border-slate-800 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}
