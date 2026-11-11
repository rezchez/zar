'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Customer } from '@/lib/customer';
import type { AppSettings } from '@/lib/settings';
import { toPersianDigits } from '@/lib/persian-date';
import type { ColumnVisibility } from './CustomerLedgerReport';

export interface PrintableLedgerRow {
  id: string;
  rowNumber?: number;
  documentNumber?: string;
  documentDateJalali?: string;
  transactionDate?: string;
  customerName?: string;
  journalLine?: {
    accountTitle?: string;
    accountCode?: string;
    generalTitle?: string;
    subCategory?: string;
    treePath?: string;
    badgeColor?: string;
  };
  breakdown?: {
    categoryLabel?: string;
  };
  lineDescription?: {
    primary?: string;
    secondary?: string;
  };
  description?: string;
  goldDebtor?: number;
  goldCreditor?: number;
  runningGold?: number;
  rialDebtor?: number;
  rialCreditor?: number;
  runningRial?: number;
  isOpeningBalance?: boolean;
}

export interface LedgerReportPrintPortalProps {
  paperSize: 'A4' | 'A5';
  metalType?: 'gold' | 'silver' | 'platinum';
  metalLabel?: string;
  customer?: Customer | null;
  fromDate: string;
  toDate: string;
  categoryLabel?: string;
  hasPreviousBalance: boolean;
  openingBalances: {
    goldAmount: number;
    silverAmount: number;
    platinumAmount: number;
    rialAmount: number;
  };
  rows: PrintableLedgerRow[];
  totalStats: {
    count: number;
    totalGoldDebtor: number;
    totalGoldCreditor: number;
    finalGold: number;
    totalRialDebtor: number;
    totalRialCreditor: number;
    finalRial: number;
  };
  visibleColumns: ColumnVisibility;
  baseCurrencySymbol: string;
  settings: AppSettings;
  formatMoney: (amount: number) => string;
  formatWeight: (weight: number) => string;
}

/**
 * Intelligent pagination chunker for printable report.
 * Ensures:
 * 1. Every normal page has `normalPageSize` rows.
 * 2. The last page never exceeds `lastPageCapacity` so the total summary and signature
 *    block fit without overflowing or causing an accidental empty/extra page.
 */
export function chunkLedgerRowsForPrint<T>(
  items: T[],
  normalPageSize: number,
  lastPageCapacity: number,
): T[][] {
  if (items.length === 0) return [[]];
  if (items.length <= lastPageCapacity) {
    return [items];
  }

  const pages: T[][] = [];
  let remaining = [...items];

  while (remaining.length > 0) {
    if (remaining.length <= lastPageCapacity) {
      pages.push(remaining);
      break;
    }

    // If remaining items are between lastPageCapacity + 1 and normalPageSize,
    // split them evenly so the last page doesn't end up with 0 rows or overflow
    if (remaining.length <= normalPageSize) {
      const take = Math.ceil(remaining.length / 2);
      pages.push(remaining.slice(0, take));
      pages.push(remaining.slice(take));
      break;
    }

    pages.push(remaining.slice(0, normalPageSize));
    remaining = remaining.slice(normalPageSize);
  }

  return pages;
}

