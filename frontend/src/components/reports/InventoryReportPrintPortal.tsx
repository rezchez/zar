'use client';

import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { AppSettings } from '@/lib/settings';
import { toPersianDigits } from '@/lib/persian-date';

export interface InventoryPrintItem {
  id: string;
  category: string;
  title: string;
  codeOrBarcode?: string;
  labOrDetails?: string;
  purity: number;
  rawWeight: number;
  converted750: number;
  mesghal18: number;
  quantity?: number;
  storageLocation: string;
  estimatedValueRial?: number;
}

export interface InventoryReportPrintPortalProps {
  paperSize: 'A4' | 'A5';
  currentJalaliDate: string;
  rates: {
    goldGram18PriceRial: number;
    goldMesghalPriceRial: number;
  };
  summary: {
    grandTotalGoldConverted750: number;
    grandTotalGoldMesghal18: number;
    grandTotalGoldMesghal17: number;
    grandTotalInventoryValuationRial: number;
    melted: { rawWeight: number; converted750: number; piecesCount: number };
    scrap: { rawWeight: number; converted750: number; piecesCount: number };
    conditional: { rawWeight: number; converted750: number; piecesCount: number };
    coins: { piecesCount: number; totalWeight: number; converted750: number };
    etiquettes: { piecesCount: number; grossWeight: number; netGoldWeight: number; converted750: number };
    gemstones: { piecesCount: number; totalCarats: number };
    otherMetals: { silverConverted: number; platinumConverted: number };
  };
  items: InventoryPrintItem[];
  settings?: AppSettings;
  activeTabTitle: string;
  formatMoney: (amount: number) => string;
  formatWeight: (weight: number) => string;
  onClose: () => void;
}

export function chunkInventoryRows<T>(items: T[], normalSize: number, lastSize: number): T[][] {
  if (items.length === 0) return [[]];
  if (items.length <= lastSize) return [items];

  const pages: T[][] = [];
  let remaining = [...items];

  while (remaining.length > 0) {
    if (remaining.length <= lastSize) {
      pages.push(remaining);
      break;
    }
    const take = normalSize;
    pages.push(remaining.slice(0, take));
    remaining = remaining.slice(take);
  }

  return pages;
}

