'use client';

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FlaskConical,
  ListPlus,
  LoaderCircle,
  PencilLine,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import { currencyDisplay, type Customer } from '@/lib/customer';
import DocumentSubmitActions from '@/components/documents/document-submit-actions';
import DocumentEntryTabs from '@/src/components/documents/DocumentEntryTabs';
import DocumentOperationTypeSelector, {
  RawMetalOperationTypeSelector,
} from '@/src/components/documents/DocumentOperationTypeSelector';
import type { DocumentNature } from '@/lib/document';
import {
  formatJalaliDate,
  jalaliToGregorian,
  normalizeDigits,
} from '@/lib/jalali';
import { useAppSettings } from '@/src/components/SettingsProvider';

type RawOperationKind = 'molten' | 'misc' | 'conditional' | 'question' | 'unsettled';
type CalculationMethod = 'weight' | 'money';
type MetalPriceType = 'mesghal17' | 'gram18' | 'ounceUsd';

type DateParts = {
  year: number;
  month: number;
  day: number;
};

type DetailState = {
  metalType: 'gold' | 'silver' | 'platinum';
  rawKind: RawOperationKind;
  rawWeight: string;
  purity: string;
  calculationMethod: CalculationMethod;
  metalPriceType: MetalPriceType;
  metalPrice: string;
  totalAmount: string;
  labName: string;
  stampNumber: string;
  currencyUnit: string;
  currencyQuantity: string;
  currencyUnitPrice: string;
  currencyTotalAmount: string;
  unsettledTrade: boolean;
  currencyTradeId: string;
  settlementCurrencyUnit: string;
  settlementQuantity: string;
  settlesTradeId: string;
  inventorySourceId: string;
};

type DocumentLine = {
  id: string;
  documentNature: DocumentNature;
  documentTab: 'raw-gold' | 'gold-sale' | 'currency' | 'cash';
  documentSubType: string;
  settlementMethod: 'weight' | 'cash' | 'unsettled';
  balanceSource: 'current';
  description: string;
  details: DetailState;
};

