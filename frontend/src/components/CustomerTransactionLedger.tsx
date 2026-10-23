'use client';

import React, { useMemo, useState } from 'react';
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

    // Default to show latest on top in the customer view, but preserve the calculated running balance
    return mapped.reverse();
  }, [transactions]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return enrichedRows.filter((row) => {
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
  }, [enrichedRows, activeCategory, searchQuery]);

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
          <table className="w-full text-xs text-right whitespace-nowrap">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-bold">
              <tr>
                <th className="p-2.5 w-8 text-center">#</th>
                <th className="p-2.5">تاریخ</th>
                <th className="p-2.5">شماره سند</th>
                <th className="p-2.5">نوع و قلم</th>
                <th className="p-2.5 min-w-[160px]">شرح و جزئیات</th>
                <th className="p-2.5 text-left">بدهکار طلا (g)</th>
                <th className="p-2.5 text-left">بستانکار طلا (g)</th>
                <th className="p-2.5 text-left bg-amber-500/5">مانده طلا (g)</th>
                <th className="p-2.5 text-left">بدهکار مالی</th>
                <th className="p-2.5 text-left">بستانکار مالی</th>
                <th className="p-2.5 text-left bg-emerald-500/5">مانده مالی ({baseCurrencySymbol})</th>
                <th className="p-2.5 text-center">جزئیات</th>
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
