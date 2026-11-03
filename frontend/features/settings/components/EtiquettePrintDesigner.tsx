'use client';

import React, { useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Diamond,
  Eye,
  FileText,
  Gem,
  Layers,
  Loader2,
  Palette,
  Printer,
  QrCode,
  Save,
  ScanLine,
  Sliders,
  Sparkles,
  Tag,
  Type,
  LayoutGrid,
  Scale,
  Coins,
  MapPin,
} from 'lucide-react';
import LabelPreviewCard, {
  type LabelSize,
  type LabelTemplate,
} from '@/features/etiquettes/components/LabelPreviewCard';
import EtiquettePrintPortal from '@/features/etiquettes/components/EtiquettePrintPortal';
import { type AppSettings } from '@/lib/settings';
import { useToastManager } from '@/components/ui/toast';

export interface EtiquettePrintDesignerProps {
  settings: AppSettings;
  updateFormField: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onSave?: () => Promise<void> | void;
  isSaving?: boolean;
  saveSuccess?: boolean;
}

export type EtiquetteTabType = 'plain' | 'gemstone' | 'jewelry' | 'base';

export const ETIQUETTE_TYPE_TABS: Array<{
  id: EtiquetteTabType;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge: string;
  prefixKey: 'etiquettePrefixPlain' | 'etiquettePrefixGemstone' | 'etiquettePrefixJewelry' | 'etiquettePrefixBase';
  defaultPrefix: string;
}> = [
  {
    id: 'plain',
    title: 'اتیکت ساده',
    subtitle: 'بدون سنگ (النگو، زنجیر، پلاک و مصنوعات تمام طلا)',
    icon: Tag,
    badge: 'ساده',
    prefixKey: 'etiquettePrefixPlain',
    defaultPrefix: 'S-',
  },
  {
    id: 'gemstone',
    title: 'اتیکت سنگ‌دار',
    subtitle: 'نگین‌های رنگی و اتمی (با تفکیک و کسر سنگ)',
    icon: Gem,
    badge: 'سنگ‌دار',
    prefixKey: 'etiquettePrefixGemstone',
    defaultPrefix: 'G-',
  },
  {
    id: 'jewelry',
    title: 'اتیکت جواهر',
    subtitle: 'الماس، برلیان، یاقوت و زمرد با قیراط سنگ',
    icon: Diamond,
    badge: 'جواهر',
    prefixKey: 'etiquettePrefixJewelry',
    defaultPrefix: 'J-',
  },
  {
    id: 'base',
    title: 'اتیکت پایه',
    subtitle: 'پایه کار و مصنوعات خام آماده مخراج‌کاری',
    icon: Layers,
    badge: 'پایه',
    prefixKey: 'etiquettePrefixBase',
    defaultPrefix: 'P-',
  },
];

export const TEMPLATE_OPTIONS: Array<{
  id: LabelTemplate;
  title: string;
  size: string;
  description: string;
  badge: string;
  isDefault?: boolean;
}> = [
  {
    id: 'slim_tail',
    title: 'مدل دمباریک یکطرفه (تک کادر یا مستطیلی دمدار)',
    size: 'سایزهای 44×10، 60×10 و 70×10 میلی‌متر',
    description:
      'قالب مبنا و استاندارد زرگری ایران؛ دارای یک کادر چاپ مستطیلی در ابعاد استاندارد به‌همراه نوار باریک (دم) جهت حلقه زدن دور مصنوع بدون افتادن چسب روی طلا.',
    badge: 'قالب مبنا و پیش‌فرض',
    isDefault: true,
  },
  {
    id: 'rat_tail',
    title: 'دم‌موشی دوطرفه پروانه‌ای (Rat-Tail)',
    size: '40 × 10 میلی‌متر (دو پد قرینه)',
    description: 'برچسب دم‌موشی با دو کادر چاپی قرینه در دو طرف و دم میانی، مناسب نمایش متقارن نام و بارکد.',
    badge: 'دوطرفه',
  },
  {
    id: 'rat_tail_wide',
    title: 'دم‌موشی پهن (Wide Rat-Tail)',
    size: '50 × 12 میلی‌متر (دو پد)',
    description: 'فضای بیشتر برای نام کامل گالری، کد مدل، وزن دقیق و جزئیات مخراج‌کاری سنگ‌ها.',
    badge: 'اطلاعات کامل',
  },
  {
    id: 'thermal_single',
    title: 'برچسب حرارتی تک‌قطعه بدون دم (Single Thermal)',
    size: '40 × 25 / 30 × 20 میلی‌متر',
    description: 'استیکر تک‌کادر بدون دم مناسب جعبه طلا و جواهر، پاکت، بسته‌بندی و ویترین‌های دیواری.',
    badge: 'بسته‌بندی و جعبه',
  },
];

