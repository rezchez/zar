export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'cost_of_sales'
  | 'expense'
  | 'memorandum';

export type NormalBalance = 'debit' | 'credit' | 'dual';

export type AccountLevel = 1 | 2 | 3 | 4 | 5;

export interface ChartOfAccountRecord {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  path?: string;
  level: AccountLevel;
  accountType: AccountType;
  normalBalance: NormalBalance;
  requiresWeight?: boolean;
  isMultiCurrency?: boolean;
  isSystem?: boolean;
  isActive?: boolean;
  isPostable?: boolean;
  sortOrder?: number;
  description?: string | null;
  tags?: string[] | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  created?: string;
  updated?: string;
}

export interface AccountTreeNode extends ChartOfAccountRecord {
  children: AccountTreeNode[];
  childrenCount: number;
  parent?: ChartOfAccountRecord | null;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'دارایی‌ها',
  liability: 'بدهی‌ها',
  equity: 'حقوق مالکانه',
  revenue: 'درآمدها',
  cost_of_sales: 'بهای تمام‌شده',
  expense: 'هزینه‌ها',
  memorandum: 'حساب‌های انتظامی',
};

export const NORMAL_BALANCE_LABELS: Record<NormalBalance, string> = {
  debit: 'بدهکار',
  credit: 'بستانکار',
  dual: 'دوگانه (بدهکار/بستانکار)',
};

export const LEVEL_LABELS: Record<AccountLevel, string> = {
  1: 'سطح ۱ - گروه',
  2: 'سطح ۲ - کل',
  3: 'سطح ۳ - معین',
  4: 'سطح ۴ - تفضیل ۱',
  5: 'سطح ۵ - تفضیل ۲',
};

export const LEVEL_SHORT_LABELS: Record<AccountLevel, string> = {
  1: 'گروه',
  2: 'کل',
  3: 'معین',
  4: 'تفضیل ۱',
  5: 'تفضیل ۲',
};

