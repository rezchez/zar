'use client';

import React from 'react';
import {
  Building2,
  FileText,
  Table,
  Database,
  Square,
  Circle,
  Minus,
  Tag,
  QrCode,
  Stamp,
  PenTool,
  Calendar,
  Hash,
  User,
  Phone,
  MapPin,
  Sparkles,
  Image as ImageIcon,
  Layers,
  Plus,
} from 'lucide-react';
import { type ElementType, type InvoicePrintElement } from '@/lib/print-templates';

type PaletteItem = {
  id: string;
  label: string;
  type: ElementType | 'db_quick';
  fieldKey?: string;
  shapeType?: 'rectangle' | 'circle' | 'line_h' | 'line_v' | 'badge';
  icon: React.ReactNode;
  accent: string;
  singleton?: boolean;
};

const PALETTE_GROUPS: { title: string; items: PaletteItem[] }[] = [
  {
    title: 'اطلاعات فروشگاه و سربرگ',
    items: [
      { id: 'shop_logo', label: 'لوگوی فروشگاه', type: 'shop_logo', icon: <ImageIcon size={14} />, accent: 'text-amber-600', singleton: true },
      { id: 'shop_name', label: 'نام فروشگاه', type: 'shop_name', icon: <Building2 size={14} />, accent: 'text-amber-600', singleton: true },
      { id: 'shop_slogan', label: 'شعار فروشگاه', type: 'shop_slogan', icon: <Sparkles size={14} />, accent: 'text-amber-500', singleton: true },
      { id: 'shop_address', label: 'آدرس فروشگاه', type: 'shop_address', icon: <MapPin size={14} />, accent: 'text-slate-500', singleton: true },
      { id: 'shop_phone', label: 'تلفن فروشگاه', type: 'shop_phone', icon: <Phone size={14} />, accent: 'text-slate-500', singleton: true },
      { id: 'invoice_title', label: 'عنوان فاکتور', type: 'invoice_title', icon: <FileText size={14} />, accent: 'text-sky-600', singleton: true },
      { id: 'temporary_invoice_badge', label: 'نشان موقت', type: 'temporary_invoice_badge', icon: <Tag size={14} />, accent: 'text-rose-500', singleton: true },
    ],
  },
  {
    title: 'مشخصات سند و مشتری',
    items: [
      { id: 'invoice_number', label: 'شماره سند', type: 'invoice_number', icon: <Hash size={14} />, accent: 'text-indigo-500', singleton: true },
      { id: 'invoice_date', label: 'تاریخ سند', type: 'invoice_date', icon: <Calendar size={14} />, accent: 'text-indigo-500', singleton: true },
      { id: 'customer_name', label: 'کادر طرف‌حساب', type: 'customer_name', icon: <User size={14} />, accent: 'text-emerald-600', singleton: true },
      { id: 'document_description', label: 'توضیحات سند', type: 'document_description', icon: <FileText size={14} />, accent: 'text-slate-500', singleton: true },
    ],
  },
  {
    title: 'جداول و مبالغ',
    items: [
      { id: 'items_table', label: 'جدول اقلام فاکتور', type: 'items_table', icon: <Table size={14} />, accent: 'text-sky-600', singleton: true },
      { id: 'totals_summary', label: 'جمع‌بندی مانده‌ها', type: 'totals_summary', icon: <Layers size={14} />, accent: 'text-teal-600', singleton: true },
      { id: 'custom_table', label: 'جدول محاسبات سفارشی', type: 'custom_table', icon: <Table size={14} />, accent: 'text-emerald-600' },
    ],
  },
  {
    title: 'داده‌های پویا و بارکد',
    items: [
      { id: 'qr_quick', label: 'بارکد QR هوشمند', type: 'db_quick', fieldKey: 'custom_qrcode', icon: <QrCode size={14} />, accent: 'text-amber-600' },
      { id: 'words_quick', label: 'مبلغ کل به حروف', type: 'db_quick', fieldKey: 'doc_total_price_words', icon: <FileText size={14} />, accent: 'text-emerald-600' },
      { id: 'gold_bal_quick', label: 'مانده نهایی طلا', type: 'db_quick', fieldKey: 'final_balance_gold', icon: <Database size={14} />, accent: 'text-amber-500' },
      { id: 'cash_bal_quick', label: 'مانده نهایی نقدی', type: 'db_quick', fieldKey: 'final_balance_cash', icon: <Database size={14} />, accent: 'text-emerald-600' },
    ],
  },
  {
    title: 'متن، اشکال و پانویس',
    items: [
      { id: 'custom_text', label: 'متن دلخواه', type: 'custom_text', icon: <FileText size={14} />, accent: 'text-amber-600' },
      { id: 'shape_rectangle', label: 'کادر مستطیل', type: 'shape_rectangle', shapeType: 'rectangle', icon: <Square size={14} />, accent: 'text-blue-500' },
      { id: 'shape_circle', label: 'دایره / بیضی', type: 'shape_circle', shapeType: 'circle', icon: <Circle size={14} />, accent: 'text-emerald-500' },
      { id: 'shape_line_h', label: 'خط افقی', type: 'shape_line_h', shapeType: 'line_h', icon: <Minus size={14} />, accent: 'text-purple-500' },
      { id: 'shape_line_v', label: 'خط عمودی', type: 'shape_line_v', shapeType: 'line_v', icon: <Minus size={14} className="rotate-90" />, accent: 'text-purple-500' },
      { id: 'shape_badge', label: 'نشان / برچسب', type: 'shape_badge', shapeType: 'badge', icon: <Tag size={14} />, accent: 'text-amber-500' },
      { id: 'footer_text', label: 'متن پانویس', type: 'footer_text', icon: <FileText size={14} />, accent: 'text-slate-500', singleton: true },
      { id: 'seller_signature', label: 'امضای فروشنده', type: 'seller_signature', icon: <PenTool size={14} />, accent: 'text-slate-600', singleton: true },
      { id: 'customer_signature', label: 'امضای خریدار', type: 'customer_signature', icon: <PenTool size={14} />, accent: 'text-slate-600', singleton: true },
      { id: 'stamp', label: 'مهر فروشگاه', type: 'stamp', icon: <Stamp size={14} />, accent: 'text-rose-500', singleton: true },
      { id: 'print_datetime', label: 'تاریخ و زمان چاپ', type: 'print_datetime', icon: <Calendar size={14} />, accent: 'text-slate-500', singleton: true },
    ],
  },
];

