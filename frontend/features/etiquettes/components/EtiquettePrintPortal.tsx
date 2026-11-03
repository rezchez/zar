'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import LabelPreviewCard, {
  type LabelSize,
  type LabelTemplate,
  type LabelOrientation,
  getLabelPrintDimensions,
} from './LabelPreviewCard';
import { type EtiquetteRecord } from '@/lib/etiquette';

export interface EtiquettePrintPortalProps {
  items: Array<Partial<EtiquetteRecord>>;
  template?: LabelTemplate;
  size?: LabelSize;
  orientation?: LabelOrientation;
  showWage?: boolean;
  showPrice?: boolean;
  showQr?: boolean;
  showBarcode?: boolean;
  showPurity?: boolean;
  showWeight?: boolean;
  storeName?: string;

  fontSize?: 'compact' | 'standard' | 'large';
  customNote?: string;
  barcodeLayout?: 'both' | 'barcode_only' | 'qr_only' | 'code_only';
  purityFormat?: 'standard' | 'karat_only' | 'full';
  showStoreName?: boolean;
  showTitle?: boolean;
  showGrossWeight?: boolean;
  showStoneWeight?: boolean;
  showCode?: boolean;
  showLocation?: boolean;
}

/**
 * Dedicated Etiquette Print Portal:
 * Renders into document.body and isolates printing strictly to the label geometry.
 * All outer dashboard UI, headers, sidebars, modal backdrops, and buttons are hidden (display: none !important).
 * The printer driver receives exact @page dimensions matching the roll (e.g. 60mm 10mm).
 */
export default function EtiquettePrintPortal({
  items,
  template = 'slim_tail',
  size = '60x10',
  orientation = 'right_to_left',
  showWage = true,
  showPrice = false,
  showQr = true,
  showBarcode = true,
  showPurity = true,
  showWeight = true,
  storeName = 'زرین گالری',
  fontSize = 'standard',
  customNote = '',
  barcodeLayout = 'both',
  purityFormat = 'standard',
  showStoreName = true,
  showTitle = true,
  showGrossWeight = true,
  showStoneWeight = true,
  showCode = true,
  showLocation = false,
}: EtiquettePrintPortalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined' || items.length === 0) {
    return null;
  }

  const dims = getLabelPrintDimensions(template, size);

  return createPortal(
    <div
      id="etiquette-print-root"
      className="etiquette-print-root hidden"
      aria-hidden="true"
    >
      <style>{`
        @media screen {
          .etiquette-print-root {
            display: none !important;
          }
        }
        @media print {
          @page {
            size: ${dims.widthMm}mm ${dims.heightMm}mm;
            margin: 0mm !important;
          }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          html, body {
            width: ${dims.widthMm}mm !important;
            height: ${dims.heightMm}mm !important;
            min-width: ${dims.widthMm}mm !important;
            min-height: ${dims.heightMm}mm !important;
            max-width: ${dims.widthMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
          }
          /* Hide EVERYTHING in the body except the etiquette print root */
          body > *:not(.etiquette-print-root) {
            display: none !important;
            visibility: hidden !important;
          }
          .etiquette-print-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: ${dims.widthMm}mm !important;
            box-sizing: border-box !important;
          }
          .etiquette-print-page {
            width: ${dims.widthMm}mm !important;
            height: ${dims.heightMm}mm !important;
            max-width: ${dims.widthMm}mm !important;
            max-height: ${dims.heightMm}mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: #ffffff !important;
          }
          .etiquette-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      {items.map((it, idx) => (
        <div key={it.id || idx} className="etiquette-print-page">
          <LabelPreviewCard
            item={it}
            template={template}
            size={size}
            orientation={orientation}
            showWage={showWage}
            showPrice={showPrice}
            showQr={showQr}
            showBarcode={showBarcode}
            showPurity={showPurity}
            showWeight={showWeight}
            storeName={storeName}
            fontSize={fontSize}
            customNote={customNote}
            barcodeLayout={barcodeLayout}
            purityFormat={purityFormat}
            showStoreName={showStoreName}
            showTitle={showTitle}
            showGrossWeight={showGrossWeight}
            showStoneWeight={showStoneWeight}
            showCode={showCode}
            showLocation={showLocation}
            isPrintMode={true}
          />
        </div>
      ))}
    </div>,
    document.body
  );
}
