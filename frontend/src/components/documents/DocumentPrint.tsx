'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import type { Customer } from '@/lib/customer';
import { useAppSettings } from '@/src/components/SettingsProvider';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import {
  type InvoicePrintTemplate,
  type InvoicePrintElement,
  type InvoiceTableConfiguration,
  type InvoiceTableColumn,
  DEFAULT_SYSTEM_TEMPLATES,
  getPageDimensions,
  DEFAULT_TABLE_COLUMNS,
  getFontWeightCss,
} from '@/lib/print-templates';
import { toPersianDigits } from '@/lib/jalali';

const DEFAULT_INVOICE_TEMPLATE = DEFAULT_SYSTEM_TEMPLATES.find(
  (template) => template.templateType !== 'customer',
) || DEFAULT_SYSTEM_TEMPLATES[0];

function getActiveInvoiceTemplate(templates: InvoicePrintTemplate[]): InvoicePrintTemplate {
  const invoiceTemplates = templates.filter((template) => template.templateType !== 'customer');
  return invoiceTemplates.find((template) => template.isActive) || invoiceTemplates[0] || DEFAULT_INVOICE_TEMPLATE;
}

type DocumentPrintProps = {
  customer: Customer | null;
  documentNumber: string;
  documentDateJalali: string;
  lines: DocumentLine[];
  isFinalized?: boolean;
  iconOnly?: boolean;
  className?: string;
};

