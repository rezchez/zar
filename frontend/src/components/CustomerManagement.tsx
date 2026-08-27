'use client';

import { Download, Eye, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Layers } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { currencyDisplay, type Customer } from '@/lib/customer';
import { useAppSettings } from './SettingsProvider';
import CustomerPdfExportModal from './CustomerPdfExportModal';

type SortKey = 'customerCode' | 'name' | 'gender' | 'groupName' | 'city' | 'goldBalance' | 'rialBalance' | 'created';

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
  const [totalItems, setTotalItems] = useState(initialCustomers.length);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [group, setGroup] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('customerCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(handler);
  }, [query]);

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

  async function reload() {
    setLoading(true);
    try {
      const response = await fetch('/api/customers', { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as { customers?: Customer[] } | null;
      if (response.ok) setCustomers(data?.customers ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function removeCustomer(customer: Customer) {
    if (!window.confirm(`آیا از حذف «${customer.name}» مطمئن هستید؟`)) return;
    const response = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
    if (response.ok) {
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setMessage('طرف‌حساب حذف شد.');
    }
  }


  const visibleCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      let valA: any = a[sortKey];
      let valB: any = b[sortKey];

      if (sortKey === 'goldBalance' || sortKey === 'rialBalance' || sortKey === 'customerCode') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customers, sortDirection, sortKey]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, group, perPage]);

  useEffect(() => {
    let active = true;
    async function fetchCustomers() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          perPage: String(perPage),
          q: debouncedQuery,
          group: group,
        });
        const res = await fetch(`/api/customers?${params.toString()}`);
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
          setTotalItems(data.totalItems || data.customers?.length || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchCustomers();
    return () => { active = false; };
  }, [page, perPage, debouncedQuery, group]);


  const totals = useMemo(() => {
    return {
      gold: visibleCustomers.reduce((sum, customer) => sum + customer.goldBalance, 0),
      silver: visibleCustomers.reduce((sum, customer) => sum + customer.silverBalance, 0),
      platinum: visibleCustomers.reduce((sum, customer) => sum + customer.platinumBalance, 0),
      rial: visibleCustomers.reduce((sum, customer) => sum + customer.rialBalance, 0),
      foreign: visibleCustomers.reduce<Record<string, number>>((result, customer) => {
        const key = `${customer.secondaryCurrency || 'other'}|${customer.secondaryCurrencySymbol || ''}`;
        result[key] = (result[key] ?? 0) + customer.foreignBalance;
        return result;
      }, {}),
      tertiary: visibleCustomers.reduce<Record<string, number>>((result, customer) => {
        const key = `${customer.tertiaryCurrency || 'other'}|${customer.tertiaryCurrencySymbol || ''}`;
        result[key] = (result[key] ?? 0) + customer.tertiaryBalance;
        return result;
      }, {}),
    };
  }, [visibleCustomers]);

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
      <section className="dashboard-panel users-table-panel">
        <div className="users-toolbar customer-toolbar">

          <label className="users-search gooey-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجو با کد، نام، تلفن یا شهر..." /></label>
          <div className="activity-toolbar-selectors flex gap-2">
            <label className="users-sort"><SlidersHorizontal size={15} /><span>گروه</span><select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">همه</option>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="users-sort"><span>مرتب‌سازی</span><select value={sortKey} onChange={(e) => changeSort(e.target.value as SortKey)}><option value="customerCode">کد</option><option value="name">نام</option><option value="gender">جنسیت</option><option value="groupName">گروه</option><option value="city">شهر</option><option value="goldBalance">مانده طلا</option><option value="rialBalance">مانده ریالی</option><option value="created">تاریخ ثبت</option></select><span>{sortDirection === 'asc' ? 'صعودی' : 'نزولی'}</span></label>
            <label className="users-sort per-page-selector">
              <Layers size={15} />
              <span>تعداد</span>
              <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={75}>75</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
            </label>
          </div>

          <div className="customer-export-actions">
            <Link className="dashboard-secondary-button" href="/api/customers/export?format=xlsx"><Download size={15} /> Excel</Link>
            <button type="button" className="dashboard-secondary-button" onClick={() => setPdfModalOpen(true)}><Download size={15} /> PDF</button>
            <button type="button" className="dashboard-secondary-button" onClick={() => void reload()} disabled={loading}><RefreshCw size={15} /> تازه‌سازی</button>
          </div>
        </div>

        <CustomerPaginationControls page={page} totalPages={totalPages} totalItems={totalItems} perPage={perPage} loading={loading} onPageChange={setPage} position="top" />
        <div className="users-table-wrap">
          <table className="users-table customers-table">

            <thead><tr><th>کد</th><th>طرف‌حساب</th><th>جنسیت</th><th>گروه</th><th>شهر</th><th>طلا</th><th>نقره</th><th>پلاتین</th><th>{baseCurrencySymbol}</th><th>ارز دوم</th><th>ارز سوم</th><th>عملیات</th></tr></thead>
            <tbody>
              {visibleCustomers.length ? visibleCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.customerCode}</strong></td>
                  <td>
                    <div className="managed-user-cell">
                      <span className="managed-user-avatar">{customer.name.charAt(0)}</span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="max-w-[150px] truncate inline-block" title={customer.name}>{customer.name}</strong>
                          {(customer.hasPrivateDescription || Boolean(customer.privateDescription)) ? (
                            <button
                              type="button"
                              onClick={() => void openPrivateNote(customer)}
                              className="text-amber-500 hover:text-amber-600 transition-colors p-0.5 rounded focus:outline-none"
                              title="مشاهده توضیحات محرمانه"
                            >
                              <Eye size={15} />
                            </button>
                          ) : null}
                        </div>
                        <small className="max-w-[150px] truncate inline-block" title={customer.phone1 || customer.email || 'بدون اطلاعات تماس'}>{customer.phone1 || customer.email || 'بدون اطلاعات تماس'}</small>
                      </div>
                    </div>
                  </td>
                  <td>{customer.gender === 'male' ? 'آقا' : customer.gender === 'female' ? 'خانم' : '—'}</td>
                  <td>{groupLabels[customer.groupName] ?? customer.groupName ?? '—'}</td>
                  <td>{customer.city || '—'}</td>
                  <td><BalanceCell labelStr={balanceLabel(customer.goldBalance, 'گرم')} toneValue={customer.goldBalance} /></td>
                  <td><BalanceCell labelStr={balanceLabel(customer.silverBalance, 'گرم')} toneValue={customer.silverBalance} /></td>
                  <td><BalanceCell labelStr={balanceLabel(customer.platinumBalance, 'گرم')} toneValue={customer.platinumBalance} /></td>
                  <td><BalanceCell labelStr={balanceLabel(customer.rialBalance, baseCurrencySymbol, true)} toneValue={customer.rialBalance} /></td>
                  <td><BalanceCell labelStr={balanceLabel(customer.foreignBalance, currencyDisplay(customer.secondaryCurrency, customer.secondaryCurrencySymbol))} toneValue={customer.foreignBalance} /></td>
                  <td><BalanceCell labelStr={balanceLabel(customer.tertiaryBalance, currencyDisplay(customer.tertiaryCurrency, customer.tertiaryCurrencySymbol))} toneValue={customer.tertiaryBalance} /></td>
                  <td><div className="user-actions"><Link className="user-events-button" href={`/dashboard/customers/${customer.id}`}>ویرایش</Link>{canDelete ? <button type="button" className="user-reset-button" title="حذف" onClick={() => void removeCustomer(customer)}><Trash2 size={15} /></button> : null}</div></td>
                </tr>
              )) : <tr><td colSpan={12} className="users-table-empty">طرف‌حسابی پیدا نشد.</td></tr>}
            </tbody>

          </table>
        </div>
        <CustomerPaginationControls page={page} totalPages={totalPages} totalItems={totalItems} perPage={perPage} loading={loading} onPageChange={setPage} position="bottom" />

      </section>

      <CustomerPdfExportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        visibleCustomers={visibleCustomers}
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


