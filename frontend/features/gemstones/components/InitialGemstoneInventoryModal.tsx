'use client';

import {
  AlertCircle,
  Award,
  Check,
  Gem,
  Info,
  Layers,
  Scale,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  CLARITY_GRADES,
  COLORED_HUES,
  COLOR_ORIGINS,
  CUT_GRADES,
  D_Z_COLORS,
  FANCY_INTENSITIES,
  FLUORESCENCE_GRADES,
  GEMSTONE_LABS,
  GEMSTONE_SHAPES,
  GEMSTONE_SPECIES,
  GEMSTONE_TREATMENTS,
  ORIGIN_COUNTRIES,
  ORIGIN_SOURCES,
  POLISH_SYMMETRY_GRADES,
  SATURATIONS,
  TONES,
  TRANSPARENCIES,
  type GemstoneCategory,
  type GemstoneOpeningRecord,
  type GemstoneTypeRecord,
} from '@/lib/gemstone';
import {
  calculateValuationTotalCost,
  caratsToGrams,
  gramsToCarats,
  parseWeight,
} from '@/lib/gemstone-weight';
import { dateToJalaliString } from '@/lib/jalali';
import { convertRialToToman, formatNumberWithCommas } from '@/lib/money';

export type InitialGemstoneInventoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editingItem?: GemstoneOpeningRecord | null;
};

