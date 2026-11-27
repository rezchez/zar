'use client';

import React, { useState, useEffect, useId, useMemo } from 'react';
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
  type InvoiceCustomTableField,
  DEFAULT_SYSTEM_TEMPLATES,
  getPageDimensions,
  DEFAULT_TABLE_COLUMNS,
  getFontWeightCss,
  resolveQrCodeValue,
} from '@/lib/print-templates';
import { toPersianDigits } from '@/lib/jalali';
import { QrCodeSvg } from '@/lib/qr-code';
import {
  isMetalBearingLine,
  getLineDocumentTypeLabel,
} from '@/features/accounting/documents/utils/document-helpers';

export function getCapacityForPageSize(size: string, heightMm: number): {
  singlePageCapacity: number;
  firstPageCapacity: number;
  middlePageCapacity: number;
  lastPageCapacity: number;
} {
  if (size.startsWith('receipt')) {
    return {
      singlePageCapacity: 9999,
      firstPageCapacity: 9999,
      middlePageCapacity: 9999,
      lastPageCapacity: 9999,
    };
  }

  if (heightMm >= 280) {
    // A4 Portrait (~297mm)
    return {
      singlePageCapacity: 12,
      firstPageCapacity: 16,
      middlePageCapacity: 22,
      lastPageCapacity: 12,
    };
  } else if (heightMm >= 200) {
    // A4 Landscape (~210mm) or A5 Portrait (~210mm)
    return {
      singlePageCapacity: 8,
      firstPageCapacity: 11,
      middlePageCapacity: 15,
      lastPageCapacity: 8,
    };
  } else {
    // A5 Landscape (~148mm) or smaller
    return {
      singlePageCapacity: 5,
      firstPageCapacity: 7,
      middlePageCapacity: 9,
      lastPageCapacity: 5,
    };
  }
}

