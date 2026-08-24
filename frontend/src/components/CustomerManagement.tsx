'use client';

import { Download, Plus, RefreshCw, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

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
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('customerCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const baseCurrencySymbol = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const [pdfModalOpen, setPdfModalOpen] = useState(false);

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
    const normalized = query.trim().toLocaleLowerCase();
    return customers
      .filter((customer) =>
        (!group || customer.groupName === group)
        && `${customer.customerCode} ${customer.name} ${customer.email} ${customer.phone1} ${customer.city} ${customer.category}`
          .toLocaleLowerCase()
          .includes(normalized))
      .sort((left, right) => {
        const a = left[sortKey];
        const b = right[sortKey];
        const comparison = typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a ?? '').localeCompare(String(b ?? ''), 'fa');
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [customers, group, query, sortDirection, sortKey]);

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
        <div className="users-table-wrap">
          <table className="users-table customers-table">
            <thead><tr><th>کد</th><th>طرف‌حساب</th><th>جنسیت</th><th>گروه</th><th>شهر</th><th>طلا</th><th>نقره</th><th>پلاتین</th><th>{baseCurrencySymbol}</th><th>ارز دوم</th><th>ارز سوم</th><th>عملیات</th></tr></thead>
            <tbody>
              {visibleCustomers.length ? visibleCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.customerCode}</strong></td>
                  <td><div className="managed-user-cell"><span className="managed-user-avatar">{customer.name.charAt(0)}</span><div><strong>{customer.name}</strong><small>{customer.phone1 || customer.email || 'بدون اطلاعات تماس'}</small></div></div></td>
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
      </section>

      <CustomerPdfExportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        visibleCustomers={visibleCustomers}
      />
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
