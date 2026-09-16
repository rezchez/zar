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
  DEFAULT_SYSTEM_TEMPLATES,
  getPageDimensions,
  DEFAULT_TABLE_COLUMNS,
} from '@/lib/print-templates';

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
                  fontWeight: el.style.fontWeight || 'normal',
                  color: el.style.color || '#0f172a',
                  backgroundColor: el.style.backgroundColor || 'transparent',
                  textAlign: el.style.textAlign || 'right',
                  borderWidth: el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0',
                  borderColor: el.style.borderColor || 'transparent',
                  borderStyle: el.style.borderWidthMm ? 'solid' : 'none',
                  borderRadius: el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0',
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
      return <div className="font-bold truncate">{settings.printStoreName || settings.organizationName}</div>;

    case 'shop_slogan':
      return <div className="font-medium text-amber-700 truncate">{el.content?.text || 'کیفیت و اصالت در ساخت طلا و جواهرات'}</div>;

    case 'invoice_title':
      return <div className="font-bold truncate">{el.content?.text || 'فاکتور فروش طلا و جواهر'}</div>;

    case 'temporary_invoice_badge':
      if (isFinalized) return null;
      return (
        <div className="font-extrabold flex items-center justify-center h-full text-red-600 bg-red-50 border border-red-300 rounded px-2">
          فاکتور موقت
        </div>
      );

    case 'shop_address':
      return <div className="truncate text-[85%]">{settings.printAddress}</div>;

    case 'shop_phone':
      return <div className="truncate text-[85%]">تلفن: {settings.printPhone}</div>;

    case 'invoice_number':
      return <div className="truncate font-bold">شماره سند: {documentNumber || 'پیش‌نمایش'}</div>;

    case 'invoice_date':
      return <div className="truncate">تاریخ: {documentDateJalali}</div>;

    case 'customer_name':
      return (
        <div className="flex items-center justify-between px-2 h-full bg-slate-50 border border-slate-300 rounded">
          <span><strong>طرف‌حساب:</strong> {customer ? customer.name : 'عمومی'}</span>
          {customer?.customerCode && <span><strong>کد:</strong> {customer.customerCode}</span>}
          {customer?.phone1 && <span><strong>تلفن:</strong> {customer.phone1}</span>}
        </div>
      );

    case 'items_table': {
      const allColumns = template.table?.columns?.length ? template.table.columns : DEFAULT_TABLE_COLUMNS;
      const configuredColumnIds = el.content?.tableColumns?.length
        ? el.content.tableColumns
        : allColumns.filter((column) => column.visible).map((column) => column.id);
      const configuredCols = configuredColumnIds
        .map((columnId) => allColumns.find((column) => column.id === columnId))
        .filter((column): column is NonNullable<typeof column> => Boolean(column?.visible))
        .filter((column) => column.id !== 'index' || template.table?.showIndexColumn !== false);

      if (!configuredCols.length) return null;

      return (
        <table
          className="h-full w-full table-fixed border-collapse"
          style={{
            fontSize: template.table?.fontSizePt ? `${template.table.fontSizePt}pt` : '85%',
            color: template.table?.bodyTextColor || el.style.color || '#0f172a',
            borderColor: template.table?.borderColor || el.style.borderColor || '#94a3b8',
            borderWidth: template.table?.borderWidthMm ? `${template.table.borderWidthMm}mm` : undefined,
          }}
        >
          <thead>
            <tr
              className="font-bold"
              style={{
                backgroundColor: template.table?.headerBackgroundColor || '#f1f5f9',
                color: template.table?.headerTextColor || '#0f172a',
              }}
            >
              {configuredCols.map((col) => (
                <th
                  key={col.id}
                  className="border p-1 text-center"
                  style={{
                    width: col.widthMm ? `${col.widthMm}mm` : 'auto',
                    borderColor: template.table?.borderColor || el.style.borderColor || '#94a3b8',
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

              return (
                <tr key={line.id} style={{ height: template.table?.rowHeightMm ? `${template.table.rowHeightMm}mm` : undefined }}>
                  {configuredCols.map((col) => {
                    let cellVal: React.ReactNode = '-';
                    if (col.id === 'index') cellVal = idx + 1;
                    if (col.id === 'operation_type') cellVal = line.documentTypeLabel || line.documentSubType;
                    if (col.id === 'metal_type') {
                      cellVal = line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا';
                    }
                    if (col.id === 'weight') cellVal = rawWeight ? rawWeight.toFixed(3) : '-';
                    if (col.id === 'purity') cellVal = purity || '-';
                    if (col.id === 'converted_weight') cellVal = c750 ? c750.toFixed(3) : '-';
                    if (col.id === 'lab_name') cellVal = line.details.labName || '-';
                    if (col.id === 'stamp_number') cellVal = line.details.stampNumber || '-';
                    if (col.id === 'description') cellVal = line.description || '-';

                    return (
                      <td
                        key={col.id}
                        className="break-words border p-1 text-center align-middle"
                        style={{
                          borderColor: template.table?.borderColor || el.style.borderColor || '#94a3b8',
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

      return (
        <div className="flex flex-wrap items-center justify-around h-full font-bold text-[85%] px-3 bg-slate-100 border border-slate-300 rounded">
          {totalGoldWeight > 0 && <span>جمع طلا (۷۵۰): {totalGold750.toFixed(3)} گرم</span>}
          {totalSilverWeight > 0 && <span>جمع نقره: {totalSilverWeight.toFixed(3)} گرم</span>}
          {totalPlatinumWeight > 0 && <span>جمع پلاتین: {totalPlatinumWeight.toFixed(3)} گرم</span>}
          <span>تعداد ردیف: {lines.length}</span>
        </div>
      );
    }

    case 'footer_text':
      return <div className="truncate text-[85%] text-center">{settings.printFooterText}</div>;

    case 'seller_signature':
      return <div className="border-t border-dashed border-slate-400 pt-2 text-center font-bold">{template.footer?.sellerSignatureTitle || 'امضای فروشنده'}</div>;

    case 'stamp':
      return <div className="border-t border-dashed border-slate-400 pt-2 text-center font-bold">{template.footer?.customerSignatureTitle || 'مهر و امضای فروشگاه'}</div>;

    case 'print_datetime':
      return <div className="text-[75%] text-slate-600">تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}</div>;

    default:
      return null;
  }
}
