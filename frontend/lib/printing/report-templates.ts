export type ReportType =
  | 'customer'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'financial'
  | 'gold'
  | 'transactions'
  | 'general';

export interface ReportColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  widthPercent: number;
  textAlign: 'right' | 'center' | 'left';
  format?: 'text' | 'number' | 'currency' | 'weight' | 'date';
}

export interface ReportPrintTemplatePage {
  size: 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  backgroundColor: string;
  borderEnabled: boolean;
  borderColor: string;
  borderWidthMm: number;
}

export interface ReportPrintTemplateHeader {
  enabled: boolean;
  showLogo: boolean;
  showStoreName: boolean;
  showTitle: boolean;
  customTitle?: string;
  showSubtitle: boolean;
  customSubtitle?: string;
  showDate: boolean;
  showOrganizationInfo: boolean;
}

export interface ReportPrintTemplateTable {
  columns: ReportColumnConfig[];
  fontSizePt: number;
  headerBgColor: string;
  headerTextColor: string;
  bodyTextColor: string;
  alternateRowBg: boolean;
  borderColor: string;
  borderWidthMm: number;
  showIndexColumn: boolean;
}

export interface ReportPrintTemplateFooter {
  enabled: boolean;
  showPageNumber: boolean;
  showTotalCount: boolean;
  showSignature: boolean;
  signatureTitle?: string;
  showStamp: boolean;
  customFooterText?: string;
}

export interface ReportPrintTemplate {
  id: string;
  name: string;
  reportType: ReportType;
  isActive: boolean;
  isDefault: boolean;
  isSystemDefault?: boolean;
  page: ReportPrintTemplatePage;
  header: ReportPrintTemplateHeader;
  table: ReportPrintTemplateTable;
  footer: ReportPrintTemplateFooter;
  created?: string;
  updated?: string;
}

export interface ReportTypeDefinition {
  type: ReportType;
  label: string;
  description: string;
  availableColumns: Array<{
    id: string;
    label: string;
    defaultVisible: boolean;
    defaultWidth: number;
    align: 'right' | 'center' | 'left';
    format: 'text' | 'number' | 'currency' | 'weight' | 'date';
    sampleValue: string;
  }>;
  sampleRows: Record<string, string | number>[];
}

