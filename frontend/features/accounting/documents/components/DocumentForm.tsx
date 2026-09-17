'use client';

import {
  ArrowLeftRight,
  Check,
  ClipboardList,
  Flame,
  LoaderCircle,
  MapPin,
  PencilLine,
  Phone,
  Pin,
  PinOff,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import DatePicker from '@/components/ui/date-picker';
import {
  getCurrenciesForBaseCurrency,
  getCurrencyDisplayName,
  type Currency,
} from '@/lib/currencies';
import { currencyDisplay, type Customer } from '@/lib/customer';
import { isRefinerGroup } from '@/lib/customer-groups';
import DocumentSubmitActions from '@/components/documents/document-submit-actions';
import DocumentEntryTabs from '@/src/components/documents/DocumentEntryTabs';
import type { DocumentNature } from '@/lib/document';
import {
  formatJalaliDate,
  normalizeDigits,
} from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';
import type { AppSettings } from '@/lib/settings';
import RawGoldTab, {
  type DetailState,
  type DocumentLine,
  type MeltedInventoryItem,
  type RawOperationKind,
} from '@/src/components/documents/RawGoldTab';
import { getInventoryItemAvailability } from '@/lib/inventory-reservation';
import GoldSaleTab from '@/src/components/documents/GoldSaleTab';
import CurrencyTab from '@/src/components/documents/CurrencyTab';
import CoinTab from '@/src/components/documents/CoinTab';
import CashTab from '@/src/components/documents/CashTab';
import ClaimTab from '@/src/components/documents/ClaimTab';
import BankTab from '@/src/components/documents/BankTab';
import WorkmanshipTab from '@/src/components/documents/WorkmanshipTab';
import Field from '@/src/components/documents/Field';
import HawalaModal from '@/src/components/documents/HawalaModal';
import DocumentPrint from '@/src/components/documents/DocumentPrint';
import BaleIcon from '@/src/components/documents/BaleIcon';

type CalculationMethod = 'weight' | 'money';
type MetalPriceType = DetailState['metalPriceType'];

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type PendingDelete = {
  line: DocumentLine;
  index: number;
};

type PendingHawala = {
  line: DocumentLine;
  targetCustomer: Customer;
  countdown: number;
};

const jalaliMonthNames = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const weekDayNames = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const MESGHAL_17_TO_GRAM_18 = 4.3318;
const TROY_OUNCE_GRAMS = 31.1035;

function toPersianDigits(value: string) {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

function parseJalaliParts(value: string): DateParts {
  const parts = normalizeDigits(value).replace(/[.-]/g, '/').split('/').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return { year: 1405, month: 1, day: 1 };
  }
  return {
    year: parts[0],
    month: Math.min(12, Math.max(1, parts[1])),
    day: Math.min(31, Math.max(1, parts[2])),
  };
}

function buildJalaliDate({ year, month, day }: DateParts) {
  return `${toPersianDigits(String(year))}/${toPersianDigits(String(month).padStart(2, '0'))}/${toPersianDigits(String(day).padStart(2, '0'))}`;
}

function numberValue(value: string) {
  const result = Number(normalizeDigits(value).replace(/,/g, ''));
  return Number.isFinite(result) ? result : 0;
}

function faNumber(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function convertedTo750(weight: string, purity: string, baseKarat = 750) {
  const actualWeight = numberValue(weight);
  const carat = numberValue(purity);
  if (actualWeight <= 0 || carat <= 0 || baseKarat <= 0) return 0;
  return (actualWeight * carat) / baseKarat;
}

function metalPriceLabel(type: MetalPriceType) {
  if (type === 'mesghal17') return 'قیمت هر مثقال ۱۷ عیار';
  if (type === 'gram18') return 'قیمت هر گرم ۱۸ عیار';
  if (type === 'ounceUsd') return 'قیمت هر اونس';
  if (type === 'gramSilver925') return 'قیمت هر گرم نقره ۹۲۵';
  if (type === 'gramSilver995') return 'قیمت هر گرم نقره ۹۹۵';
  if (type === 'gramSilver999') return 'قیمت هر گرم نقره ۹۹۹';
  return 'قیمت هر گرم پلاتین';
}

function silverPricePurity(type: MetalPriceType) {
  if (type === 'gramSilver925') return 925;
  if (type === 'gramSilver995') return 995;
  if (type === 'gramSilver999') return 999;
  return 0;
}

function pricePerBaseGram(type: MetalPriceType, price: string, baseKarat = 750) {
  const value = numberValue(price);
  if (value <= 0) return 0;
  if (type === 'mesghal17') return value / MESGHAL_17_TO_GRAM_18;
  if (type === 'ounceUsd') return value / TROY_OUNCE_GRAMS;
  const silverPurity = silverPricePurity(type);
  if (silverPurity > 0) return value * (baseKarat / silverPurity);
  return value;
}

function totalFromWeight(weight: string, purity: string, type: MetalPriceType, price: string, baseKarat = 750) {
  return Math.round(convertedTo750(weight, purity, baseKarat) * pricePerBaseGram(type, price, baseKarat));
}

function convertedWeightFromTotal(total: string, type: MetalPriceType, price: string, baseKarat = 750) {
  const perGram = pricePerBaseGram(type, price, baseKarat);
  return perGram > 0 ? numberValue(total) / perGram : 0;
}

function actualWeightFromMoney(details: Pick<DetailState, 'totalAmount' | 'purity' | 'metalPriceType' | 'metalPrice' | 'metalType'>, baseKarat = 750) {
  const purityNumber = numberValue(details.purity);
  if (purityNumber <= 0 || baseKarat <= 0) return 0;
  return (convertedWeightFromTotal(details.totalAmount, details.metalPriceType, details.metalPrice, baseKarat) * baseKarat) / purityNumber;
}

function documentSubType(nature: DocumentNature, kind: RawOperationKind) {
  return `${nature === 'received' ? 'incoming' : 'outgoing'}-${kind}`;
}

function goldSaleSubType(nature: DocumentNature, kind: RawOperationKind) {
  return `${nature === 'received' ? 'gold-purchase' : 'gold-sale'}-${kind}`;
}

function currencyDocumentSubType(nature: DocumentNature) {
  return nature === 'received' ? 'currency-purchase' : 'currency-sale';
}

function createLine(nature: DocumentNature = 'received', sourceTab = 'metals'): DocumentLine {
  const docTab = sourceTab === 'currency'
    ? 'currency'
    : sourceTab === 'gold-sale'
      ? 'gold-sale'
      : sourceTab === 'workmanship'
        ? 'workmanship'
        : sourceTab === 'coin'
          ? 'coin'
          : sourceTab === 'cash'
            ? 'cash'
            : sourceTab === 'bank'
              ? 'bank'
              : sourceTab === 'claim'
                ? 'claim'
                : sourceTab === 'refining'
                  ? 'refining'
                  : 'raw-gold';
  return {
    id: crypto.randomUUID(),
    documentNature: nature,
    documentTab: docTab,
    sourceTab,
    documentSubType: sourceTab === 'refining'
      ? (nature === 'paid' ? 'outgoing-refining' : 'incoming-refining')
      : documentSubType(nature, 'molten'),
    settlementMethod: 'weight',
    balanceSource: 'current',
    description: '',
    details: {
      metalType: 'gold',
      baseKarat: 750,
      rawKind: 'molten',
      rawWeight: '',
      purity: '750',
      calculationMethod: 'weight',
      metalPriceType: 'gram18',
      metalPrice: '',
      totalAmount: '',
      labName: '',
      stampNumber: '',
      currencyUnit: '',
      currencyQuantity: '',
      currencyUnitPrice: '',
      currencyTotalAmount: '',
      unsettledTrade: false,
      currencyTradeId: '',
      settlementCurrencyUnit: '',
      settlementQuantity: '',
      settlesTradeId: '',
      inventorySourceId: '',
      refiningOpKind: nature === 'paid' ? 'delivery' : 'receipt',
    },
  };
}

type MetalType = DetailState['metalType'];

function baseKaratForMetal(
  metalType: MetalType,
  settings: Pick<AppSettings, 'goldBaseKarat' | 'silverBaseKarat' | 'platinumBaseKarat'>,
) {
  if (metalType === 'silver') return settings.silverBaseKarat;
  if (metalType === 'platinum') return settings.platinumBaseKarat;
  return settings.goldBaseKarat;
}

function createCurrencyLine(nature: DocumentNature = 'received'): DocumentLine {
  const line = createLine(nature, 'currency');
  return {
    ...line,
    documentTab: 'currency',
    sourceTab: 'currency',
    documentSubType: currencyDocumentSubType(nature),
    settlementMethod: 'cash',
    details: {
      ...line.details,
      currencyTradeId: line.id,
    },
  };
}

function isLineReady(line: DocumentLine) {
  if (line.documentTab === 'currency') {
    return numberValue(line.details.currencyQuantity) > 0
      && numberValue(line.details.currencyUnitPrice) > 0
      && numberValue(line.details.currencyTotalAmount) > 0;
  }
  if (line.documentTab === 'workmanship') {
    const rawWeight = numberValue(line.details.rawWeight);
    return rawWeight > 0 && Boolean(line.details.workmanshipName?.trim());
  }
  if (line.documentTab === 'refining') {
    const opKind = line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      return numberValue(line.details.totalAmount) > 0;
    }
    const rawWeight = numberValue(line.details.rawWeight);
    return rawWeight > 0;
  }
  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
    : numberValue(line.details.rawWeight);
  if (line.documentTab === 'raw-gold') return rawWeight > 0;
  return rawWeight > 0
    && numberValue(line.details.totalAmount) > 0
    && numberValue(line.details.metalPrice) > 0;
}

function validateLine(
  line: DocumentLine,
  inventory: MeltedInventoryItem[] = [],
  committedLines: DocumentLine[] = [],
  editingLineId: string | null = null,
) {
  if (line.documentTab === 'currency') {
    if (!line.details.currencyUnit) return 'واحد ارز را انتخاب کنید.';
    if (numberValue(line.details.currencyQuantity) <= 0) return 'تعداد ارز باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyUnitPrice) <= 0) return 'قیمت هر واحد باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyTotalAmount) <= 0) return 'مبلغ کل باید بیشتر از صفر باشد.';
    return '';
  }
  if (line.documentTab === 'workmanship') {
    const rawWeight = numberValue(line.details.rawWeight);
    if (rawWeight <= 0) return 'وزن کار ساخته باید بیشتر از صفر باشد.';
    if (!line.details.workmanshipName?.trim()) return 'نام کار ساخته را وارد کنید.';
    return '';
  }
  if (line.documentTab === 'refining') {
    const opKind = line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      if (numberValue(line.details.totalAmount) <= 0) return 'مبلغ اجرت ری‌گیری باید بیشتر از صفر باشد.';
      return '';
    }
    const rawWeight = numberValue(line.details.rawWeight);
    if (rawWeight <= 0) return 'وزن باید بیشتر از صفر باشد.';
    if (opKind !== 'sample_send') {
      const purityNum = numberValue(line.details.purity);
      if (purityNum <= 0 || purityNum > 1000) return 'عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.';
    }
    return '';
  }
  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
    : numberValue(line.details.rawWeight);
  if (rawWeight <= 0) {
    return 'وزن طلای خام باید بیشتر از صفر باشد.';
  }
  if (line.documentTab === 'gold-sale'
    && (numberValue(line.details.metalPrice) <= 0 || numberValue(line.details.totalAmount) <= 0)) {
    return 'نوع فی، قیمت فلز و مبلغ کل را کامل وارد کنید.';
  }
  if (
    line.documentNature === 'paid'
    && line.details.rawKind === 'molten'
    && !line.details.inventorySourceId
  ) {
    return 'برای خروج آبشده، یک موجودی فعال انتخاب کنید.';
  }
  if (
    line.documentNature === 'paid'
    && line.details.inventorySourceId
  ) {
    const sourceItem = inventory.find((item) => item.id === line.details.inventorySourceId);
    if (sourceItem) {
      const { availableRemaining } = getInventoryItemAvailability(sourceItem, committedLines, editingLineId);
      if (rawWeight > availableRemaining + 0.0000001) {
        return 'مقدار انتخاب‌شده بیشتر از موجودی قابل استفاده است.';
      }
    }
  }
  if (line.details.rawKind !== 'conditional') {
    const purityStr = normalizeDigits(line.details.purity).trim();
    const purityNum = numberValue(purityStr);
    if (!purityStr || purityNum <= 0) {
      return 'وارد کردن عیار برای این ردیف الزامی است.';
    }
    if (purityNum < 1 || purityNum > 1000) {
      return 'عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.';
    }
    if (purityStr.includes('.') && purityStr.split('.')[1].length > 1) {
      return 'عیار حداکثر می‌تواند ۱ رقم اعشار داشته باشد.';
    }
  }
  return '';
}



