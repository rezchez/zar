'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Printer,
  Download,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  Coins,
  CreditCard,
  Banknote,
  Percent,
  Layers,
  Scale,
  Calendar,
  CalendarDays,
  User,
  Users,
  Check,
  X,
  Phone,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Sparkles,
  Flame,
  Copy,
  CheckCheck,
  SlidersHorizontal,
  ChevronsUpDown,
  Columns3,
} from 'lucide-react';
import type { Customer } from '@/lib/customer';
import type { CustomerTransaction } from '@/lib/transaction';
import { useAppSettings } from '@/src/components/SettingsProvider';
import {
  parseTransactionBreakdown,
  matchesLedgerCategoryFilter,
  getJournalLineBadge,
  getDocumentLineDescription,
  getRowExtraDetails,
} from '@/features/customers/utils/document-breakdown';
import * as xlsx from 'xlsx';

type LedgerOpeningBalances = {
  goldAmount: number;
  silverAmount: number;
  platinumAmount: number;
  rialAmount: number;
  foreignBalances?: Record<string, number>;
};

const CATEGORY_FILTER_BUTTONS = [
  {
    id: 'all',
    label: 'همه اقلام',
    icon: Layers,
    activeColor:
      'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 shadow-sm border-slate-900 dark:border-amber-500 font-black',
  },
  {
    id: 'raw-gold',
    label: 'طلای آبشده',
    icon: Flame,
    activeColor:
      'bg-amber-500 text-slate-950 dark:bg-amber-500 dark:text-slate-950 shadow-sm border-amber-500 font-black',
  },
  {
    id: 'gold-sale',
    label: 'کار ساخته',
    icon: Sparkles,
    activeColor:
      'bg-indigo-600 text-white dark:bg-indigo-500 dark:text-white shadow-sm border-indigo-600 font-black',
  },
  {
    id: 'bank',
    label: 'بانک و چک',
    icon: CreditCard,
    activeColor:
      'bg-sky-600 text-white dark:bg-sky-500 dark:text-white shadow-sm border-sky-600 font-black',
  },
  {
    id: 'cash',
    label: 'نقد و صندوق',
    icon: Banknote,
    activeColor:
      'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-white shadow-sm border-emerald-600 font-black',
  },
  {
    id: 'discount',
    label: 'تخفیفها',
    icon: Percent,
    activeColor:
      'bg-rose-600 text-white dark:bg-rose-500 dark:text-white shadow-sm border-rose-600 font-black',
  },
  {
    id: 'coin',
    label: 'مسکوکات',
    icon: Coins,
    activeColor:
      'bg-amber-600 text-white dark:bg-amber-500 dark:text-slate-950 shadow-sm border-amber-600 font-black',
  },
] as const;

export type ColumnVisibility = {
  rowNumber: boolean;
  date: boolean;
  docNumber: boolean;
  customer: boolean;
  journalLine: boolean;
  description: boolean;
  stampNumber: boolean;
  assayLab: boolean;
  rawWeight: boolean;
  purity: boolean;
  checkDetails: boolean;
  bankDetails: boolean;
  foreignCurrency: boolean;
  goldDebtor: boolean;
  goldCreditor: boolean;
  goldBalance: boolean;
  rialDebtor: boolean;
  rialCreditor: boolean;
  rialBalance: boolean;
  actions: boolean;
};

const DEFAULT_COLUMNS: ColumnVisibility = {
  rowNumber: true,
  date: true,
  docNumber: true,
  customer: true,
  journalLine: true,
  description: true,
  stampNumber: false,
  assayLab: false,
  rawWeight: false,
  purity: false,
  checkDetails: false,
  bankDetails: false,
  foreignCurrency: false,
  goldDebtor: true,
  goldCreditor: true,
  goldBalance: true,
  rialDebtor: true,
  rialCreditor: true,
  rialBalance: true,
  actions: true,
};

const COLUMN_GROUPS: {
  id: string;
  title: string;
  columns: { key: keyof ColumnVisibility; label: string; desc?: string }[];
}[] = [
  {
    id: 'base',
    title: 'ستون‌های اصلی سند',
    columns: [
      { key: 'rowNumber', label: '# (ردیف)' },
      { key: 'date', label: 'تاریخ و ساعت سند' },
      { key: 'docNumber', label: 'شماره سند' },
      { key: 'customer', label: 'طرف‌حساب' },
      { key: 'journalLine', label: 'آرتیکل سند (درختواره حساب‌ها)' },
      { key: 'description', label: 'شرح ردیف سند' },
    ],
  },
  {
    id: 'extra',
    title: 'ستون‌های تکمیلی تراکنش‌ها (قابل افزودن)',
    columns: [
      { key: 'stampNumber', label: 'شماره انگ طلا', desc: 'کد انگ آزمایشگاه' },
      { key: 'assayLab', label: 'آزمایشگاه ری‌گیری', desc: 'مرکز عیارسنجی' },
      { key: 'rawWeight', label: 'وزن ناخالص / کار', desc: 'وزن فیزیکی' },
      { key: 'purity', label: 'عیار طلا', desc: 'عیار مستقیم یا شرطی' },
      { key: 'checkDetails', label: 'مشخصات چک صیادی', desc: 'شماره، سررسید و صیاد' },
      { key: 'bankDetails', label: 'بانک و کد پیگیری', desc: 'حساب و شماره پیگیری' },
      { key: 'foreignCurrency', label: 'ارز و مبالغ ارزی', desc: 'نوع ارز و مبلغ' },
    ],
  },
  {
    id: 'financial',
    title: 'گردش و مانده طلا و ریال',
    columns: [
      { key: 'goldDebtor', label: 'بدهکار طلا (۷۵۰)' },
      { key: 'goldCreditor', label: 'بستانکار طلا (۷۵۰)' },
      { key: 'goldBalance', label: 'مانده طلای ۷۵۰' },
      { key: 'rialDebtor', label: 'بدهکار ریالی' },
      { key: 'rialCreditor', label: 'بستانکار ریالی' },
      { key: 'rialBalance', label: 'مانده ریالی' },
      { key: 'actions', label: 'ستون عملیات' },
    ],
  },
];

const DATE_PRESETS = [
  { id: 'today', label: 'امروز' },
  { id: '7days', label: '۷ روز' },
  { id: '30days', label: '۳۰ روز' },
  { id: '3months', label: '۳ ماه' },
  { id: 'thisYear', label: 'امسال' },
  { id: 'all', label: 'کل دوره' },
] as const;

type DatePresetType = (typeof DATE_PRESETS)[number]['id'] | 'custom';

function getPresetDates(preset: (typeof DATE_PRESETS)[number]['id']) {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  if (preset === 'all') {
    return { from: '', to: '' };
  }

  const todayParts = formatter.formatToParts(now);
  const jYear = todayParts.find((p) => p.type === 'year')?.value || '1403';
  const jMonth = todayParts.find((p) => p.type === 'month')?.value || '01';
  const jDay = todayParts.find((p) => p.type === 'day')?.value || '01';
  const todayStr = `${jYear}/${jMonth}/${jDay}`;

  if (preset === 'today') {
    return { from: todayStr, to: todayStr };
  }
  if (preset === '7days') {
    const d = new Date(now.getTime() - 7 * 86400000);
    const parts = formatter.formatToParts(d);
    return {
      from: `${parts.find((p) => p.type === 'year')?.value}/${parts.find((p) => p.type === 'month')?.value}/${parts.find((p) => p.type === 'day')?.value}`,
      to: todayStr,
    };
  }
  if (preset === '30days') {
    const d = new Date(now.getTime() - 30 * 86400000);
    const parts = formatter.formatToParts(d);
    return {
      from: `${parts.find((p) => p.type === 'year')?.value}/${parts.find((p) => p.type === 'month')?.value}/${parts.find((p) => p.type === 'day')?.value}`,
      to: todayStr,
    };
  }
  if (preset === '3months') {
    const d = new Date(now.getTime() - 90 * 86400000);
    const parts = formatter.formatToParts(d);
    return {
      from: `${parts.find((p) => p.type === 'year')?.value}/${parts.find((p) => p.type === 'month')?.value}/${parts.find((p) => p.type === 'day')?.value}`,
      to: todayStr,
    };
  }
  if (preset === 'thisYear') {
    return {
      from: `${jYear}/01/01`,
      to: todayStr,
    };
  }
  return { from: '', to: '' };
}

const badgeStyles: Record<string, string> = {
  amber: 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800',
  sky: 'bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800',
  purple: 'bg-purple-100 dark:bg-purple-900/40 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-800',
  rose: 'bg-rose-100 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800',
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
};