export default function InventoryReportPrintPortal({
  paperSize,
  currentJalaliDate,
  rates,
  summary,
  items,
  settings,
  activeTabTitle,
  formatMoney,
  formatWeight,
  onClose,
}: InventoryReportPrintPortalProps) {
  const shopName = settings?.printStoreName || settings?.organizationName || 'گالری و بنکداری طلا و جواهر';

  const normalCapacity = paperSize === 'A4' ? 18 : 10;
  const lastCapacity = paperSize === 'A4' ? 12 : 7;

  const pages = useMemo(
    () => chunkInventoryRows(items, normalCapacity, lastCapacity),
    [items, normalCapacity, lastCapacity]
  );

  const totalPages = pages.length;

  return createPortal(
    <div
      dir="rtl"
      id="inventory-print-portal-container"
      className="fixed inset-0 z-[9999] overflow-auto bg-slate-900/80 backdrop-blur-sm p-4 sm:p-8 flex flex-col items-center print:p-0 print:bg-white print:overflow-visible print:static"
    >
      {/* Screen action bar (hidden during print) */}
      <div className="w-full max-w-4xl mb-4 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-xl flex items-center justify-between print:hidden border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
            پیش‌نمایش چاپ صورت موجودی انبار ({paperSize})
          </span>
          <span className="text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full">
            {toPersianDigits(items.length)} ردیف در {toPersianDigits(totalPages)} صفحه
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-md transition flex items-center gap-2"
          >
            <span>چاپ سند</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition"
          >
            بستن
          </button>
        </div>
      </div>

      {/* Printable Pages */}
      <div className="print-document flex flex-col gap-6 print:gap-0 print:w-full">
        {pages.map((pageRows, pageIndex) => {
          const isFirstPage = pageIndex === 0;
          const isLastPage = pageIndex === totalPages - 1;

          return (
            <div
              key={pageIndex}
              className={`print-page bg-white text-slate-900 shadow-2xl print:shadow-none mx-auto box-border flex flex-col justify-between ${
                paperSize === 'A4'
                  ? 'w-[210mm] min-h-[297mm] p-[10mm]'
                  : 'w-[148mm] min-h-[210mm] p-[8mm]'
              } print:m-0 print:p-[8mm] print:break-after-page`}
              style={{ pageBreakAfter: isLastPage ? 'auto' : 'always' }}
            >
              <div>
                {/* Header */}
                <div className="border-b-2 border-amber-500 pb-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-lg font-black text-slate-900">{shopName}</h1>
                      <h2 className="text-sm font-extrabold text-amber-600 mt-0.5">
                        صورت موجودی و تراز وزنی طلا و جواهر ({activeTabTitle})
                      </h2>
                    </div>
                    <div className="text-left text-xs text-slate-600 space-y-0.5">
                      <div>
                        <span className="font-bold">تاریخ گزارش: </span>
                        <span>{toPersianDigits(currentJalaliDate)}</span>
                      </div>
                      <div>
                        <span className="font-bold">نرخ طلای ۱۸: </span>
                        <span>{formatMoney(rates.goldGram18PriceRial)}</span>
                      </div>
                      <div>
                        <span className="font-bold">صفحه: </span>
                        <span>{toPersianDigits(pageIndex + 1)} از {toPersianDigits(totalPages)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Box on First Page */}
                  {isFirstPage && (
                    <div className="mt-3 grid grid-cols-4 gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs">
                      <div>
                        <span className="text-slate-500 block">کل طلای ۱۸ عیار:</span>
                        <span className="font-black text-slate-900 text-sm">
                          {formatWeight(summary.grandTotalGoldConverted750)} گرم
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">معادل مثقال طلا:</span>
                        <span className="font-black text-slate-900 text-sm">
                          {toPersianDigits(summary.grandTotalGoldMesghal18.toFixed(3))} مثقال
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">طلای آبشده / متفرقه:</span>
                        <span className="font-bold text-slate-800">
                          {formatWeight(summary.melted.converted750 + summary.scrap.converted750)} گرم
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">ارزش روز کل انبار:</span>
                        <span className="font-black text-amber-700 text-sm">
                          {formatMoney(summary.grandTotalInventoryValuationRial)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Table */}
                <table className="w-full border-collapse text-[10px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-100 border border-slate-300 text-slate-700 font-black">
                      <th className="border border-slate-300 p-1.5 text-center w-8">ردیف</th>
                      <th className="border border-slate-300 p-1.5 text-right">عنوان قلم / شرح</th>
                      <th className="border border-slate-300 p-1.5 text-center">شناسه / بارکد / انگ</th>
                      <th className="border border-slate-300 p-1.5 text-center">عیار</th>
                      <th className="border border-slate-300 p-1.5 text-center">وزن خام (g)</th>
                      <th className="border border-slate-300 p-1.5 text-center">وزن ۱۸ عیار (g)</th>
                      <th className="border border-slate-300 p-1.5 text-center">معادل مثقال</th>
                      <th className="border border-slate-300 p-1.5 text-center">محل نگهداری</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((item, idx) => {
                      const rowNum = pageIndex * normalCapacity + idx + 1;
                      return (
                        <tr
                          key={item.id || idx}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                        >
                          <td className="border border-slate-300 p-1 text-center font-bold text-slate-500">
                            {toPersianDigits(rowNum)}
                          </td>
                          <td className="border border-slate-300 p-1 font-bold text-slate-900">
                            {item.title}
                            {item.labOrDetails ? (
                              <span className="text-[9px] text-slate-500 block">
                                {item.labOrDetails}
                              </span>
                            ) : null}
                          </td>
                          <td className="border border-slate-300 p-1 text-center font-mono">
                            {toPersianDigits(item.codeOrBarcode || '-')}
                          </td>
                          <td className="border border-slate-300 p-1 text-center font-extrabold text-amber-700">
                            {toPersianDigits(item.purity || 750)}
                          </td>
                          <td className="border border-slate-300 p-1 text-center font-semibold">
                            {formatWeight(item.rawWeight)}
                          </td>
                          <td className="border border-slate-300 p-1 text-center font-black text-slate-900">
                            {formatWeight(item.converted750)}
                          </td>
                          <td className="border border-slate-300 p-1 text-center font-semibold text-slate-700">
                            {toPersianDigits(item.mesghal18?.toFixed(3) || '۰')}
                          </td>
                          <td className="border border-slate-300 p-1 text-center text-slate-600">
                            {item.storageLocation || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Footer and Signatures on Last Page */}
              <div className="mt-6 border-t border-slate-300 pt-4">
                {isLastPage && (
                  <div className="grid grid-cols-3 gap-4 text-center text-xs text-slate-700 font-bold mb-6">
                    <div className="border border-slate-200 rounded-lg p-3">
                      <div>متصدی انبار و ترازودار</div>
                      <div className="h-12 mt-2"></div>
                      <div className="text-[10px] text-slate-400">امضا و تایید وزن</div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3">
                      <div>حسابدار صنف طلا</div>
                      <div className="h-12 mt-2"></div>
                      <div className="text-[10px] text-slate-400">امضا و تراز دفتری</div>
                    </div>
                    <div className="border border-slate-200 rounded-lg p-3">
                      <div>مدیریت مجموعه</div>
                      <div className="h-12 mt-2"></div>
                      <div className="text-[10px] text-slate-400">مهر و امضا نهایی</div>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center text-[9px] text-slate-400">
                  <span>سامانه مدیریت مالی و حسابداری طلا و جواهر زرین (Zarfolio)</span>
                  <span>صفحه {toPersianDigits(pageIndex + 1)} از {toPersianDigits(totalPages)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