export const DEFAULT_CHART_OF_ACCOUNTS: Omit<ChartOfAccountRecord, 'created' | 'updated'>[] = [
  // 1000: دارایی‌ها
  {
    id: 'sys_1000',
    code: '1000',
    name: 'دارایی‌ها',
    parentId: null,
    path: '/1000/',
    level: 1,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 1000,
    description: 'مجموع کلیه حقوق مالی و منابع اقتصادی متعلق به کسب‌وکار طلا و جواهر (جاری و غیرجاری)',
  },
  {
    id: 'sys_1100',
    code: '1100',
    name: 'دارایی‌های جاری',
    parentId: 'sys_1000',
    path: '/1000/1100/',
    level: 2,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 1100,
    description: 'وجوه نقد، موجودی طلا و مسکوکات، مطالبات و دارایی‌هایی که ظرف یک سال مالی نقد یا مصرف می‌شوند',
  },
  {
    id: 'sys_1110',
    code: '1110',
    name: 'موجودی نقد و بانک',
    parentId: 'sys_1100',
    path: '/1000/1100/1110/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: true,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1110,
    description: 'سرفصل معین وجوه نقد، صندوق‌ها، تنخواه‌گردان و حساب‌های بانکی ریالی و ارزی',
  },
  {
    id: 'sys_1120',
    code: '1120',
    name: 'اسناد و حساب‌های دریافتنی',
    parentId: 'sys_1100',
    path: '/1000/1100/1120/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1120,
    description: 'مطالبات تجاری از مشتریان، چک‌های وارده از طرف‌حساب‌ها و بدهکاران متفرقه',
  },
  {
    id: 'sys_1130',
    code: '1130',
    name: 'موجودی کالا و طلا',
    parentId: 'sys_1100',
    path: '/1000/1100/1130/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1130,
    description: 'موجودی طلای خام، آبشده، سکه، شمش، پلاتین و مصنوعات طلا و جواهر در گاوصندوق و ویترین',
  },
  {
    id: 'sys_1140',
    code: '1140',
    name: 'پیش‌پرداخت‌ها',
    parentId: 'sys_1100',
    path: '/1000/1100/1140/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1140,
    description: 'مبالغ پرداختی قبل از تحویل طلا، اقلام یا خدمات (پیش‌پرداخت خرید طلا، اجاره و بیمه)',
  },
  {
    id: 'sys_1150',
    code: '1150',
    name: 'سایر دارایی‌های جاری',
    parentId: 'sys_1100',
    path: '/1000/1100/1150/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1150,
    description: 'سپرده‌های کوتاه‌مدت، مساعده پرسنل و سایر مطالبات متفرقه جاری',
  },
  {
    id: 'sys_1200',
    code: '1200',
    name: 'دارایی‌های غیرجاری',
    parentId: 'sys_1000',
    path: '/1000/1200/',
    level: 2,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 1200,
    description: 'دارایی‌های با عمر مفید بیش از یک سال مالی جهت استفاده در فعالیت‌های طلاسازی و فروشگاهی',
  },
  {
    id: 'sys_1210',
    code: '1210',
    name: 'دارایی‌های ثابت مشهود',
    parentId: 'sys_1200',
    path: '/1000/1200/1210/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1210,
    description: 'ابزار و ماشین‌آلات طلاسازی، کوره‌های ذوب، گاوصندوق‌ها، ویترین، دکوراسیون و اثاثه اداری',
  },
  {
    id: 'sys_1220',
    code: '1220',
    name: 'دارایی‌های نامشهود',
    parentId: 'sys_1200',
    path: '/1000/1200/1220/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1220,
    description: 'حق سرقفلی فروشگاه یا کارگاه، لایسنس نرم‌افزارهای تخصصی و علائم تجاری ثبت‌شده',
  },
  {
    id: 'sys_1230',
    code: '1230',
    name: 'سرمایه‌گذاری‌ها',
    parentId: 'sys_1200',
    path: '/1000/1200/1230/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1230,
    description: 'سرمایه‌گذاری‌های بلندمدت، اوراق بهادار، سهام و سپرده‌های بلندمدت بانکی',
  },
  {
    id: 'sys_1240',
    code: '1240',
    name: 'سایر دارایی‌های غیرجاری',
    parentId: 'sys_1200',
    path: '/1000/1200/1240/',
    level: 3,
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 1240,
    description: 'ودیعه‌های بلندمدت اجاره محل کسب، حق انشعابات و وثایق نزد اشخاص ثالث',
  },

  // 2000: بدهی‌ها
  {
    id: 'sys_2000',
    code: '2000',
    name: 'بدهی‌ها',
    parentId: null,
    path: '/2000/',
    level: 1,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 2000,
    description: 'تعهدات مالی، وزنی و پولی موسسه در برابر مشتریان، بنکداران، بانک‌ها و مراجع قانونی',
  },
  {
    id: 'sys_2100',
    code: '2100',
    name: 'بدهی‌های جاری',
    parentId: 'sys_2000',
    path: '/2000/2100/',
    level: 2,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 2100,
    description: 'تعهداتی که سررسید پرداخت و تسویه آن‌ها ظرف یک سال مالی جاری می‌باشد',
  },
  {
    id: 'sys_2110',
    code: '2110',
    name: 'اسناد و حساب‌های پرداختنی',
    parentId: 'sys_2100',
    path: '/2000/2100/2110/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2110,
    description: 'چک‌های صادرشده عهده حساب‌های بانکی و اسناد تجاری متعهدشده جهت پرداخت',
  },
  {
    id: 'sys_2120',
    code: '2120',
    name: 'بدهی به طرف حساب‌ها',
    parentId: 'sys_2100',
    path: '/2000/2100/2120/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2120,
    description: 'مانده بستانکاری وزنی (طلایی) و ریالی بنکداران، آبکاران، مخراجکاران، همکاران و مشتریان',
  },
  {
    id: 'sys_2130',
    code: '2130',
    name: 'مالیات و عوارض پرداختنی',
    parentId: 'sys_2100',
    path: '/2000/2100/2130/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2130,
    description: 'مالیات بر ارزش افزوده اجرت و سود طلا، مالیات بر عملکرد و مالیات‌های تکلیفی پرداختنی',
  },
  {
    id: 'sys_2140',
    code: '2140',
    name: 'حقوق و مزایای پرداختنی',
    parentId: 'sys_2100',
    path: '/2000/2100/2140/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2140,
    description: 'حقوق پایه، اضافه کاری، حق اولاد، عیدی، پاداش و بیمه پرداختنی به پرسنل',
  },
  {
    id: 'sys_2150',
    code: '2150',
    name: 'پیش‌دریافت‌ها',
    parentId: 'sys_2100',
    path: '/2000/2100/2150/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2150,
    description: 'وجوه یا طلای دریافتی از مشتریان قبل از ساخت یا تحویل سفارش مصنوعات',
  },
  {
    id: 'sys_2160',
    code: '2160',
    name: 'سایر بدهی‌های جاری',
    parentId: 'sys_2100',
    path: '/2000/2100/2160/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2160,
    description: 'سایر تعهدات کوتاه‌مدت مالی، سپرده‌های دریافتی امانی و دیون متفرقه',
  },
  {
    id: 'sys_2200',
    code: '2200',
    name: 'بدهی‌های غیرجاری',
    parentId: 'sys_2000',
    path: '/2000/2200/',
    level: 2,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 2200,
    description: 'تعهدات مالی با سررسید تسویه بیش از یک سال مالی',
  },
  {
    id: 'sys_2210',
    code: '2210',
    name: 'تسهیلات و وام‌های بلندمدت',
    parentId: 'sys_2200',
    path: '/2000/2200/2210/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2210,
    description: 'اصل و کارمزد وام‌های بانکی و اعتبارات بلندمدت دریافتی از شبکه بانکی',
  },
  {
    id: 'sys_2220',
    code: '2220',
    name: 'سایر بدهی‌های غیرجاری',
    parentId: 'sys_2200',
    path: '/2000/2200/2220/',
    level: 3,
    accountType: 'liability',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 2220,
    description: 'دیون تجاری بلندمدت و ذخایر مربوط به مزایای پایان خدمت کارکنان',
  },

  // 3000: حقوق مالکانه
  {
    id: 'sys_3000',
    code: '3000',
    name: 'حقوق مالکانه',
    parentId: null,
    path: '/3000/',
    level: 1,
    accountType: 'equity',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 3000,
    description: 'حق مالی مالکان و شرکا در خالص دارایی‌های موسسه پس از کسر کلیه بدهی‌ها',
  },
  {
    id: 'sys_3100',
    code: '3100',
    name: 'سرمایه',
    parentId: 'sys_3000',
    path: '/3000/3100/',
    level: 2,
    accountType: 'equity',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 3100,
    description: 'سرمایه اولیه ثبت‌شده، آورده‌های نقدی و وزنی طلا توسط شرکا و صاحبان کسب‌وکار',
  },
  {
    id: 'sys_3200',
    code: '3200',
    name: 'اندوخته‌ها',
    parentId: 'sys_3000',
    path: '/3000/3200/',
    level: 2,
    accountType: 'equity',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 3200,
    description: 'اندوخته‌های قانونی، احتیاطی و توسعه کسب‌وکار جهت تقویت بنیه مالی',
  },
  {
    id: 'sys_3300',
    code: '3300',
    name: 'سود و زیان انباشته',
    parentId: 'sys_3000',
    path: '/3000/3300/',
    level: 2,
    accountType: 'equity',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 3300,
    description: 'سود یا زیان سال‌های قبل که بین شرکا تقسیم نشده و به دوره‌های آتی منتقل شده است',
  },
  {
    id: 'sys_3400',
    code: '3400',
    name: 'جاری شرکا و برداشت',
    parentId: 'sys_3000',
    path: '/3000/3400/',
    level: 2,
    accountType: 'equity',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 3400,
    description: 'برداشت‌های موقت نقدی یا طلایی و واریزی‌های جاری شرکا طی دوره مالی',
  },
  {
    id: 'sys_3500',
    code: '3500',
    name: 'سود و زیان دوره',
    parentId: 'sys_3000',
    path: '/3000/3500/',
    level: 2,
    accountType: 'equity',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 3500,
    description: 'حساب خلاصه سود و زیان جاری ناشی از بستن حساب‌های درآمد و هزینه در پایان دوره',
  },

  // 4000: درآمدها
  {
    id: 'sys_4000',
    code: '4000',
    name: 'درآمدها',
    parentId: null,
    path: '/4000/',
    level: 1,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 4000,
    description: 'افزایش در حقوق مالکانه ناشی از فروش طلا، مصنوعات، نقره، مسکوکات و ارائه خدمات',
  },
  {
    id: 'sys_4100',
    code: '4100',
    name: 'درآمدهای عملیاتی',
    parentId: 'sys_4000',
    path: '/4000/4100/',
    level: 2,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 4100,
    description: 'درآمدهای حاصل از فعالیت اصلی خرید و فروش فلزات گرانبها و مصنوعات طلا',
  },
  {
    id: 'sys_4110',
    code: '4110',
    name: 'درآمد فروش طلا',
    parentId: 'sys_4100',
    path: '/4000/4100/4110/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4110,
    description: 'درآمد حاصل از فروش طلای خام، آبشده، شمش و مسکوکات طلا',
  },
  {
    id: 'sys_4120',
    code: '4120',
    name: 'درآمد فروش مصنوعات',
    parentId: 'sys_4100',
    path: '/4000/4100/4120/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4120,
    description: 'درآمد حاصل از فروش زیورآلات، جواهرات و مصنوعات ساخته‌شده طلا',
  },
  {
    id: 'sys_4130',
    code: '4130',
    name: 'درآمد فروش نقره',
    parentId: 'sys_4100',
    path: '/4000/4100/4130/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4130,
    description: 'درآمد حاصل از فروش ساچمه نقره، شمش نقره و ظروف و مصنوعات نقره',
  },
  {
    id: 'sys_4140',
    code: '4140',
    name: 'درآمد فروش سایر کالاها',
    parentId: 'sys_4100',
    path: '/4000/4100/4140/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4140,
    description: 'درآمد حاصل از فروش سکه‌های بانکی، سنگ‌های قیمتی، جعبه و متعلقات',
  },
  {
    id: 'sys_4200',
    code: '4200',
    name: 'درآمد خدمات',
    parentId: 'sys_4000',
    path: '/4000/4200/',
    level: 2,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 4200,
    description: 'درآمدهای حاصل از ارائه خدمات فنی و تخصصی در حوزه طلاسازی و کارگاهی',
  },
  {
    id: 'sys_4210',
    code: '4210',
    name: 'درآمد خدمات آبکاری',
    parentId: 'sys_4200',
    path: '/4000/4200/4210/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4210,
    description: 'درآمد حاصل از آبکاری رادیوم، طلای زرد، رزگلد و پوشش‌دهی مصنوعات',
  },
  {
    id: 'sys_4220',
    code: '4220',
    name: 'درآمد خدمات مخراجکاری',
    parentId: 'sys_4200',
    path: '/4000/4200/4220/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4220,
    description: 'اجرت نصب و سوار کردن نگین، برلیان و سنگ‌های قیمتی روی پایه مصنوعات',
  },
  {
    id: 'sys_4230',
    code: '4230',
    name: 'درآمد تعمیرات',
    parentId: 'sys_4200',
    path: '/4000/4200/4230/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4230,
    description: 'اجرت جوشکاری، تغییر سایز انگشتر، رفع عیوب و بازسازی مصنوعات مشتریان',
  },
  {
    id: 'sys_4240',
    code: '4240',
    name: 'سایر درآمدهای خدماتی',
    parentId: 'sys_4200',
    path: '/4000/4200/4240/',
    level: 3,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4240,
    description: 'اجرت طراحی سه‌بعدی طلا، ری‌گیری و عیارسنجی، قالب‌سازی و حکاکی لیزری',
  },
  {
    id: 'sys_4300',
    code: '4300',
    name: 'سایر درآمدها',
    parentId: 'sys_4000',
    path: '/4000/4300/',
    level: 2,
    accountType: 'revenue',
    normalBalance: 'credit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 4300,
    description: 'درآمدهای غیرعملیاتی شامل سود سپرده‌های بانکی، تسعیر ارز و فروش ضایعات',
  },

  // 5000: بهای تمام‌شده
  {
    id: 'sys_5000',
    code: '5000',
    name: 'بهای تمام‌شده',
    parentId: null,
    path: '/5000/',
    level: 1,
    accountType: 'cost_of_sales',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 5000,
    description: 'هزینه‌های مستقیم مواد اولیه و طلای مصرف‌شده جهت فروش یا تولید کالا',
  },
  {
    id: 'sys_5100',
    code: '5100',
    name: 'بهای تمام‌شده کالای فروش‌رفته',
    parentId: 'sys_5000',
    path: '/5000/5100/',
    level: 2,
    accountType: 'cost_of_sales',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 5100,
    description: 'بهای تمام‌شده کلیه کالاها، طلا و مصنوعات به فروش‌رسیده در طی دوره',
  },
  {
    id: 'sys_5200',
    code: '5200',
    name: 'بهای تمام‌شده طلا',
    parentId: 'sys_5000',
    path: '/5000/5200/',
    level: 2,
    accountType: 'cost_of_sales',
    normalBalance: 'debit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 5200,
    description: 'بهای تمام‌شده طلای خام، آبشده و مسکوکات واگذار شده به مشتریان',
  },
  {
    id: 'sys_5300',
    code: '5300',
    name: 'بهای تمام‌شده مصنوعات',
    parentId: 'sys_5000',
    path: '/5000/5300/',
    level: 2,
    accountType: 'cost_of_sales',
    normalBalance: 'debit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 5300,
    description: 'بهای تمام‌شده پایه طلا و سنگ‌های قیمتی مصنوعات فروخته‌شده',
  },
  {
    id: 'sys_5400',
    code: '5400',
    name: 'بهای تمام‌شده نقره',
    parentId: 'sys_5000',
    path: '/5000/5400/',
    level: 2,
    accountType: 'cost_of_sales',
    normalBalance: 'debit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 5400,
    description: 'بهای تمام‌شده نقره خام و مصنوعات نقره فروخته‌شده',
  },
  {
    id: 'sys_5500',
    code: '5500',
    name: 'هزینه‌های مستقیم تولید',
    parentId: 'sys_5000',
    path: '/5000/5500/',
    level: 2,
    accountType: 'cost_of_sales',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 5500,
    description: 'هزینه‌های ریختگری، نگین، کسری ذوب استاندارد و عیار کسرشده در فرایند ساخت',
  },

  // 6000: هزینه‌ها
  {
    id: 'sys_6000',
    code: '6000',
    name: 'هزینه‌ها',
    parentId: null,
    path: '/6000/',
    level: 1,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 6000,
    description: 'کلیه مخارج عملیاتی، جاری، پرسنلی، مالی و استهلاک جهت اداره موسسه',
  },
  {
    id: 'sys_6100',
    code: '6100',
    name: 'هزینه‌های اداری و عمومی',
    parentId: 'sys_6000',
    path: '/6000/6100/',
    level: 2,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 6100,
    description: 'مخارج عمومی اداره فروشگاه، گالری یا کارگاه طلاسازی',
  },
  {
    id: 'sys_6110',
    code: '6110',
    name: 'حقوق و دستمزد',
    parentId: 'sys_6100',
    path: '/6000/6100/6110/',
    level: 3,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6110,
    description: 'حقوق ماهانه، اضافه کاری، بیمه سهم کارفرما و پاداش پرسنل و فروشندگان',
  },
  {
    id: 'sys_6120',
    code: '6120',
    name: 'اجاره',
    parentId: 'sys_6100',
    path: '/6000/6100/6120/',
    level: 3,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6120,
    description: 'اجاره‌بهای ماهانه مغازه، گالری، دفتر مرکزی یا کارگاه طلاسازی',
  },
  {
    id: 'sys_6130',
    code: '6130',
    name: 'آب، برق و گاز',
    parentId: 'sys_6100',
    path: '/6000/6100/6130/',
    level: 3,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6130,
    description: 'هزینه‌های انشعابات مصرفی، برق صنعتی کارگاه و مصارف فروشگاه',
  },
  {
    id: 'sys_6140',
    code: '6140',
    name: 'تلفن و اینترنت',
    parentId: 'sys_6100',
    path: '/6000/6100/6140/',
    level: 3,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6140,
    description: 'هزینه‌های خطوط تلفن ثابت، همراه، اینترنت پرسرعت و سرور نرم‌افزار',
  },
  {
    id: 'sys_6150',
    code: '6150',
    name: 'تعمیر و نگهداری',
    parentId: 'sys_6100',
    path: '/6000/6100/6150/',
    level: 3,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6150,
    description: 'مخارج تعمیر گاوصندوق، دوربین‌های مداربسته، ترازوها و تجهیزات طلاسازی',
  },
  {
    id: 'sys_6200',
    code: '6200',
    name: 'هزینه‌های فروش و بازاریابی',
    parentId: 'sys_6000',
    path: '/6000/6200/',
    level: 2,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 6200,
    description: 'هزینه‌های تبلیغات فضای مجازی، عکاسی از طلا، بسته‌بندی لوکس و هدایا',
  },
  {
    id: 'sys_6300',
    code: '6300',
    name: 'هزینه‌های مالی و بانکی',
    parentId: 'sys_6000',
    path: '/6000/6300/',
    level: 2,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6300,
    description: 'کارمزد تراکنش دستگاه‌های POS، کارمزد حواله‌های ساتنا و پایا و سود تسهیلات',
  },
  {
    id: 'sys_6400',
    code: '6400',
    name: 'هزینه‌های استهلاک',
    parentId: 'sys_6000',
    path: '/6000/6400/',
    level: 2,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6400,
    description: 'استهلاک دارایی‌های ثابت شامل دکوراسیون، ویترین، گاوصندوق و ابزارآلات',
  },
  {
    id: 'sys_6500',
    code: '6500',
    name: 'سایر هزینه‌های عملیاتی',
    parentId: 'sys_6000',
    path: '/6000/6500/',
    level: 2,
    accountType: 'expense',
    normalBalance: 'debit',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 6500,
    description: 'هزینه‌های ایاب و ذهاب، پذیرایی، لوازم‌التحریر، پیک امنیتی طلا و متفرقه',
  },

  // 7000: حساب‌های انتظامی
  {
    id: 'sys_7000',
    code: '7000',
    name: 'حساب‌های انتظامی',
    parentId: null,
    path: '/7000/',
    level: 1,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 7000,
    description: 'حساب‌های آماری جهت ثبت تعهدات، اسناد امانی و تضامین بدون اثر بر ترازنامه',
  },
  {
    id: 'sys_7100',
    code: '7100',
    name: 'اسناد تضمینی',
    parentId: 'sys_7000',
    path: '/7000/7100/',
    level: 2,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 7100,
    description: 'مجموع اسناد و تضامین دریافتی از مشتریان و واگذار شده به اشخاص',
  },
  {
    id: 'sys_7110',
    code: '7110',
    name: 'اسناد تضمینی نزد شرکت',
    parentId: 'sys_7100',
    path: '/7000/7100/7110/',
    level: 3,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 7110,
    description: 'چک‌ها و سفته‌های امانی و تضمینی دریافتی از خریداران، پرسنل یا همکاران',
  },
  {
    id: 'sys_7120',
    code: '7120',
    name: 'اسناد تضمینی واگذار شده',
    parentId: 'sys_7100',
    path: '/7000/7100/7120/',
    level: 3,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 7120,
    description: 'اسناد و چک‌های تضمینی واگذار شده به بانک‌ها، مالکان یا طرف‌های قرارداد',
  },

  // 8000: طرف حساب‌های انتظامی
  {
    id: 'sys_8000',
    code: '8000',
    name: 'طرف حساب‌های انتظامی',
    parentId: null,
    path: '/8000/',
    level: 1,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 8000,
    description: 'طرف مقابل حساب‌های انتظامی جهت تراز شدن ثبت‌های دوطرفه آماری',
  },
  {
    id: 'sys_8100',
    code: '8100',
    name: 'طرف اسناد تضمینی',
    parentId: 'sys_8000',
    path: '/8000/8100/',
    level: 2,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: 8100,
    description: 'حساب معادل و متقابل اسناد تضمینی در سیستم دوبل انتظامی',
  },
  {
    id: 'sys_8110',
    code: '8110',
    name: 'طرف اسناد تضمینی نزد شرکت',
    parentId: 'sys_8100',
    path: '/8000/8100/8110/',
    level: 3,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 8110,
    description: 'طرف حساب معادل چک‌ها و سفته‌های تضمینی دریافتی نزد موسسه',
  },
  {
    id: 'sys_8120',
    code: '8120',
    name: 'طرف اسناد تضمینی واگذار شده',
    parentId: 'sys_8100',
    path: '/8000/8100/8120/',
    level: 3,
    accountType: 'memorandum',
    normalBalance: 'dual',
    requiresWeight: false,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: true,
    sortOrder: 8120,
    description: 'طرف حساب معادل اسناد تضمینی تودیع‌شده به دیگران',
  },
];