export default function InitialGemstoneInventoryModal({
  isOpen,
  onClose,
  onSuccess,
  editingItem,
}: InitialGemstoneInventoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [mode, setMode] = useState<'single_stone' | 'parcel'>('single_stone');
  const [category, setCategory] = useState<GemstoneCategory>('diamond');
  const [species, setSpecies] = useState<string>('diamond');
  const [variety, setVariety] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');

  // Diamond specific
  const [diamondType, setDiamondType] = useState<'natural' | 'lab_grown'>('natural');
  const [colorMode, setColorMode] = useState<'d_z' | 'fancy'>('d_z');
  const [colorGrade, setColorGrade] = useState<string>('G');
  const [fancyIntensity, setFancyIntensity] = useState<string>('Fancy');
  const [fancyHue, setFancyHue] = useState<string>('Yellow');
  const [fancyOvertone, setFancyOvertone] = useState<string>('');
  const [fancyOrigin, setFancyOrigin] = useState<string>('natural');
  const [clarityGrade, setClarityGrade] = useState<string>('VS1');
  const [cutGrade, setCutGrade] = useState<string>('excellent');
  const [polish, setPolish] = useState<string>('excellent');
  const [symmetry, setSymmetry] = useState<string>('excellent');
  const [fluorescence, setFluorescence] = useState<string>('none');
  const [fluorescenceColor, setFluorescenceColor] = useState<string>('');

  // Colored stone specific
  const [colorHue, setColorHue] = useState<string>('');
  const [tone, setTone] = useState<string>('medium');
  const [saturation, setSaturation] = useState<string>('strong');
  const [transparency, setTransparency] = useState<string>('transparent');
  const [clarityDescription, setClarityDescription] = useState<string>('eye_clean');
  const [treatments, setTreatments] = useState<string>('none_detected');
  const [treatmentDetails, setTreatmentDetails] = useState<string>('');
  const [origin, setOrigin] = useState<string>('unknown');
  const [originSource, setOriginSource] = useState<string>('unknown');

  // Common geometry & certificate
  const [shape, setShape] = useState<string>('round');
  const [measurementsLength, setMeasurementsLength] = useState<string>('');
  const [measurementsWidth, setMeasurementsWidth] = useState<string>('');
  const [measurementsDepth, setMeasurementsDepth] = useState<string>('');
  const [tablePercentage, setTablePercentage] = useState<string>('');
  const [depthPercentage, setDepthPercentage] = useState<string>('');
  const [certificateLab, setCertificateLab] = useState<string>('none');
  const [certificateReportNumber, setCertificateReportNumber] = useState<string>('');
  const [certificateDate, setCertificateDate] = useState<string>('');
  const [verificationStatus, setVerificationStatus] = useState<string>('not_checked');

  // Weights & counts
  const [weightCt, setWeightCt] = useState<string>('');
  const [weightG, setWeightG] = useState<string>('');
  const [pieces, setPieces] = useState<string>('1');

  // Financials & valuation
  const [valuationMethod, setValuationMethod] = useState<'per_carat' | 'per_gram' | 'total_amount'>('per_carat');
  // We accept unit cost in Toman for user convenience and convert to Rial on submit
  const [unitCostToman, setUnitCostToman] = useState<string>('');
  const [totalCostTomanManual, setTotalCostTomanManual] = useState<string>('');

  // Storage & notes
  const [storageLocation, setStorageLocation] = useState<string>('گاوصندوق اصلی');
  const [internalCode, setInternalCode] = useState<string>('');
  const [acquisitionDate, setAcquisitionDate] = useState<string>(dateToJalaliString(new Date()));
  const [description, setDescription] = useState<string>('');

  // Preset types from server
  const [gemstoneTypes, setGemstoneTypes] = useState<GemstoneTypeRecord[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    async function loadTypes() {
      try {
        const res = await fetch('/api/gemstone-types', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setGemstoneTypes(data.items);
          }
        }
      } catch {
        // non-blocking
      }
    }
    void loadTypes();
  }, [isOpen]);

  // Sync editing item or reset
  useEffect(() => {
    if (editingItem) {
      setMode(editingItem.mode || 'single_stone');
      setCategory(editingItem.category || 'diamond');
      setSpecies(editingItem.species || 'diamond');
      setVariety(editingItem.variety || '');
      setItemName(editingItem.itemName || '');
      setDiamondType(editingItem.diamondType || 'natural');
      setColorMode(editingItem.colorMode || 'd_z');
      setColorGrade(editingItem.colorGrade || 'G');
      setFancyIntensity(editingItem.fancyColorIntensity || 'Fancy');
      setFancyHue(editingItem.fancyColorHue || 'Yellow');
      setFancyOvertone(editingItem.fancyColorOvertone || '');
      setFancyOrigin(editingItem.fancyColorOrigin || 'natural');
      setClarityGrade(editingItem.clarityGrade || 'VS1');
      setCutGrade(editingItem.cutGrade || 'excellent');
      setPolish(editingItem.polish || 'excellent');
      setSymmetry(editingItem.symmetry || 'excellent');
      setFluorescence(editingItem.fluorescence || 'none');
      setFluorescenceColor(editingItem.fluorescenceColor || '');
      setColorHue(editingItem.colorHue || '');
      setTone(editingItem.tone || 'medium');
      setSaturation(editingItem.saturation || 'strong');
      setTransparency(editingItem.transparency || 'transparent');
      setClarityDescription(editingItem.clarityDescription || 'eye_clean');
      setTreatments(editingItem.treatments || 'none_detected');
      setTreatmentDetails(editingItem.treatmentDetails || '');
      setOrigin(editingItem.origin || 'unknown');
      setOriginSource(editingItem.originSource || 'unknown');
      setShape(editingItem.shape || 'round');
      setMeasurementsLength(editingItem.measurementsLength ? String(editingItem.measurementsLength) : '');
      setMeasurementsWidth(editingItem.measurementsWidth ? String(editingItem.measurementsWidth) : '');
      setMeasurementsDepth(editingItem.measurementsDepth ? String(editingItem.measurementsDepth) : '');
      setTablePercentage(editingItem.tablePercentage ? String(editingItem.tablePercentage) : '');
      setDepthPercentage(editingItem.depthPercentage ? String(editingItem.depthPercentage) : '');
      setCertificateLab(editingItem.certificateLab || 'none');
      setCertificateReportNumber(editingItem.certificateReportNumber || '');
      setCertificateDate(editingItem.certificateDate || '');
      setVerificationStatus(editingItem.verificationStatus || 'not_checked');
      setWeightCt(String(editingItem.weightCt || ''));
      setWeightG(String(editingItem.weightG || ''));
      setPieces(editingItem.pieces ? String(editingItem.pieces) : '1');
      setValuationMethod(editingItem.valuationMethod || 'per_carat');

      if (editingItem.valuationMethod === 'per_carat' && editingItem.costPerCarat) {
        setUnitCostToman(String(convertRialToToman(editingItem.costPerCarat)));
      } else if (editingItem.valuationMethod === 'per_gram' && editingItem.costPerGram) {
        setUnitCostToman(String(convertRialToToman(editingItem.costPerGram)));
      } else {
        setUnitCostToman('');
      }
      setTotalCostTomanManual(String(convertRialToToman(editingItem.totalCost || 0)));

      setStorageLocation(editingItem.storageLocation || 'گاوصندوق اصلی');
      setInternalCode(editingItem.internalCode || '');
      setAcquisitionDate(editingItem.acquisitionDate || dateToJalaliString(new Date()));
      setDescription(editingItem.description || '');
    } else {
      // Defaults
      setMode('single_stone');
      setCategory('diamond');
      setSpecies('diamond');
      setVariety('');
      setItemName('');
      setDiamondType('natural');
      setColorMode('d_z');
      setColorGrade('G');
      setFancyIntensity('Fancy');
      setFancyHue('Yellow');
      setFancyOvertone('');
      setFancyOrigin('natural');
      setClarityGrade('VS1');
      setCutGrade('excellent');
      setPolish('excellent');
      setSymmetry('excellent');
      setFluorescence('none');
      setFluorescenceColor('');
      setColorHue('');
      setTone('medium');
      setSaturation('strong');
      setTransparency('transparent');
      setClarityDescription('eye_clean');
      setTreatments('none_detected');
      setTreatmentDetails('');
      setOrigin('unknown');
      setOriginSource('unknown');
      setShape('round');
      setMeasurementsLength('');
      setMeasurementsWidth('');
      setMeasurementsDepth('');
      setTablePercentage('');
      setDepthPercentage('');
      setCertificateLab('none');
      setCertificateReportNumber('');
      setCertificateDate('');
      setVerificationStatus('not_checked');
      setWeightCt('');
      setWeightG('');
      setPieces('1');
      setValuationMethod('per_carat');
      setUnitCostToman('');
      setTotalCostTomanManual('');
      setStorageLocation('گاوصندوق اصلی');
      setInternalCode('');
      setAcquisitionDate(dateToJalaliString(new Date()));
      setDescription('');
    }
    setError(null);
  }, [editingItem, isOpen]);

  // Carat / Gram conversion handlers
  const handleCaratChange = (val: string) => {
    setWeightCt(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setWeightG(String(caratsToGrams(parsed, 4)));
    } else {
      setWeightG('');
    }
  };

  const handleGramChange = (val: string) => {
    setWeightG(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setWeightCt(String(gramsToCarats(parsed, 3)));
    } else {
      setWeightCt('');
    }
  };

  // Species selection change
  const handleSpeciesChange = (newSpecies: string) => {
    setSpecies(newSpecies);
    if (newSpecies === 'diamond') {
      setCategory('diamond');
    } else {
      setCategory('colored_gemstone');
    }
  };

  // Compute total cost dynamically
  const calculatedTotalCostRial = React.useMemo(() => {
    const numWeightCt = parseWeight(weightCt);
    const numWeightG = parseWeight(weightG);
    const unitToman = parseFloat(unitCostToman) || 0;
    const unitRial = Math.round(unitToman * 10);
    const manualToman = parseFloat(totalCostTomanManual) || 0;
    const manualRial = Math.round(manualToman * 10);

    return calculateValuationTotalCost({
      valuationMethod,
      weightCt: numWeightCt,
      weightG: numWeightG,
      unitCostRial: unitRial,
      totalCostManualRial: manualRial,
    });
  }, [valuationMethod, weightCt, weightG, unitCostToman, totalCostTomanManual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numWeightCt = parseWeight(weightCt);
    if (numWeightCt <= 0) {
      setError('لطفاً وزن سنگ را به قیراط یا گرم وارد فرمایید.');
      return;
    }

    if (certificateLab !== 'none' && !certificateReportNumber.trim()) {
      setError('با انتخاب آزمایشگاه شناسنامه، وارد کردن شماره گزارش شناسنامه الزامی است.');
      return;
    }

    const calculatedTotal = calculatedTotalCostRial;
    if (calculatedTotal < 0) {
      setError('مبلغ ارزش‌گذاری نمی‌تواند منفی باشد.');
      return;
    }

    const unitToman = parseFloat(unitCostToman) || 0;
    const unitRial = Math.round(unitToman * 10);

    const costPerCarat = valuationMethod === 'per_carat' ? unitRial : numWeightCt > 0 ? Math.round(calculatedTotal / numWeightCt) : 0;
    const numWeightG = parseWeight(weightG);
    const costPerGram = valuationMethod === 'per_gram' ? unitRial : numWeightG > 0 ? Math.round(calculatedTotal / numWeightG) : 0;

    const payload = {
      mode,
      category,
      species,
      variety: variety.trim() || undefined,
      itemName: itemName.trim() || undefined,
      diamondType: category === 'diamond' ? diamondType : undefined,
      colorMode: category === 'diamond' ? colorMode : undefined,
      colorGrade: category === 'diamond' && colorMode === 'd_z' ? colorGrade : undefined,
      fancyColorIntensity: category === 'diamond' && colorMode === 'fancy' ? fancyIntensity : undefined,
      fancyColorHue: category === 'diamond' && colorMode === 'fancy' ? fancyHue : undefined,
      fancyColorOvertone: category === 'diamond' && colorMode === 'fancy' ? fancyOvertone.trim() || undefined : undefined,
      fancyColorOrigin: category === 'diamond' && colorMode === 'fancy' ? fancyOrigin : undefined,
      clarityGrade: category === 'diamond' ? clarityGrade : undefined,
      cutGrade: category === 'diamond' ? cutGrade : undefined,
      polish: category === 'diamond' ? polish : undefined,
      symmetry: category === 'diamond' ? symmetry : undefined,
      fluorescence: category === 'diamond' ? fluorescence : undefined,
      fluorescenceColor: category === 'diamond' ? fluorescenceColor.trim() || undefined : undefined,

      colorHue: category === 'colored_gemstone' ? colorHue.trim() || undefined : undefined,
      tone: category === 'colored_gemstone' ? tone : undefined,
      saturation: category === 'colored_gemstone' ? saturation : undefined,
      transparency: category === 'colored_gemstone' ? transparency : undefined,
      clarityDescription: category === 'colored_gemstone' ? clarityDescription : undefined,
      treatments: category === 'colored_gemstone' ? treatments : undefined,
      treatmentDetails: category === 'colored_gemstone' ? treatmentDetails.trim() || undefined : undefined,
      origin: category === 'colored_gemstone' ? origin : undefined,
      originSource: category === 'colored_gemstone' ? originSource : undefined,

      shape,
      measurementsLength: measurementsLength ? parseFloat(measurementsLength) : undefined,
      measurementsWidth: measurementsWidth ? parseFloat(measurementsWidth) : undefined,
      measurementsDepth: measurementsDepth ? parseFloat(measurementsDepth) : undefined,
      tablePercentage: tablePercentage ? parseFloat(tablePercentage) : undefined,
      depthPercentage: depthPercentage ? parseFloat(depthPercentage) : undefined,

      certificateLab: certificateLab !== 'none' ? certificateLab : undefined,
      certificateReportNumber: certificateLab !== 'none' ? certificateReportNumber.trim() : undefined,
      certificateDate: certificateLab !== 'none' && certificateDate ? certificateDate : undefined,
      verificationStatus: certificateLab !== 'none' ? verificationStatus : 'not_checked',

      weightCt: numWeightCt,
      weightG: numWeightG,
      pieces: mode === 'parcel' ? Math.max(1, parseInt(pieces, 10) || 1) : 1,

      valuationMethod,
      costPerCarat: costPerCarat || undefined,
      costPerGram: costPerGram || undefined,
      totalCost: calculatedTotal,

      storageLocation: storageLocation.trim() || undefined,
      internalCode: internalCode.trim() || undefined,
      acquisitionDate: acquisitionDate || undefined,
      description: description.trim() || undefined,
    };

    setLoading(true);
    try {
      const res = await fetch('/api/accounting/opening/gemstones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در ثبت موجودی اول دوره سنگ');
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'خطای نامشخص در ثبت اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
              <Gem size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {editingItem ? 'ویرایش موجودی اول دوره سنگ' : 'ثبت موجودی اول دوره سنگ‌های قیمتی و الماس'}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                ثبت مشخصات گوهرشناسی، شناسنامه معتبر، وزن قیراط/گرم و بهای تمام‌شده دفتری (حساب ۱۱۳۰۵۰)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto p-6 text-xs">
            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mode & Category Controls */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Mode Toggle */}
              <div>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  نوع عرضه و نگهداری
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={() => setMode('single_stone')}
                    className={`rounded-xl py-2 text-xs font-bold transition-all ${
                      mode === 'single_stone'
                        ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-700 dark:text-cyan-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    تک سنگ (Single Stone)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('parcel')}
                    className={`rounded-xl py-2 text-xs font-bold transition-all ${
                      mode === 'parcel'
                        ? 'bg-white text-cyan-700 shadow-xs dark:bg-slate-700 dark:text-cyan-300'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    بسته‌ای / بار سنگ (Parcel)
                  </button>
                </div>
              </div>

              {/* Category / Species Selector */}
              <div>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  گونه / دسته‌بندی سنگ
                </label>
                <select
                  value={species}
                  onChange={(e) => handleSpeciesChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <optgroup label="خانواده الماس">
                    <option value="diamond">الماس (Diamond)</option>
                  </optgroup>
                  <optgroup label="سنگ‌های قیمتی و رنگی">
                    {GEMSTONE_SPECIES.filter((s) => s.id !== 'diamond').map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameFa} ({s.nameEn})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            {/* General Info Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  عنوان نمایشی سنگ
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="مثال: برلیان ۱ قیراطی تراش عالی"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  واریته / گونه تخصصی
                </label>
                <input
                  type="text"
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  placeholder="مثال: زمرد کلمبیا، یاقوت خون کبوتر..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700 dark:text-slate-300">
                  تراش و شکل هندسی
                </label>
                <select
                  value={shape}
                  onChange={(e) => setShape(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {GEMSTONE_SHAPES.map((sh) => (
                    <option key={sh.id} value={sh.id}>
                      {sh.nameFa} ({sh.nameEn})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* SPECIALIZED CONDITIONAL SECTION: DIAMOND 4CS VS COLORED GEMSTONES */}
            {category === 'diamond' ? (
              <div className="rounded-3xl border border-cyan-100 bg-cyan-50/30 p-4 space-y-4 dark:border-cyan-900/50 dark:bg-cyan-950/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-black text-cyan-950 dark:text-cyan-200">
                    <Sparkles size={16} className="text-cyan-600 dark:text-cyan-400" />
                    مشخصات تخصصی الماس (4Cs & Grading)
                  </span>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold">
                      <input
                        type="radio"
                        name="diamondType"
                        checked={diamondType === 'natural'}
                        onChange={() => setDiamondType('natural')}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      طبیعی (Natural)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-bold">
                      <input
                        type="radio"
                        name="diamondType"
                        checked={diamondType === 'lab_grown'}
                        onChange={() => setDiamondType('lab_grown')}
                        className="text-cyan-600 focus:ring-cyan-500"
                      />
                      آزمایشگاهی (Lab-Grown)
                    </label>
                  </div>
                </div>

                {/* Color Mode Selector */}
                <div className="flex items-center gap-4 border-t border-cyan-100/60 pt-3 dark:border-cyan-900/40">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">سیستم رنگ:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="colorMode"
                      checked={colorMode === 'd_z'}
                      onChange={() => setColorMode('d_z')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    طیف بی‌رنگ (D to Z)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="colorMode"
                      checked={colorMode === 'fancy'}
                      onChange={() => setColorMode('fancy')}
                      className="text-cyan-600 focus:ring-cyan-500"
                    />
                    الماس رنگی خاص (Fancy Color Diamond)
                  </label>
                </div>

                {/* Color & Clarity Controls */}
                {colorMode === 'd_z' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        درجه رنگ (Color)
                      </label>
                      <select
                        value={colorGrade}
                        onChange={(e) => setColorGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {D_Z_COLORS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        درجه پاکی (Clarity)
                      </label>
                      <select
                        value={clarityGrade}
                        onChange={(e) => setClarityGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {CLARITY_GRADES.map((cl) => (
                          <option key={cl} value={cl}>
                            {cl}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        کیفیت تراش (Cut Grade)
                      </label>
                      <select
                        value={cutGrade}
                        onChange={(e) => setCutGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {CUT_GRADES.map((ct) => (
                          <option key={ct.id} value={ct.id}>
                            {ct.nameFa}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        فلورسانس (Fluorescence)
                      </label>
                      <select
                        value={fluorescence}
                        onChange={(e) => setFluorescence(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {FLUORESCENCE_GRADES.map((fl) => (
                          <option key={fl.id} value={fl.id}>
                            {fl.nameFa}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        شدت رنگ (Intensity)
                      </label>
                      <select
                        value={fancyIntensity}
                        onChange={(e) => setFancyIntensity(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {FANCY_INTENSITIES.map((fi) => (
                          <option key={fi.id} value={fi.id}>
                            {fi.nameFa} ({fi.nameEn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        فام رنگی (Hue)
                      </label>
                      <select
                        value={fancyHue}
                        onChange={(e) => setFancyHue(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {COLORED_HUES.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nameFa} ({h.nameEn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        منشا رنگ (Color Origin)
                      </label>
                      <select
                        value={fancyOrigin}
                        onChange={(e) => setFancyOrigin(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {COLOR_ORIGINS.map((co) => (
                          <option key={co.id} value={co.id}>
                            {co.nameFa}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        درجه پاکی (Clarity)
                      </label>
                      <select
                        value={clarityGrade}
                        onChange={(e) => setClarityGrade(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {CLARITY_GRADES.map((cl) => (
                          <option key={cl} value={cl}>
                            {cl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Polish, Symmetry, Measurements */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-cyan-100/60 pt-3 dark:border-cyan-900/40">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      پولیش (Polish)
                    </label>
                    <select
                      value={polish}
                      onChange={(e) => setPolish(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {POLISH_SYMMETRY_GRADES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      تقارن (Symmetry)
                    </label>
                    <select
                      value={symmetry}
                      onChange={(e) => setSymmetry(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {POLISH_SYMMETRY_GRADES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      ابعاد (طول × عرض mm)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={measurementsLength}
                        onChange={(e) => setMeasurementsLength(e.target.value)}
                        placeholder="طول"
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                      <span>×</span>
                      <input
                        type="number"
                        step="0.01"
                        value={measurementsWidth}
                        onChange={(e) => setMeasurementsWidth(e.target.value)}
                        placeholder="عرض"
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      عمق (Depth mm)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={measurementsDepth}
                      onChange={(e) => setMeasurementsDepth(e.target.value)}
                      placeholder="عمق"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-purple-100 bg-purple-50/30 p-4 space-y-4 dark:border-purple-900/50 dark:bg-purple-950/10">
                <span className="flex items-center gap-1.5 text-xs font-black text-purple-950 dark:text-purple-200">
                  <Info size={16} className="text-purple-600 dark:text-purple-400" />
                  مشخصات تخصصی گوهرسنگ رنگی (Colored Gemstone Quality)
                </span>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      رنگ و فام (Hue)
                    </label>
                    <input
                      type="text"
                      value={colorHue}
                      onChange={(e) => setColorHue(e.target.value)}
                      placeholder="مثال: قرمز اناری، آبی مایل به سبز"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      شفافیت (Transparency)
                    </label>
                    <select
                      value={transparency}
                      onChange={(e) => setTransparency(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {TRANSPARENCIES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      بهسازی (Treatments)
                    </label>
                    <select
                      value={treatments}
                      onChange={(e) => setTreatments(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {GEMSTONE_TREATMENTS.map((tr) => (
                        <option key={tr.id} value={tr.id}>
                          {tr.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      مبدا جغرافیایی (Origin)
                    </label>
                    <select
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {ORIGIN_COUNTRIES.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-purple-100/60 pt-3 dark:border-purple-900/40">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      تن تیرگی/روشنی (Tone)
                    </label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {TONES.map((tn) => (
                        <option key={tn.id} value={tn.id}>
                          {tn.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      اشباع رنگ (Saturation)
                    </label>
                    <select
                      value={saturation}
                      onChange={(e) => setSaturation(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {SATURATIONS.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      مستند منشا مبدا (Origin Source)
                    </label>
                    <select
                      value={originSource}
                      onChange={(e) => setOriginSource(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {ORIGIN_SOURCES.map((os) => (
                        <option key={os.id} value={os.id}>
                          {os.nameFa}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      ابعاد گوهر (L × W mm)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.01"
                        value={measurementsLength}
                        onChange={(e) => setMeasurementsLength(e.target.value)}
                        placeholder="طول"
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                      <span>×</span>
                      <input
                        type="number"
                        step="0.01"
                        value={measurementsWidth}
                        onChange={(e) => setMeasurementsWidth(e.target.value)}
                        placeholder="عرض"
                        className="w-1/2 rounded-xl border border-slate-200 bg-white p-2 text-center text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weights & Pieces Section */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
              <span className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <Scale size={16} className="text-cyan-600 dark:text-cyan-400" />
                سنجش وزن و همگام‌سازی قیراط و گرم (1ct = 0.2g / 1g = 5ct)
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    وزن به قیراط (Carat - ct) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={weightCt}
                    onChange={(e) => handleCaratChange(e.target.value)}
                    placeholder="مثال: 1.25"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-black text-cyan-600 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    وزن معادل به گرم (Gram - g)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={weightG}
                    onChange={(e) => handleGramChange(e.target.value)}
                    placeholder="مثال: 0.2500"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>

                {mode === 'parcel' && (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      تعداد قطعات موجود در بسته (قطعه)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={pieces}
                      onChange={(e) => setPieces(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Certificate & Laboratory Dossier */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/30">
              <span className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                <Award size={16} className="text-amber-600 dark:text-amber-400" />
                مشخصات شناسنامه بین‌المللی و آزمایشگاه گوهرشناسی
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    آزمایشگاه صادرکننده
                  </label>
                  <select
                    value={certificateLab}
                    onChange={(e) => setCertificateLab(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="none">بدون شناسنامه / شناسنامه متفرقه</option>
                    {GEMSTONE_LABS.map((lb) => (
                      <option key={lb.id} value={lb.id}>
                        {lb.nameFa}
                      </option>
                    ))}
                  </select>
                </div>

                {certificateLab !== 'none' && (
                  <>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        شماره گزارش / Certificate No <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={certificateReportNumber}
                        onChange={(e) => setCertificateReportNumber(e.target.value)}
                        placeholder="مثال: 2476123456"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-cyan-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        required={certificateLab !== 'none'}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                        وضعیت استعلام اصالت
                      </label>
                      <select
                        value={verificationStatus}
                        onChange={(e) => setVerificationStatus(e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <option value="not_checked">استعلام نشده (Not Checked)</option>
                        <option value="verified">تایید شده توسط کارشناس / استعلام معتبر</option>
                        <option value="manual">تطبیق دستی فیزیکی</option>
                        <option value="unavailable">سامانه استعلام در دسترس نیست</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Valuation & Financials Section */}
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/30 p-4 space-y-4 dark:border-emerald-900/50 dark:bg-emerald-950/10">
              <span className="flex items-center gap-1.5 text-xs font-black text-emerald-950 dark:text-emerald-200">
                <Layers size={16} className="text-emerald-600 dark:text-emerald-400" />
                ارزش‌گذاری پایه و حسابداری (ثبت بدهکار سرفصل ۱۱۳۰۵۰ - سرمایه ۳۱۰۰)
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    مبنای محاسبه نرخ
                  </label>
                  <select
                    value={valuationMethod}
                    onChange={(e) => setValuationMethod(e.target.value as any)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <option value="per_carat">نرخ هر قیراط (تومان)</option>
                    <option value="per_gram">نرخ هر گرم (تومان)</option>
                    <option value="total_amount">مبلغ کل مقطوع (تومان)</option>
                  </select>
                </div>

                {valuationMethod !== 'total_amount' ? (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      {valuationMethod === 'per_carat' ? 'نرخ هر قیراط (تومان)' : 'نرخ هر گرم (تومان)'}
                    </label>
                    <input
                      type="number"
                      value={unitCostToman}
                      onChange={(e) => setUnitCostToman(e.target.value)}
                      placeholder="مثال: 45000000"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                      مبلغ کل دفتری (تومان)
                    </label>
                    <input
                      type="number"
                      value={totalCostTomanManual}
                      onChange={(e) => setTotalCostTomanManual(e.target.value)}
                      placeholder="مثال: 120000000"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono font-bold text-slate-800 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                    بهای تمام‌شده کل محاسبه‌شده
                  </label>
                  <div className="flex h-9 items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-100/50 px-3 font-mono text-xs font-black text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                    <span>{formatNumberWithCommas(convertRialToToman(calculatedTotalCostRial))}</span>
                    <span className="text-[10px] font-normal">تومان</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage, Code & Notes */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                  محل فیزیکی نگهداری
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="مثال: گاوصندوق ۱ - سینی الماس"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                  کد شناسایی داخلی (SKU / Code)
                </label>
                <input
                  type="text"
                  value={internalCode}
                  onChange={(e) => setInternalCode(e.target.value)}
                  placeholder="مثال: DIA-104"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                  تاریخ تملک / ورود به دوره
                </label>
                <input
                  type="text"
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block font-bold text-slate-700 dark:text-slate-300">
                  توضیحات تکمیلی و یادداشت کارشناسی
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="هرگونه اطلاعات تکمیلی گوهرشناسی یا توافقات..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-6 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-600 disabled:opacity-50"
            >
              {loading ? (
                <span>در حال ثبت...</span>
              ) : (
                <>
                  <Check size={16} />
                  <span>{editingItem ? 'ذخیره تغییرات' : 'ثبت موجودی اولیه سنگ'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
