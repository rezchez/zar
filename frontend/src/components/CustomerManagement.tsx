'use client';

import { ChevronLeft, ChevronRight, Download, Eye, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { currencyDisplay, type Customer } from '@/lib/customer';
import { useAppSettings } from './SettingsProvider';
import CustomerPdfExportModal from './CustomerPdfExportModal';

type SortKey = 'customerCode' | 'name' | 'gender' | 'groupName' | 'city' | 'goldBalance' | 'rialBalance' | 'created';
const PER_PAGE_OPTIONS = [25, 50, 75, 100, 500];

const groupLabels: Record<string, string> = {
  customer: 'مشتری',
  supplier: 'تأمین‌کننده',
  buyer: 'خریدار',
  seller: 'فروشنده',
};

function balanceTone(value: number) {
  if (value < 0) return 'is-debit';
  if (value > 0) return 'is-credit';
  return 'is-zero';
}

function summaryCurrencyLabel(key: string) {
  const [code, symbol] = key.split('|');
  return currencyDisplay(code, symbol);
}

export default function CustomerManagement({ initialCustomers, canDelete }: { initialCustomers: Customer[]; canDelete: boolean }) {
  const { formatMoney, formatWeight, settings } = useAppSettings();
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('customerCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(initialCustomers.length);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const baseCurrencySymbol = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [privateNoteModal, setPrivateNoteModal] = useState<{ isOpen: boolean; title: string; note: string; loading: boolean }>({
    isOpen: false,
    title: '',
    note: '',
    loading: false,
  });

  async function openPrivateNote(customer: Customer) {
    setPrivateNoteModal({
      isOpen: true,
      title: customer.name,
      note: '',
      loading: true,
    });

    try {
      const res = await fetch(`/api/customers/${customer.id}/private-note`);
      const data = await res.json();
      if (res.ok && data.privateDescription) {
        setPrivateNoteModal({
          isOpen: true,
          title: customer.name,
          note: data.privateDescription,
          loading: false,
        });
      } else {
        setPrivateNoteModal({
          isOpen: true,
          title: customer.name,
          note: customer.privateDescription || 'توضیحات محرمانه ثبت نشده است.',
          loading: false,
        });
      }
    } catch {
      setPrivateNoteModal({
        isOpen: true,
        title: customer.name,
        note: customer.privateDescription || 'خطا در دریافت اطلاعات.',
        loading: false,
      });
    }
  }

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        q: query,
        group,
        sortKey,
        sortDirection,
      });
      const response = await fetch(`/api/customers?${params.toString()}`, { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as {
        customers?: Customer[];
        totalItems?: number;
        totalPages?: number;
      } | null;
      if (response.ok && data?.customers) {
        setCustomers(data.customers);
        setTotalItems(data.totalItems ?? data.customers.length);
        setTotalPages(data.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [group, page, perPage, query, sortDirection, sortKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  async function removeCustomer(customer: Customer) {
    if (!window.confirm(`آیا از حذف «${customer.name}» مطمئن هستید؟`)) return;
    const response = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
    if (response.ok) {
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setMessage('طرف‌حساب حذف شد.');
    }
  }

  const totals = useMemo(() => {
    return {
      gold: customers.reduce((sum, customer) => sum + customer.goldBalance, 0),
      silver: customers.reduce((sum, customer) => sum + customer.silverBalance, 0),
      platinum: customers.reduce((sum, customer) => sum + customer.platinumBalance, 0),
      rial: customers.reduce((sum, customer) => sum + customer.rialBalance, 0),
      foreign: customers.reduce<Record<string, number>>((result, customer) => {
        const key = `${customer.secondaryCurrency || 'other'}|${customer.secondaryCurrencySymbol || ''}`;
        result[key] = (result[key] ?? 0) + customer.foreignBalance;
        return result;
      }, {}),
      tertiary: customers.reduce<Record<string, number>>((result, customer) => {
        const key = `${customer.tertiaryCurrency || 'other'}|${customer.tertiaryCurrencySymbol || ''}`;
        result[key] = (result[key] ?? 0) + customer.tertiaryBalance;
        return result;
      }, {}),
    };
  }, [customers]);

  function changeSort(value: SortKey) {
    if (value === sortKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(value);
      setSortDirection('desc');
    }
  }

  function balanceLabel(value: number, unit: string, isCurrency = false) {
    if (value === 0) return 'بدون مانده';
    const absVal = Math.abs(value);
    const formatted = isCurrency ? formatMoney(absVal) : `${formatWeight(absVal)} ${unit}`;
    return `${formatted} ${value > 0 ? 'بدهی ما' : 'طلب ما'}`;
  }

  return (
    <div className="customer-management-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">اطلاعات پایه حسابداری</p>
          <h1>طرف‌حساب و مشتری</h1>
          <p>مشتریان، تأمین‌کنندگان و مانده حساب آن‌ها را مدیریت کنید.</p>
        </div>
        <Link className="account-save-button" href="/dashboard/customers/new"><Plus size={16} /> افزودن طرف‌حساب</Link>
      </div>

      {message ? <p className="account-message">{message}</p> : null}
      <section className="customer-balance-overview" aria-label="خلاصه مانده طرف‌حساب‌ها">
        <BalanceSummaryCard label="طلا" formattedValue={formatWeight(totals.gold)} value={totals.gold} unit="گرم" />
        <BalanceSummaryCard label="نقره" formattedValue={formatWeight(totals.silver)} value={totals.silver} unit="گرم" />
        <BalanceSummaryCard label="پلاتین" formattedValue={formatWeight(totals.platinum)} value={totals.platinum} unit="گرم" />
        <BalanceSummaryCard label="ارز پایه" formattedValue={formatMoney(totals.rial)} value={totals.rial} unit={baseCurrencySymbol} />
        {Object.entries(totals.foreign).map(([currency, value]) => (
          <BalanceSummaryCard key={`foreign-${currency}`} label={`ارز دوم: ${summaryCurrencyLabel(currency)}`} formattedValue={value.toLocaleString('fa-IR')} value={value} unit={summaryCurrencyLabel(currency)} />
        ))}
        {Object.entries(totals.tertiary).map(([currency, value]) => (
          <BalanceSummaryCard key={`tertiary-${currency}`} label={`ارز سوم: ${summaryCurrencyLabel(currency)}`} formattedValue={value.toLocaleString('fa-IR')} value={value} unit={summaryCurrencyLabel(currency)} />
        ))}
      </section>
      <section className="dashboard-panel users-table-panel space-y-4">
        <div className="users-toolbar customer-toolbar flex-wrap gap-3">
          <label className="users-search gooey-search min-w-[200px] flex-1"><Search size={16} /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="جست‌وجو با کد، نام، تلفن یا شهر..." /></label>
          <label className="users-sort"><SlidersHorizontal size={15} /><span>گروه</span><select value={group} onChange={(e) => { setGroup(e.target.value); setPage(1); }}><option value="">همه</option>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="users-sort"><span>مرتب‌سازی</span><select value={sortKey} onChange={(e) => changeSort(e.target.value as SortKey)}><option value="customerCode">کد</option><option value="name">نام</option><option value="gender">جنسیت</option><option value="groupName">گروه</option><option value="city">شهر</option><option value="goldBalance">مانده طلا</option><option value="rialBalance">مانده ریالی</option><option value="created">تاریخ ثبت</option></select><span>{sortDirection === 'asc' ? 'صعودی' : 'نزولی'}</span></label>
          <div className="customer-export-actions">
            <Link className="dashboard-secondary-button" href="/api/customers/export?format=xlsx"><Download size={15} /> Excel</Link>
            <button type="button" className="dashboard-secondary-button" onClick={() => setPdfModalOpen(true)}><Download size={15} /> PDF</button>
            <button type="button" className="dashboard-secondary-button" onClick={() => void fetchCustomers()} disabled={loading}><RefreshCw size={15} /> تازه‌سازی</button>
          </div>
        </div>

        {/* Top Pagination Control */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          perPage={perPage}
          totalItems={totalItems}
          currentCount={customers.length}
          onPageChange={setPage}
          onPerPageChange={(val) => { setPerPage(val); setPage(1); }}
        />

        <div className="users-table-wrap overflow-x-auto">
          <table className="users-table customers-table w-full text-xs">
            <thead>
              <tr>
                <th className="w-16">کد</th>
                <th className="min-w-[180px]">طرف‌حساب</th>
                <th className="w-16">جنسیت</th>
                <th className="w-24">گروه</th>
                <th className="w-24">شهر</th>
                <th className="w-28 text-left">طلا</th>
                <th className="w-28 text-left">نقره</th>
                <th className="w-28 text-left">پلاتین</th>
                <th className="w-32 text-left">{baseCurrencySymbol}</th>
                <th className="w-28 text-left">ارز دوم</th>
                <th className="w-28 text-left">ارز سوم</th>
                <th className="w-24 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {customers.length ? customers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.customerCode}</strong></td>
                  <td>
                    <div className="managed-user-cell max-w-[220px]">
                      <span className="managed-user-avatar shrink-0">{customer.name.charAt(0)}</span>
                      <div className="truncate min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <strong className="truncate" title={customer.name}>{customer.name}</strong>
                          {customer.englishName ? <span className="text-[10px] text-slate-400 font-mono truncate">({customer.englishName})</span> : null}
                          {(customer.hasPrivateDescription || Boolean(customer.privateDescription)) ? (
                            <button
                              type="button"
                              onClick={() => void openPrivateNote(customer)}
                              className="text-amber-500 hover:text-amber-600 transition-colors p-0.5 rounded focus:outline-none shrink-0"
                              title="مشاهده توضیحات محرمانه"
                            >
                              <Eye size={15} />
                            </button>
                          ) : null}
                        </div>
                        <small className="truncate block text-slate-400" title={customer.phone1 || customer.email}>{customer.phone1 || customer.email || 'بدون تماس'}</small>
                      </div>
                    </div>
                  </td>
                  <td>{customer.gender === 'male' ? 'آقا' : customer.gender === 'female' ? 'خانم' : '—'}</td>
                  <td><span className="truncate block max-w-[90px]" title={groupLabels[customer.groupName] ?? customer.groupName ?? '—'}>{groupLabels[customer.groupName] ?? customer.groupName ?? '—'}</span></td>
                  <td><span className="truncate block max-w-[90px]" title={customer.city || '—'}>{customer.city || '—'}</span></td>
                  <td className="text-left"><BalanceCell labelStr={balanceLabel(customer.goldBalance, 'گرم')} toneValue={customer.goldBalance} /></td>
                  <td className="text-left"><BalanceCell labelStr={balanceLabel(customer.silverBalance, 'گرم')} toneValue={customer.silverBalance} /></td>
                  <td className="text-left"><BalanceCell labelStr={balanceLabel(customer.platinumBalance, 'گرم')} toneValue={customer.platinumBalance} /></td>
                  <td className="text-left"><BalanceCell labelStr={balanceLabel(customer.rialBalance, baseCurrencySymbol, true)} toneValue={customer.rialBalance} /></td>
                  <td className="text-left"><BalanceCell labelStr={balanceLabel(customer.foreignBalance, currencyDisplay(customer.secondaryCurrency, customer.secondaryCurrencySymbol))} toneValue={customer.foreignBalance} /></td>
                  <td className="text-left"><BalanceCell labelStr={balanceLabel(customer.tertiaryBalance, currencyDisplay(customer.tertiaryCurrency, customer.tertiaryCurrencySymbol))} toneValue={customer.tertiaryBalance} /></td>
                  <td><div className="user-actions justify-center"><Link className="user-events-button" href={`/dashboard/customers/${customer.id}`}>ویرایش</Link>{canDelete ? <button type="button" className="user-reset-button" title="حذف" onClick={() => void removeCustomer(customer)}><Trash2 size={15} /></button> : null}</div></td>
                </tr>
              )) : <tr><td colSpan={12} className="users-table-empty">طرف‌حسابی پیدا نشد.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Control */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          perPage={perPage}
          totalItems={totalItems}
          currentCount={customers.length}
          onPageChange={setPage}
          onPerPageChange={(val) => { setPerPage(val); setPage(1); }}
        />
      </section>

      <CustomerPdfExportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        visibleCustomers={customers}
      />

      {privateNoteModal.isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setPrivateNoteModal((prev) => ({ ...prev, isOpen: false }))}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400 font-extrabold text-base">
              <Eye size={20} />
              <span>توضیحات محرمانه: {privateNoteModal.title}</span>
            </div>
            {privateNoteModal.loading ? (
              <p className="text-sm text-slate-500 py-4">در حال دریافت توضیحات...</p>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {privateNoteModal.note}
              </div>
            )}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPrivateNoteModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BalanceCell({ labelStr, toneValue }: { labelStr: string; toneValue: number }) {
  return (
    <span className={`customer-balance-cell ${balanceTone(toneValue)}`}>
      {labelStr}
    </span>
  );
}

function BalanceSummaryCard({ label, formattedValue, value, unit }: { label: string; formattedValue: string; value: number; unit: string }) {
  return (
    <article className={`customer-balance-summary ${balanceTone(value)}`}>
      <span>{label}</span>
      <strong>{value === 0 ? '۰' : formattedValue}</strong>
      <small>{value === 0 ? 'بدون مانده' : value > 0 ? `بدهی ما به طرف‌حساب · ${unit}` : `طلب ما از طرف‌حساب · ${unit}`}</small>
    </article>
  );
}

function PaginationBar({
  page,
  totalPages,
  perPage,
  totalItems,
  currentCount,
  onPageChange,
  onPerPageChange,
}: {
  page: number;
  totalPages: number;
  perPage: number;
  totalItems: number;
  currentCount: number;
  onPageChange: (newPage: number) => void;
  onPerPageChange: (newPerPage: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
          <span>تعداد در صفحه:</span>
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-extrabold text-amber-600 dark:text-amber-400 focus:outline-none"
          >
            {PER_PAGE_OPTIONS.map((val) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        </label>

        <span className="text-slate-500">
          نمایش <strong className="text-slate-800 dark:text-slate-200">{currentCount}</strong> از <strong className="text-slate-800 dark:text-slate-200">{totalItems}</strong> طرف‌حساب
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-bold"
          title="صفحه اول"
        >
          اولین
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="صفحه قبل"
        >
          <ChevronRight size={16} />
        </button>

        <span className="px-2.5 font-bold text-slate-700 dark:text-slate-300">
          صفحه {page} از {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="صفحه بعد"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-bold"
          title="صفحه آخر"
        >
          آخرین
        </button>
      </div>
    </div>
  );
}
