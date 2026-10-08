export type PageSizeOption = 'A4' | 'A5' | 'A6' | 'receipt-80' | 'receipt-58' | 'custom';
export type PageOrientation = 'portrait' | 'landscape';
export type UnitType = 'mm' | 'cm' | 'px' | 'pt';

export type ElementType =
  | 'shop_logo'
  | 'shop_name'
  | 'shop_slogan'
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
  | 'print_datetime'
  | 'custom_text'
  | 'shape_rectangle'
  | 'shape_circle'
  | 'shape_line_h'
  | 'shape_line_v'
  | 'shape_badge';

export interface InvoicePrintElementStyle {
  fontFamily?: string;
  fontSizePt?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | number;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'right' | 'center' | 'left' | 'justify';
  borderColor?: string;
  borderWidthMm?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  borderRadiusMm?: number;
  paddingMm?: number;
  lineHeight?: number;
  opacity?: number;
}

export interface InvoiceTableColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  widthMm?: number;
  textAlign?: 'right' | 'center' | 'left';
}

export type InvoiceTableColumn = InvoiceTableColumnConfig;

export interface InvoiceTableConfiguration {
  columns: InvoiceTableColumnConfig[];
  workmanshipDisplayMode?: 'name_only' | 'both' | 'operation_only';
  headerBackgroundColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
  borderColor?: string;
  borderWidthMm?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
  borderRadiusMm?: number;
  showIndexColumn?: boolean;
  fontSizePt?: number;
  rowHeightMm?: number;
  alternateRowColor?: string;
  stripedRows?: boolean;
  showVerticalBorders?: boolean;
  showHorizontalBorders?: boolean;
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
  shapeType?: 'rectangle' | 'circle' | 'line_h' | 'line_v' | 'badge';
  badgeIcon?: string;
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
  table?: InvoiceTableConfiguration;
  footer?: InvoiceFooterConfiguration;
}

export interface InvoicePrintTemplate {
  id: string;
  name: string;
  templateType?: 'invoice' | 'customer';
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
  shop_slogan: 'شعار فروشگاه',
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
  custom_text: 'متن دلخواه',
  shape_rectangle: 'کادر مستطیل',
  shape_circle: 'دایره / بیضی',
  shape_line_h: 'خط جداکننده افقی',
  shape_line_v: 'خط جداکننده عمودی',
  shape_badge: 'نشان / برچسب',
};