function getLineDocumentTypeLabel(
  nature: DocumentNature,
  tab: string,
  rawKind: RawOperationKind,
  unsettledTrade?: boolean,
  refiningOpKind?: string,
): string {
  if (tab === 'refining') {
    if (nature === 'paid') {
      if (refiningOpKind === 'sample_send') return 'ارسال پاکت ری‌گیری';
      return 'ارسال طلا به ری‌گیری';
    } else {
      if (refiningOpKind === 'sample_receive') return 'دریافت نتیجه پاکت ری‌گیری';
      if (refiningOpKind === 'fee') return 'اجرت ری‌گیری';
      return 'دریافت طلا از ری‌گیری';
    }
  }

  if (tab === 'currency') {
    if (unsettledTrade) {
      return nature === 'received' ? 'خرید ارز (بدون تسویه)' : 'فروش ارز (بدون تسویه)';
    }
    return nature === 'received' ? 'خرید ارز' : 'فروش ارز';
  }

  if (tab === 'cash') {
    return nature === 'received' ? 'دریافت نقد' : 'پرداخت نقد';
  }

  if (tab === 'workmanship') {
    return nature === 'received' ? 'ورود کار ساخته' : 'خروج کار ساخته';
  }

  if (tab === 'gold-sale') {
    if (rawKind === 'unsettled') return nature === 'received' ? 'خرید بدون تسویه' : 'فروش بدون تسویه';
    if (rawKind === 'misc') return nature === 'received' ? 'خرید متفرقه' : 'فروش متفرقه';
    return nature === 'received' ? 'خرید آب‌شده' : 'فروش آب‌شده';
  }

  // metals / raw-gold tab (ورود/خروج فلزات)
  if (rawKind === 'molten') return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
  if (rawKind === 'misc') return nature === 'received' ? 'ورود متفرقه' : 'خروج متفرقه';
  if (rawKind === 'conditional') return nature === 'received' ? 'ورود شرطی' : 'خروج شرطی';
  if (rawKind === 'question') return nature === 'received' ? 'ورود سواله' : 'خروج سواله';

  return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
}

function rawOperationLabel(nature: DocumentNature, kind: RawOperationKind) {
  if (kind === 'conditional') return nature === 'received' ? 'ورود شرطی' : 'خروج شرطی';
  if (kind === 'question') return nature === 'received' ? 'ورود سواله' : 'خروج سواله';
  const prefix = nature === 'received' ? 'خرید' : 'فروش';
  if (kind === 'misc') return `${prefix} متفرقه`;
  if (kind === 'unsettled') return `${prefix} بدون تسویه`;
  return `${prefix} آب‌شده`;
}