export default function DocumentPrint({
  customer,
  documentNumber,
  documentDateJalali,
  lines,
  isFinalized = false,
  iconOnly = false,
  className,
}: DocumentPrintProps) {
  const { settings } = useAppSettings();

  const [activeTemplate, setActiveTemplate] = useState<InvoicePrintTemplate>(DEFAULT_INVOICE_TEMPLATE);
  const [isMounted, setIsMounted] = useState(false);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/settings/print-templates', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted) return;
        if (data?.templates && data.templates.length > 0) {
          setActiveTemplate(getActiveInvoiceTemplate(data.templates));
        }
      })
      .catch(() => {
        // Fallback to default system template without error
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!printRequested) return;

    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        window.print();
        setPrintRequested(false);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [activeTemplate, printRequested]);

  if (!lines.length) return null;

  async function handlePrint() {
    setIsPreparingPrint(true);
    try {
      const response = await fetch('/api/settings/print-templates', { cache: 'no-store' });
      const data = response.ok ? await response.json() : null;
      if (data?.templates?.length) {
        setActiveTemplate(getActiveInvoiceTemplate(data.templates));
      }
    } catch {
      // Print with the last successfully loaded invoice template.
    } finally {
      setIsPreparingPrint(false);
      setPrintRequested(true);
    }
  }

  const pageDims = getPageDimensions(
    activeTemplate.page.size,
    activeTemplate.page.orientation,
    activeTemplate.page.widthMm,
    activeTemplate.page.heightMm,
  );

  return (
    <>
      {iconOnly ? (
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={isPreparingPrint}
          className={className || "p-1.5 rounded-lg transition-all border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-200 dark:hover:bg-slate-700"}
          title="چاپ سند"
          aria-label="چاپ سند"
        >
          <Printer size={14} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handlePrint()}
          disabled={isPreparingPrint}
          className={className || "document-secondary-button border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"}
        >
          <Printer size={15} />
          <span>چاپ سند</span>
        </button>
      )}

      {isMounted && createPortal(
        <div className="document-print-root hidden bg-white p-0 font-sans leading-relaxed text-right text-black" dir="rtl">
        <style>{`
          @media print {
            @page {
              size: ${pageDims.widthMm}mm ${pageDims.heightMm}mm;
              margin: 0;
            }
            html, body {
              width: ${pageDims.widthMm}mm;
              height: ${pageDims.heightMm}mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            body > *:not(.document-print-root) { display: none !important; }
            .document-print-root { display: block !important; }
            #printable-document {
              position: relative;
              width: ${pageDims.widthMm}mm;
              height: ${pageDims.heightMm}mm;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              overflow: hidden !important;
              break-after: avoid-page;
              page-break-after: avoid;
            }
          }
        `}</style>

        <div
          id="printable-document"
          style={{
            width: `${pageDims.widthMm}mm`,
            height: `${pageDims.heightMm}mm`,
            backgroundColor: activeTemplate.page.backgroundColor || '#ffffff',
            borderWidth: activeTemplate.page.borderEnabled ? `${activeTemplate.page.borderWidthMm}mm` : '0',
            borderColor: activeTemplate.page.borderColor || '#cbd5e1',
            borderStyle: activeTemplate.page.borderEnabled ? 'solid' : 'none',
            paddingTop: `${activeTemplate.page.marginTopMm || 0}mm`,
            paddingRight: `${activeTemplate.page.marginRightMm || 0}mm`,
            paddingBottom: `${activeTemplate.page.marginBottomMm || 0}mm`,
            paddingLeft: `${activeTemplate.page.marginLeftMm || 0}mm`,
          }}
          className="relative box-border text-slate-900 overflow-hidden"
        >
          {activeTemplate.elements.map((el) => {
            if (!el.visible) return null;

            return (
              <div
                key={el.id}
                style={{
                  position: 'absolute',
                  right: `${el.position.xMm}mm`, // RTL position
                  top: `${el.position.yMm}mm`,
                  width: `${el.size.widthMm}mm`,
                  height: `${el.size.heightMm}mm`,
                  fontFamily: el.style.fontFamily || 'Vazirmatn',
                  fontSize: el.style.fontSizePt ? `${el.style.fontSizePt}pt` : '9pt',
                  fontWeight: getFontWeightCss(el.style.fontWeight),
                  color: el.style.color || '#0f172a',
                  backgroundColor: el.style.backgroundColor || 'transparent',
                  textAlign: el.style.textAlign || 'right',
                  borderWidth: el.type === 'items_table' ? '0' : (el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0'),
                  borderColor: el.style.borderColor || 'transparent',
                  borderStyle: el.style.borderStyle || (el.style.borderWidthMm ? 'solid' : 'none'),
                  borderRadius: el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0',
                  opacity: el.style.opacity ?? 1,
                  zIndex: el.zIndex || 10,
                }}
                className="box-border overflow-hidden"
              >
                {renderRealPrintElementContent(el, settings, customer, documentNumber, documentDateJalali, lines, isFinalized, activeTemplate)}
              </div>
            );
          })}
        </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function renderRealPrintElementContent(
  el: InvoicePrintElement,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any,
  customer: Customer | null,
  documentNumber: string,
  documentDateJalali: string,
  lines: DocumentLine[],
  isFinalized: boolean,
  template: InvoicePrintTemplate,
) {
  switch (el.type) {
    case 'shop_name':
      return <div className="truncate" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}>{settings.printStoreName || settings.organizationName}</div>;

    case 'shop_slogan':
      return <div className="truncate text-amber-700" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'medium') }}>{el.content?.text || settings.printStoreSlogan || 'کیفیت و اصالت در ساخت طلا و جواهرات'}</div>;

    case 'custom_text':
      return (
        <div
          className="w-full h-full whitespace-pre-line leading-relaxed"
          style={{
            fontWeight: getFontWeightCss(el.style?.fontWeight || 'normal'),
            lineHeight: el.style.lineHeight || 1.4,
            padding: el.style.paddingMm ? `${el.style.paddingMm}mm` : undefined,
          }}
        >
          {el.content?.text || 'متن دلخواه'}
        </div>
      );

    case 'shape_rectangle':
      return <div className="w-full h-full" />;

    case 'shape_circle':
      return <div className="w-full h-full rounded-full" />;

    case 'shape_line_h':
      return (
        <div
          className="w-full"
          style={{
            borderTopWidth: `${el.style.borderWidthMm || 0.5}mm`,
            borderTopColor: el.style.borderColor || '#cbd5e1',
            borderTopStyle: el.style.borderStyle || 'solid',
            height: 0,
          }}
        />
      );

    case 'shape_line_v':
      return (
        <div
          className="h-full"
          style={{
            borderRightWidth: `${el.style.borderWidthMm || 0.5}mm`,
            borderRightColor: el.style.borderColor || '#cbd5e1',
            borderRightStyle: el.style.borderStyle || 'solid',
            width: 0,
          }}
        />
      );

    case 'shape_badge':
      return (
        <div className="w-full h-full flex items-center justify-center text-center px-1" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}>
          {el.content?.text || 'نشان'}
        </div>
      );

    case 'invoice_title':
      return <div className="truncate" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}>{el.content?.text || 'فاکتور فروش طلا و جواهر'}</div>;

    case 'temporary_invoice_badge':
      if (isFinalized) return null;
      return (
        <div className="font-extrabold flex items-center justify-center h-full text-red-600 bg-red-50 border border-red-300 rounded px-2">
          فاکتور موقت
        </div>
      );

    case 'shop_address':
      return <div className="truncate text-[85%]" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'normal') }}>{settings.printAddress}</div>;

    case 'shop_phone':
      return <div className="truncate text-[85%]" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'normal') }}>تلفن: {settings.printPhone}</div>;

    case 'invoice_number':
      return <div className="truncate" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}>شماره سند: {documentNumber || 'پیش‌نمایش'}</div>;

    case 'invoice_date':
      return <div className="truncate" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'normal') }}>تاریخ: {documentDateJalali}</div>;

    case 'customer_name':
      return (
        <div className="flex items-center justify-between px-2 h-full bg-slate-50 border border-slate-300 rounded">
          <span><strong>طرف‌حساب:</strong> {customer ? customer.name : 'عمومی'}</span>
          {customer?.customerCode && <span><strong>کد:</strong> {customer.customerCode}</span>}
          {customer?.phone1 && <span><strong>تلفن:</strong> {customer.phone1}</span>}
        </div>
      );

    case 'items_table': {
      const tableConfig: InvoiceTableConfiguration | undefined =
        template.table || (template.design as any)?.table;
      const allColumns: InvoiceTableColumn[] = tableConfig?.columns?.length ? tableConfig.columns : DEFAULT_TABLE_COLUMNS;
      const configuredCols: InvoiceTableColumn[] = allColumns
        .filter((column: InvoiceTableColumn): column is NonNullable<InvoiceTableColumn> => Boolean(column?.visible))
        .filter((column: InvoiceTableColumn) => column.id !== 'index' || tableConfig?.showIndexColumn !== false);

      if (!configuredCols.length) return null;

      const tableBorderColor = tableConfig?.borderColor || el.style.borderColor || '#94a3b8';
      const tableBorderWidth = tableConfig?.borderWidthMm ? `${tableConfig.borderWidthMm}mm` : (el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0.4mm');
      const tableBorderStyle = tableConfig?.borderStyle || el.style.borderStyle || 'solid';
      const tableRadius = tableConfig?.borderRadiusMm ? `${tableConfig.borderRadiusMm}mm` : (el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0');
      const showVertical = tableConfig?.showVerticalBorders !== false;
      const showHorizontal = tableConfig?.showHorizontalBorders !== false;
      const striped = Boolean(tableConfig?.stripedRows);
      const altBg = tableConfig?.alternateRowColor || '#f8fafc';

      return (
        <div
          className="w-full h-full overflow-hidden"
          style={{
            borderRadius: tableRadius,
            border: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`,
          }}
        >
          <table
            className="h-full w-full table-fixed border-collapse"
            style={{
              fontSize: tableConfig?.fontSizePt ? `${tableConfig.fontSizePt}pt` : '85%',
              color: tableConfig?.bodyTextColor || el.style.color || '#0f172a',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: tableConfig?.headerBackgroundColor || '#f1f5f9',
                  color: tableConfig?.headerTextColor || '#0f172a',
                  fontWeight: 700,
                  borderBottom: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`,
                }}
              >
                {configuredCols.map((col: InvoiceTableColumn, cIdx: number) => (
                  <th
                    key={col.id}
                    className="p-1 text-center"
                    style={{
                      width: col.widthMm ? `${col.widthMm}mm` : 'auto',
                      borderLeft: showVertical && cIdx < configuredCols.length - 1 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const rawWeight = Number(line.details.rawWeight) || 0;
                const purity = Number(line.details.purity) || 0;
                const c750 = line.converted750 || (rawWeight * purity) / 750;
                const isEven = idx % 2 === 1;

                return (
                  <tr
                    key={line.id}
                    style={{
                      height: template.table?.rowHeightMm ? `${template.table.rowHeightMm}mm` : undefined,
                      backgroundColor: striped && isEven ? altBg : undefined,
                      borderBottom: showHorizontal && idx < lines.length - 1 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                    }}
                  >
                    {configuredCols.map((col: InvoiceTableColumn, cIdx: number) => {
                      let cellVal: React.ReactNode = '-';
                      if (col.id === 'index') cellVal = toPersianDigits(idx + 1);
                      if (col.id === 'operation_type') {
                        const baseLabel = line.documentTypeLabel || line.documentSubType || 'فروش کار ساخته';
                        const wName = line.details?.workmanshipName?.trim();
                        const mode = tableConfig?.workmanshipDisplayMode || 'name_only';
                        if (wName) {
                          if (mode === 'name_only') {
                            cellVal = wName;
                          } else if (mode === 'operation_only') {
                            cellVal = baseLabel;
                          } else {
                            cellVal = `${baseLabel} (${wName})`;
                          }
                        } else {
                          cellVal = baseLabel;
                        }
                      }
                      if (col.id === 'metal_type') {
                        cellVal = line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا';
                      }
                      if (col.id === 'weight') cellVal = rawWeight ? toPersianDigits(rawWeight.toFixed(3)) : '-';
                      if (col.id === 'purity') cellVal = purity ? toPersianDigits(purity) : '-';
                      if (col.id === 'converted_weight') cellVal = c750 ? toPersianDigits(c750.toFixed(3)) : '-';
                      if (col.id === 'price_per_gram') {
                        const p = Number(line.details?.metalPrice) || 0;
                        cellVal = p > 0 ? toPersianDigits(p.toLocaleString('en-US')) : '-';
                      }
                      if (col.id === 'subtotal_price') {
                        const tot = Number(line.details?.totalAmount) || 0;
                        const disc = Number(line.details?.discountAmount) || 0;
                        const sub = tot > 0 || disc > 0 ? tot + disc : (Number(line.details?.metalTotalPrice) || 0);
                        cellVal = sub > 0 ? toPersianDigits(sub.toLocaleString('en-US')) : '-';
                      }
                      if (col.id === 'discount_amount') {
                        const disc = Number(line.details?.discountAmount) || 0;
                        cellVal = disc > 0 ? toPersianDigits(disc.toLocaleString('en-US')) : '۰';
                      }
                      if (col.id === 'total_price') {
                        const tot = Number(line.details?.totalAmount) || 0;
                        cellVal = tot > 0 ? toPersianDigits(tot.toLocaleString('en-US')) : '-';
                      }
                      if (col.id === 'lab_name') cellVal = line.details.labName || '-';
                      if (col.id === 'stamp_number') cellVal = line.details.stampNumber || '-';
                      if (col.id === 'description') {
                        cellVal = line.description || (line.details?.workmanshipName ? `کار ساخته: ${line.details.workmanshipName}` : '-');
                      }

                      return (
                        <td
                          key={col.id}
                          className="break-words p-1 text-center align-middle"
                          style={{
                            borderLeft: showVertical && cIdx < configuredCols.length - 1 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                            textAlign: col.textAlign || 'center',
                          }}
                        >
                          {cellVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    case 'totals_summary': {
      // Distinct Multi-metal accumulation logic: Gold, Silver, Platinum strictly kept separate
      const goldLines = lines.filter((l) => (l.details.metalType || 'gold') === 'gold');
      const silverLines = lines.filter((l) => l.details.metalType === 'silver');
      const platinumLines = lines.filter((l) => l.details.metalType === 'platinum');

      const totalGoldWeight = goldLines.reduce((acc, l) => acc + (Number(l.details.rawWeight) || 0), 0);
      const totalGold750 = goldLines.reduce((acc, l) => {
        const raw = Number(l.details.rawWeight) || 0;
        const purity = Number(l.details.purity) || 0;
        return acc + (l.converted750 || (raw * purity) / 750);
      }, 0);

      const totalSilverWeight = silverLines.reduce((acc, l) => acc + (Number(l.details.rawWeight) || 0), 0);
      const totalPlatinumWeight = platinumLines.reduce((acc, l) => acc + (Number(l.details.rawWeight) || 0), 0);

      let totalSubtotal = 0;
      let totalDiscount = 0;
      let totalAmount = 0;

      for (const l of lines) {
        const tot = Number(l.details?.totalAmount) || 0;
        const disc = Number(l.details?.discountAmount) || 0;
        const sub = tot > 0 || disc > 0 ? tot + disc : (Number(l.details?.metalTotalPrice) || 0);
        totalAmount += tot;
        totalDiscount += disc;
        totalSubtotal += sub;
      }

      const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

      return (
        <div className="flex flex-wrap items-center justify-around h-full font-bold text-[85%] px-3 bg-slate-100 border border-slate-300 rounded gap-2">
          {totalGoldWeight > 0 && <span>جمع طلا (۷۵۰): {toPersianDigits(totalGold750.toFixed(3))} گرم</span>}
          {totalSilverWeight > 0 && <span>جمع نقره: {toPersianDigits(totalSilverWeight.toFixed(3))} گرم</span>}
          {totalPlatinumWeight > 0 && <span>جمع پلاتین: {toPersianDigits(totalPlatinumWeight.toFixed(3))} گرم</span>}
          {totalSubtotal > 0 && (
            <span>قیمت کل قبل از تخفیف: {toPersianDigits(totalSubtotal.toLocaleString('en-US'))} {currencySuffix}</span>
          )}
          {totalDiscount > 0 && (
            <span>مجموع تخفیف: {toPersianDigits(totalDiscount.toLocaleString('en-US'))} {currencySuffix}</span>
          )}
          {totalAmount > 0 && (
            <span>مبلغ قابل پرداخت: {toPersianDigits(totalAmount.toLocaleString('en-US'))} {currencySuffix}</span>
          )}
          <span>تعداد ردیف: {toPersianDigits(lines.length)}</span>
        </div>
      );
    }

    case 'footer_text':
      return (
        <div className="truncate text-[85%] text-center whitespace-pre-line leading-relaxed" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'normal') }}>
          {el.content?.text || template.footer?.footerText || settings.printFooterText || ''}
        </div>
      );

    case 'seller_signature':
      return <div className="border-t border-dashed border-slate-400 pt-2 text-center" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}>{template.footer?.sellerSignatureTitle || 'امضای فروشنده'}</div>;

    case 'customer_signature':
      return <div className="border-t border-dashed border-slate-400 pt-2 text-center" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}>{template.footer?.customerSignatureTitle || 'امضای خریدار / مشتری'}</div>;

    case 'stamp':
      return <div className="border-t border-dashed border-slate-400 pt-2 text-center" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}>{el.content?.text || 'مهر و امضای فروشگاه'}</div>;

    case 'print_datetime':
      return <div className="text-[75%] text-slate-600" style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'normal') }}>تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}</div>;

    default:
      return null;
  }
}
