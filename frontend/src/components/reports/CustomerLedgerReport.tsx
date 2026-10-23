'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  User,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Sparkles,
} from 'lucide-react';
import type { Customer } from '@/lib/customer';
import type { CustomerTransaction } from '@/lib/transaction';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { parseTransactionBreakdown } from '@/features/customers/utils/document-breakdown';
import * as xlsx from 'xlsx';

type LedgerOpeningBalances = {
  goldAmount: number;
  silverAmount: number;
  platinumAmount: number;
  rialAmount: number;
  foreignBalances?: Record<string, number>;
};

const CATEGORY_TABS = [
  { id: 'all', label: 'همه اقلام', icon: Layers },
  { id: 'raw-gold', label: 'طلای آبشده', icon: Scale },
  { id: 'gold-sale', label: 'کار ساخته', icon: Coins },
  { id: 'bank', label: 'بانک و چک', icon: CreditCard },
  { id: 'cash', label: 'نقد و صندوق', icon: Banknote },
  { id: 'discount', label: 'تخفیف‌ها', icon: Percent },
  { id: 'coin', label: 'مسکوکات', icon: Coins },
];

const badgeStyles: Record<string, string> = {
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300/40',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-300/40',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-indigo-300/40',
  sky: 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 border-sky-300/40',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300/40',
  rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 border-rose-300/40',
  slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300/40',
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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortParam, setSortParam] = useState<'date_asc' | 'date_desc' | 'doc_num'>('date_asc');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Filtered customer list for quick dropdown selection
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return availableCustomers;
    const q = customerSearch.trim().toLowerCase();
    return availableCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.customerCode && String(c.customerCode).toLowerCase().includes(q)) ||
        (c.phone1 && c.phone1.includes(q))
    );
  }, [availableCustomers, customerSearch]);

  const selectedCustomer = useMemo(
    () => availableCustomers.find((c) => c.id === customerId),
    [availableCustomers, customerId]
  );

  // Quick Date Range setter
  function applyDatePreset(preset: 'today' | '7days' | '30days' | '3months' | 'thisYear' | 'all') {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }

    const todayParts = formatter.formatToParts(now);
    const jYear = todayParts.find((p) => p.type === 'year')?.value || '1403';
    const jMonth = todayParts.find((p) => p.type === 'month')?.value || '01';
    const jDay = todayParts.find((p) => p.type === 'day')?.value || '01';
    const todayStr = `${jYear}/${jMonth}/${jDay}`;

    setToDate(todayStr);

    if (preset === 'today') {
      setFromDate(todayStr);
    } else if (preset === '7days') {
      const d = new Date(now.getTime() - 7 * 86400000);
      const parts = formatter.formatToParts(d);
      setFromDate(
        `${parts.find((p) => p.type === 'year')?.value}/${parts.find((p) => p.type === 'month')?.value}/${parts.find((p) => p.type === 'day')?.value}`
      );
    } else if (preset === '30days') {
      const d = new Date(now.getTime() - 30 * 86400000);
      const parts = formatter.formatToParts(d);
      setFromDate(
        `${parts.find((p) => p.type === 'year')?.value}/${parts.find((p) => p.type === 'month')?.value}/${parts.find((p) => p.type === 'day')?.value}`
      );
    } else if (preset === '3months') {
      const d = new Date(now.getTime() - 90 * 86400000);
      const parts = formatter.formatToParts(d);
      setFromDate(
        `${parts.find((p) => p.type === 'year')?.value}/${parts.find((p) => p.type === 'month')?.value}/${parts.find((p) => p.type === 'day')?.value}`
      );
    } else if (preset === 'thisYear') {
      setFromDate(`${jYear}/01/01`);
    }
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
          documentTabs: activeTab !== 'all' ? [activeTab] : undefined,
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
  const ledgerRows = useMemo(() => {
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

    return transactions.map((t) => {
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
  }, [transactions, openingBalances]);

  // Overall Totals (Calculated from full dataset)
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

    // Parse breakdown only for the visible slice!
    return slice.map((item, idx) => ({
      ...item,
      rowNumber: start + idx + 1,
      breakdown: parseTransactionBreakdown(item),
    }));
  }, [ledgerRows, safeCurrentPage, pageSize]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
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
        'دسته / نوع قلم',
        'شرح سند و ردیف',
        'جزئیات تخصصی',
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
        'مانده از قبل',
        'انتقال مانده پیشین',
        '—',
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
      const breakdownText = breakdown.attributes
        .map((a) => `${a.label}: ${a.value}`)
        .join(' | ');

      wsData.push([
        idx + 1,
        row.documentDateJalali || row.transactionDate,
        row.documentNumber || '—',
        (row as any).customerName || selectedCustomer?.name || '—',
        breakdown.categoryLabel,
        row.description || '—',
        breakdownText || '—',
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

  return (
    <div className="space-y-6 text-sm dashboard-panel p-4 md:p-6 printable-container">
      {/* Page Heading & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 non-printable">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileText size={20} />
            </span>
            <div>
              <p className="eyebrow text-xs font-semibold text-amber-600 dark:text-amber-400">
                گزارش‌های جامع مالی و طلایی
              </p>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100">
                ریز اسناد و صورت‌حساب طرف‌حساب‌ها
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مشاهده کامل ردیف‌های اسناد (آبشده، ساخته، نقد، بانک، چک، تخفیف، سکه)
            همراه با مانده متناوب و آکاردئون اقلام.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto">
          {searched && ledgerRows.length > 0 && (
            <>
              <button
                onClick={handleExportExcel}
                className="dashboard-secondary-button flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <Download size={15} className="text-emerald-600" />
                خروجی Excel
              </button>
              <button
                onClick={() => window.print()}
                className="dashboard-secondary-button flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-slate-700 dark:text-slate-200 shadow-sm"
              >
                <Printer size={15} className="text-sky-600" />
                چاپ A4
              </button>
            </>
          )}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="customer-save-button flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>تهیه و بازخوانی گزارش</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm non-printable">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Customer Picker */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User size={14} className="text-amber-500" />
              طرف‌حساب
            </label>
            <div className="relative">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full p-2.5 text-xs border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
              >
                <option value="">همه طرف‌حساب‌ها (محدود به ۵۰۰ سند اخیر)</option>
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customerCode ? `[${c.customerCode}] ` : ''}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="md:col-span-4 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-500" />
              بازه زمانی پیش‌فرض
            </label>
            <div className="grid grid-cols-6 gap-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => applyDatePreset('today')}
                className="py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('7days')}
                className="py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                ۷ روز
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('30days')}
                className="py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                ۳۰ روز
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('3months')}
                className="py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                ۳ ماه
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('thisYear')}
                className="py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                امسال
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className="py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-700 transition-all"
              >
                کل دوره
              </button>
            </div>
          </div>

          {/* Manual Jalali Dates */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              از تاریخ (شمسی)
            </label>
            <input
              type="text"
              placeholder="1403/01/01"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="p-2.5 text-xs border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 text-center font-mono focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
              dir="ltr"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              تا تاریخ (شمسی)
            </label>
            <input
              type="text"
              placeholder="1403/12/29"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="p-2.5 text-xs border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 text-center font-mono focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
              dir="ltr"
            />
          </div>
        </div>

        {/* Secondary Filter Row: Category Tabs & Search */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Term & Sort */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search
                size={14}
                className="absolute right-3 top-3 text-slate-400"
              />
              <input
                type="text"
                placeholder="جستجو در شماره، شرح، انگ، چک..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pr-9 pl-3 py-2 text-xs border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
              />
            </div>

            <select
              value={sortParam}
              onChange={(e) => setSortParam(e.target.value as any)}
              className="p-2 text-xs border rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
            >
              <option value="date_asc">تاریخ (صعودی / رو به جلو)</option>
              <option value="date_desc">تاریخ (نزولی / جدیدترین)</option>
              <option value="doc_num">شماره سند</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl">
          {error}
        </div>
      )}

      {/* Initial Welcome & Instruction State before search */}
      {!searched && !loading && (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Sparkles size={28} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
              تهیه صورت‌حساب و ریز اسناد طرف‌حساب
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              لطفاً طرف‌حساب مورد نظر یا بازه زمانی دلخواه را انتخاب کرده و دکمه
              «تهیه و بازخوانی گزارش» را بزنید تا گزارش بدون افت سرعت و مصرف بیهوده حافظه بارگذاری شود.
            </p>
          </div>
          <button
            onClick={handleSearch}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all"
          >
            تهیه و بازخوانی گزارش
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
                className={`text-lg md:text-xl font-black font-mono ${
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
            <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex justify-between text-[11px] text-slate-500 font-mono">
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
                className={`text-lg md:text-xl font-black font-mono ${
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
            <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex justify-between text-[11px] text-slate-500 font-mono">
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
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
                  {formatWeight(Math.abs(openingBalances.goldAmount))}{' '}
                  <span className="text-[10px] text-slate-400">
                    {openingBalances.goldAmount > 0 ? '(بس)' : openingBalances.goldAmount < 0 ? '(بد)' : '—'}
                  </span>
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">مبلغ ریالی:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200" dir="ltr">
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
              <p className="text-xl md:text-2xl font-black font-mono text-indigo-700 dark:text-indigo-400">
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
              نمایش سریع با صفحه‌بندی هوشمند
            </p>
          </div>
        </div>
      )}

      {/* Main Ledger Table */}
      {searched && (
        <div className="space-y-3">
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right whitespace-nowrap">
                <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">تاریخ</th>
                    <th className="p-3">شماره سند</th>
                    {!customerId && <th className="p-3">طرف‌حساب</th>}
                    <th className="p-3">نوع قلم</th>
                    <th className="p-3 min-w-[180px]">شرح و جزئیات</th>
                    <th className="p-3 text-left">بدهکار طلا (g)</th>
                    <th className="p-3 text-left">بستانکار طلا (g)</th>
                    <th className="p-3 text-left bg-amber-500/5 dark:bg-amber-500/10">
                      مانده طلا (g)
                    </th>
                    <th className="p-3 text-left">بدهکار مالی</th>
                    <th className="p-3 text-left">بستانکار مالی</th>
                    <th className="p-3 text-left bg-emerald-500/5 dark:bg-emerald-500/10">
                      مانده مالی ({baseCurrencySymbol})
                    </th>
                    <th className="p-3 text-center non-printable">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {/* Opening Balance Row (on Page 1 only) */}
                  {safeCurrentPage === 1 && (
                    <tr className="bg-amber-50/80 dark:bg-amber-950/30 font-bold">
                      <td className="p-3 text-center text-slate-400">—</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {fromDate || 'ابتدای دوره'}
                      </td>
                      <td className="p-3 font-mono text-slate-400">—</td>
                      {!customerId && (
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          کلیه طرف‌حساب‌ها
                        </td>
                      )}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                          مانده از قبل
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        مانده تراز انتقالی از پیش از این تاریخ
                      </td>
                      <td
                        className="p-3 text-left font-mono text-rose-600 dark:text-rose-400"
                        dir="ltr"
                      >
                        {openingBalances.goldAmount < 0
                          ? formatWeight(Math.abs(openingBalances.goldAmount))
                          : '—'}
                      </td>
                      <td
                        className="p-3 text-left font-mono text-emerald-600 dark:text-emerald-400"
                        dir="ltr"
                      >
                        {openingBalances.goldAmount > 0
                          ? formatWeight(openingBalances.goldAmount)
                          : '—'}
                      </td>
                      <td
                        className="p-3 text-left font-mono font-bold bg-amber-500/5 dark:bg-amber-500/10"
                        dir="ltr"
                      >
                        <span
                          className={
                            openingBalances.goldAmount > 0.0005
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : openingBalances.goldAmount < -0.0005
                              ? 'text-rose-600 dark:text-rose-400'
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
                      <td
                        className="p-3 text-left font-mono text-rose-600 dark:text-rose-400"
                        dir="ltr"
                      >
                        {openingBalances.rialAmount < 0
                          ? formatMoney(Math.abs(openingBalances.rialAmount))
                          : '—'}
                      </td>
                      <td
                        className="p-3 text-left font-mono text-emerald-600 dark:text-emerald-400"
                        dir="ltr"
                      >
                        {openingBalances.rialAmount > 0
                          ? formatMoney(openingBalances.rialAmount)
                          : '—'}
                      </td>
                      <td
                        className="p-3 text-left font-mono font-bold bg-emerald-500/5 dark:bg-emerald-500/10"
                        dir="ltr"
                      >
                        <span
                          className={
                            openingBalances.rialAmount > 50
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : openingBalances.rialAmount < -50
                              ? 'text-rose-600 dark:text-rose-400'
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
                      <td className="p-3 text-center non-printable">—</td>
                    </tr>
                  )}

                  {/* Paginated Ledger Rows */}
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={customerId ? 12 : 13}
                        className="p-12 text-center text-slate-500"
                      >
                        در این بازه زمانی هیچ ردیف سندی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      const isExpanded = !!expandedRows[row.id];

                      return (
                        <React.Fragment key={row.id}>
                          <tr
                            onClick={() => toggleRow(row.id)}
                            className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                              isExpanded ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                            }`}
                          >
                            <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                              {row.rowNumber}
                            </td>
                            <td className="p-3 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                              {row.documentDateJalali ||
                                (row.transactionDate
                                  ? new Date(row.transactionDate).toLocaleDateString(
                                      'fa-IR'
                                    )
                                  : '—')}
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                              {row.documentNumber ? (
                                <Link
                                  href={`/dashboard/documents/new?edit=${row.documentNumber}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1 inline-flex"
                                  title="مشاهده و ویرایش سند کامل"
                                >
                                  {row.documentNumber}
                                  <ExternalLink size={12} className="opacity-70" />
                                </Link>
                              ) : (
                                '—'
                              )}
                            </td>
                            {!customerId && (
                              <td className="p-3 font-semibold text-slate-800 dark:text-slate-200 max-w-[130px] truncate">
                                {(row as any).customerName || '—'}
                              </td>
                            )}
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  badgeStyles[row.breakdown.badgeColor] ||
                                  badgeStyles.slate
                                }`}
                              >
                                {row.breakdown.categoryLabel}
                              </span>
                            </td>
                            <td
                              className="p-3 max-w-[220px] truncate text-slate-600 dark:text-slate-300"
                              title={row.description}
                            >
                              {row.description || '—'}
                            </td>
                            <td
                              className="p-3 text-left font-mono text-rose-600 dark:text-rose-400"
                              dir="ltr"
                            >
                              {row.goldDebtor > 0 ? formatWeight(row.goldDebtor) : '—'}
                            </td>
                            <td
                              className="p-3 text-left font-mono text-emerald-600 dark:text-emerald-400"
                              dir="ltr"
                            >
                              {row.goldCreditor > 0
                                ? formatWeight(row.goldCreditor)
                                : '—'}
                            </td>
                            <td
                              className="p-3 text-left font-mono font-bold bg-amber-500/5 dark:bg-amber-500/10"
                              dir="ltr"
                            >
                              <span
                                className={
                                  row.runningGold > 0.0005
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : row.runningGold < -0.0005
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-400'
                                }
                              >
                                {formatWeight(Math.abs(row.runningGold))}{' '}
                                <span className="text-[10px]">
                                  {row.runningGold > 0.0005
                                    ? '(بس)'
                                    : row.runningGold < -0.0005
                                    ? '(بد)'
                                    : ''}
                                </span>
                              </span>
                            </td>
                            <td
                              className="p-3 text-left font-mono text-rose-600 dark:text-rose-400"
                              dir="ltr"
                            >
                              {row.rialDebtor > 0 ? formatMoney(row.rialDebtor) : '—'}
                            </td>
                            <td
                              className="p-3 text-left font-mono text-emerald-600 dark:text-emerald-400"
                              dir="ltr"
                            >
                              {row.rialCreditor > 0
                                ? formatMoney(row.rialCreditor)
                                : '—'}
                            </td>
                            <td
                              className="p-3 text-left font-mono font-bold bg-emerald-500/5 dark:bg-emerald-500/10"
                              dir="ltr"
                            >
                              <span
                                className={
                                  row.runningRial > 50
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : row.runningRial < -50
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-400'
                                }
                              >
                                {formatMoney(Math.abs(row.runningRial))}{' '}
                                <span className="text-[10px]">
                                  {row.runningRial > 50
                                    ? '(بس)'
                                    : row.runningRial < -50
                                    ? '(بد)'
                                    : ''}
                                </span>
                              </span>
                            </td>
                            <td className="p-3 text-center non-printable">
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
                          </tr>

                          {/* Accordion Row Details */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-y border-amber-500/20">
                              <td
                                colSpan={customerId ? 12 : 13}
                                className="p-4 space-y-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                      ریز مشخصات قلم: {row.breakdown.categoryLabel}
                                    </span>
                                    {row.documentNumber && (
                                      <span className="text-slate-400 text-[11px] font-mono">
                                        (سند #{row.documentNumber})
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
                                  <div className="text-[11px] text-slate-500 bg-white/60 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
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

                {/* Table Footer */}
                {ledgerRows.length > 0 && (
                  <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100">
                    <tr>
                      <td colSpan={customerId ? 5 : 6} className="p-3 text-left">
                        جمع کل دوره ({totalStats.count.toLocaleString('fa-IR')} ردیف):
                      </td>
                      <td
                        className="p-3 text-left font-mono text-rose-600 dark:text-rose-400"
                        dir="ltr"
                      >
                        {formatWeight(totalStats.totalGoldDebtor)}
                      </td>
                      <td
                        className="p-3 text-left font-mono text-emerald-600 dark:text-emerald-400"
                        dir="ltr"
                      >
                        {formatWeight(totalStats.totalGoldCreditor)}
                      </td>
                      <td
                        className="p-3 text-left font-mono bg-amber-500/10 dark:bg-amber-500/20"
                        dir="ltr"
                      >
                        <span
                          className={
                            totalStats.finalGold > 0.0005
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : totalStats.finalGold < -0.0005
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
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
                      <td
                        className="p-3 text-left font-mono text-rose-600 dark:text-rose-400"
                        dir="ltr"
                      >
                        {formatMoney(totalStats.totalRialDebtor)}
                      </td>
                      <td
                        className="p-3 text-left font-mono text-emerald-600 dark:text-emerald-400"
                        dir="ltr"
                      >
                        {formatMoney(totalStats.totalRialCreditor)}
                      </td>
                      <td
                        className="p-3 text-left font-mono bg-emerald-500/10 dark:bg-emerald-500/20"
                        dir="ltr"
                      >
                        <span
                          className={
                            totalStats.finalRial > 50
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : totalStats.finalRial < -50
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
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
                      <td className="p-3 text-center non-printable">—</td>
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
                <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
                  {safeCurrentPage}
                </span>
                <span>از</span>
                <span className="font-bold font-mono text-slate-900 dark:text-slate-100">
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

                <span className="px-3 py-1 font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
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