export default function CustomerLedgerReport({
  availableCustomers,
}: {
  availableCustomers: Customer[];
}) {
  const { settings, formatMoney, formatWeight } = useAppSettings();
  const baseCurrencySymbol = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  // Filters state
  const [customerId, setCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const customerSearchInputRef = useRef<HTMLInputElement>(null);

  const [activeDatePreset, setActiveDatePreset] = useState<DatePresetType>('30days');
  const [fromDate, setFromDate] = useState(() => getPresetDates('30days').from);
  const [toDate, setToDate] = useState(() => getPresetDates('30days').to);
  const [activeTab, setActiveTab] = useState('all');
  const [sortParam, setSortParam] = useState<'date_asc' | 'date_desc' | 'doc_num'>('date_asc');
  const [searchTerm, setSearchTerm] = useState('');

  // Table display options
  const [isCompact, setIsCompact] = useState(false);
  const [copiedDoc, setCopiedDoc] = useState<string | null>(null);

  // Column Visibility & Customization state
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('zarfolio_ledger_columns');
        if (saved) return { ...DEFAULT_COLUMNS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_COLUMNS;
  });
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const columnPickerRef = useRef<HTMLDivElement>(null);

  function toggleColumn(key: keyof ColumnVisibility) {
    setVisibleColumns((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('zarfolio_ledger_columns', JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function resetColumns() {
    setVisibleColumns(DEFAULT_COLUMNS);
    try {
      localStorage.removeItem('zarfolio_ledger_columns');
    } catch {}
  }

  // Pagination state (critical for DOM performance)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Data state
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [openingBalances, setOpeningBalances] = useState<LedgerOpeningBalances>({
    goldAmount: 0,
    silverAmount: 0,
    platinumAmount: 0,
    rialAmount: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
      if (
        columnPickerRef.current &&
        !columnPickerRef.current.contains(event.target as Node)
      ) {
        setIsColumnPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus customer search input when dropdown opens
  useEffect(() => {
    if (isCustomerDropdownOpen) {
      setTimeout(() => {
        customerSearchInputRef.current?.focus();
      }, 50);
    }
  }, [isCustomerDropdownOpen]);

  // Filtered customer list for quick combobox selection
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return availableCustomers;
    const q = customerSearch.trim().toLowerCase();
    return availableCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.customerCode && String(c.customerCode).toLowerCase().includes(q)) ||
        (c.phone1 && c.phone1.includes(q)) ||
        (c.groupName && c.groupName.toLowerCase().includes(q))
    );
  }, [availableCustomers, customerSearch]);

  const selectedCustomer = useMemo(
    () => availableCustomers.find((c) => c.id === customerId),
    [availableCustomers, customerId]
  );

  // Quick Date Range setter
  function applyDatePreset(preset: (typeof DATE_PRESETS)[number]['id']) {
    setActiveDatePreset(preset);
    const { from, to } = getPresetDates(preset);
    setFromDate(from);
    setToDate(to);
  }

  function handleManualFromDateChange(val: string) {
    setFromDate(val);
    setActiveDatePreset('custom');
  }

  function handleManualToDateChange(val: string) {
    setToDate(val);
    setActiveDatePreset('custom');
  }

  function handleSelectCategory(catId: string) {
    setActiveTab(catId);
    setCurrentPage(1);
  }

  async function handleSearch() {
    setLoading(true);
    setError('');
    setCurrentPage(1);
    try {
      const res = await fetch('/api/reports/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || undefined,
          fromDateJalali: fromDate || undefined,
          toDateJalali: toDate || undefined,
          sort: sortParam,
          search: searchTerm || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'خطا در دریافت گزارش.');

      setTransactions(data.transactions || []);
      setOpeningBalances(
        data.openingBalances || {
          goldAmount: 0,
          silverAmount: 0,
          platinumAmount: 0,
          rialAmount: 0,
        }
      );
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته');
    } finally {
      setLoading(false);
    }
  }

  // Calculate Running Balances chronologically without heavy DOM rendering
  const fullCalculatedLedger = useMemo(() => {
    let runningGold = openingBalances.goldAmount || 0;
    let runningRial = openingBalances.rialAmount || 0;

    // Chronological order for running balance
    const chronological = [...transactions].sort((a, b) => {
      const dateA = a.documentDateJalali || a.transactionDate || '';
      const dateB = b.documentDateJalali || b.transactionDate || '';
      return dateA.localeCompare(dateB);
    });

    const calculatedMap = new Map<
      string,
      {
        runningGold: number;
        runningRial: number;
        goldDebtor: number;
        goldCreditor: number;
        rialDebtor: number;
        rialCreditor: number;
      }
    >();

    for (const t of chronological) {
      const gAmt = Number(t.goldAmount) || 0;
      const rAmt = Number(t.rialAmount) || 0;

      const goldDebtor = gAmt < 0 ? Math.abs(gAmt) : 0;
      const goldCreditor = gAmt > 0 ? gAmt : 0;
      const rialDebtor = rAmt < 0 ? Math.abs(rAmt) : 0;
      const rialCreditor = rAmt > 0 ? rAmt : 0;

      runningGold += gAmt;
      runningRial += rAmt;

      calculatedMap.set(t.id, {
        runningGold,
        runningRial,
        goldDebtor,
        goldCreditor,
        rialDebtor,
        rialCreditor,
      });
    }

    const sorted = [...transactions];
    if (sortParam === 'date_asc') {
      sorted.sort((a, b) => {
        const dateA = a.documentDateJalali || a.transactionDate || '';
        const dateB = b.documentDateJalali || b.transactionDate || '';
        return dateA.localeCompare(dateB);
      });
    } else if (sortParam === 'date_desc') {
      sorted.sort((a, b) => {
        const dateA = a.documentDateJalali || a.transactionDate || '';
        const dateB = b.documentDateJalali || b.transactionDate || '';
        return dateB.localeCompare(dateA);
      });
    } else if (sortParam === 'doc_num') {
      sorted.sort((a, b) => (Number(b.documentNumber) || 0) - (Number(a.documentNumber) || 0));
    }

    return sorted.map((t) => {
      const calc = calculatedMap.get(t.id) || {
        runningGold: 0,
        runningRial: 0,
        goldDebtor: 0,
        goldCreditor: 0,
        rialDebtor: 0,
        rialCreditor: 0,
      };

      return {
        ...t,
        ...calc,
      };
    });
  }, [transactions, openingBalances, sortParam]);

  // Dynamic counts for each category filter button
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: transactions.length,
      'raw-gold': 0,
      'gold-sale': 0,
      bank: 0,
      cash: 0,
      discount: 0,
      coin: 0,
    };
    for (const t of transactions) {
      if (matchesLedgerCategoryFilter(t, 'raw-gold')) counts['raw-gold']++;
      if (matchesLedgerCategoryFilter(t, 'gold-sale')) counts['gold-sale']++;
      if (matchesLedgerCategoryFilter(t, 'bank')) counts.bank++;
      if (matchesLedgerCategoryFilter(t, 'cash')) counts.cash++;
      if (matchesLedgerCategoryFilter(t, 'discount')) counts.discount++;
      if (matchesLedgerCategoryFilter(t, 'coin')) counts.coin++;
    }
    return counts;
  }, [transactions]);

  // Visible Ledger Rows: filtered by active category tab and live search
  const ledgerRows = useMemo(() => {
    let rows = fullCalculatedLedger;

    if (activeTab !== 'all') {
      rows = rows.filter((r) => matchesLedgerCategoryFilter(r, activeTab));
    }

    return rows;
  }, [fullCalculatedLedger, activeTab]);

  // Overall Totals (Calculated from filtered dataset)
  const totalStats = useMemo(() => {
    let totalGoldDebtor = 0;
    let totalGoldCreditor = 0;
    let totalRialDebtor = 0;
    let totalRialCreditor = 0;

    for (const row of ledgerRows) {
      totalGoldDebtor += row.goldDebtor;
      totalGoldCreditor += row.goldCreditor;
      totalRialDebtor += row.rialDebtor;
      totalRialCreditor += row.rialCreditor;
    }

    const finalGold =
      (openingBalances.goldAmount || 0) + totalGoldCreditor - totalGoldDebtor;
    const finalRial =
      (openingBalances.rialAmount || 0) + totalRialCreditor - totalRialDebtor;

    return {
      totalGoldDebtor,
      totalGoldCreditor,
      totalRialDebtor,
      totalRialCreditor,
      finalGold,
      finalRial,
      count: ledgerRows.length,
    };
  }, [ledgerRows, openingBalances]);

  // Paginated Rows: only the active page is parsed and rendered in DOM
  const totalPages = Math.max(1, Math.ceil(ledgerRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    const slice = ledgerRows.slice(start, start + pageSize);

    // Parse breakdown, journal line, and line description only for the visible slice!
    return slice.map((item, idx) => ({
      ...item,
      rowNumber: start + idx + 1,
      breakdown: parseTransactionBreakdown(item),
      journalLine: getJournalLineBadge(item),
      lineDescription: getDocumentLineDescription(item),
      extra: getRowExtraDetails(item),
    }));
  }, [ledgerRows, safeCurrentPage, pageSize]);

  // Dynamic visible column counts for super header colSpan and table layouts
  const goldVisibleCount =
    (visibleColumns.goldDebtor ? 1 : 0) +
    (visibleColumns.goldCreditor ? 1 : 0) +
    (visibleColumns.goldBalance ? 1 : 0);

  const rialVisibleCount =
    (visibleColumns.rialDebtor ? 1 : 0) +
    (visibleColumns.rialCreditor ? 1 : 0) +
    (visibleColumns.rialBalance ? 1 : 0);

  const leadingVisibleCount =
    (visibleColumns.rowNumber ? 1 : 0) +
    (visibleColumns.date ? 1 : 0) +
    (visibleColumns.docNumber ? 1 : 0) +
    (!customerId && visibleColumns.customer ? 1 : 0) +
    (visibleColumns.journalLine ? 1 : 0) +
    (visibleColumns.description ? 1 : 0) +
    (visibleColumns.stampNumber ? 1 : 0) +
    (visibleColumns.assayLab ? 1 : 0) +
    (visibleColumns.rawWeight ? 1 : 0) +
    (visibleColumns.purity ? 1 : 0) +
    (visibleColumns.checkDetails ? 1 : 0) +
    (visibleColumns.bankDetails ? 1 : 0) +
    (visibleColumns.foreignCurrency ? 1 : 0);

  const totalVisibleColSpan =
    leadingVisibleCount +
    goldVisibleCount +
    rialVisibleCount +
    (visibleColumns.actions ? 1 : 0);

  function toggleRow(id: string) {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function toggleExpandAll() {
    const areAllExpanded = paginatedRows.every((r) => expandedRows[r.id]);
    if (areAllExpanded) {
      setExpandedRows({});
    } else {
      const next: Record<string, boolean> = {};
      paginatedRows.forEach((r) => {
        next[r.id] = true;
      });
      setExpandedRows(next);
    }
  }

  function copyDocNumber(num: string) {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedDoc(num);
    setTimeout(() => setCopiedDoc(null), 2000);
  }

  function handleExportExcel() {
    if (!ledgerRows.length) return;
    const customer = availableCustomers.find((c) => c.id === customerId);

    const wsData: any[][] = [
      ['گزارش جامع ریز اسناد و معین حسابداری'],
      [
        `طرف‌حساب: ${customer ? `${customer.customerCode || ''} - ${customer.name}` : 'تمامی طرف‌حساب‌ها'}`,
        `تاریخ تهیه: ${new Date().toLocaleDateString('fa-IR')}`,
      ],
      [`از تاریخ: ${fromDate || 'ابتدای دوره'}`, `تا تاریخ: ${toDate || 'اکنون'}`],
      [],
      [
        'ردیف',
        'تاریخ',
        'شماره سند',
        'طرف‌حساب',
        'آرتیکل سند (سرفصل معین)',
        'شرح (توضیح ردیف سند)',
        'یادداشت و جزئیات پیگیری',
        'بدهکار طلا (گرم)',
        'بستانکار طلا (گرم)',
        'مانده طلا (گرم)',
        'وضعیت طلا',
        `بدهکار مالی (${baseCurrencySymbol})`,
        `بستانکار مالی (${baseCurrencySymbol})`,
        `مانده مالی (${baseCurrencySymbol})`,
        'وضعیت مالی',
      ],
      [
        '—',
        'ابتدای دوره',
        '—',
        '—',
        'سرمایه اول دوره (۳۱۰۰)',
        'سند مانده آغازین دوره (پیش از بازه گزارش)',
        'انتقال مانده پیشین',
        openingBalances.goldAmount < 0 ? Math.abs(openingBalances.goldAmount) : 0,
        openingBalances.goldAmount > 0 ? openingBalances.goldAmount : 0,
        Math.abs(openingBalances.goldAmount),
        openingBalances.goldAmount > 0
          ? 'بستانکار (طلب از ما)'
          : openingBalances.goldAmount < 0
          ? 'بدهکار (به ما)'
          : 'تسویه',
        openingBalances.rialAmount < 0 ? Math.abs(openingBalances.rialAmount) : 0,
        openingBalances.rialAmount > 0 ? openingBalances.rialAmount : 0,
        Math.abs(openingBalances.rialAmount),
        openingBalances.rialAmount > 0
          ? 'بستانکار (طلب از ما)'
          : openingBalances.rialAmount < 0
          ? 'بدهکار (به ما)'
          : 'تسویه',
      ],
    ];

    ledgerRows.forEach((row, idx) => {
      const breakdown = parseTransactionBreakdown(row);
      const journalLine = getJournalLineBadge(row);
      const lineDesc = getDocumentLineDescription(row);
      const breakdownText = breakdown.attributes
        .map((a) => `${a.label}: ${a.value}`)
        .join(' | ');

      const journalLineLabel = journalLine.accountCode
        ? `${journalLine.treePath || `${journalLine.generalTitle ? `${journalLine.generalTitle} / ` : ''}${journalLine.accountTitle} (${journalLine.accountCode})`}`
        : journalLine.accountTitle;

      const noteText = [lineDesc.secondary, breakdownText].filter(Boolean).join(' | ');

      wsData.push([
        idx + 1,
        row.documentDateJalali || row.transactionDate,
        row.documentNumber || '—',
        (row as any).customerName || selectedCustomer?.name || '—',
        journalLineLabel,
        lineDesc.primary,
        noteText || '—',
        row.goldDebtor || 0,
        row.goldCreditor || 0,
        Math.abs(row.runningGold),
        row.runningGold > 0.0005
          ? 'بستانکار'
          : row.runningGold < -0.0005
          ? 'بدهکار'
          : 'تسویه',
        row.rialDebtor || 0,
        row.rialCreditor || 0,
        Math.abs(row.runningRial),
        row.runningRial > 50
          ? 'بستانکار'
          : row.runningRial < -50
          ? 'بدهکار'
          : 'تسویه',
      ]);
    });

    wsData.push([]);
    wsData.push([
      'مجموع',
      '—',
      '—',
      '—',
      '—',
      `تعداد: ${totalStats.count} ردیف`,
      '—',
      totalStats.totalGoldDebtor,
      totalStats.totalGoldCreditor,
      Math.abs(totalStats.finalGold),
      totalStats.finalGold > 0.0005
        ? 'بستانکار نهایی'
        : totalStats.finalGold < -0.0005
        ? 'بدهکار نهایی'
        : 'تسویه',
      totalStats.totalRialDebtor,
      totalStats.totalRialCreditor,
      Math.abs(totalStats.finalRial),
      totalStats.finalRial > 50
        ? 'بستانکار نهایی'
        : totalStats.finalRial < -50
        ? 'بدهکار نهایی'
        : 'تسویه',
    ]);

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'ریز اسناد طرف‌حساب');
    xlsx.writeFile(
      wb,
      `Ledger_${selectedCustomer?.name || 'All'}_${Date.now()}.xlsx`
    );
  }

  const areAllExpanded =
    paginatedRows.length > 0 && paginatedRows.every((r) => expandedRows[r.id]);

  return (
    <div className="space-y-6 text-sm dashboard-panel p-4 md:p-6 printable-container">
      {/* Page Heading & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 non-printable">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <FileText size={22} />
            </span>
            <div>
              <p className="eyebrow text-xs font-bold text-amber-600 dark:text-amber-400 tracking-wide">
                گزارش‌های جامع مالی و طلایی
              </p>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                ریز اسناد و صورت‌حساب طرف‌حساب‌ها
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            مشاهده کامل ردیف‌های اسناد (آبشده، ساخته، نقد، بانک، چک، تخفیف، سکه)
            همراه با مانده متناوب لحظه‌ای در جدول دیتادار رسمی.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch md:self-auto">
          {searched && ledgerRows.length > 0 && (
            <>
              <button
                onClick={handleExportExcel}
                className="dashboard-secondary-button flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-slate-700 dark:text-slate-200 shadow-xs"
              >
                <Download size={15} className="text-emerald-600" />
                خروجی Excel
              </button>
              <button
                onClick={() => window.print()}
                className="dashboard-secondary-button flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-slate-700 dark:text-slate-200 shadow-xs"
              >
                <Printer size={15} className="text-sky-600" />
                چاپ A4
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 space-y-4 shadow-xs non-printable">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* Enhanced Searchable Counterparty (طرف‌حساب) Combobox */}
          <div className="lg:col-span-5 flex flex-col gap-1.5" ref={customerDropdownRef}>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-amber-500/10 text-amber-600">
                  <User size={13} />
                </span>
                طرف‌حساب
              </label>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={() => setCustomerId('')}
                  className="text-[11px] text-amber-600 hover:text-amber-700 font-medium flex items-center gap-0.5"
                >
                  <X size={12} />
                  نمایش همه طرف‌حساب‌ها
                </button>
              )}
            </div>

            <div className="relative">
              {/* Trigger Button */}
              <button
                type="button"
                onClick={() => setIsCustomerDropdownOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between gap-2 p-2.5 text-xs border rounded-xl bg-slate-50/70 dark:bg-slate-800/80 text-right transition-all hover:bg-slate-100/70 dark:hover:bg-slate-800 ${
                  isCustomerDropdownOpen
                    ? 'border-amber-500 ring-2 ring-amber-500/20 bg-white dark:bg-slate-800 shadow-sm'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {selectedCustomer ? (
                    <>
                      <span className="w-7 h-7 shrink-0 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold flex items-center justify-center text-xs">
                        {selectedCustomer.name.slice(0, 1)}
                      </span>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate text-xs">
                          {selectedCustomer.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                          {selectedCustomer.customerCode && (
                            <span className="bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.2 rounded font-mono font-bold text-slate-700 dark:text-slate-300">
                              کد: {selectedCustomer.customerCode}
                            </span>
                          )}
                          {selectedCustomer.groupName && (
                            <span className="truncate text-slate-400">
                              • {selectedCustomer.groupName}
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 py-0.5">
                      <span className="p-1 rounded-md bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        <Users size={14} />
                      </span>
                      <span className="font-semibold text-xs">
                        تمامی طرف‌حساب‌ها (گزارش جامع دفتر)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 text-slate-400">
                  {selectedCustomer && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomerId('');
                      }}
                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 transition-colors"
                      title="حذف انتخاب"
                    >
                      <X size={13} />
                    </span>
                  )}
                  <ChevronDown
                    size={15}
                    className={`transition-transform duration-200 ${
                      isCustomerDropdownOpen ? 'rotate-180 text-amber-500' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown Floating Panel */}
              {isCustomerDropdownOpen && (
                <div className="absolute top-full right-0 left-0 mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
                  {/* Search inside combobox */}
                  <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                    <div className="relative">
                      <Search
                        size={14}
                        className="absolute right-3 top-2.5 text-slate-400"
                      />
                      <input
                        ref={customerSearchInputRef}
                        type="text"
                        placeholder="جستجوی نام، کد یا تلفن طرف‌حساب..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pr-9 pl-3 py-1.5 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
                      />
                      {customerSearch && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearch('')}
                          className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer Options List */}
                  <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/60">
                    {/* Option 0: All Customers */}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId('');
                        setIsCustomerDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-right text-xs transition-colors ${
                        !customerId
                          ? 'bg-amber-500/10 text-amber-900 dark:text-amber-200 font-bold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          <Users size={14} />
                        </span>
                        <div>
                          <p className="font-bold">همه طرف‌حساب‌ها (دفتر کل)</p>
                          <p className="text-[10px] text-slate-400 font-normal">
                            مشاهده گزارش تجمیعی کلیه مشتریان و همکاران
                          </p>
                        </div>
                      </div>
                      {!customerId && (
                        <Check size={14} className="text-amber-600 dark:text-amber-400" />
                      )}
                    </button>

                    {/* Filtered Customer Items */}
                    {filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        طرف‌حسابی با این مشخصات یافت نشد.
                      </div>
                    ) : (
                      filteredCustomers.slice(0, 50).map((c) => {
                        const isSelected = c.id === customerId;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCustomerId(c.id);
                              setIsCustomerDropdownOpen(false);
                              setCustomerSearch('');
                            }}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-right text-xs transition-colors ${
                              isSelected
                                ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 font-bold'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 shrink-0 rounded-md bg-slate-200/80 dark:bg-slate-700 font-bold flex items-center justify-center text-[11px] text-slate-700 dark:text-slate-300">
                                {c.name.slice(0, 1)}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold truncate text-slate-900 dark:text-slate-100">
                                    {c.name}
                                  </span>
                                  {c.customerCode && (
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                                      #{c.customerCode}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                  {c.phone1 && (
                                    <span className="flex items-center gap-0.5 font-mono">
                                      <Phone size={9} />
                                      {c.phone1}
                                    </span>
                                  )}
                                  {c.groupName && <span>• {c.groupName}</span>}
                                </div>
                              </div>
                            </div>

                            {isSelected && (
                              <Check size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mr-2" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Date Range: Segmented Presets + Manual Inputs */}
          <div className="lg:col-span-7 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="p-1 rounded-md bg-amber-500/10 text-amber-600">
                  <CalendarDays size={13} />
                </span>
                بازه زمانی گزارش
              </label>
              {activeDatePreset === 'custom' && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-300/40">
                  بازه دستی انتخاب شده
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              {/* Segmented Control for Quick Date Presets */}
              <div className="md:col-span-7 flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-inner">
                {DATE_PRESETS.map((preset) => {
                  const isActive = activeDatePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyDatePreset(preset.id)}
                      className={`flex-1 py-1.5 text-xs rounded-lg font-bold transition-all text-center whitespace-nowrap ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 shadow-sm scale-100 font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* Jalali From and To Date Inputs */}
              <div className="md:col-span-5 grid grid-cols-2 gap-1.5">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="از: 1403/01/01"
                    value={fromDate}
                    onChange={(e) => handleManualFromDateChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-xl bg-slate-50/70 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 text-center font-mono focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all placeholder:text-slate-400"
                    dir="ltr"
                    title="از تاریخ شمسی"
                  />
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="تا: 1403/12/29"
                    value={toDate}
                    onChange={(e) => handleManualToDateChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border rounded-xl bg-slate-50/70 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 text-center font-mono focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all placeholder:text-slate-400"
                    dir="ltr"
                    title="تا تاریخ شمسی"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Buttons Row */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
              <SlidersHorizontal size={14} className="text-amber-500" />
              <span>فیلتر اقلام:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0 scrollbar-none flex-wrap">
              {CATEGORY_FILTER_BUTTONS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const count = categoryCounts[tab.id] ?? 0;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectCategory(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-bold transition-all border whitespace-nowrap cursor-pointer select-none active:scale-95 ${
                      isActive
                        ? tab.activeColor
                        : 'bg-slate-50/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60 border-slate-200 dark:border-slate-700/80'
                    }`}
                  >
                    <Icon size={13} className={isActive ? 'opacity-100' : 'opacity-70'} />
                    <span>{tab.label}</span>
                    {searched && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold leading-tight ${
                          isActive
                            ? 'bg-black/15 dark:bg-white/20'
                            : 'bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {count.toLocaleString('fa-IR')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Search, Sort & Create Report Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-lg">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute right-3 top-2.5 text-slate-400"
              />
              <input
                type="text"
                placeholder="جستجو در شماره سند، شرح، کد پیگیری، شماره انگ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pr-9 pl-3 py-1.5 text-xs border rounded-xl bg-slate-50/70 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all placeholder:text-slate-400"
              />
            </div>

            <select
              value={sortParam}
              onChange={(e) => setSortParam(e.target.value as any)}
              className="p-2 text-xs border rounded-xl bg-slate-50/70 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30 font-medium"
            >
              <option value="date_asc">تاریخ (صعودی)</option>
              <option value="date_desc">تاریخ (نزولی)</option>
              <option value="doc_num">شماره سند</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-xs active:scale-98 transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>ایجاد گزارش</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl">
          {error}
        </div>
      )}

      {/* Initial Welcome State before search */}
      {!searched && !loading && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 space-y-4 shadow-2xs">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Sparkles size={32} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
              تهیه صورت‌حساب و ریز اسناد طرف‌حساب
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
              طرف‌حساب و بازه زمانی دلخواه را انتخاب نموده و بر روی دکمه
              «ایجاد گزارش» کلیک کنید تا گردش اسناد بارگذاری شود.
            </p>
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/25 active:scale-98 transition-all"
          >
            ایجاد گزارش
          </button>
        </div>
      )}

      {/* KPI Balance Summary Cards */}
      {searched && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Gold Balance */}
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                مانده طلا (۷۵۰)
              </span>
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Scale size={16} />
              </span>
            </div>
            <div className="mt-3">
              <p
                className={`text-lg md:text-xl font-black tabular-nums ${
                  totalStats.finalGold > 0.0005
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : totalStats.finalGold < -0.0005
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                dir="ltr"
              >
                {formatWeight(Math.abs(totalStats.finalGold))} g
              </p>
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                {totalStats.finalGold > 0.0005
                  ? 'طلبکار از ما (بستانکار)'
                  : totalStats.finalGold < -0.0005
                  ? 'بدهکار به ما (بدهکار)'
                  : 'حساب طلایی تسویه است'}
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex justify-between text-[11px] text-slate-500 tabular-nums">
              <span>بد: {formatWeight(totalStats.totalGoldDebtor)}</span>
              <span>بس: {formatWeight(totalStats.totalGoldCreditor)}</span>
            </div>
          </div>

          {/* Rial Balance */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                مانده مالی ({baseCurrencySymbol})
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <Banknote size={16} />
              </span>
            </div>
            <div className="mt-3">
              <p
                className={`text-lg md:text-xl font-black tabular-nums ${
                  totalStats.finalRial > 50
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : totalStats.finalRial < -50
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
                dir="ltr"
              >
                {formatMoney(Math.abs(totalStats.finalRial))}
              </p>
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-0.5">
                {totalStats.finalRial > 50
                  ? 'طلبکار از ما (بستانکار)'
                  : totalStats.finalRial < -50
                  ? 'بدهکار به ما (بدهکار)'
                  : 'حساب مالی تسویه است'}
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex justify-between text-[11px] text-slate-500 tabular-nums">
              <span>بد: {formatMoney(totalStats.totalRialDebtor)}</span>
              <span>بس: {formatMoney(totalStats.totalRialCreditor)}</span>
            </div>
          </div>

          {/* Initial Balances */}
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                مانده اول دوره (از قبل)
              </span>
              <span className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                <ArrowUpRight size={16} />
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">طلای ۷۵۰:</span>
                <span className="tabular-nums font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                  {formatWeight(Math.abs(openingBalances.goldAmount))}{' '}
                  <span className="text-[10px] text-slate-400">
                    {openingBalances.goldAmount > 0 ? '(بس)' : openingBalances.goldAmount < 0 ? '(بد)' : '—'}
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">مبلغ ریالی:</span>
                <span className="tabular-nums font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                  {formatMoney(Math.abs(openingBalances.rialAmount))}{' '}
                  <span className="text-[10px] text-slate-400">
                    {openingBalances.rialAmount > 0 ? '(بس)' : openingBalances.rialAmount < 0 ? '(بد)' : '—'}
                  </span>
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              مجموع تراکنش‌های ثبت شده پیش از تاریخ مبدا
            </p>
          </div>

          {/* Document Count & Overview */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/50 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                گردش و تعداد اسناد
              </span>
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                <FileText size={16} />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-xl md:text-2xl font-black tabular-nums text-indigo-700 dark:text-indigo-400">
                {totalStats.count.toLocaleString('fa-IR')}{' '}
                <span className="text-xs font-medium text-slate-500">ردیف</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedCustomer
                  ? `طرف‌حساب: ${selectedCustomer.name}`
                  : 'گزارش اسناد دفتر'}
              </p>
            </div>
            <p className="text-[10px] text-indigo-500 mt-2">
              جدول داده‌محور رسمی طلا و حسابداری
            </p>
          </div>
        </div>
      )}

      {/* Main Rich Data Table */}
      {searched && (
        <div className="space-y-3">
          {/* Data Table Control Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs non-printable">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                جدول داده‌های ریز اسناد
              </span>
              <span className="text-slate-400">|</span>
              <span>
                نمایش{' '}
                <strong className="text-amber-600 tabular-nums">
                  {(safeCurrentPage - 1) * pageSize + (paginatedRows.length > 0 ? 1 : 0)}
                </strong>{' '}
                تا{' '}
                <strong className="text-amber-600 tabular-nums">
                  {(safeCurrentPage - 1) * pageSize + paginatedRows.length}
                </strong>{' '}
                از{' '}
                <strong className="tabular-nums">
                  {ledgerRows.length.toLocaleString('fa-IR')}
                </strong>{' '}
                ردیف
                {activeTab !== 'all' && (
                  <span className="inline-flex items-center gap-1 mr-2 px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-[11px] font-bold border border-amber-300 dark:border-amber-800">
                    <span>فیلتر:</span>
                    <span>{CATEGORY_FILTER_BUTTONS.find((b) => b.id === activeTab)?.label}</span>
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleExpandAll}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all font-medium text-[11px]"
              >
                <ChevronsUpDown size={13} />
                <span>{areAllExpanded ? 'بستن همه جزئیات' : 'باز کردن همه جزئیات'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCompact((c) => !c)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] transition-all font-medium ${
                  isCompact
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 font-bold'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                <SlidersHorizontal size={12} />
                <span>تراکم فشرده</span>
              </button>

              {/* Column Customizer Dropdown Popover */}
              <div className="relative" ref={columnPickerRef}>
                <button
                  type="button"
                  onClick={() => setIsColumnPickerOpen((o) => !o)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-all font-medium ${
                    isColumnPickerOpen
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-900 dark:text-amber-200 font-bold shadow-xs'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                  title="سفارشی‌سازی و انتخاب ستون‌های جدول"
                >
                  <Columns3 size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>تغییر ستون‌ها</span>
                </button>

                {isColumnPickerOpen && (
                  <div className="absolute left-0 mt-1.5 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-3 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <Columns3 size={14} className="text-amber-500" />
                        تنظیم ستون‌های جدول
                      </span>
                      <button
                        type="button"
                        onClick={resetColumns}
                        className="text-[11px] text-amber-600 hover:text-amber-700 dark:text-amber-400 font-bold hover:underline"
                      >
                        بازنشانی پیش‌فرض
                      </button>
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {COLUMN_GROUPS.map((group) => (
                        <div key={group.id} className="space-y-1.5">
                          <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            {group.title}
                          </h4>
                          <div className="space-y-1">
                            {group.columns.map((col) => {
                              const isChecked = !!visibleColumns[col.key];
                              return (
                                <label
                                  key={col.key}
                                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleColumn(col.key)}
                                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                                    />
                                    <span
                                      className={
                                        isChecked
                                          ? 'text-slate-800 dark:text-slate-200 font-medium'
                                          : 'text-slate-400'
                                      }
                                    >
                                      {col.label}
                                    </span>
                                  </div>
                                  {col.desc && (
                                    <span className="text-[10px] text-slate-400">
                                      {col.desc}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Grid with Official Accounting Multi-tier Header */}
          <div className="border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs text-right whitespace-nowrap border-collapse border border-slate-200 dark:border-slate-700/80 font-sans"
                style={{ fontFamily: 'var(--app-font-body, "Vazirmatn", Tahoma, sans-serif)' }}
              >
                
                {/* 2-Tier Structured Header */}
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold sticky top-0 z-20 shadow-2xs">
                  {/* Super Header Row */}
                  <tr className="border-b border-slate-300 dark:border-slate-700 text-[11px]">
                    {visibleColumns.rowNumber && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 w-10 text-center border-l border-slate-300 dark:border-slate-700 bg-slate-200/50 dark:bg-slate-800"
                      >
                        #
                      </th>
                    )}
                    {visibleColumns.date && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        تاریخ و ساعت
                      </th>
                    )}
                    {visibleColumns.docNumber && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        شماره سند
                      </th>
                    )}
                    {!customerId && visibleColumns.customer && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        طرف‌حساب
                      </th>
                    )}
                    {visibleColumns.journalLine && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700 whitespace-nowrap"
                        title="آرتیکل سند بر اساس سرفصل‌های استاندارد دفتر کل و معین حسابداری"
                      >
                        آرتیکل سند
                      </th>
                    )}
                    {visibleColumns.description && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 min-w-[220px] border-l border-slate-300 dark:border-slate-700"
                      >
                        شرح ردیف سند
                      </th>
                    )}

                    {/* Optional extra columns */}
                    {visibleColumns.stampNumber && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700 tabular-nums"
                      >
                        شماره انگ
                      </th>
                    )}
                    {visibleColumns.assayLab && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        آزمایشگاه ری‌گیری
                      </th>
                    )}
                    {visibleColumns.rawWeight && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        وزن ناخالص / کار
                      </th>
                    )}
                    {visibleColumns.purity && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        عیار
                      </th>
                    )}
                    {visibleColumns.checkDetails && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        مشخصات چک صیادی
                      </th>
                    )}
                    {visibleColumns.bankDetails && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        بانک و کد پیگیری
                      </th>
                    )}
                    {visibleColumns.foreignCurrency && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 border-l border-slate-300 dark:border-slate-700"
                      >
                        ارز
                      </th>
                    )}
                    
                    {/* Gold Super Header */}
                    {goldVisibleCount > 0 && (
                      <th
                        colSpan={goldVisibleCount}
                        className="p-2 text-center border-l border-slate-300 dark:border-slate-700 bg-amber-100/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-black"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Scale size={13} className="text-amber-600 dark:text-amber-400" />
                          <span>گردش و مانده طلا (۷۵۰)</span>
                        </div>
                      </th>
                    )}

                    {/* Financial Super Header */}
                    {rialVisibleCount > 0 && (
                      <th
                        colSpan={rialVisibleCount}
                        className="p-2 text-center border-l border-slate-300 dark:border-slate-700 bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 font-black"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Banknote size={13} className="text-emerald-600 dark:text-emerald-400" />
                          <span>گردش و مانده مالی ({baseCurrencySymbol})</span>
                        </div>
                      </th>
                    )}

                    {visibleColumns.actions && (
                      <th
                        rowSpan={goldVisibleCount > 0 || rialVisibleCount > 0 ? 2 : 1}
                        className="p-2.5 text-center w-14 non-printable bg-slate-200/50 dark:bg-slate-800"
                      >
                        عملیات
                      </th>
                    )}
                  </tr>

                  {/* Sub Header Row */}
                  {(goldVisibleCount > 0 || rialVisibleCount > 0) && (
                    <tr className="border-b-2 border-slate-300 dark:border-slate-700 text-[11px] bg-slate-50 dark:bg-slate-850">
                      {/* Gold sub-columns */}
                      {visibleColumns.goldDebtor && (
                        <th className="p-2 text-left border-l border-slate-300 dark:border-slate-700 text-rose-700 dark:text-rose-400 bg-amber-50/40 dark:bg-amber-950/20">
                          بدهکار (g)
                        </th>
                      )}
                      {visibleColumns.goldCreditor && (
                        <th className="p-2 text-left border-l border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 bg-amber-50/40 dark:bg-amber-950/20">
                          بستانکار (g)
                        </th>
                      )}
                      {visibleColumns.goldBalance && (
                        <th className="p-2 text-left border-l border-slate-300 dark:border-slate-700 bg-amber-200/60 dark:bg-amber-900/50 font-black text-amber-950 dark:text-amber-100">
                          مانده طلا (g)
                        </th>
                      )}

                      {/* Financial sub-columns */}
                      {visibleColumns.rialDebtor && (
                        <th className="p-2 text-left border-l border-slate-300 dark:border-slate-700 text-rose-700 dark:text-rose-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                          بدهکار ({baseCurrencySymbol})
                        </th>
                      )}
                      {visibleColumns.rialCreditor && (
                        <th className="p-2 text-left border-l border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                          بستانکار ({baseCurrencySymbol})
                        </th>
                      )}
                      {visibleColumns.rialBalance && (
                        <th className="p-2 text-left border-l border-slate-300 dark:border-slate-700 bg-emerald-200/60 dark:bg-emerald-900/50 font-black text-emerald-950 dark:text-emerald-100">
                          مانده مالی
                        </th>
                      )}
                    </tr>
                  )}
                </thead>

                {/* Grid Body */}
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {/* Opening Balance Row (on Page 1 only) */}
                  {safeCurrentPage === 1 && (
                    <tr className="bg-amber-50/90 dark:bg-amber-950/40 font-bold border-b border-amber-300 dark:border-amber-900/60">
                      {visibleColumns.rowNumber && (
                        <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>
                      )}
                      {visibleColumns.date && (
                        <td className="p-2.5 text-slate-700 dark:text-slate-300 tabular-nums border-l border-slate-200 dark:border-slate-800">
                          {fromDate || 'ابتدای دوره'}
                        </td>
                      )}
                      {visibleColumns.docNumber && (
                        <td className="p-2.5 tabular-nums text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>
                      )}
                      {!customerId && visibleColumns.customer && (
                        <td className="p-2.5 text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800">
                          کلیه طرف‌حساب‌ها
                        </td>
                      )}
                      {visibleColumns.journalLine && (
                        <td className="p-2.5 border-l border-slate-200 dark:border-slate-800">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
                              title="حقوق مالکانه > سرمایه > سرمایه اول دوره (۳۱۰۰)"
                            >
                              <span>سرمایه اول دوره</span>
                              <span className="opacity-70 text-[9px] tabular-nums">(۳۱۰۰)</span>
                            </span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                              حقوق مالکانه • سرمایه
                            </span>
                          </div>
                        </td>
                      )}
                      {visibleColumns.description && (
                        <td className="p-2.5 text-slate-700 dark:text-slate-300 font-bold border-l border-slate-200 dark:border-slate-800">
                          <span>سند مانده آغازین دوره (پیش از بازه گزارش)</span>
                        </td>
                      )}
                      {visibleColumns.stampNumber && <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>}
                      {visibleColumns.assayLab && <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>}
                      {visibleColumns.rawWeight && <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>}
                      {visibleColumns.purity && <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>}
                      {visibleColumns.checkDetails && <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>}
                      {visibleColumns.bankDetails && <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>}
                      {visibleColumns.foreignCurrency && <td className="p-2.5 text-center text-slate-400 border-l border-slate-200 dark:border-slate-800">—</td>}

                      {visibleColumns.goldDebtor && (
                        <td
                          className="p-2.5 text-left tabular-nums text-rose-600 dark:text-rose-400 border-l border-slate-200 dark:border-slate-800"
                          dir="ltr"
                        >
                          {openingBalances.goldAmount < 0
                            ? formatWeight(Math.abs(openingBalances.goldAmount))
                            : '—'}
                        </td>
                      )}
                      {visibleColumns.goldCreditor && (
                        <td
                          className="p-2.5 text-left tabular-nums text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800"
                          dir="ltr"
                        >
                          {openingBalances.goldAmount > 0
                            ? formatWeight(openingBalances.goldAmount)
                            : '—'}
                        </td>
                      )}
                      {visibleColumns.goldBalance && (
                        <td
                          className="p-2.5 text-left tabular-nums font-black bg-amber-100/60 dark:bg-amber-950/60 border-l border-slate-200 dark:border-slate-800"
                          dir="ltr"
                        >
                          <span
                            className={
                              openingBalances.goldAmount > 0.0005
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : openingBalances.goldAmount < -0.0005
                                ? 'text-rose-700 dark:text-rose-300'
                                : 'text-slate-400'
                            }
                          >
                            {formatWeight(Math.abs(openingBalances.goldAmount))}{' '}
                            <span className="text-[10px]">
                              {openingBalances.goldAmount > 0.0005
                                ? '(بس)'
                                : openingBalances.goldAmount < -0.0005
                                ? '(بد)'
                                : ''}
                            </span>
                          </span>
                        </td>
                      )}
                      {visibleColumns.rialDebtor && (
                        <td
                          className="p-2.5 text-left tabular-nums text-rose-600 dark:text-rose-400 border-l border-slate-200 dark:border-slate-800"
                          dir="ltr"
                        >
                          {openingBalances.rialAmount < 0
                            ? formatMoney(Math.abs(openingBalances.rialAmount))
                            : '—'}
                        </td>
                      )}
                      {visibleColumns.rialCreditor && (
                        <td
                          className="p-2.5 text-left tabular-nums text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800"
                          dir="ltr"
                        >
                          {openingBalances.rialAmount > 0
                            ? formatMoney(openingBalances.rialAmount)
                            : '—'}
                        </td>
                      )}
                      {visibleColumns.rialBalance && (
                        <td
                          className="p-2.5 text-left tabular-nums font-black bg-emerald-100/60 dark:bg-emerald-950/60 border-l border-slate-200 dark:border-slate-800"
                          dir="ltr"
                        >
                          <span
                            className={
                              openingBalances.rialAmount > 50
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : openingBalances.rialAmount < -50
                                ? 'text-rose-700 dark:text-rose-300'
                                : 'text-slate-400'
                            }
                          >
                            {formatMoney(Math.abs(openingBalances.rialAmount))}{' '}
                            <span className="text-[10px]">
                              {openingBalances.rialAmount > 50
                                ? '(بس)'
                                : openingBalances.rialAmount < -50
                                ? '(بد)'
                                : ''}
                            </span>
                          </span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="p-2.5 text-center non-printable text-slate-400">—</td>
                      )}
                    </tr>
                  )}

                  {/* Paginated Ledger Rows with Zebra Striping and Full Grid Borders */}
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={totalVisibleColSpan}
                        className="p-12 text-center text-slate-500 font-bold"
                      >
                        در این بازه زمانی هیچ ردیف سندی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const isExpanded = !!expandedRows[row.id];
                      const pyClass = isCompact ? 'py-1.5' : 'py-2.5';

                      return (
                        <React.Fragment key={row.id}>
                          <tr
                            onClick={() => toggleRow(row.id)}
                            className={`odd:bg-white even:bg-slate-50/70 dark:odd:bg-slate-900 dark:even:bg-slate-800/30 hover:bg-amber-500/10 dark:hover:bg-amber-500/15 transition-colors cursor-pointer border-b border-slate-200 dark:border-slate-800/80 ${
                              isExpanded ? 'bg-amber-500/15 dark:bg-amber-500/20' : ''
                            }`}
                          >
                            {visibleColumns.rowNumber && (
                              <td
                                className={`${pyClass} px-2.5 text-center text-slate-400 tabular-nums text-[11px] border-l border-slate-200 dark:border-slate-800`}
                              >
                                {row.rowNumber}
                              </td>
                            )}

                            {visibleColumns.date && (
                              <td
                                className={`${pyClass} px-2.5 text-slate-700 dark:text-slate-300 tabular-nums text-[11px] border-l border-slate-200 dark:border-slate-800`}
                              >
                                {row.documentDateJalali ||
                                  (row.transactionDate
                                    ? new Date(row.transactionDate).toLocaleDateString(
                                        'fa-IR'
                                      )
                                    : '—')}
                              </td>
                            )}

                            {visibleColumns.docNumber && (
                              <td
                                className={`${pyClass} px-2.5 tabular-nums font-bold border-l border-slate-200 dark:border-slate-800`}
                              >
                                {row.documentNumber ? (
                                  <div className="flex items-center gap-1.5">
                                    <Link
                                      href={`/dashboard/documents/new?edit=${row.documentNumber}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:underline flex items-center gap-1"
                                      title="مشاهده و ویرایش کامل سند"
                                    >
                                      <span className="tabular-nums">{row.documentNumber}</span>
                                      <ExternalLink size={11} className="opacity-70" />
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyDocNumber(row.documentNumber);
                                      }}
                                      className="p-0.5 text-slate-400 hover:text-slate-600 opacity-60 hover:opacity-100 transition-opacity"
                                      title="کپی شماره سند"
                                    >
                                      {copiedDoc === row.documentNumber ? (
                                        <CheckCheck size={11} className="text-emerald-600" />
                                      ) : (
                                        <Copy size={11} />
                                      )}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            )}

                            {!customerId && visibleColumns.customer && (
                              <td
                                className={`${pyClass} px-2.5 font-bold text-slate-800 dark:text-slate-200 max-w-[140px] truncate border-l border-slate-200 dark:border-slate-800`}
                              >
                                {(row as any).customerName || '—'}
                              </td>
                            )}

                            {/* Journal Line (آرتیکل سند مطابق درختواره حساب‌ها) */}
                            {visibleColumns.journalLine && (
                              <td
                                className={`${pyClass} px-2.5 border-l border-slate-200 dark:border-slate-800`}
                              >
                                <div className="flex flex-col items-start gap-0.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                      badgeStyles[row.journalLine?.badgeColor || 'slate'] ||
                                      badgeStyles.slate
                                    }`}
                                    title={
                                      row.journalLine?.treePath ||
                                      `${row.journalLine?.generalTitle || ''} / ${row.journalLine?.accountTitle || ''} (${row.journalLine?.accountCode || ''})`
                                    }
                                  >
                                    <span>{row.journalLine?.accountTitle || row.breakdown.categoryLabel}</span>
                                    {row.journalLine?.accountCode && (
                                      <span className="opacity-70 text-[9px] tabular-nums">
                                        ({row.journalLine.accountCode})
                                      </span>
                                    )}
                                  </span>
                                  {row.journalLine?.generalTitle && (
                                    <span
                                      className="text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[150px]"
                                      title={row.journalLine.treePath}
                                    >
                                      {row.journalLine.generalTitle}
                                      {row.journalLine.subCategory &&
                                      row.journalLine.subCategory !== row.journalLine.accountTitle
                                        ? ` • ${row.journalLine.subCategory}`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Description (توضیح ردیف سند) */}
                            {visibleColumns.description && (
                              <td
                                className={`${pyClass} px-2.5 max-w-[280px] border-l border-slate-200 dark:border-slate-800`}
                              >
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                                    {row.lineDescription?.primary || row.description || '—'}
                                  </span>
                                  {row.lineDescription?.secondary && (
                                    <span
                                      className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
                                      title={row.lineDescription.secondary}
                                    >
                                      {row.lineDescription.secondary}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}

                            {/* Extra dynamic columns */}
                            {visibleColumns.stampNumber && (
                              <td
                                className={`${pyClass} px-2.5 tabular-nums text-[11px] border-l border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300`}
                              >
                                {row.extra?.stampNumber || '—'}
                              </td>
                            )}
                            {visibleColumns.assayLab && (
                              <td
                                className={`${pyClass} px-2.5 text-[11px] border-l border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 max-w-[120px] truncate`}
                              >
                                {row.extra?.assayLab || '—'}
                              </td>
                            )}
                            {visibleColumns.rawWeight && (
                              <td
                                className={`${pyClass} px-2.5 tabular-nums text-[11px] border-l border-slate-200 dark:border-slate-800 text-left`}
                                dir="ltr"
                              >
                                {row.extra?.rawWeight ? formatWeight(row.extra.rawWeight) : '—'}
                              </td>
                            )}
                            {visibleColumns.purity && (
                              <td
                                className={`${pyClass} px-2.5 tabular-nums text-[11px] border-l border-slate-200 dark:border-slate-800 text-center`}
                              >
                                {row.extra?.purity ? `${row.extra.purity}` : '—'}
                              </td>
                            )}
                            {visibleColumns.checkDetails && (
                              <td
                                className={`${pyClass} px-2.5 text-[11px] border-l border-slate-200 dark:border-slate-800 max-w-[160px] truncate`}
                              >
                                {row.extra?.checkDetails || '—'}
                              </td>
                            )}
                            {visibleColumns.bankDetails && (
                              <td
                                className={`${pyClass} px-2.5 text-[11px] border-l border-slate-200 dark:border-slate-800 max-w-[160px] truncate`}
                              >
                                {row.extra?.bankDetails || '—'}
                              </td>
                            )}
                            {visibleColumns.foreignCurrency && (
                              <td
                                className={`${pyClass} px-2.5 tabular-nums text-[11px] border-l border-slate-200 dark:border-slate-800 text-left`}
                                dir="ltr"
                              >
                                {row.extra?.foreignCurrency || '—'}
                              </td>
                            )}

                            {/* Gold Debtor */}
                            {visibleColumns.goldDebtor && (
                              <td
                                className={`${pyClass} px-2.5 text-left tabular-nums font-bold text-rose-600 dark:text-rose-400 border-l border-slate-200 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-950/10`}
                                dir="ltr"
                              >
                                {row.goldDebtor > 0 ? formatWeight(row.goldDebtor) : '—'}
                              </td>
                            )}

                            {/* Gold Creditor */}
                            {visibleColumns.goldCreditor && (
                              <td
                                className={`${pyClass} px-2.5 text-left tabular-nums font-bold text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800 bg-amber-50/20 dark:bg-amber-950/10`}
                                dir="ltr"
                              >
                                {row.goldCreditor > 0
                                  ? formatWeight(row.goldCreditor)
                                  : '—'}
                              </td>
                            )}

                            {/* Gold Running Balance */}
                            {visibleColumns.goldBalance && (
                              <td
                                className={`${pyClass} px-2.5 text-left tabular-nums font-black bg-amber-100/50 dark:bg-amber-950/40 border-l border-slate-200 dark:border-slate-800`}
                                dir="ltr"
                              >
                                <span
                                  className={
                                    row.runningGold > 0.0005
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : row.runningGold < -0.0005
                                      ? 'text-rose-700 dark:text-rose-300'
                                      : 'text-slate-400'
                                  }
                                >
                                  {formatWeight(Math.abs(row.runningGold))}{' '}
                                  <span className="text-[10px] font-bold">
                                    {row.runningGold > 0.0005
                                      ? '(بس)'
                                      : row.runningGold < -0.0005
                                      ? '(بد)'
                                      : ''}
                                  </span>
                                </span>
                              </td>
                            )}

                            {/* Rial Debtor */}
                            {visibleColumns.rialDebtor && (
                              <td
                                className={`${pyClass} px-2.5 text-left tabular-nums font-bold text-rose-600 dark:text-rose-400 border-l border-slate-200 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/10`}
                                dir="ltr"
                              >
                                {row.rialDebtor > 0 ? formatMoney(row.rialDebtor) : '—'}
                              </td>
                            )}

                            {/* Rial Creditor */}
                            {visibleColumns.rialCreditor && (
                              <td
                                className={`${pyClass} px-2.5 text-left tabular-nums font-bold text-emerald-600 dark:text-emerald-400 border-l border-slate-200 dark:border-slate-800 bg-emerald-50/20 dark:bg-emerald-950/10`}
                                dir="ltr"
                              >
                                {row.rialCreditor > 0
                                  ? formatMoney(row.rialCreditor)
                                  : '—'}
                              </td>
                            )}

                            {/* Rial Running Balance */}
                            {visibleColumns.rialBalance && (
                              <td
                                className={`${pyClass} px-2.5 text-left tabular-nums font-black bg-emerald-100/50 dark:bg-emerald-950/40 border-l border-slate-200 dark:border-slate-800`}
                                dir="ltr"
                              >
                                <span
                                  className={
                                    row.runningRial > 50
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : row.runningRial < -50
                                      ? 'text-rose-700 dark:text-rose-300'
                                      : 'text-slate-400'
                                  }
                                >
                                  {formatMoney(Math.abs(row.runningRial))}{' '}
                                  <span className="text-[10px] font-bold">
                                    {row.runningRial > 50
                                      ? '(بس)'
                                      : row.runningRial < -50
                                      ? '(بد)'
                                      : ''}
                                  </span>
                                </span>
                              </td>
                            )}

                            {/* Actions */}
                            {visibleColumns.actions && (
                              <td
                                className={`${pyClass} px-2 text-center non-printable`}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRow(row.id);
                                  }}
                                  className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-all"
                                  title="مشاهده جزئیات قلم"
                                >
                                  {isExpanded ? (
                                    <ChevronUp size={15} />
                                  ) : (
                                    <ChevronDown size={15} />
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>

                          {/* Accordion Row Details */}
                          {isExpanded && (
                            <tr className="bg-slate-50/95 dark:bg-slate-800/70 border-y-2 border-amber-500/30">
                              <td
                                colSpan={totalVisibleColSpan}
                                className="p-4 space-y-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                      مشخصات قلم: {row.breakdown.categoryLabel}
                                    </span>
                                    {row.documentNumber && (
                                      <span className="text-slate-500 text-[11px] font-mono">
                                        (شماره سند: #{row.documentNumber})
                                      </span>
                                    )}
                                  </div>
                                  {row.documentNumber && (
                                    <Link
                                      href={`/dashboard/documents/new?edit=${row.documentNumber}`}
                                      className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1"
                                    >
                                      ویرایش یا مشاهده کامل سند
                                      <ExternalLink size={13} />
                                    </Link>
                                  )}
                                </div>

                                {row.breakdown.attributes.length > 0 ? (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                                    {row.breakdown.attributes.map((attr, aIdx) => (
                                      <div
                                        key={aIdx}
                                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xs"
                                      >
                                        <p className="text-[10px] text-slate-400 font-medium">
                                          {attr.label}
                                        </p>
                                        <p
                                          className={`text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5 ${
                                            attr.isMono ? 'font-mono' : ''
                                          }`}
                                        >
                                          {attr.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">
                                    اطلاعات جزئی بیشتری برای این ردیف ثبت نشده است.
                                  </p>
                                )}

                                {row.description && (
                                  <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      توضیحات تکمیلی:
                                    </span>{' '}
                                    {row.description}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>

                {/* Official Double-line Accounting Table Footer */}
                {ledgerRows.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-black border-t-2 border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <tr className="border-b-4 border-double border-slate-400 dark:border-slate-600">
                      <td colSpan={leadingVisibleCount} className="p-3 text-left border-l border-slate-300 dark:border-slate-700">
                        جمع گردش و مانده نهایی دوره ({totalStats.count.toLocaleString('fa-IR')} ردیف):
                      </td>
                      {visibleColumns.goldDebtor && (
                        <td
                          className="p-3 text-left tabular-nums text-rose-600 dark:text-rose-400 border-l border-slate-300 dark:border-slate-700 bg-amber-50/30 dark:bg-amber-950/20"
                          dir="ltr"
                        >
                          {formatWeight(totalStats.totalGoldDebtor)}
                        </td>
                      )}
                      {visibleColumns.goldCreditor && (
                        <td
                          className="p-3 text-left tabular-nums text-emerald-600 dark:text-emerald-400 border-l border-slate-300 dark:border-slate-700 bg-amber-50/30 dark:bg-amber-950/20"
                          dir="ltr"
                        >
                          {formatWeight(totalStats.totalGoldCreditor)}
                        </td>
                      )}
                      {visibleColumns.goldBalance && (
                        <td
                          className="p-3 text-left tabular-nums bg-amber-200/70 dark:bg-amber-900/60 border-l border-slate-300 dark:border-slate-700"
                          dir="ltr"
                        >
                          <span
                            className={
                              totalStats.finalGold > 0.0005
                                ? 'text-emerald-800 dark:text-emerald-300'
                                : totalStats.finalGold < -0.0005
                                ? 'text-rose-800 dark:text-rose-300'
                                : 'text-slate-600'
                            }
                          >
                            {formatWeight(Math.abs(totalStats.finalGold))}{' '}
                            {totalStats.finalGold > 0.0005
                              ? '(بس)'
                              : totalStats.finalGold < -0.0005
                              ? '(بد)'
                              : '(تسویه)'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.rialDebtor && (
                        <td
                          className="p-3 text-left tabular-nums text-rose-600 dark:text-rose-400 border-l border-slate-300 dark:border-slate-700 bg-emerald-50/30 dark:bg-emerald-950/20"
                          dir="ltr"
                        >
                          {formatMoney(totalStats.totalRialDebtor)}
                        </td>
                      )}
                      {visibleColumns.rialCreditor && (
                        <td
                          className="p-3 text-left tabular-nums text-emerald-600 dark:text-emerald-400 border-l border-slate-300 dark:border-slate-700 bg-emerald-50/30 dark:bg-emerald-950/20"
                          dir="ltr"
                        >
                          {formatMoney(totalStats.totalRialCreditor)}
                        </td>
                      )}
                      {visibleColumns.rialBalance && (
                        <td
                          className="p-3 text-left tabular-nums bg-emerald-200/70 dark:bg-emerald-900/60 border-l border-slate-300 dark:border-slate-700"
                          dir="ltr"
                        >
                          <span
                            className={
                              totalStats.finalRial > 50
                                ? 'text-emerald-800 dark:text-emerald-300'
                                : totalStats.finalRial < -50
                                ? 'text-rose-800 dark:text-rose-300'
                                : 'text-slate-600'
                            }
                          >
                            {formatMoney(Math.abs(totalStats.finalRial))}{' '}
                            {totalStats.finalRial > 50
                              ? '(بس)'
                              : totalStats.finalRial < -50
                              ? '(بد)'
                              : '(تسویه)'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="p-3 text-center non-printable text-slate-400">—</td>
                      )}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl non-printable text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <span>نمایش صفحه</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {safeCurrentPage}
                </span>
                <span>از</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {totalPages}
                </span>
                <span className="text-slate-400 mr-2">
                  (مجموع {ledgerRows.length.toLocaleString('fa-IR')} ردیف)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
                  title="صفحه اول"
                >
                  <ChevronsRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
                  title="صفحه قبلی"
                >
                  <ChevronRight size={15} />
                </button>

                <span className="px-3 py-1 tabular-nums font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                  {safeCurrentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
                  title="صفحه بعدی"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage === totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-all"
                  title="صفحه آخر"
                >
                  <ChevronsLeft size={15} />
                </button>

                <div className="mr-3 flex items-center gap-1">
                  <span className="text-[11px] text-slate-500">تعداد در صفحه:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="p-1 text-xs border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  >
                    <option value={25}>۲۵</option>
                    <option value={50}>۵۰</option>
                    <option value={100}>۱۰۰</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Printable Styles for Clean A4 Landscape */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-container, .printable-container * {
            visibility: visible;
          }
          .printable-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            direction: rtl;
            background: white !important;
            color: black !important;
            padding: 0 !important;
          }
          .non-printable {
            display: none !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #cbd5e1 !important;
            padding: 4px 6px !important;
            font-size: 9pt !important;
          }
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
        }
      `,
        }}
      />
    </div>
  );
}