/**
 * Normalizes code string to ASCII digits
 */
export function normalizeAccountCode(code: string | number): string {
  return String(code)
    .trim()
    .replace(/[۰-۹]/g, (d) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
    .replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/\s+/g, '');
}

/**
 * Extracts active prefix for hierarchical checking.
 * e.g., '1000' -> '1', '1100' -> '11', '4100' -> '41', '1110' -> '111'
 */
export function getParentPrefix(parentCode: string): string {
  const normalized = normalizeAccountCode(parentCode);
  if (!normalized) return '';
  const trimmed = normalized.replace(/0+$/, '');
  return trimmed || normalized;
}

/**
 * Validates account code format and hierarchy constraints
 */
export function validateAccountCode(
  code: string,
  parentCode?: string | null,
  level?: AccountLevel,
): { valid: boolean; error?: string } {
  const normCode = normalizeAccountCode(code);

  if (!normCode) {
    return { valid: false, error: 'کد حساب نمی‌تواند خالی باشد.' };
  }

  if (!/^\d+$/.test(normCode)) {
    return { valid: false, error: 'کد حساب باید فقط شامل ارقام باشد.' };
  }

  if (normCode.length < 1 || normCode.length > 20) {
    return { valid: false, error: 'طول کد حساب باید بین ۱ تا ۲۰ رقم باشد.' };
  }

  if (parentCode) {
    const normParent = normalizeAccountCode(parentCode);
    if (normCode === normParent) {
      return { valid: false, error: 'کد حساب فرزند نمی‌تواند دقیقاً با کد حساب والد یکسان باشد.' };
    }

    const prefix = getParentPrefix(normParent);
    if (!normCode.startsWith(prefix)) {
      return {
        valid: false,
        error: `کد حساب فرزند باید در محدوده والد (${normParent}) باشد و با پیش‌کد "${prefix}" آغاز شود.`,
      };
    }
  }

  if (level) {
    if (level === 1 && normCode.length < 1) {
      return { valid: false, error: 'کد سرفصل گروه نامعتبر است.' };
    }
    if (level > 1 && !parentCode) {
      return { valid: false, error: 'سرفصل‌های سطح ۲، ۳ و ۴ حتماً باید دارای والد باشند.' };
    }
  }

  return { valid: true };
}

/**
 * Intelligent Code Suggestion Algorithm:
 * Proposes the next available child code based on parent and existing siblings.
 */
export function suggestNextChildCode(
  parent: { code: string; level: AccountLevel },
  existingChildren: { code: string }[] = [],
  allAccountCodes: Set<string> = new Set(),
): string {
  const parentCode = normalizeAccountCode(parent.code);
  const childLevel = ((parent.level + 1) as AccountLevel) || 4;

  const childCodes = existingChildren
    .map((c) => normalizeAccountCode(c.code))
    .filter(Boolean)
    .sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

  let suggested = '';

  if (childLevel === 2) {
    // Parent is Level 1 (e.g. 1000) -> children 1100, 1200, 1300...
    const baseRootDigit = parentCode.charAt(0) || '1';
    let step = 1;
    while (step <= 9) {
      const candidate = `${baseRootDigit}${step}00`;
      if (!childCodes.includes(candidate) && !allAccountCodes.has(candidate)) {
        suggested = candidate;
        break;
      }
      step++;
    }
    if (!suggested) {
      suggested = `${parentCode}01`;
    }
  } else if (childLevel === 3) {
    // Parent is Level 2 (e.g. 1100) -> children 1110, 1120, 1130...
    const prefix2 = parentCode.slice(0, 2);
    let step = 1;
    while (step <= 9) {
      const candidate = `${prefix2}${step}0`;
      if (!childCodes.includes(candidate) && !allAccountCodes.has(candidate)) {
        suggested = candidate;
        break;
      }
      step++;
    }
    if (!suggested) {
      // Try 1101, 1102... or 1111...
      let subStep = 1;
      while (subStep <= 99) {
        const candidate = `${prefix2}${String(subStep).padStart(2, '0')}`;
        if (!childCodes.includes(candidate) && !allAccountCodes.has(candidate)) {
          suggested = candidate;
          break;
        }
        subStep++;
      }
    }
  } else if (childLevel === 4) {
    // Parent is Level 3 (e.g. 1110) -> children 111001, 111002... or 1111, 1112...
    // Check if existing children use 4 digits or 6 digits
    const hasLongChild = childCodes.some((c) => c.length >= 6);
    if (hasLongChild || childCodes.length === 0) {
      let seq = 1;
      while (seq <= 999) {
        const candidate = `${parentCode}${String(seq).padStart(2, '0')}`;
        if (!childCodes.includes(candidate) && !allAccountCodes.has(candidate)) {
          suggested = candidate;
          break;
        }
        seq++;
      }
    } else {
      // 4-digit convention (e.g. parent 4110 -> 4111, 4112...)
      const prefix3 = parentCode.slice(0, 3);
      let step = 1;
      while (step <= 9) {
        const candidate = `${prefix3}${step}`;
        if (!childCodes.includes(candidate) && !allAccountCodes.has(candidate)) {
          suggested = candidate;
          break;
        }
        step++;
      }
      if (!suggested) {
        suggested = `${parentCode}01`;
      }
    }
  }

  // Fallback if still not found
  if (!suggested || allAccountCodes.has(suggested)) {
    let suffix = 1;
    while (suffix < 1000) {
      const candidate = `${parentCode}${String(suffix).padStart(2, '0')}`;
      if (!childCodes.includes(candidate) && !allAccountCodes.has(candidate)) {
        suggested = candidate;
        break;
      }
      suffix++;
    }
  }

  return suggested;
}

