'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
  Coins,
  Plus,
  Sparkles,
  Calculator,
  ListPlus,
  X,
  Check,
  ArrowRightLeft,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  FileText,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import { useAppSettings } from '@/src/components/SettingsProvider';
import { PriceInput } from '@/components/ui/price-input';
import Field from '@/src/components/documents/Field';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';

export type CoinOperationType =
  // Payment operations (سند پرداختی)
  | 'payment_exit' // خروج سکه/شمش(تک و تعداد)
  | 'payment_sale' // فروش سکه/شمش(تک و تعداد)
  | 'payment_unsettled_sale' // فروش بدون تسویه
  | 'payment_claim' // طلب سکه و شمش
  // Receipt operations (سند دریافتی)
  | 'receipt_entry' // ورود سکه/شمش(تک و تعداد)
  | 'receipt_buy' // خرید سکه/شمش(تک و تعداد)
  | 'receipt_unsettled_buy' // خرید بدون تسویه
  | 'receipt_debt'; // بدهی سکه و شمش

export interface CoinPreset {
  id: string;
  name: string;
  category: 'bank_coin' | 'pahlavi_coin' | 'parsian' | 'bar_zioto' | 'bar_parsis' | 'bar_other' | 'custom';
  categoryLabel: string;
  weight: number; // weight in grams
  purity: number; // in thousandths (e.g. 900, 995, 750)
  isFixedWeight: boolean;
  isFixedPurity: boolean;
}

export const PREDEFINED_COIN_PRESETS: CoinPreset[] = [
  // 1. سکه‌های بانکی بهار آزادی
  {
    id: 'emami_full',
    name: 'تمام سکه بانکی (بهار آزادی/امامی)',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    weight: 8.133,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'half_bahar',
    name: 'نیم سکه',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    weight: 4.066,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'quarter_bahar',
    name: 'ربع سکه',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    weight: 2.033,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'gram_coin',
    name: 'سکه گرمی',
    category: 'bank_coin',
    categoryLabel: 'سکه‌های بانکی (بهار آزادی)',
    weight: 1.010,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
  },

  // 2. سکه‌های پهلوی
  {
    id: 'pahlavi_full',
    name: 'سکه پهلوی (تمام)',
    category: 'pahlavi_coin',
    categoryLabel: 'سکه‌های پهلوی',
    weight: 8.133,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'pahlavi_half',
    name: 'سکه پهلوی (نیم)',
    category: 'pahlavi_coin',
    categoryLabel: 'سکه‌های پهلوی',
    weight: 4.066,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'pahlavi_quarter',
    name: 'سکه پهلوی (ربع)',
    category: 'pahlavi_coin',
    categoryLabel: 'سکه‌های پهلوی',
    weight: 2.033,
    purity: 900,
    isFixedWeight: true,
    isFixedPurity: true,
  },

  // 3. شمش زیوتو (Zioto Bars)
  {
    id: 'zioto_1g',
    name: 'شمش زیوتو (۱ گرمی)',
    category: 'bar_zioto',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    weight: 1.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'zioto_2_5g',
    name: 'شمش زیوتو (۲.۵ گرمی)',
    category: 'bar_zioto',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    weight: 2.5,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'zioto_5g',
    name: 'شمش زیوتو (۵ گرمی)',
    category: 'bar_zioto',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    weight: 5.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'zioto_10g',
    name: 'شمش زیوتو (۱۰ گرمی)',
    category: 'bar_zioto',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    weight: 10.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'zioto_50g',
    name: 'شمش زیوتو (۵۰ گرمی)',
    category: 'bar_zioto',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    weight: 50.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'zioto_100g',
    name: 'شمش زیوتو (۱۰۰ گرمی)',
    category: 'bar_zioto',
    categoryLabel: 'شمش‌های زیوتو (Zioto)',
    weight: 100.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },

  // 4. شمش پارسیس (Parsis Bars)
  {
    id: 'parsis_1g',
    name: 'شمش پارسیس (۱ گرمی)',
    category: 'bar_parsis',
    categoryLabel: 'شمش‌های پارسیس (Parsis)',
    weight: 1.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsis_2_5g',
    name: 'شمش پارسیس (۲.۵ گرمی)',
    category: 'bar_parsis',
    categoryLabel: 'شمش‌های پارسیس (Parsis)',
    weight: 2.5,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsis_5g',
    name: 'شمش پارسیس (۵ گرمی)',
    category: 'bar_parsis',
    categoryLabel: 'شمش‌های پارسیس (Parsis)',
    weight: 5.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsis_10g',
    name: 'شمش پارسیس (۱۰ گرمی)',
    category: 'bar_parsis',
    categoryLabel: 'شمش‌های پارسیس (Parsis)',
    weight: 10.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsis_50g',
    name: 'شمش پارسیس (۵۰ گرمی)',
    category: 'bar_parsis',
    categoryLabel: 'شمش‌های پارسیس (Parsis)',
    weight: 50.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsis_100g',
    name: 'شمش پارسیس (۱۰۰ گرمی)',
    category: 'bar_parsis',
    categoryLabel: 'شمش‌های پارسیس (Parsis)',
    weight: 100.0,
    purity: 995,
    isFixedWeight: true,
    isFixedPurity: true,
  },

  // 5. سکه‌های پارسیان (۱۸ عیار / ۷۵۰)
  {
    id: 'parsian_300',
    name: 'سکه پارسیان ۰.۳۰۰ (۳۰۰ سوت)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    weight: 0.3,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsian_500',
    name: 'سکه پارسیان ۰.۵۰۰ (۵۰۰ سوت)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    weight: 0.5,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsian_1000',
    name: 'سکه پارسیان ۱.۰۰۰ (۱ گرمی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    weight: 1.0,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsian_1500',
    name: 'سکه پارسیان ۱.۵۰۰ (۱.۵ گرمی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    weight: 1.5,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
  },
  {
    id: 'parsian_2000',
    name: 'سکه پارسیان ۲.۰۰۰ (۲ گرمی)',
    category: 'parsian',
    categoryLabel: 'سکه‌های پارسیان (۱۸ عیار)',
    weight: 2.0,
    purity: 750,
    isFixedWeight: true,
    isFixedPurity: true,
  },

  // 6. سایر شمش‌ها
  {
    id: 'bar_swiss',
    name: 'شمش سوئیسی / ونوس',
    category: 'bar_other',
    categoryLabel: 'سایر شمش‌های معتبر',
    weight: 1.0,
    purity: 995,
    isFixedWeight: false,
    isFixedPurity: true,
  },
];

