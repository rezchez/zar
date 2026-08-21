'use client';

import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  LoaderCircle,
  PencilLine,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import { currencyDisplay, type Customer } from '@/lib/customer';
import DocumentSubmitActions from '@/components/documents/document-submit-actions';
import DocumentEntryTabs from '@/src/components/documents/DocumentEntryTabs';
import type { DocumentNature } from '@/lib/document';
import {
  formatJalaliDate,
  jalaliToGregorian,
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
import GoldSaleTab from '@/src/components/documents/GoldSaleTab';
import CurrencyTab from '@/src/components/documents/CurrencyTab';
import CashTab from '@/src/components/documents/CashTab';
import Field from '@/src/components/documents/Field';
import HawalaModal from '@/src/components/documents/HawalaModal';
import DocumentPrint from '@/src/components/documents/DocumentPrint';

type CalculationMethod = 'weight' | 'money';
type MetalPriceType = 'mesghal17' | 'gram18' | 'ounceUsd';

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type PendingDelete = {
  line: DocumentLine;
  index: number;
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

function convertedTo750(weight: string, purity: string) {
  const actualWeight = numberValue(weight);
  const carat = numberValue(purity);
  if (actualWeight <= 0 || carat <= 0) return 0;
  return (actualWeight * carat) / 750;
}

function metalPriceLabel(type: MetalPriceType) {
  if (type === 'mesghal17') return 'قیمت فلز هر مثقال';
  if (type === 'gram18') return 'قیمت فلز هر گرم';
  return 'قیمت فلز هر اونس';
}

function pricePer750Gram(type: MetalPriceType, price: string) {
  const value = numberValue(price);
  if (value <= 0) return 0;
  if (type === 'mesghal17') return value / MESGHAL_17_TO_GRAM_18;
  if (type === 'ounceUsd') return value / TROY_OUNCE_GRAMS;
  return value;
}

function totalFromWeight(weight: string, purity: string, type: MetalPriceType, price: string) {
  return Math.round(convertedTo750(weight, purity) * pricePer750Gram(type, price));
}

function convertedWeightFromTotal(total: string, type: MetalPriceType, price: string) {
  const perGram = pricePer750Gram(type, price);
  return perGram > 0 ? numberValue(total) / perGram : 0;
}

function actualWeightFromMoney(details: Pick<DetailState, 'totalAmount' | 'purity' | 'metalPriceType' | 'metalPrice'>) {
  const purityNumber = numberValue(details.purity);
  if (purityNumber <= 0) return 0;
  return (convertedWeightFromTotal(details.totalAmount, details.metalPriceType, details.metalPrice) * 750) / purityNumber;
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
  const docTab = sourceTab === 'currency' ? 'currency' : sourceTab === 'gold-sale' ? 'gold-sale' : 'raw-gold';
  return {
    id: crypto.randomUUID(),
    documentNature: nature,
    documentTab: docTab,
    sourceTab,
    documentSubType: documentSubType(nature, 'molten'),
    settlementMethod: 'weight',
    balanceSource: 'current',
    description: '',
    details: {
      metalType: 'gold',
      rawKind: 'molten',
      rawWeight: '',
      purity: '750',
      calculationMethod: 'weight',
      metalPriceType: 'gram18',
      metalPrice: '',
      totalAmount: '',
      labName: '',
      stampNumber: '',
      currencyUnit: 'USD',
      currencyQuantity: '',
      currencyUnitPrice: '',
      currencyTotalAmount: '',
      unsettledTrade: false,
      currencyTradeId: '',
      settlementCurrencyUnit: 'USD',
      settlementQuantity: '',
      settlesTradeId: '',
      inventorySourceId: '',
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
  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details)
    : numberValue(line.details.rawWeight);
  if (line.documentTab === 'raw-gold') return rawWeight > 0;
  return rawWeight > 0
    && numberValue(line.details.totalAmount) > 0
    && numberValue(line.details.metalPrice) > 0;
}

function validateLine(line: DocumentLine) {
  if (line.documentTab === 'currency') {
    if (!line.details.currencyUnit) return 'واحد ارز را انتخاب کنید.';
    if (numberValue(line.details.currencyQuantity) <= 0) return 'تعداد ارز باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyUnitPrice) <= 0) return 'قیمت هر واحد باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyTotalAmount) <= 0) return 'مبلغ کل باید بیشتر از صفر باشد.';
    return '';
  }
  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details)
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
  if (line.details.rawKind !== 'conditional') {
    const purityStr = normalizeDigits(line.details.purity).trim();
    const purityNum = numberValue(purityStr);
    if (purityNum < 1 || purityNum > 1000) {
      return 'عیار باید عددی بین ۱ تا ۱۰۰۰ باشد.';
    }
    if (purityStr.includes('.') && purityStr.split('.')[1].length > 1) {
      return 'عیار حداکثر می‌تواند ۱ رقم اعشار داشته باشد.';
    }
  }
  return '';
}