type MeltedInventoryItem = {
  id: string;
  weight: number;
  remainingWeight: number;
  purity: number;
  stampNumber: string;
  customerName: string;
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

function createLine(nature: DocumentNature = 'received'): DocumentLine {
  return {
    id: crypto.randomUUID(),
    documentNature: nature,
    documentTab: 'raw-gold',
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

function createCurrencyLine(nature: DocumentNature = 'received'): DocumentLine {
  const line = createLine(nature);
  return {
    ...line,
    documentTab: 'currency',
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
    if (purityNum < 1 || purityNum > 999) {
      return 'عیار باید عددی بین ۱ تا ۹۹۹ باشد.';
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
  const [draftLine, setDraftLine] = useState<DocumentLine>(() => createLine('received'));
  const [committedLines, setCommittedLines] = useState<DocumentLine[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [activeEntryTab, setActiveEntryTab] = useState('metals');
  const [, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [meltedInventory, setMeltedInventory] = useState<MeltedInventoryItem[]>([]);

  // Selection notice modal / toast
  const [noCustomerNotice, setNoCustomerNotice] = useState(false);

  // Deletion modal & restoration toast state
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<DocumentLine | null>(null);
  const [restorationState, setRestorationState] = useState<PendingDelete | null>(null);
  const [restorationTimer, setRestorationTimer] = useState<number>(10);

  // Document lines pin state initialized safely
  const [isLinesPinned, setIsLinesPinned] = useState<boolean>(false);

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

  useEffect(() => {
    function handleNavigationAttempt(event: Event) {
      if (committedLines.length || draftReady) event.preventDefault();
    }
    window.addEventListener('zar:navigation-attempt', handleNavigationAttempt);
    return () => window.removeEventListener('zar:navigation-attempt', handleNavigationAttempt);
  }, [committedLines.length, draftReady]);

  function handlePurityChange(val: string) {
    const normalized = normalizeDigits(val);
    if (normalized === '' || /^\d+(\.\d{0,1})?$/.test(normalized)) {
      updateDraftDetail('purity', normalized);
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
    if (editingLineId || (tab !== 'metals' && tab !== 'gold-sale' && tab !== 'currency')) return;

    const nextTab = tab === 'currency' ? 'currency' : tab === 'gold-sale' ? 'gold-sale' : 'raw-gold';
    if (draftLine.documentTab === nextTab) return;
    setDraftLine(nextTab === 'currency'
      ? createCurrencyLine(documentNature)
      : { ...createLine(documentNature), documentTab: nextTab });
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
        purity: kind === 'conditional' ? '' : current.details.purity || '750',
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

  function commitDraftLine() {
    const validationMessage = validateLine(draftLine);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }
    setErrorMessage('');

    // Snapshot current documentNature onto the committed line object
    const lineToCommit: DocumentLine = {
      ...draftLine,
      documentNature,
    };

    if (editingLineId) {
      setCommittedLines((current) => [
        ...current.filter((line) => line.id !== editingLineId),
        lineToCommit,
      ]);
      setEditingLineId(null);
    } else {
      setCommittedLines((current) => [...current, lineToCommit]);
    }
    setDraftLine(draftLine.documentTab === 'currency'
      ? createCurrencyLine(documentNature)
      : { ...createLine(documentNature), documentTab: draftLine.documentTab });
  }

  function editLine(line: DocumentLine) {
    setDraftLine(line);
    setEditingLineId(line.id);
    setActiveEntryTab(line.documentTab === 'currency'
      ? 'currency'
      : line.documentTab === 'gold-sale' ? 'gold-sale' : 'metals');
    setErrorMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setDraftLine(createLine(documentNature));
    setEditingLineId(null);
    setActiveEntryTab('metals');
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
        : { ...createLine(documentNature), documentTab: activeEntryTab === 'gold-sale' ? 'gold-sale' : 'raw-gold' });
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

  const totals = useMemo(
    () => committedLines.reduce(
      (sum, line) => sum + (
        line.documentNature === 'received' ? 1 : -1
      ) * (line.details.calculationMethod === 'money'
        ? actualWeightFromMoney(line.details)
        : numberValue(line.details.rawWeight)),
      0,
    ),
    [committedLines],
  );

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
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          {/* Right side: Customer Selection Search / Selected Card */}
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
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">جست‌وجوی طرف‌حساب</span>
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
                  className="w-full flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/60 p-2.5 dark:border-teal-900/60 dark:bg-teal-950/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="document-suggestion-avatar"><UserRound size={16} /></span>
                    <div>
                      <strong className="block text-xs font-bold text-slate-800 dark:text-slate-100">{selectedCustomer.name}</strong>
                      <small className="text-[10px] text-slate-500 dark:text-slate-400">
                        کد حساب {toPersianDigits(String(selectedCustomer.customerCode))}
                      </small>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="rounded-lg border border-teal-300 bg-white px-3 py-1 text-xs font-bold text-teal-700 transition hover:bg-teal-50 dark:border-teal-700 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-slate-700"
                  >
                    تغییر
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {selectedCustomer ? (
              <div className="document-account-hint text-xs">
                برای استعلام شماره سند و مانده، طرف حساب را انتخاب کنید
              </div>
            ) : null}
          </div>

          {/* Left side: Document Nature Switch */}
          <div className="flex items-end">
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

        {/* Document Metadata Row */}
        <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Field label="شماره سند خودکار">
            <div className="document-number-field">
              <input
                value={documentNumberLoading ? 'در حال استعلام...' : toPersianDigits(effectiveDocumentNumberDisplay)}
                readOnly
                className="bg-slate-100 dark:bg-slate-800/80 font-bold text-xs h-9"
                aria-label="شماره سند خودکار"
              />
              {documentNumberLoading ? <LoaderCircle size={15} className="spin" /> : <Check size={14} />}
            </div>
          </Field>

          <Field label="تاریخ سند">
            <div className="jalali-picker relative z-50" ref={datePickerRef}>
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

          <Field label="جنس فلز">
            <select
              className="text-xs h-9"
              value={draftLine.details.metalType}
              onChange={(event) => updateDraftDetail(
                'metalType',
                event.target.value as DetailState['metalType'],
              )}
            >
              <option value="gold">طلای خام</option>
              <option value="silver">نقره</option>
              <option value="platinum">پلاتین</option>
            </select>
          </Field>
        </div>
      </section>

      {/* ENTRY TABS EDITOR */}
      <section className="dashboard-panel document-entry-panel document-draft-editor p-3.5 space-y-3">
        {editingLineId ? (
          <div className="document-draft-editor-head flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">اصلاح ردیف انتخاب‌شده</span>
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
            <div className="space-y-4">
              <div className="document-operation-title">
                <div>
                  <h3 className="text-xs font-bold">نوع {documentNature === 'received' ? 'ورود' : 'خروج'} را انتخاب کنید</h3>
                </div>
                <span className={`document-nature-badge ${documentNature}`}>
                  {documentNature === 'received' ? 'دریافتی' : 'پرداختی'}
                </span>
              </div>
              <RawMetalOperationTypeSelector
                nature={documentNature}
                value={draftLine.details.rawKind}
                onChange={changeRawKind}
              />
              <div className="document-dynamic-fields">
                <div className="document-special-grid raw-gold-fields">
                  {documentNature === 'paid' && draftLine.details.rawKind === 'molten' ? (
                    <Field label="انتخاب موجودی آبشده" wide>
                      <select
                        value={draftLine.details.inventorySourceId}
                        onChange={(event) => {
                          const source = meltedInventory.find((item) => item.id === event.target.value);
                          setDraftLine((current) => ({
                            ...current,
                            details: {
                              ...current.details,
                              inventorySourceId: event.target.value,
                              rawWeight: source ? String(source.remainingWeight) : current.details.rawWeight,
                              purity: source ? String(source.purity || 750) : current.details.purity,
                              stampNumber: source?.stampNumber ?? current.details.stampNumber,
                            },
                          }));
                        }}
                      >
                        <option value="">انتخاب از موجودی فعال...</option>
                        {meltedInventory.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.stampNumber || 'بدون انگ'} · {item.customerName} · {item.remainingWeight.toFixed(3)} گرم · عیار {item.purity}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                  <Field label="وزن (گرم)">
                    <input
                      type="number"
                      min="0"
                      step={10 ** -weightPrecision}
                      value={draftLine.details.rawWeight}
                      onChange={(event) => updateDraftDetail('rawWeight', event.target.value)}
                      onKeyDown={handleKeyDownEnter}
                    />
                  </Field>
                  {draftLine.details.rawKind !== 'conditional' ? (
                    <Field label="عیار">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        step="0.1"
                        value={draftLine.details.purity}
                        onChange={(event) => handlePurityChange(event.target.value)}
                        onKeyDown={handleKeyDownEnter}
                      />
                    </Field>
                  ) : null}
                  <Field label="تبدیل‌شده به ۷۵۰">
                    <input
                      readOnly
                      className="computed-field"
                      value={faNumber(convertedTo750(draftLine.details.rawWeight, draftLine.details.purity), weightPrecision)}
                    />
                  </Field>
                  {draftLine.details.rawKind !== 'misc' ? (
                    <>
                      <Field label="نام آزمایشگاه ری‌گیری">
                        <input
                          value={draftLine.details.labName}
                          onChange={(event) => updateDraftDetail('labName', event.target.value)}
                          onKeyDown={handleKeyDownEnter}
                          placeholder="نام آزمایشگاه"
                        />
                      </Field>
                      <Field label="شماره پاکت / انگ">
                        <input
                          value={draftLine.details.stampNumber}
                          onChange={(event) => updateDraftDetail('stampNumber', event.target.value)}
                          onKeyDown={handleKeyDownEnter}
                          placeholder="شماره پاکت یا انگ"
                        />
                      </Field>
                    </>
                  ) : null}
                  <Field label="توضیحات" wide>
                    <textarea
                      value={draftLine.description}
                      onChange={(event) => setDraftLine((current) => ({ ...current, description: event.target.value }))}
                      onKeyDown={handleKeyDownEnter}
                      placeholder="توضیحات تکمیلی..."
                    />
                  </Field>
                </div>
              </div>
              {/* Sticky Floating Submit Row Button */}
              {draftReady ? (
                <div className="sticky bottom-3 z-30 flex justify-center pt-2">
                  <button type="button" className="document-commit-line-button shadow-lg max-w-sm" onClick={commitDraftLine}>
                    <ListPlus size={16} /> {editingLineId ? 'اصلاح ردیف' : 'ثبت ردیف'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
          goldSaleTabContent={(
            <div className="space-y-4">
              <div className="document-operation-section">
                <div className="document-operation-title">
                  <div>
                    <h3 className="text-xs font-bold">نوع {documentNature === 'received' ? 'خرید' : 'فروش'} را انتخاب کنید</h3>
                  </div>
                  <span className={`document-nature-badge ${documentNature}`}>
                    {documentNature === 'received' ? 'خرید / بستانکار' : 'فروش / بدهکار'}
                  </span>
                </div>

                <DocumentOperationTypeSelector
                  nature={documentNature}
                  value={draftLine.details.rawKind}
                  onChange={changeRawKind}
                />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${documentNature}-${draftLine.details.rawKind}`}
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
                        مشخصات {rawOperationLabel(documentNature, draftLine.details.rawKind)}
                      </strong>
                      <small>اطلاعات وزن، عیار و نحوه محاسبه را دقیق وارد کنید.</small>
                    </div>
                  </div>

                  <div className="document-special-grid raw-gold-fields">
                    {documentNature === 'paid' && draftLine.details.rawKind === 'molten' ? (
                      <Field label="انتخاب موجودی آبشده" wide>
                        <select
                          value={draftLine.details.inventorySourceId}
                          onChange={(event) => {
                            const source = meltedInventory.find((item) => item.id === event.target.value);
                            setDraftLine((current) => ({
                              ...current,
                              details: {
                                ...current.details,
                                inventorySourceId: event.target.value,
                                rawWeight: source ? String(source.remainingWeight) : current.details.rawWeight,
                                purity: source ? String(source.purity || 750) : current.details.purity,
                                stampNumber: source?.stampNumber ?? current.details.stampNumber,
                              },
                            }));
                          }}
                        >
                          <option value="">انتخاب از موجودی فعال...</option>
                          {meltedInventory.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.stampNumber || 'بدون انگ'} · {item.customerName} · {item.remainingWeight.toFixed(3)} گرم · عیار {item.purity}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
                    <div className="col-span-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">نحوه محاسبه</span>
                      <div className="flex gap-2">
                        {(['weight', 'money'] as CalculationMethod[]).map((method) => (
                          <button
                            type="button"
                            key={method}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${draftLine.details.calculationMethod === method ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                            onClick={() => updateMetalValue('calculationMethod', method)}
                          >
                            {method === 'weight' ? 'وزنی' : 'پولی'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {draftLine.details.calculationMethod === 'weight' ? (
                      <Field label="وزن ترازویی (گرم)">
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
                    ) : null}

                    <Field label="عیار">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        step="0.1"
                        inputMode="decimal"
                        value={draftLine.details.purity}
                        onChange={(event) => {
                          const norm = normalizeDigits(event.target.value);
                          if (norm === '' || /^\d+(\.\d{0,1})?$/.test(norm)) {
                            updateMetalValue('purity', norm);
                          }
                        }}
                        onKeyDown={handleKeyDownEnter}
                        placeholder="۷۵۰"
                      />
                    </Field>

                    <Field label="تبدیل‌شده به ۷۵۰">
                      <input
                        value={faNumber(
                          draftLine.details.calculationMethod === 'money'
                            ? convertedWeightFromTotal(draftLine.details.totalAmount, draftLine.details.metalPriceType, draftLine.details.metalPrice)
                            : convertedTo750(draftLine.details.rawWeight, draftLine.details.purity),
                          weightPrecision,
                        )}
                        readOnly
                        aria-label="وزن تبدیل‌شده به عیار ۷۵۰"
                        className="computed-field"
                      />
                    </Field>

                    <Field label="نوع فی">
                      <select
                        value={draftLine.details.metalPriceType}
                        onChange={(event) => updateMetalValue('metalPriceType', event.target.value)}
                      >
                        <option value="mesghal17">مثقال ۱۷ عیار</option>
                        <option value="gram18">گرم ۱۸ عیار</option>
                        <option value="ounceUsd">هر اونس (دلاری)</option>
                      </select>
                    </Field>
                    <Field label={metalPriceLabel(draftLine.details.metalPriceType)}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draftLine.details.metalPrice}
                        onChange={(event) => updateMetalValue('metalPrice', event.target.value)}
                        onKeyDown={handleKeyDownEnter}
                      />
                    </Field>
                    <Field label="مبلغ کل">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draftLine.details.totalAmount}
                        onChange={(event) => updateMetalValue('totalAmount', event.target.value)}
                        onKeyDown={handleKeyDownEnter}
                      />
                    </Field>

                    {draftLine.details.rawKind === 'molten' ? (
                      <>
                        <Field label="نام آزمایشگاه ری‌گیری">
                          <input
                            value={draftLine.details.labName}
                            onChange={(event) => updateDraftDetail('labName', event.target.value)}
                            onKeyDown={handleKeyDownEnter}
                            placeholder="نام آزمایشگاه"
                          />
                        </Field>
                        <Field label="شماره پاکت / انگ">
                          <input
                            value={draftLine.details.stampNumber}
                            onChange={(event) => updateDraftDetail('stampNumber', event.target.value)}
                            onKeyDown={handleKeyDownEnter}
                            placeholder="شماره پاکت یا انگ"
                          />
                        </Field>
                      </>
                    ) : null}

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

                  <div className={`raw-metal-result ${documentNature}`}>
                    <Sparkles size={16} />
                    <div>
                      <strong>{rawOperationLabel(documentNature, draftLine.details.rawKind)}</strong>
                      <span>
                        {draftLine.details.rawWeight || draftLine.details.totalAmount
                          ? `${toPersianDigits(faNumber(draftLine.details.calculationMethod === 'money' ? actualWeightFromMoney(draftLine.details) : numberValue(draftLine.details.rawWeight), weightPrecision))} گرم`
                          : 'وزن وارد نشده'}
                        {draftLine.details.purity
                          ? ` · عیار ${toPersianDigits(draftLine.details.purity)}`
                          : ''}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {draftReady ? (
                <div className="sticky bottom-3 z-30 flex justify-center pt-2">
                  <button
                    type="button"
                    className="document-commit-line-button shadow-lg max-w-sm"
                    onClick={commitDraftLine}
                  >
                    <ListPlus size={16} />
                    {editingLineId ? 'اصلاح ردیف' : 'ثبت ردیف'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
          currencyTabContent={(
            <div className="space-y-4">
              <div className="document-operation-title">
                <div>
                  <h3 className="text-xs font-bold">{documentNature === 'received' ? 'خرید ارز' : 'فروش ارز'}</h3>
                </div>
                <span className={`document-nature-badge ${documentNature}`}>
                  {documentNature === 'received' ? 'خرید ارز' : 'فروش ارز'}
                </span>
              </div>

              <div className="document-special-grid raw-gold-fields">
                <Field label="واحد ارز">
                  <select
                    value={draftLine.details.currencyUnit}
                    onChange={(event) => updateDraftDetail('currencyUnit', event.target.value)}
                  >
                    {currencyUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </Field>
                <Field label="تعداد">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={draftLine.details.currencyQuantity}
                    onChange={(event) => updateCurrencyValue('currencyQuantity', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                  />
                </Field>
                <Field label="قیمت هر واحد (ریال)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={draftLine.details.currencyUnitPrice}
                    onChange={(event) => updateCurrencyValue('currencyUnitPrice', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                  />
                </Field>
                <Field label="مبلغ کل (ریال)">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="decimal"
                    value={draftLine.details.currencyTotalAmount}
                    onChange={(event) => updateCurrencyValue('currencyTotalAmount', event.target.value)}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="۰"
                  />
                </Field>
                <label className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={draftLine.details.unsettledTrade}
                    onChange={(event) => setDraftLine((current) => ({
                      ...current,
                      settlementMethod: event.target.checked ? 'unsettled' : 'cash',
                      details: { ...current.details, unsettledTrade: event.target.checked },
                    }))}
                  />
                  <span>
                    بدون تسویه
                    <small className="mt-1 block text-xs font-normal opacity-80">
                      مبلغ نقدی اکنون ثبت نمی‌شود و بدهی/بستانکاری ارز در حساب طرف‌حساب می‌ماند.
                    </small>
                  </span>
                </label>
                <Field label="توضیحات" wide>
                  <textarea
                    value={draftLine.description}
                    onChange={(event) => setDraftLine((current) => ({
                      ...current,
                      description: event.target.value,
                    }))}
                    onKeyDown={handleKeyDownEnter}
                    placeholder="توضیحات معامله ارزی..."
                  />
                </Field>
              </div>

              {draftReady ? (
                <div className="sticky bottom-3 z-30 flex justify-center pt-2">
                  <button
                    type="button"
                    className="document-commit-line-button shadow-lg max-w-sm"
                    onClick={commitDraftLine}
                  >
                    <ListPlus size={16} />
                    {editingLineId ? 'اصلاح ردیف' : 'ثبت ردیف'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
          cashTabContent={(
            <div className="grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <Wallet className="text-emerald-600" size={20} />
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">تسویه معاملات بدون تسویه</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">ارز و مقدار معامله باز را برای تسویه بعدی انتخاب کنید.</p>
                </div>
              </div>
              <select
                className="text-xs h-9"
                value={draftLine.details.settlesTradeId}
                onChange={(event) => {
                  const trade = committedLines.find((line) => line.id === event.target.value);
                  setDraftLine((current) => ({
                    ...current,
                    details: {
                      ...current.details,
                      settlesTradeId: event.target.value,
                      settlementCurrencyUnit: trade?.details.currencyUnit ?? current.details.settlementCurrencyUnit,
                      settlementQuantity: trade?.details.currencyQuantity ?? current.details.settlementQuantity,
                    },
                  }));
                }}
              >
                <option value="">انتخاب معامله باز...</option>
                {committedLines.filter((line) => line.documentTab === 'currency' && line.details.unsettledTrade).map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.details.currencyQuantity || '۰'} {line.details.currencyUnit} · {line.details.currencyTotalAmount || '۰'} ریال
                  </option>
                ))}
              </select>
            </div>
          )}
        />
      </section>

      {/* DOCUMENT LINES PANEL (with Pin / Unpin option) */}
      <section
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
                  <th style={{ width: '6%' }}>ردیف</th>
                  <th style={{ width: '22%' }}>نوع سند</th>
                  <th style={{ width: '12%' }}>نوع ارز</th>
                  <th style={{ width: '14%' }}>بدهکار وزنی</th>
                  <th style={{ width: '14%' }}>بستانکار وزنی</th>
                  <th style={{ width: '14%' }}>بدهکار مالی</th>
                  <th style={{ width: '14%' }}>بستانکار مالی</th>
                  <th style={{ width: '4%' }}></th>
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
                      weightPrecision={weightPrecision}
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
            <div className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 text-xs font-bold shrink-0">
              <span className="text-slate-600 dark:text-slate-400">خالص اثر سند بر مانده طلا:</span>
              <strong className={totals >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {faNumber(Math.abs(totals), weightPrecision)} گرم
                {' · '}
                {totals >= 0 ? 'بستانکار' : 'بدهکار'}
              </strong>
            </div>
          ) : <div className="hidden sm:block flex-1" />}

          <div className="w-full sm:w-auto min-w-[240px]">
            <DocumentSubmitActions
              onSubmit={async (status) => {
                await save(status);
              }}
            />
          </div>
        </div>
      </section>

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
      className="document-liquid-balance"
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: 'auto', y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className="document-liquid-title">
        <span className="document-liquid-orb"><Sparkles size={14} /></span>
        <div>
          <strong>مانده جاری حساب‌ها</strong>
          <small>مثبت: بستانکار · منفی: بدهکار</small>
        </div>
      </div>
      <div className="document-liquid-items">
        {visibleBalances.map((balance, index) => (
          <motion.div
            className={`document-liquid-item ${
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
            <small>{balance.label}</small>
            <strong>
              {faNumber(Math.abs(balance.value), balance.digits)}
              {' '}
              {balance.unit}
            </strong>
            <em>
              {balance.value > 0
                ? 'بستانکار'
                : balance.value < 0
                  ? 'بدهکار'
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
  weightPrecision = 3,
}: {
  line: DocumentLine;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  weightPrecision?: number;
}) {
  const isPaid = line.documentNature === 'paid';
  const isReceived = line.documentNature === 'received';

  let docType = '';
  let currencyUnit = '';
  let weight = 0;
  let financialAmount = 0;

  if (line.documentTab === 'currency') {
    docType = line.details.unsettledTrade
      ? (isReceived ? 'خرید ارز (بدون تسویه)' : 'فروش ارز (بدون تسویه)')
      : (isReceived ? 'خرید ارز' : 'فروش ارز');
    currencyUnit = line.details.currencyUnit || 'ریال';
    weight = 0;
    financialAmount = numberValue(line.details.currencyTotalAmount);
  } else {
    docType = rawOperationLabel(line.documentNature, line.details.rawKind);
    currencyUnit = line.details.metalType === 'silver'
      ? 'نقره'
      : line.details.metalType === 'platinum'
        ? 'پلاتین'
        : 'طلا';
    weight = line.details.calculationMethod === 'money'
      ? actualWeightFromMoney(line.details)
      : numberValue(line.details.rawWeight);
    financialAmount = numberValue(line.details.totalAmount);
  }

  const bedehkarVazni = isPaid && weight > 0 ? faNumber(weight, weightPrecision) : null;
  const bostankarVazni = isReceived && weight > 0 ? faNumber(weight, weightPrecision) : null;
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
        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
          {docType}
        </span>
        {line.description ? (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate">
            {line.description}
          </span>
        ) : null}
      </td>
      <td className="text-center font-medium text-slate-600 dark:text-slate-300">
        {currencyUnit}
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
      <td className="text-center">
        {bedehkarMali ? (
          <span className="text-rose-600 dark:text-rose-400 font-bold">{bedehkarMali}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </td>
      <td className="text-center">
        {bostankarMali ? (
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{bostankarMali}</span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">-</span>
        )}
      </td>
      <td className="text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="ویرایش ردیف"
            title="ویرایش ردیف"
            className="p-1 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            <PencilLine size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="حذف ردیف"
            title="حذف ردیف"
            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`account-field ${wide ? 'document-field-wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
