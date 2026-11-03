'use client';

import React, { useState } from 'react';
import {
  Check,
  Eye,
  Layers,
  Printer,
  QrCode,
  Settings,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import LabelPreviewCard, { type LabelTemplate, type LabelOrientation } from './LabelPreviewCard';
import EtiquettePrintPortal from './EtiquettePrintPortal';
import { type EtiquetteRecord } from '@/lib/etiquette';
import { useAppSettings } from '@/src/components/SettingsProvider';

export interface EtiquettePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: EtiquetteRecord[];
  onPrintedSuccess?: (printedIds: string[]) => void;
}

export default function EtiquettePrintModal({
  isOpen,
  onClose,
  items,
  onPrintedSuccess,
}: EtiquettePrintModalProps) {
  const { settings } = useAppSettings();

  const [template, setTemplate] = useState<LabelTemplate>(settings.etiquettePrintTemplate || 'slim_tail');
  const [orientation, setOrientation] = useState<LabelOrientation>(
    settings.etiquettePrintOrientation || 'right_to_left'
  );
  const [showWage, setShowWage] = useState(settings.etiquettePrintShowWage ?? true);
  const [showPrice, setShowPrice] = useState(settings.etiquettePrintShowPrice ?? false);
  const [showQr, setShowQr] = useState(settings.etiquettePrintShowQr ?? true);
  const [storeName, setStoreName] = useState(
    settings.etiquettePrintStoreName || settings.printStoreName || settings.organizationName || 'زرین گالری'
  );
  const [isMarking, setIsMarking] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (settings.etiquettePrintTemplate) setTemplate(settings.etiquettePrintTemplate);
      if (settings.etiquettePrintOrientation) setOrientation(settings.etiquettePrintOrientation);
      if (typeof settings.etiquettePrintShowWage === 'boolean') setShowWage(settings.etiquettePrintShowWage);
      if (typeof settings.etiquettePrintShowPrice === 'boolean') setShowPrice(settings.etiquettePrintShowPrice);
      if (typeof settings.etiquettePrintShowQr === 'boolean') setShowQr(settings.etiquettePrintShowQr);
      const name = settings.etiquettePrintStoreName || settings.printStoreName || settings.organizationName;
      if (name) setStoreName(name);
    }
  }, [isOpen, settings]);

  if (!isOpen || items.length === 0) return null;

  const handlePrint = async () => {
    // 1. Invoke native window print
    window.print();

    // 2. Mark items as printed via batch API
    setIsMarking(true);
    try {
      const ids = items.map((i) => i.id);
      await fetch('/api/etiquettes/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_printed', ids }),
      });

      if (onPrintedSuccess) {
        onPrintedSuccess(ids);
      }
    } catch (err) {
      console.error('Failed to mark items as printed:', err);
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 print:hidden"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
        {/* Header - Hidden on Print */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/40 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                چاپ برچسب و اتیکت طلا ({items.length} قلم)
              </h2>
              <p className="text-xs text-muted-foreground">
                تنظیم ابعاد برچسب، نوع دم‌موشی یا حرارتی و پیش‌نمایش قبل از ارسال به چاپگر
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Configuration Bar - Hidden on Print */}
        <div className="border-b border-border/60 bg-muted/10 p-4 print:hidden space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Template Selector */}
            <div>
              <label className="text-[11px] font-bold text-foreground block mb-1">
                قالب و نوع برچسب
              </label>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value as LabelTemplate)}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="slim_tail">دمباریک یکطرفه (تک کادر مستطیلی دمدار - 60×10 / 44×10 / 70×10) [مبنا]</option>
                <option value="rat_tail">دم‌موشی دوطرفه (Rat-Tail 40×10 mm)</option>
                <option value="rat_tail_wide">دم‌موشی پهن (Rat-Tail Wide 50×12 mm)</option>
                <option value="thermal_single">برچسب حرارتی تک‌قطعه (Thermal 30×20 mm)</option>
              </select>
            </div>

            {/* Roll Orientation Selector */}
            <div>
              <label className="text-[11px] font-bold text-foreground block mb-1">
                جهت کادر لیبل روی رول
              </label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as LabelOrientation)}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                <option value="right_to_left">راست به چپ (پد در راست، دم در چپ)</option>
                <option value="left_to_right">چپ به راست (پد در چپ، دم در راست)</option>
              </select>
            </div>

            {/* Gallery / Store Name */}
            <div>
              <label className="text-[11px] font-bold text-foreground block mb-1">
                عنوان فروشگاه / گالری
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* Checkbox Options */}
            <div className="flex items-end gap-3 pb-1 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showWage}
                  onChange={(e) => setShowWage(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>درج اجرت</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>درج قیمت</span>
              </label>

              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showQr}
                  onChange={(e) => setShowQr(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>کد QR</span>
              </label>
            </div>
          </div>
        </div>

        {/* Preview Area for On-Screen Review */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-950/20">
          <div
            id="etiquette-printable-container"
            className="flex flex-wrap gap-4 items-center justify-center"
          >
            {items.map((it) => (
              <div key={it.id}>
                <LabelPreviewCard
                  item={it}
                  template={template}
                  size={settings.etiquettePrintSize || '60x10'}
                  orientation={orientation}
                  showWage={showWage}
                  showPrice={showPrice}
                  showQr={showQr}
                  showBarcode={settings.etiquettePrintShowBarcode ?? true}
                  showPurity={settings.etiquettePrintShowPurity ?? true}
                  showWeight={settings.etiquettePrintShowWeight ?? true}
                  storeName={storeName}
                  fontSize={settings.etiquetteFontSize || 'standard'}
                  customNote={settings.etiquetteCustomNote || ''}
                  barcodeLayout={settings.etiquetteBarcodeLayout || 'both'}
                  purityFormat={settings.etiquettePurityFormat || 'standard'}
                  showStoreName={settings.etiquettePrintShowStoreName ?? true}
                  showTitle={settings.etiquettePrintShowTitle ?? true}
                  showGrossWeight={settings.etiquettePrintShowGrossWeight ?? true}
                  showStoneWeight={settings.etiquettePrintShowStoneWeight ?? true}
                  showCode={settings.etiquettePrintShowCode ?? true}
                  showLocation={settings.etiquettePrintShowLocation ?? false}
                  isPrintMode={false}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions - Hidden on Print */}
        <div className="flex items-center justify-between border-t border-border/80 px-6 py-4 bg-muted/40">
          <div className="text-xs text-muted-foreground">
            تعداد کل اقلام آماده چاپ: <strong className="font-bold text-foreground">{items.length}</strong> عدد
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
            >
              بستن
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={isMarking}
              className="flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Printer size={16} />
              <span>ارسال به چاپگر ({items.length} برچسب)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dedicated Print Portal for Exact Millimeter Roll Printing (Only Labels Print, Everything Else Hidden) */}
      <EtiquettePrintPortal
        items={items}
        template={template}
        size={settings.etiquettePrintSize || '60x10'}
        orientation={orientation}
        showWage={showWage}
        showPrice={showPrice}
        showQr={showQr}
        showBarcode={settings.etiquettePrintShowBarcode ?? true}
        showPurity={settings.etiquettePrintShowPurity ?? true}
        showWeight={settings.etiquettePrintShowWeight ?? true}
        storeName={storeName}
        fontSize={settings.etiquetteFontSize || 'standard'}
        customNote={settings.etiquetteCustomNote || ''}
        barcodeLayout={settings.etiquetteBarcodeLayout || 'both'}
        purityFormat={settings.etiquettePurityFormat || 'standard'}
        showStoreName={settings.etiquettePrintShowStoreName ?? true}
        showTitle={settings.etiquettePrintShowTitle ?? true}
        showGrossWeight={settings.etiquettePrintShowGrossWeight ?? true}
        showStoneWeight={settings.etiquettePrintShowStoneWeight ?? true}
        showCode={settings.etiquettePrintShowCode ?? true}
        showLocation={settings.etiquettePrintShowLocation ?? false}
      />
    </div>
  );
}
