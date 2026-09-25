'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Gem,
  Info,
  Layers,
  ListPlus,
  Package,
  RotateCcw,
  Scale,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';

import AmountRoundingModal from '@/features/accounting/documents/components/AmountRoundingModal';
import GemstoneShapeIcon from '@/features/gemstones/components/GemstoneShapeIcon';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import { PriceInput } from '@/components/ui/price-input';
import { NumberField } from '@/components/ui/number-field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import {
  caratsToGrams,
  formatCarat,
  formatGemGram,
  gramsToCarats,
} from '@/lib/gemstone-weight';
import {
  CLARITY_GRADES,
  CUT_GRADES,
  D_Z_COLORS,
  GEMSTONE_SHAPES,
  type GemstoneCategory,
  type GemstoneShapeItem,
} from '@/lib/gemstone';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';

export type StoneOperationKind =
  | 'entry' // ورود سنگ (تحویل فیزیکی)
  | 'purchase' // خرید سنگ (معامله با تسویه)
  | 'unsettled_purchase' // خرید سنگ بدون تسویه
  | 'exit' // خروج سنگ (تحویل فیزیکی)
  | 'sale' // فروش سنگ (معامله با تسویه)
  | 'unsettled_sale'; // فروش سنگ بدون تسویه

export interface StonePresetItem {
  id: string;
  nameFa: string;
  nameEn: string;
  category: GemstoneCategory;
  defaultShape?: string;
}

export const POPULAR_STONE_PRESETS: StonePresetItem[] = [
  // الماس
  { id: 'natural_diamond', nameFa: 'الماس طبیعی (برلیان)', nameEn: 'Natural Diamond', category: 'diamond', defaultShape: 'round' },
  { id: 'lab_diamond', nameFa: 'الماس آزمایشگاهی (Lab-Grown)', nameEn: 'Lab-Grown Diamond', category: 'diamond', defaultShape: 'round' },
  // سنگ‌های رنگی
  { id: 'corundum_ruby', nameFa: 'یاقوت سرخ (Ruby)', nameEn: 'Ruby', category: 'colored_gemstone', defaultShape: 'oval' },
  { id: 'corundum_sapphire', nameFa: 'یاقوت کبود (Sapphire)', nameEn: 'Sapphire', category: 'colored_gemstone', defaultShape: 'oval' },
  { id: 'beryl_emerald', nameFa: 'زمرد (Emerald)', nameEn: 'Emerald', category: 'colored_gemstone', defaultShape: 'emerald' },
  { id: 'turquoise', nameFa: 'فیروزه نیشابور (Turquoise)', nameEn: 'Turquoise', category: 'colored_gemstone', defaultShape: 'cabochon' },
  { id: 'spinel', nameFa: 'اسپینل / لعل (Spinel)', nameEn: 'Spinel', category: 'colored_gemstone', defaultShape: 'cushion' },
  { id: 'tanzanite', nameFa: 'تانزانیت (Tanzanite)', nameEn: 'Tanzanite', category: 'colored_gemstone', defaultShape: 'cushion' },
  { id: 'peridot', nameFa: 'زبرجد (Peridot)', nameEn: 'Peridot', category: 'colored_gemstone', defaultShape: 'oval' },
  { id: 'topaz', nameFa: 'توپاز (Topaz)', nameEn: 'Topaz', category: 'colored_gemstone', defaultShape: 'oval' },
  { id: 'tourmaline', nameFa: 'تورمالین (Tourmaline)', nameEn: 'Tourmaline', category: 'colored_gemstone', defaultShape: 'emerald' },
  { id: 'quartz_amethyst', nameFa: 'آمتیست (Amethyst)', nameEn: 'Amethyst', category: 'colored_gemstone', defaultShape: 'round' },
  { id: 'opal', nameFa: 'اوپال (Opal)', nameEn: 'Opal', category: 'colored_gemstone', defaultShape: 'cabochon' },
  { id: 'garnet', nameFa: 'گارنت (Garnet)', nameEn: 'Garnet', category: 'colored_gemstone', defaultShape: 'oval' },
  // سایر
  { id: 'pearl', nameFa: 'مروارید (Pearl)', nameEn: 'Pearl', category: 'other_gemstone', defaultShape: 'round' },
  { id: 'agate', nameFa: 'عقیق (Agate)', nameEn: 'Agate', category: 'other_gemstone', defaultShape: 'cabochon' },
  { id: 'cubic_zirconia', nameFa: 'نگین اتمی برلیان (CZ)', nameEn: 'Cubic Zirconia', category: 'other_gemstone', defaultShape: 'round' },
  { id: 'moissanite', nameFa: 'موزانایت (Moissanite)', nameEn: 'Moissanite', category: 'other_gemstone', defaultShape: 'round' },
  { id: 'other', nameFa: 'سایر گوهرها', nameEn: 'Other', category: 'other_gemstone', defaultShape: 'round' },
];

