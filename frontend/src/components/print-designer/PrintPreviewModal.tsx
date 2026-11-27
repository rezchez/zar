'use client';

import React from 'react';
import { Printer } from 'lucide-react';
import { StudioDialog } from './StudioDialog';
import {
  type InvoicePrintTemplate,
  type InvoicePrintElement,
  getFontWeightCss,
} from '@/lib/print-templates';

type PrintPreviewModalProps = {
  open: boolean;
  onClose: () => void;
  template: InvoicePrintTemplate;
  pageDimensions: { widthMm: number; heightMm: number };
  renderPreviewContent: (el: InvoicePrintElement) => React.ReactNode;
};

export function PrintPreviewModal({
  open,
  onClose,
  template,
  pageDimensions,
  renderPreviewContent,
}: PrintPreviewModalProps) {
  return (
    <StudioDialog
      open={open}
      onClose={onClose}
      title={`پیش‌نمایش چاپ واقعی — ${template.name}`}
      titleId="print-preview-dialog-title"
      icon={<Printer size={18} className="text-amber-500" />}
      maxWidthClass="max-w-5xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800/70 px-4 py-2.5 rounded-xl text-xs">
          <span className="text-slate-600 dark:text-slate-300">
            ابعاد کاغذ: <strong className="font-mono">{pageDimensions.widthMm} × {pageDimensions.heightMm} mm</strong> ({template.page.size})
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            این نما بدون شبکه و خط‌کش و دقیقاً مطابق خروجی چاپگر نمایش داده می‌شود.
          </span>
        </div>

        <div className="flex justify-center bg-slate-200 dark:bg-slate-950 p-6 rounded-2xl overflow-auto max-h-[62dvh]">
          <div
            style={{
              width: `${pageDimensions.widthMm}mm`,
              height: `${pageDimensions.heightMm}mm`,
              backgroundColor: template.page.backgroundColor || '#ffffff',
              borderWidth: template.page.borderEnabled ? `${template.page.borderWidthMm}mm` : '0',
              borderColor: template.page.borderColor || '#cbd5e1',
              borderStyle: template.page.borderEnabled ? 'solid' : 'none',
              paddingTop: `${template.page.marginTopMm || 0}mm`,
              paddingRight: `${template.page.marginRightMm || 0}mm`,
              paddingBottom: `${template.page.marginBottomMm || 0}mm`,
              paddingLeft: `${template.page.marginLeftMm || 0}mm`,
              zoom: pageDimensions.widthMm > 160 ? 0.72 : 1,
            }}
            className="relative text-slate-900 shadow-2xl shrink-0 overflow-hidden"
            dir="rtl"
          >
            {template.elements
              .filter((el) => el.visible)
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
                    borderStyle: el.style.borderWidthMm ? el.style.borderStyle || 'solid' : 'none',
                    borderRadius: el.style.borderRadiusMm ? `${el.style.borderRadiusMm}mm` : '0',
                    opacity: el.style.opacity ?? 1,
                    zIndex: el.zIndex || 10,
                  }}
                  className="box-border"
                >
                  {renderPreviewContent(el)}
                </div>
              ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            بستن پیش‌نمایش
          </button>
        </div>
      </div>
    </StudioDialog>
  );
}
