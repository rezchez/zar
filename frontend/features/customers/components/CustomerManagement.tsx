'use client';

import { ChevronLeft, ChevronRight, Download, Eye, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
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

type CustomerPageMeta = { page: number; perPage: number; totalItems: number; totalPages: number };

export default function CustomerManagement({ initialCustomers, initialMeta, canDelete }: { initialCustomers: Customer[]; initialMeta: CustomerPageMeta; canDelete: boolean }) {
  const { formatMoney, formatWeight, settings } = useAppSettings();
  const [customers, setCustomers] = useState(initialCustomers);
  const [meta, setMeta] = useState(initialMeta);
  const [page, setPage] = useState(initialMeta.page);
  const [perPage, setPerPage] = useState(initialMeta.perPage || 25);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('customerCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
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

  async function reload(nextPage = page, nextPerPage = perPage) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), perPage: String(nextPerPage), search: query, group, sort: sortDirection === 'asc' ? sortKey : `-${sortKey}` });
      const response = await fetch(`/api/customers?${params}`, { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as { customers?: Customer[]; page?: number; perPage?: number; totalItems?: number; totalPages?: number } | null;
      if (response.ok) {
        setCustomers(data?.customers ?? []);
        setMeta({ page: data?.page ?? nextPage, perPage: data?.perPage ?? nextPerPage, totalItems: data?.totalItems ?? 0, totalPages: data?.totalPages ?? 1 });
        setPage(data?.page ?? nextPage);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(1, perPage); }, 250);
    return () => window.clearTimeout(timer);
  }, [query, group, sortKey, sortDirection, perPage]);

  async function removeCustomer(customer: Customer) {
    if (!window.confirm(`آیا از حذف «${customer.name}» مطمئن هستید؟`)) return;
    const response = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
    if (response.ok) {
      setCustomers((current) => current.filter((item) => item.id !== customer.id));
      setMessage('طرف‌حساب حذف شد.');
    }
  }

  const visibleCustomers = customers;

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
          <label className="users-sort"><SlidersHorizontal size={15} /><span>گروه</span><select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">همه</option>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="users-sort"><span>مرتب‌سازی</span><select value={sortKey} onChange={(e) => changeSort(e.target.value as SortKey)}><option value="customerCode">کد</option><option value="name">نام</option><option value="gender">جنسیت</option><option value="groupName">گروه</option><option value="city">شهر</option><option value="goldBalance">مانده طلا</option><option value="rialBalance">مانده ریالی</option><option value="created">تاریخ ثبت</option></select><span>{sortDirection === 'asc' ? 'صعودی' : 'نزولی'}</span></label>
          <div className="customer-export-actions">
            <Link className="dashboard-secondary-button" href="/api/customers/export?format=xlsx"><Download size={15} /> Excel</Link>
            <button type="button" className="dashboard-secondary-button" onClick={() => setPdfModalOpen(true)}><Download size={15} /> PDF</button>
            <button type="button" className="dashboard-secondary-button" onClick={() => void reload()} disabled={loading}><RefreshCw size={15} /> تازه‌سازی</button>
          </div>
        </div>
        <Pagination page={page} totalPages={meta.totalPages} totalItems={meta.totalItems} perPage={perPage} loading={loading} onPage={(next) => void reload(next, perPage)} onPerPage={(next) => { setPerPage(next); setPage(1); }} />
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
                        <strong>{customer.name}</strong>
                        <button
                          type="button"
                          onClick={() => void openPrivateNote(customer)}
                          className={`text-amber-500 hover:text-amber-600 transition-colors p-0.5 rounded focus:outline-none ${(customer.hasPrivateDescription || Boolean(customer.privateDescription)) ? '' : 'invisible pointer-events-none'}`}
                          title="مشاهده توضیحات محرمانه"
                          aria-hidden={!(customer.hasPrivateDescription || Boolean(customer.privateDescription))}
                          tabIndex={(customer.hasPrivateDescription || Boolean(customer.privateDescription)) ? 0 : -1}
                        >
                          <Eye size={15} />
                        </button>
                        <small>{customer.phone1 || customer.email || 'بدون اطلاعات تماس'}</small>
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
        <Pagination page={page} totalPages={meta.totalPages} totalItems={meta.totalItems} perPage={perPage} loading={loading} onPage={(next) => void reload(next, perPage)} onPerPage={(next) => { setPerPage(next); setPage(1); }} />
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

function Pagination({ page, totalPages, totalItems, perPage, loading, onPage, onPerPage }: { page: number; totalPages: number; totalItems: number; perPage: number; loading: boolean; onPage: (page: number) => void; onPerPage: (value: number) => void }) {
  const first = totalItems ? (page - 1) * perPage + 1 : 0;
  const last = Math.min(page * perPage, totalItems);
  const safeTotalPages = Math.max(totalPages, 1);
  const pages = Array.from({ length: Math.min(safeTotalPages, 5) }, (_, index) => {
    if (safeTotalPages <= 5) return index + 1;
    if (page <= 3) return index + 1;
    if (page >= safeTotalPages - 2) return safeTotalPages - 4 + index;
    return page - 2 + index;
  });
  const showLeftEllipsis = safeTotalPages > 5 && page > 3;
  const showRightEllipsis = safeTotalPages > 5 && page < safeTotalPages - 2;

  return <nav className="customer-pagination customer-pagination-visible" dir="rtl" aria-label="صفحه‌بندی طرف‌حساب‌ها">
    <span className="customer-pagination-count">نمایش {first} تا {last} از {totalItems} طرف‌حساب</span>
    <span className="customer-pagination-divider" aria-hidden="true" />
    <div className="customer-pagination-pages" aria-label="صفحه‌بندی">
      <button type="button" onClick={() => onPage(1)} disabled={loading || page <= 1}>اولین</button>
      <button type="button" aria-label="صفحه قبل" onClick={() => onPage(page - 1)} disabled={loading || page <= 1}><ChevronRight size={16} /></button>
      {showLeftEllipsis ? <span className="customer-pagination-ellipsis">…</span> : null}
      {pages.map((pageNumber) => (
        <button type="button" key={pageNumber} className={pageNumber === page ? 'is-current' : ''} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => onPage(pageNumber)} disabled={loading || pageNumber === page}>{pageNumber}</button>
      ))}
      {showRightEllipsis ? <span className="customer-pagination-ellipsis">…</span> : null}
      <button type="button" aria-label="صفحه بعد" onClick={() => onPage(page + 1)} disabled={loading || page >= safeTotalPages}><ChevronLeft size={16} /></button>
      <button type="button" onClick={() => onPage(safeTotalPages)} disabled={loading || page >= safeTotalPages}>آخرین</button>
    </div>
    <span className="customer-pagination-divider" aria-hidden="true" />
    <span className="customer-pagination-current">صفحه {page} از {safeTotalPages}</span>
    <label className="customer-pagination-size">تعداد در صفحه
      <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))} disabled={loading}>
        {[25, 50, 75, 100, 500].map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
  </nav>;
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
