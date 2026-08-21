'use client';

import React, { useState, useEffect } from 'react';
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

type DocumentPrintProps = {
  customer: Customer | null;
  documentNumber: string;
  documentDateJalali: string;
  lines: DocumentLine[];
  isFinalized?: boolean;
};

export default function DocumentPrint({
  customer,
  documentNumber,
  documentDateJalali,
  lines,
  isFinalized = false,
}: DocumentPrintProps) {
  const { settings } = useAppSettings();

  const [activeTemplate, setActiveTemplate] = useState<InvoicePrintTemplate>(DEFAULT_SYSTEM_TEMPLATES[0]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/settings/print-templates', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!mounted) return;
        if (data?.templates && data.templates.length > 0) {
          const active = data.templates.find((t: InvoicePrintTemplate) => t.isActive) || data.templates[0];
          setActiveTemplate(active);
        }
      })
      .catch(() => {
        // Fallback to default system template without error
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!lines.length) return null;

  function handlePrint() {
    window.print();
  }

  const pageDims = getPageDimensions(
    activeTemplate.page.size,
    activeTemplate.page.orientation,
    activeTemplate.page.widthMm,
    activeTemplate.page.heightMm,
  );

  return (
    <>
      <button
        type="button"
        onClick={handlePrint}
        className="document-secondary-button border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
      >
        <Printer size={15} />
        <span>چاپ سند</span>
      </button>

      {/* Hidden Print Container for CSS @media print */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-0 font-sans leading-relaxed text-right dir-rtl">
        <style>{`
          @media print {
            @page {
              size: ${pageDims.widthMm}mm ${pageDims.heightMm}mm;
              margin: 0;
            }
            body * { visibility: hidden; }
            #printable-document, #printable-document * { visibility: visible; }
            #printable-document {
              position: absolute;
              left: 0;
              top: 0;
              width: ${pageDims.widthMm}mm;
              height: ${pageDims.heightMm}mm;
              margin: 0;
              padding: 0;
              box-sizing: border-box;
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
      </div>
    </>
  );
}

function renderRealPrintElementContent(
  el: InvoicePrintElement,
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
      const configuredCols = template.table?.columns.filter((c) => c.visible) || DEFAULT_TABLE_COLUMNS;

      return (
        <table className="w-full h-full text-[85%] border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-bold">
              {configuredCols.map((col) => (
                <th
                  key={col.id}
                  style={{ width: col.widthMm ? `${col.widthMm}mm` : 'auto' }}
                  className="p-1 border border-slate-400"
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
                <tr key={line.id} className="border-b border-slate-300">
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
                      <td key={col.id} className="p-1 border border-slate-300 text-center">
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
