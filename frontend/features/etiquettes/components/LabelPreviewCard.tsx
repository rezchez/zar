'use client';

import React from 'react';
import { BarcodeSvg } from '@/lib/barcode';
import { QrCodeSvg } from '@/lib/qr-code';
import {
  ETIQUETTE_STATUS_LABELS,
  METAL_LABELS,
  PRODUCT_COLOR_LABELS,
  type EtiquetteRecord,
  type WageType,
} from '@/lib/etiquette';

export type LabelTemplate = 'slim_tail' | 'rat_tail' | 'rat_tail_wide' | 'thermal_single';
export type LabelSize = '44x10' | '60x10' | '70x10';
export type LabelOrientation = 'right_to_left' | 'left_to_right';

export function getLabelPrintDimensions(
  template: LabelTemplate = 'slim_tail',
  size: LabelSize = '60x10'
): { widthMm: number; heightMm: number } {
  if (template === 'slim_tail') {
    if (size === '44x10') return { widthMm: 44, heightMm: 10 };
    if (size === '70x10') return { widthMm: 70, heightMm: 10 };
    return { widthMm: 60, heightMm: 10 };
  }
  if (template === 'thermal_single') {
    return { widthMm: 40, heightMm: 25 };
  }
  if (template === 'rat_tail_wide') {
    return { widthMm: 80, heightMm: 12 };
  }
  // rat_tail default (two 30mm pads + 8mm tail bridge)
  return { widthMm: 68, heightMm: 10 };
}

export interface LabelPreviewCardProps {
  item: Partial<EtiquetteRecord>;
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
  className?: string;
  isPrintMode?: boolean;