function daysInJalaliMonth(year: number, month: number) {
  const current = jalaliToGregorian(`${year}/${month}/1`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const next = jalaliToGregorian(`${nextYear}/${nextMonth}/1`);
  if (!current || !next) return month <= 6 ? 31 : month <= 11 ? 30 : 29;

  const currentTime = Date.UTC(current.year, current.month - 1, current.day);
  const nextTime = Date.UTC(next.year, next.month - 1, next.day);
  return Math.round((nextTime - currentTime) / 86_400_000);
}

function firstWeekDayOfJalaliMonth(year: number, month: number) {
  const gregorian = jalaliToGregorian(`${year}/${month}/1`);
  if (!gregorian) return 0;
  const weekDay = new Date(Date.UTC(
    gregorian.year,
    gregorian.month - 1,
    gregorian.day,
  )).getUTCDay();
  return (weekDay + 1) % 7;
}

function dateDistanceLabel(dateParts: DateParts) {
  const gregorian = jalaliToGregorian(
    `${dateParts.year}/${dateParts.month}/${dateParts.day}`,
  );
  if (!gregorian) return 'تاریخ انتخاب‌شده معتبر نیست';

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedUtc = Date.UTC(
    gregorian.year,
    gregorian.month - 1,
    gregorian.day,
  );
  const difference = Math.round((selectedUtc - todayUtc) / 86_400_000);

  if (difference === 0) return 'امروز';
  if (difference === -1) return 'دیروز';
  if (difference === 1) return 'فردا';
  if (difference < 0) return `${faNumber(Math.abs(difference))} روز پیش`;
  return `${faNumber(difference)} روز بعد`;
}

function getLineDocumentTypeLabel(
  nature: DocumentNature,
  tab: string,
  rawKind: RawOperationKind,
  unsettledTrade?: boolean,
): string {
  if (tab === 'currency') {
    if (unsettledTrade) {
      return nature === 'received' ? 'خرید ارز (بدون تسویه)' : 'فروش ارز (بدون تسویه)';
    }
    return nature === 'received' ? 'خرید ارز' : 'فروش ارز';
  }

  if (tab === 'cash') {
    return nature === 'received' ? 'دریافت نقد' : 'پرداخت نقد';
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

  function createSettingsLine(nature: DocumentNature = 'received', sourceTab = 'metals') {
    const line = sourceTab === 'currency'
      ? createCurrencyLine(nature)
      : createLine(nature, sourceTab);
    return {
      ...line,
      details: {
        ...line.details,
        purity: String(purityForMetal(line.details.metalType)),
      },
    };
  }

  const initialDate = parseJalaliParts(formatJalaliDate());
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [documentNumberDisplay, setDocumentNumberDisplay] = useState('');
  const [documentNumberLoading, setDocumentNumberLoading] = useState(false);
  const [documentId, setDocumentId] = useState(() => crypto.randomUUID());
  const [dateParts, setDateParts] = useState<DateParts>(initialDate);
  const [calendarView, setCalendarView] = useState({
    year: initialDate.year,
    month: initialDate.month,
  });
  const [dateOpen, setDateOpen] = useState(false);
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

  // Exit Navigation Guard Modal State
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Selection notice modal / toast
  const [noCustomerNotice, setNoCustomerNotice] = useState(false);

  // Deletion modal & restoration toast state
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<DocumentLine | null>(null);
  const [restorationState, setRestorationState] = useState<PendingDelete | null>(null);
  const [restorationTimer, setRestorationTimer] = useState<number>(10);

  // Hawala modal state
  const [hawalaLine, setHawalaLine] = useState<DocumentLine | null>(null);

  // Document lines pin state initialized safely
  const [isLinesPinned, setIsLinesPinned] = useState<boolean>(false);

  // Keep a new draft synchronized with the global base purity settings.
  // Committed/editing lines are left untouched so historical assay values remain intact.
  useEffect(() => {
    if (editingLineId || committedLines.length > 0) return;
    const timer = window.setTimeout(() => {
      setDraftLine((current) => {
        if (current.details.rawKind === 'conditional') return current;
        const nextPurity = String(baseKaratForMetal(current.details.metalType, {
          goldBaseKarat,
          silverBaseKarat,
          platinumBaseKarat,
        }));
        return current.details.purity === nextPurity
          ? current
          : { ...current, details: { ...current.details, purity: nextPurity } };
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

  const datePickerRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );

  const effectiveDocumentNumberDisplay = selectedCustomerId
    ? documentNumberDisplay
    : 'انتخاب نشده';

  const suggestions = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase();
    if (!query || selectedCustomer) return [];
    return customers
      .filter((customer) =>
        `${customer.name} ${customer.customerCode} ${customer.phone1}`
          .toLocaleLowerCase()
          .includes(query),
      )
      .slice(0, 8);
  }, [customerQuery, customers, selectedCustomer]);

  const documentDateJalali = buildJalaliDate(dateParts);
  const distanceLabel = dateDistanceLabel(dateParts);
  const draftReady = isLineReady(draftLine);
  const currencyUnits = useMemo(() => {
    const units = [
      selectedCustomer?.secondaryCurrency,
      selectedCustomer?.tertiaryCurrency,
      'USD',
      'EUR',
      'AED',
      'TRY',
      'GBP',
    ].filter((value): value is string => Boolean(value?.trim()));
    return [...new Set(units)];
  }, [selectedCustomer]);

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
    if (documentNature !== 'paid' || draftLine.details.rawKind !== 'molten') return;
    fetch('/api/documents?inventory=melted', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { inventory?: MeltedInventoryItem[] }) => setMeltedInventory(data.inventory ?? []))
      .catch(() => setMeltedInventory([]));
  }, [documentNature, draftLine.details.rawKind]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (
        datePickerRef.current
        && !datePickerRef.current.contains(event.target as Node)
      ) {
        setDateOpen(false);
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

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
  }

  function clearCustomer() {
    setSelectedCustomerId('');
    setCustomerQuery('');
    setDocumentNumberDisplay('');
    setDocumentNumberLoading(false);
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
      setDraftLine({
        ...createSettingsLine(documentNature, tab),
        documentTab: tab === 'gold-sale' ? 'gold-sale' : 'raw-gold',
      });
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
        labName: kind === 'misc' ? '' : current.details.labName,
        stampNumber: kind === 'misc' ? '' : current.details.stampNumber,
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
      const converted = convertedTo750(details.rawWeight, details.purity);
      if (details.calculationMethod === 'weight') {
        if (field !== 'totalAmount') {
          details.totalAmount = String(totalFromWeight(
            details.rawWeight,
            details.purity,
            details.metalPriceType,
            details.metalPrice,
          ) || '');
        }
      } else {
        const computed = convertedWeightFromTotal(
          details.totalAmount,
          details.metalPriceType,
          details.metalPrice,
        );
        if (computed > 0) details.rawWeight = String((computed * 750) / Math.max(1, numberValue(details.purity)));
      }
      if (details.calculationMethod === 'weight' && field === 'metalPriceType' && converted > 0) {
        details.totalAmount = String(totalFromWeight(details.rawWeight, details.purity, details.metalPriceType, details.metalPrice) || '');
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
      ? actualWeightFromMoney(line.details)
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
    const validationMessage = validateLine(draftLine);
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

    const lineSourceTab = draftLine.sourceTab || (draftLine.documentTab === 'currency' ? 'currency' : draftLine.documentTab === 'gold-sale' ? 'gold-sale' : 'metals');
    const docTypeLabel = getLineDocumentTypeLabel(
      documentNature,
      lineSourceTab,
      draftLine.details.rawKind,
      draftLine.details.unsettledTrade,
    );

    const rawWeight = draftLine.details.calculationMethod === 'money'
      ? actualWeightFromMoney(draftLine.details)
      : numberValue(draftLine.details.rawWeight);
    const c750 = convertedTo750(String(rawWeight), draftLine.details.purity);

    // Snapshot current documentNature, documentTypeLabel, converted750, and user description
    const lineToCommit: DocumentLine = {
      ...draftLine,
      documentNature,
      sourceTab: lineSourceTab,
      documentTypeLabel: docTypeLabel,
      converted750: c750,
      description: draftLine.description ? draftLine.description.trim() : '',
      details: { ...draftLine.details },
    };

    if (editingLineId) {
      setCommittedLines((current) =>
        current.map((line) => (line.id === editingLineId ? lineToCommit : line)),
      );
      setEditingLineId(null);
    } else {
      setCommittedLines((current) => [...current, lineToCommit]);
    }
    setDraftLine(draftLine.documentTab === 'currency'
      ? createCurrencyLine(documentNature)
      : { ...createSettingsLine(documentNature, activeEntryTab), documentTab: draftLine.documentTab });
  }

  function editLine(line: DocumentLine) {
    const lineSourceTab = line.sourceTab || (line.documentTab === 'currency' ? 'currency' : line.documentTab === 'gold-sale' ? 'gold-sale' : 'metals');
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

  function goToPreviousMonth() {
    setCalendarView((current) => current.month === 1
      ? { year: current.year - 1, month: 12 }
      : { year: current.year, month: current.month - 1 });
  }

  function goToNextMonth() {
    setCalendarView((current) => current.month === 12
      ? { year: current.year + 1, month: 1 }
      : { year: current.year, month: current.month + 1 });
  }

  function selectCalendarDay(day: number) {
    setDateParts({
      year: calendarView.year,
      month: calendarView.month,
      day,
    });
    setDateOpen(false);
  }

  function selectToday() {
    const today = parseJalaliParts(formatJalaliDate());
    setDateParts(today);
    setCalendarView({ year: today.year, month: today.month });
    setDateOpen(false);
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
            goldAmount: (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale') && line.details.metalType === 'gold'
              ? line.details.calculationMethod === 'money'
                ? actualWeightFromMoney(line.details)
                : numberValue(line.details.rawWeight)
              : 0,
            silverAmount: (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale') && line.details.metalType === 'silver'
              ? line.details.calculationMethod === 'money' ? actualWeightFromMoney(line.details) : numberValue(line.details.rawWeight)
              : 0,
            platinumAmount: (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale') && line.details.metalType === 'platinum'
              ? line.details.calculationMethod === 'money' ? actualWeightFromMoney(line.details) : numberValue(line.details.rawWeight)
              : 0,
            rialAmount: line.documentTab === 'currency'
              ? (!line.details.unsettledTrade ? numberValue(line.details.currencyTotalAmount) : 0)
              : line.documentTab === 'gold-sale'
                ? numberValue(line.details.totalAmount)
                : 0,
            foreignAmount: line.documentTab === 'currency'
              ? numberValue(line.details.currencyQuantity)
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
        setMessage(`سند شماره ${toPersianDigits(registeredNumber)} به‌صورت موقت ذخیره شد.`);
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
      if (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale') {
        const metal = line.details.metalType || 'gold';
        const weight = line.details.calculationMethod === 'money'
          ? actualWeightFromMoney(line.details)
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
        (line.documentTab === 'raw-gold' || line.documentTab === 'gold-sale' || line.sourceTab === 'metals' || line.sourceTab === 'gold-sale') &&
        (line.details?.rawKind === 'molten' || line.details?.rawKind === 'conditional'),
    );
  }, [committedLines]);

  const hasFinancialAmounts = useMemo(() => {
    return committedLines.some(
      (line) =>
        line.documentTab === 'currency' ||
        line.documentTab === 'cash' ||
        line.sourceTab === 'currency' ||
        line.sourceTab === 'cash' ||
        numberValue(line.details?.totalAmount) > 0 ||
        numberValue(line.details?.currencyTotalAmount) > 0,
    );
  }, [committedLines]);

  // Identify editing line source tab for smart blur
  const editingLine = editingLineId ? committedLines.find((line) => line.id === editingLineId) || (draftLine.id === editingLineId ? draftLine : null) : null;
  const editingSourceTab = editingLine
    ? (editingLine.sourceTab || (editingLine.documentTab === 'currency' ? 'currency' : editingLine.documentTab === 'gold-sale' ? 'gold-sale' : 'metals'))
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
      <section className="dashboard-panel document-account-panel p-4 space-y-4">
        {/* Top Row: Customer Selection (Right) & Document Number (Immediately After) */}
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] items-end">
          {/* Customer Selection Search / Selected Card */}
          <div className="space-y-2">
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
                  <label className="account-field document-account-search-field max-w-none">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">طرف‌حساب</span>
                    <div className="gooey-search document-search-shell">
                      <Search size={16} />
                      <input
                        value={customerQuery}
                        onChange={(event) => {
                          setCustomerQuery(event.target.value);
                        }}
                        placeholder="نام یا کد طرف‌حساب را وارد کنید..."
                        autoComplete="off"
                      />
                    </div>
                    {suggestions.length ? (
                      <div className="document-customer-suggestions">
                        {suggestions.map((customer) => (
                          <button
                            type="button"
                            key={customer.id}
                            onClick={() => chooseCustomer(customer)}
                          >
                            <span className="document-suggestion-avatar">
                              {customer.name.charAt(0)}
                            </span>
                            <span>
                              <strong>{customer.name}</strong>
                              <small>
                                کد {toPersianDigits(String(customer.customerCode))}
                                {customer.phone1 ? ` · ${toPersianDigits(customer.phone1)}` : ''}
                              </small>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                </motion.div>
              ) : (
                <motion.div
                  key="selected-mode"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="w-full sm:w-1/3 flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/60 p-2 dark:border-teal-900/60 dark:bg-teal-950/30 transition-all duration-300"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="document-suggestion-avatar shrink-0"><UserRound size={15} /></span>
                    <div className="min-w-0 truncate">
                      <strong className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{selectedCustomer.name}</strong>
                      <small className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                        کد {toPersianDigits(String(selectedCustomer.customerCode))}
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="rounded-lg border border-teal-300 bg-white px-2.5 py-1 text-[11px] font-bold text-teal-700 transition hover:bg-teal-50 dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-slate-700 shrink-0"
                  >
                    تغییر
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Document Number - Immediately after Customer search */}
          <div className="w-full lg:w-48">
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

        {/* Bottom Metadata Row: Document Nature (Switch) + Metal Type + Document Date */}
        <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-slate-100 dark:border-slate-800 items-end">
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
                  animate={{ x: documentNature === 'received' ? 0 : -42 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                />
              </span>
              <strong>سند {documentNature === 'received' ? 'دریافتی' : 'پرداختی'}</strong>
            </button>
          </Field>

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
                  },
                }));
              }}
            >
              <option value="gold">طلای خام</option>
              <option value="silver">نقره</option>
              <option value="platinum">پلاتین</option>
            </select>
          </Field>

          <Field label="تاریخ سند">
            <div className="jalali-picker relative z-20" ref={datePickerRef}>
              <button
                type="button"
                className={`jalali-picker-trigger text-xs h-9 ${dateOpen ? 'is-open' : ''}`}
                onClick={() => {
                  setCalendarView({ year: dateParts.year, month: dateParts.month });
                  setDateOpen((value) => !value);
                }}
                aria-expanded={dateOpen}
              >
                <CalendarDays size={15} />
                <span>{documentDateJalali}</span>
                <ChevronLeft size={13} />
              </button>

              <AnimatePresence>
                {dateOpen ? (
                  <JalaliDatePicker
                    selected={dateParts}
                    view={calendarView}
                    onViewChange={setCalendarView}
                    onPreviousMonth={goToPreviousMonth}
                    onNextMonth={goToNextMonth}
                    onSelectDay={selectCalendarDay}
                    onToday={selectToday}
                  />
                ) : null}
              </AnimatePresence>

              <small className="document-date-distance text-[10px]">
                <Clock3 size={12} />
                {distanceLabel}
              </small>
            </div>
          </Field>
        </div>
      </section>

      {/* ENTRY TABS EDITOR */}
      <section className={`dashboard-panel document-entry-panel document-draft-editor p-3.5 space-y-3 ${editingLineId ? 'ring-2 ring-amber-500/50 shadow-xl' : ''}`}>
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
              weightPrecision={weightPrecision}
              meltedInventory={meltedInventory}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={commitDraftLine}
              changeRawKind={changeRawKind}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              convertedTo750={convertedTo750}
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
              convertedTo750={convertedTo750}
              convertedWeightFromTotal={convertedWeightFromTotal}
              actualWeightFromMoney={actualWeightFromMoney}
              rawOperationLabel={rawOperationLabel}
              metalPriceLabel={metalPriceLabel}
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
          cashTabContent={(
            <CashTab
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
            />
          )}
        />
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
        <div className="document-lines-head flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
            <ClipboardList size={15} />
            <span>ردیف‌های سند ({faNumber(committedLines.length)})</span>
          </h2>

          {/* Pin / Unpin Icon Button */}
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

        {/* BOTTOM SUBMIT & NET BALANCE SIDE-BY-SIDE */}
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
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
          ) : <div className="hidden sm:block flex-1" />}

          <div className="w-full sm:w-auto flex items-center gap-2 min-w-[240px]">
            {committedLines.length > 0 && (
              <DocumentPrint
                customer={selectedCustomer || null}
                documentNumber={effectiveDocumentNumberDisplay}
                documentDateJalali={documentDateJalali}
                lines={committedLines}
              />
            )}
            <DocumentSubmitActions
              onSubmit={async (status) => {
                await save(status);
              }}
            />
          </div>
        </div>
      </motion.section>

      {/* HAWALA TRANSFER MODAL */}
      <HawalaModal
        line={hawalaLine}
        sourceCustomer={selectedCustomer || null}
        allCustomers={customers}
        weightPrecision={weightPrecision}
        onClose={() => setHawalaLine(null)}
        onSuccess={(_targetId) => {
          if (hawalaLine) {
            setCommittedLines((current) => current.filter((l) => l.id !== hawalaLine.id));
            setMessage('ردیف با موفقیت به طرف‌حساب مقصد حواله داده شد و از سند جاری منتقل گردید.');
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
    </div>
  );
}

function JalaliDatePicker({
  selected,
  view,
  onViewChange,
  onPreviousMonth,
  onNextMonth,
  onSelectDay,
  onToday,
}: {
  selected: DateParts;
  view: { year: number; month: number };
  onViewChange: (view: { year: number; month: number }) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (day: number) => void;
  onToday: () => void;
}) {
  const days = daysInJalaliMonth(view.year, view.month);
  const offset = firstWeekDayOfJalaliMonth(view.year, view.month);
  const today = parseJalaliParts(formatJalaliDate());
  const years = Array.from({ length: 21 }, (_, index) => today.year - 10 + index);

  return (
    <motion.div
      className="jalali-picker-popover"
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18 }}
    >
      <div className="jalali-picker-header">
        <button type="button" onClick={onNextMonth} aria-label="ماه بعد">
          <ChevronRight size={17} />
        </button>
        <div className="jalali-picker-selects">
          <select
            value={view.month}
            onChange={(event) => onViewChange({
              ...view,
              month: Number(event.target.value),
            })}
            aria-label="ماه"
          >
            {jalaliMonthNames.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
          <select
            value={view.year}
            onChange={(event) => onViewChange({
              ...view,
              year: Number(event.target.value),
            })}
            aria-label="سال"
          >
            {years.map((year) => (
              <option key={year} value={year}>{toPersianDigits(String(year))}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={onPreviousMonth} aria-label="ماه قبل">
          <ChevronLeft size={17} />
        </button>
      </div>

      <div className="jalali-picker-weekdays">
        {weekDayNames.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="jalali-picker-days">
        {Array.from({ length: offset }, (_, index) => (
          <span className="is-empty" key={`empty-${index}`} />
        ))}
        {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
          const isSelected = selected.year === view.year
            && selected.month === view.month
            && selected.day === day;
          const isToday = today.year === view.year
            && today.month === view.month
            && today.day === day;
          return (
            <button
              type="button"
              key={day}
              className={`${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => onSelectDay(day)}
              aria-pressed={isSelected}
            >
              {toPersianDigits(String(day))}
            </button>
          );
        })}
      </div>

      <div className="jalali-picker-footer">
        <button type="button" onClick={onToday}>
          <CalendarDays size={14} />
          انتخاب امروز
        </button>
        <span>{jalaliMonthNames[view.month - 1]} {toPersianDigits(String(view.year))}</span>
      </div>
    </motion.div>
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
    );

  const metalLabel = line.documentTab === 'currency'
    ? (line.details.currencyUnit || 'ارز')
    : (line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا');

  const rawWeight = line.details.calculationMethod === 'money'
    ? actualWeightFromMoney(line.details)
    : numberValue(line.details.rawWeight);

  const purityVal = numberValue(line.details.purity);

  // Formula: weight * purity / 750
  const c750 = line.converted750
    ?? (rawWeight > 0 && purityVal > 0 ? (rawWeight * purityVal) / 750 : 0);

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
        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate" title={docType}>
          {docType}
        </span>
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