/**
 * Builds Materialized Path string for an account.
 * e.g. "/1000/1100/1110/"
 */
export function computeAccountPath(
  account: { code: string; parentId?: string | null },
  accountsById: Map<string, ChartOfAccountRecord>,
): string {
  const normCode = normalizeAccountCode(account.code);
  if (!account.parentId) {
    return `/${normCode}/`;
  }

  const parent = accountsById.get(account.parentId);
  if (!parent) {
    return `/${normCode}/`;
  }

  const parentPath = parent.path || computeAccountPath(parent, accountsById);
  const cleanParentPath = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  return `${cleanParentPath}${normCode}/`;
}

/**
 * Cycle Prevention:
 * Returns true if setting newParentId as the parent of targetId would create a loop in the tree.
 */
export function wouldCreateCycle(
  targetId: string,
  newParentId: string | null | undefined,
  accounts: ChartOfAccountRecord[],
): boolean {
  if (!newParentId) return false;
  if (targetId === newParentId) return true;

  const accountsMap = new Map<string, ChartOfAccountRecord>(accounts.map((a) => [a.id, a]));
  let currentParentId: string | null | undefined = newParentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (currentParentId === targetId) {
      return true; // Loop detected!
    }
    if (visited.has(currentParentId)) {
      return true;
    }
    visited.add(currentParentId);

    const parentAccount = accountsMap.get(currentParentId);
    currentParentId = parentAccount?.parentId;
  }

  return false;
}

/**
 * Builds full hierarchical tree structure from flat accounts list.
 */
