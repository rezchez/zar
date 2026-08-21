export type PageSizeOption = 'A4' | 'A5' | 'receipt-80' | 'receipt-58' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';
export type UnitType = 'mm' | 'cm' | 'px' | 'pt';

export type ElementType =
  | 'shop_logo'
  | 'shop_name'
  | 'shop_address'
  | 'shop_phone'
  | 'invoice_title'
  | 'temporary_invoice_badge'
  | 'invoice_number'
  | 'invoice_date'
  | 'customer_name'
  | 'customer_phone'
  | 'document_description'
  | 'items_table'
  | 'totals_summary'
  | 'footer_text'
  | 'seller_signature'
  | 'customer_signature'
  | 'stamp'
  | 'print_datetime';

export interface InvoicePrintElementStyle {
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string;
  backgroundColor?: string;
  textAlign?: 'right' | 'center' | 'left';
  borderColor?: string;
  borderWidthMm?: number;
  borderRadiusMm?: number;
  lineHeight?: number;
}

export interface InvoicePrintElementContent {
  text?: string;
  tableColumns?: string[];
}

export interface InvoicePrintElement {
  id: string;
  type: ElementType;
  label?: string;
  visible: boolean;
  position: {
    xMm: number;
    yMm: number;
  };
  size: {
    widthMm: number;
    heightMm: number;
  };
  style: InvoicePrintElementStyle;
  content?: InvoicePrintElementContent;
  zIndex: number;
}

export interface InvoicePrintTemplatePage {
  size: PageSizeOption;
  orientation: PageOrientation;
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  backgroundColor: string;
  borderEnabled: boolean;
  borderColor: string;
  borderWidthMm: number;
}

export interface InvoicePrintTemplateDesign {
  zoom?: number;
  gridEnabled: boolean;
  gridSizeMm: number;
}

export interface InvoicePrintTemplate {
  id: string;
  name: string;
  isActive: boolean;
  isSystemDefault: boolean;
  page: InvoicePrintTemplatePage;
  design: InvoicePrintTemplateDesign;
  elements: InvoicePrintElement[];
  created?: string;
  updated?: string;
}

export const ELEMENT_LABELS: Record<ElementType, string> = {
  shop_logo: 'لوگوی فروشگاه',
  shop_name: 'نام فروشگاه',
  shop_address: 'آدرس فروشگاه',
  shop_phone: 'تلفن فروشگاه',
  invoice_title: 'عنوان فاکتور',
  temporary_invoice_badge: 'نشان فاکتور موقت',
  invoice_number: 'شماره فاکتور / سند',
  invoice_date: 'تاریخ فاکتور / سند',
  customer_name: 'نام طرف‌حساب',
  customer_phone: 'تلفن طرف‌حساب',
  document_description: 'توضیحات سند',
  items_table: 'جدول ردیف‌های سند',
  totals_summary: 'بخش جمع‌بندی مانده‌ها',
  footer_text: 'متن پانویس فاکتور',
  seller_signature: 'امضای فروشنده',
  customer_signature: 'امضای خریدار / مشتری',
  stamp: 'مهر فروشگاه',
  print_datetime: 'تاریخ و زمان چاپ',
};

export const AVAILABLE_TABLE_COLUMNS: { id: string; label: string }[] = [
  { id: 'index', label: 'ردیف' },
  { id: 'operation_type', label: 'نوع عملیات' },
  { id: 'metal_type', label: 'جنس فلز' },
  { id: 'weight', label: 'وزن (گرم)' },
  { id: 'purity', label: 'عیار' },
  { id: 'converted_weight', label: 'وزن معادل' },
  { id: 'debtor', label: 'بدهکار' },
  { id: 'creditor', label: 'بستانکار' },
  { id: 'lab_name', label: 'نام آزمایشگاه / ری‌گیری' },
  { id: 'stamp_number', label: 'شماره پاکت / انگ' },
  { id: 'description', label: 'توضیحات' },
];

export const PAGE_SIZE_DIMENSIONS: Record<
  Exclude<PageSizeOption, 'custom'>,
  { portrait: { widthMm: number; heightMm: number }; landscape: { widthMm: number; heightMm: number } }
> = {
  A4: {
    portrait: { widthMm: 210, heightMm: 297 },
    landscape: { widthMm: 297, heightMm: 210 },
  },
  A5: {
    portrait: { widthMm: 148, heightMm: 210 },
    landscape: { widthMm: 210, heightMm: 148 },
  },
  'receipt-80': {
    portrait: { widthMm: 80, heightMm: 200 },
    landscape: { widthMm: 200, heightMm: 80 },
  },
  'receipt-58': {
    portrait: { widthMm: 58, heightMm: 150 },
    landscape: { widthMm: 150, heightMm: 58 },
  },
};