export const REPORT_TYPE_DEFINITIONS: Record<ReportType, ReportTypeDefinition> = {
  customer: {
    type: 'customer',
    label: 'گزارش طرف‌حساب‌ها',
    description: 'لیست، اطلاعات تماس و مانده حساب‌های طرف‌حساب‌ها',
    availableColumns: [
      { id: 'customerCode', label: 'کد حساب', defaultVisible: true, defaultWidth: 10, align: 'center', format: 'text', sampleValue: '۱۰۱' },
      { id: 'name', label: 'نام طرف‌حساب', defaultVisible: true, defaultWidth: 24, align: 'right', format: 'text', sampleValue: 'طلا و جواهر زرتشت' },
      { id: 'groupName', label: 'گروه', defaultVisible: true, defaultWidth: 12, align: 'center', format: 'text', sampleValue: 'همکاران بازار' },
      { id: 'phone1', label: 'تلفن تماس', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'text', sampleValue: '۰۹۱۲۱۱۱۴۴۵۵' },
      { id: 'city', label: 'شهر', defaultVisible: true, defaultWidth: 10, align: 'center', format: 'text', sampleValue: 'تهران' },
      { id: 'province', label: 'استان', defaultVisible: false, defaultWidth: 10, align: 'center', format: 'text', sampleValue: 'تهران' },
      { id: 'address', label: 'آدرس', defaultVisible: false, defaultWidth: 20, align: 'right', format: 'text', sampleValue: 'بازار بزرگ، سرای امید' },
      { id: 'goldBalance', label: 'مانده طلا (گرم)', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'weight', sampleValue: '۱۲۵.۴۵۰' },
      { id: 'silverBalance', label: 'مانده نقره (گرم)', defaultVisible: false, defaultWidth: 12, align: 'center', format: 'weight', sampleValue: '۰.۰۰۰' },
      { id: 'platinumBalance', label: 'مانده پلاتین (گرم)', defaultVisible: false, defaultWidth: 12, align: 'center', format: 'weight', sampleValue: '۰.۰۰۰' },
      { id: 'rialBalance', label: 'مانده ریالی', defaultVisible: true, defaultWidth: 16, align: 'center', format: 'currency', sampleValue: '۴۵۰,۰۰۰,۰۰۰' },
      { id: 'foreignBalance', label: 'مانده ارز دوم', defaultVisible: false, defaultWidth: 12, align: 'center', format: 'currency', sampleValue: '۱,۲۰۰ $' },
    ],
    sampleRows: [
      { customerCode: '۱۰۱', name: 'گالری طلای زرتشت', groupName: 'همکاران', phone1: '۰۹۱۲۱۱۱۴۴۵۵', city: 'تهران', goldBalance: '۱۲۵.۴۵۰', rialBalance: '۴۵۰,۰۰۰,۰۰۰' },
      { customerCode: '۱۰۲', name: 'بنکداری برادران کمالی', groupName: 'بنکداران', phone1: '۰۹۱۲۳۳۳۷۷۸۸', city: 'اصفهان', goldBalance: '۲۴۰.۱۲۰', rialBalance: '۱,۲۰۰,۰۰۰,۰۰۰' },
      { customerCode: '۱۰۳', name: 'جواهری الماس درخشان', groupName: 'کیفی‌ها', phone1: '۰۹۱۹۴۴۴۵۵۶۶', city: 'مشهد', goldBalance: '۱۵.۸۰۰', rialBalance: '۸۵,۰۰۰,۰۰۰' },
      { customerCode: '۱۰۴', name: 'کارگاه طلاسازی پارس', groupName: 'سازندگان', phone1: '۰۹۱۲۹۹۹۲۲۱۱', city: 'تبریز', goldBalance: '۳۱۰.۵۰۰', rialBalance: '۶۲۰,۰۰۰,۰۰۰' },
    ],
  },
  sales: {
    type: 'sales',
    label: 'گزارش فروش',
    description: 'فاکتورهای فروش طلا، مصنوعات و تسویه‌ها',
    availableColumns: [
      { id: 'invoiceNumber', label: 'شماره فاکتور', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'text', sampleValue: 'ف-۱۴۰۳-۰۸۹' },
      { id: 'date', label: 'تاریخ', defaultVisible: true, defaultWidth: 12, align: 'center', format: 'date', sampleValue: '۱۴۰۳/۰۸/۱۲' },
      { id: 'customerName', label: 'خریدار', defaultVisible: true, defaultWidth: 24, align: 'right', format: 'text', sampleValue: 'امیرحسین رضایی' },
      { id: 'itemsCount', label: 'تعداد اقلام', defaultVisible: true, defaultWidth: 10, align: 'center', format: 'number', sampleValue: '۳' },
      { id: 'goldWeight', label: 'وزن طلا (گرم)', defaultVisible: true, defaultWidth: 16, align: 'center', format: 'weight', sampleValue: '۴۲.۶۵۰' },
      { id: 'totalPrice', label: 'مبلغ کل فاکتور', defaultVisible: true, defaultWidth: 24, align: 'center', format: 'currency', sampleValue: '۱۹۵,۰۰۰,۰۰۰ ریال' },
    ],
    sampleRows: [
      { invoiceNumber: 'ف-۱۴۰۳-۰۰۱', date: '۱۴۰۳/۰۸/۱۰', customerName: 'محمد احمدی', itemsCount: '۲', goldWeight: '۲۵.۳۰۰', totalPrice: '۱۱۵,۰۰۰,۰۰۰ ریال' },
      { invoiceNumber: 'ف-۱۴۰۳-۰۰۲', date: '۱۴۰۳/۰۸/۱۱', customerName: 'گالری پرنیا', itemsCount: '۵', goldWeight: '۸۸.۱۵۰', totalPrice: '۳۹۵,۰۰۰,۰۰۰ ریال' },
    ],
  },
  purchases: {
    type: 'purchases',
    label: 'گزارش خرید',
    description: 'فاکتورهای خرید طلای خام، آبشده و متفرقه',
    availableColumns: [
      { id: 'invoiceNumber', label: 'شماره سند خرید', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'text', sampleValue: 'خ-۱۴۰۳-۰۴۲' },
      { id: 'date', label: 'تاریخ', defaultVisible: true, defaultWidth: 12, align: 'center', format: 'date', sampleValue: '۱۴۰۳/۰۸/۱۴' },
      { id: 'supplierName', label: 'فروشنده / تامین‌کننده', defaultVisible: true, defaultWidth: 24, align: 'right', format: 'text', sampleValue: 'آبشده‌فروشی مرکزی' },
      { id: 'karat', label: 'عیار پایه', defaultVisible: true, defaultWidth: 10, align: 'center', format: 'number', sampleValue: '۷۵۰' },
      { id: 'goldWeight', label: 'وزن (گرم)', defaultVisible: true, defaultWidth: 16, align: 'center', format: 'weight', sampleValue: '۱۵۰.۰۰۰' },
      { id: 'totalPrice', label: 'مبلغ کل', defaultVisible: true, defaultWidth: 24, align: 'center', format: 'currency', sampleValue: '۶۷۵,۰۰۰,۰۰۰ ریال' },
    ],
    sampleRows: [
      { invoiceNumber: 'خ-۱۴۰۳-۰۰۱', date: '۱۴۰۳/۰۸/۰۵', supplierName: 'ری‌گیری اعتماد', karat: '۷۵۰', goldWeight: '۱۰۰.۰۰۰', totalPrice: '۴۵۰,۰۰۰,۰۰۰ ریال' },
    ],
  },
  inventory: {
    type: 'inventory',
    label: 'گزارش موجودی کالا',
    description: 'موجودی انبار، ویترین و مانده‌های فیزیکی مصنوعات',
    availableColumns: [
      { id: 'itemCode', label: 'کد کالا', defaultVisible: true, defaultWidth: 12, align: 'center', format: 'text', sampleValue: 'GOLD-402' },
      { id: 'itemName', label: 'شرح و نام کالا', defaultVisible: true, defaultWidth: 28, align: 'right', format: 'text', sampleValue: 'دستبند کارتیر ۱۸ عیار' },
      { id: 'category', label: 'دسته‌بندی', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'text', sampleValue: 'دستبند' },
      { id: 'karat', label: 'عیار', defaultVisible: true, defaultWidth: 10, align: 'center', format: 'number', sampleValue: '۷۵۰' },
      { id: 'weight', label: 'وزن کل (گرم)', defaultVisible: true, defaultWidth: 16, align: 'center', format: 'weight', sampleValue: '۱۸.۴۲۰' },
      { id: 'quantity', label: 'تعداد موجود', defaultVisible: true, defaultWidth: 10, align: 'center', format: 'number', sampleValue: '۲' },
    ],
    sampleRows: [
      { itemCode: 'G-101', itemName: 'النگو داماس طلا', category: 'النگو', karat: '۷۵۰', weight: '۳۲.۵۰۰', quantity: '۴' },
      { itemCode: 'G-102', itemName: 'سرویس مارکیز نگین‌دار', category: 'سرویس', karat: '۷۵۰', weight: '۴۵.۲۰۰', quantity: '۱' },
    ],
  },
  financial: {
    type: 'financial',
    label: 'گزارش مالی و تراز',
    description: 'تراز حساب‌ها، مانده صندوق و بانک‌ها',
    availableColumns: [
      { id: 'accountCode', label: 'کد حساب', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'text', sampleValue: '۱۱۰۱' },
      { id: 'accountName', label: 'نام حساب / سرفصل', defaultVisible: true, defaultWidth: 30, align: 'right', format: 'text', sampleValue: 'حساب جاری بانک ملت' },
      { id: 'debtorAmount', label: 'گردش بدهکار', defaultVisible: true, defaultWidth: 18, align: 'center', format: 'currency', sampleValue: '۸۲۰,۰۰۰,۰۰۰' },
      { id: 'creditorAmount', label: 'گردش بستانکار', defaultVisible: true, defaultWidth: 18, align: 'center', format: 'currency', sampleValue: '۵۱۰,۰۰۰,۰۰۰' },
      { id: 'balance', label: 'مانده نهایی', defaultVisible: true, defaultWidth: 20, align: 'center', format: 'currency', sampleValue: '۳۱۰,۰۰۰,۰۰۰ بد' },
    ],
    sampleRows: [
      { accountCode: '۱۰۱', accountName: 'صندوق اصلی ریالی', debtorAmount: '۱۵۰,۰۰۰,۰۰۰', creditorAmount: '۸۰,۰۰۰,۰۰۰', balance: '۷۰,۰۰۰,۰۰۰ بد' },
      { accountCode: '۱۰۲', accountName: 'بانک سامان تجارت', debtorAmount: '۹۰۰,۰۰۰,۰۰۰', creditorAmount: '۶۰۰,۰۰۰,۰۰۰', balance: '۳۰۰,۰۰۰,۰۰۰ بد' },
    ],
  },
  gold: {
    type: 'gold',
    label: 'گزارش طلا و اوزان',
    description: 'تراز وزنی طلا، متفرقه و کسری‌های ساخت',
    availableColumns: [
      { id: 'date', label: 'تاریخ سند', defaultVisible: true, defaultWidth: 12, align: 'center', format: 'date', sampleValue: '۱۴۰۳/۰۸/۱۰' },
      { id: 'description', label: 'شرح عملیات وزنی', defaultVisible: true, defaultWidth: 32, align: 'right', format: 'text', sampleValue: 'تحویل طلای خام به کارگاه سازنده' },
      { id: 'karat750Weight', label: 'وزن معادل ۷۵۰', defaultVisible: true, defaultWidth: 18, align: 'center', format: 'weight', sampleValue: '۱۵۲.۸۰۰' },
      { id: 'actualWeight', label: 'وزن واقعی (گرم)', defaultVisible: true, defaultWidth: 18, align: 'center', format: 'weight', sampleValue: '۱۵۴.۳۰۰' },
      { id: 'balance', label: 'مانده وزنی', defaultVisible: true, defaultWidth: 20, align: 'center', format: 'weight', sampleValue: '۵۲.۸۰۰ بد' },
    ],
    sampleRows: [
      { date: '۱۴۰۳/۰۸/۰۱', description: 'مانده اول دوره صندوق طلای خام', karat750Weight: '۵۰۰.۰۰۰', actualWeight: '۵۰۰.۰۰۰', balance: '۵۰۰.۰۰۰ بد' },
    ],
  },
  transactions: {
    type: 'transactions',
    label: 'گزارش تراکنش‌ها و ریز گردش',
    description: 'ریز اسناد، واریز و برداشت‌ها و تراکنش‌های روزانه',
    availableColumns: [
      { id: 'date', label: 'تاریخ تراکنش', defaultVisible: true, defaultWidth: 12, align: 'center', format: 'date', sampleValue: '۱۴۰۳/۰۸/۱۵' },
      { id: 'type', label: 'نوع عملیات', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'text', sampleValue: 'دریافت نقدی' },
      { id: 'documentNumber', label: 'شماره سند', defaultVisible: true, defaultWidth: 14, align: 'center', format: 'text', sampleValue: 'سند-۴۰۱' },
      { id: 'description', label: 'شرح تراکنش', defaultVisible: true, defaultWidth: 32, align: 'right', format: 'text', sampleValue: 'تسویه مانده فاکتور فروش' },
      { id: 'amount', label: 'مبلغ / مقدار', defaultVisible: true, defaultWidth: 18, align: 'center', format: 'currency', sampleValue: '۷۵,۰۰۰,۰۰۰ ریال' },
    ],
    sampleRows: [
      { date: '۱۴۰۳/۰۸/۱۲', type: 'دریافت طلا', documentNumber: 'سند-۳۹۰', description: 'دریافت طلای متفرقه از مشتری', amount: '۱۴.۲۰۰ گرم' },
    ],
  },
  general: {
    type: 'general',
    label: 'گزارشات عمومی و سفارشی',
    description: 'قالب پایه برای تولید انواع گزارش‌های سفارشی',
    availableColumns: [
      { id: 'col1', label: 'عنوان ردیف', defaultVisible: true, defaultWidth: 30, align: 'right', format: 'text', sampleValue: 'عنوان نمونه ۱' },
      { id: 'col2', label: 'کد مرجع', defaultVisible: true, defaultWidth: 20, align: 'center', format: 'text', sampleValue: 'REF-001' },
      { id: 'col3', label: 'تاریخ', defaultVisible: true, defaultWidth: 20, align: 'center', format: 'date', sampleValue: '۱۴۰۳/۰۸/۰۱' },
      { id: 'col4', label: 'مقدار / مانده', defaultVisible: true, defaultWidth: 30, align: 'center', format: 'number', sampleValue: '۱,۵۰۰' },
    ],
    sampleRows: [
      { col1: 'گزارش فعالیت کاربران', col2: 'USR-88', col3: '۱۴۰۳/۰۸/۱۰', col4: '۲۴ فعالیت' },
    ],
  },
};

