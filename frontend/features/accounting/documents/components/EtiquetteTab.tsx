'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tag,
  QrCode,
  Search,
  Sparkles,
  ListPlus,
  Scale,
  Coins,
  TrendingDown,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { useAppSettings } from '@/src/components/SettingsProvider';
import { useToastManager } from '@/components/ui/toast';
import Field from '@/src/components/documents/Field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { generateUUID } from '@/lib/uuid';
import { faNumber, numberValue, sanitizeLineDetailsForTab } from '../utils/document-helpers';
import HawalaCheckboxField from './HawalaCheckboxField';

export interface EtiquetteTabProps {
  nature?: 'paid' | 'received' | 'pay' | 'receive';
  draftLine?: DocumentLine;
  setDraftLine?: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: (customDraftLine?: DocumentLine) => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCustomer?: Customer | null;
  commitRowLabel?: string;
  isHawala?: boolean;
  setIsHawala?: (val: boolean) => void;
  onRequestHawala?: (line: DocumentLine) => void;
}

export default function EtiquetteTab({
  nature = 'paid',
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = true,
  baseCurrency = 'IRR',
  selectedCustomer,
  commitRowLabel,
  isHawala,
  setIsHawala,
  onRequestHawala,
}: EtiquetteTabProps) {
  const toast = useToastManager();
  const { settings } = useAppSettings();
  const isNaturePaid = nature === 'paid' || nature === 'pay';

  // Internal state
  const [barcode, setBarcode] = useState('');
  const [title, setTitle] = useState('');
  const [grossWeightStr, setGrossWeightStr] = useState('');
  const [stoneWeightStr, setStoneWeightStr] = useState('');
  const [purityStr, setPurityStr] = useState('750');
  const [goldenPercentageStr, setGoldenPercentageStr] = useState('');
  const [wageStr, setWageStr] = useState('');
  const [description, setDescription] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [matchedEtiquette, setMatchedEtiquette] = useState<any | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Sync from draftLine if present
  useEffect(() => {
    if (draftLine) {
      if ((draftLine.details as any)?.barcode) {
        setBarcode((draftLine.details as any).barcode);
      }
      if (draftLine.details?.workmanshipName) {
        setTitle(draftLine.details.workmanshipName);
      }
      if (draftLine.details?.rawWeight) {
        setGrossWeightStr(draftLine.details.rawWeight);
      }
      if (draftLine.details?.purity) {
        setPurityStr(draftLine.details.purity);
      }
      if (draftLine.details?.goldenPercentage) {
        setGoldenPercentageStr(draftLine.details.goldenPercentage);
      }
      if (draftLine.details?.wage) {
        setWageStr(draftLine.details.wage);
      }
      if (draftLine.description) {
        setDescription(draftLine.description);
      }
    }
  }, [draftLine]);

  // Barcode Lookup Handler
  const handleBarcodeLookup = useCallback(async (codeToLookup: string) => {
    const cleanCode = normalizeDigits(codeToLookup).trim();
    if (!cleanCode) return;

    setIsSearchingBarcode(true);
    try {
      const res = await fetch(`/api/etiquettes?barcode=${encodeURIComponent(cleanCode)}`);
      if (res.ok) {
        const data = await res.json();
        const item = Array.isArray(data) ? data[0] : data?.items ? data.items[0] : data;
        if (item && (item.barcode === cleanCode || item.id)) {
          setMatchedEtiquette(item);
          if (item.title) setTitle(item.title);
          if (item.totalWeight) setGrossWeightStr(String(item.totalWeight));
          if (item.stoneWeight) setStoneWeightStr(String(item.stoneWeight));
          if (item.purity) setPurityStr(String(item.purity));
          if (item.wage && item.wageType === 'percentage') {
            setGoldenPercentageStr(String(item.wage));
          } else if (item.profitPercentage) {
            setGoldenPercentageStr(String(item.profitPercentage));
          }
          if (item.storageLocation) setStorageLocation(item.storageLocation);
          toast.success(`اتیکت "${item.title || cleanCode}" با موفقیت بارگذاری شد`);
          return;
        }
      }
      setMatchedEtiquette(null);
    } catch {
      // Non-blocking lookup
      setMatchedEtiquette(null);
    } finally {
      setIsSearchingBarcode(false);
    }
  }, [toast]);

  // Calculations
  const grossWeight = numberValue(grossWeightStr);
  const stoneWeight = numberValue(stoneWeightStr);
  const netWeight = Math.max(0, grossWeight - stoneWeight);
  const purity = numberValue(purityStr) || 750;
  const goldenPercentage = numberValue(goldenPercentageStr);

  const baseStdWeight = purity > 0 ? (netWeight * purity) / 750 : netWeight;
  const goldenAddition = goldenPercentage > 0 ? (baseStdWeight * goldenPercentage) / 100 : 0;
  const totalConverted750 = baseStdWeight + goldenAddition;

  // Operation details
  const opTitle = isNaturePaid ? 'خروج اتیکت طلا' : 'ورود اتیکت طلا';

  const handleCommit = useCallback(() => {
    if (netWeight <= 0 && grossWeight <= 0) {
      toast.error('لطفاً وزن معتبر برای اتیکت وارد نمایید');
      return;
    }

    const mainLineId = generateUUID();
    const effectiveBarcode = normalizeDigits(barcode).trim();
    const effectiveTitle = title.trim() || 'اتیکت طلا';
    const effectiveDesc = description.trim() || `${opTitle}: ${effectiveTitle}${effectiveBarcode ? ` (بارکد: ${effectiveBarcode})` : ''}`;

    const hasGoldenChild = goldenAddition > 0;

    const mainLine: DocumentLine = {
      id: mainLineId,
      documentNature: isNaturePaid ? 'paid' : 'received',
      documentTab: 'etiquette',
      sourceTab: 'etiquette',
      documentSubType: isNaturePaid ? 'exit_etiquette' : 'entry_etiquette',
      documentTypeLabel: opTitle,
      converted750: baseStdWeight,
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: effectiveDesc,
      details: {
        metalType: 'gold',
        baseKarat: 750,
        rawKind: 'molten',
        rawWeight: String(netWeight || grossWeight),
        purity: String(purity),
        calculationMethod: 'weight',
        metalPriceType: 'gram18',
        metalPrice: '',
        totalAmount: '',
        labName: '',
        stampNumber: '',
        currencyUnit: 'IRR',
        currencyQuantity: '',
        currencyUnitPrice: '',
        currencyTotalAmount: '',
        unsettledTrade: false,
        currencyTradeId: '',
        settlementCurrencyUnit: '',
        settlementQuantity: '',
        settlesTradeId: '',
        inventorySourceId: '',
        workmanshipName: effectiveTitle,
        quantity: '1',
        wage: wageStr,
        goldenPercentage: goldenPercentageStr,
        convertedWeight: baseStdWeight.toFixed(3),
        barcode: effectiveBarcode,
        isEtiquette: true,
        storageLocation: storageLocation,
        hasChildLines: hasGoldenChild,
      } as any,
    };

    let goldenLine: DocumentLine | undefined;
    if (hasGoldenChild) {
      goldenLine = {
        id: generateUUID(),
        documentNature: isNaturePaid ? 'paid' : 'received',
        documentTab: 'etiquette',
        sourceTab: 'etiquette',
        documentSubType: 'workmanship-golden-percentage',
        documentTypeLabel: `درصد طلایی اتیکت طلا (${toPersianDigits(goldenPercentageStr)}٪)`,
        converted750: goldenAddition,
        settlementMethod: 'weight',
        balanceSource: 'current',
        description: `درصد طلایی اتیکت طلا (${toPersianDigits(goldenPercentageStr)}٪) - ${effectiveTitle}`,
        details: {
          metalType: 'gold',
          baseKarat: 750,
          rawKind: 'molten',
          rawWeight: goldenAddition.toFixed(3),
          purity: '750',
          calculationMethod: 'weight',
          metalPriceType: 'gram18',
          metalPrice: '',
          totalAmount: '',
          labName: '',
          stampNumber: '',
          currencyUnit: 'IRR',
          currencyQuantity: '',
          currencyUnitPrice: '',
          currencyTotalAmount: '',
          unsettledTrade: false,
          currencyTradeId: '',
          settlementCurrencyUnit: '',
          settlementQuantity: '',
          settlesTradeId: '',
          inventorySourceId: '',
          workmanshipName: effectiveTitle,
          quantity: '1',
          goldenPercentage: goldenPercentageStr,
          convertedWeight: goldenAddition.toFixed(3),
          barcode: effectiveBarcode,
          isEtiquette: true,
          isGoldenPercentageLine: true,
          isChildLine: true,
          linkedLineId: mainLineId,
        } as any,
      };
    }

    if (commitDraftLine) {
      commitDraftLine(mainLine);
      if (goldenLine) {
        commitDraftLine(goldenLine);
      }

      // Reset form
      setBarcode('');
      setTitle('');
      setGrossWeightStr('');
      setStoneWeightStr('');
      setGoldenPercentageStr('');
      setWageStr('');
      setDescription('');
      setMatchedEtiquette(null);
      barcodeInputRef.current?.focus();
    }
  }, [
    netWeight,
    grossWeight,
    barcode,
    title,
    description,
    opTitle,
    goldenAddition,
    isNaturePaid,
    baseStdWeight,
    purity,
    wageStr,
    goldenPercentageStr,
    storageLocation,
    commitDraftLine,
    toast,
  ]);

  return (
    <div className="space-y-4">
      {/* Top Banner / Direction Indicator */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
            {isNaturePaid ? <TrendingDown size={18} /> : <TrendingUp size={18} />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>{opTitle}</span>
              <span className="text-[11px] font-normal text-amber-700 dark:text-amber-400">
                ({isNaturePaid ? 'خروج فیزیکی اتیکت از ویترین / موجودی' : 'ورود اتیکت به موجودی'})
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ثبت اتیکت طلا همراه با تفکیک دقیق وزن خالص و درصد طلایی
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-amber-200/70 dark:bg-amber-900/70 text-amber-900 dark:text-amber-200">
            <Tag size={13} />
            اتیکت طلا و جواهر
          </span>
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Barcode Search / Scan */}
        <div className="space-y-1">
          <Field label="بارکد / کد اتیکت">
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleBarcodeLookup(barcode);
                  }
                }}
                placeholder="اسکن یا وارد کردن بارکد..."
                className="w-full h-9 px-3 pe-8 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => void handleBarcodeLookup(barcode)}
                disabled={isSearchingBarcode || !barcode.trim()}
                className="absolute left-1.5 top-1.5 p-1 text-slate-400 hover:text-amber-600 disabled:opacity-40"
                title="جستجوی اتیکت"
              >
                {isSearchingBarcode ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              </button>
            </div>
          </Field>
          {matchedEtiquette && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 size={12} />
              <span>موجود در سیستم: {matchedEtiquette.title || matchedEtiquette.barcode}</span>
            </div>
          )}
        </div>

        {/* Title / Description */}
        <Field label="نام / عنوان مصنوع">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: گوشواره، انگشتر، النگو..."
            className="w-full h-9 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>

        {/* Gross Weight */}
        <Field label="وزن کل / ناخالص (گرم)">
          <input
            type="text"
            inputMode="decimal"
            value={grossWeightStr}
            onChange={(e) => setGrossWeightStr(normalizeDigits(e.target.value))}
            placeholder="0.000"
            className="w-full h-9 px-3 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>

        {/* Stone Deduction */}
        <Field label="کسر نگین (گرم)">
          <input
            type="text"
            inputMode="decimal"
            value={stoneWeightStr}
            onChange={(e) => setStoneWeightStr(normalizeDigits(e.target.value))}
            placeholder="0.000"
            className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>

        {/* Karat / Purity */}
        <Field label="عیار">
          <input
            type="text"
            inputMode="numeric"
            value={purityStr}
            onChange={(e) => setPurityStr(normalizeDigits(e.target.value))}
            placeholder="750"
            className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </Field>

        {/* Golden Percentage */}
        <Field label="درصد طلایی (٪)">
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={goldenPercentageStr}
              onChange={(e) => setGoldenPercentageStr(normalizeDigits(e.target.value))}
              placeholder="مثال: ۱۱"
              className="w-full h-9 px-3 pe-7 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="absolute left-2.5 top-2 text-xs text-slate-400 font-bold">%</span>
          </div>
        </Field>

        {/* Net Gold Weight (Computed preview) */}
        <Field label="وزن خالص طلا">
          <div className="w-full h-9 px-3 flex items-center justify-between text-xs font-mono font-bold rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
            <span>{toPersianDigits(netWeight.toFixed(3))}</span>
            <span className="text-[10px] text-slate-400">گرم</span>
          </div>
        </Field>

        {/* Converted 750 (Total including golden percentage) */}
        <Field label="معادل ۷۵۰ کل (با درصد)">
          <div className="w-full h-9 px-3 flex items-center justify-between text-xs font-mono font-bold rounded-lg bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
            <span>{toPersianDigits(totalConverted750.toFixed(3))}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400">گرم ۷۵۰</span>
          </div>
        </Field>
      </div>

      {/* Breakdown Summary Badge */}
      {goldenAddition > 0 && (
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 text-xs">
          <Info size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
            <span>
              وزن پایه ۷۵۰: <strong className="font-mono text-slate-900 dark:text-white">{toPersianDigits(baseStdWeight.toFixed(3))}</strong> گرم
            </span>
            <span>+</span>
            <span>
              درصد طلایی ({toPersianDigits(goldenPercentageStr)}٪): <strong className="font-mono text-amber-700 dark:text-amber-300">{toPersianDigits(goldenAddition.toFixed(3))}</strong> گرم
            </span>
            <span>=</span>
            <span>
              مجموع تعهد وزنی: <strong className="font-mono text-emerald-700 dark:text-emerald-300">{toPersianDigits(totalConverted750.toFixed(3))}</strong> گرم
            </span>
          </div>
        </div>
      )}

      {/* Description & Add Button */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <div className="flex-1 w-full">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="شرح اختیاری ردیف اتیکت..."
            className="w-full h-10 px-3 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={handleCommit}
          disabled={netWeight <= 0 && grossWeight <= 0}
          className="w-full sm:w-auto px-5 h-10 flex items-center justify-center gap-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <ListPlus size={16} />
          <span>{commitRowLabel || 'افزودن ردیف اتیکت به سند'}</span>
        </button>
      </div>
    </div>
  );
}