export function chunkDocumentLinesForPrint(
  items: DocumentLine[],
  capacities: {
    singlePageCapacity: number;
    firstPageCapacity: number;
    middlePageCapacity: number;
    lastPageCapacity: number;
  },
): DocumentLine[][] {
  const { singlePageCapacity, firstPageCapacity, middlePageCapacity, lastPageCapacity } = capacities;
  if (items.length === 0) return [[]];
  if (items.length <= singlePageCapacity) {
    return [items];
  }

  const pages: DocumentLine[][] = [];
  let remaining = [...items];

  // If remaining lines fit in exactly 2 pages:
  if (remaining.length <= firstPageCapacity + lastPageCapacity) {
    const firstTake = Math.min(
      firstPageCapacity,
      Math.max(Math.ceil(remaining.length / 2), remaining.length - lastPageCapacity),
    );
    pages.push(remaining.slice(0, firstTake));
    pages.push(remaining.slice(firstTake));
    return pages;
  }

  // First page takes firstPageCapacity
  pages.push(remaining.slice(0, firstPageCapacity));
  remaining = remaining.slice(firstPageCapacity);

  // Subsequent pages
  while (remaining.length > 0) {
    if (remaining.length <= lastPageCapacity) {
      pages.push(remaining);
      break;
    }

    if (remaining.length <= middlePageCapacity + lastPageCapacity) {
      const take = Math.min(
        middlePageCapacity,
        Math.max(Math.ceil(remaining.length / 2), remaining.length - lastPageCapacity),
      );
      pages.push(remaining.slice(0, take));
      pages.push(remaining.slice(take));
      break;
    }

    pages.push(remaining.slice(0, middlePageCapacity));
    remaining = remaining.slice(middlePageCapacity);
  }

  return pages;
}

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
  const printRootId = `document-print-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const printableContentId = `${printRootId}-content`;

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
        document.body.setAttribute('data-printing-document', printRootId);
        const selectedPrintRoot = document.getElementById(printRootId);
        if (!selectedPrintRoot) {
          document.body.removeAttribute('data-printing-document');
          setPrintRequested(false);
          return;
        }

        const printRoots = Array.from(document.querySelectorAll<HTMLElement>('.document-print-root'));
        const previousDisplayStyles = printRoots.map((root) => ({
          root,
          value: root.style.getPropertyValue('display'),
          priority: root.style.getPropertyPriority('display'),
        }));

        for (const root of printRoots) {
          root.style.setProperty('display', root === selectedPrintRoot ? 'block' : 'none', 'important');
        }

        try {
          window.print();
        } finally {
          for (const { root, value, priority } of previousDisplayStyles) {
            if (value) {
              root.style.setProperty('display', value, priority);
            } else {
              root.style.removeProperty('display');
            }
          }
          document.body.removeAttribute('data-printing-document');
          setPrintRequested(false);
        }
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

  const capacities = useMemo(
    () => getCapacityForPageSize(activeTemplate.page.size, pageDims.heightMm),
    [activeTemplate.page.size, pageDims.heightMm],
  );

  const pages = useMemo(
    () => chunkDocumentLinesForPrint(lines, capacities),
    [lines, capacities],
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
        <div id={printRootId} className="document-print-root hidden bg-white p-0 font-sans leading-relaxed text-right text-black" dir="rtl">
        <style>{`
          @media print {
            @page {
              size: ${pageDims.widthMm}mm ${pageDims.heightMm}mm;
              margin: 0;
            }
            html, body {
              width: ${pageDims.widthMm}mm;
              margin: 0 !important;
              padding: 0 !important;
              background-color: #ffffff !important;
            }
            body > *:not(.document-print-root) { display: none !important; }
            body .document-print-root { display: block !important; }
            body[data-printing-document="${printRootId}"] #${printRootId} { display: block !important; }
            #${printRootId} {
              display: block !important;
              width: ${pageDims.widthMm}mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            #${printRootId} .document-print-page {
              position: relative;
              width: ${pageDims.widthMm}mm;
              min-height: ${activeTemplate.page.size.startsWith('receipt') ? 'auto' : `${pageDims.heightMm}mm`};
              height: ${activeTemplate.page.size.startsWith('receipt') ? 'auto' : `${pageDims.heightMm}mm`};
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              overflow: hidden !important;
              page-break-after: always;
              break-after: page;
            }
            #${printRootId} .document-print-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
            ${activeTemplate.page.size.startsWith('receipt') ? `
              #${printRootId} .document-print-page {
                page-break-after: auto !important;
                break-after: auto !important;
                height: auto !important;
                min-height: auto !important;
                overflow: visible !important;
              }
            ` : ''}
          }
        `}</style>

        <div id={printableContentId} className="flex flex-col">
          {pages.map((pageLines, pageIdx) => {
            const isSinglePage = pages.length === 1;
            const isFirstPage = pageIdx === 0;
            const isLastPage = pageIdx === pages.length - 1;
            const lineOffset = pages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0);

            const tableEl = activeTemplate.elements.find((el) => el.type === 'items_table' && el.visible);
            const tableTopY = tableEl ? tableEl.position.yMm : 45;
            const tableWidth = tableEl ? tableEl.size.widthMm : (pageDims.widthMm - 20);
            const tableRightX = tableEl ? tableEl.position.xMm : 10;

            const isFooterType = (t: string) => [
              'totals_summary',
              'custom_table',
              'seller_signature',
              'customer_signature',
              'stamp',
              'footer_text',
              'print_datetime',
            ].includes(t);

            const isBelowTable = (el: InvoicePrintElement) =>
              isFooterType(el.type) || el.position.yMm >= (tableEl ? tableEl.position.yMm + tableEl.size.heightMm - 5 : 150);

            return (
              <div
                key={`page-${pageIdx}`}
                style={{
                  width: `${pageDims.widthMm}mm`,
                  height: activeTemplate.page.size.startsWith('receipt') ? 'auto' : `${pageDims.heightMm}mm`,
                  minHeight: activeTemplate.page.size.startsWith('receipt') ? 'auto' : `${pageDims.heightMm}mm`,
                  backgroundColor: activeTemplate.page.backgroundColor || '#ffffff',
                  borderWidth: activeTemplate.page.borderEnabled ? `${activeTemplate.page.borderWidthMm}mm` : '0',
                  borderColor: activeTemplate.page.borderColor || '#cbd5e1',
                  borderStyle: activeTemplate.page.borderEnabled ? 'solid' : 'none',
                  padding: 0,
                }}
                className="document-print-page relative box-border text-slate-900 overflow-hidden"
              >
                {isSinglePage ? (
                  // Single page mode: render all configured template elements
                  activeTemplate.elements.map((el) => {
                    if (!el.visible) return null;

                    return (
                      <div
                        key={el.id}
                        style={{
                          position: 'absolute',
                          right: `${el.position.xMm}mm`,
                          top: `${el.position.yMm}mm`,
                          width: `${el.size.widthMm}mm`,
                          height: el.type === 'items_table' ? 'auto' : `${el.size.heightMm}mm`,
                          maxHeight: undefined,
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
                        className={`box-border ${el.type === 'items_table' ? 'overflow-visible' : 'overflow-hidden'}`}
                      >
                        {renderRealPrintElementContent(
                          el,
                          settings,
                          customer,
                          documentNumber,
                          documentDateJalali,
                          pageLines,
                          isFinalized,
                          activeTemplate,
                          0,
                          lines,
                        )}
                      </div>
                    );
                  })
                ) : (
                  // Multi-page mode:
                  <>
                    {/* 1. Header Area */}
                    {isFirstPage ? (
                      activeTemplate.elements
                        .filter((el) => el.visible && !isBelowTable(el) && el.type !== 'items_table')
                        .map((el) => (
                          <div
                            key={el.id}
                            style={{
                              position: 'absolute',
                              right: `${el.position.xMm}mm`,
                              top: `${el.position.yMm}mm`,
                              width: `${el.size.widthMm}mm`,
                              height: `${el.size.heightMm}mm`,
                              fontFamily: el.style.fontFamily || 'Vazirmatn',
                              fontSize: el.style.fontSizePt ? `${el.style.fontSizePt}pt` : '9pt',
                              fontWeight: getFontWeightCss(el.style.fontWeight),
                              color: el.style.color || '#0f172a',
                              backgroundColor: el.style.backgroundColor || 'transparent',
                              textAlign: el.style.textAlign || 'right',
                              borderWidth: el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0',
                              borderColor: el.style.borderColor || 'transparent',
                              borderStyle: el.style.borderStyle || (el.style.borderWidthMm ? 'solid' : 'none'),
                              borderRadius: el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0',
                              opacity: el.style.opacity ?? 1,
                              zIndex: el.zIndex || 10,
                            }}
                            className="box-border overflow-hidden"
                          >
                            {renderRealPrintElementContent(
                              el,
                              settings,
                              customer,
                              documentNumber,
                              documentDateJalali,
                              pageLines,
                              isFinalized,
                              activeTemplate,
                              0,
                              lines,
                            )}
                          </div>
                        ))
                    ) : (
                      // Compact top bar on subsequent pages
                      <div
                        style={{
                          position: 'absolute',
                          top: `${(activeTemplate.page.marginTopMm || 6)}mm`,
                          right: `${tableRightX}mm`,
                          width: `${tableWidth}mm`,
                        }}
                        className="flex items-center justify-between border-b border-slate-300 pb-1.5 text-[8.5pt]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{settings.printStoreName || settings.organizationName}</span>
                          <span className="text-slate-300">|</span>
                          <span>شماره سند: <strong className="font-mono">{documentNumber || 'پیش‌نمایش'}</strong></span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span>طرف‌حساب: <strong>{customer ? customer.name : 'عمومی'}</strong></span>
                          <span className="text-slate-300">|</span>
                          <span>تاریخ: <strong className="font-mono">{documentDateJalali}</strong></span>
                          <span className="text-slate-300">|</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-700">
                            صفحه {toPersianDigits(pageIdx + 1)} از {toPersianDigits(pages.length)} {isLastPage ? '(پایان سند)' : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 2. Items Table for current page */}
                    {tableEl && (
                      <div
                        key={tableEl.id}
                        style={{
                          position: 'absolute',
                          right: `${tableRightX}mm`,
                          top: `${isFirstPage ? tableTopY : (activeTemplate.page.marginTopMm || 6) + 12}mm`,
                          width: `${tableWidth}mm`,
                          fontFamily: tableEl.style.fontFamily || 'Vazirmatn',
                          color: tableEl.style.color || '#0f172a',
                          zIndex: tableEl.zIndex || 10,
                        }}
                        className="box-border overflow-hidden"
                      >
                        {renderRealPrintElementContent(
                          tableEl,
                          settings,
                          customer,
                          documentNumber,
                          documentDateJalali,
                          pageLines,
                          isFinalized,
                          activeTemplate,
                          lineOffset,
                          lines,
                        )}
                      </div>
                    )}

                    {/* 3. Bottom continuation notice on intermediate/first pages */}
                    {!isLastPage && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: `${(activeTemplate.page.marginBottomMm || 6) + 2}mm`,
                          right: `${tableRightX}mm`,
                          width: `${tableWidth}mm`,
                        }}
                        className="flex items-center justify-between border-t border-dashed border-slate-300 pt-1 text-[8pt] text-slate-500"
                      >
                        <span className="font-bold text-amber-700">ادامه اقلام در صفحه بعدی...</span>
                        <span>صفحه {toPersianDigits(pageIdx + 1)} از {toPersianDigits(pages.length)}</span>
                      </div>
                    )}

                    {/* 4. Footer elements on last page dynamically flowed below the table */}
                    {isLastPage && (() => {
                      const lastPageTableTop = (activeTemplate.page.marginTopMm || 6) + 12;
                      const lastPageTableHeight = 8 + (pageLines.length * (activeTemplate.table?.rowHeightMm || 7.5));
                      const lastPageTableBottom = lastPageTableTop + lastPageTableHeight;
                      const originalTableBottom = (tableEl?.position.yMm || 45) + (tableEl?.size.heightMm || 120);

                      const footerElements = activeTemplate.elements.filter((el) => el.visible && isBelowTable(el));

                      return footerElements.map((el) => {
                        const deltaFromOriginalTable = el.position.yMm - originalTableBottom;
                        const dynamicTop = deltaFromOriginalTable >= 0
                          ? lastPageTableBottom + 3 + deltaFromOriginalTable
                          : Math.max(el.position.yMm, lastPageTableBottom + 3);

                        return (
                          <div
                            key={el.id}
                            style={{
                              position: 'absolute',
                              right: `${el.position.xMm}mm`,
                              top: `${dynamicTop}mm`,
                              width: `${el.size.widthMm}mm`,
                              height: `${el.size.heightMm}mm`,
                              fontFamily: el.style.fontFamily || 'Vazirmatn',
                              fontSize: el.style.fontSizePt ? `${el.style.fontSizePt}pt` : '9pt',
                              fontWeight: getFontWeightCss(el.style.fontWeight),
                              color: el.style.color || '#0f172a',
                              backgroundColor: el.style.backgroundColor || 'transparent',
                              textAlign: el.style.textAlign || 'right',
                              borderWidth: el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0',
                              borderColor: el.style.borderColor || 'transparent',
                              borderStyle: el.style.borderStyle || (el.style.borderWidthMm ? 'solid' : 'none'),
                              borderRadius: el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0',
                              opacity: el.style.opacity ?? 1,
                              zIndex: el.zIndex || 10,
                            }}
                            className="box-border overflow-hidden"
                          >
                            {renderRealPrintElementContent(
                              el,
                              settings,
                              customer,
                              documentNumber,
                              documentDateJalali,
                              pageLines,
                              isFinalized,
                              activeTemplate,
                              lineOffset,
                              lines,
                            )}
                          </div>
                        );
                      });
                    })()}
                  </>
                )}
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
  lineIndexOffset = 0,
  allLines: DocumentLine[] = lines,
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

    case 'db_field': {
      const fieldKey = el.content?.fieldKey || '';
      const label = el.content?.fieldLabel || '';
      const showLabel = el.content?.showFieldLabel !== false;
      const unit = el.content?.fieldUnit || '';
      const showUnit = el.content?.showFieldUnit !== false;

      if (fieldKey === 'custom_qrcode') {
        const qrValue = resolveQrCodeValue(
          el.content?.qrContentType,
          el.content?.text,
          {
            documentNumber,
            customerName: customer?.name,
            date: documentDateJalali,
          },
        );
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-0.5 bg-white rounded overflow-hidden">
            <QrCodeSvg value={qrValue} margin={0.5} backgroundColor="#ffffff" color="#000000" />
            {showLabel && label && (
              <span className="text-[70%] font-bold text-center text-slate-900 truncate max-w-full mt-0.5">{label}</span>
            )}
          </div>
        );
      }

      const resolvedMap = computeDocumentCustomTableValues(customer, allLines.length > 0 ? allLines : lines, settings);
      const val = resolvedMap[fieldKey] || '-';

      return (
        <div
          dir="rtl"
          className="w-full h-full flex items-center justify-between px-2 gap-1 overflow-hidden"
          style={{
            fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold'),
            textAlign: el.style.textAlign || 'right',
            padding: el.style.paddingMm ? `${el.style.paddingMm}mm` : undefined,
          }}
        >
          {showLabel && label && (
            <span className="shrink-0 text-[90%] opacity-85 pl-1">{label}:</span>
          )}
          <span className="font-mono flex items-center gap-1 overflow-hidden truncate">
            <bdi>{val}</bdi>
            {showUnit && unit ? <span className="text-[80%] font-normal opacity-75">{unit}</span> : null}
          </span>
        </div>
      );
    }

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
      const rowMinHeight = tableConfig?.rowHeightMm ? `${tableConfig.rowHeightMm}mm` : '7.5mm';
      const fontSize = tableConfig?.fontSizePt ? `${tableConfig.fontSizePt}pt` : '8.5pt';
      const totalColsWidthMm = configuredCols.reduce((sum: number, c: InvoiceTableColumn) => sum + (c.widthMm || 20), 0) || 1;

      return (
        <div
          className="w-full"
          style={{
            borderRadius: tableRadius,
            border: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`,
            overflow: tableRadius && tableRadius !== '0' && tableRadius !== '0mm' ? 'hidden' : 'visible',
            boxSizing: 'border-box',
          }}
        >
          <table
            className="w-full table-fixed border-collapse"
            style={{
              fontSize,
              color: tableConfig?.bodyTextColor || el.style.color || '#0f172a',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: tableConfig?.headerBackgroundColor || '#f1f5f9',
                  color: tableConfig?.headerTextColor || '#0f172a',
                  fontWeight: 700,
                  height: '8mm',
                  borderBottom: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`,
                }}
              >
                {configuredCols.map((col: InvoiceTableColumn, cIdx: number) => {
                  const colPercent = ((col.widthMm || 20) / totalColsWidthMm) * 100;
                  return (
                    <th
                      key={col.id}
                      className="py-1 px-1 text-center align-middle whitespace-normal break-words leading-tight"
                      style={{
                        width: `${colPercent.toFixed(3)}%`,
                        borderLeft: showVertical && cIdx < configuredCols.length - 1 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                      }}
                    >
                      {col.label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const det = (line.details || {}) as Record<string, any>;
                const isMetal = isMetalBearingLine(line);
                const rawWeight = Number(det.rawWeight) || 0;
                const purity = Number(det.purity) || 0;
                const c750 = typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
                  ? line.converted750
                  : (rawWeight > 0 && purity > 0 ? (rawWeight * purity) / 750 : 0);
                const isEven = idx % 2 === 1;
                const docTab = String(line.documentTab || line.sourceTab || '');

                return (
                  <tr
                    key={line.id || `line-${lineIndexOffset + idx}`}
                    style={{
                      minHeight: rowMinHeight,
                      height: tableConfig?.rowHeightMm ? `${tableConfig.rowHeightMm}mm` : undefined,
                      backgroundColor: striped && isEven ? altBg : undefined,
                      borderBottom: showHorizontal && idx < lines.length - 1 ? `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}` : undefined,
                    }}
                  >
                    {configuredCols.map((col: InvoiceTableColumn, cIdx: number) => {
                      let cellVal: React.ReactNode = '-';
                      if (col.id === 'index') {
                        cellVal = toPersianDigits(lineIndexOffset + idx + 1);
                      } else if (col.id === 'operation_type') {
                        const rawOpKind = (line as any).rawOperationKind || det?.rawOperationKind;
                        const unsettledTrade = Boolean((line as any).unsettledTrade || det?.unsettledTrade);
                        const baseLabel = getLineDocumentTypeLabel(
                          line.documentNature === 'paid' ? 'paid' : 'received',
                          docTab,
                          rawOpKind,
                          unsettledTrade,
                          det.refiningOpKind,
                          det.workmanshipOptionId,
                          line.documentSubType || det.workmanshipSubType,
                          det.metalType,
                          det.claimFinancial,
                          det.claimWeight,
                          det.percentage,
                        ) || line.documentTypeLabel || line.documentSubType || 'ثبت سند';

                        const wName = det?.workmanshipName?.trim();
                        const mode = tableConfig?.workmanshipDisplayMode || 'name_only';
                        if (wName) {
                          if (mode === 'name_only') {
                            cellVal = wName;
                          } else if (mode === 'operation_only') {
                            cellVal = baseLabel;
                          } else {
                            cellVal = `${baseLabel} (${wName})`;
                          }
                        } else if (docTab === 'coin' && Number(det.coinCount) > 1) {
                          cellVal = `${baseLabel} (${toPersianDigits(det.coinCount)} عدد)`;
                        } else if (docTab === 'etiquette' && det.barcode) {
                          cellVal = `${baseLabel} [${toPersianDigits(det.barcode)}]`;
                        } else {
                          cellVal = baseLabel;
                        }
                      } else if (col.id === 'metal_type') {
                        if (isMetal) {
                          cellVal = det.metalType === 'silver' ? 'نقره' : det.metalType === 'platinum' ? 'پلاتین' : 'طلا';
                        } else if (docTab === 'currency') {
                          cellVal = det.currencyUnit || 'ارز';
                        } else if (docTab === 'cash' || docTab === 'bank' || docTab === 'cheque') {
                          cellVal = 'مالی';
                        } else if (docTab === 'conversion') {
                          cellVal = det.conversionTargetMetal === 'silver' ? 'نقره' : 'طلا';
                        } else {
                          cellVal = '-';
                        }
                      } else if (col.id === 'weight') {
                        if (isMetal && rawWeight > 0) {
                          cellVal = toPersianDigits(rawWeight.toFixed(3));
                        } else if (docTab === 'coin' && det.coinWeight) {
                          cellVal = toPersianDigits(Number(det.coinWeight).toFixed(3));
                        } else if (docTab === 'conversion' && det.conversionWeight) {
                          cellVal = toPersianDigits(Number(det.conversionWeight).toFixed(3));
                        } else {
                          cellVal = '-';
                        }
                      } else if (col.id === 'purity') {
                        if (isMetal && purity > 0) {
                          cellVal = toPersianDigits(purity);
                        } else if (docTab === 'conversion' && det.conversionPurity) {
                          cellVal = toPersianDigits(det.conversionPurity);
                        } else {
                          cellVal = '-';
                        }
                      } else if (col.id === 'converted_weight') {
                        if (isMetal && c750 > 0) {
                          cellVal = toPersianDigits(c750.toFixed(3));
                        } else if (docTab === 'conversion' && det.conversionConvertedWeight) {
                          cellVal = toPersianDigits(Number(det.conversionConvertedWeight).toFixed(3));
                        } else {
                          cellVal = '-';
                        }
                      } else if (col.id === 'price_per_gram') {
                        const p = Number(det?.metalPrice || det?.pricePerGram || det?.coinPrice || det?.exchangeRate) || 0;
                        cellVal = p > 0 ? toPersianDigits(p.toLocaleString('en-US')) : '-';
                      } else if (col.id === 'subtotal_price') {
                        const tot = Number(det?.totalAmount || det?.metalTotalPrice || det?.amount || det?.conversionMoneyAmount) || 0;
                        const disc = Number(det?.discountAmount) || 0;
                        const sub = tot > 0 || disc > 0 ? tot + disc : 0;
                        cellVal = sub > 0 ? toPersianDigits(sub.toLocaleString('en-US')) : '-';
                      } else if (col.id === 'discount_amount') {
                        const disc = Number(det?.discountAmount) || 0;
                        cellVal = disc > 0 ? toPersianDigits(disc.toLocaleString('en-US')) : '۰';
                      } else if (col.id === 'total_price') {
                        const tot = Number(det?.totalAmount || det?.metalTotalPrice || det?.amount || det?.conversionMoneyAmount) || 0;
                        cellVal = tot > 0 ? toPersianDigits(tot.toLocaleString('en-US')) : '-';
                      } else if (col.id === 'lab_name') {
                        cellVal = det.labName || det.assayLabName || '-';
                      } else if (col.id === 'stamp_number') {
                        cellVal = det.stampNumber || det.assayNumber || '-';
                      } else if (col.id === 'description') {
                        cellVal = line.description || det?.description || (det?.workmanshipName ? `کار ساخته: ${det.workmanshipName}` : '-');
                      }

                      return (
                        <td
                          key={col.id}
                          className="py-1 px-1.5 text-center align-middle break-words leading-snug"
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
      // Use allLines for complete document totals across multiple pages
      const linesForSummary = allLines.length > 0 ? allLines : lines;
      const goldLines = linesForSummary.filter((l) => (l.details?.metalType || 'gold') === 'gold');
      const silverLines = linesForSummary.filter((l) => l.details?.metalType === 'silver');
      const platinumLines = linesForSummary.filter((l) => l.details?.metalType === 'platinum');

      const totalGoldWeight = goldLines.reduce((acc, l) => acc + (Number(l.details?.rawWeight) || 0), 0);
      const totalGold750 = goldLines.reduce((acc, l) => {
        const raw = Number(l.details?.rawWeight) || 0;
        const purity = Number(l.details?.purity) || 0;
        return acc + (typeof l.converted750 === 'number' && Number.isFinite(l.converted750) ? l.converted750 : (purity > 0 ? (raw * purity) / 750 : raw));
      }, 0);

      const totalSilverWeight = silverLines.reduce((acc, l) => acc + (Number(l.details?.rawWeight) || 0), 0);
      const totalPlatinumWeight = platinumLines.reduce((acc, l) => acc + (Number(l.details?.rawWeight) || 0), 0);

      let totalSubtotal = 0;
      let totalDiscount = 0;
      let totalAmount = 0;

      for (const l of linesForSummary) {
        const det = (l.details || {}) as Record<string, any>;
        const tot = Number(det?.totalAmount || det?.amount || det?.metalTotalPrice || det?.conversionMoneyAmount) || 0;
        const disc = Number(det?.discountAmount) || 0;
        const sub = tot > 0 || disc > 0 ? tot + disc : (Number(det?.metalTotalPrice) || 0);
        totalAmount += tot;
        totalDiscount += disc;
        totalSubtotal += sub;
      }

      const currencySuffix = settings.baseCurrency === 'IRT' ? 'تومان' : 'ریال';

      return (
        <div
          dir="rtl"
          className="flex flex-wrap items-center justify-around h-full font-bold text-[85%] px-3 bg-slate-100 border border-slate-300 rounded gap-2"
          style={{ fontWeight: getFontWeightCss(el.style?.fontWeight || 'bold') }}
        >
          {totalGoldWeight > 0 && (
            <span className="whitespace-nowrap">
              <span>جمع طلا (۷۵۰): </span>
              <bdi className="font-mono">{toPersianDigits(totalGold750.toFixed(3))}</bdi>
              <span> گرم</span>
            </span>
          )}
          {totalSilverWeight > 0 && (
            <span className="whitespace-nowrap">
              <span>جمع نقره: </span>
              <bdi className="font-mono">{toPersianDigits(totalSilverWeight.toFixed(3))}</bdi>
              <span> گرم</span>
            </span>
          )}
          {totalPlatinumWeight > 0 && (
            <span className="whitespace-nowrap">
              <span>جمع پلاتین: </span>
              <bdi className="font-mono">{toPersianDigits(totalPlatinumWeight.toFixed(3))}</bdi>
              <span> گرم</span>
            </span>
          )}
          {totalSubtotal > 0 && (
            <span className="whitespace-nowrap">
              <span>قیمت کل قبل از تخفیف: </span>
              <bdi className="font-mono">{toPersianDigits(totalSubtotal.toLocaleString('en-US'))}</bdi>
              <span> {currencySuffix}</span>
            </span>
          )}
          {totalDiscount > 0 && (
            <span className="whitespace-nowrap">
              <span>مجموع تخفیف: </span>
              <bdi className="font-mono">{toPersianDigits(totalDiscount.toLocaleString('en-US'))}</bdi>
              <span> {currencySuffix}</span>
            </span>
          )}
          {totalAmount > 0 && (
            <span className="whitespace-nowrap">
              <span>مبلغ قابل پرداخت: </span>
              <bdi className="font-mono">{toPersianDigits(totalAmount.toLocaleString('en-US'))}</bdi>
              <span> {currencySuffix}</span>
            </span>
          )}
          <span className="whitespace-nowrap">
            <span>تعداد ردیف: </span>
            <bdi className="font-mono">{toPersianDigits(linesForSummary.length)}</bdi>
          </span>
        </div>
      );
    }

    case 'custom_table': {
      const customTable = el.content?.customTable;
      const fields = (customTable?.fields || []).filter((f) => f.visible);
      if (fields.length === 0) return null;

      const title = customTable?.title || 'خلاصه حساب و مانده‌ها';
      const showTitle = Boolean(customTable?.showTitle);
      const showHeader = customTable?.showHeader !== false;
      const headerLabel = customTable?.headerLabelText || 'شرح شاخص';
      const headerValue = customTable?.headerValueText || 'مقدار / مانده';
      const layout = customTable?.layout || 'rows';

      const borderColor = customTable?.borderColor || el.style.borderColor || '#cbd5e1';
      const borderWidth = customTable?.borderWidthMm ? `${customTable.borderWidthMm}mm` : (el.style.borderWidthMm ? `${el.style.borderWidthMm}mm` : '0.4mm');
      const borderStyle = customTable?.borderStyle || el.style.borderStyle || 'solid';
      const borderRadius = customTable?.borderRadiusMm ? `${customTable.borderRadiusMm}mm` : (el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0');
      const showVertical = customTable?.showVerticalBorders !== false;
      const showHorizontal = customTable?.showHorizontalBorders !== false;
      const headerBg = customTable?.headerBackgroundColor || '#f1f5f9';
      const headerColor = customTable?.headerTextColor || '#0f172a';
      const bodyColor = customTable?.bodyTextColor || el.style.color || '#1e293b';
      const striped = Boolean(customTable?.stripedRows);
      const altBg = customTable?.alternateRowColor || '#f8fafc';
      const fontSize = customTable?.fontSizePt ? `${customTable.fontSizePt}pt` : (el.style.fontSizePt ? `${el.style.fontSizePt}pt` : '8.5pt');

      const resolvedValues = computeDocumentCustomTableValues(customer, allLines.length > 0 ? allLines : lines, settings);

      const renderCustomCell = (f: InvoiceCustomTableField, val: string) => {
        if (f.key === 'custom_qrcode') {
          const qrVal = resolveQrCodeValue(
            f.qrContentType,
            f.customValue,
            {
              documentNumber,
              customerName: customer?.name,
              date: documentDateJalali,
            },
          );
          return (
            <div className="flex items-center justify-center p-0.5">
              <div className="p-0.5 bg-white rounded inline-flex">
                <QrCodeSvg value={qrVal} size={24} margin={0.5} backgroundColor="#ffffff" color="#000000" />
              </div>
            </div>
          );
        }
        return (
          <span className="whitespace-nowrap">
            <bdi>{val}</bdi> {f.unit ? <span className="text-[80%] font-normal text-slate-500 mr-0.5">{f.unit}</span> : null}
          </span>
        );
      };

      return (
        <div
          dir="rtl"
          className="w-full h-full overflow-hidden flex flex-col select-none"
          style={{
            borderRadius,
            border: `${borderWidth} ${borderStyle} ${borderColor}`,
            fontSize,
            color: bodyColor,
            backgroundColor: el.style.backgroundColor || '#ffffff',
          }}
        >
          {showTitle && (
            <div
              className="py-1 px-2 font-bold text-center border-b shrink-0"
              style={{
                backgroundColor: headerBg,
                color: headerColor,
                borderColor,
                borderBottomWidth: borderWidth,
                borderBottomStyle: borderStyle,
              }}
            >
              {title}
            </div>
          )}

          <div className="flex-1 w-full overflow-hidden">
            {layout === 'grid2' ? (
              <table className="w-full h-full border-collapse table-fixed text-center">
                <tbody>
                  {Array.from({ length: Math.ceil(fields.length / 2) }).map((_, rIdx) => {
                    const f1 = fields[rIdx * 2];
                    const f2 = fields[rIdx * 2 + 1];
                    const v1 = f1 ? (f1.key === 'custom' ? (f1.customValue || '-') : (resolvedValues[f1.key] || '-')) : '';
                    const v2 = f2 ? (f2.key === 'custom' ? (f2.customValue || '-') : (resolvedValues[f2.key] || '-')) : '';
                    const isEven = rIdx % 2 === 1;

                    return (
                      <tr
                        key={rIdx}
                        style={{
                          backgroundColor: striped && isEven ? altBg : undefined,
                          borderBottom: showHorizontal && rIdx < Math.ceil(fields.length / 2) - 1 ? `${borderWidth} ${borderStyle} ${borderColor}` : undefined,
                        }}
                      >
                        {f1 && (
                          <>
                            <td
                              className="p-1 font-bold text-right pr-2 text-[90%]"
                              style={{
                                width: '25%',
                                backgroundColor: headerBg,
                                color: headerColor,
                                borderLeft: `${borderWidth} ${borderStyle} ${borderColor}`,
                              }}
                            >
                              {f1.label}
                            </td>
                            <td
                              className="p-1 font-extrabold text-center text-[95%]"
                              style={{
                                width: '25%',
                                borderLeft: showVertical && f2 ? `${borderWidth} ${borderStyle} ${borderColor}` : undefined,
                              }}
                            >
                              {renderCustomCell(f1, v1)}
                            </td>
                          </>
                        )}
                        {f2 ? (
                          <>
                            <td
                              className="p-1 font-bold text-right pr-2 text-[90%]"
                              style={{
                                width: '25%',
                                backgroundColor: headerBg,
                                color: headerColor,
                                borderLeft: `${borderWidth} ${borderStyle} ${borderColor}`,
                              }}
                            >
                              {f2.label}
                            </td>
                            <td className="p-1 font-extrabold text-center text-[95%]" style={{ width: '25%' }}>
                              {renderCustomCell(f2, v2)}
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ width: '25%' }} />
                            <td style={{ width: '25%' }} />
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : layout === 'columns' ? (
              <table className="w-full h-full border-collapse table-fixed text-center">
                {showHeader && (
                  <thead>
                    <tr
                      style={{
                        backgroundColor: headerBg,
                        color: headerColor,
                        borderBottom: `${borderWidth} ${borderStyle} ${borderColor}`,
                      }}
                    >
                      {fields.map((f, idx) => (
                        <th
                          key={f.id}
                          className="p-1 font-bold text-[90%]"
                          style={{
                            borderLeft: showVertical && idx < fields.length - 1 ? `${borderWidth} ${borderStyle} ${borderColor}` : undefined,
                          }}
                        >
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  <tr>
                    {fields.map((f, idx) => {
                      const val = f.key === 'custom' ? (f.customValue || '-') : (resolvedValues[f.key] || '-');
                      return (
                        <td
                          key={f.id}
                          className="p-1 font-extrabold text-[95%]"
                          style={{
                            borderLeft: showVertical && idx < fields.length - 1 ? `${borderWidth} ${borderStyle} ${borderColor}` : undefined,
                          }}
                        >
                          {renderCustomCell(f, val)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="w-full h-full border-collapse table-fixed text-center">
                {showHeader && (
                  <thead>
                    <tr
                      style={{
                        backgroundColor: headerBg,
                        color: headerColor,
                        borderBottom: `${borderWidth} ${borderStyle} ${borderColor}`,
                      }}
                    >
                      <th
                        className="p-1 font-bold text-right pr-2 text-[90%]"
                        style={{
                          width: '50%',
                          borderLeft: showVertical ? `${borderWidth} ${borderStyle} ${borderColor}` : undefined,
                        }}
                      >
                        {headerLabel}
                      </th>
                      <th className="p-1 font-bold text-center text-[90%]" style={{ width: '50%' }}>
                        {headerValue}
                      </th>
                    </tr>
                  </thead>
                )}
                <tbody>
                  {fields.map((f, idx) => {
                    const val = f.key === 'custom' ? (f.customValue || '-') : (resolvedValues[f.key] || '-');
                    const isEven = idx % 2 === 1;
                    return (
                      <tr
                        key={f.id}
                        style={{
                          backgroundColor: striped && isEven ? altBg : undefined,
                          borderBottom: showHorizontal && idx < fields.length - 1 ? `${borderWidth} ${borderStyle} ${borderColor}` : undefined,
                        }}
                      >
                        <td
                          className="p-1 font-bold text-right pr-2 text-[90%]"
                          style={{
                            borderLeft: showVertical ? `${borderWidth} ${borderStyle} ${borderColor}` : undefined,
                          }}
                        >
                          {f.label}
                        </td>
                        <td className="p-1 font-extrabold text-center text-[95%]">
                          {renderCustomCell(f, val)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
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

function computeDocumentCustomTableValues(
  customer: Customer | null,
  lines: DocumentLine[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any,
): Record<string, string> {
  const isToman = settings?.baseCurrency === 'IRT';

  // 1. Line metal aggregations
  const goldLines = lines.filter((l) => (l.details?.metalType || 'gold') === 'gold');
  const silverLines = lines.filter((l) => l.details?.metalType === 'silver');
  const platinumLines = lines.filter((l) => l.details?.metalType === 'platinum');

  const totalRawGold = goldLines.reduce((acc, l) => acc + (Number(l.details?.rawWeight) || 0), 0);
  const totalGold750 = goldLines.reduce((acc, l) => {
    const raw = Number(l.details?.rawWeight) || 0;
    const purity = Number(l.details?.purity) || 0;
    return acc + (typeof l.converted750 === 'number' && Number.isFinite(l.converted750) ? l.converted750 : (purity > 0 ? (raw * purity) / 750 : raw));
  }, 0);

  const totalSilverWeight = silverLines.reduce((acc, l) => acc + (Number(l.details?.rawWeight) || 0), 0);
  const totalPlatinumWeight = platinumLines.reduce((acc, l) => acc + (Number(l.details?.rawWeight) || 0), 0);

  // 2. Financial totals
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

  // 3. Document Net Effects on Customer Account
  let effectGold = 0;
  let effectSilver = 0;
  let effectRial = 0;

  for (const line of lines) {
    const lineNature = line.documentNature === 'paid' ? 'paid' : 'received';
    const direction = lineNature === 'received' ? 1 : -1;
    const docTab = String(line.documentTab || line.sourceTab || '');
    const det = (line.details || {}) as Record<string, unknown>;

    // Metal weight effect
    if (docTab === 'raw-gold' || docTab === 'gold-sale' || (docTab === 'refining' && det.refiningOpKind !== 'fee')) {
      const metal = String(det.metalType || 'gold');
      const baseKarat = Number(det.baseKarat) || 750;
      const rawWeight = Number(det.rawWeight) || 0;
      const purity = Number(det.purity) || baseKarat;
      const convertedWeight = typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
        ? line.converted750
        : (rawWeight > 0 && purity > 0 ? (rawWeight * purity) / baseKarat : 0);

      const weightDirection = docTab === 'gold-sale'
        ? (lineNature === 'received' ? -1 : 1)
        : direction;

      if (metal === 'silver') {
        effectSilver += weightDirection * convertedWeight;
      } else if (metal === 'gold' || !metal) {
        effectGold += weightDirection * convertedWeight;
      }
    } else if (docTab === 'workmanship' || docTab === 'claim') {
      const weight = typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
        ? line.converted750
        : (Number(det.claimWeight || det.rawWeight) || 0);
      effectGold += direction * weight;
    } else if (docTab === 'conversion') {
      const metal = String(det.conversionTargetMetal || 'gold');
      const convWeight = Number(det.conversionConvertedWeight || det.conversionWeight) || 0;
      const convRial = Number(det.conversionMoneyAmount || det.totalAmount) || 0;
      const isWeightToMoney = line.documentSubType === 'conversion-weight-to-money';
      if (isWeightToMoney) {
        // Gold decreases, money increases
        if (metal === 'silver') effectSilver -= convWeight;
        else effectGold -= convWeight;
        effectRial += convRial;
      } else {
        // Money decreases, gold increases
        if (metal === 'silver') effectSilver += convWeight;
        else effectGold += convWeight;
        effectRial -= convRial;
      }
    }

    // Financial effect
    let lineRial = 0;
    if (docTab === 'currency') {
      lineRial = Number(det.currencyTotalAmount) || 0;
    } else if (docTab === 'cash' && !det.isForeignCash) {
      lineRial = Number(det.totalAmount) || 0;
    } else if (docTab === 'gold-sale') {
      lineRial = Number(det.totalAmount) || 0;
    } else if (docTab === 'bank') {
      const rawBankAmt = Number(det.totalAmount || det.amount) || 0;
      lineRial = (isToman && !det.rialAmountInIrr) ? rawBankAmt * 10 : rawBankAmt;
    } else if (docTab === 'claim') {
      const rawClaimAmt = Number(det.claimFinancial || det.totalAmount) || 0;
      lineRial = (isToman && !det.rialAmountInIrr) ? rawClaimAmt * 10 : rawClaimAmt;
    } else if (docTab === 'coin' || docTab === 'workmanship') {
      lineRial = Number(det.totalAmount || det.metalTotalPrice) || 0;
    }
    if (lineRial > 0) {
      effectRial += direction * lineRial;
    }
  }

  // 4. Customer Balances
  const prevGold = customer?.goldBalance ?? 0;
  const prevSilver = customer?.silverBalance ?? 0;
  const prevRial = customer?.rialBalance ?? 0;

  const finalGold = prevGold + effectGold;
  const finalSilver = prevSilver + effectSilver;
  const finalRial = prevRial + effectRial;

  // Format money helper
  const formatMoney = (irr: number) => {
    const val = isToman ? (irr < 0 ? -Math.floor(Math.abs(irr) / 10) : Math.floor(irr / 10)) : irr;
    return toPersianDigits(val.toLocaleString('en-US'));
  };

  // Status helper
  let statusText = 'بی‌حساب / تسویه';
  if (finalGold > 0.0005 || finalRial > 50) {
    statusText = 'بستانکار (طلب از ما)';
  } else if (finalGold < -0.0005 || finalRial < -50) {
    statusText = 'بدهکار (به ما)';
  }

  // Settlement methods detection
  const hasUnsettled = lines.some((l) => l.settlementMethod === 'unsettled');
  const hasCash = lines.some((l) => l.settlementMethod === 'cash');
  const hasWeight = lines.some((l) => l.settlementMethod === 'weight');
  let settlementStatus = 'تسویه شده';
  if (hasUnsettled) settlementStatus = 'ثبت در مانده حساب (تسویه نشده)';
  else if (hasCash && hasWeight) settlementStatus = 'تسویه نقدی و وزنی';
  else if (hasCash) settlementStatus = 'تسویه نقدی';
  else if (hasWeight) settlementStatus = 'تسویه وزنی';

  // Karat & Converted weight calculation
  const primaryPurity = lines.find((l) => Number(l.details?.purity) > 0)?.details?.purity || 750;

  let convertedByMetalStr = '-';
  if (totalRawGold > 0 || (totalSilverWeight === 0 && totalPlatinumWeight === 0)) {
    convertedByMetalStr = `${toPersianDigits(totalGold750.toFixed(3))} (۷۵۰)`;
  } else if (totalSilverWeight > 0) {
    convertedByMetalStr = `${toPersianDigits(totalSilverWeight.toFixed(3))} (۹۹۹)`;
  } else if (totalPlatinumWeight > 0) {
    convertedByMetalStr = `${toPersianDigits(totalPlatinumWeight.toFixed(3))} (۹۵۰)`;
  }

  return {
    prev_balance_gold: toPersianDigits(prevGold.toFixed(3)),
    prev_balance_cash: formatMoney(prevRial),
    final_balance_gold: toPersianDigits(finalGold.toFixed(3)),
    final_balance_cash: formatMoney(finalRial),
    customer_status: statusText,
    prev_balance_silver: toPersianDigits(prevSilver.toFixed(3)),
    final_balance_silver: toPersianDigits(finalSilver.toFixed(3)),

    doc_net_gold: effectGold !== 0 ? (effectGold > 0 ? `+${toPersianDigits(effectGold.toFixed(3))}` : toPersianDigits(effectGold.toFixed(3))) : '۰٫۰۰۰',
    doc_net_cash: formatMoney(effectRial),
    doc_settlement_status: settlementStatus,
    doc_rows_count: toPersianDigits(lines.length),

    doc_subtotal_price: toPersianDigits(totalSubtotal.toLocaleString('en-US')),
    doc_discount_amount: totalDiscount > 0 ? toPersianDigits(totalDiscount.toLocaleString('en-US')) : '۰',
    doc_total_price: toPersianDigits(totalAmount.toLocaleString('en-US')),

    doc_gold_weight_750: toPersianDigits(totalGold750.toFixed(3)),
    doc_raw_gold_weight: toPersianDigits(totalRawGold.toFixed(3)),
    doc_silver_weight: toPersianDigits(totalSilverWeight.toFixed(3)),
    doc_platinum_weight: toPersianDigits(totalPlatinumWeight.toFixed(3)),

    doc_karat: toPersianDigits(primaryPurity),
    doc_converted_by_metal: convertedByMetalStr,
    custom_qrcode: 'QR',
  };
}