export const DEFAULT_TABLE_COLUMNS: InvoiceTableColumnConfig[] = [
  { id: 'index', label: 'ردیف', visible: true, widthMm: 10, textAlign: 'center' },
  { id: 'operation_type', label: 'نوع عملیات / شرح کالا', visible: true, widthMm: 24, textAlign: 'center' },
  { id: 'metal_type', label: 'جنس فلز', visible: true, widthMm: 16, textAlign: 'center' },
  { id: 'weight', label: 'وزن (گرم)', visible: true, widthMm: 18, textAlign: 'center' },
  { id: 'purity', label: 'عیار', visible: true, widthMm: 14, textAlign: 'center' },
  { id: 'converted_weight', label: 'وزن معادل ۷۵۰', visible: true, widthMm: 22, textAlign: 'center' },
  { id: 'price_per_gram', label: 'قیمت هر گرم طلا', visible: true, widthMm: 24, textAlign: 'center' },
  { id: 'subtotal_price', label: 'قیمت کل قبل از تخفیف', visible: true, widthMm: 26, textAlign: 'center' },
  { id: 'discount_amount', label: 'تخفیف', visible: true, widthMm: 18, textAlign: 'center' },
  { id: 'total_price', label: 'مبلغ کل', visible: true, widthMm: 26, textAlign: 'center' },
  { id: 'lab_name', label: 'نام آزمایشگاه / ری‌گیری', visible: false, widthMm: 24, textAlign: 'center' },
  { id: 'stamp_number', label: 'شماره پاکت / انگ', visible: false, widthMm: 20, textAlign: 'center' },
  { id: 'description', label: 'توضیحات', visible: false, widthMm: 26, textAlign: 'right' },
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

export function getFontWeightCss(weight?: string | number): number {
  if (!weight) return 400;
  if (typeof weight === 'number') return weight;
  const lower = String(weight).toLowerCase().trim();
  switch (lower) {
    case 'thin':
    case '100':
      return 100;
    case 'light':
    case '300':
      return 300;
    case 'normal':
    case 'regular':
    case '400':
      return 400;
    case 'medium':
    case '500':
      return 500;
    case 'semibold':
    case 'semi-bold':
    case '600':
      return 600;
    case 'bold':
    case '700':
      return 700;
    case 'extrabold':
    case 'extra-bold':
    case '800':
      return 800;
    case 'black':
    case '900':
      return 900;
    default: {
      const n = parseInt(lower, 10);
      return !isNaN(n) ? n : 400;
    }
  }
}

export function createCustomTextElement(
  xMm = 20,
  yMm = 50,
  text = 'متن دلخواه جدید',
): InvoicePrintElement {
  return {
    id: `custom_text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'custom_text',
    label: 'متن دلخواه',
    visible: true,
    position: { xMm, yMm },
    size: { widthMm: 80, heightMm: 12 },
    style: {
      fontFamily: 'Vazirmatn',
      fontSizePt: 9.5,
      fontWeight: 'normal',
      color: '#0f172a',
      backgroundColor: 'transparent',
      textAlign: 'right',
      borderColor: '#cbd5e1',
      borderWidthMm: 0,
      borderStyle: 'solid',
      borderRadiusMm: 0,
      paddingMm: 1,
      lineHeight: 1.4,
      opacity: 1,
    },
    content: { text },
    zIndex: 15,
  };
}

export function createShapeElement(
  shapeType: 'rectangle' | 'circle' | 'line_h' | 'line_v' | 'badge',
  xMm = 20,
  yMm = 50,
  pageWidthMm = 210,
): InvoicePrintElement {
  const rand = Math.random().toString(36).slice(2, 6);
  switch (shapeType) {
    case 'rectangle':
      return {
        id: `shape_rect_${Date.now()}_${rand}`,
        type: 'shape_rectangle',
        label: 'کادر مستطیل',
        visible: true,
        position: { xMm, yMm },
        size: { widthMm: 60, heightMm: 30 },
        style: {
          backgroundColor: '#f8fafc',
          borderColor: '#cbd5e1',
          borderWidthMm: 0.5,
          borderStyle: 'solid',
          borderRadiusMm: 2,
          opacity: 1,
        },
        zIndex: 5,
      };
    case 'circle':
      return {
        id: `shape_circle_${Date.now()}_${rand}`,
        type: 'shape_circle',
        label: 'دایره / بیضی',
        visible: true,
        position: { xMm, yMm },
        size: { widthMm: 25, heightMm: 25 },
        style: {
          backgroundColor: '#f1f5f9',
          borderColor: '#94a3b8',
          borderWidthMm: 0.5,
          borderStyle: 'solid',
          borderRadiusMm: 50,
          opacity: 1,
        },
        zIndex: 5,
      };
    case 'line_h':
      return {
        id: `shape_line_h_${Date.now()}_${rand}`,
        type: 'shape_line_h',
        label: 'خط جداکننده افقی',
        visible: true,
        position: { xMm: 10, yMm },
        size: { widthMm: pageWidthMm - 20, heightMm: 2 },
        style: {
          borderColor: '#cbd5e1',
          borderWidthMm: 0.5,
          borderStyle: 'solid',
          backgroundColor: 'transparent',
          color: '#cbd5e1',
          opacity: 1,
        },
        zIndex: 5,
      };
    case 'line_v':
      return {
        id: `shape_line_v_${Date.now()}_${rand}`,
        type: 'shape_line_v',
        label: 'خط جداکننده عمودی',
        visible: true,
        position: { xMm, yMm },
        size: { widthMm: 2, heightMm: 40 },
        style: {
          borderColor: '#cbd5e1',
          borderWidthMm: 0.5,
          borderStyle: 'solid',
          backgroundColor: 'transparent',
          color: '#cbd5e1',
          opacity: 1,
        },
        zIndex: 5,
      };
    case 'badge':
      return {
        id: `shape_badge_${Date.now()}_${rand}`,
        type: 'shape_badge',
        label: 'نشان / برچسب',
        visible: true,
        position: { xMm, yMm },
        size: { widthMm: 35, heightMm: 8 },
        style: {
          fontFamily: 'Vazirmatn',
          fontSizePt: 8.5,
          fontWeight: 'bold',
          color: '#b45309',
          backgroundColor: '#fef3c7',
          borderColor: '#fde68a',
          borderWidthMm: 0.4,
          borderStyle: 'solid',
          borderRadiusMm: 4,
          textAlign: 'center',
          opacity: 1,
        },
        content: { text: 'ضمانت اصالت عیار' },
        zIndex: 12,
      };
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
      id: 'shop_slogan',
      type: 'shop_slogan',
      visible: true,
      position: { xMm: pageWidthMm - 10 - 100, yMm: 20 },
      size: { widthMm: 100, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8.5,
        fontWeight: 'medium',
        color: '#b45309',
        textAlign: 'right',
      },
      content: { text: 'کیفیت و اصالت در ساخت طلا و جواهرات' },
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

export const CUSTOMER_DEFAULT_TABLE_COLUMNS: InvoiceTableColumnConfig[] = [
  { id: 'index', label: 'ردیف', visible: true, widthMm: 12, textAlign: 'center' },
  { id: 'customerCode', label: 'کد حساب', visible: true, widthMm: 20, textAlign: 'center' },
  { id: 'name', label: 'نام طرف‌حساب', visible: true, widthMm: 36, textAlign: 'right' },
  { id: 'groupName', label: 'گروه', visible: true, widthMm: 22, textAlign: 'center' },
  { id: 'phone1', label: 'تلفن تماس', visible: true, widthMm: 24, textAlign: 'center' },
  { id: 'city', label: 'شهر', visible: true, widthMm: 20, textAlign: 'center' },
  { id: 'goldBalance', label: 'مانده طلا (گرم)', visible: true, widthMm: 26, textAlign: 'center' },
  { id: 'rialBalance', label: 'مانده ریالی', visible: true, widthMm: 30, textAlign: 'center' },
];

export function createCustomerStandardElements(pageWidthMm = 210): InvoicePrintElement[] {
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
      position: { xMm: (pageWidthMm - 70) / 2, yMm: 12 },
      size: { widthMm: 70, heightMm: 10 },
      style: {
        fontFamily: 'DoranNoEn',
        fontSizePt: 15,
        fontWeight: 'bold',
        color: '#b45309',
        textAlign: 'center',
      },
      content: { text: 'گزارش و صورت وضعیت طرف‌حساب‌ها' },
      zIndex: 10,
    },
    {
      id: 'shop_phone',
      type: 'shop_phone',
      visible: true,
      position: { xMm: 12, yMm: 12 },
      size: { widthMm: 60, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8.5,
        fontWeight: 'normal',
        color: '#475569',
        textAlign: 'left',
      },
      zIndex: 10,
    },
    {
      id: 'invoice_date',
      type: 'invoice_date',
      visible: true,
      position: { xMm: 12, yMm: 20 },
      size: { widthMm: 60, heightMm: 6 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8.5,
        fontWeight: 'medium',
        color: '#334155',
        textAlign: 'left',
      },
      zIndex: 10,
    },
    {
      id: 'items_table',
      type: 'items_table',
      label: 'جدول فهرست طرف‌حساب‌ها',
      visible: true,
      position: { xMm: 10, yMm: 32 },
      size: { widthMm: contentWidth, heightMm: 215 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8.5,
        fontWeight: 'normal',
        color: '#0f172a',
        borderColor: '#cbd5e1',
        borderWidthMm: 0.4,
      },
      zIndex: 10,
    },
    {
      id: 'footer_text',
      type: 'footer_text',
      visible: true,
      position: { xMm: 10, yMm: 252 },
      size: { widthMm: contentWidth, heightMm: 8 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8,
        fontWeight: 'normal',
        color: '#64748b',
        textAlign: 'center',
      },
      content: { text: 'گزارش تولید شده از سامانه حسابداری طلا و جواهر زر فولیو' },
      zIndex: 10,
    },
    {
      id: 'seller_signature',
      type: 'seller_signature',
      visible: true,
      position: { xMm: pageWidthMm - 15 - 60, yMm: 262 },
      size: { widthMm: 60, heightMm: 18 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8.5,
        fontWeight: 'bold',
        color: '#334155',
        textAlign: 'center',
      },
      content: { text: 'تایید و امضای مدیریت' },
      zIndex: 10,
    },
    {
      id: 'stamp',
      type: 'stamp',
      visible: true,
      position: { xMm: 15, yMm: 262 },
      size: { widthMm: 50, heightMm: 18 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 8.5,
        fontWeight: 'bold',
        color: '#334155',
        textAlign: 'center',
      },
      content: { text: 'مهر فروشگاه' },
      zIndex: 10,
    },
    {
      id: 'print_datetime',
      type: 'print_datetime',
      visible: true,
      position: { xMm: 10, yMm: 284 },
      size: { widthMm: contentWidth, heightMm: 5 },
      style: {
        fontFamily: 'Vazirmatn',
        fontSizePt: 7,
        fontWeight: 'normal',
        color: '#94a3b8',
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
    templateType: 'invoice',
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
    templateType: 'invoice',
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
  {
    id: 'tpl_customer_default',
    name: 'قالب پیش‌فرض چاپ طرف‌حساب‌ها',
    templateType: 'customer',
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
      columns: JSON.parse(JSON.stringify(CUSTOMER_DEFAULT_TABLE_COLUMNS)),
      headerBackgroundColor: '#f1f5f9',
      headerTextColor: '#0f172a',
      bodyTextColor: '#1e293b',
      borderColor: '#cbd5e1',
      borderWidthMm: 0.4,
      showIndexColumn: true,
      fontSizePt: 8.5,
    },
    footer: {
      showSellerSignature: true,
      showCustomerSignature: false,
      showStamp: true,
      sellerSignatureTitle: 'تایید و امضای مدیریت',
    },
    elements: createCustomerStandardElements(210),
  },
];