function getCustomerGroupBadge(groupName?: string) {
  const name = (groupName || '').trim();
  if (!name) return null;
  if (isRefinerGroup(name)) {
    return {
      label: 'ریگیر',
      classes: 'bg-amber-100 text-amber-900 border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    };
  }
  if (name === 'همکار' || name === 'بنکدار') {
    return {
      label: name,
      classes: 'bg-blue-100 text-blue-900 border-blue-300/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    };
  }
  if (name === 'supplier' || name === 'تأمین‌کننده') {
    return {
      label: 'تأمین‌کننده',
      classes: 'bg-purple-100 text-purple-900 border-purple-300/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    };
  }
  if (name === 'customer' || name === 'مشتری' || name === 'خریدار') {
    return {
      label: 'مشتری',
      classes: 'bg-emerald-100 text-emerald-900 border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    };
  }
  return {
    label: name,
    classes: 'bg-slate-100 text-slate-800 border-slate-300/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  };
}

export default function DocumentForm({
  customers,
}: {
  customers: Customer[];
  nextDocumentNumber?: number;
}) {
  const { settings } = useAppSettings();
  const weightPrecision = Number(settings.weightDecimalPlaces) || 3;
  const { goldBaseKarat, silverBaseKarat, platinumBaseKarat } = settings;
  const purityForMetal = (metalType: MetalType) => baseKaratForMetal(metalType, settings);
  const baseKaratForLine = (line: DocumentLine) => purityForMetal(line.details.metalType);
  const actualWeightForLine = (line: DocumentLine) => actualWeightFromMoney(line.details, baseKaratForLine(line));

  function createSettingsLine(nature: DocumentNature = 'received', sourceTab = 'metals') {
    const line = sourceTab === 'currency'
      ? createCurrencyLine(nature)
      : createLine(nature, sourceTab);
    return {
      ...line,
      details: {
        ...line.details,
        purity: String(purityForMetal(line.details.metalType)),
        baseKarat: purityForMetal(line.details.metalType),
      },
    };
  }

  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const customerSearchRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const [documentNumberDisplay, setDocumentNumberDisplay] = useState('');
  const [documentNumberLoading, setDocumentNumberLoading] = useState(false);
  const [documentId, setDocumentId] = useState(() => crypto.randomUUID());
  const [documentDateJalali, setDocumentDateJalali] = useState(() => formatJalaliDate());
  const [documentNature, setDocumentNature] = useState<DocumentNature>('received');
  const [draftLine, setDraftLine] = useState<DocumentLine>(() => createSettingsLine('received', 'metals'));
  const [committedLines, setCommittedLines] = useState<DocumentLine[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [activeEntryTab, setActiveEntryTab] = useState('metals');
  const [, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [lineValidationErrors, setLineValidationErrors] = useState<{ labName?: string; stampNumber?: string }>({});
  const labInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const [meltedInventory, setMeltedInventory] = useState<MeltedInventoryItem[]>([]);

  const [previewData, setPreviewData] = useState<{
    previousBalance: {
      rial: number;
      gold: number;
      silver: number;
      platinum: number;
      foreign: number;
      tertiary: number;
      secondaryCurrency?: string;
      secondaryCurrencySymbol?: string;
      tertiaryCurrency?: string;
      tertiaryCurrencySymbol?: string;
    };
    transactionEffect: {
      rial: number;
      gold: number;
      silver: number;
      platinum: number;
      foreign: number;
      tertiary: number;
    };
    projectedBalance: {
      rial: number;
      gold: number;
      silver: number;
      platinum: number;
      foreign: number;
      tertiary: number;
    };
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!selectedCustomerId) {
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    setPreviewLoading(true);

    const timer = setTimeout(() => {
      fetch('/api/transactions/preview-balance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          lines: committedLines.map((line) => ({
            documentNature: line.documentNature,
            documentTab: line.documentTab,
            sourceTab: line.sourceTab,
            details: line.details,
          })),
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((resData) => {
          if (resData?.success && resData?.data) {
            setPreviewData(resData.data);
          }
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setPreviewLoading(false);
          }
        });
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedCustomerId, committedLines]);

  // Close customer search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        customerSearchRef.current &&
        !customerSearchRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
        setActiveSuggestionIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Exit Navigation Guard Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Selection notice modal / toast
  const [noCustomerNotice, setNoCustomerNotice] = useState(false);

  // Deletion modal & restoration toast state
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<DocumentLine | null>(null);
  const [restorationState, setRestorationState] = useState<PendingDelete | null>(null);
  const [restorationTimer, setRestorationTimer] = useState<number>(10);

  // Hawala modal & floating pending hawala toast state
  const [hawalaLine, setHawalaLine] = useState<DocumentLine | null>(null);
  const [pendingHawala, setPendingHawala] = useState<PendingHawala | null>(null);

  const baseCurrency = (settings.baseCurrency || 'IRR') as 'IRR' | 'IRT';

  // The currencies collection is the single source for document currency fields.
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [addCurrencyError, setAddCurrencyError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCurrenciesLoading(true);
    fetch('/api/currencies', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.currencies)) {
          throw new Error(data.message || 'دریافت فهرست ارزها انجام نشد.');
        }
        return data.currencies as Currency[];
      })
      .then((currencies) => {
        setAvailableCurrencies(currencies);
        setSelectedCurrency((current) =>
          currencies.some((currency) => currency.code === current)
            ? current
            : currencies.find((currency) => currency.code === baseCurrency)?.code
              ?? currencies[0]?.code
              ?? '',
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAvailableCurrencies([]);
        setSelectedCurrency('');
        setErrorMessage(error instanceof Error ? error.message : 'دریافت فهرست ارزها انجام نشد.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCurrenciesLoading(false);
      });

    return () => controller.abort();
  }, [baseCurrency]);

  const activeCurrencies = useMemo(
    () => getCurrenciesForBaseCurrency(availableCurrencies, baseCurrency),
    [availableCurrencies, baseCurrency],
  );

  useEffect(() => {
    setSelectedCurrency((current) => {
      if (activeCurrencies.some((currency) => currency.code === current)) return current;
      return activeCurrencies.find((currency) => currency.code === baseCurrency)?.code
        ?? activeCurrencies[0]?.code
        ?? '';
    });
  }, [activeCurrencies, baseCurrency]);

  useEffect(() => {
    if (!selectedCurrency) return;
    setDraftLine((current) => {
      const currentUnit = current.details.currencyUnit.toUpperCase();
      const mustSyncDomesticUnit = currentUnit === 'IRR' || currentUnit === 'IRT';
      if (current.documentTab !== 'currency' || (current.details.currencyUnit && !mustSyncDomesticUnit)) {
        return current;
      }
      if (current.details.currencyUnit === selectedCurrency) return current;
      return {
          ...current,
          details: {
            ...current.details,
            currencyUnit: selectedCurrency,
            settlementCurrencyUnit: selectedCurrency,
          },
        };
    });
  }, [selectedCurrency, draftLine.documentTab]);

  // Document lines pin state initialized safely
  const [isLinesPinned, setIsLinesPinned] = useState<boolean>(false);

  // Keep a new draft synchronized with the global base purity settings.
  // Committed/editing lines are left untouched so historical assay values remain intact.
  useEffect(() => {
    if (editingLineId || committedLines.length > 0) return;
    const timer = window.setTimeout(() => {
      setDraftLine((current) => {
        if (current.details.rawKind === 'conditional') return current;
        const nextBaseKarat = baseKaratForMetal(current.details.metalType, {
          goldBaseKarat,
          silverBaseKarat,
          platinumBaseKarat,
        });
        const nextPurity = String(nextBaseKarat);
        return current.details.purity === nextPurity && current.details.baseKarat === nextBaseKarat
          ? current
          : { ...current, details: { ...current.details, purity: nextPurity, baseKarat: nextBaseKarat } };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    goldBaseKarat,
    silverBaseKarat,
    platinumBaseKarat,
    editingLineId,
    committedLines.length,
  ]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('zarfolio_document_lines_pinned');
      if (stored === 'true') {
        const timer = setTimeout(() => {
          setIsLinesPinned(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleLinesPin = () => {
    setIsLinesPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('zarfolio_document_lines_pinned', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Restoration timer interval
  useEffect(() => {
    if (!restorationState) return;
    const interval = setInterval(() => {
      setRestorationTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setRestorationState(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restorationState]);

  // Pending Hawala countdown interval and settlement execution
  useEffect(() => {
    if (!pendingHawala) return;
    const interval = setInterval(() => {
      setPendingHawala((prev) => {
        if (!prev) return null;
        if (prev.countdown <= 1) {
          clearInterval(interval);
          void finalizePendingHawala(prev);
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pendingHawala]);

  async function finalizePendingHawala(hawalaData: PendingHawala) {
    const { line, targetCustomer } = hawalaData;
    try {
      const res = await fetch('/api/settlements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'hawala',
          sourceCustomerId: selectedCustomerId,
          targetCustomerId: targetCustomer.id,
          lineId: line.id,
          lineSnapshot: line,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'خطا در ثبت حواله');
      }

      setCommittedLines((current) => current.filter((l) => l.id !== line.id));
      setMessage(`حواله ردیف سند به طرف‌حساب «${targetCustomer.name}» با موفقیت ثبت شد.`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'خطای ثبت حواله');
    }
  }

  function cancelPendingHawala() {
    setPendingHawala(null);
    setMessage('حواله لغو شد و هیچ تغییری در سند و طرف‌حساب ایجاد نگردید.');
  }

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );

  const effectiveDocumentNumberDisplay = selectedCustomerId
    ? documentNumberDisplay
    : 'انتخاب نشده';

  const suggestions = useMemo(() => {
    if (selectedCustomer) return [];
    const rawQuery = customerQuery.trim().toLocaleLowerCase();
    const normalizedQuery = normalizeDigits(rawQuery);

    if (!rawQuery) {
      return isCustomerDropdownOpen ? customers.slice(0, 8) : [];
    }

    return customers
      .filter((customer) => {
        const name = (customer.name || '').toLocaleLowerCase();
        const englishName = (customer.englishName || '').toLocaleLowerCase();
        const code = normalizeDigits(String(customer.customerCode || ''));
        const p1 = normalizeDigits(customer.phone1 || '');
        const p2 = normalizeDigits(customer.phone2 || '');
        const p3 = normalizeDigits(customer.phone3 || '');
        const group = (customer.groupName || '').toLocaleLowerCase();
        const city = (customer.city || '').toLocaleLowerCase();
        const nationalId = normalizeDigits(customer.nationalId || '');
        const isRefinerMatch = isRefinerGroup(rawQuery) && isRefinerGroup(customer.groupName);

        return (
          isRefinerMatch ||
          name.includes(rawQuery) ||
          englishName.includes(rawQuery) ||
          code.includes(normalizedQuery) ||
          p1.includes(normalizedQuery) ||
          p2.includes(normalizedQuery) ||
          p3.includes(normalizedQuery) ||
          group.includes(rawQuery) ||
          city.includes(rawQuery) ||
          nationalId.includes(normalizedQuery)
        );
      })
      .slice(0, 10);
  }, [customerQuery, customers, selectedCustomer, isCustomerDropdownOpen]);

  const draftReady = isLineReady(draftLine);
  const currencyUnits = useMemo(() => {
    return activeCurrencies.map((currency) => currency.code);
  }, [activeCurrencies]);

  // Per-customer document number querying
  useEffect(() => {
    if (!selectedCustomerId) {
      return;
    }

    const controller = new AbortController();
    fetch(`/api/documents?customerId=${encodeURIComponent(selectedCustomerId)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          documentNumber?: string;
          nextDocumentSequence?: number;
          message?: string;
        };
        if (!response.ok || !data.documentNumber) {
          throw new Error(data.message ?? 'شماره سند دریافت نشد.');
        }
        setDocumentNumberDisplay(data.documentNumber);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setErrorMessage('استعلام شماره سند این طرف‌حساب انجام نشد؛ دوباره تلاش کنید.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocumentNumberLoading(false);
      });

    return () => controller.abort();
  }, [selectedCustomerId]);

  useEffect(() => {
    if (documentNature !== 'paid') return;
    const kind = draftLine.details.rawKind;
    if (kind === 'unsettled') return;
    const url = `/api/documents?inventory=raw-gold&kind=${kind}`;
    fetch(url, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { inventory?: MeltedInventoryItem[] }) => setMeltedInventory(data.inventory ?? []))
      .catch(() => setMeltedInventory([]));
  }, [documentNature, draftLine.details.rawKind]);

  const isFormDirty = Boolean(selectedCustomerId && (committedLines.length > 0 || draftReady));

  // Handle browser close/refresh beforeunload
  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (isFormDirty) {
        event.preventDefault();
        event.returnValue = 'شما در حال ثبت سند می‌باشید و اگر صفحه را ترک کنید، اطلاعاتی که وارد کرده‌اید ذخیره نخواهد شد. آیا از انجام این کار مطمئن هستید؟';
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isFormDirty]);

  // Handle internal navigation intercept
  useEffect(() => {
    function handleNavigationAttempt(event: Event) {
      const customEvent = event as CustomEvent<{ url?: string }>;
      if (isFormDirty) {
        event.preventDefault();
        setPendingNavigationUrl(customEvent.detail?.url || '/');
        setShowExitModal(true);
      }
    }
    window.addEventListener('zar:navigation-attempt', handleNavigationAttempt);
    return () => window.removeEventListener('zar:navigation-attempt', handleNavigationAttempt);
  }, [isFormDirty]);

  async function handleAddCustomCurrency(e: React.FormEvent) {
    e.preventDefault();
    setAddCurrencyError('');
    const name = newCurrencyName.trim();
    const symbol = newCurrencySymbol.trim();
    const code = newCurrencyCode.trim().toUpperCase();
    if (!name || !symbol || !code) {
      setAddCurrencyError('نام، نماد و کد ارز الزامی است.');
      return;
    }

    const isDuplicate = availableCurrencies.some(
      (currency) => currency.name.toLocaleLowerCase('fa-IR') === name.toLocaleLowerCase('fa-IR')
        || currency.code.toUpperCase() === code,
    );

    if (isDuplicate) {
      const duplicate = availableCurrencies.find(
        (currency) => currency.name.toLocaleLowerCase('fa-IR') === name.toLocaleLowerCase('fa-IR')
          || currency.code.toUpperCase() === code,
      );
      setAddCurrencyError(`ارز «${duplicate?.name || name}» با کد ${duplicate?.code || code} قبلاً ثبت شده است.`);
      return;
    }

    setAddingCurrency(true);
    try {
      const response = await fetch('/api/currencies', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, symbol, code }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'ثبت ارز جدید انجام نشد.');

      const created = data.currency as Currency;
      setAvailableCurrencies((current) => [...current, created]);
      setSelectedCurrency(created.code);
      updateDraftDetail('currencyUnit', created.code);
      updateDraftDetail('settlementCurrencyUnit', created.code);
      setNewCurrencyName('');
      setNewCurrencySymbol('');
      setNewCurrencyCode('');
      setShowAddCurrencyModal(false);
      setMessage(`ارز «${created.name}» با موفقیت به فهرست اضافه و انتخاب شد.`);
    } catch (error) {
      setAddCurrencyError(error instanceof Error ? error.message : 'ثبت ارز جدید انجام نشد.');
    } finally {
      setAddingCurrency(false);
    }
  }

  function handleKeyDownEnter(
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    if (event.key === 'Enter' && event.currentTarget.tagName !== 'TEXTAREA') {
      event.preventDefault();
      const container = event.currentTarget.closest('.document-special-grid') || event.currentTarget.closest('.document-draft-editor');
      if (container) {
        const elements = Array.from(
          container.querySelectorAll<HTMLElement>(
            'input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button.document-commit-line-button',
          ),
        );
        const currentIndex = elements.indexOf(event.currentTarget);
        if (currentIndex >= 0 && currentIndex < elements.length - 1) {
          elements[currentIndex + 1].focus();
        }
      }
    }
  }

  function updateDraftDetail<K extends keyof DetailState>(
    field: K,
    value: DetailState[K],
  ) {
    setDraftLine((current) => ({
      ...current,
      details: {
        ...current.details,
        [field]: value,
      },
    }));
  }

  function chooseCustomer(customer: Customer) {
    setErrorMessage('');
    setDocumentNumberLoading(true);
    setSelectedCustomerId(customer.id);
    setCustomerQuery(`${customer.customerCode} - ${customer.name}`);
    setIsCustomerDropdownOpen(false);
    setActiveSuggestionIndex(-1);
  }

  function clearCustomer() {
    setSelectedCustomerId('');
    setCustomerQuery('');
    setDocumentNumberDisplay('');
    setDocumentNumberLoading(false);
    setIsCustomerDropdownOpen(true);
    setActiveSuggestionIndex(-1);
    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 50);
  }

  function handleCustomerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isCustomerDropdownOpen || suggestions.length === 0) {
      if (event.key === 'ArrowDown') {
        setIsCustomerDropdownOpen(true);
        setActiveSuggestionIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
        chooseCustomer(suggestions[activeSuggestionIndex]);
      } else if (suggestions.length === 1) {
        chooseCustomer(suggestions[0]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsCustomerDropdownOpen(false);
      setActiveSuggestionIndex(-1);
    }
  }

  function changeNature(nature: DocumentNature) {
    setDocumentNature(nature);
    setDraftLine((current) => ({
      ...current,
      documentNature: nature,
      documentSubType: current.documentTab === 'currency'
        ? currencyDocumentSubType(nature)
        : current.documentTab === 'gold-sale'
          ? goldSaleSubType(nature, current.details.rawKind)
          : documentSubType(nature, current.details.rawKind),
    }));
  }

  function changeEntryTab(tab: string) {
    setActiveEntryTab(tab);
    if (editingLineId) return;

    if (draftLine.sourceTab === tab) return;
    if (tab === 'currency') {
      setDraftLine(createCurrencyLine(documentNature));
    } else {
      setDraftLine(createSettingsLine(documentNature, tab));
    }
  }

  function updateCurrencyValue(
    field: 'currencyQuantity' | 'currencyUnitPrice' | 'currencyTotalAmount',
    value: string,
  ) {
    setDraftLine((current) => {
      const details = { ...current.details, [field]: value };
      const quantity = numberValue(details.currencyQuantity);
      const unitPrice = numberValue(details.currencyUnitPrice);
      const total = numberValue(details.currencyTotalAmount);

      if (field === 'currencyQuantity') {
        if (unitPrice > 0) details.currencyTotalAmount = String(quantity * unitPrice);
        else if (total > 0 && quantity > 0) details.currencyUnitPrice = String(total / quantity);
      } else if (field === 'currencyUnitPrice') {
        if (quantity > 0) details.currencyTotalAmount = String(quantity * unitPrice);
        else if (total > 0 && unitPrice > 0) details.currencyQuantity = String(total / unitPrice);
      } else if (field === 'currencyTotalAmount') {
        if (quantity > 0) details.currencyUnitPrice = String(total / quantity);
        else if (unitPrice > 0) details.currencyQuantity = String(total / unitPrice);
      }

      return {
        ...current,
        settlementMethod: details.unsettledTrade ? 'unsettled' : 'cash',
        details,
      };
    });
  }

  function changeRawKind(kind: RawOperationKind) {
    setDraftLine((current) => {
      const details: DetailState = {
        ...current.details,
        rawKind: kind,
        purity: kind === 'conditional' ? '' : current.details.purity || String(purityForMetal(current.details.metalType)),
        labName: (kind === 'misc' || kind === 'question') ? '' : current.details.labName,
        stampNumber: (kind === 'misc' || kind === 'question') ? '' : current.details.stampNumber,
      };
      return {
        ...current,
        documentSubType: current.documentTab === 'gold-sale'
          ? goldSaleSubType(documentNature, kind)
          : documentSubType(documentNature, kind),
        settlementMethod: kind === 'unsettled' ? 'unsettled' : 'weight',
        details,
      };
    });
  }

  function updateMetalValue(
    field: 'rawWeight' | 'purity' | 'calculationMethod' | 'metalPriceType' | 'metalPrice' | 'totalAmount',
    value: string,
  ) {
    setDraftLine((current) => {
      const details = { ...current.details, [field]: value } as DetailState;
      if (field === 'calculationMethod') {
        details.calculationMethod = value as CalculationMethod;
      }
      const baseKarat = purityForMetal(details.metalType);
      details.baseKarat = baseKarat;
      const converted = convertedTo750(details.rawWeight, details.purity, baseKarat);
      if (details.calculationMethod === 'weight') {
        if (field !== 'totalAmount') {
          details.totalAmount = String(totalFromWeight(
            details.rawWeight,
            details.purity,
            details.metalPriceType,
            details.metalPrice,
            baseKarat,
          ) || '');
        }
      } else {
        const computed = convertedWeightFromTotal(
          details.totalAmount,
          details.metalPriceType,
          details.metalPrice,
          baseKarat,
        );
        if (computed > 0) details.rawWeight = String((computed * baseKarat) / Math.max(1, numberValue(details.purity)));
      }
      if (details.calculationMethod === 'weight' && field === 'metalPriceType' && converted > 0) {
        details.totalAmount = String(totalFromWeight(details.rawWeight, details.purity, details.metalPriceType, details.metalPrice, baseKarat) || '');
      }
      return {
        ...current,
        settlementMethod: details.rawKind === 'unsettled' ? 'unsettled' : 'weight',
        details,
      };
    });
  }

  function validateGoldAssayFields(line: DocumentLine): { valid: boolean; errorMsg?: string; errors: { labName?: string; stampNumber?: string }; firstFocusField?: 'lab' | 'stamp' } {
    const isGold = line.details.metalType === 'gold';
    const isMoltenOrConditional = line.details.rawKind === 'molten' || line.details.rawKind === 'conditional';
  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
      : numberValue(line.details.rawWeight);

    if (isGold && isMoltenOrConditional && rawWeight > 0) {
      const isConditional = line.details.rawKind === 'conditional';
      const kindLabel = isConditional ? 'طلای شرطی' : 'طلای آب‌شده';
      const labName = line.details.labName?.trim();
      const stampNumber = line.details.stampNumber?.trim();

      if (!labName) {
        const msg = `برای ثبت ${kindLabel}، وارد کردن نام آزمایشگاه یا ری‌گیری الزامی است.`;
        return { valid: false, errorMsg: msg, errors: { labName: msg }, firstFocusField: 'lab' };
      }
      if (!stampNumber) {
        const msg = `برای ثبت ${kindLabel}، وارد کردن شماره پاکت یا انگ الزامی است.`;
        return { valid: false, errorMsg: msg, errors: { stampNumber: msg }, firstFocusField: 'stamp' };
      }
    }
    return { valid: true, errors: {} };
  }

  function commitDraftLine() {
    const validationMessage = validateLine(draftLine, meltedInventory, committedLines, editingLineId);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const assayCheck = validateGoldAssayFields(draftLine);
    if (!assayCheck.valid) {
      setLineValidationErrors(assayCheck.errors);
      setErrorMessage(assayCheck.errorMsg || '');
      if (assayCheck.firstFocusField === 'lab') {
        labInputRef.current?.focus();
      } else if (assayCheck.firstFocusField === 'stamp') {
        stampInputRef.current?.focus();
      }
      return;
    }

    setLineValidationErrors({});
    setErrorMessage('');

    const lineSourceTab = draftLine.sourceTab || (draftLine.documentTab === 'currency' ? 'currency' : draftLine.documentTab === 'gold-sale' ? 'gold-sale' : draftLine.documentTab === 'refining' ? 'refining' : 'metals');
    const docTypeLabel = getLineDocumentTypeLabel(
      documentNature,
      lineSourceTab,
      draftLine.details.rawKind,
      draftLine.details.unsettledTrade,
      draftLine.details.refiningOpKind,
    );

    const rawWeight = draftLine.details.calculationMethod === 'money'
      ? actualWeightForLine(draftLine)
      : numberValue(draftLine.details.rawWeight);
    const baseKarat = baseKaratForLine(draftLine);
    const c750 = convertedTo750(String(rawWeight), draftLine.details.purity, baseKarat);

    // Snapshot current documentNature, documentTypeLabel, converted750, and user description
    const lineToCommit: DocumentLine = {
      ...draftLine,
      documentNature,
      sourceTab: lineSourceTab,
      documentTypeLabel: docTypeLabel,
      converted750: c750,
      description: draftLine.description ? draftLine.description.trim() : '',
      details: { ...draftLine.details, baseKarat },
    };

    let supplementaryCashLine: DocumentLine | null = null;
    if (draftLine.documentTab === 'currency' && !draftLine.details.unsettledTrade) {
       const isReceived = documentNature === 'received';
       supplementaryCashLine = {
         id: draftLine.id ? draftLine.id + '-cash' : crypto.randomUUID(),
         documentNature: isReceived ? 'received' : 'paid',
         documentTab: 'cash',
         sourceTab: 'cash',
         documentSubType: 'cash-operation',
         documentTypeLabel: isReceived ? 'دریافت اسکناس ارز' : 'پرداخت اسکناس ارز',
         description: `تسویه نقدی معامله ${draftLine.details.currencyUnit}`,
         converted750: 0,
         settlementMethod: 'cash',
         balanceSource: 'current',
         details: {
           ...createCurrencyLine(documentNature).details,
           totalAmount: draftLine.details.currencyQuantity,
           currencyUnit: draftLine.details.currencyUnit,
           isForeignCash: true,
         }
       };
    }

    if (editingLineId) {
      setCommittedLines((current) => {
        const existingMainIndex = current.findIndex(l => l.id === editingLineId);
        if (existingMainIndex === -1) return current;

        const existingMain = current[existingMainIndex];
        const linkedCashId = existingMain.details.linkedLineId;

        let newLines = [...current];
        newLines[existingMainIndex] = { ...lineToCommit, id: existingMain.id };

        if (supplementaryCashLine) {
           supplementaryCashLine.id = linkedCashId || (existingMain.id + '-cash');
           supplementaryCashLine.details.linkedLineId = existingMain.id;
           newLines[existingMainIndex].details.linkedLineId = supplementaryCashLine.id;

           if (linkedCashId) {
             const cashIndex = newLines.findIndex(l => l.id === linkedCashId);
             if (cashIndex > -1) newLines[cashIndex] = supplementaryCashLine;
             else newLines.push(supplementaryCashLine);
           } else {
             newLines.push(supplementaryCashLine);
           }
        } else if (linkedCashId) {
           newLines = newLines.filter(l => l.id !== linkedCashId);
           delete newLines[existingMainIndex].details.linkedLineId;
        }

        return newLines;
      });
      setEditingLineId(null);
    } else {
      setCommittedLines((current) => {
        const newMainId = lineToCommit.id || crypto.randomUUID();
        lineToCommit.id = newMainId;
        const newLines = [...current, lineToCommit];

        if (supplementaryCashLine) {
           supplementaryCashLine.id = newMainId + '-cash';
           supplementaryCashLine.details.linkedLineId = newMainId;
           lineToCommit.details.linkedLineId = supplementaryCashLine.id;
           newLines.push(supplementaryCashLine);
        }
        return newLines;
      });
    }
    setDraftLine(draftLine.documentTab === 'currency'
      ? createCurrencyLine(documentNature)
      : { ...createSettingsLine(documentNature, activeEntryTab), documentTab: draftLine.documentTab });
  }

  function editLine(line: DocumentLine) {
    const lineSourceTab = line.sourceTab || (line.documentTab === 'currency' ? 'currency' : line.documentTab === 'gold-sale' ? 'gold-sale' : line.documentTab === 'refining' ? 'refining' : 'metals');
    setDraftLine(line);
    setEditingLineId(line.id);
    setActiveEntryTab(lineSourceTab);
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setDraftLine(createSettingsLine(documentNature, activeEntryTab));
    setEditingLineId(null);
    setErrorMessage('');
  }

  function requestRemoveLine(line: DocumentLine) {
    setDeleteConfirmLine(line);
  }

  function confirmRemoveLine() {
    if (!deleteConfirmLine) return;
    const lineToRemove = deleteConfirmLine;
    const index = committedLines.findIndex((line) => line.id === lineToRemove.id);

    setCommittedLines((current) => current.filter((line) => line.id !== lineToRemove.id));
    if (editingLineId === lineToRemove.id) cancelEdit();

    setRestorationTimer(10);
    setRestorationState({ line: lineToRemove, index: index >= 0 ? index : committedLines.length - 1 });
    setDeleteConfirmLine(null);
  }

  function restoreLine() {
    if (!restorationState) return;
    const { line, index } = restorationState;
    setCommittedLines((current) => {
      const copy = [...current];
      const targetIndex = Math.min(index, copy.length);
      copy.splice(targetIndex, 0, line);
      return copy;
    });
    setRestorationState(null);
  }

  async function save(status: 'temporary' | 'final') {
    setSaving(true);
    setMessage('');
    setErrorMessage('');

    try {
      if (!selectedCustomerId) {
        setNoCustomerNotice(true);
        setTimeout(() => setNoCustomerNotice(false), 5000);
        throw new Error('ابتدا طرف حساب را از فهرست انتخاب کنید');
      }
      if (documentNumberLoading) {
        throw new Error('لطفاً تا پایان استعلام شماره سند صبر کنید.');
      }
      if (!committedLines.length) {
        throw new Error(
          draftReady
            ? 'اطلاعات ردیف وارد شده است؛ ابتدا «ثبت ردیف» را بزنید.'
            : 'هنوز هیچ ردیفی به سند اضافه نشده است.',
        );
      }

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          documentId,
          documentDateJalali,
          status,
          lines: committedLines.map((line) => ({
            documentNature: line.documentNature,
            documentTab: line.documentTab,
            sourceTab: line.sourceTab,
            documentSubType: line.documentSubType,
            settlementMethod: line.settlementMethod,
            balanceSource: line.balanceSource,
            description: line.description,
            documentDetails: line.details,
            goldAmount: (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale' || line.documentTab === 'refining') && line.details.metalType === 'gold' && line.details.refiningOpKind !== 'fee'
              ? line.details.calculationMethod === 'money'
                ? actualWeightForLine(line)
                : numberValue(line.details.rawWeight)
              : 0,
            silverAmount: (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale' || line.documentTab === 'refining') && line.details.metalType === 'silver' && line.details.refiningOpKind !== 'fee'
              ? line.details.calculationMethod === 'money' ? actualWeightForLine(line) : numberValue(line.details.rawWeight)
              : 0,
            platinumAmount: (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale' || line.documentTab === 'refining') && line.details.metalType === 'platinum' && line.details.refiningOpKind !== 'fee'
              ? line.details.calculationMethod === 'money' ? actualWeightForLine(line) : numberValue(line.details.rawWeight)
              : 0,
            rialAmount: line.documentTab === 'currency'
              ? numberValue(line.details.currencyTotalAmount)
              : line.documentTab === 'cash' && !line.details.isForeignCash
                ? numberValue(line.details.totalAmount)
                : line.documentTab === 'gold-sale'
                  ? numberValue(line.details.totalAmount)
                  : line.documentTab === 'refining' && line.details.refiningOpKind === 'fee'
                    ? numberValue(line.details.totalAmount)
                    : 0,
            foreignAmount: line.documentTab === 'currency'
              ? numberValue(line.details.currencyQuantity)
              : line.documentTab === 'cash' && line.details.isForeignCash
                ? numberValue(line.details.totalAmount)
                : 0,
            tertiaryAmount: 0,
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
          message?: string;
          documentNumber?: string;
        }
        | null;

      if (!response.ok) {
        throw new Error(data?.message ?? 'ثبت سند انجام نشد.');
      }

      const registeredNumber = data?.documentNumber ?? documentNumberDisplay;
      setMessage(
        `سند شماره ${toPersianDigits(registeredNumber)} با ${faNumber(committedLines.length)} ردیف ثبت شد.`,
      );

      // Refresh next document number for this customer
      if (selectedCustomerId) {
        setDocumentNumberLoading(true);
        fetch(`/api/documents?customerId=${encodeURIComponent(selectedCustomerId)}`, { cache: 'no-store' })
          .then((res) => res.json())
          .then((d) => { if (d.documentNumber) setDocumentNumberDisplay(d.documentNumber); })
          .finally(() => setDocumentNumberLoading(false));
      }

      setCommittedLines([]);
      setDocumentId(crypto.randomUUID());
      setDraftLine(activeEntryTab === 'currency'
        ? createCurrencyLine(documentNature)
        : { ...createSettingsLine(documentNature, activeEntryTab), documentTab: activeEntryTab === 'gold-sale' ? 'gold-sale' : 'raw-gold' });
      setEditingLineId(null);

      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (status === 'temporary') {
        setMessage(`سند شماره ${toPersianDigits(registeredNumber)} به صورت موقت ذخیره شد.`);
      } else {
        setMessage('سند با موفقیت نهایی شد.');
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  const metalNetEffects = useMemo(() => {
    const effects: Record<'gold' | 'silver' | 'platinum', number> = {
      gold: 0,
      silver: 0,
      platinum: 0,
    };

    committedLines.forEach((line) => {
      if (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale' || (line.documentTab === 'refining' && line.details.refiningOpKind !== 'fee')) {
        const metal = line.details.metalType || 'gold';
        const weight = line.details.calculationMethod === 'money'
          ? actualWeightForLine(line)
          : numberValue(line.details.rawWeight);
        const direction = line.documentNature === 'received' ? 1 : -1;
        effects[metal] += direction * weight;
      }
    });

    return effects;
  }, [committedLines]);

  const activeMetals = useMemo(
    () => (Object.keys(metalNetEffects) as Array<'gold' | 'silver' | 'platinum'>).filter(
      (m) => metalNetEffects[m] !== 0,
    ),
    [metalNetEffects],
  );

  const hasAssayOrStamp = useMemo(() => {
    return committedLines.some(
      (line) =>
        Boolean(line.details?.stampNumber || line.details?.labName) ||
        ((line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale' || line.documentTab === 'refining' || line.sourceTab === 'metals' || line.sourceTab === 'gold-sale' || line.sourceTab === 'refining') &&
        (line.details?.rawKind === 'molten' || line.details?.rawKind === 'conditional')),
    );
  }, [committedLines]);

  const hasFinancialAmounts = useMemo(() => {
    return committedLines.some(
      (line) =>
        line.documentTab === 'currency' ||
        line.documentTab === 'cash' ||
        line.sourceTab === 'currency' ||
        line.sourceTab === 'cash' ||
        (line.documentTab === 'refining' && line.details?.refiningOpKind === 'fee') ||
        numberValue(line.details?.totalAmount) > 0 ||
        numberValue(line.details?.currencyTotalAmount) > 0,
    );
  }, [committedLines]);

  // Identify editing line source tab for smart blur
  const editingLine = editingLineId ? committedLines.find((line) => line.id === editingLineId) || (draftLine.id === editingLineId ? draftLine : null) : null;
  const editingSourceTab = editingLine
    ? (editingLine.sourceTab || (editingLine.documentTab === 'currency' ? 'currency' : editingLine.documentTab === 'gold-sale' ? 'gold-sale' : editingLine.documentTab === 'refining' ? 'refining' : 'metals'))
    : null;

  return (
    <div className={`document-form-page ${isLinesPinned ? 'pb-36' : ''}`}>
      {message ? <p className="account-message"><Check size={15} />{message}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      {/* No customer notice toast */}
      <AnimatePresence>
        {noCustomerNotice ? (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-rose-300 bg-rose-500 px-5 py-3 text-white shadow-xl text-xs font-bold"
          >
            ابتدا طرف حساب را از فهرست انتخاب کنید
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* UNIFIED CONTAINER: Customer Selection + Document Meta */}
      <section className="dashboard-panel document-account-panel document-account-panel--document-entry p-4 space-y-4">
        {/* Top Row: Customer Selection (Right) & Document Number (Immediately After) */}
        <div className="grid gap-2 lg:grid-cols-[1fr_auto] items-end">
          {/* Customer Selection Search / Selected Card */}
          <div className="space-y-1.5" ref={customerSearchRef}>
            <AnimatePresence mode="wait" initial={false}>
              {!selectedCustomer ? (
                <motion.div
                  key="search-mode"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="w-full"
                >
                  <div className="account-field document-account-search-field max-w-none">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">طرف‌حساب</span>
                    <div className="gooey-search document-search-shell relative">
                      <Search size={16} className="text-slate-400 shrink-0" />
                      <input
                        ref={customerInputRef}
                        value={customerQuery}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        onChange={(event) => {
                          setCustomerQuery(event.target.value);
                          setIsCustomerDropdownOpen(true);
                          setActiveSuggestionIndex(-1);
                        }}
                        onKeyDown={handleCustomerKeyDown}
                        placeholder="جستجو با نام، کد، تلفن یا گروه (مثلاً ریگیر)..."
                        autoComplete="off"
                      />
                      {customerQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerQuery('');
                            setActiveSuggestionIndex(-1);
                            customerInputRef.current?.focus();
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors rounded-lg shrink-0 cursor-pointer"
                          title="پاک کردن متن جستجو"
                          aria-label="پاک کردن"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>

                    {isCustomerDropdownOpen ? (
                      suggestions.length > 0 ? (
                        <div className="document-customer-suggestions" role="listbox">
                          {suggestions.map((customer, idx) => {
                            const groupBadge = getCustomerGroupBadge(customer.groupName);
                            const isHighlighted = idx === activeSuggestionIndex;
                            const phone = customer.phone1 || customer.phone2 || customer.phone3 || '';

                            return (
                              <button
                                type="button"
                                key={customer.id}
                                role="option"
                                aria-selected={isHighlighted}
                                className={isHighlighted ? 'is-active' : ''}
                                onMouseEnter={() => setActiveSuggestionIndex(idx)}
                                onClick={() => chooseCustomer(customer)}
                              >
                                {/* Right side: Avatar + Name + Code + Group */}
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="document-suggestion-avatar shrink-0">
                                    {customer.name.charAt(0)}
                                  </span>
                                  <div className="min-w-0 text-right">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <strong className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                                        {customer.name}
                                      </strong>
                                      {groupBadge ? (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${groupBadge.classes}`}>
                                          <Tag size={10} />
                                          {groupBadge.label}
                                        </span>
                                      ) : null}
                                    </div>
                                    <small className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5">
                                      کد: {toPersianDigits(String(customer.customerCode))}
                                    </small>
                                  </div>
                                </div>

                                {/* Left side: Phone + City */}
                                <div className="flex flex-col items-end gap-1 shrink-0 text-left pl-1">
                                  {phone ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60" dir="ltr">
                                      <Phone size={11} className="text-amber-600 dark:text-amber-400" />
                                      {toPersianDigits(phone)}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">فاقد شماره</span>
                                  )}
                                  {customer.city ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                      <MapPin size={10} className="text-slate-400" />
                                      {customer.city}
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : customerQuery.trim() ? (
                        <div className="document-customer-suggestions p-4 text-center">
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            طرف‌حسابی با مشخصات وارد شده یافت نشد.
                          </p>
                        </div>
                      ) : null
                    ) : null}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="selected-mode"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="w-full flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 rounded-2xl border border-teal-300/80 bg-gradient-to-r from-teal-50/90 via-emerald-50/40 to-teal-50/70 p-3 sm:px-4 sm:py-2.5 dark:border-teal-800/80 dark:bg-gradient-to-r dark:from-teal-950/40 dark:via-slate-900/60 dark:to-emerald-950/30 shadow-xs transition-all duration-300"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="document-suggestion-avatar shrink-0 w-10 h-10 bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border border-teal-200 dark:border-teal-700/60 rounded-xl flex items-center justify-center font-black text-sm">
                      {selectedCustomer.name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-sm font-black text-slate-900 dark:text-slate-100">
                          {selectedCustomer.name}
                        </strong>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          کد: {toPersianDigits(String(selectedCustomer.customerCode))}
                        </span>
                        {(() => {
                          const badge = getCustomerGroupBadge(selectedCustomer.groupName);
                          return badge ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.classes}`}>
                              <Tag size={10} />
                              گروه: {badge.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                        {(selectedCustomer.phone1 || selectedCustomer.phone2 || selectedCustomer.phone3) ? (
                          <span className="inline-flex items-center gap-1 font-bold" dir="ltr">
                            <Phone size={12} className="text-teal-600 dark:text-teal-400" />
                            {toPersianDigits(selectedCustomer.phone1 || selectedCustomer.phone2 || selectedCustomer.phone3 || '')}
                          </span>
                        ) : null}
                        {selectedCustomer.city ? (
                          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                            <MapPin size={11} className="text-slate-400" />
                            {selectedCustomer.city}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="flex items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100/70 hover:shadow-xs dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-slate-700 shrink-0 cursor-pointer self-center"
                    title="تغییر یا انتخاب طرف‌حساب دیگر"
                  >
                    <ArrowLeftRight size={13} />
                    <span>تغییر طرف‌حساب</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* The public document sequence remains visible; the persistent ZF id is intentionally not shown here. */}
          <div className="w-full lg:w-48 flex flex-col justify-end">
            <Field label="شماره سند">
              <div className="document-number-field">
                <input
                  value={documentNumberLoading ? 'در حال استعلام...' : toPersianDigits(effectiveDocumentNumberDisplay)}
                  readOnly
                  className="bg-slate-100 dark:bg-slate-800/80 font-bold text-xs h-9"
                  aria-label="شماره سند"
                />
                {documentNumberLoading ? <LoaderCircle size={15} className="spin" /> : <Check size={14} />}
              </div>
            </Field>
          </div>
        </div>

        {/* Customer Balance row */}
        <AnimatePresence mode="wait">
          {selectedCustomer ? (
            <CustomerBalanceLiquid
              key={selectedCustomer.id}
              customer={selectedCustomer}
            />
          ) : null}
        </AnimatePresence>

        {/* Bottom Metadata Row: Document Nature (Switch) + Metal Type + Currency Type + Document Date */}
        <div className="flex flex-wrap lg:flex-nowrap gap-3 items-end">
          <div className="w-full sm:w-auto shrink-0 min-w-[190px]">
            <Field label="نوع سند">
              <button
                type="button"
                className={`document-nature-switch ${documentNature}`}
                onClick={() => changeNature(documentNature === 'received' ? 'paid' : 'received')}
                role="switch"
                aria-checked={documentNature === 'received'}
              >
                <span className="document-nature-switch-track">
                  <motion.span
                    className="document-nature-switch-thumb"
                    animate={{ x: documentNature === 'received' ? 0 : -26 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35, bounce: 0 }}
                  />
                </span>
                <strong>سند {documentNature === 'received' ? 'دریافتی' : 'پرداختی'}</strong>
              </button>
            </Field>
          </div>

          <div className="w-full sm:w-36 shrink-0">
            <Field label="جنس فلز">
              <select
                className="text-xs h-9"
                value={draftLine.details.metalType}
                onChange={(event) => {
                  const metalType = event.target.value as MetalType;
                  setDraftLine((current) => ({
                    ...current,
                    details: {
                      ...current.details,
                      metalType,
                      purity: String(purityForMetal(metalType)),
                      baseKarat: purityForMetal(metalType),
                      metalPriceType: metalType === 'silver' ? 'gramSilver999' : metalType === 'platinum' ? 'gramPlatinum' : 'gram18',
                    },
                  }));
                }}
              >
                <option value="gold">طلای خام</option>
                <option value="silver">نقره</option>
                <option value="platinum">پلاتین</option>
              </select>
            </Field>
          </div>

          <div className="w-full sm:flex-1 min-w-[200px]">
            <Field label="نوع ارز">
              <div className="flex items-center gap-1.5">
                <select
                  className="text-xs h-9 flex-1"
                  value={selectedCurrency}
                  onChange={(event) => {
                    const curr = event.target.value;
                    setSelectedCurrency(curr);
                    const currObj = availableCurrencies.find((c) => c.code === curr);
                    updateDraftDetail('currencyUnit', currObj?.code || '');
                    updateDraftDetail('settlementCurrencyUnit', currObj?.code || '');
                  }}
                  disabled={currenciesLoading || activeCurrencies.length === 0}
                >
                  {activeCurrencies.length === 0 ? (
                    <option value="">
                      {currenciesLoading ? 'در حال دریافت ارزها...' : 'ارزی در کالکشن ثبت نشده است'}
                    </option>
                  ) : activeCurrencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {getCurrencyDisplayName(curr)} ({curr.code})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setAddCurrencyError('');
                    setShowAddCurrencyModal(true);
                  }}
                  className="h-9 w-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center transition-colors shrink-0"
                  title="افزودن ارز جدید"
                >
                  <Plus size={16} />
                </button>
              </div>
            </Field>
          </div>

          <div className="w-full sm:flex-1 min-w-[200px]">
            <Field label="تاریخ سند">
              <DatePicker
                value={documentDateJalali}
                onValueChange={(_iso, jalali) => {
                  setDocumentDateJalali(jalali);
                }}
                calendarType="shamsi"
                format="yyyy/MM/dd"
                placeholder="انتخاب تاریخ سند"
                className="w-full"
              />
            </Field>
          </div>
        </div>
      </section>

      {/* ENTRY TABS EDITOR */}
      <section className={`dashboard-panel document-entry-panel document-draft-editor relative overflow-hidden p-3.5 space-y-3 ${editingLineId ? 'ring-2 ring-amber-500/50 shadow-xl' : ''}`}>
        <div>
        {editingLineId ? (
          <div className="document-draft-editor-head flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 -mx-3.5 -mt-3.5 p-3 rounded-t-xl">
            <span className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <PencilLine size={15} /> در حال اصلاح ردیف انتخاب‌شده
            </span>
            <button type="button" className="document-cancel-edit" onClick={cancelEdit}>
              انصراف از ویرایش
            </button>
          </div>
        ) : null}

        <DocumentEntryTabs
          accountCodeZero="0"
          selectedCustomer={selectedCustomer}
          documentId={documentId}
          nature={documentNature}
          editingSourceTab={editingSourceTab}
          metalsTabLabel={`${documentNature === 'received' ? 'ورود' : 'خروج'} ${
            draftLine.details.metalType === 'silver'
              ? 'نقره'
              : draftLine.details.metalType === 'platinum'
                ? 'پلاتین'
                : 'طلا'
          }`}
          goldSaleTabLabel={`${documentNature === 'received' ? 'خرید' : 'فروش'} ${
            draftLine.details.metalType === 'silver'
              ? 'نقره'
              : draftLine.details.metalType === 'platinum'
                ? 'پلاتین'
                : 'طلا'
          }`}
          activeTab={activeEntryTab}
          onActiveTabChange={changeEntryTab}
          firstTabContent={(
            <RawGoldTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              weightPrecision={weightPrecision}
              meltedInventory={meltedInventory}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              changeRawKind={changeRawKind}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseKarat={purityForMetal(draftLine.details.metalType)}
              convertedTo750={(weight, purity) => convertedTo750(weight, purity, purityForMetal(draftLine.details.metalType))}
              faNumber={faNumber}
              errors={lineValidationErrors}
              labInputRef={labInputRef}
              stampInputRef={stampInputRef}
            />
          )}
          goldSaleTabContent={(
            <GoldSaleTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              weightPrecision={weightPrecision}
              meltedInventory={meltedInventory}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              changeRawKind={changeRawKind}
              updateMetalValue={updateMetalValue}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseKarat={purityForMetal(draftLine.details.metalType)}
              convertedTo750={(weight, purity) => convertedTo750(weight, purity, purityForMetal(draftLine.details.metalType))}
              convertedWeightFromTotal={(total, type, price) => convertedWeightFromTotal(total, type, price, purityForMetal(draftLine.details.metalType))}
              actualWeightFromMoney={(details) => actualWeightFromMoney(details, purityForMetal(details.metalType))}
              rawOperationLabel={rawOperationLabel}
              toPersianDigits={toPersianDigits}
              faNumber={faNumber}
              numberValue={numberValue}
              errors={lineValidationErrors}
              labInputRef={labInputRef}
              stampInputRef={stampInputRef}
            />
          )}
          currencyTabContent={(
            <CurrencyTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              currencyUnits={currencyUnits}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              updateDraftDetail={updateDraftDetail}
              updateCurrencyValue={updateCurrencyValue}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
            />
          )}
          coinTabContent={(
            <CoinTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseCurrency={baseCurrency}
            />
          )}
          bankTabContent={(
            <BankTab
              nature={documentNature}
              selectedCustomer={selectedCustomer}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
            />
          )}
          cashTabContent={(
            <CashTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseCurrency={baseCurrency}
              selectedCurrency={selectedCurrency}
              currencyLabel={availableCurrencies.find((c) => c.code === selectedCurrency)?.name}
            />
          )}
          claimTabContent={(
            <ClaimTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
            />
          )}
          workmanshipTabContent={(
            <WorkmanshipTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseCurrency={baseCurrency}
            />
          )}
        />
        </div>
      </section>

      {/* DOCUMENT LINES PANEL (with Pin / Unpin option & Folder Collapse on Edit when Pinned) */}
      <motion.section
        layout
        initial={false}
        animate={{
          height: isLinesPinned && editingLineId ? 0 : 'auto',
          opacity: isLinesPinned && editingLineId ? 0 : 1,
          y: isLinesPinned && editingLineId ? 20 : 0,
        }}
        transition={{
          duration: 0.35,
          ease: [0.16, 1, 0.3, 1],
        }}
        style={{
          overflow: 'hidden',
          pointerEvents: isLinesPinned && editingLineId ? 'none' : 'auto',
        }}
        className={`dashboard-panel document-lines-panel transition-all ${
          isLinesPinned
            ? 'is-pinned fixed bottom-0 left-0 right-0 z-40 lg:right-64 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t-2 border-amber-500 shadow-2xl p-3 rounded-t-2xl rounded-b-none'
            : 'p-3'
        }`}
      >
        <div className="document-lines-head flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <ClipboardList size={15} />
            <span>ردیف‌های سند ({faNumber(committedLines.length)})</span>
          </h2>

          {/* Submit actions and utility icons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <DocumentSubmitActions
              onSubmit={async (status) => {
                await save(status);
              }}
            />

            <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />

            {/* Pin / Unpin Button */}
            <button
              type="button"
              onClick={toggleLinesPin}
              className={`p-1.5 rounded-lg transition-all border ${
                isLinesPinned
                  ? 'bg-amber-500 border-amber-600 text-white shadow-sm ring-2 ring-amber-400/30 dark:bg-amber-600 dark:border-amber-500'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={isLinesPinned ? 'غیرفعال‌سازی حالت چسبان' : 'فعال‌سازی حالت چسبان'}
              aria-label={isLinesPinned ? 'غیرفعال‌سازی حالت چسبان' : 'فعال‌سازی حالت چسبان'}
            >
              {isLinesPinned ? <Pin size={14} className="fill-current" /> : <PinOff size={14} />}
            </button>

            {/* Print Icon Button */}
            {committedLines.length > 0 ? (
              <DocumentPrint
                customer={selectedCustomer || null}
                documentNumber={effectiveDocumentNumberDisplay}
                documentDateJalali={documentDateJalali}
                lines={committedLines}
                iconOnly
              />
            ) : (
              <button
                type="button"
                disabled
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
                title="چاپ سند (بدون ردیف)"
                aria-label="چاپ سند"
              >
                <Printer size={14} />
              </button>
            )}

            {/* Bale SVG Icon Button (Placeheld for next phase) */}
            <button
              type="button"
              className="p-1.5 rounded-lg transition-all border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              title="ارسال به بله"
              aria-label="ارسال به بله"
              onClick={() => {
                // Feature to be enabled in next milestone
              }}
            >
              <BaleIcon size={14} />
            </button>
          </div>
        </div>

        {!committedLines.length ? (
          <div className="document-lines-empty py-4">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">هنوز ردیفی ثبت نشده است</p>
          </div>
        ) : (
          <div className={`document-lines-table-wrapper ${isLinesPinned ? 'max-h-36 overflow-y-auto' : ''}`}>
            <table className="document-lines-table">
              <thead>
                <tr>
                  <th style={{ width: '3%' }}>#</th>
                  <th>نوع سند</th>
                  <th>جنس فلز</th>
                  <th>وزن</th>
                  <th>عیار</th>
                  <th>بدهکار وزنی</th>
                  <th>بستانکار وزنی</th>
                  {hasFinancialAmounts ? <th>بدهکار مالی</th> : null}
                  {hasFinancialAmounts ? <th>بستانکار مالی</th> : null}
                  {hasAssayOrStamp ? <th>نام آزمایشگاه / ری‌گیری</th> : null}
                  {hasAssayOrStamp ? <th>شماره پاکت / انگ</th> : null}
                  <th>شرح سند</th>
                  <th style={{ width: '52px' }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {committedLines.map((line, index) => (
                    <CommittedLineRow
                      key={line.id}
                      line={line}
                      index={index}
                      onEdit={() => editLine(line)}
                      onRemove={() => requestRemoveLine(line)}
                      onHawala={() => {
                        if (!selectedCustomer) {
                          setNoCustomerNotice(true);
                          setTimeout(() => setNoCustomerNotice(false), 4000);
                          return;
                        }
                        setHawalaLine(line);
                      }}
                      weightPrecision={weightPrecision}
                      hasAssayOrStamp={hasAssayOrStamp}
                      hasFinancialAmounts={hasFinancialAmounts}
                      hasValidCustomer={Boolean(selectedCustomer)}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* DOCUMENT NET BALANCE */}
        <div className={committedLines.length ? 'mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center' : 'hidden'}>
          {committedLines.length ? (
            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-xs font-bold shrink-0">
              <span className="text-slate-600 dark:text-slate-400">
                {activeMetals.length > 1 ? 'خالص اثر سند:' : 'خالص اثر سند بر مانده:'}
              </span>
              {activeMetals.length === 0 ? (
                <span className="text-slate-500">بدون اثر وزنی</span>
              ) : activeMetals.length === 1 ? (
                (() => {
                  const m = activeMetals[0];
                  const label = m === 'silver' ? 'نقره' : m === 'platinum' ? 'پلاتین' : 'طلا';
                  const val = metalNetEffects[m];
                  return (
                    <strong className={val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      {label}: {faNumber(Math.abs(val), weightPrecision)} گرم {val >= 0 ? 'بستانکار' : 'بدهکار'}
                    </strong>
                  );
                })()
              ) : (
                <span className="flex flex-wrap gap-1.5 items-center text-slate-700 dark:text-slate-200">
                  <span className="text-amber-600 dark:text-amber-400">چند فلزی (</span>
                  {activeMetals.map((m, idx) => {
                    const label = m === 'silver' ? 'نقره' : m === 'platinum' ? 'پلاتین' : 'طلا';
                    const val = metalNetEffects[m];
                    return (
                      <span key={m} className="inline-flex items-center gap-1">
                        <span>{label}:</span>
                        <strong className={val >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {faNumber(Math.abs(val), weightPrecision)} گرم {val >= 0 ? 'بستانکار' : 'بدهکار'}
                        </strong>
                        {idx < activeMetals.length - 1 ? <span className="mx-0.5 text-slate-400">/</span> : null}
                      </span>
                    );
                  })}
                  <span className="text-amber-600 dark:text-amber-400">)</span>
                </span>
              )}
            </div>
          ) : null}
        </div>

        {/* CUSTOMER BALANCE PREVIEW AFTER DOCUMENT */}
        {selectedCustomer && previewData ? (
          <div className="mt-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span>پیش‌نمایش مانده طرف‌حساب ({selectedCustomer.name})</span>
              </span>
              {previewLoading ? (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                  <LoaderCircle size={12} className="spin" /> در حال محاسبه...
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Previous Balance */}
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                  مانده قبلی
                </span>
                <div className="space-y-0.5 text-xs font-black">
                  <div className="text-slate-900 dark:text-slate-100">
                    {faNumber(Math.abs(previewData.previousBalance.rial))} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}
                    <small className="text-[10px] text-slate-500 font-bold mr-1">
                      ({previewData.previousBalance.rial > 0 ? 'بستانکار' : previewData.previousBalance.rial < 0 ? 'بدهکار' : 'تسویه'})
                    </small>
                  </div>
                  {previewData.previousBalance.gold !== 0 || previewData.transactionEffect.gold !== 0 ? (
                    <div className="text-amber-700 dark:text-amber-300">
                      طلا: {faNumber(Math.abs(previewData.previousBalance.gold), weightPrecision)} گرم
                      <small className="text-[10px] text-slate-500 font-bold mr-1">
                        ({previewData.previousBalance.gold > 0 ? 'بستانکار' : previewData.previousBalance.gold < 0 ? 'بدهکار' : 'تسویه'})
                      </small>
                    </div>
                  ) : null}
                  {previewData.previousBalance.silver !== 0 || previewData.transactionEffect.silver !== 0 ? (
                    <div className="text-slate-600 dark:text-slate-300">
                      نقره: {faNumber(Math.abs(previewData.previousBalance.silver), weightPrecision)} گرم
                    </div>
                  ) : null}
                  {previewData.previousBalance.platinum !== 0 || previewData.transactionEffect.platinum !== 0 ? (
                    <div className="text-purple-600 dark:text-purple-300">
                      پلاتین: {faNumber(Math.abs(previewData.previousBalance.platinum), weightPrecision)} گرم
                    </div>
                  ) : null}
                  {previewData.previousBalance.foreign !== 0 || previewData.transactionEffect.foreign !== 0 ? (
                    <div className="text-teal-600 dark:text-teal-400">
                      ارز: {faNumber(Math.abs(previewData.previousBalance.foreign), 2)} {previewData.previousBalance.secondaryCurrency || 'واحد'}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 2. Transaction Effect */}
              <div className="p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 space-y-1">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
                  اثر این سند
                </span>
                <div className="space-y-0.5 text-xs font-black">
                  <div className={previewData.transactionEffect.rial >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                    {previewData.transactionEffect.rial >= 0 ? '+' : ''}{faNumber(previewData.transactionEffect.rial)} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}
                  </div>
                  {previewData.transactionEffect.gold !== 0 ? (
                    <div className={previewData.transactionEffect.gold >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      طلا: {previewData.transactionEffect.gold >= 0 ? '+' : ''}{faNumber(previewData.transactionEffect.gold, weightPrecision)} گرم
                    </div>
                  ) : null}
                  {previewData.transactionEffect.silver !== 0 ? (
                    <div className={previewData.transactionEffect.silver >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      نقره: {previewData.transactionEffect.silver >= 0 ? '+' : ''}{faNumber(previewData.transactionEffect.silver, weightPrecision)} گرم
                    </div>
                  ) : null}
                  {previewData.transactionEffect.platinum !== 0 ? (
                    <div className={previewData.transactionEffect.platinum >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      پلاتین: {previewData.transactionEffect.platinum >= 0 ? '+' : ''}{faNumber(previewData.transactionEffect.platinum, weightPrecision)} گرم
                    </div>
                  ) : null}
                  {previewData.transactionEffect.foreign !== 0 ? (
                    <div className={previewData.transactionEffect.foreign >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                      ارز: {previewData.transactionEffect.foreign >= 0 ? '+' : ''}{faNumber(previewData.transactionEffect.foreign, 2)} {previewData.previousBalance.secondaryCurrency || 'واحد'}
                    </div>
                  ) : null}
                  {previewData.transactionEffect.rial === 0 && previewData.transactionEffect.gold === 0 && previewData.transactionEffect.silver === 0 && previewData.transactionEffect.platinum === 0 && previewData.transactionEffect.foreign === 0 ? (
                    <div className="text-slate-400">بدون اثر</div>
                  ) : null}
                </div>
              </div>

              {/* 3. Projected Balance */}
              <div className="p-2.5 rounded-xl border border-teal-200/80 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/30 space-y-1">
                <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 block">
                  مانده پس از ثبت سند
                </span>
                <div className="space-y-0.5 text-xs font-black">
                  <div className="text-slate-900 dark:text-slate-100">
                    {faNumber(Math.abs(previewData.projectedBalance.rial))} {baseCurrency === 'IRT' ? 'تومان' : 'ریال'}
                    <small className="text-[10px] text-slate-500 font-bold mr-1">
                      ({previewData.projectedBalance.rial > 0 ? 'بستانکار' : previewData.projectedBalance.rial < 0 ? 'بدهکار' : 'تسویه'})
                    </small>
                  </div>
                  {previewData.projectedBalance.gold !== 0 || previewData.transactionEffect.gold !== 0 ? (
                    <div className="text-amber-700 dark:text-amber-300">
                      طلا: {faNumber(Math.abs(previewData.projectedBalance.gold), weightPrecision)} گرم
                      <small className="text-[10px] text-slate-500 font-bold mr-1">
                        ({previewData.projectedBalance.gold > 0 ? 'بستانکار' : previewData.projectedBalance.gold < 0 ? 'بدهکار' : 'تسویه'})
                      </small>
                    </div>
                  ) : null}
                  {previewData.projectedBalance.silver !== 0 || previewData.transactionEffect.silver !== 0 ? (
                    <div className="text-slate-600 dark:text-slate-300">
                      نقره: {faNumber(Math.abs(previewData.projectedBalance.silver), weightPrecision)} گرم
                    </div>
                  ) : null}
                  {previewData.projectedBalance.platinum !== 0 || previewData.transactionEffect.platinum !== 0 ? (
                    <div className="text-purple-600 dark:text-purple-300">
                      پلاتین: {faNumber(Math.abs(previewData.projectedBalance.platinum), weightPrecision)} گرم
                    </div>
                  ) : null}
                  {previewData.projectedBalance.foreign !== 0 || previewData.transactionEffect.foreign !== 0 ? (
                    <div className="text-teal-600 dark:text-teal-400">
                      ارز: {faNumber(Math.abs(previewData.projectedBalance.foreign), 2)} {previewData.previousBalance.secondaryCurrency || 'واحد'}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </motion.section>

      {/* HAWALA TRANSFER MODAL */}
      <HawalaModal
        line={hawalaLine}
        sourceCustomer={selectedCustomer || null}
        allCustomers={customers}
        weightPrecision={weightPrecision}
        onClose={() => setHawalaLine(null)}
        onConfirmHawala={(targetCustomer) => {
          if (hawalaLine) {
            setPendingHawala({
              line: hawalaLine,
              targetCustomer,
              countdown: 10,
            });
            setHawalaLine(null);
          }
        }}
      />

      {/* UNSAVED CHANGES EXIT GUARD MODAL */}
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
                  onClick={() => setShowExitModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                  onClick={() => setShowExitModal(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  ماندن در صفحه
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowExitModal(false);
                    setCommittedLines([]);
                    if (pendingNavigationUrl) {
                      window.location.href = pendingNavigationUrl;
                    }
                  }}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-500"
                >
                  ترک صفحه و حذف اطلاعات
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* DELETION CONFIRMATION MODAL */}
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
              className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <Trash2 size={16} /> تأیید حذف ردیف
                </span>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmLine(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                آیا از حذف این ردیف سند اطمینان دارید؟
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmLine(null)}
                  className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300"
                >
                  لغو
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveLine}
                  className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500"
                >
                  حذف
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* RESTORATION TOAST WITH CIRCULAR COUNTDOWN TIMER */}
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
              onClick={restoreLine}
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 transition hover:bg-amber-400"
            >
              <RotateCcw size={13} /> بازیابی
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* FLOATING BOTTOM-RIGHT PENDING HAWALA COUNTDOWN TOAST */}
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
              onClick={cancelPendingHawala}
              className="mr-2 flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white transition shadow-md"
            >
              <X size={14} /> لغو حواله
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* MODAL: ADD CUSTOM CURRENCY */}
      <AnimatePresence>
        {showAddCurrencyModal ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-right"
          >
            <motion.form
              onSubmit={handleAddCustomCurrency}
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
                  onClick={() => setShowAddCurrencyModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                  onClick={() => setShowAddCurrencyModal(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={addingCurrency}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md hover:bg-amber-400 disabled:opacity-60"
                >
                  {addingCurrency ? 'در حال افزودن...' : 'افزودن ارز'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CustomerBalanceLiquid({ customer }: { customer: Customer }) {
  const balances = [
    { id: 'gold', label: 'طلا', value: customer.goldBalance, unit: 'گرم', digits: 3 },
    { id: 'silver', label: 'نقره', value: customer.silverBalance, unit: 'گرم', digits: 3 },
    { id: 'platinum', label: 'پلاتین', value: customer.platinumBalance, unit: 'گرم', digits: 3 },
    { id: 'rial', label: 'ریال', value: customer.rialBalance, unit: 'ریال', digits: 0 },
    {
      id: 'foreign',
      label: currencyDisplay(customer.secondaryCurrency, customer.secondaryCurrencySymbol),
      value: customer.foreignBalance,
      unit: 'واحد',
      digits: 2,
    },
    {
      id: 'tertiary',
      label: currencyDisplay(customer.tertiaryCurrency, customer.tertiaryCurrencySymbol),
      value: customer.tertiaryBalance,
      unit: 'واحد',
      digits: 2,
    },
  ];
  const visibleBalances = balances.filter(
    (balance) => balance.value !== 0 || balance.id === 'gold' || balance.id === 'rial',
  );

  return (
    <motion.div
      className="document-liquid-balance p-3 sm:p-4 border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20"
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="document-liquid-title mb-2 sm:mb-0">
        <span className="document-liquid-orb w-9 h-9"><Sparkles size={18} /></span>
        <div>
          <strong className="text-sm sm:text-base font-extrabold text-amber-900 dark:text-amber-200">
            وضعیت طلب و بدهی {customer.name}
          </strong>
        </div>
      </div>
      <div className="document-liquid-items gap-2.5">
        {visibleBalances.map((balance, index) => (
          <motion.div
            className={`document-liquid-item p-3 ${
              balance.value > 0 ? 'is-credit' : balance.value < 0 ? 'is-debit' : 'is-zero'
            }`}
            key={balance.id}
            initial={{ opacity: 0, scale: 0.7, x: 12 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{
              type: 'spring',
              stiffness: 340,
              damping: 22,
              delay: index * 0.045,
            }}
          >
            <span className="document-liquid-blob" />
            <small className="text-xs font-extrabold text-slate-600 dark:text-slate-300 block mb-0.5">{balance.label}</small>
            <strong className="text-base sm:text-lg font-black tracking-normal block my-0.5">
              {faNumber(Math.abs(balance.value), balance.digits)}
              {' '}
              <span className="text-xs font-bold text-slate-500">{balance.unit}</span>
            </strong>
            <em className="text-xs font-black block mt-0.5">
              {balance.value > 0
                ? 'بستانکار از ما'
                : balance.value < 0
                  ? 'بدهکار به ما'
                  : 'تسویه'}
            </em>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CommittedLineRow({
  line,
  index,
  onEdit,
  onRemove,
  onHawala,
  weightPrecision = 3,
  hasAssayOrStamp = false,
  hasFinancialAmounts = false,
  hasValidCustomer = false,
}: {
  line: DocumentLine;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  onHawala: () => void;
  weightPrecision?: number;
  hasAssayOrStamp?: boolean;
  hasFinancialAmounts?: boolean;
  hasValidCustomer?: boolean;
}) {
  const isPaid = line.documentNature === 'paid';
  const isReceived = line.documentNature === 'received';

  const docType = line.documentTypeLabel
    || getLineDocumentTypeLabel(
      line.documentNature,
      line.sourceTab || line.documentTab,
      line.details.rawKind,
      line.details.unsettledTrade,
      line.details.refiningOpKind,
    );

  const metalLabel = line.documentTab === 'currency'
    ? (line.details.currencyUnit || 'ارز')
    : (line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا');

  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
    : numberValue(line.details.rawWeight);

  const purityVal = numberValue(line.details.purity);

  // Formula: weight * purity / the base karat captured when the line was registered.
  const c750 = line.converted750
    ?? (rawWeight > 0 && purityVal > 0 ? (rawWeight * purityVal) / Number(line.details.baseKarat || 750) : 0);

  const weightDisplay = rawWeight > 0 ? faNumber(rawWeight, weightPrecision) : '-';
  const purityDisplay = purityVal > 0 ? toPersianDigits(line.details.purity) : '-';

  const bedehkarVazni = isPaid && c750 > 0 ? faNumber(c750, weightPrecision) : null;
  const bostankarVazni = isReceived && c750 > 0 ? faNumber(c750, weightPrecision) : null;

  const financialAmount = line.documentTab === 'currency'
    ? numberValue(line.details.currencyTotalAmount)
    : numberValue(line.details.totalAmount);

  const bedehkarMali = isPaid && financialAmount > 0 ? faNumber(financialAmount) : null;
  const bostankarMali = isReceived && financialAmount > 0 ? faNumber(financialAmount) : null;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
    >
      <td className="text-center font-bold text-slate-500 dark:text-slate-400">
        {faNumber(index + 1)}
      </td>
      <td className="text-right">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(line.documentTab === 'refining' || line.sourceTab === 'refining') ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
              <Flame size={11} className="text-amber-600 dark:text-amber-400 shrink-0" />
              ری‌گیری
            </span>
          ) : null}
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={docType}>
            {docType}
          </span>
        </div>
      </td>
      <td className="text-center font-medium text-slate-700 dark:text-slate-200">
        {metalLabel}
      </td>
      <td className="text-center font-bold text-slate-700 dark:text-slate-200">
        {weightDisplay}
      </td>
      <td className="text-center font-medium text-slate-600 dark:text-slate-300">
        {purityDisplay}
      </td>
      <td className="text-center">
        {bedehkarVazni ? (
          <span className="text-rose-600 dark:text-rose-400 font-bold">{bedehkarVazni}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </td>
      <td className="text-center">
        {bostankarVazni ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bostankarVazni}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </td>
      {hasFinancialAmounts ? (
        <td className="text-center">
          {bedehkarMali ? (
            <span className="text-rose-600 dark:text-rose-400 font-bold">{bedehkarMali}</span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </td>
      ) : null}
      {hasFinancialAmounts ? (
        <td className="text-center">
          {bostankarMali ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bostankarMali}</span>
          ) : (
            <span className="text-slate-300 dark:text-slate-600">-</span>
          )}
        </td>
      ) : null}
      {hasAssayOrStamp ? (
        <td className="text-center text-slate-700 dark:text-slate-300">
          <span className="block truncate max-w-[120px] mx-auto" title={line.details.labName || ''}>
            {line.details.labName?.trim() || '-'}
          </span>
        </td>
      ) : null}
      {hasAssayOrStamp ? (
        <td className="text-center text-slate-700 dark:text-slate-300">
          <span className="block truncate max-w-[110px] mx-auto" title={line.details.stampNumber || ''}>
            {line.details.stampNumber?.trim() || '-'}
          </span>
        </td>
      ) : null}
      <td className="text-right">
        <span className="text-xs text-slate-600 dark:text-slate-300 block truncate max-w-[160px]" title={line.description}>
          {line.description || '-'}
        </span>
      </td>
      <td className="text-center action-cell">
        <div className="flex items-center justify-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onHawala}
            disabled={!hasValidCustomer}
            aria-label="حواله ردیف سند"
            title={hasValidCustomer ? 'حواله ردیف سند به طرف‌حساب دیگر' : 'برای حواله ابتدا طرف‌حساب را انتخاب کنید'}
            className="p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-40 disabled:hover:text-slate-400 transition-colors shrink-0"
          >
            <ArrowLeftRight size={14} />
          </button>
          <button
            type="button"
            onClick={onEdit}
            aria-label="ویرایش ردیف"
            title="ویرایش ردیف"
            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors shrink-0"
          >
            <PencilLine size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="حذف ردیف"
            title="حذف ردیف"
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}
