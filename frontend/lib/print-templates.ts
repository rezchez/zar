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
  | 'shape_badge'
  | 'custom_table'
  | 'db_field';

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

export type QrContentType = 'invoice_number' | 'url' | 'custom_text';

export interface CustomTableRowField {
  id: string;
  key: string;
  label: string;
  customValue?: string;
  unit?: string;
  visible: boolean;
  qrContentType?: QrContentType;
}

export type InvoiceCustomTableField = CustomTableRowField;

export interface CustomTableConfiguration {
  title?: string;
  showTitle?: boolean;
  showHeader?: boolean;
  headerLabelText?: string;
  headerValueText?: string;
  layout?: 'rows' | 'grid2' | 'columns';
  fields: CustomTableRowField[];
  headerBackgroundColor?: string;
  headerTextColor?: string;
  bodyTextColor?: string;
  borderColor?: string;
  borderWidthMm?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderRadiusMm?: number;
  showVerticalBorders?: boolean;
  showHorizontalBorders?: boolean;
  stripedRows?: boolean;
  alternateRowColor?: string;
  fontSizePt?: number;
}

export interface InvoicePrintElementContent {
  text?: string;
  tableColumns?: string[];
  shapeType?: 'rectangle' | 'circle' | 'line_h' | 'line_v' | 'badge';
  badgeIcon?: string;
  customTable?: CustomTableConfiguration;
  fieldKey?: string;
  fieldLabel?: string;
  showFieldLabel?: boolean;
  fieldUnit?: string;
  showFieldUnit?: boolean;
  qrContentType?: QrContentType;
}

export interface InvoicePrintElement {
  id: string;
  type: ElementType;
  label?: string;
  visible: boolean;
  locked?: boolean;
  groupId?: string;
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
  showRulers?: boolean;
  snapToGrid?: boolean;
  snapToGuides?: boolean;
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
  custom_table: 'جدول محاسبات و مانده‌ها',
  db_field: 'فیلد داده از دیتابیس',
};

