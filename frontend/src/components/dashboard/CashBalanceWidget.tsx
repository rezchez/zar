'use client';

import { Coins, LoaderCircle, RefreshCw, Wallet } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import type { CashFundBalanceItem } from '@/app/api/cash-funds/balances/route';
import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';
import { useAppSettings } from '@/src/components/SettingsProvider';

interface CashBalanceWidgetProps {
  size?: DashboardWidgetSize;
}

export default function CashBalanceWidget({ size = 'medium' }: CashBalanceWidgetProps) {
  const { formatMoney } = useAppSettings();
  const [funds, setFunds] = useState<CashFundBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/cash-funds/balances', { cache: 'no-store' });
      const data = (await response.json()) as { funds?: CashFundBalanceItem[]; message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? 'دریافت موجودی صندوق‌ها انجام نشد.');
      }
      setFunds(data.funds ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'دریافت موجودی صندوق‌ها انجام نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBalances();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBalances]);

  const totalFundCount = funds.length;

  return (
    <section className="dashboard-panel h-full flex flex-col justify-between" dir="rtl">
      <div>
        <div className="dashboard-panel-heading flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <p className="eyebrow text-xs font-semibold text-slate-500 dark:text-slate-400">حساب‌های نقد</p>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <Wallet size={19} className="text-emerald-600 dark:text-emerald-400" />
              موجودی وجه نقد
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadBalances()}
            disabled={loading}
            className="dashboard-icon-button p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            aria-label="به‌روزرسانی موجودی صندوق‌ها"
          >
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </button>
        </div>

        {error ? <p className="form-error text-xs text-rose-600 dark:text-rose-400 my-2">{error}</p> : null}

        {loading ? (
          <div className="space-y-2 py-2">
            <div className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
            <div className="h-10 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          </div>
        ) : null}

        {!loading && !error && funds.length === 0 ? (
          <p className="dashboard-empty-search text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
            هنوز صندوق وجه نقدی ایجاد نشده است.
          </p>
        ) : null}

        {!loading && !error && funds.length > 0 ? (
          <div>
            {size === 'small' ? (
              /* SMALL SIZE: Compact view */
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>تعداد صندوق‌ها:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{totalFundCount} صندوق</span>
                </div>
                {funds.slice(0, 2).map((fund) => (
                  <div
                    key={fund.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-slate-900/60 p-2 text-xs"
                  >
                    <span className="font-medium truncate max-w-[120px] text-slate-800 dark:text-slate-200">
                      {fund.name}
                    </span>
                    <strong className="text-emerald-700 dark:text-emerald-400 font-bold dir-ltr">
                      {formatMoney(fund.balance)} {fund.currencySymbol || fund.currencyCode}
                    </strong>
                  </div>
                ))}
                {funds.length > 2 ? (
                  <p className="text-[11px] text-center text-slate-400">+{funds.length - 2} صندوق دیگر</p>
                ) : null}
              </div>
            ) : size === 'medium' ? (
              /* MEDIUM SIZE: Standard list */
              <div className="space-y-2.5">
                {funds.map((fund) => (
                  <div
                    key={fund.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-900/80 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <Coins size={18} />
                      </div>
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-slate-800 dark:text-slate-100">{fund.name}</strong>
                        <small className="text-[11px] text-slate-500 dark:text-slate-400">{fund.currencyName}</small>
                      </div>
                    </div>
                    <strong className="text-sm font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap dir-ltr">
                      {formatMoney(fund.balance)} <span className="text-xs text-slate-500 font-normal">{fund.currencySymbol || fund.currencyCode}</span>
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              /* LARGE SIZE: Rich detailed list with grid stats */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {funds.map((fund) => (
                    <div
                      key={fund.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900 shadow-xs hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-xs">
                          {fund.currencyCode.slice(0, 3) || 'VAL'}
                        </div>
                        <div className="min-w-0">
                          <strong className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {fund.name}
                          </strong>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{fund.currencyName}</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <strong className="block text-base font-extrabold text-emerald-700 dark:text-emerald-400 dir-ltr">
                          {formatMoney(fund.balance)}
                        </strong>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">{fund.currencySymbol || fund.currencyCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
