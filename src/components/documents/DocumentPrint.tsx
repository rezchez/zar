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
  AVAILABLE_TABLE_COLUMNS,
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
                {renderRealPrintElementContent(el, settings, customer, documentNumber, documentDateJalali, lines, isFinalized)}
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
      const cols = el.content?.tableColumns || [
        'index',
        'operation_type',
        'metal_type',
        'weight',
        'purity',
        'converted_weight',
        'lab_name',
        'stamp_number',
        'description',
      ];

      return (
        <table className="w-full h-full text-[85%] border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-400 font-bold">
              {cols.map((colId) => (
                <th key={colId} className="p-1 border border-slate-400">
                  {AVAILABLE_TABLE_COLUMNS.find((c) => c.id === colId)?.label || colId}
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
                  {cols.map((colId) => {
                    let cellVal: React.ReactNode = '-';
                    if (colId === 'index') cellVal = idx + 1;
                    if (colId === 'operation_type') cellVal = line.documentTypeLabel || line.documentSubType;
                    if (colId === 'metal_type') {
                      cellVal = line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا';
                    }
                    if (colId === 'weight') cellVal = rawWeight ? rawWeight.toFixed(3) : '-';
                    if (colId === 'purity') cellVal = purity || '-';
                    if (colId === 'converted_weight') cellVal = c750 ? c750.toFixed(3) : '-';
                    if (colId === 'lab_name') cellVal = line.details.labName || '-';
                    if (colId === 'stamp_number') cellVal = line.details.stampNumber || '-';
                    if (colId === 'description') cellVal = line.description || '-';

                    return (
                      <td key={colId} className="p-1 border border-slate-300 text-center">
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
      const totalWeight = lines.reduce((acc, line) => acc + (Number(line.details.rawWeight) || 0), 0);
      const total750 = lines.reduce((acc, line) => {
        const raw = Number(line.details.rawWeight) || 0;
        const purity = Number(line.details.purity) || 0;
        return acc + (line.converted750 || (raw * purity) / 750);
      }, 0);

      return (
        <div className="flex items-center justify-around h-full font-bold text-[90%] px-3 bg-slate-100 border border-slate-300 rounded">
          <span>جمع وزن فلز: {totalWeight.toFixed(3)} گرم</span>
          <span>جمع وزن معادل ۷۵۰: {total750.toFixed(3)} گرم</span>
          <span>تعداد ردیف: {lines.length}</span>
        </div>
      );
    }

    case 'footer_text':
      return <div className="truncate text-[85%] text-center">{settings.printFooterText}</div>;

    case 'seller_signature':
      return <div className="border-t border-dashed border-slate-400 pt-2 text-center font-bold">{el.content?.text || 'امضای خریدار / مشتری'}</div>;

    case 'stamp':
      return <div className="border-t border-dashed border-slate-400 pt-2 text-center font-bold">{el.content?.text || 'مهر و امضای فروشگاه'}</div>;

    case 'print_datetime':
      return <div className="text-[75%] text-slate-600">تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}</div>;

    default:
      return null;
  }
}