export const SAMPLES_BY_TYPE: Record<EtiquetteTabType, any> = {
  plain: {
    barcode: 'S-000042',
    title: 'دستبند زنجیری فیگارو',
    etiquetteType: 'plain' as const,
    purity: 750,
    metal: 'gold' as const,
    productColor: 'yellow' as const,
    totalWeight: 12.35,
    netWeight: 12.35,
    stoneWeight: 0,
    wage: 11,
    wageType: 'percentage' as const,
    totalPrice: 620000000,
    storageLocation: 'ویترین ۲',
  },
  gemstone: {
    barcode: 'G-000018',
    title: 'نیم‌ست طلا با یاقوت و اتمی',
    etiquetteType: 'gemstone' as const,
    purity: 750,
    metal: 'gold' as const,
    productColor: 'rose_gold' as const,
    totalWeight: 8.65,
    netWeight: 7.25,
    stoneWeight: 1.4,
    wage: 13.5,
    wageType: 'percentage' as const,
    totalPrice: 410000000,
    storageLocation: 'ویترین نیم‌ست',
    mountedStones: [
      {
        id: '1',
        name: 'یاقوت کبود',
        quantity: 2,
        weightCarat: 5.5,
        weightGram: 1.1,
        unitPrice: 0,
        totalPrice: 0,
        isDeducted: true,
      },
      {
        id: '2',
        name: 'اتمی اتریشی',
        quantity: 6,
        weightCarat: 1.5,
        weightGram: 0.3,
        unitPrice: 0,
        totalPrice: 0,
        isDeducted: true,
      },
    ],
  },
  jewelry: {
    barcode: 'J-000108',
    title: 'انگشتر سولیتر برلیان',
    etiquetteType: 'jewelry' as const,
    purity: 750,
    metal: 'gold' as const,
    productColor: 'white' as const,
    totalWeight: 4.82,
    netWeight: 4.54,
    stoneWeight: 0.28,
    wage: 16,
    wageType: 'percentage' as const,
    totalPrice: 285000000,
    storageLocation: 'ویترین اصلی جواهر',
    mountedStones: [
      {
        id: '1',
        name: 'برلیان سفید',
        quantity: 1,
        weightCarat: 1.4,
        weightGram: 0.28,
        unitPrice: 0,
        totalPrice: 0,
        isDeducted: true,
      },
    ],
  },
  base: {
    barcode: 'P-000007',
    title: 'پایه انگشتر سولیتر (خام)',
    etiquetteType: 'base' as const,
    purity: 750,
    metal: 'gold' as const,
    productColor: 'yellow' as const,
    totalWeight: 4.54,
    netWeight: 4.54,
    stoneWeight: 0,
    wage: 9,
    wageType: 'percentage' as const,
    totalPrice: 227000000,
    storageLocation: 'قفسه پایه‌ها',
  },
};