type ElementPaletteProps = {
  elements: InvoicePrintElement[];
  onAddOrRevealSingleton: (type: ElementType) => void;
  onAddCustomText: () => void;
  onAddShape: (shape: 'rectangle' | 'circle' | 'line_h' | 'line_v' | 'badge') => void;
  onAddCustomTable: () => void;
  onAddDbField: (fieldKey: string) => void;
  onOpenFullFieldPicker: () => void;
};

export function ElementPalette({
  elements,
  onAddOrRevealSingleton,
  onAddCustomText,
  onAddShape,
  onAddCustomTable,
  onAddDbField,
  onOpenFullFieldPicker,
}: ElementPaletteProps) {
  const handleItemClick = (item: PaletteItem) => {
    if (item.type === 'custom_text') {
      onAddCustomText();
    } else if (item.type === 'custom_table') {
      onAddCustomTable();
    } else if (item.type === 'db_quick' && item.fieldKey) {
      onAddDbField(item.fieldKey);
    } else if (item.shapeType) {
      onAddShape(item.shapeType);
    } else if (item.type !== 'db_quick') {
      onAddOrRevealSingleton(item.type);
    }
  };

  return (
    <div className="space-y-3">
      {/* Primary DB Field Picker CTA */}
      <button
        type="button"
        onClick={onOpenFullFieldPicker}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-[11px] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Database size={15} />
          <span>افزودن فیلد داده از دیتابیس (۲۷+ فیلد)</span>
        </span>
        <Plus size={14} />
      </button>

      {PALETTE_GROUPS.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 px-1">
            {group.title}
          </h4>
          <div className="grid grid-cols-2 gap-1.5">
            {group.items.map((item) => {
              const existing = item.singleton
                ? elements.find((el) => el.type === item.type)
                : undefined;
              const isVisibleOnCanvas = Boolean(existing?.visible);

              return (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'application/zar-palette-item',
                      JSON.stringify({
                        type: item.type,
                        fieldKey: item.fieldKey,
                        shapeType: item.shapeType,
                      }),
                    );
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center gap-1.5 p-2 rounded-xl border text-right text-[10.5px] font-bold transition-all cursor-pointer active:scale-[0.98] ${
                    isVisibleOnCanvas
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-slate-800'
                  }`}
                  title={
                    isVisibleOnCanvas
                      ? 'در صفحه فعال است (کلیک برای انتخاب)'
                      : 'کلیک یا کشیدن روی صفحه برای افزودن'
                  }
                >
                  <span className={`shrink-0 ${item.accent}`}>{item.icon}</span>
                  <span className="truncate flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