export const DEFAULT_REPORT_TEMPLATES: ReportPrintTemplate[] = [
  {
    id: 'rep_tpl_customer_default',
    name: 'قالب استاندارد گزارش طرف‌حساب‌ها',
    reportType: 'customer',
    isActive: true,
    isDefault: true,
    isSystemDefault: true,
    page: {
      size: 'A4',
      orientation: 'landscape',
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      backgroundColor: '#ffffff',
      borderEnabled: true,
      borderColor: '#e2e8f0',
      borderWidthMm: 0.5,
    },
    header: {
      enabled: true,
      showLogo: true,
      showStoreName: true,
      showTitle: true,
      customTitle: 'گزارش و صورت وضعیت طرف‌حساب‌ها',
      showSubtitle: true,
      customSubtitle: 'فهرست تفصیلی مانده حساب‌های ریالی و وزنی',
      showDate: true,
      showOrganizationInfo: true,
    },
    table: {
      columns: REPORT_TYPE_DEFINITIONS.customer.availableColumns.map((col) => ({
        id: col.id,
        label: col.label,
        visible: col.defaultVisible,
        widthPercent: col.defaultWidth,
        textAlign: col.align,
        format: col.format,
      })),
      fontSizePt: 8.5,
      headerBgColor: '#f1f5f9',
      headerTextColor: '#0f172a',
      bodyTextColor: '#1e293b',
      alternateRowBg: true,
      borderColor: '#cbd5e1',
      borderWidthMm: 0.4,
      showIndexColumn: true,
    },
    footer: {
      enabled: true,
      showPageNumber: true,
      showTotalCount: true,
      showSignature: true,
      signatureTitle: 'تایید و امضای مدیریت',
      showStamp: true,
      customFooterText: 'گزارش تولید شده از سامانه حسابداری طلا و جواهر زر فولیو',
    },
  },
  {
    id: 'rep_tpl_sales_default',
    name: 'قالب استاندارد گزارش فروش',
    reportType: 'sales',
    isActive: true,
    isDefault: true,
    isSystemDefault: true,
    page: {
      size: 'A4',
      orientation: 'portrait',
      marginTopMm: 10,
      marginRightMm: 10,
      marginBottomMm: 10,
      marginLeftMm: 10,
      backgroundColor: '#ffffff',
      borderEnabled: true,
      borderColor: '#e2e8f0',
      borderWidthMm: 0.5,
    },
    header: {
      enabled: true,
      showLogo: true,
      showStoreName: true,
      showTitle: true,
      customTitle: 'گزارش فروش و صدور فاکتور',
      showSubtitle: true,
      customSubtitle: 'خلاصه فاکتورهای فروش در بازه انتخابی',
      showDate: true,
      showOrganizationInfo: true,
    },
    table: {
      columns: REPORT_TYPE_DEFINITIONS.sales.availableColumns.map((col) => ({
        id: col.id,
        label: col.label,
        visible: col.defaultVisible,
        widthPercent: col.defaultWidth,
        textAlign: col.align,
        format: col.format,
      })),
      fontSizePt: 9,
      headerBgColor: '#f8fafc',
      headerTextColor: '#0f172a',
      bodyTextColor: '#1e293b',
      alternateRowBg: true,
      borderColor: '#e2e8f0',
      borderWidthMm: 0.4,
      showIndexColumn: true,
    },
    footer: {
      enabled: true,
      showPageNumber: true,
      showTotalCount: true,
      showSignature: true,
      signatureTitle: 'امضای مسئول فروش',
      showStamp: true,
      customFooterText: 'زر فولیو - سامانه یکپارچه طلا و جواهر',
    },
  },
];