export interface CoinTabProps {
  nature: 'paid' | 'received';
  draftLine?: DocumentLine;
  setDraftLine?: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: () => void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
}

export default function CoinTab({
  nature = 'paid',
  setDraftLine,
  editingLineId = null,
  isLinesPinned = false,
  commitDraftLine,
  handleKeyDownEnter,
  draftReady = true,
  baseCurrency = 'IRR',
}: CoinTabProps) {
  const { settings } = useAppSettings();
  const basePurity = Number(settings.goldBaseKarat) || 750;
  const weightPrecision = Number(settings.weightDecimalPlaces) || 3;
  const effectiveCurrency = baseCurrency || (settings.baseCurrency as 'IRR' | 'IRT') || 'IRR';
  const currencySuffix = effectiveCurrency === 'IRT' ? 'تومان' : 'ریال';

  // Available Operation Types based on nature
  const operationOptions = useMemo(() => {
    if (nature === 'paid') {
      return [
        {
          id: 'payment_exit' as CoinOperationType,
          label: 'خروج سکه/شمش(تک و تعداد)',
          description: 'خروج فیزیکی و تحویل سکه یا شمش بدون ارزش‌گذاری مالی',
          icon: TrendingDown,
          color: 'text-amber-600 dark:text-amber-400',
          hasFinancials: false,
        },
        {
          id: 'payment_sale' as CoinOperationType,
          label: 'فروش سکه/شمش(تک و تعداد)',
          description: 'فروش قطعی سکه و شمش با ثبت قیمت و تبدیل وزنی',
          icon: ShoppingBag,
          color: 'text-rose-600 dark:text-rose-400',
          hasFinancials: true,
        },
        {
          id: 'payment_unsettled_sale' as CoinOperationType,
          label: 'فروش بدون تسویه',
          description: 'فروش سکه/شمش بدون تسویه ریالی فوری (معامله باز)',
          icon: ArrowRightLeft,
          color: 'text-orange-600 dark:text-orange-400',
          hasFinancials: true,
        },
        {
          id: 'payment_claim' as CoinOperationType,
          label: 'طلب سکه و شمش',
          description: 'ثبت طلب سکه و شمش از طرف حساب',
          icon: FileText,
          color: 'text-indigo-600 dark:text-indigo-400',
          hasFinancials: true,
        },
      ];
    } else {
      return [
        {
          id: 'receipt_entry' as CoinOperationType,
          label: 'ورود سکه/شمش(تک و تعداد)',
          description: 'ورود فیزیکی و دریافت سکه یا شمش بدون ارزش‌گذاری مالی',
          icon: TrendingUp,
          color: 'text-emerald-600 dark:text-emerald-400',
          hasFinancials: false,
        },
        {
          id: 'receipt_buy' as CoinOperationType,
          label: 'خرید سکه/شمش(تک و تعداد)',
          description: 'خرید قطعی سکه و شمش با ثبت قیمت و تبدیل وزنی',
          icon: ShoppingBag,
          color: 'text-emerald-600 dark:text-emerald-400',
          hasFinancials: true,
        },
        {
          id: 'receipt_unsettled_buy' as CoinOperationType,
          label: 'خرید بدون تسویه',
          description: 'خرید سکه/شمش بدون تسویه ریالی فوری (معامله باز)',
          icon: ArrowRightLeft,
          color: 'text-teal-600 dark:text-teal-400',
          hasFinancials: true,
        },
        {
          id: 'receipt_debt' as CoinOperationType,
          label: 'بدهی سکه و شمش',
          description: 'ثبت تعهد و بدهی سکه و شمش به طرف حساب',
          icon: FileText,
          color: 'text-blue-600 dark:text-blue-400',
          hasFinancials: true,
        },
      ];
    }
  }, [nature]);

  // Active operation mode
  const [selectedOperation, setSelectedOperation] = useState<CoinOperationType>(() => {
    return nature === 'paid' ? 'payment_exit' : 'receipt_entry';
  });

  // Adjust state during render if nature prop changes
  const [prevNature, setPrevNature] = useState(nature);
  if (prevNature !== nature) {
    setPrevNature(nature);
    if (nature === 'paid' && !selectedOperation.startsWith('payment_')) {
      setSelectedOperation('payment_exit');
    } else if (nature === 'received' && !selectedOperation.startsWith('receipt_')) {
      setSelectedOperation('receipt_entry');
    }
  }

  const currentOp = useMemo(() => {
    return operationOptions.find((op) => op.id === selectedOperation) || operationOptions[0];
  }, [operationOptions, selectedOperation]);

  // Custom coin list & modal
  const [customCoins, setCustomCoins] = useState<CoinPreset[]>([]);
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);
  const [submittingCustom, setSubmittingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomWeight, setNewCustomWeight] = useState('1.0');
  const [newCustomPurity, setNewCustomPurity] = useState('900');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  // Fetch master coin types from backend API /api/coin-types (Single Source of Truth)
  useEffect(() => {
    let isMounted = true;
    async function loadCoinTypes() {
      try {
        const res = await fetch('/api/coin-types', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.coinTypes) && data.coinTypes.length > 0 && isMounted) {
            const mapped: CoinPreset[] = data.coinTypes.map((item: { id: string; name: string; nature?: string; unitWeight?: number; purity?: number }) => ({
              id: item.id,
              name: item.name,
              category: item.nature === 'bullion' ? 'bar_other' : (item.name?.includes('پهلوی') ? 'pahlavi_coin' : (item.name?.includes('پارسیان') ? 'parsian' : 'bank_coin')),
              categoryLabel: item.nature === 'bullion' ? 'شمش‌های معتبر' : 'انواع سکه',
              weight: Number(item.unitWeight || 1.0),
              purity: Number(item.purity || 900),
              isFixedWeight: true,
              isFixedPurity: true,
            }));
            setCustomCoins(mapped);
          }
        }
      } catch {
        // keep default preset list
      }
    }
    void loadCoinTypes();
    return () => { isMounted = false; };
  }, []);

  // All combined presets
  const allPresets = useMemo(() => {
    // Avoid duplicating items if customCoins loaded from backend contain existing preset IDs
    const customFiltered = customCoins.filter(
      (c) => !PREDEFINED_COIN_PRESETS.some((p) => p.name === c.name || p.id === c.id),
    );
    return [...PREDEFINED_COIN_PRESETS, ...customFiltered];
  }, [customCoins]);

  // Form Fields State
  const [selectedCoinId, setSelectedCoinId] = useState<string>('emami_full');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitWeight, setUnitWeight] = useState<string>('8.133');
  const [purity, setPurity] = useState<string>('900');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [totalPrice, setTotalPrice] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Selected coin preset definition
  const selectedPreset = useMemo(() => {
    return allPresets.find((p) => p.id === selectedCoinId) || allPresets[0];
  }, [allPresets, selectedCoinId]);

  // Update preset defaults when changing coin
  const handleSelectCoin = (coinId: string) => {
    setSelectedCoinId(coinId);
    const preset = allPresets.find((p) => p.id === coinId);
    if (preset) {
      setUnitWeight(String(preset.weight));
      setPurity(String(preset.purity));
    }
  };

  // Numeric derived values
  const numericQuantity = useMemo(() => {
    const q = parseInt(normalizeDigits(quantity).replace(/[^\d]/g, ''), 10);
    return isNaN(q) || q <= 0 ? 1 : q;
  }, [quantity]);

  const numericUnitWeight = useMemo(() => {
    const parsed = parseFloat(normalizeDigits(unitWeight).replace(/,/g, ''));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [unitWeight]);

  const numericPurity = useMemo(() => {
    const parsed = parseFloat(normalizeDigits(purity).replace(/,/g, ''));
    return isNaN(parsed) || parsed < 0 ? 900 : parsed;
  }, [purity]);

  // Total Weight = Quantity * Unit Weight
  const totalWeight = useMemo(() => {
    return numericQuantity * numericUnitWeight;
  }, [numericQuantity, numericUnitWeight]);

  // Converted to X base purity: (((Count * Weight) * Purity)) / Global_Settings_Base_Purity
  const convertedToX = useMemo(() => {
    if (basePurity <= 0 || totalWeight <= 0 || numericPurity <= 0) return 0;
    return (totalWeight * numericPurity) / basePurity;
  }, [totalWeight, numericPurity, basePurity]);

  // Price Sync Logic
  const handleUnitPriceChange = (rawVal: string) => {
    setUnitPrice(rawVal);
    const numUnitPrice = parseLocalizedAmount(rawVal);
    if (numUnitPrice > 0 && numericQuantity > 0) {
      const calculatedTotal = numUnitPrice * numericQuantity;
      setTotalPrice(String(calculatedTotal));
    } else if (!rawVal) {
      setTotalPrice('');
    }
  };

  const handleTotalPriceChange = (rawVal: string) => {
    setTotalPrice(rawVal);
    const numTotal = parseLocalizedAmount(rawVal);
    if (numTotal > 0 && numericQuantity > 0) {
      const calculatedUnit = Math.floor(numTotal / numericQuantity);
      setUnitPrice(String(calculatedUnit));
    } else if (!rawVal) {
      setUnitPrice('');
    }
  };

  const handleQuantityChange = (newQtyStr: string) => {
    setQuantity(newQtyStr);
    const q = parseInt(normalizeDigits(newQtyStr).replace(/[^\d]/g, ''), 10);
    const validQ = isNaN(q) || q <= 0 ? 1 : q;

    const numUnitPrice = parseLocalizedAmount(unitPrice);
    if (numUnitPrice > 0) {
      setTotalPrice(String(numUnitPrice * validQ));
    }
  };

  // Sync with parent draftLine if provided
  useEffect(() => {
    if (setDraftLine) {
      setDraftLine((curr) => ({
        ...curr,
        documentTab: 'coin',
        documentSubType: selectedOperation,
        documentTypeLabel: currentOp.label,
        converted750: convertedToX,
        description: description,
        details: {
          ...curr.details,
          metalType: 'gold',
          rawWeight: totalWeight.toFixed(weightPrecision),
          purity: String(numericPurity),
          totalAmount: totalPrice,
          currencyQuantity: String(numericQuantity),
          currencyUnitPrice: unitPrice,
          currencyTotalAmount: totalPrice,
          currencyUnit: selectedPreset.name,
          unsettledTrade: selectedOperation.includes('unsettled'),
        },
      }));
    }
  }, [
    selectedOperation,
    currentOp.label,
    selectedPreset.name,
    numericQuantity,
    totalWeight,
    numericPurity,
    convertedToX,
    unitPrice,
    totalPrice,
    description,
    weightPrecision,
    setDraftLine,
  ]);

  // Handle custom coin submission
  const handleCreateCustomCoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustomName.trim();
    if (!name) {
      setCustomFormError('عنوان سکه یا شمش الزامی است.');
      return;
    }

    const weight = parseFloat(normalizeDigits(newCustomWeight).replace(/,/g, ''));
    if (isNaN(weight) || weight <= 0) {
      setCustomFormError('وزن واحد باید عددی مثبت باشد.');
      return;
    }

    const purityVal = parseFloat(normalizeDigits(newCustomPurity).replace(/,/g, ''));
    if (isNaN(purityVal) || purityVal <= 0 || purityVal > 1000) {
      setCustomFormError('عیار باید مقداری بین ۱ تا ۱۰۰۰ باشد.');
      return;
    }

    setSubmittingCustom(true);
    setCustomFormError(null);

    try {
      const res = await fetch('/api/coin-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          nature: 'coin',
          unitWeight: weight,
          purity: purityVal,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCustomFormError(data.message || 'ثبت سکه/شمش سفارشی با خطا مواجه شد.');
        return;
      }

      const createdItem = data.coinType;
      const newPreset: CoinPreset = {
        id: createdItem.id,
        name: createdItem.name,
        category: 'custom',
        categoryLabel: 'سکه‌ها و شمش‌های سفارشی',
        weight: Number(createdItem.unitWeight || weight),
        purity: Number(createdItem.purity || purityVal),
        isFixedWeight: false,
        isFixedPurity: false,
      };

      setCustomCoins((prev) => [...prev.filter((c) => c.id !== createdItem.id), newPreset]);
      setSelectedCoinId(createdItem.id);
      setUnitWeight(String(newPreset.weight));
      setPurity(String(newPreset.purity));

      setIsAddCustomModalOpen(false);
      setNewCustomName('');
      setNewCustomWeight('1.0');
      setNewCustomPurity('900');
    } catch (err) {
      setCustomFormError(err instanceof Error ? err.message : 'خطا در ثبت سکه/شمش سفارشی.');
    } finally {
      setSubmittingCustom(false);
    }
  };

  // Group presets for select optgroups
  const groupedPresets = useMemo(() => {
    const groups: Record<string, { label: string; items: CoinPreset[] }> = {
      bank_coin: { label: 'سکه‌های بانکی (بهار آزادی)', items: [] },
      pahlavi_coin: { label: 'سکه‌های پهلوی', items: [] },
      bar_zioto: { label: 'شمش‌های زیوتو (Zioto)', items: [] },
      bar_parsis: { label: 'شمش‌های پارسیس (Parsis)', items: [] },
      parsian: { label: 'سکه‌های پارسیان (۱۸ عیار)', items: [] },
      bar_other: { label: 'سایر شمش‌های معتبر', items: [] },
      custom: { label: 'سکه‌ها و شمش‌های سفارشی', items: [] },
    };

    allPresets.forEach((p) => {
      if (groups[p.category]) {
        groups[p.category].items.push(p);
      } else {
        groups.custom.items.push(p);
      }
    });

    return Object.entries(groups).filter(([, g]) => g.items.length > 0);
  }, [allPresets]);

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* 1. Operation Type Segmented Selector */}
      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-2 dark:border-slate-800 dark:bg-slate-900/60">
        <label className="mb-1.5 block px-1 text-[11px] font-black text-slate-700 dark:text-slate-300">
          نوع عملیات سکه و شمش:
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {operationOptions.map((op) => {
            const Icon = op.icon;
            const isSelected = selectedOperation === op.id;
            return (
              <button
                type="button"
                key={op.id}
                onClick={() => setSelectedOperation(op.id)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-center transition-all cursor-pointer ${
                  isSelected
                    ? nature === 'paid'
                      ? 'border-rose-500 bg-rose-600 text-white shadow-md shadow-rose-600/20 dark:border-rose-600 dark:bg-rose-600'
                      : 'border-emerald-500 bg-emerald-600 text-white shadow-md shadow-emerald-600/20 dark:border-emerald-600 dark:bg-emerald-600'
                    : 'border-slate-200/90 bg-white text-slate-800 hover:border-amber-400 hover:bg-amber-50/50 dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={18} className={isSelected ? 'text-white' : op.color} />
                <span className="text-xs font-black leading-tight">{op.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Main Form Fields Container */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 space-y-4">
        {/* Operation Banner Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
              <Coins size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100">
                {currentOp.label}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {currentOp.description}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black ${
              nature === 'paid'
                ? 'bg-rose-500/10 text-rose-700 border border-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300'
                : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            {nature === 'paid' ? 'سند پرداختی (خروجی)' : 'سند دریافتی (ورودی)'}
          </span>
        </div>

        {/* Dynamic Fields Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* 1. Coin / Ingot Name Field */}
          <div className="space-y-1 sm:col-span-2">
            <Field label="نام سکه / شمش *" wide>
              <div className="flex gap-2">
                <select
                  value={selectedCoinId}
                  onChange={(e) => handleSelectCoin(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  {groupedPresets.map(([key, group]) => (
                    <optgroup key={key} label={group.label}>
                      {group.items.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name} — {preset.weight} گرم (عیار {preset.purity})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsAddCustomModalOpen(true)}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-black text-amber-900 shadow-2xs hover:bg-amber-100 transition-all dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200 cursor-pointer"
                  title="افزودن سکه یا شمش دلخواه"
                >
                  <Plus size={15} />
                  <span>افزودن دلخواه</span>
                </button>
              </div>
            </Field>
          </div>

          {/* 2. Count (تعداد) */}
          <Field label="تعداد (قطعه) *">
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                onKeyDown={handleKeyDownEnter}
                placeholder="۱"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-950 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                عدد
              </span>
            </div>
          </Field>

          {/* 3. Unit Weight (وزن واحد / گرم) */}
          <Field label="وزن هر قطعه (گرم) *">
            <div className="relative">
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={unitWeight}
                onChange={(e) => setUnitWeight(e.target.value)}
                onKeyDown={handleKeyDownEnter}
                placeholder="۸.۱۳۳"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-950 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                گرم
              </span>
            </div>
          </Field>

          {/* 4. Total Weight (وزن کل محاسبه‌شده) */}
          <Field label="وزن کل اقلام (گرم)">
            <div className="flex h-10 w-full items-center justify-between rounded-xl border border-amber-300/80 bg-amber-50/70 px-3 text-xs font-black text-amber-950 shadow-2xs dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-mono tabular-nums text-sm">
                {totalWeight.toFixed(weightPrecision)}
              </span>
              <span className="text-[10px] font-black text-amber-800 dark:text-amber-400">
                گرم ناخالص
              </span>
            </div>
          </Field>

          {/* 5. Purity (عیار) */}
          <Field label="عیار *">
            <div className="relative">
              <input
                type="number"
                min="1"
                max="1000"
                value={purity}
                onChange={(e) => setPurity(e.target.value)}
                onKeyDown={handleKeyDownEnter}
                placeholder="۹۰۰"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-950 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                در هزار
              </span>
            </div>
          </Field>

          {/* 6. Financial Fields (Rendered only when hasFinancials is true) */}
          {currentOp.hasFinancials ? (
            <>
              {/* Unit Price (قیمت هر واحد) */}
              <Field label={`قیمت هر واحد (${currencySuffix}) *`}>
                <PriceInput
                  value={unitPrice}
                  onValueChange={(_parsed, raw) => handleUnitPriceChange(raw)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="۰"
                  baseCurrency={effectiveCurrency}
                  currencySuffix={currencySuffix}
                  showWords={false}
                />
              </Field>

              {/* Total Price (قیمت کل) */}
              <Field label={`قیمت کل (${currencySuffix}) *`}>
                <PriceInput
                  value={totalPrice}
                  onValueChange={(_parsed, raw) => handleTotalPriceChange(raw)}
                  onKeyDown={handleKeyDownEnter}
                  placeholder="۰"
                  baseCurrency={effectiveCurrency}
                  currencySuffix={currencySuffix}
                  showWords
                />
              </Field>

              {/* Convert to X Field: (((Count * Weight) * Purity)) / Global_Settings_Base_Purity */}
              <Field label={`تبدیل به ${toPersianDigits(basePurity)} (معادل استاندارد)`}>
                <div className="flex h-10 w-full items-center justify-between rounded-xl border border-amber-400 bg-gradient-to-r from-amber-50 to-amber-100/60 px-3 text-xs font-black text-amber-950 shadow-2xs dark:border-amber-600/70 dark:from-amber-950/50 dark:to-amber-900/40 dark:text-amber-200">
                  <span className="font-mono tabular-nums text-sm">
                    {convertedToX > 0 ? convertedToX.toFixed(weightPrecision) : '۰.۰۰۰'}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-black text-amber-800 dark:text-amber-300">
                    <Sparkles size={12} />
                    گرم {toPersianDigits(basePurity)}
                  </span>
                </div>
              </Field>
            </>
          ) : null}

          {/* 7. Description (توضیحات) */}
          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <Field label="توضیحات ردیف" wide>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleKeyDownEnter}
                placeholder="توضیحات بابت سکه یا شمش (سال ضرب، شماره پلمپ، نام صرافی، شماره سریال و...)"
                rows={2}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-900 transition-all focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </Field>
          </div>
        </div>

        {/* Live Calculation Summary Footer */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                خلاصه محاسبات:
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[11px] font-black">
              <span className="text-slate-800 dark:text-slate-200">
                تعداد: <strong className="text-amber-700 dark:text-amber-400">{toPersianDigits(numericQuantity)}</strong> عدد
              </span>
              <span className="text-slate-800 dark:text-slate-200">
                وزن کل: <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-400">{totalWeight.toFixed(weightPrecision)}</strong> گرم
              </span>
              {currentOp.hasFinancials ? (
                <>
                  <span className="text-slate-800 dark:text-slate-200">
                    معادل عیار {toPersianDigits(basePurity)}: <strong className="font-mono tabular-nums text-amber-700 dark:text-amber-400">{convertedToX.toFixed(weightPrecision)}</strong> گرم
                  </span>
                  {parseLocalizedAmount(totalPrice) > 0 ? (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      مبلغ کل: <strong className="font-mono tabular-nums">{parseLocalizedAmount(totalPrice).toLocaleString('fa-IR')}</strong> {currencySuffix}
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Commit Line Button */}
      {commitDraftLine && draftReady ? (
        <div className={`sticky ${isLinesPinned ? 'bottom-32' : 'bottom-3'} z-30 flex justify-center pt-2 transition-all duration-300`}>
          <button
            type="button"
            className="document-commit-line-button shadow-lg max-w-sm cursor-pointer"
            onClick={commitDraftLine}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}

      {/* Modal: Define Custom Coin */}
      <AnimatePresence>
        {isAddCustomModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddCustomModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300">
                    <Plus size={16} />
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                    افزودن سکه یا شمش دلخواه
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCustomModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreateCustomCoin} className="space-y-3.5">
                {customFormError ? (
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    {customFormError}
                  </div>
                ) : null}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نام سکه یا شمش <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomName}
                    onChange={(e) => setNewCustomName(e.target.value)}
                    placeholder="مثلاً: سکه یادبود ویژه، شمش ۵۰ گرمی ترکیه و..."
                    className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      وزن واحد (گرم) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      required
                      value={newCustomWeight}
                      onChange={(e) => setNewCustomWeight(e.target.value)}
                      placeholder="۱.۰"
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      عیار (در هزار) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      required
                      value={newCustomPurity}
                      onChange={(e) => setNewCustomPurity(e.target.value)}
                      placeholder="۹۰۰"
                      className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddCustomModalOpen(false)}
                    className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCustom}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{submittingCustom ? 'در حال ثبت...' : 'ثبت و اضافه به لیست'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
