'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Scale,
  Banknote,
  Coins,
  CreditCard,
  Percent,
  Layers,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { currencyDisplay } from '@/lib/customer';
import {
  type CustomerTransaction,
  calculateCustomerCurrencyBalances,
  sumPostedTransactions,
} from '@/lib/transaction';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { parseTransactionBreakdown } from '@/features/customers/utils/document-breakdown';
import * as xlsx from 'xlsx';

const transactionLabels: Record<string, string> = {
  opening_balance: 'مانده اول دوره',
  document: 'سند',
  adjustment: 'اصلاحی',
  reversal: 'برگشتی',
};

function formatDate(value: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function balanceStatus(value: number) {
  if (value < 0) return 'بدهکار به ما';
  if (value > 0) return 'طلبکار از ما';
  return 'تسویه';
}

const CATEGORY_TABS = [
  { id: 'all', label: 'همه تراکنش‌ها', icon: Layers },
  { id: 'raw-gold', label: 'طلای آبشده', icon: Scale },
  { id: 'gold-sale', label: 'کار ساخته', icon: Coins },
  { id: 'bank', label: 'بانک و چک', icon: CreditCard },
  { id: 'cash', label: 'وجه نقد', icon: Banknote },
  { id: 'discount', label: 'تخفیف', icon: Percent },
];

export type CustomerLedgerColumnKey =
  | 'rowNumber'
  | 'date'
  | 'docNumber'
  | 'type'
  | 'description'
  | 'goldDebtor'
  | 'goldCreditor'
  | 'goldBalance'
  | 'rialDebtor'
  | 'rialCreditor'
  | 'rialBalance'
  | 'details';

export const DEFAULT_CUSTOMER_LEDGER_WIDTHS: Record<CustomerLedgerColumnKey, number> = {
  rowNumber: 45,
  date: 120,
  docNumber: 110,
  type: 140,
  description: 230,
  goldDebtor: 120,
  goldCreditor: 120,
  goldBalance: 135,
  rialDebtor: 135,
  rialCreditor: 135,
  rialBalance: 145,
  details: 65,
};

export const MIN_CUSTOMER_LEDGER_WIDTHS: Record<CustomerLedgerColumnKey, number> = {
  rowNumber: 35,
  date: 85,
  docNumber: 75,
  type: 90,
  description: 130,
  goldDebtor: 80,
  goldCreditor: 80,
  goldBalance: 90,
  rialDebtor: 85,
  rialCreditor: 85,
  rialBalance: 95,
  details: 50,
};

export const STORAGE_KEY_CUSTOMER_LEDGER = 'zarfolio_customer_tx_col_widths';

export const CUSTOMER_LEDGER_COLUMNS: CustomerLedgerColumnKey[] = [
  'rowNumber',
  'date',
  'docNumber',
  'type',
  'description',
  'goldDebtor',
  'goldCreditor',
  'goldBalance',
  'rialDebtor',
  'rialCreditor',
  'rialBalance',
  'details',
];

interface SortableHeaderProps {
  column: CustomerLedgerColumnKey;
  currentSort: { column: CustomerLedgerColumnKey; direction: 'asc' | 'desc' } | null;
  onSort: (column: CustomerLedgerColumnKey) => void;
  children: React.ReactNode;
  align?: 'center' | 'right' | 'left';
  className?: string;
  title?: string;
}

function SortableHeader({
  column,
  currentSort,
  onSort,
  children,
  align = 'center',
  className = '',
  title,
}: SortableHeaderProps) {
  const isActive = currentSort?.column === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`group/sort flex items-center gap-1 w-full text-xs font-bold transition-colors select-none cursor-pointer ${
        align === 'center'
          ? 'justify-center'
          : align === 'left'
          ? 'justify-end flex-row-reverse'
          : 'justify-start'
      } ${
        isActive
          ? 'text-amber-600 dark:text-amber-400 font-extrabold'
          : 'text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400'
      } ${className}`}
      title={title || 'برای مرتب‌سازی کلیک کنید'}
    >
      <span className="truncate">{children}</span>
      <span className="shrink-0 text-slate-400 group-hover/sort:text-amber-500">
        {isActive ? (
          currentSort.direction === 'asc' ? (
            <ArrowUp size={12} className="text-amber-600 dark:text-amber-400 stroke-[2.5]" />
          ) : (
            <ArrowDown size={12} className="text-amber-600 dark:text-amber-400 stroke-[2.5]" />
          )
        ) : (
          <ArrowUpDown size={11} className="opacity-0 group-hover/sort:opacity-70 transition-opacity" />
        )}
      </span>
    </button>
  );
}