  // Extended Custom Design Props
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

export default function LabelPreviewCard({
  item,
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
  className = '',
  isPrintMode = false,
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
}: LabelPreviewCardProps) {
  const barcode = item.barcode || 'ETK-000001';
  const title = item.title || 'انگشتر طلا';
  const purity = item.purity || 750;
  const totalWeight = Number(item.totalWeight || 0).toFixed(3);
  const netWeight = Number(item.netWeight || item.totalWeight || 0).toFixed(3);
  const stoneWeight = Number(item.stoneWeight || 0).toFixed(3);
  const metalName = METAL_LABELS[item.metal || 'gold'];

  const wageStr =
    item.wage !== undefined && item.wage !== null && Number(item.wage) > 0
      ? item.wageType === 'percentage'
        ? `${item.wage}٪`
        : `${Number(item.wage).toLocaleString('fa-IR')}`
      : '-';

  // Format Purity Label based on purityFormat
  const purityLabel =
    purityFormat === 'karat_only'
      ? `${purity}`
      : purityFormat === 'full'
      ? `18K (${purity})`
      : `${purity} ${item.productColor ? PRODUCT_COLOR_LABELS[item.productColor] : 'طلا'}`;

  // Header display name
  const headerDisplayName =
    showStoreName && showTitle
      ? storeName
        ? `${storeName} · ${title}`
        : title
      : showStoreName
      ? storeName || title
      : showTitle
      ? title
      : '';

  // Barcode layout toggles
  const effectiveShowBarcode = showBarcode && barcodeLayout !== 'qr_only' && barcodeLayout !== 'code_only';
  const effectiveShowQr = showQr && barcodeLayout !== 'barcode_only' && barcodeLayout !== 'code_only';
  const effectiveShowCode = showCode || barcodeLayout === 'code_only';

  // Font sizing styles
  const textScale =
    fontSize === 'compact'
      ? { base: 'text-[6.5px]', title: 'text-[7.5px]', sub: 'text-[6px]', badge: 'text-[6.5px]', code: 'text-[7px]' }
      : fontSize === 'large'
      ? { base: 'text-[8.5px]', title: 'text-[9.5px]', sub: 'text-[7.5px]', badge: 'text-[8px]', code: 'text-[9px]' }
      : { base: 'text-[7.5px]', title: 'text-[8.5px]', sub: 'text-[6.5px]', badge: 'text-[7px]', code: 'text-[8px]' };

  // 1. مدل دمباریک یکطرفه (تک کادر یا مستطیلی دمدار) - سایزهای 44×10، 60×10 و 70×10 (مدل مبنا)
  if (template === 'slim_tail') {
    const is44 = size === '44x10';
    const is70 = size === '70x10';

    const padWidthClass = is44 ? 'w-[155px]' : is70 ? 'w-[210px]' : 'w-[180px]';
    const padHeightClass = 'h-[58px]';
    const tailWidthClass = is44 ? 'w-[80px]' : is70 ? 'w-[150px]' : 'w-[115px]';
    const printTotalWidth = is44 ? '44mm' : is70 ? '70mm' : '60mm';
    const printPadWidth = is44 ? '24mm' : is70 ? '34mm' : '30mm';
    const printTailWidth = is44 ? '20mm' : is70 ? '36mm' : '30mm';

    const firstStone = item.mountedStones && item.mountedStones.length > 0 ? item.mountedStones[0] : null;
    const stoneInfo = firstStone
      ? `${firstStone.name.slice(0, 9)}: ${firstStone.weightCarat}ct`
      : Number(stoneWeight) > 0
      ? `کسر: ${stoneWeight}g`
      : '';

    const isLtr = orientation === 'left_to_right';

    return (
      <div
        className={`label-sticker select-none inline-flex items-center justify-center bg-white text-slate-950 ${
          isLtr ? 'flex-row' : 'flex-row-reverse'
        } ${
          isPrintMode ? 'break-inside-avoid m-0 p-0 shadow-none border-none' : 'p-1 shadow-md border border-slate-300 dark:border-slate-600 rounded-xl'
        } ${className}`}
        style={{
          direction: 'ltr',
          ...(isPrintMode ? { width: printTotalWidth, height: '10mm', margin: 0, padding: 0 } : {}),
        }}
      >
        {/* کادر چاپ مستطیلی اصلی (تک کادر) */}
        <div
          className={`${padWidthClass} ${padHeightClass} ${
            isPrintMode ? 'border border-black/80 rounded-xs' : 'border border-slate-300 dark:border-slate-400 rounded-md shadow-2xs'
          } p-1 bg-white flex flex-col justify-between ${textScale.base} leading-tight font-sans shrink-0`}
          style={{
            direction: 'rtl',
            ...(isPrintMode ? { width: printPadWidth, height: '10mm', padding: '0.6mm', boxSizing: 'border-box' } : {}),
          }}
        >
          {/* ردیف اول: نام فروشگاه/عنوان مصنوع + عیار */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
            <span className={`font-black ${textScale.title} truncate max-w-[105px] text-slate-900`} title={headerDisplayName}>
              {headerDisplayName || title}
            </span>
            {showPurity && (
              <span
                className={`font-mono font-bold ${textScale.badge} px-1 py-0.2 rounded shrink-0 ${
                  isPrintMode
                    ? 'border border-black text-black bg-white'
                    : 'bg-amber-100 text-amber-950 border border-amber-300/60'
                }`}
              >
                {purityLabel}
              </span>
            )}
          </div>

          {/* ردیف دوم: اوزان و اطلاعات متناسب با طراحی کاربر */}
          <div className="flex items-center justify-between font-sans">
            <div className="flex items-center gap-1.5 flex-wrap">
              {showWeight && (
                <div>
                  <span className="text-slate-500">خالص:</span>
                  <strong className="font-mono font-black text-slate-950 mr-0.5">{netWeight}</strong>
                  <span className={`${textScale.sub} text-slate-400`}>g</span>
                </div>
              )}

              {showGrossWeight && Number(stoneWeight) > 0 && (
                <div className="text-slate-600">
                  <span className="text-slate-400">کل:</span>
                  <span className="font-mono font-semibold">{totalWeight}</span>
                </div>
              )}

              {showStoneWeight && stoneInfo && (
                <div className="text-purple-900 font-semibold truncate max-w-[70px]" title={stoneInfo}>
                  {stoneInfo}
                </div>
              )}

              {showLocation && item.storageLocation && (
                <span className={`${textScale.sub} text-amber-800 bg-amber-50 px-1 rounded truncate max-w-[45px]`}>
                  {item.storageLocation}
                </span>
              )}
            </div>

            {/* اجرت ساخت یا قیمت */}
            {showWage && wageStr !== '-' ? (
              <div className="text-slate-700 font-medium">
                <span>اجرت:</span>
                <span className="font-mono font-bold mr-0.5">{wageStr}</span>
              </div>
            ) : showPrice && item.totalPrice && Number(item.totalPrice) > 0 ? (
              <div className={`text-emerald-700 font-bold font-mono ${textScale.sub}`}>
                {Number(item.totalPrice).toLocaleString('fa-IR')}
              </div>
            ) : customNote ? (
              <div className={`text-slate-500 truncate max-w-[55px] ${textScale.sub}`}>
                {customNote}
              </div>
            ) : null}
          </div>

          {/* ردیف سوم: بارکد خطی یا کد QR + شناسه اتیکت */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-0.5">
            <div className="flex items-center gap-1 min-w-0">
              {effectiveShowBarcode ? (
                <div className="h-3.5 flex items-center shrink-0">
                  <BarcodeSvg
                    value={barcode}
                    height={fontSize === 'compact' ? 11 : fontSize === 'large' ? 16 : 13}
                    showText={false}
                    barColor="#000000"
                  />
                </div>
              ) : null}
              {effectiveShowCode && (
                <span className={`font-mono font-black ${textScale.code} text-slate-900 tracking-wider truncate`}>
                  {barcode}
                </span>
              )}
            </div>

            {effectiveShowQr && (
              <div className="w-3.5 h-3.5 shrink-0">
                <QrCodeSvg value={barcode} size={fontSize === 'compact' ? 12 : fontSize === 'large' ? 16 : 14} color="#000000" />
              </div>
            )}
          </div>
        </div>

        {/* دم باریک (Slim Tail) */}
        <div className="flex items-center shrink-0">
          <div
            className={`${tailWidthClass} h-2.5 ${
              isPrintMode
                ? 'border-none bg-transparent'
                : 'border-y border-dashed border-slate-400 bg-slate-100/90'
            } ${
              isLtr ? 'rounded-r' : 'rounded-l'
            } flex items-center justify-center px-1`}
            style={isPrintMode ? { width: printTailWidth, height: '10mm' } : {}}
          >
            {!isPrintMode && (
              <span className="text-[5.5px] text-slate-400 font-mono select-none">
                دم اتصال ({size === '44x10' ? '44×10' : size === '70x10' ? '70×10' : '60×10'})
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (template === 'thermal_single') {
    // 30x20mm / 40x25mm single compact thermal sticker
    return (
      <div
        className={`label-sticker ${
          isPrintMode
            ? 'w-[40mm] h-[25mm] shadow-none break-inside-avoid m-0 p-1 border border-black/80 rounded-xs'
            : 'border border-slate-300 dark:border-slate-700 bg-white text-slate-900 rounded-md p-1.5 w-56 h-36 shadow-sm'
        } flex flex-col justify-between font-sans ${className}`}
        style={{
          direction: 'rtl',
          ...(isPrintMode ? { width: '40mm', height: '25mm', margin: 0, padding: '1mm', boxSizing: 'border-box' } : {}),
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5 text-[10px]">
          <span className="font-bold truncate max-w-[120px]">{title}</span>
          {showPurity && (
            <span
              className={`font-mono font-bold text-[9px] px-1 rounded ${
                isPrintMode ? 'border border-black bg-white text-black' : 'bg-slate-100 text-slate-800'
              }`}
            >
              {purity} ({PRODUCT_COLOR_LABELS[item.productColor || 'yellow']})
            </span>
          )}
        </div>

        {/* Center Barcode */}
        {showBarcode ? (
          <div className="my-0.5 flex justify-center">
            <BarcodeSvg
              value={barcode}
              height={isPrintMode ? 30 : 36}
              barColor="#000000"
              textColor="#000000"
            />
          </div>
        ) : (
          <div className="my-1 text-center font-mono font-bold text-xs tracking-wider">
            {barcode}
          </div>
        )}

        {/* Bottom Specs */}
        <div className="flex items-center justify-between text-[9px] leading-tight border-t border-slate-200 pt-0.5">
          {showWeight ? (
            <div className="flex flex-col">
              <span className="font-medium">
                خالص: <strong className="font-mono text-slate-950 font-bold">{netWeight}</strong> g
              </span>
              {Number(stoneWeight) > 0 && (
                <span className="text-[8px] text-slate-500">
                  کل: <span className="font-mono">{totalWeight}</span>g
                </span>
              )}
            </div>
          ) : (
            <span className="text-[8px] text-slate-500 truncate max-w-[80px]">{storeName}</span>
          )}

          <div className="flex flex-col items-center">
            {showWage && wageStr !== '-' && (
              <div className="text-[8px] text-slate-600">
                اجرت: <span className="font-mono font-bold">{wageStr}</span>
              </div>
            )}
            {showPrice && item.totalPrice && Number(item.totalPrice) > 0 && (
              <div className="text-[7.5px] font-bold text-emerald-700">
                {Number(item.totalPrice).toLocaleString('fa-IR')}
              </div>
            )}
          </div>

          {showQr && (
            <div className="w-5 h-5">
              <QrCodeSvg value={barcode} size={20} color="#000000" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Rat-Tail / Dumbbell Label (دم‌موشی طلا): Two pads connected by a loop bridge
  const isWide = template === 'rat_tail_wide';
  const padWidthClass = isWide ? 'w-36' : 'w-28';
  const padHeightClass = isWide ? 'h-24' : 'h-20';

  return (
    <div
      className={`label-sticker select-none inline-flex items-center justify-center bg-white text-slate-950 ${
        orientation === 'left_to_right' ? 'flex-row' : 'flex-row-reverse'
      } ${
        isPrintMode
          ? 'break-inside-avoid m-0 p-0 shadow-none border-none'
          : 'p-1 shadow-md border border-slate-300 dark:border-slate-600 rounded-lg'
      } ${className}`}
      style={{
        direction: 'ltr',
        ...(isPrintMode
          ? {
              width: isWide ? '80mm' : '68mm',
              height: isWide ? '12mm' : '10mm',
              margin: 0,
              padding: 0,
            }
          : {}),
      }}
    >
      {/* Left Pad: Product Specs & Weight */}
      <div
        className={`${padWidthClass} ${padHeightClass} ${
          isPrintMode
            ? 'border border-black/80 rounded-xs'
            : 'border border-dashed border-slate-300 rounded bg-slate-50/50'
        } p-1 flex flex-col justify-between text-[9px]`}
        style={
          isPrintMode
            ? {
                width: isWide ? '36mm' : '30mm',
                height: isWide ? '12mm' : '10mm',
                padding: '0.6mm',
                boxSizing: 'border-box',
                direction: 'rtl',
              }
            : { direction: 'rtl' }
        }
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-0.5">
          <span className="font-bold text-[9px] truncate max-w-[70px] text-slate-900">{title}</span>
          {showPurity && (
            <span
              className={`font-mono font-bold text-[8px] px-0.5 rounded ${
                isPrintMode ? 'border border-black text-black bg-white' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {purity} ({PRODUCT_COLOR_LABELS[item.productColor || 'yellow']})
            </span>
          )}
        </div>

        {showWeight ? (
          <div className="space-y-0.5 text-[8px]">
            <div className="flex justify-between">
              <span className="text-slate-500">وزن کل:</span>
              <span className="font-mono font-semibold">{totalWeight} g</span>
            </div>

            {Number(stoneWeight) > 0 && (
              <div className="flex justify-between text-[7.5px] text-slate-500">
                <span className="truncate max-w-[65px]" title={item.mountedStones?.map((s) => s.name).join('، ')}>
                  {item.mountedStones && item.mountedStones.length > 0
                    ? item.mountedStones.map((s) => s.name).join('، ')
                    : 'کسر نگین:'}
                </span>
                <span className="font-mono">{stoneWeight} g</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-0.5">
              <span>خالص:</span>
              <span className="font-mono">{netWeight} g</span>
            </div>
          </div>
        ) : (
          <div className="py-2 text-center text-[8px] text-slate-600 font-medium">
            {storeName}
          </div>
        )}

        <div className="flex items-center justify-between text-[7.5px] text-slate-600 border-t border-slate-100 pt-0.5">
          {showWage && wageStr !== '-' ? (
            <span>اجرت: {wageStr}</span>
          ) : showPrice && item.totalPrice && Number(item.totalPrice) > 0 ? (
            <span className="text-emerald-700 font-bold">{Number(item.totalPrice).toLocaleString('fa-IR')}</span>
          ) : (
            <span className="truncate">{storeName}</span>
          )}
          {item.storageLocation && (
            <span className="text-[7px] text-slate-400 truncate max-w-[40px]">
              {item.storageLocation}
            </span>
          )}
        </div>
      </div>

      {/* Center Tail / Bridge (دم‌موشی) */}
      <div
        className="w-8 flex flex-col items-center justify-center px-0.5"
        style={
          isPrintMode
            ? {
                width: '8mm',
                height: isWide ? '12mm' : '10mm',
              }
            : {}
        }
      >
        <div
          className={`w-full ${
            isPrintMode
              ? 'border-none bg-transparent'
              : 'h-2 border-y border-dashed border-slate-400 bg-slate-100 flex items-center justify-center'
          }`}
        >
          {!isPrintMode && <span className="text-[5px] text-slate-400">✂️</span>}
        </div>
      </div>

      {/* Right Pad: Barcode & QR Code */}
      <div
        className={`${padWidthClass} ${padHeightClass} ${
          isPrintMode
            ? 'border border-black/80 rounded-xs'
            : 'border border-dashed border-slate-300 rounded bg-slate-50/50'
        } p-1 flex flex-col justify-between items-center text-[9px]`}
        style={
          isPrintMode
            ? {
                width: isWide ? '36mm' : '30mm',
                height: isWide ? '12mm' : '10mm',
                padding: '0.6mm',
                boxSizing: 'border-box',
                direction: 'rtl',
              }
            : { direction: 'rtl' }
        }
      >
        <div className="w-full text-center text-[8px] font-bold text-slate-700 truncate">
          {storeName}
        </div>

        {showBarcode ? (
          <div className="w-full flex items-center justify-center my-0.5">
            <BarcodeSvg
              value={barcode}
              height={isWide ? (isPrintMode ? 28 : 34) : (isPrintMode ? 22 : 28)}
              barColor="#000000"
              textColor="#000000"
            />
          </div>
        ) : (
          <div className="my-2 font-mono font-bold text-[10px] text-slate-900">
            {barcode}
          </div>
        )}

        <div className="w-full flex items-center justify-between border-t border-slate-200 pt-0.5 text-[7px] text-slate-500">
          <span className="font-mono">{barcode}</span>
          {showQr && (
            <div className="w-4 h-4">
              <QrCodeSvg value={barcode} size={16} color="#000000" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
