'use client';

import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { currencyDisplay } from '@/lib/customer';
import {
  type CustomerTransaction,
  sumPostedTransactions,
} from '@/lib/transaction';
import { useAppSettings } from './SettingsProvider';

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

function firstCurrency(
  transactions: CustomerTransaction[],
  field: 'foreignCurrency' | 'tertiaryCurrency',
) {
  return transactions.find((transaction) => transaction[field])?.[field] ?? '';
}

function firstCurrencySymbol(
  transactions: CustomerTransaction[],
  field: 'foreignCurrencySymbol' | 'tertiaryCurrencySymbol',
) {
  return transactions.find((transaction) => transaction[field])?.[field] ?? '';
}

export default function CustomerTransactionLedger({
  customerId,
  initialTransactions,
}: {
  customerId: string;
  initialTransactions: CustomerTransaction[];
}) {
  const { formatMoney, formatWeight, settings } = useAppSettings();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

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
  const foreignCurrency = firstCurrency(transactions, 'foreignCurrency');
  const foreignCurrencySymbol = firstCurrencySymbol(
    transactions,
    'foreignCurrencySymbol',
  );
  const tertiaryCurrency = firstCurrency(transactions, 'tertiaryCurrency');
  const tertiaryCurrencySymbol = firstCurrencySymbol(
    transactions,
    'tertiaryCurrencySymbol',
  );

  function signedAmount(value: number, unit: string, isCurrency = false) {
    if (value === 0) return '';
    const sign = value > 0 ? '+' : '';
    const formatted = isCurrency ? formatMoney(value) : `${formatWeight(value)} ${unit}`;
    return `${sign}${formatted}`;
  }

  function renderAmounts(transaction: CustomerTransaction) {
    const rows = [
      signedAmount(transaction.goldAmount, 'گرم طلا'),
      signedAmount(transaction.silverAmount, 'گرم نقره'),
      signedAmount(transaction.platinumAmount, 'گرم پلاتین'),
      signedAmount(transaction.rialAmount, baseCurrencySymbol, true),
      signedAmount(
        transaction.foreignAmount,
        currencyDisplay(transaction.foreignCurrency, transaction.foreignCurrencySymbol),
      ),
      signedAmount(
        transaction.tertiaryAmount,
        currencyDisplay(transaction.tertiaryCurrency, transaction.tertiaryCurrencySymbol),
      ),
    ].filter(Boolean);

    return rows.length
      ? rows.map((row) => <span key={row}>{row}</span>)
      : <span>بدون مبلغ</span>;
  }

  return (
    <section className="dashboard-panel customer-transactions-panel">
      <div className="account-panel-heading">
        <div>
          <p className="eyebrow">دفتر طرف‌حساب</p>
          <h2>تراکنش‌ها و مانده جاری</h2>
        </div>
        <button
          type="button"
          className="dashboard-secondary-button"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          به‌روزرسانی
        </button>
      </div>

      {message ? <p className="form-error">{message}</p> : null}

      <div className="customer-transaction-balance-grid">
        <BalanceItem label="طلا" formattedValue={formatWeight(balances.goldAmount)} value={balances.goldAmount} unit="گرم" />
        <BalanceItem label="نقره" formattedValue={formatWeight(balances.silverAmount)} value={balances.silverAmount} unit="گرم" />
        <BalanceItem label="پلاتین" formattedValue={formatWeight(balances.platinumAmount)} value={balances.platinumAmount} unit="گرم" />
        <BalanceItem label="ارز پایه" formattedValue={formatMoney(balances.rialAmount)} value={balances.rialAmount} unit={baseCurrencySymbol} />
        <BalanceItem
          label="ارز دوم"
          formattedValue={balances.foreignAmount.toLocaleString('fa-IR')}
          value={balances.foreignAmount}
          unit={foreignCurrency
            ? currencyDisplay(foreignCurrency, foreignCurrencySymbol)
            : 'واحد'}
        />
        <BalanceItem
          label="ارز سوم"
          formattedValue={balances.tertiaryAmount.toLocaleString('fa-IR')}
          value={balances.tertiaryAmount}
          unit={tertiaryCurrency
            ? currencyDisplay(tertiaryCurrency, tertiaryCurrencySymbol)
            : 'واحد'}
        />
      </div>

      <div className="users-table-wrap">
        <table className="users-table customer-transactions-table">
          <thead>
            <tr>
              <th>تاریخ</th>
              <th>نوع</th>
              <th>شماره سند</th>
              <th>شرح</th>
              <th>مبالغ</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length ? transactions.map((transaction) => (
              <tr key={transaction.id}>
                <td>{formatDate(transaction.transactionDate)}</td>
                <td>{transactionLabels[transaction.transactionType] ?? 'تراکنش'}</td>
                <td>{transaction.documentNumber || '—'}</td>
                <td>{transaction.description || '—'}</td>
                <td>
                  <div className="customer-transaction-amounts">
                    {transaction.isOpeningBalance ? (
                      <strong>ابتدای دوره</strong>
                    ) : null}
                    {renderAmounts(transaction)}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  هنوز تراکنشی برای این طرف‌حساب ثبت نشده است.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
    <div className={`customer-transaction-balance-item ${
      value < 0 ? 'is-negative' : value > 0 ? 'is-positive' : ''
    }`}>
      <span>{label}</span>
      <strong>{formattedValue}</strong>
      <small>{unit}</small>
      <em>{balanceStatus(value)}</em>
    </div>
  );
}