export function buildAccountTree(accounts: ChartOfAccountRecord[]): AccountTreeNode[] {
  const nodeMap = new Map<string, AccountTreeNode>();
  const rootNodes: AccountTreeNode[] = [];

  // Sort by sortOrder, then numeric code, then string code
  const sortedAccounts = [...accounts].sort((a, b) => {
    if (a.sortOrder !== undefined && b.sortOrder !== undefined && a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    const numA = Number(normalizeAccountCode(a.code));
    const numB = Number(normalizeAccountCode(b.code));
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numA - numB;
    }
    return a.code.localeCompare(b.code);
  });

  // Initialize nodes
  for (const acc of sortedAccounts) {
    nodeMap.set(acc.id, {
      ...acc,
      children: [],
      childrenCount: 0,
      parent: null,
    });
  }

  // Link children to parents
  for (const acc of sortedAccounts) {
    const node = nodeMap.get(acc.id)!;
    if (acc.parentId && nodeMap.has(acc.parentId)) {
      const parentNode = nodeMap.get(acc.parentId)!;
      node.parent = parentNode;
      parentNode.children.push(node);
      parentNode.childrenCount++;
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

/**
 * Flattens tree back into list with hierarchical order preserved
 */
export function flattenAccountTree(tree: AccountTreeNode[]): AccountTreeNode[] {
  const result: AccountTreeNode[] = [];

  function traverse(nodes: AccountTreeNode[]) {
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(tree);
  return result;
}

/**
 * Returns all descendant IDs for a given account
 */
export function getAccountDescendantIds(
  accountId: string,
  accounts: ChartOfAccountRecord[],
): Set<string> {
  const tree = buildAccountTree(accounts);
  const descendants = new Set<string>();

  function findAndCollect(nodes: AccountTreeNode[]) {
    for (const node of nodes) {
      if (node.id === accountId) {
        collectChildren(node.children);
        return;
      }
      findAndCollect(node.children);
    }
  }

  function collectChildren(nodes: AccountTreeNode[]) {
    for (const child of nodes) {
      descendants.add(child.id);
      collectChildren(child.children);
    }
  }

  findAndCollect(tree);
  return descendants;
}

/**
 * Validation rules for deleting an account:
 * - Root nodes (isSystem=true & level=1): forbidden.
 * - System accounts (isSystem=true): forbidden.
 * - Non-system accounts with children: forbidden.
 * - Non-system leaf accounts: can delete (or deactivate if in use).
 */
export function canDeleteAccount(
  account: ChartOfAccountRecord,
  childrenCount: number,
  isUsedInTransactions = false,
): { canDelete: boolean; reason?: string; action: 'delete' | 'deactivate_only' | 'forbidden' } {
  if (account.isSystem && account.level === 1) {
    return {
      canDelete: false,
      reason: 'سرفصل‌های ریشه و اصلی سیستم غیرقابل حذف هستند.',
      action: 'forbidden',
    };
  }

  if (account.isSystem) {
    return {
      canDelete: false,
      reason: 'سرفصل‌های سیستمی قابل حذف فیزیکی نیستند؛ در صورت عدم نیاز می‌توانید آن را غیرفعال کنید.',
      action: 'deactivate_only',
    };
  }

  if (childrenCount > 0) {
    return {
      canDelete: false,
      reason: `این سرفصل دارای ${childrenCount} زیرمجموعه است. ابتدا باید حساب‌های فرزند حذف یا جابجا شوند.`,
      action: 'forbidden',
    };
  }

  if (isUsedInTransactions) {
    return {
      canDelete: false,
      reason: 'این سرفصل دارای گردش مالی یا سند ثبت‌شده است و فقط امکان غیرفعال‌سازی دارد.',
      action: 'deactivate_only',
    };
  }

  return {
    canDelete: true,
    action: 'delete',
  };
}

/**
 * Validation rules for editing an account:
 * - Root nodes (isSystem=true & level=1): cannot rename, cannot delete, cannot deactivate.
 * - System accounts (isSystem=true): can rename, cannot delete, can deactivate.
 */
export function canEditAccount(account: ChartOfAccountRecord): {
  canEditName: boolean;
  canEditCode: boolean;
  canToggleActive: boolean;
  reason?: string;
} {
  if (account.isSystem && account.level === 1) {
    return {
      canEditName: false,
      canEditCode: false,
      canToggleActive: false,
      reason: 'سرفصل‌های گروه ریشه سیستم غیرقابل تغییر نام، کد یا غیرفعال‌سازی هستند.',
    };
  }

  if (account.isSystem) {
    return {
      canEditName: true,
      canEditCode: false,
      canToggleActive: true,
      reason: 'کد سرفصل‌های سیستمی محافظت‌شده است اما نام و وضعیت آن‌ها قابل ویرایش است.',
    };
  }

  return {
    canEditName: true,
    canEditCode: true,
    canToggleActive: true,
  };
}

/**
 * Calculates the next available 6-digit Level 4 Detail account code for a given parent subsidiary code.
 * E.g., for parentCode '1110', it generates codes like '111001', '111002', etc.
 * Uses gap detection to reuse the smallest available slot if any gap exists.
 */
export function getNextDetailAccountCode(
  parentCode: string,
  existingCodes: string[],
): string {
  const normParent = normalizeAccountCode(parentCode);
  const prefix = normParent;
  const existingDetailNumbers: number[] = [];

  for (const c of existingCodes) {
    const norm = normalizeAccountCode(c);
    if (norm.startsWith(prefix) && norm.length === prefix.length + 2) {
      const subNum = parseInt(norm.slice(prefix.length), 10);
      if (!isNaN(subNum) && subNum > 0) {
        existingDetailNumbers.push(subNum);
      }
    }
  }

  existingDetailNumbers.sort((a, b) => a - b);
  let nextSub = 1;
  for (const num of existingDetailNumbers) {
    if (num === nextSub) {
      nextSub++;
    } else if (num > nextSub) {
      break;
    }
  }

  return `${prefix}${String(nextSub).padStart(2, '0')}`;
}

async function ensureParentCashAndBank(pb: any) {
  let parentRecord: any = null;
  try {
    parentRecord = await pb.collection('chart_of_accounts').getFirstListItem('code = "1110"').catch(() => null);
    if (!parentRecord) {
      let root1000 = await pb.collection('chart_of_accounts').getFirstListItem('code = "1000"').catch(() => null);
      if (!root1000) {
        root1000 = await pb.collection('chart_of_accounts').create({
          code: '1000',
          name: 'دارایی‌ها',
          parentId: null,
          path: '/1000/',
          level: 1,
          accountType: 'asset',
          normalBalance: 'debit',
          isSystem: true,
          isActive: true,
          isPostable: false,
          description: 'مجموع کلیه حقوق مالی و منابع اقتصادی متعلق به کسب‌وکار طلا و جواهر (جاری و غیرجاری)',
        }).catch(() => null);
      }

      let kol1100 = await pb.collection('chart_of_accounts').getFirstListItem('code = "1100"').catch(() => null);
      if (!kol1100) {
        kol1100 = await pb.collection('chart_of_accounts').create({
          code: '1100',
          name: 'دارایی‌های جاری',
          parentId: root1000?.id || null,
          path: '/1000/1100/',
          level: 2,
          accountType: 'asset',
          normalBalance: 'debit',
          isSystem: true,
          isActive: true,
          isPostable: false,
          description: 'وجوه نقد، موجودی طلا و مسکوکات، مطالبات و دارایی‌هایی که ظرف یک سال مالی نقد یا مصرف می‌شوند',
        }).catch(() => null);
      }

      parentRecord = await pb.collection('chart_of_accounts').create({
        code: '1110',
        name: 'موجودی نقد و بانک',
        parentId: kol1100?.id || null,
        path: '/1000/1100/1110/',
        level: 3,
        accountType: 'asset',
        normalBalance: 'debit',
        isMultiCurrency: true,
        isSystem: true,
        isActive: true,
        isPostable: true,
        description: 'سرفصل معین وجوه نقد، صندوق‌ها، تنخواه‌گردان و حساب‌های بانکی ریالی و ارزی',
      }).catch(() => null);
    }
  } catch {
    //
  }
  return parentRecord;
}

/**
 * Ensures a BankAccount is mapped to a dedicated Level 4 Detail account under '1110' (موجودی نقد و بانک).
 */
export async function ensureBankAccountDetailInChart(
  pb: any,
  params: {
    bankName: string;
    branchName?: string;
    accountNumber: string;
    currency?: string;
    existingAccountId?: string | null;
    userId?: string;
  },
): Promise<{ id: string; code: string; name: string; path: string }> {
  if (params.existingAccountId) {
    try {
      const existing = await pb.collection('chart_of_accounts').getOne(params.existingAccountId).catch(() => null);
      if (existing) {
        return {
          id: existing.id,
          code: existing.code,
          name: existing.name,
          path: existing.path || `/1000/1100/1110/${existing.code}/`,
        };
      }
    } catch {
      // fallback
    }
  }

  const parentRecord = await ensureParentCashAndBank(pb);
  const parentId = parentRecord?.id || null;
  const parentPath = parentRecord?.path || '/1000/1100/1110/';

  let existingCodes: string[] = [];
  try {
    const filterStr = parentId ? `parentId = "${parentId}" || code ~ "1110"` : 'code ~ "1110"';
    const records = await pb.collection('chart_of_accounts').getFullList({
      filter: filterStr,
      fields: 'code',
    }).catch(() => []);
    existingCodes = records.map((r: any) => r.code);
  } catch {
    //
  }

  const newCode = getNextDetailAccountCode('1110', existingCodes);
  const accountName = `بانک ${params.bankName}${params.branchName ? ' - ' + params.branchName : ''} (${params.accountNumber})`;
  const description = `حساب بانکی تفصیلی مربوط به ${params.bankName} شماره حساب ${params.accountNumber}`;

  try {
    const created = await pb.collection('chart_of_accounts').create({
      code: newCode,
      name: accountName,
      parentId: parentId,
      path: `${parentPath}${newCode}/`,
      level: 4,
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: false,
      isMultiCurrency: (params.currency || 'IRR') !== 'IRR',
      isSystem: false,
      isActive: true,
      isPostable: true,
      sortOrder: Number(newCode) || 111001,
      description: description,
      createdBy: params.userId || null,
      updatedBy: params.userId || null,
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      path: created.path,
    };
  } catch {
    return {
      id: '',
      code: newCode,
      name: accountName,
      path: `${parentPath}${newCode}/`,
    };
  }
}

/**
 * Ensures a CashFund is mapped to a dedicated Level 4 Detail account under '1110' (موجودی نقد و بانک).
 */
export async function ensureCashFundDetailInChart(
  pb: any,
  params: {
    fundName: string;
    currencyName?: string;
    existingAccountId?: string | null;
    userId?: string;
  },
): Promise<{ id: string; code: string; name: string; path: string }> {
  if (params.existingAccountId) {
    try {
      const existing = await pb.collection('chart_of_accounts').getOne(params.existingAccountId).catch(() => null);
      if (existing) {
        return {
          id: existing.id,
          code: existing.code,
          name: existing.name,
          path: existing.path || `/1000/1100/1110/${existing.code}/`,
        };
      }
    } catch {
      // fallback
    }
  }

  const parentRecord = await ensureParentCashAndBank(pb);
  const parentId = parentRecord?.id || null;
  const parentPath = parentRecord?.path || '/1000/1100/1110/';

  let existingCodes: string[] = [];
  try {
    const filterStr = parentId ? `parentId = "${parentId}" || code ~ "1110"` : 'code ~ "1110"';
    const records = await pb.collection('chart_of_accounts').getFullList({
      filter: filterStr,
      fields: 'code',
    }).catch(() => []);
    existingCodes = records.map((r: any) => r.code);
  } catch {
    //
  }

  const newCode = getNextDetailAccountCode('1110', existingCodes);
  const accountName = params.fundName || `صندوق ${params.currencyName || ''}`.trim();
  const description = `حساب تفصیلی سطح ۴ مربوط به ${accountName}`;

  try {
    const created = await pb.collection('chart_of_accounts').create({
      code: newCode,
      name: accountName,
      parentId: parentId,
      path: `${parentPath}${newCode}/`,
      level: 4,
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: false,
      isMultiCurrency: true,
      isSystem: false,
      isActive: true,
      isPostable: true,
      sortOrder: Number(newCode) || 111001,
      description: description,
      createdBy: params.userId || null,
      updatedBy: params.userId || null,
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      path: created.path,
    };
  } catch {
    return {
      id: '',
      code: newCode,
      name: accountName,
      path: `${parentPath}${newCode}/`,
    };
  }
}

export interface OpeningCheckEnrichmentInput {
  id: string;
  checkNumber?: string | null;
  amount?: number | null;
  dueDateJalali?: string | null;
  recipientName?: string | null;
  bankAccount?: string | null;
  status?: string | null;
  type?: string | null;
  isOpeningBalance?: boolean | null;
  expand?: {
    bankAccount?: {
      id?: string;
      bankName?: string;
      branchName?: string;
      accountNumber?: string;
      accountCodeZero?: string;
    };
  };
}

export interface BankAccountEnrichmentInput {
  id: string;
  bankName: string;
  branchName?: string;
  accountNumber: string;
  accountCodeZero?: string;
  openingBalance?: number;
  balance?: number;
  currencySymbol?: string;
  isBlocked?: boolean;
}

/**
 * Enriches accounts list with issued opening checks connected to Moein account 2110 (اسناد و حساب‌های پرداختنی).
 * - Banks having at least one issued check are added as Level 4 (تفضیل ۱).
 * - Banks with NO issued checks are NOT added.
 * - Under each bank, issued checks are added as Level 5 (تفضیل ۲).
 */
export function enrichAccountsWithOpeningChecks(
  accounts: ChartOfAccountRecord[],
  openingChecks: OpeningCheckEnrichmentInput[],
  bankAccounts: BankAccountEnrichmentInput[] = [],
): ChartOfAccountRecord[] {
  // 1. Find 2110 account (Moein: اسناد و حساب‌های پرداختنی)
  const acc2110 = accounts.find((a) => a.code === '2110' || a.id === 'sys_2110');
  if (!acc2110) {
    return accounts;
  }

  // 2. Filter issued checks
  const validChecks = (openingChecks || []).filter((c) => {
    const isIssued = !c.type || c.type === 'issued';
    const hasBank = Boolean(c.bankAccount || c.expand?.bankAccount?.id);
    return isIssued && hasBank;
  });

  if (validChecks.length === 0) {
    return accounts;
  }

  // 3. Bank accounts map
  const bankMap = new Map<string, BankAccountEnrichmentInput>();
  for (const b of bankAccounts) {
    if (b && b.id) {
      bankMap.set(b.id, b);
    }
  }

  // 4. Group checks by bank ID
  const checksByBank = new Map<string, OpeningCheckEnrichmentInput[]>();
  for (const check of validChecks) {
    const bankId = check.bankAccount || check.expand?.bankAccount?.id;
    if (!bankId) continue;
    if (!checksByBank.has(bankId)) {
      checksByBank.set(bankId, []);
    }
    checksByBank.get(bankId)!.push(check);
  }

  if (checksByBank.size === 0) {
    return accounts;
  }

  const bankNodes: ChartOfAccountRecord[] = [];
  const checkNodes: ChartOfAccountRecord[] = [];

  let bankIndex = 1;
  for (const [bankId, checks] of checksByBank.entries()) {
    const bank = bankMap.get(bankId);
    const bankName = bank?.bankName || checks[0]?.expand?.bankAccount?.bankName || 'بانک نامشخص';
    const branchName = bank?.branchName || checks[0]?.expand?.bankAccount?.branchName || '';
    const accNum = bank?.accountNumber || checks[0]?.expand?.bankAccount?.accountNumber || '';
    const codeSuffix = bank?.accountCodeZero
      ? bank.accountCodeZero.padStart(2, '0')
      : String(bankIndex).padStart(2, '0');

    const bankCode = `${acc2110.code}${codeSuffix}`;
    const bankNodeId = `coa_bank_${bankId}_2110`;
    const bankDisplayName = [
      bankName,
      branchName ? `شعبه ${branchName}` : '',
      accNum ? `(حساب ${accNum})` : '',
    ].filter(Boolean).join(' - ');

    const totalBankAmount = checks.reduce((sum, c) => sum + (c.amount || 0), 0);

    const bankNode: ChartOfAccountRecord = {
      id: bankNodeId,
      code: bankCode,
      name: bankDisplayName,
      parentId: acc2110.id,
      path: `${acc2110.path || '/2000/2100/2110/'}${bankCode}/`,
      level: 4, // تفضیل ۱
      accountType: 'liability',
      normalBalance: 'credit',
      requiresWeight: false,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: false,
      sortOrder: (acc2110.sortOrder || 2110) * 100 + bankIndex,
      description: `تفضیل ۱: چک‌های صادرشده عهده ${bankName} | تعداد: ${checks.length} فقره | جمع: ${totalBankAmount.toLocaleString('fa-IR')} ریال`,
      tags: ['bank_payable', 'tafsil_1', `bank_${bankId}`],
    };
    bankNodes.push(bankNode);

    // Add checks under this bank as Level 5 (تفضیل ۲)
    checks.forEach((check, cIdx) => {
      const checkCodeSuffix = String(cIdx + 1).padStart(2, '0');
      const checkCode = `${bankCode}${checkCodeSuffix}`;
      const checkNodeId = `coa_check_${check.id}`;

      const chkNum = check.checkNumber || 'بدون شماره';
      const dueStr = check.dueDateJalali ? `سررسید: ${check.dueDateJalali}` : '';
      const recStr = check.recipientName ? `در وجه: ${check.recipientName}` : '';
      const parts = [`چک ${chkNum}`, dueStr, recStr].filter(Boolean);

      const checkNode: ChartOfAccountRecord = {
        id: checkNodeId,
        code: checkCode,
        name: parts.join(' - '),
        parentId: bankNode.id,
        path: `${bankNode.path}${checkCode}/`,
        level: 5, // تفضیل ۲
        accountType: 'liability',
        normalBalance: 'credit',
        requiresWeight: false,
        isMultiCurrency: false,
        isSystem: true,
        isActive: true,
        isPostable: true,
        sortOrder: (bankNode.sortOrder || 211000) * 100 + (cIdx + 1),
        description: `تفضیل ۲: چک صادره اول دوره | مبلغ: ${(check.amount || 0).toLocaleString('fa-IR')} ریال | ${recStr || 'گیرنده نامشخص'} | وضعیت: ${check.status || 'صادرشده'}`,
        tags: ['issued_check', 'tafsil_2', `check_${check.id}`],
      };
      checkNodes.push(checkNode);
    });

    bankIndex++;
  }

  // Filter out any existing coa_bank_.*_2110 or coa_check_ nodes
  const cleanAccounts = accounts.filter(
    (a) => !(a.id.startsWith('coa_bank_') && a.id.endsWith('_2110')) && !a.id.startsWith('coa_check_')
  );

  return [...cleanAccounts, ...bankNodes, ...checkNodes];
}

export interface CashFundEnrichmentInput {
  id: string;
  name: string;
  currencyId?: string;
  currencyName?: string;
  currencyCode?: string;
  currencySymbol?: string;
  openingBalance?: number;
  balance?: number;
  isBlocked?: boolean;
}

/**
 * Enriches accounts list with Bank Accounts and Cash Funds connected to Moein account 1110 (موجودی نقد و بانک).
 * - Bank accounts are added as Level 4 (تفضیل ۱) under 1110.
 * - Cash funds are added as Level 4 (تفضیل ۱) under 1110.
 */
export function enrichAccountsWithBankAndCash(
  accounts: ChartOfAccountRecord[],
  bankAccounts: BankAccountEnrichmentInput[] = [],
  cashFunds: CashFundEnrichmentInput[] = []
): ChartOfAccountRecord[] {
  const acc1110 = accounts.find((a) => a.code === '1110' || a.id === 'sys_1110');
  if (!acc1110) {
    return accounts;
  }

  const bankNodes: ChartOfAccountRecord[] = [];
  const cashNodes: ChartOfAccountRecord[] = [];

  // Filter out any existing coa_bank_.*_1110 and coa_cash_.*_1110 nodes
  const cleanAccounts = accounts.filter(
    (a) => !(a.id.startsWith('coa_bank_') && a.id.endsWith('_1110')) && !a.id.startsWith('coa_cash_')
  );

  let bIndex = 1;
  for (const bank of bankAccounts) {
    if (!bank || !bank.id) continue;
    const bankName = bank.bankName || 'بانک نامشخص';
    const branchName = bank.branchName ? ` - شعبه ${bank.branchName}` : '';
    const accNum = bank.accountNumber ? ` (حساب ${bank.accountNumber})` : '';
    const codeSuffix = bank.accountCodeZero
      ? bank.accountCodeZero.padStart(2, '0')
      : String(bIndex).padStart(2, '0');

    const bankCode = `${acc1110.code}${codeSuffix}`;
    const bankNodeId = `coa_bank_${bank.id}_1110`;
    const bankDisplayName = `بانک ${bankName}${branchName}${accNum}`;

    const bankNode: ChartOfAccountRecord = {
      id: bankNodeId,
      code: bankCode,
      name: bankDisplayName,
      parentId: acc1110.id,
      path: `${acc1110.path || '/1000/1100/1110/'}${bankCode}/`,
      level: 4, // تفضیل ۱
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: false,
      isMultiCurrency: false,
      isSystem: true,
      isActive: !bank.isBlocked,
      isPostable: true,
      sortOrder: (acc1110.sortOrder || 1110) * 100 + bIndex,
      description: `تفضیل ۱: حساب بانکی ${bankName} | شماره حساب: ${bank.accountNumber || '—'} | موجودی اولیه: ${(bank.openingBalance || 0).toLocaleString('fa-IR')} ${bank.currencySymbol || 'ریال'}`,
      tags: ['bank_account', 'tafsil_1', `bank_${bank.id}`],
    };
    bankNodes.push(bankNode);
    bIndex++;
  }

  let cIndex = 1;
  for (const fund of cashFunds) {
    if (!fund || !fund.id) continue;
    const fundName = fund.name || 'صندوق نامشخص';
    const currency = fund.currencyName || fund.currencyCode || 'ریال';
    const codeSuffix = String(50 + cIndex).padStart(2, '0');

    const cashCode = `${acc1110.code}${codeSuffix}`;
    const cashNodeId = `coa_cash_${fund.id}_1110`;
    const cashDisplayName = `صندوق ${fundName} (${currency})`;

    const cashNode: ChartOfAccountRecord = {
      id: cashNodeId,
      code: cashCode,
      name: cashDisplayName,
      parentId: acc1110.id,
      path: `${acc1110.path || '/1000/1100/1110/'}${cashCode}/`,
      level: 4, // تفضیل ۱
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: false,
      isMultiCurrency: true,
      isSystem: true,
      isActive: !fund.isBlocked,
      isPostable: true,
      sortOrder: (acc1110.sortOrder || 1110) * 100 + 50 + cIndex,
      description: `تفضیل ۱: صندوق وجه نقد ${fundName} | ارز: ${currency} | موجودی اولیه: ${(fund.openingBalance || 0).toLocaleString('fa-IR')} ${fund.currencySymbol || currency}`,
      tags: ['cash_fund', 'tafsil_1', `fund_${fund.id}`],
    };
    cashNodes.push(cashNode);
    cIndex++;
  }

  return [...cleanAccounts, ...bankNodes, ...cashNodes];
}

export interface CoinInventoryEnrichmentInput {
  id: string;
  nature?: 'coin' | 'bullion' | string;
  coin_type?: string;
  itemName?: string;
  quantity?: number;
  weight?: number;
  purity?: number;
  unit_price?: number;
  total_price?: number;
  is_opening_balance?: boolean;
}

export interface MetalInventoryEnrichmentInput {
  id: string;
  metal?: 'gold' | 'silver' | 'platinum' | string;
  inventoryType?: 'conditional_melted' | 'miscellaneous_melted' | 'general_metal' | string;
  rawWeight?: number;
  raw_weight?: number;
  purity?: number;
  convertedWeight?: number;
  converted_weight?: number;
  stampNumber?: string;
  stamp_number?: string;
  labName?: string;
  lab_name?: string;
  totalAmount?: number;
  total_amount?: number;
  is_opening_balance?: boolean;
}

/**
 * Enriches accounts list with Coins, Bullion, and Metals connected to Moein account 1130 (موجودی کالا و طلا).
 * - Level 4 (تفضیل ۱):
 *   - 113001: مسکوکات و شمش
 *   - 113010: موجودی طلا (Au)
 *   - 113020: موجودی نقره (Ag)
 *   - 113030: موجودی پلاتین (Pt)
 * - Level 5 (تفضیل ۲):
 *   - Individual coin/bullion items under 113001
 *   - Individual metal items under 113010, 113020, 113030
 */
export function enrichAccountsWithCoinsAndMetals(
  accounts: ChartOfAccountRecord[],
  coinItems: CoinInventoryEnrichmentInput[] = [],
  metalItems: MetalInventoryEnrichmentInput[] = []
): ChartOfAccountRecord[] {
  const acc1130 = accounts.find((a) => a.code === '1130' || a.id === 'sys_1130');
  if (!acc1130) {
    return accounts;
  }

  const groupNodes: ChartOfAccountRecord[] = [];
  const itemNodes: ChartOfAccountRecord[] = [];

  // Filter out any existing coa_group_coins_, coa_coin_, coa_group_gold_, coa_group_silver_, coa_group_platinum_, coa_metal_
  const cleanAccounts = accounts.filter(
    (a) =>
      !a.id.startsWith('coa_group_coins_') &&
      !a.id.startsWith('coa_coin_') &&
      !a.id.startsWith('coa_group_gold_') &&
      !a.id.startsWith('coa_group_silver_') &&
      !a.id.startsWith('coa_group_platinum_') &&
      !a.id.startsWith('coa_metal_')
  );

  // 1. Coins & Bullion
  const validCoins = coinItems || [];
  if (validCoins.length > 0) {
    const coinGroupCode = `${acc1130.code}01`; // 113001
    const coinGroupId = 'coa_group_coins_1130';
    const totalCoinQty = validCoins.reduce((sum, c) => sum + (c.quantity || 0), 0);
    const totalCoinWeight = validCoins.reduce((sum, c) => sum + (c.weight || 0), 0);

    const coinGroupNode: ChartOfAccountRecord = {
      id: coinGroupId,
      code: coinGroupCode,
      name: 'مسکوکات و شمش',
      parentId: acc1130.id,
      path: `${acc1130.path || '/1000/1100/1130/'}${coinGroupCode}/`,
      level: 4, // تفضیل ۱
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: true,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: false,
      sortOrder: (acc1130.sortOrder || 1130) * 100 + 1,
      description: `تفضیل ۱: مسکوکات و شمش | اقلام: ${validCoins.length} ردیف | تعداد کل: ${totalCoinQty.toLocaleString('fa-IR')} عدد | وزن کل: ${totalCoinWeight.toLocaleString('fa-IR')} گرم`,
      tags: ['coins_and_bullion', 'tafsil_1'],
    };
    groupNodes.push(coinGroupNode);

    validCoins.forEach((coin, idx) => {
      const coinSuffix = String(idx + 1).padStart(2, '0');
      const itemCode = `${coinGroupCode}${coinSuffix}`;
      const itemId = `coa_coin_${coin.id}`;
      const natureLabel = coin.nature === 'bullion' ? 'شمش' : 'سکه';
      const typeLabel = coin.coin_type || coin.itemName || natureLabel;
      const qtyStr = coin.quantity ? `${coin.quantity.toLocaleString('fa-IR')} عدد` : '';
      const wtStr = coin.weight ? `${coin.weight.toLocaleString('fa-IR')} گرم` : '';
      const details = [qtyStr, wtStr].filter(Boolean).join(' - ');

      const itemNode: ChartOfAccountRecord = {
        id: itemId,
        code: itemCode,
        name: `${natureLabel} ${typeLabel}${details ? ` (${details})` : ''}`,
        parentId: coinGroupNode.id,
        path: `${coinGroupNode.path}${itemCode}/`,
        level: 5, // تفضیل ۲
        accountType: 'asset',
        normalBalance: 'debit',
        requiresWeight: true,
        isMultiCurrency: false,
        isSystem: true,
        isActive: true,
        isPostable: true,
        sortOrder: (coinGroupNode.sortOrder || 113001) * 100 + (idx + 1),
        description: `تفضیل ۲: موجودی اول دوره ${natureLabel} ${typeLabel} | تعداد: ${(coin.quantity || 0).toLocaleString('fa-IR')} | وزن: ${(coin.weight || 0).toLocaleString('fa-IR')} گرم | عیار: ${coin.purity || '—'}`,
        tags: ['coin_inventory', 'tafsil_2', `coin_${coin.id}`],
      };
      itemNodes.push(itemNode);
    });
  }

  // 2. Metals (Gold, Silver, Platinum)
  const validMetals = metalItems || [];
  const metalsConfig: Array<{
    metal: 'gold' | 'silver' | 'platinum';
    suffix: string;
    id: string;
    name: string;
    symbol: string;
  }> = [
    { metal: 'gold', suffix: '10', id: 'coa_group_gold_1130', name: 'موجودی طلا (Au)', symbol: 'Au' },
    { metal: 'silver', suffix: '20', id: 'coa_group_silver_1130', name: 'موجودی نقره (Ag)', symbol: 'Ag' },
    { metal: 'platinum', suffix: '30', id: 'coa_group_platinum_1130', name: 'موجودی پلاتین (Pt)', symbol: 'Pt' },
  ];

  const inventoryTypeLabels: Record<string, string> = {
    conditional_melted: 'آبشده شرطی',
    miscellaneous_melted: 'آبشده متفرقه',
    general_metal: 'موجودی پایه فلز',
  };

  for (const cfg of metalsConfig) {
    const itemsForMetal = validMetals.filter((m) => (m.metal || 'gold').toLowerCase() === cfg.metal);
    if (itemsForMetal.length === 0) continue;

    const groupCode = `${acc1130.code}${cfg.suffix}`; // 113010, 113020, 113030
    const totalRaw = itemsForMetal.reduce((sum, m) => sum + (m.rawWeight ?? m.raw_weight ?? 0), 0);
    const totalConv = itemsForMetal.reduce((sum, m) => sum + (m.convertedWeight ?? m.converted_weight ?? 0), 0);

    const metalGroupNode: ChartOfAccountRecord = {
      id: cfg.id,
      code: groupCode,
      name: cfg.name,
      parentId: acc1130.id,
      path: `${acc1130.path || '/1000/1100/1130/'}${groupCode}/`,
      level: 4, // تفضیل ۱
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: true,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: false,
      sortOrder: (acc1130.sortOrder || 1130) * 100 + Number(cfg.suffix),
      description: `تفضیل ۱: ${cfg.name} | تعداد اقلام: ${itemsForMetal.length} ردیف | جمع وزن خام: ${totalRaw.toLocaleString('fa-IR')} گرم | وزن معادل استاندارد: ${totalConv.toLocaleString('fa-IR')} گرم`,
      tags: [`metal_${cfg.metal}`, 'tafsil_1'],
    };
    groupNodes.push(metalGroupNode);

    itemsForMetal.forEach((m, idx) => {
      const itemSuffix = String(idx + 1).padStart(2, '0');
      const itemCode = `${groupCode}${itemSuffix}`;
      const itemId = `coa_metal_${m.id}`;
      const invType = m.inventoryType || 'general_metal';
      const invLabel = inventoryTypeLabels[invType] || invType;
      const stamp = m.stampNumber || m.stamp_number;
      const lab = m.labName || m.lab_name;
      const rawW = m.rawWeight ?? m.raw_weight ?? 0;
      const convW = m.convertedWeight ?? m.converted_weight ?? 0;

      const stampPart = stamp ? `(انگ: ${stamp})` : '';
      const labPart = lab ? `[${lab}]` : '';
      const weightPart = `${rawW.toLocaleString('fa-IR')} گرم`;
      const nameParts = [invLabel, stampPart, labPart, weightPart].filter(Boolean);

      const itemNode: ChartOfAccountRecord = {
        id: itemId,
        code: itemCode,
        name: nameParts.join(' '),
        parentId: metalGroupNode.id,
        path: `${metalGroupNode.path}${itemCode}/`,
        level: 5, // تفضیل ۲
        accountType: 'asset',
        normalBalance: 'debit',
        requiresWeight: true,
        isMultiCurrency: false,
        isSystem: true,
        isActive: true,
        isPostable: true,
        sortOrder: (metalGroupNode.sortOrder || Number(groupCode)) * 100 + (idx + 1),
        description: `تفضیل ۲: موجودی اول دوره ${cfg.name} | ${invLabel} | وزن خام: ${rawW.toLocaleString('fa-IR')} گرم | عیار: ${m.purity || '—'} | وزن معادل: ${convW.toLocaleString('fa-IR')} گرم`,
        tags: [`metal_${cfg.metal}`, 'tafsil_2', `metal_${m.id}`],
      };
      itemNodes.push(itemNode);
    });
  }

  return [...cleanAccounts, ...groupNodes, ...itemNodes];
}

export interface GoodsInventoryEnrichmentInput {
  id: string;
  goodsTypeId?: string;
  goods_type_id?: string;
  goodsName?: string;
  goods_name?: string;
  itemName?: string;
  item_name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  unit_price?: number;
  totalAmount?: number;
  total_amount?: number;
}

/**
 * Enriches Chart of Accounts with Goods Inventory under 1130 (موجودی کالا و طلا).
 * - Creates Tafsil 1 group nodes (113040 resin, 113050 gemstones, 113060 workshop, 113070 packaging, 113080 other goods).
 * - Creates Tafsil 2 item nodes under their corresponding category group.
 */
export function enrichAccountsWithGoods(
  accounts: ChartOfAccountRecord[],
  goodsItems: GoodsInventoryEnrichmentInput[] = []
): ChartOfAccountRecord[] {
  const acc1130 = accounts.find((a) => a.code === '1130' || a.id === 'sys_1130');
  if (!acc1130) {
    return accounts;
  }

  const cleanAccounts = accounts.filter(
    (a) => !a.id.startsWith('coa_group_goods_') && !a.id.startsWith('coa_goods_')
  );

  const validGoods = goodsItems || [];
  if (validGoods.length === 0) {
    return cleanAccounts;
  }

  const categoriesConfig: Array<{
    key: string;
    suffix: string;
    id: string;
    name: string;
  }> = [
    { key: 'resin_casting', suffix: '40', id: 'coa_group_goods_resin', name: 'موجودی مواد اولیه و رزین ریخته‌گری' },
    { key: 'gemstones', suffix: '50', id: 'coa_group_goods_gemstones', name: 'موجودی سنگ‌های قیمتی و نیمه‌قیمتی' },
    { key: 'workshop_tools', suffix: '60', id: 'coa_group_goods_workshop', name: 'موجودی ملزومات مصرفی و پرداختکاری' },
    { key: 'packaging', suffix: '70', id: 'coa_group_goods_packaging', name: 'موجودی جعبه و ملزومات بسته‌بندی' },
    { key: 'general_goods', suffix: '80', id: 'coa_group_goods_general', name: 'سایر کالاها و ملزومات مصرفی' },
  ];

  const groupNodes: ChartOfAccountRecord[] = [];
  const itemNodes: ChartOfAccountRecord[] = [];

  for (const cfg of categoriesConfig) {
    const itemsForCategory = validGoods.filter((g) => {
      const cat = g.category || 'general_goods';
      return cat === cfg.key;
    });

    if (itemsForCategory.length === 0) continue;

    const groupCode = `${acc1130.code}${cfg.suffix}`; // e.g. 113040
    const totalValuation = itemsForCategory.reduce((sum, g) => sum + (Number(g.totalAmount ?? g.total_amount) || 0), 0);

    const categoryGroupNode: ChartOfAccountRecord = {
      id: cfg.id,
      code: groupCode,
      name: cfg.name,
      parentId: acc1130.id,
      path: `${acc1130.path || '/1000/1100/1130/'}${groupCode}/`,
      level: 4, // تفضیل ۱
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: false,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: false,
      sortOrder: (acc1130.sortOrder || 1130) * 100 + Number(cfg.suffix),
      description: `تفضیل ۱: ${cfg.name} | اقلام: ${itemsForCategory.length} ردیف | ارزش ریالی: ${totalValuation.toLocaleString('fa-IR')} ریال`,
      tags: [`goods_${cfg.key}`, 'tafsil_1'],
    };
    groupNodes.push(categoryGroupNode);

    itemsForCategory.forEach((g, idx) => {
      const itemSuffix = String(idx + 1).padStart(2, '0');
      const itemCode = `${groupCode}${itemSuffix}`;
      const itemId = `coa_goods_${g.id}`;
      const name = g.goodsName || g.goods_name || g.itemName || g.item_name || 'کالای بدون نام';
      const qty = Number(g.quantity) || 0;
      const unit = g.unit || 'عدد';
      const amount = Number(g.totalAmount ?? g.total_amount) || 0;

      const itemNode: ChartOfAccountRecord = {
        id: itemId,
        code: itemCode,
        name: `${name} (${qty.toLocaleString('fa-IR')} ${unit})`,
        parentId: categoryGroupNode.id,
        path: `${categoryGroupNode.path}${itemCode}/`,
        level: 5, // تفضیل ۲
        accountType: 'asset',
        normalBalance: 'debit',
        requiresWeight: false,
        isMultiCurrency: false,
        isSystem: true,
        isActive: true,
        isPostable: true,
        sortOrder: (categoryGroupNode.sortOrder || Number(groupCode)) * 100 + (idx + 1),
        description: `تفضیل ۲: موجودی اول دوره ${name} | مقدار: ${qty.toLocaleString('fa-IR')} ${unit} | ارزش کل: ${amount.toLocaleString('fa-IR')} ریال`,
        tags: [`goods_${cfg.key}`, 'tafsil_2', `goods_${g.id}`],
      };
      itemNodes.push(itemNode);
    });
  }

  return [...cleanAccounts, ...groupNodes, ...itemNodes];
}

export interface GemstoneInventoryEnrichmentInput {
  id: string;
  inventoryCode?: string;
  inventory_code?: string;
  category?: string;
  species?: string;
  variety?: string;
  itemName?: string;
  tradeName?: string;
  trade_name?: string;
  inventoryMode?: string;
  inventory_mode?: string;
  materialOrigin?: string;
  material_origin?: string;
  quantity?: number;
  weightCt?: number;
  weight_ct?: number;
  weightG?: number;
  weight_g?: number;
  shape?: string;
  diamondColorGrade?: string;
  diamond_color_grade?: string;
  diamondClarityGrade?: string;
  diamond_clarity_grade?: string;
  cutGrade?: string;
  cut_grade?: string;
  primaryHue?: string;
  primary_hue?: string;
  treatmentStatus?: string;
  treatment_status?: string;
  hasCertificate?: boolean;
  has_certificate?: boolean;
  certificateLab?: string;
  certificate_lab?: string;
  reportNumber?: string;
  report_number?: string;
  certificateReportNumber?: string;
  certificate_report_number?: string;
  totalAmount?: number;
  total_amount?: number;
}

/**
 * Enriches Chart of Accounts with Professional Gemstone Inventory under 1130 (موجودی کالا و طلا).
 * - Creates Tafsil 1 group node (113050 موجودی سنگ‌های قیمتی، رنگی و الماس).
 * - Creates Tafsil 2 item nodes under 113050 for each gemstone/parcel with full gemological attributes.
 */
export function enrichAccountsWithGemstones(
  accounts: ChartOfAccountRecord[],
  gemstoneItems: GemstoneInventoryEnrichmentInput[] = []
): ChartOfAccountRecord[] {
  const acc1130 = accounts.find((a) => a.code === '1130' || a.id === 'sys_1130');
  if (!acc1130) {
    return accounts;
  }

  const cleanAccounts = accounts.filter(
    (a) => !a.id.startsWith('coa_group_gemstone_') && !a.id.startsWith('coa_gemstone_')
  );

  const validGems = gemstoneItems || [];
  if (validGems.length === 0) {
    return cleanAccounts;
  }

  const groupCode = `${acc1130.code}50`; // 113050
  const groupId = 'coa_group_gemstone_1130';
  const totalQty = validGems.reduce((sum, g) => sum + (Number(g.quantity) || 1), 0);
  const totalWeightCt = validGems.reduce((sum, g) => sum + (Number(g.weightCt ?? g.weight_ct) || 0), 0);
  const totalValuation = validGems.reduce((sum, g) => sum + (Number(g.totalAmount ?? g.total_amount) || 0), 0);

  // Check if 113050 already exists in cleanAccounts (from coa_group_goods_gemstones or base)
  const existing113050Idx = cleanAccounts.findIndex((a) => a.code === groupCode);
  const groupNode: ChartOfAccountRecord = {
    id: groupId,
    code: groupCode,
    name: 'موجودی سنگ‌های قیمتی، رنگی و الماس',
    parentId: acc1130.id,
    path: `${acc1130.path || '/1000/1100/1130/'}${groupCode}/`,
    level: 4, // تفضیل ۱
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: (acc1130.sortOrder || 1130) * 100 + 50,
    description: `تفضیل ۱: موجودی سنگ‌های قیمتی و الماس | اقلام: ${validGems.length} ردیف (${totalQty.toLocaleString('fa-IR')} قطعه) | وزن کل: ${totalWeightCt.toLocaleString('fa-IR')} قیراط | ارزش: ${totalValuation.toLocaleString('fa-IR')} ریال`,
    tags: ['gemstone_inventory', 'tafsil_1'],
  };

  if (existing113050Idx !== -1) {
    cleanAccounts[existing113050Idx] = groupNode;
  } else {
    cleanAccounts.push(groupNode);
  }

  const itemNodes: ChartOfAccountRecord[] = validGems.map((g, idx) => {
    const itemSuffix = String(idx + 1).padStart(2, '0');
    const itemCode = `${groupCode}${itemSuffix}`;
    const itemId = `coa_gemstone_${g.id}`;
    const invCode = g.inventoryCode || g.inventory_code || `GEM-${idx + 1}`;
    const category = g.category || 'colored_gemstone';
    const stoneName = g.variety || g.species || (category === 'diamond' ? 'الماس' : 'سنگ رنگی');
    const ct = Number(g.weightCt ?? g.weight_ct) || 0;
    const qty = Number(g.quantity) || 1;
    const mode = g.inventoryMode || g.inventory_mode || (qty > 1 ? 'parcel' : 'single');
    const shape = g.shape ? ` (${g.shape})` : '';
    const certLab = g.certificateLab || g.certificate_lab;
    const reportNum = g.reportNumber || g.report_number;
    const certStr = (g.hasCertificate || g.has_certificate) && reportNum ? ` [${certLab || 'Cert'}: ${reportNum}]` : '';
    const amount = Number(g.totalAmount ?? g.total_amount) || 0;

    const modeLabel = mode === 'parcel' ? `پارسل ${qty.toLocaleString('fa-IR')} عددی` : 'تک‌سنگ';

    return {
      id: itemId,
      code: itemCode,
      name: `${stoneName}${shape} ${invCode} - ${ct.toLocaleString('fa-IR')} ct${certStr}`,
      parentId: groupNode.id,
      path: `${groupNode.path}${itemCode}/`,
      level: 5, // تفضیل ۲
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: true,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: true,
      sortOrder: (groupNode.sortOrder || Number(groupCode)) * 100 + (idx + 1),
      description: `تفضیل ۲: موجودی اول دوره ${stoneName} | ${modeLabel} | وزن: ${ct.toLocaleString('fa-IR')} قیراط${certStr} | ارزش: ${amount.toLocaleString('fa-IR')} ریال`,
      tags: [`gemstone_${category}`, 'tafsil_2', `gem_${g.id}`],
    };
  });

  return [...cleanAccounts, ...itemNodes];
}

export interface WorkmanshipInventoryEnrichmentInput {
  id: string;
  code?: string;
  name?: string;
  metal?: string;
  quantity?: number;
  rawWeight?: number;
  raw_weight?: number;
  purity?: number;
  convertedWeight?: number;
  converted_weight?: number;
  wage?: number;
  wageMode?: string;
  wage_mode?: string;
  totalWage?: number;
  total_wage?: number;
  totalAmount?: number;
  total_amount?: number;
}

/**
 * Enriches Chart of Accounts with Manufactured Jewelry (Workmanship / کارساخته) under 1130.
 * - Creates Tafsil 1 group node (113060 موجودی کارساخته و مصنوعات طلا و جواهر).
 * - Creates Tafsil 2 item nodes under 113060 for each manufactured jewelry piece.
 */
export function enrichAccountsWithWorkmanship(
  accounts: ChartOfAccountRecord[],
  workmanshipItems: WorkmanshipInventoryEnrichmentInput[] = []
): ChartOfAccountRecord[] {
  const acc1130 = accounts.find((a) => a.code === '1130' || a.id === 'sys_1130');
  if (!acc1130) {
    return accounts;
  }

  const cleanAccounts = accounts.filter(
    (a) => !a.id.startsWith('coa_group_workmanship_') && !a.id.startsWith('coa_workmanship_')
  );

  const validItems = workmanshipItems || [];
  if (validItems.length === 0) {
    return cleanAccounts;
  }

  const groupCode = `${acc1130.code}60`; // 113060
  const groupId = 'coa_group_workmanship_1130';
  const totalPieces = validItems.reduce((sum, w) => sum + (Number(w.quantity) || 1), 0);
  const totalRawWeight = validItems.reduce((sum, w) => sum + (Number(w.rawWeight ?? w.raw_weight) || 0), 0);
  const totalConverted = validItems.reduce((sum, w) => sum + (Number(w.convertedWeight ?? w.converted_weight) || 0), 0);
  const totalValuation = validItems.reduce((sum, w) => sum + (Number(w.totalAmount ?? w.total_amount) || 0), 0);

  const existingIdx = cleanAccounts.findIndex((a) => a.code === groupCode);
  const groupNode: ChartOfAccountRecord = {
    id: groupId,
    code: groupCode,
    name: 'موجودی کارساخته (مصنوعات طلا و جواهر)',
    parentId: acc1130.id,
    path: `${acc1130.path || '/1000/1100/1130/'}${groupCode}/`,
    level: 4, // تفضیل ۱
    accountType: 'asset',
    normalBalance: 'debit',
    requiresWeight: true,
    isMultiCurrency: false,
    isSystem: true,
    isActive: true,
    isPostable: false,
    sortOrder: (acc1130.sortOrder || 1130) * 100 + 60,
    description: `تفضیل ۱: موجودی کارساخته و مصنوعات طلا | اقلام: ${validItems.length} ردیف (${totalPieces.toLocaleString('fa-IR')} قطعه) | وزن خام: ${totalRawWeight.toLocaleString('fa-IR')} گرم | معادل: ${totalConverted.toLocaleString('fa-IR')} گرم | ارزش: ${totalValuation.toLocaleString('fa-IR')} ریال`,
    tags: ['workmanship_inventory', 'tafsil_1'],
  };

  if (existingIdx !== -1) {
    cleanAccounts[existingIdx] = groupNode;
  } else {
    cleanAccounts.push(groupNode);
  }

  const itemNodes: ChartOfAccountRecord[] = validItems.map((w, idx) => {
    const itemSuffix = String(idx + 1).padStart(2, '0');
    const itemCode = `${groupCode}${itemSuffix}`;
    const itemId = `coa_workmanship_${w.id}`;
    const codeStr = w.code ? `[${w.code}] ` : '';
    const nameStr = w.name || 'مصنوع بدون نام';
    const rawW = Number(w.rawWeight ?? w.raw_weight) || 0;
    const convW = Number(w.convertedWeight ?? w.converted_weight) || 0;
    const qty = Number(w.quantity) || 1;
    const totalAmt = Number(w.totalAmount ?? w.total_amount) || 0;

    return {
      id: itemId,
      code: itemCode,
      name: `${codeStr}${nameStr} (${qty.toLocaleString('fa-IR')} عدد - ${rawW.toLocaleString('fa-IR')} گرم)`,
      parentId: groupNode.id,
      path: `${groupNode.path}${itemCode}/`,
      level: 5, // تفضیل ۲
      accountType: 'asset',
      normalBalance: 'debit',
      requiresWeight: true,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: true,
      sortOrder: (groupNode.sortOrder || Number(groupCode)) * 100 + (idx + 1),
      description: `تفضیل ۲: موجودی اول دوره ${nameStr} | تعداد: ${qty.toLocaleString('fa-IR')} عدد | وزن خام: ${rawW.toLocaleString('fa-IR')} گرم | معادل: ${convW.toLocaleString('fa-IR')} گرم | ارزش: ${totalAmt.toLocaleString('fa-IR')} ریال`,
      tags: ['workmanship_inventory', 'tafsil_2', `wrk_${w.id}`],
    };
  });

  return [...cleanAccounts, ...itemNodes];
}