export function getPageDimensions(
  size: PageSizeOption,
  orientation: PageOrientation,
  customWidthMm = 210,
  customHeightMm = 297,
): { widthMm: number; heightMm: number } {
  if (size === 'custom') {
    return orientation === 'portrait'
      ? { widthMm: customWidthMm, heightMm: customHeightMm }
      : { widthMm: customHeightMm, heightMm: customWidthMm };
  }
  const dims = PAGE_SIZE_DIMENSIONS[size];
  return dims ? dims[orientation] : { widthMm: 210, heightMm: 297 };
}

export function convertToMm(value: number, unit: UnitType): number {
  switch (unit) {
    case 'cm':
      return value * 10;
    case 'pt':
      return value * 0.352778;
    case 'px':
      return value * 0.264583; // 96 DPI
    case 'mm':
    default:
      return value;
  }
}

export function convertFromMm(valueMm: number, unit: UnitType): number {
  switch (unit) {
    case 'cm':
      return valueMm / 10;
    case 'pt':
      return valueMm / 0.352778;
    case 'px':
      return valueMm / 0.264583;
    case 'mm':
    default:
      return valueMm;
  }
}

export function createStandardElements(pageWidthMm = 210): InvoicePrintElement[] {
  const contentWidth = pageWidthMm - 20; // 10mm margins on each side

  return [
    {
      id: 'shop_name',
      type: 'shop_name',
      visible: true,
      position: { xMm: pageWidthMm - 10 - 100, yMm: 12 },
      size: { widthMm: 100, heightMm: 10 },
      style: {
        fontFamily: 'DoranNoEn',
        fontSizePt: 16,
        fontWeight: 'bold',
        color: '#1e293b',
        textAlign: 'right',
      },
      zIndex: 10,
    },
    {
      id: 'invoice_title',
      type: 'invoice_title',
      visible: true,
      position: { xMm: (pageWidthMm - 60) / 2, yMm: 12 },
      size: { widthMm: 60, heightMm: 10 },
      style: {
        fontFamily: 'DoranNoEn',
        fontSizePt: 15,
        fontWeight: 'bold',
        color: '#b45309',
        textAlign: 'center',
      },
      content: { text: 'فاکتور فروش طلا و جواهر' },
      zIndex: 10,
    },
    {
      id: 'temporary_invoice_badge',
      type: 'temporary_invoice_badge',
      visible: true,
      position: { xMm: 12, yMm: 10 },
      size: { widthMm: 45, heightMm: 8 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 11,
        fontWeight: 'bold',
        color: '#dc2626',
        backgroundColor: '#fef2f2',
        borderColor: '#fca5a5',
        borderWidthMm: 0.5,
        borderRadiusMm: 2,
        textAlign: 'center',
      },
      content: { text: 'فاکتور موقت' },
      zIndex: 12,
    },
    {
      id: 'shop_address',
      type: 'shop_address',
      visible: true,
      position: { xMm: pageWidthMm - 10 - 120, yMm: 23 },
      size: { widthMm: 120, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'right',
      },
      zIndex: 10,
    },
    {
      id: 'shop_phone',
      type: 'shop_phone',
      visible: true,
      position: { xMm: pageWidthMm - 10 - 120, yMm: 29 },
      size: { widthMm: 120, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'right',
      },
      zIndex: 10,
    },
    {
      id: 'invoice_number',
      type: 'invoice_number',
      visible: true,
      position: { xMm: 12, yMm: 20 },
      size: { widthMm: 50, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9.5,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'left',
      },
      zIndex: 10,
    },
    {
      id: 'invoice_date',
      type: 'invoice_date',
      visible: true,
      position: { xMm: 12, yMm: 27 },
      size: { widthMm: 50, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9,
        fontWeight: 'medium',
        color: '#334155',
        textAlign: 'left',
      },
      zIndex: 10,
    },
    {
      id: 'customer_name',
      type: 'customer_name',
      visible: true,
      position: { xMm: 10, yMm: 37 },
      size: { widthMm: contentWidth, heightMm: 9 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 10,
        fontWeight: 'bold',
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        borderColor: '#cbd5e1',
        borderWidthMm: 0.3,
        borderRadiusMm: 1.5,
        textAlign: 'right',
      },
      zIndex: 10,
    },
    {
      id: 'items_table',
      type: 'items_table',
      visible: true,
      position: { xMm: 10, yMm: 48 },
      size: { widthMm: contentWidth, heightMm: 120 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9,
        fontWeight: 'normal',
        color: '#0f172a',
        borderColor: '#94a3b8',
        borderWidthMm: 0.4,
      },
      content: {
        tableColumns: [
          'index',
          'operation_type',
          'metal_type',
          'weight',
          'purity',
          'converted_weight',
          'lab_name',
          'stamp_number',
          'description',
        ],
      },
      zIndex: 10,
    },
    {
      id: 'totals_summary',
      type: 'totals_summary',
      visible: true,
      position: { xMm: 10, yMm: 172 },
      size: { widthMm: contentWidth, heightMm: 22 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9.5,
        fontWeight: 'bold',
        color: '#0f172a',
        backgroundColor: '#f1f5f9',
        borderColor: '#cbd5e1',
        borderWidthMm: 0.4,
        borderRadiusMm: 2,
      },
      zIndex: 10,
    },
    {
      id: 'footer_text',
      type: 'footer_text',
      visible: true,
      position: { xMm: 10, yMm: 198 },
      size: { widthMm: contentWidth, heightMm: 12 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8.5,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'center',
      },
      zIndex: 10,
    },
    {
      id: 'seller_signature',
      type: 'seller_signature',
      visible: true,
      position: { xMm: 15, yMm: 215 },
      size: { widthMm: 70, heightMm: 20 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9,
        fontWeight: 'bold',
        color: '#334155',
        textAlign: 'center',
      },
      content: { text: 'امضای خریدار / مشتری' },
      zIndex: 10,
    },
    {
      id: 'stamp',
      type: 'stamp',
      visible: true,
      position: { xMm: pageWidthMm - 15 - 70, yMm: 215 },
      size: { widthMm: 70, heightMm: 20 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 9,
        fontWeight: 'bold',
        color: '#334155',
        textAlign: 'center',
      },
      content: { text: 'مهر و امضای فروشگاه' },
      zIndex: 10,
    },
    {
      id: 'print_datetime',
      type: 'print_datetime',
      visible: true,
      position: { xMm: 10, yMm: 240 },
      size: { widthMm: contentWidth, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 7.5,
        fontWeight: 'normal',
        color: '#64748b',
        textAlign: 'left',
      },
      zIndex: 10,
    },
  ];
}