export default function LedgerReportPrintPortal({
  paperSize,
  metalType = 'gold',
  metalLabel = 'طلا',
  customer,
  fromDate,
  toDate,
  categoryLabel,
  hasPreviousBalance,
  openingBalances,
  rows,
  totalStats,
  visibleColumns,
  baseCurrencySymbol,
  settings,
  formatMoney,
  formatWeight,
}: LedgerReportPrintPortalProps) {
  const isA5 = paperSize === 'A5';
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prepare full list of printable items including opening balance if applicable
  const allPrintableItems = useMemo(() => {
    const list: PrintableLedgerRow[] = [];

    if (hasPreviousBalance) {
      const gBal =
        metalType === 'silver'
          ? openingBalances.silverAmount || 0
          : metalType === 'platinum'
          ? openingBalances.platinumAmount || 0
          : openingBalances.goldAmount || 0;
      const rBal = openingBalances.rialAmount || 0;
      list.push({
        id: '__opening_balance__',
        isOpeningBalance: true,
        rowNumber: 0,
        documentDateJalali: fromDate || 'پیش از دوره',
        documentNumber: '—',
        customerName: customer ? customer.name : 'کلیه طرف‌حساب‌ها',
        journalLine: {
          accountTitle: 'مانده منقول',
        },
        description: `مانده منقول از دوره قبل (پیش از ${fromDate || 'ابتدای دوره'})`,
        goldDebtor: gBal < 0 ? Math.abs(gBal) : 0,
        goldCreditor: gBal > 0 ? gBal : 0,
        runningGold: gBal,
        rialDebtor: rBal < 0 ? Math.abs(rBal) : 0,
        rialCreditor: rBal > 0 ? rBal : 0,
        runningRial: rBal,
      });
    }

    rows.forEach((r, idx) => {
      list.push({
        ...r,
        rowNumber: idx + 1,
      });
    });

    return list;
  }, [hasPreviousBalance, openingBalances, fromDate, customer, rows, metalType]);

  // Page capacities based on paper size
  // A4 Landscape: 297mm x 210mm -> 22 normal rows, 16 last page rows (fills ~96% of the sheet with minimal empty whitespace)
  // A5 Portrait (عمودی): 148mm x 210mm -> 16 normal rows, 11 last page rows
  const normalPageSize = isA5 ? 16 : 22;
  const lastPageCapacity = isA5 ? 11 : 16;

  const pages = useMemo(() => {
    return chunkLedgerRowsForPrint(allPrintableItems, normalPageSize, lastPageCapacity);
  }, [allPrintableItems, normalPageSize, lastPageCapacity]);

  const totalPages = pages.length;

  const printDateStr = useMemo(() => {
    try {
      return new Date().toLocaleDateString('fa-IR');
    } catch {
      return '';
    }
  }, []);

  const printTimeStr = useMemo(() => {
    try {
      return new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, []);

  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  const storeName = settings.printStoreName || settings.organizationName || 'گالری طلا و جواهر زر';
  const customerTitle = customer
    ? `${customer.customerCode ? `[${toPersianDigits(customer.customerCode)}] ` : ''}${customer.name}`
    : 'کلیه طرف‌حساب‌ها';
  const dateRangeStr = `از ${fromDate || 'ابتدای دوره'} تا ${toDate || 'اکنون'}`;

  // Dimensions & font styles per paper size
  // A5 PORTRAIT (عمودی): 148mm x 210mm
  // A4 Landscape: 297mm x 210mm
  const pageDim = isA5
    ? {
        widthMm: 148,
        heightMm: 210,
        paddingMm: 4,
        fontSize: '6.5pt',
        headerTitleSize: '10pt',
        headerSubSize: '7pt',
        tableCellPad: '2px 2.5px',
      }
    : {
        widthMm: 297,
        heightMm: 210,
        paddingMm: 4,
        fontSize: '7.8pt',
        headerTitleSize: '11pt',
        headerSubSize: '7.8pt',
        tableCellPad: '1.8px 3.5px',
      };

  return createPortal(
    <div
      id="ledger-report-print-root"
      className="ledger-report-print-root hidden"
      dir="rtl"
      aria-hidden="true"
    >
      <style>{`
        @media screen {
          .ledger-report-print-root {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: ${isA5 ? 'A5 portrait' : 'A4 landscape'};
            margin: 0 !important;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Tahoma, 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          }
          body > *:not(.ledger-report-print-root) {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          .ledger-report-print-root {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .print-ledger-page {
            display: block !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            clear: both !important;
            position: relative !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden !important;
            width: ${pageDim.widthMm}mm !important;
            height: ${pageDim.heightMm}mm !important;
            max-height: ${pageDim.heightMm}mm !important;
            padding: ${pageDim.paddingMm}mm !important;
            margin: 0 auto !important;
          }
          .print-ledger-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .print-ledger-page-inner {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
          }
          .print-ledger-table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: ${pageDim.fontSize} !important;
            text-align: right !important;
            table-layout: auto !important;
          }
          .print-ledger-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-ledger-table th,
          .print-ledger-table td {
            border: 1px solid #475569 !important;
            padding: ${pageDim.tableCellPad} !important;
            color: #000000 !important;
            line-height: 1.25 !important;
          }
          .print-ledger-table th {
            background-color: #f1f5f9 !important;
            font-weight: 800 !important;
          }
          .print-ledger-table tr.opening-row {
            background-color: #f8fafc !important;
            font-weight: 700 !important;
          }
        }
      `}</style>

      {pages.map((pageRows, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === totalPages - 1;
        const pageNumberPersian = toPersianDigits(pageIdx + 1);
        const totalPagesPersian = toPersianDigits(totalPages);

        // Sum of weight and financial columns strictly for the current page
        const pageStats = pageRows.reduce(
          (acc, r) => {
            acc.goldDebtor += Number(r.goldDebtor) || 0;
            acc.goldCreditor += Number(r.goldCreditor) || 0;
            acc.rialDebtor += Number(r.rialDebtor) || 0;
            acc.rialCreditor += Number(r.rialCreditor) || 0;
            return acc;
          },
          { goldDebtor: 0, goldCreditor: 0, rialDebtor: 0, rialCreditor: 0 },
        );

        const lastRowInPage = pageRows[pageRows.length - 1];
        const pageEndGold = lastRowInPage ? Number(lastRowInPage.runningGold) || 0 : 0;
        const pageEndRial = lastRowInPage ? Number(lastRowInPage.runningRial) || 0 : 0;

        return (
          <div
            key={`page-${pageIdx}`}
            className="print-ledger-page"
            style={{
              fontFamily: 'Tahoma, "Vazirmatn", sans-serif',
              direction: 'rtl',
            }}
          >
            <div className="print-ledger-page-inner">
              {/* Top Container: Header + Table */}
              <div>
              {/* Report Header (سربرگ گزارش) - Repeated on EVERY page */}
              <div
                style={{
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: isA5 ? '4px' : '6px',
                  marginBottom: isA5 ? '4px' : '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Right: Store / Organization info */}
                  <div style={{ textAlign: 'right', flex: 1 }}>
                    <div style={{ fontSize: isA5 ? '10pt' : '12pt', fontWeight: 900, color: '#0f172a' }}>
                      {storeName}
                    </div>
                    {settings.printStoreSlogan && (
                      <div style={{ fontSize: isA5 ? '6.5pt' : '8pt', color: '#64748b', marginTop: '1px' }}>
                        {settings.printStoreSlogan}
                      </div>
                    )}
                    {settings.printPhone && (
                      <div style={{ fontSize: isA5 ? '6.5pt' : '7.5pt', color: '#475569', marginTop: '1px' }}>
                        تلفن: {toPersianDigits(settings.printPhone)}
                      </div>
                    )}
                  </div>

                  {/* Center: Title & Subject */}
                  <div style={{ textAlign: 'center', flex: 1.5 }}>
                    <div
                      style={{
                        fontSize: pageDim.headerTitleSize,
                        fontWeight: 900,
                        color: '#0f172a',
                        letterSpacing: '-0.3px',
                      }}
                    >
                      گزارش جامع ریز اسناد و صورت‌حساب
                    </div>
                    <div
                      style={{
                        fontSize: pageDim.headerSubSize,
                        fontWeight: 700,
                        color: '#334155',
                        marginTop: '3px',
                      }}
                    >
                      طرف‌حساب: <span style={{ color: '#0f172a' }}>{customerTitle}</span>
                      <span> | فلز: <strong style={{ color: '#0f172a' }}>{metalLabel}</strong></span>
                      {categoryLabel && categoryLabel !== 'همه اقلام' && (
                        <span> | فیلتر: <strong>{categoryLabel}</strong></span>
                      )}
                    </div>
                  </div>

                  {/* Left: Metadata & Page Info */}
                  <div style={{ textAlign: 'left', flex: 1, fontSize: isA5 ? '7pt' : '8pt', color: '#334155', lineHeight: 1.6 }}>
                    <div>
                      بازه: <strong>{dateRangeStr}</strong>
                    </div>
                    <div>
                      تاریخ چاپ: <strong>{printDateStr}</strong> - {printTimeStr}
                    </div>
                    <div>
                      صفحه: <strong style={{ color: '#0f172a' }}>{pageNumberPersian} از {totalPagesPersian}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <table className="print-ledger-table">
                <thead>
                  {/* Super Header Row */}
                  <tr style={{ background: '#e2e8f0', fontSize: isA5 ? '6.5pt' : '7.5pt' }}>
                    <th colSpan={customer ? 5 : 6} style={{ textAlign: 'center' }}>
                      مشخصات سند و ردیف
                    </th>
                    <th colSpan={3} style={{ textAlign: 'center', background: '#fef3c7' }}>
                      گردش و مانده {metalLabel} (گرم)
                    </th>
                    <th colSpan={3} style={{ textAlign: 'center', background: '#dcfce7' }}>
                      گردش مالی ({baseCurrencySymbol})
                    </th>
                  </tr>

                  {/* Column Header Row */}
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ width: isA5 ? '18px' : '32px', textAlign: 'center' }}>ردیف</th>
                    <th style={{ width: isA5 ? '46px' : '76px', textAlign: 'center' }}>تاریخ</th>
                    <th style={{ width: isA5 ? '36px' : '64px', textAlign: 'center' }}>شماره سند</th>
                    {!customer && <th style={{ width: isA5 ? '55px' : '100px' }}>طرف‌حساب</th>}
                    <th style={{ width: isA5 ? '48px' : '95px' }}>آرتیکل</th>
                    <th>شرح ردیف سند</th>
                    <th style={{ width: isA5 ? '42px' : '75px', textAlign: 'left' }}>بدهکار</th>
                    <th style={{ width: isA5 ? '42px' : '75px', textAlign: 'left' }}>بستانکار</th>
                    <th style={{ width: isA5 ? '46px' : '82px', textAlign: 'left' }}>مانده</th>
                    <th style={{ width: isA5 ? '46px' : '90px', textAlign: 'left' }}>بدهکار</th>
                    <th style={{ width: isA5 ? '46px' : '90px', textAlign: 'left' }}>بستانکار</th>
                    <th style={{ width: isA5 ? '50px' : '98px', textAlign: 'left' }}>مانده</th>
                  </tr>
                </thead>

                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={customer ? 11 : 12} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                        در این بازه زمانی هیچ ردیف سندی ثبت نشده است.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      if (row.isOpeningBalance) {
                        const gBal = row.runningGold || 0;
                        const rBal = row.runningRial || 0;
                        const gDeb = gBal < 0 ? formatWeight(Math.abs(gBal)) : '۰';
                        const gCred = gBal > 0 ? formatWeight(gBal) : '۰';
                        const gStatus = gBal > 0.0005 ? '(بس)' : gBal < -0.0005 ? '(بد)' : '';
                        const gColor = gBal > 0.0005 ? '#047857' : gBal < -0.0005 ? '#b91c1c' : '#000000';

                        const rDeb = rBal < 0 ? formatMoney(Math.abs(rBal)) : '۰';
                        const rCred = rBal > 0 ? formatMoney(rBal) : '۰';
                        const rStatus = rBal > 50 ? '(بس)' : rBal < -50 ? '(بد)' : '';
                        const rColor = rBal > 50 ? '#047857' : rBal < -50 ? '#b91c1c' : '#000000';

                        return (
                          <tr key="opening-bal" className="opening-row" style={{ backgroundColor: '#f1f5f9' }}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>—</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{row.documentDateJalali}</td>
                            <td style={{ textAlign: 'center' }}>—</td>
                            {!customer && <td>{row.customerName || '—'}</td>}
                            <td style={{ fontWeight: 700, color: '#b45309' }}>مانده منقول</td>
                            <td style={{ fontWeight: 600 }}>{row.description}</td>
                            <td style={{ textAlign: 'left' }}>{gDeb}</td>
                            <td style={{ textAlign: 'left' }}>{gCred}</td>
                            <td style={{ textAlign: 'left', fontWeight: 700, color: gColor }}>
                              {formatWeight(Math.abs(gBal))} {gStatus}
                            </td>
                            <td style={{ textAlign: 'left' }}>{rDeb}</td>
                            <td style={{ textAlign: 'left' }}>{rCred}</td>
                            <td style={{ textAlign: 'left', fontWeight: 700, color: rColor }}>
                              {formatMoney(Math.abs(rBal))} {rStatus}
                            </td>
                          </tr>
                        );
                      }

                      const gDeb = row.goldDebtor ? formatWeight(row.goldDebtor) : '۰';
                      const gCred = row.goldCreditor ? formatWeight(row.goldCreditor) : '۰';
                      const gBalVal = row.runningGold || 0;
                      const gBal = formatWeight(Math.abs(gBalVal));
                      const gStatus = gBalVal > 0.0005 ? '(بس)' : gBalVal < -0.0005 ? '(بد)' : '';
                      const gColor = gBalVal > 0.0005 ? '#047857' : gBalVal < -0.0005 ? '#b91c1c' : '#000000';

                      const rDeb = row.rialDebtor ? formatMoney(row.rialDebtor) : '۰';
                      const rCred = row.rialCreditor ? formatMoney(row.rialCreditor) : '۰';
                      const rBalVal = row.runningRial || 0;
                      const rBal = formatMoney(Math.abs(rBalVal));
                      const rStatus = rBalVal > 50 ? '(بس)' : rBalVal < -50 ? '(بد)' : '';
                      const rColor = rBalVal > 50 ? '#047857' : rBalVal < -50 ? '#b91c1c' : '#000000';

                      const jTitle = row.journalLine?.accountTitle || row.breakdown?.categoryLabel || '—';
                      const pDesc = row.lineDescription?.primary || row.description || '—';
                      const sDesc = row.lineDescription?.secondary;

                      return (
                        <tr key={row.id}>
                          <td style={{ textAlign: 'center' }}>
                            {row.rowNumber ? toPersianDigits(row.rowNumber) : '—'}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {row.documentDateJalali || row.transactionDate?.slice(0, 10) || '—'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {row.documentNumber ? toPersianDigits(row.documentNumber) : '—'}
                          </td>
                          {!customer && (
                            <td style={{ maxWidth: isA5 ? '80px' : '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.customerName || '—'}
                            </td>
                          )}
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{jTitle}</td>
                          <td style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            <div style={{ fontWeight: 600 }}>{pDesc}</div>
                            {sDesc && (
                              <div style={{ fontSize: isA5 ? '5.5pt' : '6.5pt', color: '#64748b', marginTop: '1px' }}>
                                {sDesc}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'left' }}>{gDeb}</td>
                          <td style={{ textAlign: 'left' }}>{gCred}</td>
                          <td style={{ textAlign: 'left', fontWeight: 700, color: gColor }}>
                            {gBal} {gStatus}
                          </td>
                          <td style={{ textAlign: 'left' }}>{rDeb}</td>
                          <td style={{ textAlign: 'left' }}>{rCred}</td>
                          <td style={{ textAlign: 'left', fontWeight: 700, color: rColor }}>
                            {rBal} {rStatus}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* Page Subtotal Row on EVERY page (در انتهای هر صفحه باید مجموع ستون های وزنی و مالی نوشته بشه) */}
                  {pageRows.length > 0 && (
                    <tr
                      style={{
                        backgroundColor: '#f8fafc',
                        borderTop: '2px solid #64748b',
                        fontWeight: 800,
                      }}
                    >
                      <td
                        colSpan={customer ? 5 : 6}
                        style={{ textAlign: 'center', fontWeight: 800, background: '#f1f5f9' }}
                      >
                        {totalPages > 1
                          ? `جمع این صفحه (${toPersianDigits(pageRows.length)} ردیف):`
                          : `مجموع گردش و مانده نهایی (${toPersianDigits(totalStats.count)} ردیف):`}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 800 }}>
                        {formatWeight(pageStats.goldDebtor)}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 800 }}>
                        {formatWeight(pageStats.goldCreditor)}
                      </td>
                      <td
                        style={{
                          textAlign: 'left',
                          fontWeight: 800,
                          color: pageEndGold > 0.0005 ? '#047857' : pageEndGold < -0.0005 ? '#b91c1c' : '#000000',
                          backgroundColor: '#fef3c7',
                        }}
                      >
                        {formatWeight(Math.abs(pageEndGold))}{' '}
                        {pageEndGold > 0.0005 ? '(بس)' : pageEndGold < -0.0005 ? '(بد)' : '(تسویه)'}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 800 }}>
                        {formatMoney(pageStats.rialDebtor)}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 800 }}>
                        {formatMoney(pageStats.rialCreditor)}
                      </td>
                      <td
                        style={{
                          textAlign: 'left',
                          fontWeight: 800,
                          color: pageEndRial > 50 ? '#047857' : pageEndRial < -50 ? '#b91c1c' : '#000000',
                          backgroundColor: '#dcfce7',
                        }}
                      >
                        {formatMoney(Math.abs(pageEndRial))}{' '}
                        {pageEndRial > 50 ? '(بس)' : pageEndRial < -50 ? '(بد)' : '(تسویه)'}
                      </td>
                    </tr>
                  )}

                  {/* Grand Total Row ONLY on Final Page for multi-page reports */}
                  {isLastPage && totalPages > 1 && (
                    <tr
                      style={{
                        backgroundColor: '#e2e8f0',
                        borderTop: '2px solid #0f172a',
                        borderBottom: '3px double #0f172a',
                        fontWeight: 900,
                      }}
                    >
                      <td
                        colSpan={customer ? 5 : 6}
                        style={{ textAlign: 'center', fontWeight: 900, background: '#cbd5e1' }}
                      >
                        مجموع کل دوره (کل {toPersianDigits(totalStats.count)} ردیف):
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 900 }}>
                        {formatWeight(totalStats.totalGoldDebtor)}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 900 }}>
                        {formatWeight(totalStats.totalGoldCreditor)}
                      </td>
                      <td
                        style={{
                          textAlign: 'left',
                          fontWeight: 900,
                          color: totalStats.finalGold > 0.0005 ? '#047857' : totalStats.finalGold < -0.0005 ? '#b91c1c' : '#000000',
                          backgroundColor: '#fde68a',
                        }}
                      >
                        {formatWeight(Math.abs(totalStats.finalGold))}{' '}
                        {totalStats.finalGold > 0.0005 ? '(بس)' : totalStats.finalGold < -0.0005 ? '(بد)' : '(تسویه)'}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 900 }}>
                        {formatMoney(totalStats.totalRialDebtor)}
                      </td>
                      <td style={{ textAlign: 'left', fontWeight: 900 }}>
                        {formatMoney(totalStats.totalRialCreditor)}
                      </td>
                      <td
                        style={{
                          textAlign: 'left',
                          fontWeight: 900,
                          color: totalStats.finalRial > 50 ? '#047857' : totalStats.finalRial < -50 ? '#b91c1c' : '#000000',
                          backgroundColor: '#bbf7d0',
                        }}
                      >
                        {formatMoney(Math.abs(totalStats.finalRial))}{' '}
                        {totalStats.finalRial > 50 ? '(بس)' : totalStats.finalRial < -50 ? '(بد)' : '(تسویه)'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Container: Summary cards (only on last page) + Signatures + Footer (on EVERY page) */}
            <div>
              {/* Executive Summary Cards & Signatures - ONLY on the FINAL page */}
              {isLastPage && (
                <div style={{ marginTop: isA5 ? '4px' : '6px' }}>
                  {/* Summary Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: isA5 ? '3px' : '6px',
                      fontSize: isA5 ? '6.5pt' : '7.5pt',
                    }}
                  >
                    <div
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: isA5 ? '3px 5px' : '4px 8px',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <div style={{ color: '#64748b', fontSize: isA5 ? '5.5pt' : '6.5pt' }}>مانده نهایی {metalLabel}:</div>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: isA5 ? '7.5pt' : '8.5pt',
                          marginTop: '1px',
                          color: totalStats.finalGold > 0.0005 ? '#047857' : totalStats.finalGold < -0.0005 ? '#b91c1c' : '#0f172a',
                        }}
                      >
                        {formatWeight(Math.abs(totalStats.finalGold))} گرم{' '}
                        {totalStats.finalGold > 0.0005 ? 'بستانکار (طلب مشتری)' : totalStats.finalGold < -0.0005 ? 'بدهکار (بدهی مشتری)' : 'تسویه کامل'}
                      </div>
                    </div>

                    <div
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: isA5 ? '3px 5px' : '4px 8px',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <div style={{ color: '#64748b', fontSize: isA5 ? '5.5pt' : '6.5pt' }}>مانده نهایی مالی:</div>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: isA5 ? '7.5pt' : '8.5pt',
                          marginTop: '1px',
                          color: totalStats.finalRial > 50 ? '#047857' : totalStats.finalRial < -50 ? '#b91c1c' : '#0f172a',
                        }}
                      >
                        {formatMoney(Math.abs(totalStats.finalRial))} {baseCurrencySymbol}{' '}
                        {totalStats.finalRial > 50 ? 'بستانکار (طلب مشتری)' : totalStats.finalRial < -50 ? 'بدهکار (بدهی مشتری)' : 'تسویه کامل'}
                      </div>
                    </div>

                    <div
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: isA5 ? '3px 5px' : '4px 8px',
                        backgroundColor: '#f8fafc',
                      }}
                    >
                      <div style={{ color: '#64748b', fontSize: isA5 ? '5.5pt' : '6.5pt' }}>تعداد کل اقلام گزارش:</div>
                      <div style={{ fontWeight: 900, fontSize: isA5 ? '7.5pt' : '8.5pt', marginTop: '1px', color: '#0f172a' }}>
                        {toPersianDigits(totalStats.count)} سند و ردیف محاسباتی
                      </div>
                    </div>
                  </div>

                  {/* Signatures Row */}
                  {settings.printShowSignature !== false && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: isA5 ? '6px' : '8px',
                        paddingTop: isA5 ? '4px' : '6px',
                        fontSize: isA5 ? '6.5pt' : '7.5pt',
                        color: '#334155',
                      }}
                    >
                      <div style={{ textAlign: 'center', width: '38%' }}>
                        <div>امضای صادرکننده / حسابدار</div>
                        <div style={{ height: isA5 ? '16px' : '22px' }}></div>
                        <div style={{ borderTop: '1px dotted #94a3b8' }}></div>
                      </div>
                      <div style={{ textAlign: 'center', width: '38%' }}>
                        <div>امضای طرف‌حساب / تأیید صورت‌حساب</div>
                        <div style={{ height: isA5 ? '16px' : '22px' }}></div>
                        <div style={{ borderTop: '1px dotted #94a3b8' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Page Footer (صفحات در پایین باید شماره‌گذاری شده باشه) - on EVERY page */}
              <div
                style={{
                  borderTop: '1px solid #cbd5e1',
                  marginTop: isA5 ? '4px' : '8px',
                  paddingTop: isA5 ? '3px' : '5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: isA5 ? '6.5pt' : '7.5pt',
                  color: '#64748b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img
                    src="/logo.svg"
                    alt="زرفولیو"
                    style={{
                      width: '2.4em',
                      height: '2.4em',
                      objectFit: 'contain',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  <span>سامانه مدیریت و حسابداری طلا و جواهر زرفولیو</span>
                </div>
                {/* Page Numbering in Bottom Center */}
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: isA5 ? '7pt' : '8pt' }}>
                  صفحه {pageNumberPersian} از {totalPagesPersian}
                </div>
                <div>
                  تاریخ و ساعت صدور: {printDateStr} {printTimeStr}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
      })}
    </div>,
    document.body,
  );
}
