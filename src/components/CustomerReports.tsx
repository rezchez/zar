'use client';

import { FileSearch, LoaderCircle, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Customer } from '@/lib/customer';
import type { CustomerTransaction } from '@/lib/transaction';
import CustomerTransactionLedger from '@/src/components/CustomerTransactionLedger';

export default function CustomerReports({
  customers,
}: {
  customers: Customer[];
}) {
  const [selectedId, setSelectedId] = useState(customers[0]?.id ?? '');
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!selectedId) {
        setTransactions([]);
        setMessage('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setMessage('');

      fetch(`/api/customers/${selectedId}/transactions`, { cache: 'no-store' })
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as
            | { transactions?: CustomerTransaction[]; message?: string }
            | null;
          if (cancelled) return;
          if (!response.ok) {
            setMessage(data?.message ?? 'دریافت ریز تراکنش‌ها انجام نشد.');
            setTransactions([]);
            return;
          }
          setTransactions(data?.transactions ?? []);
        })
        .catch(() => {
          if (!cancelled) {
            setMessage('ارتباط با سرور برقرار نشد.');
            setTransactions([]);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selectedId]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedId);

  return (
    <div className="customer-reports-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">گزارشات حسابداری</p>
          <h1>ریز تراکنش طرف‌حساب</h1>
          <p>نام طرف‌حساب را انتخاب کنید تا دفتر و مانده جاری آن نمایش داده شود.</p>
        </div>
        <span className="dashboard-status-pill">
          <FileSearch size={15} />
          گزارش پایه
        </span>
      </div>

      <section className="dashboard-panel customer-report-selector">
        <div className="account-panel-heading">
          <div>
            <p className="eyebrow">انتخاب حساب</p>
            <h2>طرف‌حساب موردنظر</h2>
          </div>
        </div>
        <label className="users-search gooey-search customer-report-search">
          <Search size={16} />
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            aria-label="انتخاب طرف‌حساب"
          >
            <option value="">انتخاب طرف‌حساب</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.customerCode} — {customer.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {message ? <p className="form-error">{message}</p> : null}
      {loading ? (
        <div className="dashboard-panel report-loading">
          <LoaderCircle size={20} className="spin" />
          در حال دریافت ریز تراکنش‌ها...
        </div>
      ) : selectedCustomer ? (
        <CustomerTransactionLedger
          key={selectedCustomer.id}
          customerId={selectedCustomer.id}
          initialTransactions={transactions}
        />
      ) : (
        <div className="dashboard-panel report-empty">
          ابتدا یک طرف‌حساب را انتخاب کنید.
        </div>
      )}
    </div>
  );
}
