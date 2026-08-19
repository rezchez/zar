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
  Scale,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Wallet,
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
  pocketNumber: string;
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
      pocketNumber: '',
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
  if (
    (numberValue(line.details.purity) < 1 || numberValue(line.details.purity) > 999)
  ) {
    return 'عیار باید عددی بین ۱ تا ۹۹۹ باشد.';
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
  nextDocumentNumber,
}: {
  customers: Customer[];
  nextDocumentNumber: number;
}) {
  const initialDate = parseJalaliParts(formatJalaliDate());
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [documentNumber, setDocumentNumber] = useState(String(nextDocumentNumber));
  const [documentNumberLoading, setDocumentNumberLoading] = useState(false);
  const documentIdRef = useRef<string>(crypto.randomUUID());
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
  const [weightPrecision] = useState(() => {
    if (typeof window === 'undefined') return 3;
    try {
      const raw = window.localStorage.getItem('zar-program-settings-preview');
      const configured = raw
        ? Number((JSON.parse(raw) as { decimalScale?: string }).decimalScale)
        : 3;
      return Number.isFinite(configured)
        ? Math.min(8, Math.max(0, configured))
        : 3;
    } catch {
      return 3;
    }
  });
  const datePickerRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = customers.find(
    (customer) => customer.id === selectedCustomerId,
  );

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
  const documentNumberPreview = selectedCustomer
    ? `ZF${normalizeDigits(documentDateJalali).replace(/\D/g, '')}${selectedCustomer.customerCode}${documentNumber}`
    : `ZF${normalizeDigits(documentDateJalali).replace(/\D/g, '')}—${documentNumber}`;
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
          nextDocumentSequence?: number;
          message?: string;
        };
        if (!response.ok || typeof data.nextDocumentSequence !== 'number') {
          throw new Error(data.message ?? 'شماره سند دریافت نشد.');
        }
        setDocumentNumber(String(data.nextDocumentSequence));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setErrorMessage('استعلام شماره سند این طرف‌حساب انجام نشد؛ دوباره تلاش کنید.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setDocumentNumberLoading(false);
      });

    return () => controller.abort();
  }, [nextDocumentNumber, selectedCustomerId]);

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
    setDocumentNumber(String(nextDocumentNumber));
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
    setCommittedLines((current) => current.map((line) => ({
      ...line,
      documentNature: nature,
      documentSubType: line.documentTab === 'currency'
        ? currencyDocumentSubType(nature)
        : line.documentTab === 'gold-sale'
          ? goldSaleSubType(nature, line.details.rawKind)
          : documentSubType(nature, line.details.rawKind),
    })));
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
        pocketNumber: kind === 'misc' ? '' : current.details.pocketNumber,
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

    if (editingLineId) {
      setCommittedLines((current) => [
        ...current.filter((line) => line.id !== editingLineId),
        draftLine,
      ]);
      setEditingLineId(null);
    } else {
      setCommittedLines((current) => [...current, draftLine]);
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

  function removeLine(lineId: string) {
    setCommittedLines((current) => current.filter((line) => line.id !== lineId));
    if (editingLineId === lineId) cancelEdit();
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
        throw new Error('ابتدا طرف‌حساب را از فهرست نتایج انتخاب کنید.');
      }
      if (documentNumberLoading) {
        throw new Error('لطفاً تا پایان استعلام شماره سند صبر کنید.');
      }
      if (!committedLines.length) {
        throw new Error(
          draftReady
            ? 'اطلاعات ردیف وارد شده است؛ ابتدا «ثبت ردیف در سند» را بزنید.'
            : 'هنوز هیچ ردیفی به سند اضافه نشده است.',
        );
      }

      const response = await fetch('/api/documents', {
        method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            customerId: selectedCustomerId,
            documentId: documentIdRef.current,
            documentNumber,
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
            // An unsettled deal intentionally has no cash-side amount. The
            // currency quantity remains on the customer's ledger until it is
            // settled from the cash drawer in a later document.
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
          nextDocumentSequence?: number;
        }
        | null;

      if (!response.ok) {
        throw new Error(data?.message ?? 'ثبت سند انجام نشد.');
      }

      const registeredNumber = data?.documentNumber ?? documentNumber;
      setMessage(
        `سند شماره ${toPersianDigits(registeredNumber)} با ${faNumber(committedLines.length)} ردیف ثبت شد.`,
      );
      const nextSequence = Number(data?.nextDocumentSequence ?? documentNumber);
      setDocumentNumber(String(Number.isFinite(nextSequence) ? nextSequence : 1));
      setCommittedLines([]);
      documentIdRef.current = crypto.randomUUID();
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
    <div className="document-form-page">
      {message ? <p className="account-message"><Check size={15} />{message}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <section className="dashboard-panel document-account-panel">
        <div className="document-account-heading">
          <div>
            <p className="eyebrow">مشخصات حساب</p>
            <h2>طرف‌حساب و مانده جاری</h2>
          </div>
          {selectedCustomer ? (
            <span className="customer-code-badge">
              کد حساب {toPersianDigits(String(selectedCustomer.customerCode))}
            </span>
          ) : null}
        </div>

        <div className="document-account-layout">
          <label className="account-field document-account-search-field">
            <span>نام یا کد طرف‌حساب</span>
            <div className="gooey-search document-search-shell">
              <Search size={16} />
              <input
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  if (selectedCustomerId) {
                    setSelectedCustomerId('');
                    setDocumentNumber(String(nextDocumentNumber));
                    setDocumentNumberLoading(false);
                  }
                }}
                placeholder="جست‌وجوی نام یا کد..."
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

          {selectedCustomer ? (
            <motion.div
              className="document-selected-customer"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="document-suggestion-avatar"><UserRound size={16} /></span>
              <div>
                <strong>{selectedCustomer.name}</strong>
                <small>طرف‌حساب انتخاب‌شده</small>
              </div>
              <button type="button" onClick={clearCustomer}>تغییر</button>
            </motion.div>
          ) : (
            <div className="document-account-hint">
              برای استعلام شماره سند و مانده، طرف‌حساب را انتخاب کنید.
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {selectedCustomer ? (
            <CustomerBalanceLiquid
              key={selectedCustomer.id}
              customer={selectedCustomer}
            />
          ) : null}
        </AnimatePresence>
      </section>

      <section className="dashboard-panel document-meta-panel">
        <div className="document-header-grid">
          <Field label="شماره سند خودکار">
            <div className="document-number-field">
              <input
                value={documentNumberLoading ? 'در حال استعلام...' : toPersianDigits(documentNumberPreview)}
                readOnly
                aria-label="شماره سند خودکار"
              />
              {documentNumberLoading ? <LoaderCircle size={16} className="spin" /> : <Check size={15} />}
            </div>
          </Field>

          <Field label="تاریخ سند">
            <div className="jalali-picker" ref={datePickerRef}>
              <button
                type="button"
                className={`jalali-picker-trigger ${dateOpen ? 'is-open' : ''}`}
                onClick={() => {
                  setCalendarView({ year: dateParts.year, month: dateParts.month });
                  setDateOpen((value) => !value);
                }}
                aria-expanded={dateOpen}
              >
                <CalendarDays size={16} />
                <span>{documentDateJalali}</span>
                <ChevronLeft size={14} />
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

              <small className="document-date-distance">
                <Clock3 size={13} />
                {distanceLabel}
              </small>
            </div>
          </Field>

          <Field label="جنس فلز">
            <select
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
      </section>

      <section className="dashboard-panel document-entry-panel document-draft-editor">
        <div className="document-draft-editor-head">
          <div>
            <p className="eyebrow">{editingLineId ? 'ویرایش ردیف' : 'ماهیت سند'}</p>
            <h2>
              {editingLineId
                ? 'اصلاح ردیف انتخاب‌شده'
                : `ردیف ${faNumber(committedLines.length + 1)} سند`}
            </h2>
          </div>
          {editingLineId ? (
            <button type="button" className="document-cancel-edit" onClick={cancelEdit}>
              انصراف از ویرایش
            </button>
          ) : null}
        </div>

        <DocumentEntryTabs
          accountCodeZero="0"
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
            <div className="space-y-5">
              <div className="document-operation-title">
                <div>
                  <p className="eyebrow">ورود و خروج فلزات</p>
                  <h3>نوع {documentNature === 'received' ? 'ورود' : 'خروج'} را انتخاب کنید</h3>
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
                      step="0.001"
                      value={draftLine.details.rawWeight}
                      onChange={(event) => updateDraftDetail('rawWeight', event.target.value)}
                    />
                  </Field>
                  {draftLine.details.rawKind !== 'conditional' ? (
                    <Field label="عیار">
                      <input
                        type="number"
                        min="1"
                        max="999"
                        step="1"
                        value={draftLine.details.purity}
                        onChange={(event) => updateDraftDetail('purity', event.target.value)}
                      />
                    </Field>
                  ) : null}
                  <Field label="تبدیل‌شده به ۷۵۰">
                    <input
                      readOnly
                      className="computed-field"
                      value={faNumber(convertedTo750(draftLine.details.rawWeight, draftLine.details.purity), 3)}
                    />
                  </Field>
                  {draftLine.details.rawKind !== 'misc' ? (
                    <>
                      <Field label="نام آزمایشگاه ری‌گیری"><input value={draftLine.details.labName} onChange={(event) => updateDraftDetail('labName', event.target.value)} /></Field>
                      <Field label="شماره پاکت"><input value={draftLine.details.pocketNumber} onChange={(event) => updateDraftDetail('pocketNumber', event.target.value)} /></Field>
                      <Field label="شماره انگ"><input value={draftLine.details.stampNumber} onChange={(event) => updateDraftDetail('stampNumber', event.target.value)} /></Field>
                    </>
                  ) : null}
                  <Field label="توضیحات" wide>
                    <textarea value={draftLine.description} onChange={(event) => setDraftLine((current) => ({ ...current, description: event.target.value }))} />
                  </Field>
                </div>
              </div>
              {draftReady ? (
                <button type="button" className="document-commit-line-button" onClick={commitDraftLine}>
                  <ListPlus size={18} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف در سند'}
                </button>
              ) : null}
            </div>
          )}
          goldSaleTabContent={(
            <div className="space-y-5">
              <div className="document-operation-section">
              <div className="document-operation-title">
                <div>
                  <p className="eyebrow">نوع عملیات</p>
                  <h3>نوع {documentNature === 'received' ? 'خرید' : 'فروش'} را انتخاب کنید</h3>
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
                  {!meltedInventory.length ? (
                    <small className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      موجودی آبشده فعالی برای خروج پیدا نشد.
                    </small>
                  ) : null}
                </Field>
              ) : null}
              <div className="col-span-full flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">نحوه محاسبه</span>
                <div className="flex gap-2">
                  {(['weight', 'money'] as CalculationMethod[]).map((method) => (
                    <button
                      type="button"
                      key={method}
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${draftLine.details.calculationMethod === method ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                      onClick={() => updateMetalValue('calculationMethod', method)}
                    >
                      {method === 'weight' ? 'وزنی' : 'پولی'}
                    </button>
                  ))}
                </div>
              </div>

              {draftLine.details.calculationMethod === 'weight' ? <Field label="وزن ترازویی (گرم)">
                <input
                  type="number"
                  min="0"
                  step={10 ** -weightPrecision}
                  inputMode="decimal"
                  value={draftLine.details.rawWeight}
                  onChange={(event) => updateMetalValue('rawWeight', event.target.value)}
                  placeholder="۰٫۰۰۰"
                  className="w-[8ch]"
                />
              </Field> : null}

              <Field label="عیار">
                <input
                  type="number"
                  min="1"
                  max="999"
                  step="1"
                  inputMode="numeric"
                  value={draftLine.details.purity}
                  onChange={(event) => updateMetalValue('purity', event.target.value)}
                  placeholder="۷۵۰"
                  className="w-[8ch]"
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
                />
              </Field>
              <Field label="مبلغ کل">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draftLine.details.totalAmount}
                  onChange={(event) => updateMetalValue('totalAmount', event.target.value)}
                />
              </Field>

              {draftLine.details.rawKind === 'molten' ? (
                <>
                  <Field label="نام آزمایشگاه ری‌گیری">
                    <input
                      value={draftLine.details.labName}
                      onChange={(event) => updateDraftDetail('labName', event.target.value)}
                      placeholder="نام آزمایشگاه"
                    />
                  </Field>
                  <Field label="شماره پاکت">
                    <input
                      value={draftLine.details.pocketNumber}
                      onChange={(event) => updateDraftDetail('pocketNumber', event.target.value)}
                      placeholder="شماره پاکت"
                    />
                  </Field>
                  <Field label="شماره انگ">
                    <input
                      value={draftLine.details.stampNumber}
                      onChange={(event) => updateDraftDetail('stampNumber', event.target.value)}
                      placeholder="شماره انگ"
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
                  placeholder="توضیحات تکمیلی این ردیف..."
                />
              </Field>
            </div>

            <div className={`raw-metal-result ${documentNature}`}>
              <Sparkles size={17} />
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

              <AnimatePresence mode="wait">
                {draftReady ? (
                  <motion.button
                    type="button"
                    className="document-commit-line-button"
                    onClick={commitDraftLine}
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <ListPlus size={18} />
                    {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف در سند'}
                  </motion.button>
                ) : (
                  <motion.p
                    className="document-draft-hint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    با وارد کردن وزن، دکمه «ثبت ردیف در سند» فعال می‌شود.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
          currencyTabContent={(
            <div className="space-y-5">
              <div className="document-operation-title">
                <div>
                  <p className="eyebrow">عملیات ارزی</p>
                  <h3>{documentNature === 'received' ? 'خرید ارز' : 'فروش ارز'}</h3>
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
                    placeholder="توضیحات معامله ارزی..."
                  />
                </Field>
              </div>

              <div className={`raw-metal-result ${documentNature}`}>
                <Wallet size={17} />
                <div>
                  <strong>{documentNature === 'received' ? 'خرید ارز' : 'فروش ارز'}</strong>
                  <span>
                    {draftLine.details.currencyQuantity
                      ? `${toPersianDigits(draftLine.details.currencyQuantity)} ${draftLine.details.currencyUnit}`
                      : 'تعداد وارد نشده'}
                    {draftLine.details.currencyTotalAmount
                      ? ` · ${toPersianDigits(draftLine.details.currencyTotalAmount)} ریال`
                      : ''}
                    {draftLine.details.unsettledTrade ? ' · بدون تسویه' : ''}
                  </span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {draftReady ? (
                  <motion.button
                    type="button"
                    className="document-commit-line-button"
                    onClick={commitDraftLine}
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  >
                    <ListPlus size={18} />
                    {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف ارزی در سند'}
                  </motion.button>
                ) : (
                  <motion.p className="document-draft-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    با وارد کردن دو مقدار، مقدار سوم خودکار محاسبه می‌شود.
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
          cashTabContent={(
            <div className="grid gap-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <Wallet className="text-emerald-600" size={24} />
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">تسویه معاملات بدون تسویه</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">ارز و مقدار معامله باز را برای تسویه بعدی انتخاب کنید.</p>
                </div>
              </div>
              <select
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
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="واحد ارز تسویه">
                  <input value={draftLine.details.settlementCurrencyUnit} readOnly />
                </Field>
                <Field label="مقدار تسویه">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draftLine.details.settlementQuantity}
                    onChange={(event) => updateDraftDetail('settlementQuantity', event.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}
        />
      </section>

      <section className="dashboard-panel document-lines-panel">
        <div className="document-lines-head">
          <div>
            <p className="eyebrow">ردیف‌های سند</p>
            <h2>
              <ClipboardList size={18} />
              {committedLines.length
                ? `${faNumber(committedLines.length)} ردیف آماده ثبت`
                : 'هنوز ردیفی ثبت نشده است'}
            </h2>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {committedLines.map((line, index) => (
            <CommittedLineRow
              key={line.id}
              line={line}
              index={index}
              onEdit={() => editLine(line)}
              onRemove={() => removeLine(line.id)}
            />
          ))}
        </AnimatePresence>

        {!committedLines.length ? (
          <div className="document-lines-empty">
            <Scale size={26} strokeWidth={1.4} />
            <p>ردیف‌ها پیش از ثبت نهایی در این بخش نگه‌داری می‌شوند.</p>
          </div>
        ) : (
          <div className="document-totals-bar">
            <span>خالص اثر سند بر مانده طلا:</span>
            <strong className={totals >= 0 ? 'is-positive' : 'is-negative'}>
              {faNumber(Math.abs(totals), 3)} گرم
              {' · '}
              {totals >= 0 ? 'بستانکار' : 'بدهکار'}
            </strong>
          </div>
        )}
      </section>

      <div className="document-actions">
        <DocumentSubmitActions
          onSubmit={async (status) => {
            await save(status);
          }}
        />
      </div>
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
}: {
  line: DocumentLine;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}) {
  if (line.documentTab === 'currency') {
    const isPurchase = line.documentNature === 'received';
    return (
      <motion.article
        layout
        className={`document-line-row ${line.documentNature}`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: -24, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        <span className="document-line-row-index">{faNumber(index + 1)}</span>
        <div className="document-line-row-main">
          <div className="document-line-row-title">
            <strong>{isPurchase ? 'خرید ارز' : 'فروش ارز'}</strong>
            <span className={`document-nature-badge ${line.documentNature}`}>
              {line.details.unsettledTrade ? 'بدون تسویه' : isPurchase ? 'خرید' : 'فروش'}
            </span>
          </div>
          <small>
            {line.details.currencyUnit} · قیمت واحد {toPersianDigits(line.details.currencyUnitPrice || '۰')} ریال
            {line.description ? ` — ${line.description}` : ''}
          </small>
        </div>
        <div className="document-line-row-figures">
          <span>
            <strong>{faNumber(numberValue(line.details.currencyQuantity), 2)}</strong>
            {' '}{line.details.currencyUnit}
            <small className="block">
              {faNumber(numberValue(line.details.currencyTotalAmount))} ریال
            </small>
          </span>
        </div>
        <div className="document-line-row-actions">
          <button type="button" onClick={onEdit} aria-label="ویرایش ردیف" title="ویرایش ردیف">
            <PencilLine size={15} />
          </button>
          <button
            type="button"
            className="is-danger"
            onClick={onRemove}
            aria-label="حذف ردیف"
            title="حذف ردیف"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </motion.article>
    );
  }

  const kind = line.details.rawKind;
  const labInfo = [
    line.details.purity && `عیار ${toPersianDigits(line.details.purity)}`,
    line.details.labName,
    line.details.pocketNumber && `پاکت ${toPersianDigits(line.details.pocketNumber)}`,
    line.details.stampNumber && `انگ ${toPersianDigits(line.details.stampNumber)}`,
  ].filter(Boolean).join(' · ');

  return (
    <motion.article
      layout
      className={`document-line-row ${line.documentNature}`}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -24, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <span className="document-line-row-index">{faNumber(index + 1)}</span>
      <div className="document-line-row-main">
        <div className="document-line-row-title">
          <strong>{rawOperationLabel(line.documentNature, kind)}</strong>
          <span className={`document-nature-badge ${line.documentNature}`}>
            {line.documentNature === 'received' ? 'بستانکار' : 'بدهکار'}
          </span>
        </div>
        <small>
          {labInfo || 'طلای خام'}
          {line.description ? ` — ${line.description}` : ''}
        </small>
      </div>
      <div className="document-line-row-figures">
        <span>
          <strong>{faNumber(
            line.details.calculationMethod === 'money'
              ? actualWeightFromMoney(line.details)
              : numberValue(line.details.rawWeight),
            3,
          )}</strong>
          {' '}گرم طلا
          <small className="block">{faNumber(numberValue(line.details.totalAmount))} مبلغ کل</small>
        </span>
      </div>
      <div className="document-line-row-actions">
        <button type="button" onClick={onEdit} aria-label="ویرایش ردیف" title="ویرایش ردیف">
          <PencilLine size={15} />
        </button>
        <button
          type="button"
          className="is-danger"
          onClick={onRemove}
          aria-label="حذف ردیف"
          title="حذف ردیف"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </motion.article>
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