export const CERTIFICATE_LABS = [
  { id: 'none', label: 'بدون شناسنامه / غیر شرکتی' },
  { id: 'GIA', label: 'شناسنامه معتبر GIA' },
  { id: 'HRD', label: 'شناسنامه معتبر HRD' },
  { id: 'IGI', label: 'شناسنامه معتبر IGI' },
  { id: 'domestic', label: 'شناسنامه داخلی / ری‌گیری گوهر' },
];

type StoneTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCurrency?: string;
};

export default function StoneTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
  baseCurrency = 'IRR',
  selectedCurrency,
}: StoneTabProps) {
  const isReceived = nature === 'received';

  // Available operation modes based on document nature
  const availableOperations: { id: StoneOperationKind; label: string; desc: string }[] = useMemo(() => {
    if (isReceived) {
      return [
        { id: 'entry', label: 'ورود سنگ', desc: 'تحویل سنگ فیزیکی بدون اثر مالی' },
        { id: 'purchase', label: 'خرید سنگ', desc: 'خرید قطعی سنگ با تسویه آنی' },
        { id: 'unsettled_purchase', label: 'خرید سنگ (بدون تسویه)', desc: 'خرید اعتباری/دفتری بدون تسویه آنی' },
      ];
    }
    return [
      { id: 'exit', label: 'خروج سنگ', desc: 'تحویل سنگ فیزیکی بدون اثر مالی' },
      { id: 'sale', label: 'فروش سنگ', desc: 'فروش قطعی سنگ با تسویه آنی' },
      { id: 'unsettled_sale', label: 'فروش سنگ (بدون تسویه)', desc: 'فروش اعتباری/دفتری بدون تسویه آنی' },
    ];
  }, [isReceived]);

  // Current active operation
  const [currentOp, setCurrentOp] = useState<StoneOperationKind>(() => {
    const rawKind = draftLine.details.stoneOperationKind;
    if (rawKind && availableOperations.some((op) => op.id === rawKind)) {
      return rawKind;
    }
    return isReceived ? 'purchase' : 'sale';
  });

  // Keep operation in sync if nature changes
  useEffect(() => {
    if (isReceived) {
      if (currentOp === 'exit' || currentOp === 'sale' || currentOp === 'unsettled_sale') {
        setCurrentOp('purchase');
      }
    } else {
      if (currentOp === 'entry' || currentOp === 'purchase' || currentOp === 'unsettled_purchase') {
        setCurrentOp('sale');
      }
    }
  }, [isReceived, currentOp]);

  const isTrade =
    currentOp === 'purchase' ||
    currentOp === 'sale' ||
    currentOp === 'unsettled_purchase' ||
    currentOp === 'unsettled_sale';
  const isUnsettled = currentOp === 'unsettled_purchase' || currentOp === 'unsettled_sale';

  // Category and Species
  const [category, setCategory] = useState<GemstoneCategory>(
    (draftLine.details.stoneCategory as GemstoneCategory) || 'diamond',
  );
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>(
    draftLine.details.stoneSpecies || (category === 'diamond' ? 'natural_diamond' : 'corundum_ruby'),
  );

  // Filter presets by active category
  const filteredPresets = useMemo(() => {
    return POPULAR_STONE_PRESETS.filter((p) => p.category === category);
  }, [category]);

  const activePreset = useMemo(() => {
    return POPULAR_STONE_PRESETS.find((p) => p.id === selectedSpeciesId) || filteredPresets[0] || POPULAR_STONE_PRESETS[0];
  }, [selectedSpeciesId, filteredPresets]);

  // Inventory form mode: Single stone vs Parcel
  const [stoneMode, setStoneMode] = useState<'single_stone' | 'parcel'>(
    draftLine.details.stoneMode || 'single_stone',
  );

  // Shape
  const [shape, setShape] = useState<string>(
    draftLine.details.stoneShape || activePreset?.defaultShape || 'round',
  );

  // Pieces & Weights
  const [pieces, setPieces] = useState<string>(
    draftLine.details.stonePieces || (stoneMode === 'single_stone' ? '1' : '10'),
  );
  const [carats, setCarats] = useState<string>(draftLine.details.stoneCarats || '');
  const [grams, setGrams] = useState<string>(draftLine.details.stoneGrams || '');

  // Qualitative parameters
  const [colorGrade, setColorGrade] = useState<string>(draftLine.details.stoneColor || 'G');
  const [clarityGrade, setClarityGrade] = useState<string>(draftLine.details.stoneClarity || 'VS1');
  const [cutGrade, setCutGrade] = useState<string>(draftLine.details.stoneCut || 'Excellent');
  const [certificateLab, setCertificateLab] = useState<string>(draftLine.details.stoneCertificateLab || 'none');
  const [certificateNumber, setCertificateNumber] = useState<string>(draftLine.details.stoneCertificateNumber || '');

  // Pricing & Valuation
  const [valuationMethod, setValuationMethod] = useState<'per_carat' | 'per_piece' | 'total_sum'>(
    draftLine.details.stoneValuationMethod || 'per_carat',
  );
  const [unitPrice, setUnitPrice] = useState<string>(draftLine.details.stoneUnitPrice || '');
  const [totalAmount, setTotalAmount] = useState<string>(
    draftLine.details.stoneTotalAmount || draftLine.details.totalAmount || '',
  );

  // Description
  const [description, setDescription] = useState<string>(draftLine.description || '');

  // Rounding modal state
  const [roundingModalOpen, setRoundingModalOpen] = useState(false);
  const [roundingDigits, setRoundingDigits] = useState<number>(draftLine.details.roundingDigits ?? 3);
  const [roundingMode, setRoundingMode] = useState<'round' | 'ceil' | 'floor'>(
    draftLine.details.roundingMode ?? 'round',
  );
  const [roundingEnabled, setRoundingEnabled] = useState<boolean>(Boolean(draftLine.details.isAmountRounded));
  const [autoApplyRounding, setAutoApplyRounding] = useState<boolean>(false);

  const currencySuffix = selectedCurrency || (baseCurrency === 'IRT' ? 'تومان' : 'ریال');

  // Sync species change with category
  const handleCategoryChange = (newCat: GemstoneCategory) => {
    setCategory(newCat);
    const presets = POPULAR_STONE_PRESETS.filter((p) => p.category === newCat);
    if (presets.length > 0) {
      setSelectedSpeciesId(presets[0].id);
      if (presets[0].defaultShape) {
        setShape(presets[0].defaultShape);
      }
    }
  };

  // Convert weights seamlessly
  const handleCaratsChange = (val: string) => {
    const rawVal = normalizeDigits(val);
    setCarats(rawVal);
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      const g = (num * 0.2).toFixed(3);
      setGrams(g);
      if (valuationMethod === 'per_carat') {
        const up = parseLocalizedAmount(unitPrice);
        if (up > 0) {
          const tot = Math.round(num * up);
          setTotalAmount(String(tot));
        }
      }
    } else {
      setGrams('');
      if (valuationMethod === 'per_carat') setTotalAmount('');
    }
  };

  const handleGramsChange = (val: string) => {
    const rawVal = normalizeDigits(val);
    setGrams(rawVal);
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      const ct = (num / 0.2).toFixed(2);
      setCarats(ct);
      if (valuationMethod === 'per_carat') {
        const up = parseLocalizedAmount(unitPrice);
        if (up > 0) {
          const tot = Math.round(parseFloat(ct) * up);
          setTotalAmount(String(tot));
        }
      }
    } else {
      setCarats('');
      if (valuationMethod === 'per_carat') setTotalAmount('');
    }
  };

  const handlePiecesChange = (val: string) => {
    const rawVal = normalizeDigits(val);
    setPieces(rawVal);
    const pNum = parseInt(rawVal, 10);
    if (valuationMethod === 'per_piece' && !isNaN(pNum) && pNum > 0) {
      const up = parseLocalizedAmount(unitPrice);
      if (up > 0) {
        setTotalAmount(String(pNum * up));
      }
    }
  };

  // Recalculate total amount when unit price changes
  const handleUnitPriceChange = (rawVal: string) => {
    setUnitPrice(rawVal);
    const up = parseLocalizedAmount(rawVal);
    if (valuationMethod === 'per_carat') {
      const ct = parseFloat(normalizeDigits(carats));
      if (!isNaN(ct) && ct > 0 && up > 0) {
        setTotalAmount(String(Math.round(ct * up)));
      }
    } else if (valuationMethod === 'per_piece') {
      const p = parseInt(normalizeDigits(pieces), 10);
      if (!isNaN(p) && p > 0 && up > 0) {
        setTotalAmount(String(p * up));
      }
    }
  };

  // Recalculate unit price when total amount changes directly
  const handleTotalAmountChange = (val: string) => {
    setTotalAmount(val);
    const tot = parseLocalizedAmount(val);
    if (valuationMethod === 'per_carat') {
      const ct = parseFloat(normalizeDigits(carats));
      if (!isNaN(ct) && ct > 0 && tot > 0) {
        setUnitPrice(String(Math.round(tot / ct)));
      }
    } else if (valuationMethod === 'per_piece') {
      const p = parseInt(normalizeDigits(pieces), 10);
      if (!isNaN(p) && p > 0 && tot > 0) {
        setUnitPrice(String(Math.round(tot / p)));
      }
    }
  };

  // Switch valuation method
  const handleValuationMethodChange = (method: 'per_carat' | 'per_piece' | 'total_sum') => {
    setValuationMethod(method);
    const up = parseLocalizedAmount(unitPrice);
    if (method === 'per_carat') {
      const ct = parseFloat(normalizeDigits(carats));
      if (!isNaN(ct) && ct > 0 && up > 0) {
        setTotalAmount(String(Math.round(ct * up)));
      }
    } else if (method === 'per_piece') {
      const p = parseInt(normalizeDigits(pieces), 10) || 1;
      if (p > 0 && up > 0) {
        setTotalAmount(String(p * up));
      }
    }
  };

  // Build document type label
  const opLabel = useMemo(() => {
    const match = availableOperations.find((o) => o.id === currentOp);
    return match ? match.label : (isReceived ? 'ورود سنگ' : 'خروج سنگ');
  }, [availableOperations, currentOp]);

  // Keep parent draftLine continuously synchronized
  useEffect(() => {
    const shapeItem = GEMSTONE_SHAPES.find((s) => s.id === shape);
    const shapeName = shapeItem ? shapeItem.nameFa : shape;
    const speciesName = activePreset?.nameFa || selectedSpeciesId;

    const subType =
      currentOp === 'entry'
        ? 'stone-entry'
        : currentOp === 'exit'
        ? 'stone-exit'
        : currentOp === 'unsettled_purchase'
        ? 'stone-unsettled-purchase'
        : currentOp === 'unsettled_sale'
        ? 'stone-unsettled-sale'
        : currentOp === 'purchase'
        ? 'stone-purchase'
        : 'stone-sale';

    setDraftLine((curr) => ({
      ...curr,
      documentTab: 'stone',
      sourceTab: 'stone',
      documentNature: nature,
      documentSubType: subType,
      documentTypeLabel: opLabel,
      settlementMethod: isUnsettled ? 'unsettled' : isTrade ? 'cash' : 'weight',
      description: description || curr.description,
      details: {
        ...curr.details,
        stoneOperationKind: currentOp,
        stoneCategory: category,
        stoneSpecies: selectedSpeciesId,
        stoneSpeciesName: speciesName,
        stoneShape: shape,
        stoneShapeName: shapeName,
        stoneMode: stoneMode,
        stonePieces: stoneMode === 'single_stone' ? '1' : pieces,
        stoneCarats: carats,
        stoneGrams: grams,
        stoneValuationMethod: valuationMethod,
        stoneUnitPrice: isTrade ? unitPrice : '0',
        stoneTotalAmount: isTrade ? totalAmount : '0',
        totalAmount: isTrade ? totalAmount : '0',
        stoneColor: category === 'diamond' ? colorGrade : '',
        stoneClarity: category === 'diamond' ? clarityGrade : '',
        stoneCut: category === 'diamond' ? cutGrade : '',
        stoneCertificateLab: certificateLab !== 'none' ? certificateLab : '',
        stoneCertificateNumber: certificateLab !== 'none' ? certificateNumber : '',
        unsettledTrade: isUnsettled,
        isAmountRounded: roundingEnabled,
        roundingDigits,
        roundingMode,
      },
    }));
  }, [
    nature,
    currentOp,
    opLabel,
    isTrade,
    isUnsettled,
    category,
    selectedSpeciesId,
    activePreset,
    stoneMode,
    shape,
    pieces,
    carats,
    grams,
    valuationMethod,
    unitPrice,
    totalAmount,
    colorGrade,
    clarityGrade,
    cutGrade,
    certificateLab,
    certificateNumber,
    description,
    roundingEnabled,
    roundingDigits,
    roundingMode,
    setDraftLine,
  ]);

  const handleCommit = () => {
    if (!commitDraftLine) return;
    commitDraftLine();

    // Reset weights & pricing for convenient next row entry while keeping category/species
    setCarats('');
    setGrams('');
    if (stoneMode === 'single_stone') {
      setPieces('1');
    }
    setTotalAmount('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (handleKeyDownEnter) {
        handleKeyDownEnter(e);
      }
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* 1. Header & Operation Kind Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="document-operation-title m-0">
          <div className="flex items-center gap-2">
            <Sparkles className={isReceived ? 'text-emerald-600' : 'text-rose-600'} size={20} />
            <h3 className="text-xs font-black">{opLabel}</h3>
          </div>
          <span className={`document-nature-badge ${nature}`}>
            {isReceived ? 'سند دریافتی' : 'سند پرداختی'}
          </span>
        </div>

        {/* Operation Mode Buttons */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
          {availableOperations.map((op) => {
            const isSelected = currentOp === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setCurrentOp(op.id)}
                title={op.desc}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? isReceived
                      ? 'bg-emerald-500 text-white shadow-sm font-black'
                      : 'bg-rose-500 text-white shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {op.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Parameters Card */}
      <div className="p-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50 space-y-4 shadow-xs">
        {/* Row 1: Category, Species & Inventory Form */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Category */}
          <Field label="دسته‌بندی گوهر *">
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as GemstoneCategory)}
              className="h-10 text-xs font-bold w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="diamond">الماس و برلیان (Diamond)</option>
              <option value="colored_gemstone">سنگ‌های رنگی (Colored Gems)</option>
              <option value="other_gemstone">سایر گوهرها (مروارید، عقیق و...)</option>
            </select>
          </Field>

          {/* Species */}
          <Field label="نوع گوهر / سنگ *">
            <select
              value={selectedSpeciesId}
              onChange={(e) => {
                setSelectedSpeciesId(e.target.value);
                const found = POPULAR_STONE_PRESETS.find((p) => p.id === e.target.value);
                if (found?.defaultShape) {
                  setShape(found.defaultShape);
                }
              }}
              className="h-10 text-xs font-bold w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
            >
              {filteredPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.nameFa}
                </option>
              ))}
            </select>
          </Field>

          {/* Single vs Parcel Mode */}
          <Field label="حالت موجودی سنگ">
            <div className="grid grid-cols-2 gap-1 h-10 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setStoneMode('single_stone');
                  setPieces('1');
                }}
                className={`flex items-center justify-center gap-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  stoneMode === 'single_stone'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Gem size={13} />
                <span>تک‌سنگ</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStoneMode('parcel');
                  if (!pieces || pieces === '1') setPieces('10');
                }}
                className={`flex items-center justify-center gap-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  stoneMode === 'parcel'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Layers size={13} />
                <span>بسته / بارخانه</span>
              </button>
            </div>
          </Field>

          {/* Shape Selector */}
          <Field label="تراش / شکل هندسی *">
            <div className="relative">
              <select
                value={shape}
                onChange={(e) => setShape(e.target.value)}
                className="h-10 text-xs font-bold w-full rounded-xl border border-slate-200 bg-white px-3 pe-8 dark:border-slate-700 dark:bg-slate-800"
              >
                {GEMSTONE_SHAPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameFa}
                  </option>
                ))}
              </select>
              <div className="absolute left-2.5 top-2.5 pointer-events-none text-cyan-600 dark:text-cyan-400">
                <GemstoneShapeIcon shapeCode={shape} size={18} />
              </div>
            </div>
          </Field>
        </div>

        {/* Row 2: Pieces, Carats and Grams */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80">
          {/* Pieces */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
              تعداد (عدد / دانه) *
            </label>
            <NumberField
              value={pieces}
              onChange={handlePiecesChange}
              onKeyDown={onKeyDown}
              placeholder="۱"
              disabled={stoneMode === 'single_stone'}
              min={1}
            />
          </div>

          {/* Carat Weight */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center justify-between">
              <span>وزن کل (قیراط) *</span>
              <span className="text-[10px] text-amber-600 font-mono">Ct</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={carats}
              onChange={(e) => handleCaratsChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="مثال: ۲.۵۰"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Gram Equivalent */}
          <div>
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1 flex items-center justify-between">
              <span>معادل وزنی (گرم)</span>
              <span className="text-[10px] text-slate-500 font-mono">۱ قیراط = ۰.۲ گرم</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={grams}
              onChange={(e) => handleGramsChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="مثال: ۰.۵۰۰"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Optional Characteristics (Color / Clarity / Certificate) */}
        <details className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 text-xs">
          <summary className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer font-bold text-slate-700 dark:text-slate-300 select-none">
            <span className="flex items-center gap-2">
              <Award size={15} className="text-amber-500" />
              <span>مشخصات شناسنامه، رنگ و درجه پاکی گوهر (اختیاری)</span>
            </span>
            <ChevronDown size={14} className="transition-transform group-open:rotate-180 text-slate-400" />
          </summary>
          <div className="p-3.5 pt-0 border-t border-slate-200/60 dark:border-slate-800/60 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-2">
            {category === 'diamond' ? (
              <>
                <Field label="درجه رنگ (Color Grade)">
                  <select
                    value={colorGrade}
                    onChange={(e) => setColorGrade(e.target.value)}
                    className="h-9 text-xs font-bold rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {D_Z_COLORS.map((c) => (
                      <option key={c} value={c}>
                        رنگ {c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="درجه پاکی (Clarity)">
                  <select
                    value={clarityGrade}
                    onChange={(e) => setClarityGrade(e.target.value)}
                    className="h-9 text-xs font-bold rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {CLARITY_GRADES.map((cl) => (
                      <option key={cl} value={cl}>
                        {cl}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="کیفیت تراش (Cut)">
                  <select
                    value={cutGrade}
                    onChange={(e) => setCutGrade(e.target.value)}
                    className="h-9 text-xs font-bold rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-800"
                  >
                    {CUT_GRADES.map((cg) => (
                      <option key={cg.id} value={cg.nameEn}>
                        {cg.nameFa} ({cg.nameEn})
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : null}

            <Field label="آزمایشگاه / شناسنامه">
              <select
                value={certificateLab}
                onChange={(e) => setCertificateLab(e.target.value)}
                className="h-9 text-xs font-bold rounded-lg border border-slate-200 bg-white px-2 dark:border-slate-700 dark:bg-slate-800"
              >
                {CERTIFICATE_LABS.map((lab) => (
                  <option key={lab.id} value={lab.id}>
                    {lab.label}
                  </option>
                ))}
              </select>
            </Field>

            {certificateLab !== 'none' && (
              <Field label="شماره شناسنامه / Report No">
                <input
                  type="text"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                  placeholder="مثال: GIA-214589632"
                  className="h-9 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white px-2.5 dark:border-slate-700 dark:bg-slate-800"
                />
              </Field>
            )}
          </div>
        </details>

        {/* 3. Valuation & Pricing (Only if trade operation: purchase, sale, unsettled) */}
        {isTrade && (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/15 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/60 dark:border-amber-800/40 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <Calculator size={15} className="text-amber-600" />
                <span>محاسبه و قیمت‌گذاری معامله سنگ</span>
              </div>

              {/* Valuation Method Switcher */}
              <div className="inline-flex rounded-lg bg-amber-100/80 p-0.5 dark:bg-amber-900/40 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => handleValuationMethodChange('per_carat')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    valuationMethod === 'per_carat'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-amber-900 dark:text-amber-200 hover:text-amber-950'
                  }`}
                >
                  فی هر قیراط
                </button>
                <button
                  type="button"
                  onClick={() => handleValuationMethodChange('per_piece')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    valuationMethod === 'per_piece'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-amber-900 dark:text-amber-200 hover:text-amber-950'
                  }`}
                >
                  فی هر عدد (دانه)
                </button>
                <button
                  type="button"
                  onClick={() => handleValuationMethodChange('total_sum')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    valuationMethod === 'total_sum'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-amber-900 dark:text-amber-200 hover:text-amber-950'
                  }`}
                >
                  مبلغ کل مقطوع
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Unit Price */}
              {valuationMethod !== 'total_sum' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {valuationMethod === 'per_carat' ? `قیمت هر قیراط (${currencySuffix}) *` : `قیمت هر دانه (${currencySuffix}) *`}
                  </label>
                  <PriceInput
                    value={unitPrice}
                    onValueChange={(_parsed, rawVal) => handleUnitPriceChange(rawVal)}
                    baseCurrency={baseCurrency}
                    currencySuffix={currencySuffix}
                    placeholder="۰"
                    showWords
                  />
                </div>
              )}

              {/* Total Amount */}
              <div className={valuationMethod === 'total_sum' ? 'sm:col-span-2' : ''}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    مبلغ کل معامله ({currencySuffix}) *
                  </label>

                  {/* Rounding button */}
                  <button
                    type="button"
                    onClick={() => setRoundingModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    <RotateCcw size={11} />
                    <span>گرد کردن مبلغ</span>
                  </button>
                </div>
                <MoneyInputField
                  label=""
                  value={totalAmount}
                  onChange={handleTotalAmountChange}
                  baseCurrency={baseCurrency}
                  currencySuffix={currencySuffix}
                  onKeyDown={onKeyDown}
                  showWords
                />
              </div>
            </div>

            {/* Unsettled Notice Badge */}
            {isUnsettled && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold">
                <Info size={16} className="shrink-0 text-amber-600" />
                <span>
                  {isReceived
                    ? 'این معامله به صورت خرید بدون تسویه ثبت می‌شود و مبلغ آن به عنوان طلب مشتری (بدهی ما) در حساب منظور خواهد شد.'
                    : 'این معامله به صورت فروش بدون تسویه ثبت می‌شود و مبلغ آن به عنوان بدهی مشتری (طلب ما) در حساب منظور خواهد شد.'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4. Description Field */}
        <Field label="شرح / بابت ردیف سنگ" wide>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="توضیحات تکمیلی بابت گوهر، سفارش، سایز یا مشخصات..."
            rows={2}
          />
        </Field>
      </div>

      {/* 5. Sticky Commit Line Button */}
      {commitDraftLine && draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm cursor-pointer"
            onClick={handleCommit}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف سنگ' : 'ثبت ردیف سنگ'}
          </button>
        </div>
      ) : null}

      {/* Modal for Rounding */}
      <AmountRoundingModal
        isOpen={roundingModalOpen}
        onClose={() => setRoundingModalOpen(false)}
        rawAmount={parseLocalizedAmount(totalAmount)}
        currencySuffix={currencySuffix}
        contextType="general"
        roundingDigits={roundingDigits}
        roundingMode={roundingMode}
        roundingEnabled={roundingEnabled}
        autoApplyRounding={autoApplyRounding}
        onApply={({ digits, mode: rMode, enabled, autoApply }) => {
          setRoundingDigits(digits);
          setRoundingMode(rMode);
          setRoundingEnabled(enabled);
          setAutoApplyRounding(autoApply);
          if (enabled) {
            const raw = parseLocalizedAmount(totalAmount);
            const factor = Math.pow(10, digits);
            let rounded = raw;
            if (rMode === 'round') rounded = Math.round(raw / factor) * factor;
            else if (rMode === 'ceil') rounded = Math.ceil(raw / factor) * factor;
            else if (rMode === 'floor') rounded = Math.floor(raw / factor) * factor;
            setTotalAmount(String(rounded));
          }
        }}
      />
    </div>
  );
}