function CustomerPaginationControls({
  page,
  totalPages,
  totalItems,
  perPage,
  loading,
  onPageChange,
  position,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  loading: boolean;
  onPageChange: (newPage: number) => void;
  position: 'top' | 'bottom';
}) {
  const startItem = totalItems === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalItems);

  function getPageNumbers(current: number, total: number) {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, '...', total];
    if (current >= total - 2) return [1, '...', total - 3, total - 2, total - 1, total];
    return [1, '...', current - 1, current, current + 1, '...', total];
  }
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className={`activity-pagination-bar ${position}`}>
      <div className="activity-pagination-info">
        <span>
          نمایش <strong>{startItem}</strong> تا <strong>{endItem}</strong> از <strong>{totalItems}</strong> طرف‌حساب
        </span>
        <span className="activity-pagination-page-badge">
          صفحه {page} از {totalPages}
        </span>
      </div>

      <div className="activity-pagination-buttons">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(1)}
          disabled={loading || page <= 1}
          title="صفحه نخست"
        >
          <ChevronsRight size={16} />
        </button>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={loading || page <= 1}
          title="صفحه قبلی"
        >
          <ChevronRight size={16} />
        </button>

        <div className="pagination-numbers">
          {pageNumbers.map((p, idx) => (
            p === '...' ? (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
            ) : (
              <button
                key={`page-${p}`}
                type="button"
                className={`pagination-num-btn ${p === page ? 'active' : ''}`}
                onClick={() => onPageChange(p as number)}
                disabled={loading}
              >
                {p}
              </button>
            )
          ))}
        </div>

        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={loading || page >= totalPages}
          title="صفحه بعدی"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(totalPages)}
          disabled={loading || page >= totalPages}
          title="صفحه پایانی"
        >
          <ChevronsLeft size={16} />
        </button>
      </div>
    </div>
  );
}
