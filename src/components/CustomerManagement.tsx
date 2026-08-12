'use client';

import { Download, Plus, RefreshCw, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { Customer } from '@/lib/customer';

type SortKey = 'customerCode' | 'name' | 'groupName' | 'city' | 'goldBalance' | 'rialBalance' | 'created';

const groupLabels: Record<string, string> = {
  customer: 'مشتری',
  supplier: 'تأمین‌کننده',
  buyer: 'خریدار',
  seller: 'فروشنده',
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 4 }).format(value);
}

export default function CustomerManagement({ initialCustomers, canDelete }: { initialCustomers: Customer[]; canDelete: boolean }) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('customerCode');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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

  function changeSort(value: SortKey) {
    if (value === sortKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(value);
      setSortDirection('desc');
    }
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
      <section className="dashboard-panel users-table-panel">
        <div className="users-toolbar customer-toolbar">
          <label className="users-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجو با کد، نام، تلفن یا شهر..." /></label>
          <label className="users-sort"><SlidersHorizontal size={15} /><span>گروه</span><select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">همه</option>{Object.entries(groupLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="users-sort"><span>مرتب‌سازی</span><select value={sortKey} onChange={(e) => changeSort(e.target.value as SortKey)}><option value="customerCode">کد</option><option value="name">نام</option><option value="groupName">گروه</option><option value="city">شهر</option><option value="goldBalance">مانده طلا</option><option value="rialBalance">مانده ریالی</option><option value="created">تاریخ ثبت</option></select><span>{sortDirection === 'asc' ? 'صعودی' : 'نزولی'}</span></label>
          <div className="customer-export-actions">
            <Link className="dashboard-secondary-button" href="/api/customers/export?format=xlsx"><Download size={15} /> Excel</Link>
            <Link className="dashboard-secondary-button" href="/api/customers/export?format=pdf"><Download size={15} /> PDF</Link>
            <button type="button" className="dashboard-secondary-button" onClick={() => void reload()} disabled={loading}><RefreshCw size={15} /> تازه‌سازی</button>
          </div>
        </div>
        <div className="users-table-wrap">
          <table className="users-table customers-table">
            <thead><tr><th>کد</th><th>طرف‌حساب</th><th>گروه</th><th>شهر</th><th>طلا</th><th>نقره</th><th>پلاتین</th><th>ریال</th><th>عملیات</th></tr></thead>
            <tbody>
              {visibleCustomers.length ? visibleCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td><strong>{customer.customerCode}</strong></td>
                  <td><div className="managed-user-cell"><span className="managed-user-avatar">{customer.name.charAt(0)}</span><div><strong>{customer.name}</strong><small>{customer.phone1 || customer.email || 'بدون اطلاعات تماس'}</small></div></div></td>
                  <td>{groupLabels[customer.groupName] ?? customer.groupName ?? '—'}</td>
                  <td>{customer.city || '—'}</td>
                  <td>{formatNumber(customer.goldBalance)}</td>
                  <td>{formatNumber(customer.silverBalance)}</td>
                  <td>{formatNumber(customer.platinumBalance)}</td>
                  <td>{formatNumber(customer.rialBalance)}</td>
                  <td><div className="user-actions"><Link className="user-events-button" href={`/dashboard/customers/${customer.id}`}>ویرایش</Link>{canDelete ? <button type="button" className="user-reset-button" title="حذف" onClick={() => void removeCustomer(customer)}><Trash2 size={15} /></button> : null}</div></td>
                </tr>
              )) : <tr><td colSpan={9} className="users-table-empty">طرف‌حسابی پیدا نشد.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
