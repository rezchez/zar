'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { RefreshCw, Printer, Download, Filter, Send } from 'lucide-react';
import type { Customer } from '@/lib/customer';
import type { CustomerTransaction } from '@/lib/transaction';
import { useAppSettings } from '@/src/components/SettingsProvider';
import * as xlsx from 'xlsx';

type LedgerOpeningBalances = {
  goldAmount: number;
  silverAmount: number;
  platinumAmount: number;
  rialAmount: number;
};

export default function CustomerLedgerReport({ availableCustomers }: { availableCustomers: Customer[] }) {
  const { settings, formatMoney, formatWeight } = useAppSettings();

  const [customerId, setCustomerId] = useState<string>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortParam, setSortParam] = useState('date_desc');

  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [openingBalances, setOpeningBalances] = useState<LedgerOpeningBalances>({
    goldAmount: 0, silverAmount: 0, platinumAmount: 0, rialAmount: 0
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Available document types extracted from schema
  const docTypes = [
    { value: 'incoming-molten', label: 'ورود طلای آبشده' },
    { value: 'outgoing-molten', label: 'خروج طلای آبشده' },
    { value: 'buy-coin', label: 'خرید سکه' },
    { value: 'sell-coin', label: 'فروش سکه' },
    { value: 'cash-in', label: 'دریافت وجه' },
    { value: 'cash-out', label: 'پرداخت وجه' },
    { value: 'check-in', label: 'دریافت چک' },
    { value: 'check-out', label: 'پرداخت چک' },
  ];

  async function handleSearch() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reports/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          fromDateJalali: fromDate,
          toDateJalali: toDate,
          documentTypes: selectedTypes,
          sort: sortParam
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'خطا در دریافت گزارش.');

      setTransactions(data.transactions || []);
      setOpeningBalances(data.openingBalances || { goldAmount: 0, silverAmount: 0, platinumAmount: 0, rialAmount: 0 });
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته');
    } finally {
      setLoading(false);
    }
  }

  function handleExportExcel() {
    if (!transactions.length) return;
    const customer = availableCustomers.find(c => c.id === customerId);

    // Add opening balance row
    const wsData = [
      ['گزارش ریز اسناد طرف‌حساب'],
      [`طرف حساب: ${customer ? customer.name : 'همه'}`, `تاریخ گزارش: ${new Date().toLocaleDateString('fa-IR')}`],
      [`از تاریخ: ${fromDate || 'ابتدای دوره'}`, `تا تاریخ: ${toDate || 'اکنون'}`],
      [],
      ['تاریخ', 'شماره سند', 'نوع عملیات', 'شرح', 'بدهکار طلا', 'بستانکار طلا', 'مانده طلا', 'بدهکار مالی', 'بستانکار مالی', 'مانده مالی'],
      ['ابتدای دوره', '---', '---', 'مانده از قبل',
        openingBalances.goldAmount > 0 ? openingBalances.goldAmount : 0,
        openingBalances.goldAmount < 0 ? Math.abs(openingBalances.goldAmount) : 0,
        openingBalances.goldAmount,
        openingBalances.rialAmount > 0 ? openingBalances.rialAmount : 0,
        openingBalances.rialAmount < 0 ? Math.abs(openingBalances.rialAmount) : 0,
        openingBalances.rialAmount
      ]
    ];

    let runningGold = openingBalances.goldAmount;
    let runningRial = openingBalances.rialAmount;

    for (const t of transactions) {
      runningGold += t.goldAmount || 0;
      runningRial += t.rialAmount || 0;

      wsData.push([
        t.documentDateJalali || t.transactionDate,
        t.documentNumber,
        t.documentSubType || t.transactionType,
        t.description,
        t.goldAmount > 0 ? t.goldAmount : 0,
        t.goldAmount < 0 ? Math.abs(t.goldAmount) : 0,
        runningGold,
        t.rialAmount > 0 ? t.rialAmount : 0,
        t.rialAmount < 0 ? Math.abs(t.rialAmount) : 0,
        runningRial
      ]);
    }

    const ws = xlsx.utils.aoa_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Ledger');
    xlsx.writeFile(wb, `Ledger_Report_${Date.now()}.xlsx`);
  }

  return (
    <div className="space-y-4 text-sm dashboard-panel p-6">
      <div className="account-panel-heading border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <p className="eyebrow">گزارشات</p>
          <h2>ریز اسناد طرف حساب‌ها</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <label className="flex flex-col gap-1">
          <span className="font-bold text-slate-700 dark:text-slate-300">طرف حساب</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="p-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700">
            <option value="">همه (گزارش جامع)</option>
            {availableCustomers.map(c => (
              <option key={c.id} value={c.id}>{c.customerCode} - {c.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-bold text-slate-700 dark:text-slate-300">از تاریخ (شمسی)</span>
          <input type="text" placeholder="مثال: 1403/01/01" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="p-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 dir-ltr" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-bold text-slate-700 dark:text-slate-300">تا تاریخ (شمسی)</span>
          <input type="text" placeholder="مثال: 1403/12/29" value={toDate} onChange={(e) => setToDate(e.target.value)} className="p-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 dir-ltr" />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-bold text-slate-700 dark:text-slate-300">مرتب‌سازی</span>
          <select value={sortParam} onChange={(e) => setSortParam(e.target.value)} className="p-2 border rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700">
            <option value="date_desc">تاریخ (نزولی)</option>
            <option value="date_asc">تاریخ (صعودی)</option>
            <option value="doc_num">شماره سند</option>
            <option value="type">نوع سند</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSearch} disabled={loading} className="customer-save-button">
          {loading ? <RefreshCw className="animate-spin" size={16} /> : <Filter size={16} />}
          <span>تهیه گزارش</span>
        </button>
        {searched && transactions.length > 0 && (
          <>
            <button onClick={handleExportExcel} className="dashboard-secondary-button">
              <Download size={16} /> Excel
            </button>
            <button onClick={() => window.print()} className="dashboard-secondary-button">
              <Printer size={16} /> چاپ
            </button>
          </>
        )}
      </div>

      {error && <div className="text-red-500 bg-red-50 p-2 rounded">{error}</div>}

      {searched && (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl printable-report">
          <table className="w-full text-xs text-right whitespace-nowrap">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <tr>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">تاریخ</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">شماره سند</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">نوع</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700">شرح</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-left">بدهکار طلا (g)</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-left">بستانکار طلا (g)</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-left">بدهکار مالی</th>
                <th className="p-3 border-b border-slate-200 dark:border-slate-700 text-left">بستانکار مالی</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-amber-50 dark:bg-amber-900/20 font-bold">
                <td className="p-3 border-b border-slate-200 dark:border-slate-800 text-slate-500" colSpan={4}>مانده ابتدای دوره</td>
                <td className="p-3 border-b border-slate-200 dark:border-slate-800 text-left text-green-600">{openingBalances.goldAmount > 0 ? formatWeight(openingBalances.goldAmount) : ''}</td>
                <td className="p-3 border-b border-slate-200 dark:border-slate-800 text-left text-red-600">{openingBalances.goldAmount < 0 ? formatWeight(Math.abs(openingBalances.goldAmount)) : ''}</td>
                <td className="p-3 border-b border-slate-200 dark:border-slate-800 text-left text-green-600">{openingBalances.rialAmount > 0 ? formatMoney(openingBalances.rialAmount) : ''}</td>
                <td className="p-3 border-b border-slate-200 dark:border-slate-800 text-left text-red-600">{openingBalances.rialAmount < 0 ? formatMoney(Math.abs(openingBalances.rialAmount)) : ''}</td>
              </tr>
              {transactions.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-500">سندی یافت نشد.</td></tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800">{t.documentDateJalali || new Date(t.transactionDate).toLocaleDateString('fa-IR')}</td>
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800 font-mono text-slate-600 dark:text-slate-400">{t.documentNumber}</td>
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800">{t.documentSubType || t.transactionType}</td>
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800 max-w-[200px] truncate" title={t.description}>{t.description || '—'}</td>
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800 text-left text-green-600" dir="ltr">{t.goldAmount > 0 ? formatWeight(t.goldAmount) : ''}</td>
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800 text-left text-red-600" dir="ltr">{t.goldAmount < 0 ? formatWeight(Math.abs(t.goldAmount)) : ''}</td>
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800 text-left text-green-600" dir="ltr">{t.rialAmount > 0 ? formatMoney(t.rialAmount) : ''}</td>
                    <td className="p-3 border-b border-slate-100 dark:border-slate-800 text-left text-red-600" dir="ltr">{t.rialAmount < 0 ? formatMoney(Math.abs(t.rialAmount)) : ''}</td>
                  </tr>
                ))
              )}
            </tbody>
            {transactions.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-600">
                <tr>
                  <td colSpan={4} className="p-3 text-left">مانده نهایی پایان دوره:</td>
                  <td colSpan={2} className="p-3 text-center" dir="ltr">
                    {formatWeight(openingBalances.goldAmount + transactions.reduce((a, b) => a + (b.goldAmount || 0), 0))} گرم طلا
                  </td>
                  <td colSpan={2} className="p-3 text-center" dir="ltr">
                    {formatMoney(openingBalances.rialAmount + transactions.reduce((a, b) => a + (b.rialAmount || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Hidden print styling */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .printable-report, .printable-report * { visibility: visible; }
          .printable-report { position: absolute; left: 0; top: 0; width: 100%; direction: rtl; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}} />
    </div>
  );
}