interface ColumnResizerProps {
  colKey: CustomerLedgerColumnKey;
  onResizeStart: (
    colKey: CustomerLedgerColumnKey,
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => void;
  onReset: (colKey: CustomerLedgerColumnKey, e: React.MouseEvent) => void;
  isResizing: boolean;
}

function ColumnResizer({ colKey, onResizeStart, onReset, isResizing }: ColumnResizerProps) {
  return (
    <div
      onMouseDown={(e) => onResizeStart(colKey, e)}
      onTouchStart={(e) => onResizeStart(colKey, e)}
      onDoubleClick={(e) => onReset(colKey, e)}
      className={`absolute top-0 bottom-0 left-0 w-3 -translate-x-1/2 cursor-col-resize select-none touch-none z-30 flex items-center justify-center group/resizer ${
        isResizing ? 'bg-amber-400/20' : ''
      }`}
      title="برای تغییر عرض ستون بکشید (دوبار کلیک برای بازنشانی)"
    >
      <div
        className={`w-[2.5px] h-3/5 rounded-full transition-colors ${
          isResizing
            ? 'bg-amber-500 ring-2 ring-amber-400/40'
            : 'bg-transparent group-hover/resizer:bg-amber-500/80'
        }`}
      />
    </div>
  );
}

export default function CustomerTransactionLedger({
  customerId,
  initialTransactions,
}: {
  customerId: string;
  initialTransactions: CustomerTransaction[];
}) {
  const { formatMoney, formatWeight, settings } = useAppSettings();
  const [transactions, setTransactions] = useState<CustomerTransaction[]>(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const [sortState, setSortState] = useState<{
    column: CustomerLedgerColumnKey;
    direction: 'asc' | 'desc';
  } | null>(null);

  const [columnWidths, setColumnWidths] = useState<Record<CustomerLedgerColumnKey, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_CUSTOMER_LEDGER);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            return { ...DEFAULT_CUSTOMER_LEDGER_WIDTHS, ...parsed };
          }
        }
      } catch {}
    }
    return DEFAULT_CUSTOMER_LEDGER_WIDTHS;
  });

  const latestWidthsRef = useRef(columnWidths);
  latestWidthsRef.current = columnWidths;
  const [resizingCol, setResizingCol] = useState<CustomerLedgerColumnKey | null>(null);

  const hasCustomWidths = useMemo(() => {
    return (Object.keys(DEFAULT_CUSTOMER_LEDGER_WIDTHS) as CustomerLedgerColumnKey[]).some(
      (k) => columnWidths[k] !== DEFAULT_CUSTOMER_LEDGER_WIDTHS[k],
    );
  }, [columnWidths]);

  const totalTableWidth = useMemo(() => {
    return CUSTOMER_LEDGER_COLUMNS.reduce(
      (sum, col) => sum + (columnWidths[col] ?? DEFAULT_CUSTOMER_LEDGER_WIDTHS[col]),
      0,
    );
  }, [columnWidths]);

  const handleResizeStart = (
    colKey: CustomerLedgerColumnKey,
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = latestWidthsRef.current[colKey] ?? DEFAULT_CUSTOMER_LEDGER_WIDTHS[colKey];
    const isRtl =
      typeof document !== 'undefined'
        ? document.documentElement.dir === 'rtl' ||
          document.body.dir === 'rtl' ||
          window.getComputedStyle(document.body).direction === 'rtl'
        : true;

    setResizingCol(colKey);

    const handlePointerMove = (moveEvt: MouseEvent | TouchEvent) => {
      const currentX =
        'touches' in moveEvt
          ? moveEvt.touches[0].clientX
          : (moveEvt as MouseEvent).clientX;
      const delta = isRtl ? startX - currentX : currentX - startX;
      const minW = MIN_CUSTOMER_LEDGER_WIDTHS[colKey] ?? 40;
      const newWidth = Math.max(minW, Math.round(startWidth + delta));

      const updated = {
        ...latestWidthsRef.current,
        [colKey]: newWidth,
      };
      latestWidthsRef.current = updated;
      setColumnWidths(updated);
    };

    const handlePointerUp = () => {
      setResizingCol(null);
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchmove', handlePointerMove);
      document.removeEventListener('touchend', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      try {
        localStorage.setItem(STORAGE_KEY_CUSTOMER_LEDGER, JSON.stringify(latestWidthsRef.current));
      } catch {}
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handlePointerMove);
    document.addEventListener('mouseup', handlePointerUp);
    document.addEventListener('touchmove', handlePointerMove);
    document.addEventListener('touchend', handlePointerUp);
  };

  const handleResetColumnWidth = (colKey: CustomerLedgerColumnKey, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updated = {
      ...latestWidthsRef.current,
      [colKey]: DEFAULT_CUSTOMER_LEDGER_WIDTHS[colKey],
    };
    latestWidthsRef.current = updated;
    setColumnWidths(updated);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOMER_LEDGER, JSON.stringify(updated));
    } catch {}
  };

  const handleResetAllWidths = () => {
    latestWidthsRef.current = DEFAULT_CUSTOMER_LEDGER_WIDTHS;
    setColumnWidths(DEFAULT_CUSTOMER_LEDGER_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY_CUSTOMER_LEDGER);
    } catch {}
  };

  const handleSort = (column: CustomerLedgerColumnKey) => {
    setSortState((prev) => {
      if (prev?.column === column) {
        if (prev.direction === 'asc') {
          return { column, direction: 'desc' };
        }
        return null;
      }
      return { column, direction: 'asc' };
    });
  };

  const baseCurrencySymbol = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  async function refresh() {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`/api/customers/${customerId}/transactions`, {
        cache: 'no-store',
      });
      const data = (await response.json().catch(() => null)) as
        | { transactions?: CustomerTransaction[]; message?: string }
        | null;

      if (!response.ok) {
        setMessage(data?.message ?? 'دریافت تراکنش‌ها انجام نشد.');
        return;
      }

      setTransactions(data?.transactions ?? []);
    } catch {
      setMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  const balances = useMemo(
    () => sumPostedTransactions(transactions),
    [transactions],
  );
  const currencyBalances = useMemo(
    () => calculateCustomerCurrencyBalances(transactions),
    [transactions],
  );
  const foreignCurrencies = useMemo(() => {
    return Object.entries(currencyBalances).filter(
      ([code, amt]) => code !== 'IRR' && code !== 'IRT' && Math.abs(amt) > 0,
    );
  }, [currencyBalances]);

  // Calculate Running Balances chronologically
  const enrichedRows = useMemo(() => {
    // Sort chronologically ascending to calculate running balance
    const sorted = [...transactions].sort((a, b) => {
      const dateA = a.documentDateJalali || a.transactionDate || '';
      const dateB = b.documentDateJalali || b.transactionDate || '';
      return dateA.localeCompare(dateB);
    });

    let runningGold = 0;
    let runningRial = 0;

    const mapped = sorted.map((t) => {
      const gAmt = Number(t.goldAmount) || 0;
      const rAmt = Number(t.rialAmount) || 0;

      const goldDebtor = gAmt < 0 ? Math.abs(gAmt) : 0;
      const goldCreditor = gAmt > 0 ? gAmt : 0;
      const rialDebtor = rAmt < 0 ? Math.abs(rAmt) : 0;
      const rialCreditor = rAmt > 0 ? rAmt : 0;

      runningGold += gAmt;
      runningRial += rAmt;

      return {
        ...t,
        runningGold,
        runningRial,
        goldDebtor,
        goldCreditor,
        rialDebtor,
        rialCreditor,
      };
    });

    return mapped;
  }, [transactions]);

  // Filtered and Sorted rows
  const filteredRows = useMemo(() => {
    let rows = enrichedRows.filter((row) => {
      // Category filter
      if (activeCategory !== 'all') {
        const tab = row.documentTab || '';
        const subType = row.documentSubType || '';
        if (activeCategory === 'raw-gold') {
          if (tab !== 'raw-gold' && !subType.includes('molten') && !subType.includes('conditional')) {
            return false;
          }
        } else if (activeCategory === 'gold-sale') {
          if (tab !== 'gold-sale' && !subType.includes('sale')) return false;
        } else if (activeCategory === 'bank') {
          if (tab !== 'bank' && !subType.includes('bank') && !subType.includes('check')) return false;
        } else if (activeCategory === 'cash') {
          if (tab !== 'cash' && !subType.includes('cash')) return false;
        } else if (activeCategory === 'discount') {
          if (tab !== 'discount' && !subType.includes('discount')) return false;
        }
      }

      // Text query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${row.documentNumber} ${row.description} ${row.documentDetails} ${row.documentSubType}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });

    if (sortState) {
      rows = [...rows].sort((a, b) => {
        let valA: any;
        let valB: any;
        switch (sortState.column) {
          case 'rowNumber':
          case 'date':
            valA = a.documentDateJalali || a.transactionDate || '';
            valB = b.documentDateJalali || b.transactionDate || '';
            break;
          case 'docNumber':
            valA = Number(a.documentNumber) || 0;
            valB = Number(b.documentNumber) || 0;
            break;
          case 'type':
            valA = a.documentSubType || a.transactionType || '';
            valB = b.documentSubType || b.transactionType || '';
            break;
          case 'description':
            valA = a.description || '';
            valB = b.description || '';
            break;
          case 'goldDebtor':
            valA = a.goldDebtor;
            valB = b.goldDebtor;
            break;
          case 'goldCreditor':
            valA = a.goldCreditor;
            valB = b.goldCreditor;
            break;
          case 'goldBalance':
            valA = a.runningGold;
            valB = b.runningGold;
            break;
          case 'rialDebtor':
            valA = a.rialDebtor;
            valB = b.rialDebtor;
            break;
          case 'rialCreditor':
            valA = a.rialCreditor;
            valB = b.rialCreditor;
            break;
          case 'rialBalance':
            valA = a.runningRial;
            valB = b.runningRial;
            break;
          default:
            valA = (a as any)[sortState.column] ?? '';
            valB = (b as any)[sortState.column] ?? '';
        }
        let comp = 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          comp = valA - valB;
        } else {
          comp = String(valA ?? '').localeCompare(String(valB ?? ''), 'fa-IR', { numeric: true });
        }
        return sortState.direction === 'asc' ? comp : -comp;
      });
    } else {
      rows = [...rows].reverse();
    }

    return rows;
  }, [enrichedRows, activeCategory, searchQuery, sortState]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  // Paginated Rows: only parse breakdown for current page
  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    const slice = filteredRows.slice(start, start + pageSize);

    return slice.map((item, idx) => ({
      ...item,
      rowNumber: start + idx + 1,
      breakdown: parseTransactionBreakdown(item),
    }));
  }, [filteredRows, safeCurrentPage, pageSize]);

  function toggleRow(id: string) {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleExportExcel() {
    if (!filteredRows.length) return;

    const wsData: any[][] = [
      ['ریز اسناد و صورت‌حساب طرف‌حساب'],
      [`تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}`],
      [],
      [
        'ردیف',
        'تاریخ',
        'شماره سند',
        'نوع تراکنش',
        'سرفصل قلم',
        'شرح',
        'بدهکار طلا (گرم)',
        'بستانکار طلا (گرم)',
        'مانده طلا (گرم)',
        'وضعیت طلا',
        `بدهکار مالی (${baseCurrencySymbol})`,
        `بستانکار مالی (${baseCurrencySymbol})`,
        `مانده مالی (${baseCurrencySymbol})`,
        'وضعیت مالی',
      ],
    ];

    filteredRows.forEach((row, idx) => {
      const breakdown = parseTransactionBreakdown(row);
      wsData.push([
        idx + 1,
        row.documentDateJalali || formatDate(row.transactionDate),
        row.documentNumber || '—',
        transactionLabels[row.transactionType] || row.transactionType,
        breakdown.categoryLabel,
        row.description || '—',
        row.goldDebtor,
        row.goldCreditor,
        Math.abs(row.runningGold),
        row.runningGold > 0.0005 ? 'بستانکار' : row.runningGold < -0.0005 ? 'بدهکار' : 'تسویه',
        row.rialDebtor,
        row.rialCreditor,
        Math.abs(row.runningRial),
        row.runningRial > 50 ? 'بستانکار' : row.runningRial < -50 ? 'بدهکار' : 'تسویه',
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'صورت‌حساب');
    xlsx.writeFile(wb, `Customer_Transactions_${customerId}_${Date.now()}.xlsx`);
  }

  const badgeStyles: Record<string, string> = {
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-300/40',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-300/40',
    indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-indigo-300/40',
    sky: 'bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 border-sky-300/40',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300/40',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 border-rose-300/40',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300/40',
  };

  return (
    <section className="dashboard-panel customer-transactions-panel space-y-4">
      {/* Heading & Toolbar */}
      <div className="account-panel-heading flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <p className="eyebrow text-amber-600 dark:text-amber-400 font-semibold">دفتر و ریز اسناد طرف‌حساب</p>
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">گردش تراکنش‌ها و اقلام تفکیکی</h2>
        </div>

        <div className="flex items-center gap-2">
          {filteredRows.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                className="dashboard-secondary-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 transition-all text-slate-700 dark:text-slate-200"
              >
                <Download size={14} className="text-emerald-600" />
                اکسل
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="dashboard-secondary-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 transition-all text-slate-700 dark:text-slate-200"
              >
                <Printer size={14} className="text-sky-600" />
                چاپ
              </button>
            </>
          )}

          {hasCustomWidths && (
            <button
              type="button"
              onClick={handleResetAllWidths}
              className="dashboard-secondary-button flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 transition-all text-slate-700 dark:text-slate-200"
              title="بازنشانی عرض ستون‌ها به حالت پیش‌فرض"
            >
              <RotateCcw size={14} className="text-amber-500" />
              <span>بازنشانی عرض‌ها</span>
            </button>
          )}

          <button
            type="button"
            className="dashboard-secondary-button flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            به‌روزرسانی
          </button>
        </div>
      </div>

      {message ? <p className="form-error text-xs">{message}</p> : null}

      {/* KPI Balance Cards */}
      <div className="customer-transaction-balance-grid">
        <BalanceItem
          label="طلا"
          formattedValue={formatWeight(balances.goldAmount)}
          value={balances.goldAmount}
          unit="گرم"
        />
        <BalanceItem
          label="نقره"
          formattedValue={formatWeight(balances.silverAmount)}
          value={balances.silverAmount}
          unit="گرم"
        />
        <BalanceItem
          label="پلاتین"
          formattedValue={formatWeight(balances.platinumAmount)}
          value={balances.platinumAmount}
          unit="گرم"
        />
        <BalanceItem
          label="ارز پایه"
          formattedValue={formatMoney(balances.rialAmount)}
          value={balances.rialAmount}
          unit={baseCurrencySymbol}
        />
        {foreignCurrencies.length > 0 &&
          foreignCurrencies.map(([code, amt]) => (
            <BalanceItem
              key={code}
              label={`ارز (${code})`}
              formattedValue={amt.toLocaleString('fa-IR')}
              value={amt}
              unit={currencyDisplay(code, '')}
            />
          ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-xl font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-60">
          <Search size={13} className="absolute right-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="جستجو در شماره، شرح، انگ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-8 pl-2.5 py-1.5 text-xs border rounded-xl bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-amber-500/30 transition-all"
          />
        </div>
      </div>

      {/* Transactions & Breakdown Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table
            className="w-full text-xs text-right whitespace-nowrap border-collapse table-fixed"
            style={{ width: `${totalTableWidth}px`, minWidth: '100%' }}
          >
            <colgroup>
              {CUSTOMER_LEDGER_COLUMNS.map((colKey) => (
                <col
                  key={colKey}
                  style={{
                    width: `${columnWidths[colKey] ?? DEFAULT_CUSTOMER_LEDGER_WIDTHS[colKey]}px`,
                  }}
                />
              ))}
            </colgroup>
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold sticky top-0 z-20 shadow-2xs">
              <tr>
                <th
                  style={{ width: `${columnWidths.rowNumber}px` }}
                  className="relative p-2.5 text-center select-none overflow-visible"
                >
                  <SortableHeader column="rowNumber" currentSort={sortState} onSort={handleSort} align="center">
                    #
                  </SortableHeader>
                  <ColumnResizer
                    colKey="rowNumber"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'rowNumber'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.date}px` }}
                  className="relative p-2.5 border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="date" currentSort={sortState} onSort={handleSort} align="right">
                    تاریخ
                  </SortableHeader>
                  <ColumnResizer
                    colKey="date"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'date'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.docNumber}px` }}
                  className="relative p-2.5 border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="docNumber" currentSort={sortState} onSort={handleSort} align="right">
                    شماره سند
                  </SortableHeader>
                  <ColumnResizer
                    colKey="docNumber"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'docNumber'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.type}px` }}
                  className="relative p-2.5 border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="type" currentSort={sortState} onSort={handleSort} align="right">
                    نوع و قلم
                  </SortableHeader>
                  <ColumnResizer
                    colKey="type"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'type'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.description}px` }}
                  className="relative p-2.5 border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="description" currentSort={sortState} onSort={handleSort} align="right">
                    شرح و جزئیات
                  </SortableHeader>
                  <ColumnResizer
                    colKey="description"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'description'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.goldDebtor}px` }}
                  className="relative p-2.5 text-left border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="goldDebtor" currentSort={sortState} onSort={handleSort} align="left">
                    بدهکار طلا (g)
                  </SortableHeader>
                  <ColumnResizer
                    colKey="goldDebtor"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'goldDebtor'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.goldCreditor}px` }}
                  className="relative p-2.5 text-left border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="goldCreditor" currentSort={sortState} onSort={handleSort} align="left">
                    بستانکار طلا (g)
                  </SortableHeader>
                  <ColumnResizer
                    colKey="goldCreditor"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'goldCreditor'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.goldBalance}px` }}
                  className="relative p-2.5 text-left bg-amber-500/10 dark:bg-amber-950/30 font-black border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="goldBalance" currentSort={sortState} onSort={handleSort} align="left">
                    مانده طلا (g)
                  </SortableHeader>
                  <ColumnResizer
                    colKey="goldBalance"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'goldBalance'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.rialDebtor}px` }}
                  className="relative p-2.5 text-left border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="rialDebtor" currentSort={sortState} onSort={handleSort} align="left">
                    بدهکار مالی
                  </SortableHeader>
                  <ColumnResizer
                    colKey="rialDebtor"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'rialDebtor'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.rialCreditor}px` }}
                  className="relative p-2.5 text-left border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="rialCreditor" currentSort={sortState} onSort={handleSort} align="left">
                    بستانکار مالی
                  </SortableHeader>
                  <ColumnResizer
                    colKey="rialCreditor"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'rialCreditor'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.rialBalance}px` }}
                  className="relative p-2.5 text-left bg-emerald-500/10 dark:bg-emerald-950/30 font-black border-r border-slate-200/60 dark:border-slate-700/60 select-none overflow-visible"
                >
                  <SortableHeader column="rialBalance" currentSort={sortState} onSort={handleSort} align="left">
                    مانده مالی ({baseCurrencySymbol})
                  </SortableHeader>
                  <ColumnResizer
                    colKey="rialBalance"
                    onResizeStart={handleResizeStart}
                    onReset={handleResetColumnWidth}
                    isResizing={resizingCol === 'rialBalance'}
                  />
                </th>
                <th
                  style={{ width: `${columnWidths.details}px` }}
                  className="p-2.5 text-center border-r border-slate-200/60 dark:border-slate-700/60"
                >
                  جزئیات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {paginatedRows.length ? (
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
                        <td className="p-2.5 text-center text-slate-400 font-mono text-[11px]">
                          {row.rowNumber}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {row.documentDateJalali || formatDate(row.transactionDate)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {row.documentNumber ? (
                            <Link
                              href={`/dashboard/documents/new?edit=${row.documentNumber}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1 inline-flex"
                              title="مشاهده و ویرایش سند"
                            >
                              {row.documentNumber}
                              <ExternalLink size={11} className="opacity-70" />
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="p-2.5">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              badgeStyles[row.breakdown.badgeColor] || badgeStyles.slate
                            }`}
                          >
                            {row.breakdown.categoryLabel}
                          </span>
                        </td>
                        <td
                          className="p-2.5 max-w-[200px] truncate text-slate-600 dark:text-slate-300"
                          title={row.description}
                        >
                          {row.description || '—'}
                        </td>
                        <td
                          className="p-2.5 text-left font-mono text-rose-600 dark:text-rose-400"
                          dir="ltr"
                        >
                          {row.goldDebtor > 0 ? formatWeight(row.goldDebtor) : '—'}
                        </td>
                        <td
                          className="p-2.5 text-left font-mono text-emerald-600 dark:text-emerald-400"
                          dir="ltr"
                        >
                          {row.goldCreditor > 0 ? formatWeight(row.goldCreditor) : '—'}
                        </td>
                        <td
                          className="p-2.5 text-left font-mono font-bold bg-amber-500/5"
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
                          className="p-2.5 text-left font-mono text-rose-600 dark:text-rose-400"
                          dir="ltr"
                        >
                          {row.rialDebtor > 0 ? formatMoney(row.rialDebtor) : '—'}
                        </td>
                        <td
                          className="p-2.5 text-left font-mono text-emerald-600 dark:text-emerald-400"
                          dir="ltr"
                        >
                          {row.rialCreditor > 0 ? formatMoney(row.rialCreditor) : '—'}
                        </td>
                        <td
                          className="p-2.5 text-left font-mono font-bold bg-emerald-500/5"
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
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(row.id);
                            }}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Accordion Line Breakdown */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-y border-amber-500/20">
                          <td colSpan={12} className="p-3 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                مشخصات تفکیکی قلم ({row.breakdown.categoryLabel})
                              </span>
                              {row.documentNumber && (
                                <Link
                                  href={`/dashboard/documents/new?edit=${row.documentNumber}`}
                                  className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1"
                                >
                                  سند کامل
                                  <ExternalLink size={12} />
                                </Link>
                              )}
                            </div>

                            {row.breakdown.attributes.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {row.breakdown.attributes.map((attr, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80"
                                  >
                                    <p className="text-[10px] text-slate-400">{attr.label}</p>
                                    <p
                                      className={`text-xs font-bold text-slate-800 dark:text-slate-100 ${
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
                                جزئیات بیشتری برای این ردیف ثبت نشده است.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-500">
                    هنوز تراکنشی متناسب با فیلترهای انتخابی یافت نشد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500">
            صفحه {safeCurrentPage} از {totalPages} ({filteredRows.length.toLocaleString('fa-IR')} تراکنش)
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage === 1}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
            <span className="px-2 font-mono font-bold text-amber-600">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage === totalPages}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function BalanceItem({
  label,
  formattedValue,
  value,
  unit,
}: {
  label: string;
  formattedValue: string;
  value: number;
  unit: string;
}) {
  return (
    <div
      className={`customer-transaction-balance-item ${
        value < 0 ? 'is-negative' : value > 0 ? 'is-positive' : ''
      }`}
    >
      <span>{label}</span>
      <strong>{formattedValue}</strong>
      <small>{unit}</small>
      <em>{balanceStatus(value)}</em>
    </div>
  );
}
