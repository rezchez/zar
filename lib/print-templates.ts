export type PageSizeOption = 'A4' | 'A5' | 'A6' | 'receipt-80' | 'receipt-58' | 'custom';
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
  paddingMm?: number;
  lineHeight?: number;
}

export interface InvoiceTableColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  widthMm?: number;
  textAlign?: 'right' | 'center' | 'left';
}

export interface InvoiceTableConfiguration {
  columns: InvoiceTableColumnConfig[];
  headerBackgroundColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
  borderColor?: string;
  borderWidthMm?: number;
  showIndexColumn?: boolean;
  fontSizePt?: number;
  rowHeightMm?: number;
}

export interface InvoiceFooterConfiguration {
  footerText?: string;
  showSellerSignature?: boolean;
  showCustomerSignature?: boolean;
  showStamp?: boolean;
  sellerSignatureTitle?: string;
  customerSignatureTitle?: string;
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
  table?: InvoiceTableConfiguration;
  footer?: InvoiceFooterConfiguration;
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

export const DEFAULT_TABLE_COLUMNS: InvoiceTableColumnConfig[] = [
  { id: 'index', label: 'ردیف', visible: true, widthMm: 12, textAlign: 'center' },
  { id: 'operation_type', label: 'نوع عملیات', visible: true, widthMm: 22, textAlign: 'center' },
  { id: 'metal_type', label: 'جنس فلز', visible: true, widthMm: 18, textAlign: 'center' },
  { id: 'weight', label: 'وزن (گرم)', visible: true, widthMm: 22, textAlign: 'center' },
  { id: 'purity', label: 'عیار', visible: true, widthMm: 16, textAlign: 'center' },
  { id: 'converted_weight', label: 'وزن معادل ۷۵۰', visible: true, widthMm: 25, textAlign: 'center' },
  { id: 'lab_name', label: 'نام آزمایشگاه / ری‌گیری', visible: true, widthMm: 25, textAlign: 'center' },
  { id: 'stamp_number', label: 'شماره پاکت / انگ', visible: true, widthMm: 22, textAlign: 'center' },
  { id: 'description', label: 'توضیحات', visible: true, widthMm: 28, textAlign: 'right' },
];

export const AVAILABLE_TABLE_COLUMNS: { id: string; label: string }[] = DEFAULT_TABLE_COLUMNS.map((c) => ({
  id: c.id,
  label: c.label,
}));

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
  A6: {
    portrait: { widthMm: 105, heightMm: 148 },
    landscape: { widthMm: 148, heightMm: 105 },
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
  const contentWidth = pageWidthMm - 20;

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
    table: {
      columns: JSON.parse(JSON.stringify(DEFAULT_TABLE_COLUMNS)),
      headerBackgroundColor: '#f1f5f9',
      headerTextColor: '#0f172a',
      bodyTextColor: '#1e293b',
      borderColor: '#cbd5e1',
      borderWidthMm: 0.4,
      showIndexColumn: true,
      fontSizePt: 9,
    },
    footer: {
      showSellerSignature: true,
      showCustomerSignature: true,
      showStamp: true,
      sellerSignatureTitle: 'امضای فروشنده',
      customerSignatureTitle: 'امضای خریدار / تحویل‌گیرنده',
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
    table: {
      columns: JSON.parse(JSON.stringify(DEFAULT_TABLE_COLUMNS)),
      headerBackgroundColor: '#f8fafc',
      headerTextColor: '#0f172a',
      bodyTextColor: '#1e293b',
      borderColor: '#e2e8f0',
      borderWidthMm: 0.3,
      showIndexColumn: true,
      fontSizePt: 8,
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
];
