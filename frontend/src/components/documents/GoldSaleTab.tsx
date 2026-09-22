'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical, ListPlus, Sparkles, Settings } from 'lucide-react';
import type React from 'react';
import { useEffect, useState, useMemo } from 'react';

import DocumentOperationTypeSelector from '@/src/components/documents/DocumentOperationTypeSelector';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import SlidingToggle from '@/src/components/documents/SlidingToggle';
import { AssayLaboratorySelect } from '@/components/AssayLaboratorySelect';
import { useAppSettings } from '@/src/components/SettingsProvider';
import AmountRoundingModal from '@/features/accounting/documents/components/AmountRoundingModal';
import MetalInventoryPicker from '@/src/components/documents/MetalInventoryPicker';
import { useToastManager } from '@/components/ui/toast';
import {
  getInventoryItemAvailability,
  type DetailState,
  type DocumentLine,
  type MeltedInventoryItem,
  type RawOperationKind,
} from '@/src/components/documents/RawGoldTab';
import {
  convertPricesFromGram18,
  convertPricesFromMesghal17,
  convertPricesFromOunceUsd,
  parseNumericValue,
  roundAmountToDigits,
} from '@/src/lib/trade-utils';

type GoldSaleTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  weightPrecision: number;
  meltedInventory: MeltedInventoryItem[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  changeRawKind: (kind: RawOperationKind) => void;
  updateMetalValue: (
    field: 'rawWeight' | 'purity' | 'calculationMethod' | 'metalPriceType' | 'metalPrice' | 'totalAmount',
    value: string,
  ) => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady: boolean;
  baseKarat?: number;
  convertedTo750: (weight: string, purity: string) => number;
  convertedWeightFromTotal: (total: string, type: DetailState['metalPriceType'], price: string) => number;
  actualWeightFromMoney: (details: Pick<DetailState, 'totalAmount' | 'purity' | 'metalPriceType' | 'metalPrice' | 'metalType'>) => number;
  rawOperationLabel: (nature: 'received' | 'paid', kind: RawOperationKind) => string;
  metalPriceLabel?: (type: DetailState['metalPriceType']) => string;
  toPersianDigits: (str: string) => string;
  faNumber: (value: number, fractionDigits?: number) => string;
  numberValue: (value: string) => number;
  errors?: { labName?: string; stampNumber?: string };
  labInputRef?: React.RefObject<HTMLInputElement | null>;
  stampInputRef?: React.RefObject<HTMLInputElement | null>;
  commitRowLabel?: string;
};