export const DEFAULT_SYSTEM_TEMPLATES: InvoicePrintTemplate[] = [
  {
    id: 'tpl_standard_gold',
    name: 'فاکتور استاندارد طلافروشی',
    isActive: true,
    isSystemDefault: true,
    page: {
      size: 'A4',
      orientation: 'portrait',
      widthMm: 210,
      heightMm: 297,
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      backgroundColor: '#ffffff',
      borderEnabled: true,
      borderColor: '#e2e8f0',
      borderWidthMm: 0.5,
    },
    design: {
      zoom: 1,
      gridEnabled: true,
      gridSizeMm: 5,
    },
    elements: createStandardElements(210),
  },
  {
    id: 'tpl_small_sale',
    name: 'فاکتور کوچک فروش',
    isActive: false,
    isSystemDefault: true,
    page: {
      size: 'A5',
      orientation: 'landscape',
      widthMm: 210,
      heightMm: 148,
      marginTopMm: 8,
      marginRightMm: 8,
      marginBottomMm: 8,
      marginLeftMm: 8,
      backgroundColor: '#ffffff',
      borderEnabled: true,
      borderColor: '#cbd5e1',
      borderWidthMm: 0.5,
    },
    design: {
      zoom: 1,
      gridEnabled: true,
      gridSizeMm: 5,
    },
    elements: createStandardElements(210).map((el) => {
      if (el.type === 'items_table') {
        return { ...el, position: { ...el.position, yMm: 42 }, size: { ...el.size, heightMm: 55 } };
      }
      if (el.type === 'totals_summary') {
        return { ...el, position: { ...el.position, yMm: 100 }, size: { ...el.size, heightMm: 18 } };
      }
      if (el.type === 'seller_signature' || el.type === 'stamp') {
        return { ...el, position: { ...el.position, yMm: 120 }, size: { ...el.size, heightMm: 15 } };
      }
      if (el.type === 'footer_text') {
        return { ...el, visible: false };
      }
      return el;
    }),
  },
  {
    id: 'tpl_molten_gold',
    name: 'فاکتور طلای آب‌شده',
    isActive: false,
    isSystemDefault: true,
    page: {
      size: 'A4',
      orientation: 'portrait',
      widthMm: 210,
      heightMm: 297,
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      backgroundColor: '#ffffff',
      borderEnabled: true,
      borderColor: '#d97706',
      borderWidthMm: 0.8,
    },
    design: {
      zoom: 1,
      gridEnabled: true,
      gridSizeMm: 5,
    },
    elements: createStandardElements(210).map((el) => {
      if (el.type === 'invoice_title') {
        return { ...el, content: { text: 'فاکتور رسید و تحویل طلای آب‌شده' } };
      }
      if (el.type === 'items_table') {
        return {
          ...el,
          content: {
            tableColumns: [
              'index',
              'operation_type',
              'weight',
              'purity',
              'converted_weight',
              'lab_name',
              'stamp_number',
              'description',
            ],
          },
        };
      }
      return el;
    }),
  },
  {
    id: 'tpl_customer_receipt',
    name: 'فاکتور رسید مشتری',
    isActive: false,
    isSystemDefault: true,
    page: {
      size: 'receipt-80',
      orientation: 'portrait',
      widthMm: 80,
      heightMm: 200,
      marginTopMm: 4,
      marginRightMm: 4,
      marginBottomMm: 4,
      marginLeftMm: 4,
      backgroundColor: '#ffffff',
      borderEnabled: false,
      borderColor: '#000000',
      borderWidthMm: 0,
    },
    design: {
      zoom: 1,
      gridEnabled: true,
      gridSizeMm: 2,
    },
    elements: [
      {
        id: 'shop_name',
        type: 'shop_name',
        visible: true,
        position: { xMm: 4, yMm: 5 },
        size: { widthMm: 72, heightMm: 8 },
        style: { fontFamily: 'DoranNoEn', fontSizePt: 12, fontWeight: 'bold', textAlign: 'center', color: '#0f172a' },
        zIndex: 10,
      },
      {
        id: 'invoice_title',
        type: 'invoice_title',
        visible: true,
        position: { xMm: 4, yMm: 14 },
        size: { widthMm: 72, heightMm: 6 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 10, fontWeight: 'bold', textAlign: 'center', color: '#b45309' },
        content: { text: 'رسید تراکنش' },
        zIndex: 10,
      },
      {
        id: 'invoice_number',
        type: 'invoice_number',
        visible: true,
        position: { xMm: 4, yMm: 22 },
        size: { widthMm: 72, heightMm: 5 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 8, fontWeight: 'bold', textAlign: 'right', color: '#1e293b' },
        zIndex: 10,
      },
      {
        id: 'invoice_date',
        type: 'invoice_date',
        visible: true,
        position: { xMm: 4, yMm: 28 },
        size: { widthMm: 72, heightMm: 5 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 8, fontWeight: 'normal', textAlign: 'right', color: '#334155' },
        zIndex: 10,
      },
      {
        id: 'customer_name',
        type: 'customer_name',
        visible: true,
        position: { xMm: 4, yMm: 34 },
        size: { widthMm: 72, heightMm: 6 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 8.5, fontWeight: 'bold', textAlign: 'right', color: '#0f172a' },
        zIndex: 10,
      },
      {
        id: 'items_table',
        type: 'items_table',
        visible: true,
        position: { xMm: 4, yMm: 42 },
        size: { widthMm: 72, heightMm: 100 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 7.5, fontWeight: 'normal', color: '#0f172a' },
        content: {
          tableColumns: ['index', 'metal_type', 'weight', 'purity', 'converted_weight'],
        },
        zIndex: 10,
      },
      {
        id: 'totals_summary',
        type: 'totals_summary',
        visible: true,
        position: { xMm: 4, yMm: 145 },
        size: { widthMm: 72, heightMm: 20 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 8, fontWeight: 'bold', color: '#0f172a', backgroundColor: '#f8fafc' },
        zIndex: 10,
      },
      {
        id: 'footer_text',
        type: 'footer_text',
        visible: true,
        position: { xMm: 4, yMm: 168 },
        size: { widthMm: 72, heightMm: 12 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 7, fontWeight: 'normal', textAlign: 'center', color: '#64748b' },
        zIndex: 10,
      },
      {
        id: 'print_datetime',
        type: 'print_datetime',
        visible: true,
        position: { xMm: 4, yMm: 182 },
        size: { widthMm: 72, heightMm: 5 },
        style: { fontFamily: 'Vazirmatn', fontSizePt: 6.5, fontWeight: 'normal', textAlign: 'center', color: '#94a3b8' },
        zIndex: 10,
      },
    ],
  },
];