export const DEFAULT_TABLE_COLUMNS: InvoiceTableColumnConfig[] = [
  { id: 'index', label: 'ردیف', visible: true, widthMm: 10, textAlign: 'center' },
  { id: 'operation_type', label: 'نوع عملیات / شرح کالا', visible: true, widthMm: 24, textAlign: 'center' },
  { id: 'metal_type', label: 'جنس فلز', visible: true, widthMm: 16, textAlign: 'center' },
  { id: 'weight', label: 'وزن (گرم)', visible: true, widthMm: 18, textAlign: 'center' },
  { id: 'purity', label: 'عیار', visible: true, widthMm: 14, textAlign: 'center' },
  { id: 'converted_weight', label: 'وزن معادل ۷۵۰', visible: true, widthMm: 22, textAlign: 'center' },
  { id: 'price_per_gram', label: 'قیمت هر گرم طلا', visible: true, widthMm: 24, textAlign: 'center' },
  { id: 'subtotal_price', label: 'قیمت کل قبل از تخفیف', visible: true, widthMm: 24, textAlign: 'center' },
  { id: 'discount_amount', label: 'تخفیف', visible: true, widthMm: 16, textAlign: 'center' },
  { id: 'total_price', label: 'مبلغ کل', visible: true, widthMm: 22, textAlign: 'center' },
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

export interface AvailableDataField {
  key: string;
  category: 'customer_balance' | 'document_summary' | 'financial' | 'weights';
  categoryLabel: string;
  label: string;
  defaultUnit: string;
  sampleValue: string;
  description: string;
}

export const AVAILABLE_DATABASE_FIELDS: AvailableDataField[] = [
  // مانده حساب مشتری
  {
    key: 'prev_balance_gold',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'مانده قبلی طلا (گرم)',
    defaultUnit: 'گرم',
    sampleValue: '۱۲٫۴۵۰',
    description: 'مانده طلای مشتری قبل از ثبت این سند',
  },
  {
    key: 'prev_balance_cash',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'مانده قبلی ریالی / نقدی',
    defaultUnit: 'تومان',
    sampleValue: '۴۵٬۲۰۰٬۰۰۰',
    description: 'مانده پولی مشتری قبل از ثبت این سند',
  },
  {
    key: 'final_balance_gold',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'مانده نهایی طلا پس از این سند',
    defaultUnit: 'گرم',
    sampleValue: '۱۳٫۲۶۰',
    description: 'مانده طلای نهایی مشتری پس از اعمال این سند',
  },
  {
    key: 'final_balance_cash',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'مانده نهایی ریالی پس از این سند',
    defaultUnit: 'تومان',
    sampleValue: '۶۸٬۵۵۰٬۰۰۰',
    description: 'مانده پولی نهایی مشتری پس از اعمال این سند',
  },
  {
    key: 'customer_status',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'وضعیت مانده حساب مشتری',
    defaultUnit: '',
    sampleValue: 'بدهکار (به ما)',
    description: 'وضعیت بدهکار / بستانکار / بی‌حساب مشتری',
  },
  {
    key: 'prev_balance_silver',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'مانده قبلی نقره (گرم)',
    defaultUnit: 'گرم',
    sampleValue: '۵۰٫۰۰۰',
    description: 'مانده نقره مشتری قبل از این سند',
  },
  {
    key: 'final_balance_silver',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'مانده نهایی نقره پس از این سند',
    defaultUnit: 'گرم',
    sampleValue: '۵۰٫۰۰۰',
    description: 'مانده نقره نهایی مشتری پس از اعمال سند',
  },

  // خلاصه و اثر این سند
  {
    key: 'doc_net_gold',
    category: 'document_summary',
    categoryLabel: 'خلاصه و اثر این سند',
    label: 'مانده وزنی این سند (طلا)',
    defaultUnit: 'گرم',
    sampleValue: '+۰٫۸۱۰',
    description: 'خالص اثر وزنی ردیف‌های این سند بر حساب مشتری',
  },
  {
    key: 'doc_net_cash',
    category: 'document_summary',
    categoryLabel: 'خلاصه و اثر این سند',
    label: 'مانده ریالی این سند',
    defaultUnit: 'تومان',
    sampleValue: '۲۳٬۳۵۰٬۰۰۰',
    description: 'خالص اثر پولی این سند بر حساب مشتری',
  },
  {
    key: 'doc_settlement_status',
    category: 'document_summary',
    categoryLabel: 'خلاصه و اثر این سند',
    label: 'وضعیت تسویه این سند',
    defaultUnit: '',
    sampleValue: 'تسویه نقد و وزنی',
    description: 'نحوه تسویه ردیف‌های فاکتور',
  },
  {
    key: 'doc_rows_count',
    category: 'document_summary',
    categoryLabel: 'خلاصه و اثر این سند',
    label: 'تعداد ردیف‌های فاکتور',
    defaultUnit: 'ردیف',
    sampleValue: '۲',
    description: 'تعداد کل اقلام ثبت‌شده در این فاکتور',
  },

  // ارقام مالی فاکتور
  {
    key: 'doc_subtotal_price',
    category: 'financial',
    categoryLabel: 'ارقام مالی فاکتور',
    label: 'مبلغ کل قبل از تخفیف',
    defaultUnit: 'تومان',
    sampleValue: '۲۳٬۳۶۸٬۲۴۱',
    description: 'جمع مبالغ ناخالص اقلام قبل از کسر تخفیف',
  },
  {
    key: 'doc_discount_amount',
    category: 'financial',
    categoryLabel: 'ارقام مالی فاکتور',
    label: 'مجموع تخفیف فاکتور',
    defaultUnit: 'تومان',
    sampleValue: '۱۸٬۲۴۱',
    description: 'مجموع تخفیف‌های در نظر گرفته‌شده در این فاکتور',
  },
  {
    key: 'doc_total_price',
    category: 'financial',
    categoryLabel: 'ارقام مالی فاکتور',
    label: 'مبلغ نهایی قابل پرداخت',
    defaultUnit: 'تومان',
    sampleValue: '۲۳٬۳۵۰٬۰۰۰',
    description: 'مبلغ خالص نهایی فاکتور پس از تخفیف',
  },

  // اوزان فلزات
  {
    key: 'doc_gold_weight_750',
    category: 'weights',
    categoryLabel: 'اوزان و فلزات',
    label: 'جمع طلا معادل ۷۵۰',
    defaultUnit: 'گرم',
    sampleValue: '۰٫۸۱۰',
    description: 'مجموع وزن معادل استاندارد ۷۵۰ طلای فاکتور',
  },
  {
    key: 'doc_raw_gold_weight',
    category: 'weights',
    categoryLabel: 'اوزان و فلزات',
    label: 'جمع وزن ناخالص طلا',
    defaultUnit: 'گرم',
    sampleValue: '۰٫۸۲۰',
    description: 'مجموع وزن ترازو / ناخالص طلای اقلام فاکتور',
  },
  {
    key: 'doc_silver_weight',
    category: 'weights',
    categoryLabel: 'اوزان و فلزات',
    label: 'جمع وزن نقره',
    defaultUnit: 'گرم',
    sampleValue: '۰٫۰۰۰',
    description: 'مجموع وزن نقره در فاکتور',
  },
  {
    key: 'doc_platinum_weight',
    category: 'weights',
    categoryLabel: 'اوزان و فلزات',
    label: 'جمع وزن پلاتین',
    defaultUnit: 'گرم',
    sampleValue: '۰٫۰۰۰',
    description: 'مجموع وزن پلاتین در فاکتور',
  },
  {
    key: 'doc_karat',
    category: 'weights',
    categoryLabel: 'اوزان و فلزات',
    label: 'عیار (عیار طلا / فلز)',
    defaultUnit: '',
    sampleValue: '۷۵۰',
    description: 'عیار استاندارد یا عیار طلای اقلام فاکتور (معمولاً ۷۵۰)',
  },
  {
    key: 'doc_converted_by_metal',
    category: 'weights',
    categoryLabel: 'اوزان و فلزات',
    label: 'تبدیل به (با توجه به نوع فلز)',
    defaultUnit: 'گرم',
    sampleValue: '۰٫۸۱۰ (۷۵۰)',
    description: 'وزن تبدیل‌شده استاندارد بر حسب نوع فلز اصلی (طلا معادل ۷۵۰، نقره معادل ۹۹۹، پلاتین معادل ۹۵۰)',
  },
  {
    key: 'custom_qrcode',
    category: 'document_summary',
    categoryLabel: 'خلاصه و اثر این سند',
    label: 'داده دلخواه با کیو آر کد',
    defaultUnit: '',
    sampleValue: 'QR Code',
    description: 'نمایش بارکد دو بعدی (QR Code) از متن دلخواه، شماره سند یا لینک استعلام فاکتور',
  },
  {
    key: 'doc_total_price_words',
    category: 'financial',
    categoryLabel: 'ارقام مالی فاکتور',
    label: 'مبلغ نهایی به حروف',
    defaultUnit: '',
    sampleValue: 'بیست و سه میلیون و سیصد و پنجاه هزار تومان',
    description: 'تبدیل خودکار مبلغ نهایی قابل پرداخت فاکتور به حروف فارسی',
  },
  {
    key: 'doc_type_label',
    category: 'document_summary',
    categoryLabel: 'خلاصه و اثر این سند',
    label: 'نوع سند (خرید / فروش / حواله)',
    defaultUnit: '',
    sampleValue: 'فاکتور فروش',
    description: 'عنوان نوع سند بر اساس ردیف‌های ثبت‌شده در فاکتور',
  },
  {
    key: 'customer_code',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'کد اشتراک طرف‌حساب',
    defaultUnit: '',
    sampleValue: '۱۰۴۲',
    description: 'کد اختصاصی مشتری یا همکار در سیستم',
  },
  {
    key: 'customer_phone',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'شماره تماس طرف‌حساب',
    defaultUnit: '',
    sampleValue: '۰۹۱۲۳۴۵۶۷۸۹',
    description: 'شماره تلفن یا موبایل ثبت‌شده برای طرف‌حساب',
  },
  {
    key: 'customer_national_id',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'کد ملی / شناسه طرف‌حساب',
    defaultUnit: '',
    sampleValue: '۰۰۱۲۳۴۵۶۷۸',
    description: 'کد ملی یا شناسه اقتصادی مشتری (مناسب فاکتور رسمی)',
  },
  {
    key: 'customer_address',
    category: 'customer_balance',
    categoryLabel: 'مانده حساب طرف‌حساب',
    label: 'آدرس طرف‌حساب',
    defaultUnit: '',
    sampleValue: 'تهران، بازار بزرگ، راسته زرگرها',
    description: 'نشانی ثبت‌شده در پرونده طرف‌حساب',
  },
];

export function numberToPersianWords(rawNum: number, currencyLabel = ''): string {
  const num = Math.floor(Math.abs(Number(rawNum) || 0));
  if (num === 0) return currencyLabel ? `صفر ${currencyLabel}` : 'صفر';

  const ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
  const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
  const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
  const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
  const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

  const threeDigitsToWords = (n: number): string => {
    const parts: string[] = [];
    const h = Math.floor(n / 100);
    const rem = n % 100;
    if (h > 0) parts.push(hundreds[h]);
    if (rem >= 10 && rem < 20) {
      parts.push(teens[rem - 10]);
    } else {
      const t = Math.floor(rem / 10);
      const o = rem % 10;
      if (t > 0) parts.push(tens[t]);
      if (o > 0) parts.push(ones[o]);
    }
    return parts.join(' و ');
  };

  const groups: string[] = [];
  let temp = num;
  let scaleIndex = 0;
  while (temp > 0 && scaleIndex < scales.length) {
    const chunk = temp % 1000;
    if (chunk > 0) {
      const words = threeDigitsToWords(chunk);
      groups.unshift(scales[scaleIndex] ? `${words} ${scales[scaleIndex]}` : words);
    }
    temp = Math.floor(temp / 1000);
    scaleIndex++;
  }

  const result = groups.join(' و ');
  return currencyLabel ? `${result} ${currencyLabel}` : result;
}

export function createCustomTableElement(
  xMm = 10,
  yMm = 160,
  widthMm = 190,
  heightMm = 32,
): InvoicePrintElement {
  const rand = Math.random().toString(36).slice(2, 6);
  return {
    id: `custom_table_${Date.now()}_${rand}`,
    type: 'custom_table',
    label: 'جدول محاسبات و مانده‌ها',
    visible: true,
    position: { xMm, yMm },
    size: { widthMm, heightMm },
    style: {
      fontFamily: 'Vazirmatn',
      fontSizePt: 8.5,
      fontWeight: 'normal',
      color: '#0f172a',
      backgroundColor: '#ffffff',
      borderColor: '#cbd5e1',
      borderWidthMm: 0.4,
      borderStyle: 'solid',
      borderRadiusMm: 2,
      opacity: 1,
    },
    content: {
      customTable: {
        title: 'خلاصه حساب و مانده‌ها',
        showTitle: false,
        showHeader: true,
        headerLabelText: 'شرح شاخص',
        headerValueText: 'مقدار / مانده',
        layout: 'rows',
        headerBackgroundColor: '#f1f5f9',
        headerTextColor: '#0f172a',
        bodyTextColor: '#1e293b',
        borderColor: '#cbd5e1',
        borderWidthMm: 0.3,
        borderStyle: 'solid',
        borderRadiusMm: 1.5,
        showVerticalBorders: true,
        showHorizontalBorders: true,
        stripedRows: true,
        alternateRowColor: '#f8fafc',
        fields: [], // کاملاً خام per user request!
      },
    },
    zIndex: 10,
  };
}

export function resolveQrCodeValue(
  qrContentType?: QrContentType | string,
  rawValue?: string,
  context?: {
    documentNumber?: string;
    customerName?: string;
    date?: string;
  },
): string {
  const docNum = context?.documentNumber || 'پیش‌نمایش';
  const custName = context?.customerName || 'مشتری عمومی';
  const docDate = context?.date || '';

  const replacePlaceholders = (val: string) => {
    return val
      .replace(/\{invoice_number\}|\{doc_num\}|\{documentNumber\}|\{شماره_فاکتور\}|\{شماره_سند\}/gi, docNum)
      .replace(/\{customer_name\}|\{نام_مشتری\}/gi, custName)
      .replace(/\{date\}|\{تاریخ\}/gi, docDate);
  };

  if (qrContentType === 'invoice_number') {
    return docNum;
  }

  if (qrContentType === 'url') {
    const raw = rawValue?.trim() || `https://zarfolio.ir/invoice/${docNum}`;
    return replacePlaceholders(raw);
  }

  if (qrContentType === 'custom_text') {
    const raw = rawValue?.trim() || docNum;
    return replacePlaceholders(raw);
  }

  // Fallback: If no type explicitly specified
  if (rawValue && rawValue.trim()) {
    const trimmed = rawValue.trim();
    if (trimmed === 'invoice_number' || trimmed === '{invoice_number}') {
      return docNum;
    }
    return replacePlaceholders(trimmed);
  }

  return docNum;
}

export function createDbFieldElement(
  fieldKey: string,
  xMm = 20,
  yMm = 60,
): InvoicePrintElement {
  const def = AVAILABLE_DATABASE_FIELDS.find((f) => f.key === fieldKey);
  const label = def?.label || 'فیلد داده';
  const defaultUnit = def?.defaultUnit || '';
  const isQr = fieldKey === 'custom_qrcode';
  const rand = Math.random().toString(36).slice(2, 6);

  return {
    id: `db_field_${Date.now()}_${rand}`,
    type: 'db_field',
    label: `داده: ${label}`,
    visible: true,
    position: { xMm, yMm },
    size: isQr ? { widthMm: 22, heightMm: 22 } : { widthMm: 55, heightMm: 9 },
    style: {
      fontFamily: 'Vazirmatn',
      fontSizePt: 9,
      fontWeight: 'bold',
      color: '#0f172a',
      backgroundColor: '#ffffff',
      textAlign: isQr ? 'center' : 'right',
      borderColor: '#cbd5e1',
      borderWidthMm: isQr ? 0.2 : 0.3,
      borderStyle: 'solid',
      borderRadiusMm: 2,
      paddingMm: isQr ? 0.5 : 1.5,
      opacity: 1,
    },
    content: {
      fieldKey,
      fieldLabel: label,
      showFieldLabel: !isQr,
      fieldUnit: defaultUnit,
      showFieldUnit: !isQr,
      qrContentType: isQr ? 'invoice_number' : undefined,
      text: isQr ? '' : undefined,
    },
    zIndex: 15,
  };
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

export type StarterPresetId = 'a4_formal' | 'a5_compact' | 'receipt_80' | 'blank_a4';

export interface StarterPresetMeta {
  id: StarterPresetId;
  title: string;
  subtitle: string;
  sizeLabel: string;
}

export const TEMPLATE_STARTER_PRESETS: StarterPresetMeta[] = [
  {
    id: 'a4_formal',
    title: 'فاکتور رسمی A4 زرگری',
    subtitle: 'چیدمان کامل شامل سربرگ، جدول اقلام، جمع‌بندی مانده‌ها و امضا',
    sizeLabel: '210 × 297 mm',
  },
  {
    id: 'a5_compact',
    title: 'فاکتور مدرن A5',
    subtitle: 'مناسب چاپ نیم‌برگ سریع با المان‌های ضروری',
    sizeLabel: '148 × 210 mm',
  },
  {
    id: 'receipt_80',
    title: 'فیش حرارتی ۸۰ میلی‌متری',
    subtitle: 'مناسب فیش‌پرینت صندوق با چیدمان عمودی متراکم',
    sizeLabel: '80 × 200 mm',
  },
  {
    id: 'blank_a4',
    title: 'بوم خالی A4 (طراحی از صفر)',
    subtitle: 'صفحه تمیز بدون المان برای چیدمان کاملاً سفارشی',
    sizeLabel: '210 × 297 mm',
  },
];

export function buildTemplateFromPreset(
  presetId: StarterPresetId,
  name: string,
): Partial<InvoicePrintTemplate> {
  if (presetId === 'a5_compact') {
    const a5Base = DEFAULT_SYSTEM_TEMPLATES.find((t) => t.id === 'tpl_a5_compact') || DEFAULT_SYSTEM_TEMPLATES[1];
    return {
      name,
      templateType: 'invoice',
      isActive: false,
      isSystemDefault: false,
      page: JSON.parse(JSON.stringify(a5Base.page)),
      design: { zoom: 1, gridEnabled: true, gridSizeMm: 5, showRulers: true, snapToGrid: true, snapToGuides: true },
      table: JSON.parse(JSON.stringify(a5Base.table)),
      footer: JSON.parse(JSON.stringify(a5Base.footer)),
      elements: JSON.parse(JSON.stringify(a5Base.elements)),
    };
  }

  if (presetId === 'receipt_80') {
    const w = 80;
    const elements: InvoicePrintElement[] = [
      {
        id: 'shop_name',
        type: 'shop_name',
        visible: true,
        position: { xMm: 4, yMm: 5 },
        size: { widthMm: 72, heightMm: 7 },
        style: { fontSizePt: 11, fontWeight: 'extrabold', textAlign: 'center', color: '#0f172a' },
        zIndex: 10,
      },
      {
        id: 'shop_phone',
        type: 'shop_phone',
        visible: true,
        position: { xMm: 4, yMm: 12 },
        size: { widthMm: 72, heightMm: 5 },
        style: { fontSizePt: 8, fontWeight: 'normal', textAlign: 'center', color: '#475569' },
        zIndex: 10,
      },
      createShapeElement('line_h', 4, 18, w),
      {
        id: 'invoice_title',
        type: 'invoice_title',
        visible: true,
        position: { xMm: 4, yMm: 20 },
        size: { widthMm: 72, heightMm: 6 },
        style: { fontSizePt: 9.5, fontWeight: 'bold', textAlign: 'center', color: '#0f172a' },
        content: { text: 'رسید / فاکتور فروش' },
        zIndex: 10,
      },
      {
        id: 'invoice_number',
        type: 'invoice_number',
        visible: true,
        position: { xMm: 4, yMm: 27 },
        size: { widthMm: 36, heightMm: 5 },
        style: { fontSizePt: 8, fontWeight: 'bold', textAlign: 'right', color: '#0f172a' },
        zIndex: 10,
      },
      {
        id: 'invoice_date',
        type: 'invoice_date',
        visible: true,
        position: { xMm: 40, yMm: 27 },
        size: { widthMm: 36, heightMm: 5 },
        style: { fontSizePt: 8, fontWeight: 'normal', textAlign: 'left', color: '#0f172a' },
        zIndex: 10,
      },
      {
        id: 'customer_name',
        type: 'customer_name',
        visible: true,
        position: { xMm: 4, yMm: 33 },
        size: { widthMm: 72, heightMm: 7 },
        style: { fontSizePt: 8, fontWeight: 'normal', textAlign: 'right', color: '#0f172a' },
        zIndex: 10,
      },
      {
        id: 'items_table',
        type: 'items_table',
        visible: true,
        position: { xMm: 4, yMm: 42 },
        size: { widthMm: 72, heightMm: 60 },
        style: { fontSizePt: 7.5, color: '#0f172a' },
        zIndex: 10,
      },
      {
        id: 'totals_summary',
        type: 'totals_summary',
        visible: true,
        position: { xMm: 4, yMm: 105 },
        size: { widthMm: 72, heightMm: 22 },
        style: { fontSizePt: 8, fontWeight: 'bold', color: '#0f172a' },
        zIndex: 10,
      },
      createDbFieldElement('custom_qrcode', 29, 132),
      {
        id: 'footer_text',
        type: 'footer_text',
        visible: true,
        position: { xMm: 4, yMm: 158 },
        size: { widthMm: 72, heightMm: 10 },
        style: { fontSizePt: 7.5, fontWeight: 'normal', textAlign: 'center', color: '#475569' },
        content: { text: 'از خرید شما سپاسگزاریم' },
        zIndex: 10,
      },
    ];
    return {
      name,
      templateType: 'invoice',
      isActive: false,
      isSystemDefault: false,
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
        borderColor: '#e2e8f0',
        borderWidthMm: 0.3,
      },
      design: { zoom: 1, gridEnabled: true, gridSizeMm: 2, showRulers: true, snapToGrid: true, snapToGuides: true },
      table: {
        columns: DEFAULT_TABLE_COLUMNS.map((c) => ({
          ...c,
          visible: ['index', 'operation_type', 'weight', 'total_price'].includes(c.id),
        })),
        headerBackgroundColor: '#0f172a',
        headerTextColor: '#ffffff',
        bodyTextColor: '#0f172a',
        borderColor: '#cbd5e1',
        borderWidthMm: 0.3,
        fontSizePt: 7.5,
        showVerticalBorders: true,
        showHorizontalBorders: true,
      },
      elements,
    };
  }

  if (presetId === 'blank_a4') {
    return {
      name,
      templateType: 'invoice',
      isActive: false,
      isSystemDefault: false,
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
      design: { zoom: 1, gridEnabled: true, gridSizeMm: 5, showRulers: true, snapToGrid: true, snapToGuides: true },
      elements: [],
    };
  }

  // Default: a4_formal
  const a4Base = DEFAULT_SYSTEM_TEMPLATES[0];
  return {
    name,
    templateType: 'invoice',
    isActive: false,
    isSystemDefault: false,
    page: JSON.parse(JSON.stringify(a4Base.page)),
    design: { zoom: 1, gridEnabled: true, gridSizeMm: 5, showRulers: true, snapToGrid: true, snapToGuides: true },
    table: JSON.parse(JSON.stringify(a4Base.table)),
    footer: JSON.parse(JSON.stringify(a4Base.footer)),
    elements: createStandardElements(210),
  };
}