export default function GoldSaleTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  weightPrecision,
  meltedInventory,
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  changeRawKind,
  updateMetalValue,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  baseKarat = 750,
  convertedTo750,
  convertedWeightFromTotal,
  actualWeightFromMoney,
  rawOperationLabel,
  metalPriceLabel,
  toPersianDigits,
  faNumber,
  numberValue,
  errors = {},
  labInputRef,
  stampInputRef,
  commitRowLabel,
}: GoldSaleTabProps) {
  const { settings } = useAppSettings();
  const baseCurrency = settings.baseCurrency || 'IRR';

  const toast = useToastManager();
  const [isRoundingModalOpen, setIsRoundingModalOpen] = useState(false);
  const [roundingDigits, setRoundingDigits] = useState<number>(3);
  const [roundingMode, setRoundingMode] = useState<'round' | 'ceil' | 'floor'>('round');
  const [autoApplyRounding, setAutoApplyRounding] = useState<boolean>(false);
  const [lastRoundedAmount, setLastRoundedAmount] = useState<number | null>(null);

  // Load saved preference from API & localStorage
  useEffect(() => {
    let isMounted = true;

    // Fast initial load from localStorage
    try {
      const saved = localStorage.getItem('zarfolio_gold_sale_rounding');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.digits === 'number') setRoundingDigits(Math.min(4, Math.max(1, parsed.digits)));
        if (parsed.mode === 'round' || parsed.mode === 'ceil' || parsed.mode === 'floor') setRoundingMode(parsed.mode);
        if (typeof parsed.autoApply === 'boolean') setAutoApplyRounding(parsed.autoApply);
      }
    } catch {
      // ignore
    }

    // Authoritative fetch from server user preferences
    fetch('/api/account/preferences')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.preferences?.goldSaleRounding) return;
        const gsr = data.preferences.goldSaleRounding;
        if (typeof gsr.digits === 'number') setRoundingDigits(Math.min(4, Math.max(1, gsr.digits)));
        if (gsr.mode === 'round' || gsr.mode === 'ceil' || gsr.mode === 'floor') setRoundingMode(gsr.mode);
        if (typeof gsr.autoApply === 'boolean') setAutoApplyRounding(gsr.autoApply);
        try {
          localStorage.setItem('zarfolio_gold_sale_rounding', JSON.stringify(gsr));
        } catch {}
      })
      .catch(() => {
        // ignore network error, already loaded localStorage
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isGold = draftLine.details.metalType === 'gold';
  const isMoltenOrConditional = draftLine.details.rawKind === 'molten' || draftLine.details.rawKind === 'conditional';
  const isMisc = draftLine.details.rawKind === 'misc';

  const isWeightMode = draftLine.details.calculationMethod === 'weight';
  const calculatedWeight = !isWeightMode
    ? actualWeightFromMoney(draftLine.details)
    : numberValue(draftLine.details.rawWeight);

  // Exact unrounded total calculated from weight formula
  const exactCalculatedAmount = useMemo(() => {
    if (!isWeightMode) return parseNumericValue(draftLine.details.totalAmount);
    const weight = draftLine.details.rawWeight;
    const purity = draftLine.details.purity;
    const price = draftLine.details.metalPrice;
    const type = draftLine.details.metalPriceType;
    const pVal = numberValue(price);
    if (!weight || pVal <= 0) return 0;
    const baseKaratVal = baseKarat || 750;
    const c750 = convertedTo750(weight, purity);
    let perGram = pVal;
    if (type === 'mesghal17') perGram = pVal / 4.3318;
    else if (type === 'ounceUsd') perGram = pVal / 31.1035;
    else if (type === 'gramSilver925') perGram = pVal * (baseKaratVal / 925);
    else if (type === 'gramSilver995') perGram = pVal * (baseKaratVal / 995);
    else if (type === 'gramSilver999') perGram = pVal * (baseKaratVal / 999);
    return Math.round(c750 * perGram);
  }, [isWeightMode, draftLine.details.rawWeight, draftLine.details.purity, draftLine.details.metalPrice, draftLine.details.metalPriceType, baseKarat, convertedTo750, numberValue]);

  const currentAmountNum = parseNumericValue(draftLine.details.totalAmount);
  const isAmountRounded =
    currentAmountNum > 0 &&
    ((exactCalculatedAmount > 0 && currentAmountNum !== exactCalculatedAmount) ||
      (lastRoundedAmount !== null && currentAmountNum === lastRoundedAmount));

  const handleApplyRounding = (
    roundedAmount: number,
    digits: number,
    mode: 'round' | 'ceil' | 'floor',
    autoApply: boolean,
  ) => {
    setRoundingDigits(digits);
    setRoundingMode(mode);
    setAutoApplyRounding(autoApply);
    setLastRoundedAmount(roundedAmount);

    try {
      localStorage.setItem(
        'zarfolio_gold_sale_rounding',
        JSON.stringify({ digits, mode, autoApply }),
      );
    } catch {
      // ignore
    }

    // Sync to user preferences endpoint
    fetch('/api/account/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goldSaleRounding: { digits, mode, autoApply },
      }),
    }).catch(() => {
      // ignore network error
    });

    const diff = exactCalculatedAmount > 0 ? (roundedAmount - exactCalculatedAmount) : 0;
    setDraftLine((current) => ({
      ...current,
      details: {
        ...current.details,
        totalAmount: String(roundedAmount),
        roundingDifference: diff,
        exactCalculatedAmount,
        isAmountRounded: diff !== 0,
        roundingDigits: digits,
        roundingMode: mode,
      },
    }));
    toast.success(`مبلغ کل به ${digits} رقم رند گردید.`);
  };

  const handleResetRounding = () => {
    if (exactCalculatedAmount > 0) {
      setLastRoundedAmount(null);
      setDraftLine((current) => ({
        ...current,
        details: {
          ...current.details,
          totalAmount: String(exactCalculatedAmount),
          roundingDifference: 0,
          exactCalculatedAmount,
          isAmountRounded: false,
        },
      }));
      toast.info('مبلغ به فرمول دقیق محاسباتی بازگردانی شد.');
    }
  };

  // Auto-round when weight or price changes if autoApplyRounding is enabled
  useEffect(() => {
    if (!autoApplyRounding || !isWeightMode) return;
    if (exactCalculatedAmount <= 0) return;
    const rounded = roundAmountToDigits(exactCalculatedAmount, roundingDigits, roundingMode);
    if (rounded > 0 && String(rounded) !== draftLine.details.totalAmount) {
      const diff = rounded - exactCalculatedAmount;
      setDraftLine((current) => ({
        ...current,
        details: {
          ...current.details,
          totalAmount: String(rounded),
          roundingDifference: diff,
          exactCalculatedAmount,
          isAmountRounded: diff !== 0,
          roundingDigits,
          roundingMode,
        },
      }));
      setLastRoundedAmount(rounded);
    }
  }, [
    exactCalculatedAmount,
    autoApplyRounding,
    isWeightMode,
    roundingDigits,
    roundingMode,
    draftLine.details.totalAmount,
    setDraftLine,
  ]);

  // Keep rounding details synchronized when totalAmount or exact amount changes
  useEffect(() => {
    if (!isWeightMode) return;
    if (exactCalculatedAmount <= 0) return;
    const currentNum = parseNumericValue(draftLine.details.totalAmount);
    if (currentNum > 0) {
      const diff = currentNum - exactCalculatedAmount;
      if (
        draftLine.details.roundingDifference !== diff ||
        draftLine.details.exactCalculatedAmount !== exactCalculatedAmount ||
        draftLine.details.isAmountRounded !== (diff !== 0)
      ) {
        setDraftLine((current) => ({
          ...current,
          details: {
            ...current.details,
            roundingDifference: diff,
            exactCalculatedAmount,
            isAmountRounded: diff !== 0,
          },
        }));
      }
    }
  }, [exactCalculatedAmount, isWeightMode, draftLine.details.totalAmount, draftLine.details.roundingDifference, draftLine.details.exactCalculatedAmount, draftLine.details.isAmountRounded, setDraftLine]);

  const isAssayRequired = isGold && isMoltenOrConditional && calculatedWeight > 0;
  const isPriceRequired = isWeightMode ? parseNumericValue(draftLine.details.rawWeight) > 0 : true;
  const isPaidRawFromInventory = nature === 'paid' && Boolean(draftLine.details.inventorySourceId);

  const inventoryLabel = draftLine.details.rawKind === 'conditional'
    ? 'موجودی شرطی'
    : draftLine.details.rawKind === 'misc'
      ? 'موجودی متفرقه'
      : draftLine.details.rawKind === 'question'
        ? 'موجودی سواله'
        : 'موجودی آبشده';

  const inventoryPlaceholder = draftLine.details.rawKind === 'conditional'
    ? 'انتخاب از موجودی شرطی صندوق...'
    : draftLine.details.rawKind === 'misc'
      ? 'انتخاب از موجودی متفرقه صندوق...'
      : draftLine.details.rawKind === 'question'
        ? 'انتخاب از موجودی سواله صندوق...'
        : 'انتخاب از موجودی آبشده صندوق...';

  // Keep assay lab, purity, and stamp number in sync with the selected lot
  useEffect(() => {
    if (nature !== 'paid') return;
    if (!draftLine.details.inventorySourceId) return;

    const source = meltedInventory.find((item) => item.id === draftLine.details.inventorySourceId);
    if (!source) return;

    const targetLabName = (source.labName ?? '').trim();
    const targetPurity = String(source.purity || 750);
    const targetStamp = (source.stampNumber ?? '').trim();
    const needLabUpdate = draftLine.details.labName !== targetLabName;
    const needPurityUpdate = draftLine.details.purity !== targetPurity;
    const needStampUpdate = draftLine.details.stampNumber !== targetStamp;

    if (needLabUpdate || needPurityUpdate || needStampUpdate) {
      setDraftLine((current) => (
        current.details.inventorySourceId === source.id
          ? {
              ...current,
              details: {
                ...current.details,
                labName: needLabUpdate ? targetLabName : current.details.labName,
                purity: needPurityUpdate ? targetPurity : current.details.purity,
                stampNumber: needStampUpdate ? targetStamp : current.details.stampNumber,
              },
            }
          : current
      ));
    }
  }, [draftLine.details.inventorySourceId, draftLine.details.labName, draftLine.details.purity, draftLine.details.stampNumber, draftLine.details.rawKind, meltedInventory, nature, setDraftLine]);

  const isSilver = draftLine.details.metalType === 'silver';
  const isPlatinum = draftLine.details.metalType === 'platinum';
  const storedPriceType = draftLine.details.metalPriceType;
  const priceOptions: Array<{ value: DetailState['metalPriceType']; label: string }> = isSilver
    ? [
        { value: 'gramSilver925', label: 'هر گرم نقره ۹۲۵' },
        { value: 'gramSilver995', label: 'هر گرم نقره ۹۹۵' },
        { value: 'gramSilver999', label: 'هر گرم نقره ۹۹۹' },
      ]
    : isPlatinum
      ? [{ value: 'gramPlatinum', label: 'هر گرم پلاتین' }]
      : [
          { value: 'gram18', label: 'گرم ۱۸ عیار' },
          { value: 'mesghal17', label: 'مثقال ۱۷ عیار' },
          { value: 'ounceUsd', label: 'هر اونس (دلاری)' },
        ];
  const currentPriceType = priceOptions.some((option) => option.value === storedPriceType)
    ? storedPriceType
    : priceOptions[0].value;
  const numericPrice = parseNumericValue(draftLine.details.metalPrice);

  useEffect(() => {
    if (storedPriceType === currentPriceType) return;
    updateMetalValue('metalPriceType', priceOptions[0].value);
  }, [currentPriceType, draftLine.details.metalType, priceOptions, storedPriceType, updateMetalValue]);

  const priceTriple = currentPriceType === 'gram18'
    ? convertPricesFromGram18(numericPrice)
    : currentPriceType === 'mesghal17'
      ? convertPricesFromMesghal17(numericPrice)
      : convertPricesFromOunceUsd(numericPrice);

  const handlePriceTypeChange = (newType: DetailState['metalPriceType']) => {
    updateMetalValue('metalPriceType', newType);
  };

  const handlePriceValueChange = (valStr: string) => {
    updateMetalValue('metalPrice', valStr);
  };

  return (
    <div className="space-y-4">
      {/* Operation Kind Selector Header */}
      <div className="document-operation-section">
        <div className="document-operation-title">
          <div>
            <h3 className="text-xs font-bold">نوع {nature === 'received' ? 'خرید' : 'فروش'} را انتخاب کنید</h3>
          </div>
          <span className={`document-nature-badge ${nature}`}>
            {nature === 'received' ? 'خرید / بستانکار' : 'فروش / بدهکار'}
          </span>
        </div>

        <DocumentOperationTypeSelector
          nature={nature}
          value={draftLine.details.rawKind}
          onChange={changeRawKind}
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${nature}-${draftLine.details.rawKind}-${draftLine.details.calculationMethod}`}
          className="document-dynamic-fields"
          initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div className="document-dynamic-fields-heading">
            <FlaskConical size={18} />
            <div>
              <strong>
                مشخصات {rawOperationLabel(nature, draftLine.details.rawKind)}
              </strong>
              <small>اطلاعات وزن، عیار و نحوه محاسبه را دقیق وارد کنید.</small>
            </div>
          </div>

          <div className="document-special-grid raw-gold-fields">
            {/* Inventory Source Selector for Outgoing Raw Gold */}
            {nature === 'paid' && draftLine.details.rawKind !== 'unsettled' ? (
              <Field label={inventoryLabel} wide>
                <MetalInventoryPicker
                  selectedId={draftLine.details.inventorySourceId}
                  rawKind={draftLine.details.rawKind}
                  inventory={meltedInventory}
                  committedLines={committedLines}
                  editingLineId={editingLineId}
                  baseKarat={baseKarat}
                  weightPrecision={weightPrecision}
                  faNumber={faNumber}
                  label={inventoryLabel}
                  placeholder={inventoryPlaceholder}
                  onSelect={(source, availableRemaining) => {
                    setDraftLine((current) => ({
                      ...current,
                      details: {
                        ...current.details,
                        inventorySourceId: source.id,
                        rawWeight: String(availableRemaining),
                        purity: String(source.purity || 750),
                        stampNumber: source.stampNumber ?? '',
                        labName: source.labName ?? '',
                        rawKind: source.rawKind ?? current.details.rawKind,
                      },
                    }));
                  }}
                  onClear={() => {
                    setDraftLine((current) => ({
                      ...current,
                      details: {
                        ...current.details,
                        inventorySourceId: '',
                        rawWeight: '',
                        purity: '750',
                        stampNumber: '',
                        labName: '',
                      },
                    }));
                  }}
                />
              </Field>
            ) : null}

            {/* Sliding Toggle for Calculation Method */}
            <div className="col-span-full flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                نحوه محاسبه:
              </span>
              <SlidingToggle
                value={draftLine.details.calculationMethod}
                onChange={(method) => updateMetalValue('calculationMethod', method)}
              />
            </div>

            {/* DYNAMIC LAYOUT BASED ON CALCULATION METHOD */}
            {isWeightMode ? (
              /* WEIGHT CALCULATION MODE LAYOUT */
              <>
                <Field label="وزن ترازویی (گرم)" required>
                  <input
                    type="number"
                    min="0"
                    step={10 ** -weightPrecision}
                    inputMode="decimal"
                    value={draftLine.details.rawWeight}
                    onChange={(event) => updateMetalValue('rawWeight', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                  />
                </Field>

                <Field label="عیار" required>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.1"
                    readOnly={isPaidRawFromInventory}
                    disabled={isPaidRawFromInventory}
                    inputMode="decimal"
                    value={draftLine.details.purity}
                    onChange={(event) => updateMetalValue('purity', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    aria-label="عیار ردیف سند"
                    title={isPaidRawFromInventory ? 'عیار از موجودی انتخابی قفل شده است.' : 'عیار اول از تنظیمات برنامه خوانده می‌شود و قابل ویرایش است.'}
                    placeholder="۷۵۰"
                  />
                </Field>

                <Field label={`تبدیل‌شده به عیار ${baseKarat.toLocaleString('fa-IR')}`}>
                  <input
                    value={faNumber(
                      convertedTo750(draftLine.details.rawWeight, draftLine.details.purity),
                      weightPrecision,
                    )}
                    readOnly
                    aria-label={`وزن تبدیل‌شده به عیار ${baseKarat}`}
                    className="computed-field font-bold"
                  />
                </Field>

                <Field label="نوع فی">
                  <select
                    className="h-10 min-h-[40px] max-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    value={currentPriceType}
                    onChange={(event) => handlePriceTypeChange(event.target.value as DetailState['metalPriceType'])}
                  >
                    {priceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>

                <MoneyInputField
                  label={priceOptions.find((option) => option.value === currentPriceType)?.label || 'قیمت فلز'}
                  value={draftLine.details.metalPrice}
                  onChange={handlePriceValueChange}
                  baseCurrency={baseCurrency}
                  required={isPriceRequired}
                  onKeyDown={handleKeyDownEnter}
                />

                <MoneyInputField
                  label={
                    <span className="flex items-center gap-1.5">
                      <span>مبلغ کل (محاسباتی)</span>
                      {isAmountRounded ? (
                        <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                          رند شده ({roundingDigits} رقم)
                        </span>
                      ) : null}
                    </span>
                  }
                  value={draftLine.details.totalAmount}
                  readOnly
                  baseCurrency={baseCurrency}
                  action={
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsRoundingModalOpen(true);
                      }}
                      className={`flex items-center justify-center rounded-lg p-1.5 transition-all ${
                        isAmountRounded
                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-300 dark:hover:bg-amber-800 shadow-2xs'
                          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                      }`}
                      title="تنظیمات رند کردن مبلغ کل (محاسباتی)"
                      aria-label="تنظیمات رند کردن مبلغ کل (محاسباتی)"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  }
                />

                <AmountRoundingModal
                  isOpen={isRoundingModalOpen}
                  onClose={() => setIsRoundingModalOpen(false)}
                  currentAmount={currentAmountNum}
                  exactCalculatedAmount={exactCalculatedAmount}
                  baseCurrency={baseCurrency}
                  initialDigits={roundingDigits}
                  initialMode={roundingMode}
                  initialAutoApply={autoApplyRounding}
                  onApply={handleApplyRounding}
                  onReset={handleResetRounding}
                />
              </>
            ) : (
              /* MONEY CALCULATION MODE LAYOUT */
              <>
                <MoneyInputField
                  label="مبلغ کل"
                  value={draftLine.details.totalAmount}
                  onChange={(val) => updateMetalValue('totalAmount', val)}
                  baseCurrency={baseCurrency}
                  required
                  onKeyDown={handleKeyDownEnter}
                />

                <Field label="عیار" required>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.1"
                    readOnly={isPaidRawFromInventory}
                    disabled={isPaidRawFromInventory}
                    inputMode="decimal"
                    value={draftLine.details.purity}
                    onChange={(event) => updateMetalValue('purity', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    aria-label="عیار ردیف سند"
                    title={isPaidRawFromInventory ? 'عیار از موجودی انتخابی قفل شده است.' : 'عیار اول از تنظیمات برنامه خوانده می‌شود و قابل ویرایش است.'}
                    placeholder="۷۵۰"
                  />
                </Field>

                <Field label="وزن محاسبه‌شده (گرم)">
                  <input
                    value={faNumber(actualWeightFromMoney(draftLine.details), weightPrecision)}
                    readOnly
                    aria-label="وزن محاسبه‌شده از روی مبلغ"
                    className="computed-field font-bold"
                  />
                </Field>

                <Field label={`تبدیل‌شده به عیار ${baseKarat.toLocaleString('fa-IR')}`}>
                  <input
                    value={faNumber(
                      convertedWeightFromTotal(
                        draftLine.details.totalAmount,
                        draftLine.details.metalPriceType,
                        draftLine.details.metalPrice,
                      ),
                      weightPrecision,
                    )}
                    readOnly
                    aria-label={`وزن تبدیل‌شده به عیار ${baseKarat}`}
                    className="computed-field font-bold"
                  />
                </Field>

                <Field label="نوع فی">
                  <select
                    className="h-10 min-h-[40px] max-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    value={currentPriceType}
                    onChange={(event) => handlePriceTypeChange(event.target.value as DetailState['metalPriceType'])}
                  >
                    {priceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>

                <MoneyInputField
                  label={priceOptions.find((option) => option.value === currentPriceType)?.label || 'قیمت فلز'}
                  value={draftLine.details.metalPrice}
                  onChange={handlePriceValueChange}
                  baseCurrency={baseCurrency}
                  required
                  onKeyDown={handleKeyDownEnter}
                />
              </>
            )}

            {/* Equivalent Prices Summary Badge */}
            {numericPrice > 0 && !isSilver && !isPlatinum ? (
              <div className="col-span-full flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40 p-2.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span className="text-amber-600 dark:text-amber-400">معادل قیمت در سایر واحدها:</span>
                <span>گرم ۱۸: {faNumber(priceTriple.gram18)} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}</span>
                <span>·</span>
                <span>مثقال ۱۷: {faNumber(priceTriple.mesghal17)} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}</span>
                <span>·</span>
                <span>اونس: {faNumber(priceTriple.ounceUsd)} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}</span>
              </div>
            ) : null}

            {/* Assay Lab Name and Stamp Number */}
            {!isMisc && isMoltenOrConditional ? (
              <>
                <Field label="نام آزمایشگاه ری‌گیری" required={isAssayRequired} error={errors.labName}>
                  <AssayLaboratorySelect
                    inputRef={labInputRef}
                    value={draftLine.details.labName}
                    disabled={isPaidRawFromInventory}
                    onChange={(val) => updateDraftDetail('labName', val)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder={isPaidRawFromInventory ? (draftLine.details.labName || 'بدون ری‌گیری در موجودی') : 'انتخاب یا جستجوی ری‌گیری...'}
                    error={errors.labName}
                  />
                </Field>
                <Field label="شماره پاکت / انگ" required={isAssayRequired} error={errors.stampNumber}>
                  <input
                    ref={stampInputRef}
                    value={draftLine.details.stampNumber}
                    readOnly={isPaidRawFromInventory}
                    disabled={isPaidRawFromInventory}
                    onChange={(event) => {
                      if (isPaidRawFromInventory) return;
                      const cleaned = event.target.value.replace(/[^0-9]/g, '');
                      updateDraftDetail('stampNumber', cleaned);
                    }}
                    onKeyDown={handleKeyDownEnter}
                    placeholder={isPaidRawFromInventory ? (draftLine.details.stampNumber || 'بدون انگ در موجودی') : 'شماره پاکت یا انگ (فقط عدد)'}
                    title={isPaidRawFromInventory ? 'شماره انگ از موجودی انتخابی قفل شده است.' : undefined}
                    className={isPaidRawFromInventory ? 'cursor-not-allowed bg-slate-100 dark:bg-slate-800/80 text-slate-500' : ''}
                  />
                </Field>
              </>
            ) : null}

            {/* Line Description */}
            <Field label="توضیحات" wide>
              <textarea
                value={draftLine.description}
                onChange={(event) => setDraftLine((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
                onKeyDown={handleKeyDownEnter}
                placeholder="توضیحات تکمیلی این ردیف..."
              />
            </Field>
          </div>

          {/* Dynamic summary badge */}
          <div className={`raw-metal-result ${nature}`}>
            <Sparkles size={16} />
            <div>
              <strong>{rawOperationLabel(nature, draftLine.details.rawKind)}</strong>
              <span>
                {draftLine.details.rawWeight || draftLine.details.totalAmount
                  ? `${toPersianDigits(faNumber(isWeightMode ? numberValue(draftLine.details.rawWeight) : actualWeightFromMoney(draftLine.details), weightPrecision))} گرم`
                  : 'وزن وارد نشده'}
                {draftLine.details.purity
                  ? ` · عیار ${toPersianDigits(draftLine.details.purity)}`
                  : ''}
                {numberValue(draftLine.details.totalAmount) > 0
                  ? ` · مبلغ کل: ${toPersianDigits(faNumber(numberValue(draftLine.details.totalAmount)))} ${baseCurrency === 'IRT' ? 'تومان' : 'ریال'}`
                  : ''}
              </span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Sticky Commit Button */}
      {draftReady && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm"
            onClick={commitDraftLine}
          >
            <ListPlus size={16} />
            {commitRowLabel || (editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Alias export for PurchaseTab component
export { GoldSaleTab as PurchaseTab };
