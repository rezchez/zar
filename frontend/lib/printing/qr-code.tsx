import React from 'react';
import QRCode from 'qrcode';

export interface QrCodeSvgProps {
  value: string;
  size?: number | string;
  className?: string;
  color?: string;
  backgroundColor?: string;
}

export function QrCodeSvg({
  value,
  size,
  className,
  color = '#000000',
  backgroundColor = '#ffffff',
}: QrCodeSvgProps) {
  if (!value || typeof value !== 'string') return null;

  try {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const margin = 1.5;
    const total = count + margin * 2;
    let path = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          path += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    return (
      <svg
        viewBox={`0 0 ${total} ${total}`}
        width={size || '100%'}
        height={size || '100%'}
        className={className}
        style={{
          shapeRendering: 'crispEdges',
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
          margin: '0 auto',
        }}
      >
        {backgroundColor && backgroundColor !== 'transparent' && (
          <rect width={total} height={total} fill={backgroundColor} />
        )}
        <path d={path} fill={color} />
      </svg>
    );
  } catch {
    return (
      <div className="text-[9px] text-slate-400 text-center p-1 border border-dashed rounded">
        کد QR نامعتبر است
      </div>
    );
  }
}