export default function EtiquettePrintDesigner({
  settings,
  updateFormField,
  onSave,
  isSaving = false,
  saveSuccess = false,
}: EtiquettePrintDesignerProps) {
  const toast = useToastManager();
  const [activeTypeTab, setActiveTypeTab] = useState<EtiquetteTabType>('plain');

  const currentTemplate = settings.etiquettePrintTemplate || 'slim_tail';
  const currentSize: LabelSize = settings.etiquettePrintSize || '60x10';
  const currentOrientation = settings.etiquettePrintOrientation || 'right_to_left';
  const currentStoreName =
    settings.etiquettePrintStoreName || settings.printStoreName || settings.organizationName || 'زرین گالری';

  const currentFontSize = settings.etiquetteFontSize || 'standard';
  const currentBarcodeLayout = settings.etiquetteBarcodeLayout || 'both';
  const currentPurityFormat = settings.etiquettePurityFormat || 'standard';
  const currentCustomNote = settings.etiquetteCustomNote || '';

  const showStoreName = settings.etiquettePrintShowStoreName ?? true;
  const showTitle = settings.etiquettePrintShowTitle ?? true;
  const showPurity = settings.etiquettePrintShowPurity ?? true;
  const showWeight = settings.etiquettePrintShowWeight ?? true;
  const showGrossWeight = settings.etiquettePrintShowGrossWeight ?? true;
  const showStoneWeight = settings.etiquettePrintShowStoneWeight ?? true;
  const showWage = settings.etiquettePrintShowWage ?? true;
  const showPrice = settings.etiquettePrintShowPrice ?? false;
  const showQr = settings.etiquettePrintShowQr ?? true;
  const showBarcode = settings.etiquettePrintShowBarcode ?? true;
  const showCode = settings.etiquettePrintShowCode ?? true;
  const showLocation = settings.etiquettePrintShowLocation ?? false;

  const handleTestPrint = () => {
    window.print();
  };

  const handleSaveAction = async () => {
    if (onSave) {
      await onSave();
    }
  };

  const activeTabConfig = ETIQUETTE_TYPE_TABS.find((t) => t.id === activeTypeTab) || ETIQUETTE_TYPE_TABS[0];
  const sampleItem = SAMPLES_BY_TYPE[activeTypeTab];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Panel with Quick Save Button */}
      <section className="dashboard-panel p-5 space-y-3 bg-card border border-border/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-border/70">
          <div>
            <p className="eyebrow text-amber-600 dark:text-amber-400">شخصی‌سازی، طراحی و چاپ لیبل زرگری</p>
            <h2 className="flex items-center gap-2 text-sm sm:text-base font-black text-foreground">
              <Tag size={19} className="text-amber-500" />
              طراح و تنظیمات چاپ اتیکت و برچسب طلا و جواهر
            </h2>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleTestPrint}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl border border-border/80 hover:bg-muted text-xs font-bold text-foreground transition active:scale-98 cursor-pointer"
            >
              <Printer size={15} />
              <span>چاپ آزمایشی</span>
            </button>

            {onSave && (
              <button
                type="button"
                onClick={handleSaveAction}
                disabled={isSaving}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition active:scale-98 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : saveSuccess ? (
                  <Check size={15} />
                ) : (
                  <Save size={15} />
                )}
                <span>{isSaving ? 'در حال ذخیره...' : saveSuccess ? 'ذخیره شد' : 'ذخیره تنظیمات'}</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          قالب پیش‌فرض برچسب‌های حرارتی طلافروشی، ابعاد چاپ، جهت قرارگیری لیبل روی رول، تایپوگرافی، چیدمان المان‌ها
          و پیشوند ۴ نوع اتیکت (ساده، سنگ‌دار، جواهر و پایه) را به دلخواه خود طراحی و ذخیره فرمایید.
        </p>
      </section>

      {/* 4 Etiquette Types Selector Tabs */}
      <section className="dashboard-panel p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-black text-foreground">
              انتخاب نوع اتیکت جهت پیش‌نمایش و کدگذاری اختصاصی (۴ نوع اتیکت)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">نوع در حال پیش‌نمایش: {activeTabConfig.title}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {ETIQUETTE_TYPE_TABS.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTypeTab === tab.id;
            const prefixValue = settings[tab.prefixKey] || tab.defaultPrefix;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTypeTab(tab.id)}
                className={`p-3 rounded-2xl border-2 text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  isActive
                    ? 'border-amber-500 bg-amber-500/10 dark:bg-amber-500/15 shadow-xs'
                    : 'border-border/70 hover:border-border bg-card hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <IconComponent size={16} />
                    </div>
                    <span className="text-xs font-black text-foreground">{tab.title}</span>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {prefixValue}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                  {tab.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main Grid: Left Controls (7 cols), Right Sticky Live Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Designer Configuration Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Etiquette Type Guide & Prefix */}
          <section className="dashboard-panel p-5 space-y-3.5 bg-amber-50/50 dark:bg-amber-950/20 border-amber-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <activeTabConfig.icon size={16} className="text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-black text-foreground">
                  تنظیمات کدگذاری و پیشوند بارکد: {activeTabConfig.title}
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-300">
                {activeTabConfig.badge}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  پیشوند شروع شماره بارکد {activeTabConfig.title}
                </label>
                <input
                  type="text"
                  value={settings[activeTabConfig.prefixKey] || ''}
                  onChange={(e) => updateFormField(activeTabConfig.prefixKey, e.target.value)}
                  placeholder={activeTabConfig.defaultPrefix}
                  className="w-full font-mono text-xs font-bold rounded-xl border border-border/80 bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  maxLength={20}
                />
                <small className="text-[10px] text-muted-foreground mt-1 block">
                  نمونه کد جدید: {settings[activeTabConfig.prefixKey] || activeTabConfig.defaultPrefix}000001
                </small>
              </div>

              <div className="text-[11px] text-muted-foreground leading-relaxed p-2.5 rounded-xl bg-background/80 border border-border/60">
                {activeTypeTab === 'plain' && (
                  <p>در اتیکت‌های ساده، وزن کل معادل وزن خالص طلا است و ردیف کسر نگین به‌صورت خودکار مخفی می‌شود.</p>
                )}
                {activeTypeTab === 'gemstone' && (
                  <p>در اتیکت‌های سنگ‌دار، وزن ناخالص و کسر سنگ‌های سوارشده جهت محاسبه وزن خالص طلا درج می‌گردد.</p>
                )}
                {activeTypeTab === 'jewelry' && (
                  <p>در اتیکت‌های جواهر، عیار، قیراط برلیان/الماس و تفکیک ارزش یا اجرت سنگ ثبت می‌گردد.</p>
                )}
                {activeTypeTab === 'base' && (
                  <p>در اتیکت‌های پایه، مشخصات قطعه خام طلا آماده مخراج‌کاری و کارگاه زرگری چاپ می‌شود.</p>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 1: Template, Size & Roll Orientation (مبنا: دمباریک یکطرفه) */}
          <section className="dashboard-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <Palette size={16} className="text-amber-500" />
                مدل، ابعاد و جهت قرارگیری برچسب روی رول
              </h3>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                مبنا: دمباریک یکطرفه
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {TEMPLATE_OPTIONS.map((opt) => {
                const isSelected = currentTemplate === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => updateFormField('etiquettePrintTemplate', opt.id)}
                    className={`relative p-3.5 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10 shadow-xs'
                        : 'border-border/70 hover:border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-foreground">
                            {opt.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {opt.size}
                          </span>
                          {opt.badge && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {opt.description}
                        </p>
                      </div>

                      <div
                        className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500 text-slate-950 font-black'
                            : 'border-muted-foreground/40 bg-transparent'
                        }`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>

                    {/* Sub-Selector for Slim Tail Sizes */}
                    {opt.id === 'slim_tail' && isSelected && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-3 pt-3 border-t border-amber-500/20 space-y-3 animate-in fade-in duration-150"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-foreground">
                          <span>سایز استاندارد دمباریک یکطرفه:</span>
                          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400">
                            {currentSize === '44x10' ? '44×10 mm' : currentSize === '70x10' ? '70×10 mm' : '60×10 mm (پیش‌فرض)'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: '44x10', label: '۴۴ × ۱۰ میلی‌متر', desc: 'کوچک / انگشتر ظریف' },
                            { id: '60x10', label: '۶۰ × ۱۰ میلی‌متر', desc: 'استاندارد طلافروشی‌ها' },
                            { id: '70x10', label: '۷۰ × ۱۰ میلی‌متر', desc: 'بزرگ / فضای بیشتر' },
                          ].map((sz) => (
                            <button
                              key={sz.id}
                              type="button"
                              onClick={() => updateFormField('etiquettePrintSize', sz.id as LabelSize)}
                              className={`p-2 rounded-xl text-center border transition-all ${
                                currentSize === sz.id
                                  ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs'
                                  : 'border-border/80 bg-background hover:bg-muted text-foreground'
                              }`}
                            >
                              <div className="font-mono text-xs">{sz.label}</div>
                              <div className="text-[9px] opacity-80">{sz.desc}</div>
                            </button>
                          ))}
                        </div>

                        {/* Orientation Selector: چپ به راست یا راست به چپ */}
                        <div className="pt-2 border-t border-amber-500/20 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-foreground">
                            <span className="flex items-center gap-1.5">
                              <ArrowLeftRight size={13} className="text-amber-600 dark:text-amber-400" />
                              جهت قرارگیری لیبل روی رول (سمت کادر چاپ نسبت به دم):
                            </span>
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 font-mono">
                              {currentOrientation === 'right_to_left'
                                ? 'راست به چپ (پد راست / دم چپ)'
                                : 'چپ به راست (پد چپ / دم راست)'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => updateFormField('etiquettePrintOrientation', 'right_to_left')}
                              className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                                currentOrientation === 'right_to_left'
                                  ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs'
                                  : 'border-border/80 bg-background hover:bg-muted text-foreground'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black">راست به چپ (RTL)</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/10">پیش‌فرض</span>
                              </div>
                              <p className="text-[10px] opacity-90 leading-tight">
                                کادر لیبل در <strong>سمت راست</strong> رول، نوار دم در سمت چپ
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => updateFormField('etiquettePrintOrientation', 'left_to_right')}
                              className={`p-2.5 rounded-xl border text-right transition-all flex flex-col gap-1 ${
                                currentOrientation === 'left_to_right'
                                  ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs'
                                  : 'border-border/80 bg-background hover:bg-muted text-foreground'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black">چپ به راست (LTR)</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/10">معکوس</span>
                              </div>
                              <p className="text-[10px] opacity-90 leading-tight">
                                کادر لیبل در <strong>سمت چپ</strong> رول، نوار دم در سمت راست
                              </p>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 2: Typography & Font Sizing */}
          <section className="dashboard-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <Type size={16} className="text-amber-500" />
                اندازه قلم و تراکم متن اتیکت (Typography)
              </h3>
              <span className="text-[10px] text-muted-foreground font-mono">
                {currentFontSize === 'compact' ? 'ریز (Compact)' : currentFontSize === 'large' ? 'درشت (Large)' : 'استاندارد (Standard)'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'compact', title: 'فشرده و ریز', desc: 'مناسب سایز ۴۴×۱۰ و متن‌های طولانی' },
                { id: 'standard', title: 'متوازن و استاندارد', desc: 'پیش‌فرض طلایی زرگری (۶۰×۱۰)' },
                { id: 'large', title: 'درشت و خوانا', desc: 'خوانایی بالا برای سایز ۷۰×۱۰' },
              ].map((fontOpt) => {
                const isSelected = currentFontSize === fontOpt.id;
                return (
                  <button
                    key={fontOpt.id}
                    type="button"
                    onClick={() => updateFormField('etiquetteFontSize', fontOpt.id as any)}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'border-border/80 bg-card hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <span className="text-xs font-black">{fontOpt.title}</span>
                    <span className="text-[9.5px] opacity-80 mt-1 leading-snug">{fontOpt.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SECTION 3: Store Name, Title & Custom Note */}
          <section className="dashboard-panel p-5 space-y-4">
            <h3 className="text-xs font-black text-foreground flex items-center gap-2">
              <FileText size={16} className="text-amber-500" />
              عنوان، نام گالری و متن دلخواه برچسب
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  نام اختصاصی فروشگاه / گالری روی اتیکت
                </label>
                <input
                  type="text"
                  value={settings.etiquettePrintStoreName || ''}
                  onChange={(e) => updateFormField('etiquettePrintStoreName', e.target.value)}
                  placeholder={settings.printStoreName || settings.organizationName || 'زر فولیـو'}
                  className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  maxLength={60}
                />
                <small className="text-[10px] text-muted-foreground mt-1 block">
                  در صورت خالی بودن، نام کلی فروشگاه ({settings.printStoreName || settings.organizationName || 'زر فولیـو'}) درج می‌شود.
                </small>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground block mb-1">
                  متن دلخواه / شعار / کد اتحادیه (اختیاری)
                </label>
                <input
                  type="text"
                  value={settings.etiquetteCustomNote || ''}
                  onChange={(e) => updateFormField('etiquetteCustomNote', e.target.value)}
                  placeholder="مثال: تضمین عیار ۷۵۰، کد اتحادیه: الف-۱۲۳، یا شماره تماس"
                  className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  maxLength={120}
                />
                <small className="text-[10px] text-muted-foreground mt-1 block">
                  این متن در صورت وجود، به‌عنوان زیرنویس یا شعار اعتباری روی پد چاپ ظاهر می‌شود.
                </small>
              </div>
            </div>
          </section>

          {/* SECTION 4: Barcode & QR Code Layout Selector */}
          <section className="dashboard-panel p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <QrCode size={16} className="text-amber-500" />
                نحوه چیدمان بارکد و کدهای تصویری
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground">
                {currentBarcodeLayout === 'both'
                  ? 'بارکد میله‌ای + QR'
                  : currentBarcodeLayout === 'barcode_only'
                  ? 'فقط بارکد میله‌ای'
                  : currentBarcodeLayout === 'qr_only'
                  ? 'فقط کد QR'
                  : 'فقط کد متنی'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'both', label: 'بارکد و QR', desc: 'اسکن نوری و موبایل' },
                { id: 'barcode_only', label: 'فقط بارکد میله‌ای', desc: 'بارکدخوان تفنگی' },
                { id: 'qr_only', label: 'فقط کد QR', desc: 'اسکن دوبعدی موبایل' },
                { id: 'code_only', label: 'فقط کد متنی', desc: 'بدون تصویر بارکد' },
              ].map((bOpt) => {
                const isSelected = currentBarcodeLayout === bOpt.id;
                return (
                  <button
                    key={bOpt.id}
                    type="button"
                    onClick={() => updateFormField('etiquetteBarcodeLayout', bOpt.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'border-border/80 bg-card hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <div className="text-xs font-black">{bOpt.label}</div>
                    <div className="text-[9px] opacity-80 mt-0.5">{bOpt.desc}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SECTION 5: Purity Display Format */}
          <section className="dashboard-panel p-5 space-y-4">
            <h3 className="text-xs font-black text-foreground flex items-center gap-2">
              <Coins size={16} className="text-amber-500" />
              فرمت نمایش عیار طلا روی اتیکت
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'standard', label: 'استاندارد + رنگ', example: '۷۵۰ طلا (زرد)' },
                { id: 'karat_only', label: 'فقط عدد عیار', example: '۷۵۰' },
                { id: 'full', label: 'بین‌المللی (عیار+K)', example: '18K (750)' },
              ].map((pOpt) => {
                const isSelected = currentPurityFormat === pOpt.id;
                return (
                  <button
                    key={pOpt.id}
                    type="button"
                    onClick={() => updateFormField('etiquettePurityFormat', pOpt.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'border-border/80 bg-card hover:bg-muted/40 text-foreground'
                    }`}
                  >
                    <div className="text-xs font-black">{pOpt.label}</div>
                    <div className="text-[10px] font-mono opacity-80 mt-1">{pOpt.example}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SECTION 6: Detailed Element Visibility Toggles (دست کاربر کاملاً باز است) */}
          <section className="dashboard-panel p-5 space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-border/70">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <LayoutGrid size={16} className="text-amber-500" />
                روشن/خاموش کردن المان‌های چاپ (کنترل کامل چیدمان)
              </h3>
              <span className="text-[10px] text-muted-foreground">طراحی اختصاصی شما</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Show Store Name */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={(e) => updateFormField('etiquettePrintShowStoreName', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج نام فروشگاه / گالری</span>
                  <span className="text-[10px] text-muted-foreground">نام برند طلافروشی در بالای پد</span>
                </div>
              </label>

              {/* Show Title */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showTitle}
                  onChange={(e) => updateFormField('etiquettePrintShowTitle', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج نام قطعه / مصنوع</span>
                  <span className="text-[10px] text-muted-foreground">مانند انگشتر، النگو یا پلاک</span>
                </div>
              </label>

              {/* Show Purity */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showPurity}
                  onChange={(e) => updateFormField('etiquettePrintShowPurity', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج عیار استاندارد</span>
                  <span className="text-[10px] text-muted-foreground">عیار ۷۵۰ یا ۱۸ عیار</span>
                </div>
              </label>

              {/* Show Net Weight */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showWeight}
                  onChange={(e) => updateFormField('etiquettePrintShowWeight', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج وزن خالص طلا</span>
                  <span className="text-[10px] text-muted-foreground">وزن واقعی طلای مصرفی به گرم</span>
                </div>
              </label>

              {/* Show Gross Weight */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showGrossWeight}
                  onChange={(e) => updateFormField('etiquettePrintShowGrossWeight', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج وزن کل (ناخالص)</span>
                  <span className="text-[10px] text-muted-foreground">وزن کار همراه با سنگ و متعلقات</span>
                </div>
              </label>

              {/* Show Stone Weight / Carat */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showStoneWeight}
                  onChange={(e) => updateFormField('etiquettePrintShowStoneWeight', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج کسر سنگ و قیراط جواهر</span>
                  <span className="text-[10px] text-muted-foreground">کسر نگین اتمی یا قیراط الماس</span>
                </div>
              </label>

              {/* Show Wage */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showWage}
                  onChange={(e) => updateFormField('etiquettePrintShowWage', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج اجرت ساخت</span>
                  <span className="text-[10px] text-muted-foreground">درصد یا مبلغ ریالی اجرت</span>
                </div>
              </label>

              {/* Show Price */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => updateFormField('etiquettePrintShowPrice', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج قیمت تخمینی</span>
                  <span className="text-[10px] text-muted-foreground">ارزش ریالی روز مصنوع</span>
                </div>
              </label>

              {/* Show 1D Barcode */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showBarcode}
                  onChange={(e) => updateFormField('etiquettePrintShowBarcode', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">بارکد میله‌ای (Code 128)</span>
                  <span className="text-[10px] text-muted-foreground">اسکن سریع با بارکدخوان خطی</span>
                </div>
              </label>

              {/* Show QR Code */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showQr}
                  onChange={(e) => updateFormField('etiquettePrintShowQr', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">کد تصویری دو بعدی (QR Code)</span>
                  <span className="text-[10px] text-muted-foreground">اسکن سریع توسط دوربین موبایل</span>
                </div>
              </label>

              {/* Show Alphanumeric Code */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showCode}
                  onChange={(e) => updateFormField('etiquettePrintShowCode', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج شناسه متنی اتیکت</span>
                  <span className="text-[10px] text-muted-foreground">کد خوانای انسان (مانند S-000042)</span>
                </div>
              </label>

              {/* Show Storage Location */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card cursor-pointer hover:bg-muted/40 transition">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => updateFormField('etiquettePrintShowLocation', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <div>
                  <span className="font-bold block text-foreground">درج محل نگهداری / ویترین</span>
                  <span className="text-[10px] text-muted-foreground">نمایش نام ویترین یا قفسه کالا</span>
                </div>
              </label>
            </div>
          </section>

          {/* Bottom Save Action Button for Mobile/Scroll */}
          {onSave && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveAction}
                disabled={isSaving}
                className="flex items-center gap-2 py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-black transition active:scale-98 shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : saveSuccess ? (
                  <Check size={16} />
                ) : (
                  <Save size={16} />
                )}
                <span>{isSaving ? 'در حال ذخیره تغییرات...' : saveSuccess ? 'تنظیمات با موفقیت ذخیره شد' : 'ذخیره تمام تغییرات اتیکت'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Live Preview & Test Print (5 cols) */}
        <div className="lg:col-span-5 space-y-5 sticky top-6">
          <section className="dashboard-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-amber-500" />
                <h3 className="text-xs font-black text-foreground">
                  پیش‌نمایش زنده اتیکت چاپ
                </h3>
              </div>

              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
                {activeTabConfig.title}
              </span>
            </div>

            {/* Preview Stage */}
            <div className="p-6 bg-slate-100 dark:bg-slate-950/60 rounded-2xl border border-border/80 flex items-center justify-center min-h-[220px] overflow-hidden">
              <div id="etiquette-preview-card-container">
                <LabelPreviewCard
                  item={sampleItem}
                  template={currentTemplate}
                  size={currentSize}
                  orientation={currentOrientation}
                  showWage={showWage}
                  showPrice={showPrice}
                  showQr={showQr}
                  showBarcode={showBarcode}
                  showPurity={showPurity}
                  showWeight={showWeight}
                  storeName={currentStoreName}
                  fontSize={currentFontSize}
                  customNote={currentCustomNote}
                  barcodeLayout={currentBarcodeLayout}
                  purityFormat={currentPurityFormat}
                  showStoreName={showStoreName}
                  showTitle={showTitle}
                  showGrossWeight={showGrossWeight}
                  showStoneWeight={showStoneWeight}
                  showCode={showCode}
                  showLocation={showLocation}
                />
              </div>
            </div>

            <div className="space-y-1.5 text-center p-3 rounded-xl bg-background/60 border border-border/60">
              <p className="text-[11px] font-bold text-foreground">
                مدل: {TEMPLATE_OPTIONS.find((t) => t.id === currentTemplate)?.title}
              </p>
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                <span>ابعاد: {currentTemplate === 'slim_tail' ? (currentSize === '44x10' ? '۴۴×۱۰ mm' : currentSize === '70x10' ? '۷۰×۱۰ mm' : '۶۰×۱۰ mm') : 'استاندارد'}</span>
                <span>•</span>
                <span>جهت: {currentOrientation === 'right_to_left' ? 'راست به چپ (RTL)' : 'چپ به راست (LTR)'}</span>
                <span>•</span>
                <span>قلم: {currentFontSize === 'compact' ? 'ریز' : currentFontSize === 'large' ? 'درشت' : 'استاندارد'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleTestPrint}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-border/80 hover:bg-muted text-xs font-bold text-foreground transition active:scale-98 cursor-pointer"
              >
                <Printer size={15} />
                <span>چاپ آزمایشی نمونه</span>
              </button>

              {onSave && (
                <button
                  type="button"
                  onClick={handleSaveAction}
                  disabled={isSaving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition active:scale-98 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : saveSuccess ? (
                    <Check size={15} />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>{isSaving ? 'در حال ذخیره...' : saveSuccess ? 'ذخیره شد' : 'ذخیره تنظیمات چاپ'}</span>
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Test Print Portal: Only the sample label prints at exact roll dimensions */}
      <EtiquettePrintPortal
        items={[sampleItem]}
        template={currentTemplate}
        size={currentSize}
        orientation={currentOrientation}
        showWage={showWage}
        showPrice={showPrice}
        showQr={showQr}
        showBarcode={showBarcode}
        showPurity={showPurity}
        showWeight={showWeight}
        storeName={currentStoreName}
        fontSize={currentFontSize}
        customNote={currentCustomNote}
        barcodeLayout={currentBarcodeLayout}
        purityFormat={currentPurityFormat}
        showStoreName={showStoreName}
        showTitle={showTitle}
        showGrossWeight={showGrossWeight}
        showStoneWeight={showStoneWeight}
        showCode={showCode}
        showLocation={showLocation}
      />
    </div>
  );
}
