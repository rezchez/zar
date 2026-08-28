export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'cost_of_sales'
  | 'expense'
  | 'memorandum';

export type NormalBalance = 'debit' | 'credit' | 'dual';

export type AccountLevel = 1 | 2 | 3 | 4;

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
  4: 'سطح ۴ - تفصیلی',
};

export const LEVEL_SHORT_LABELS: Record<AccountLevel, string> = {
  1: 'گروه',
  2: 'کل',
  3: 'معین',
  4: 'تفصیلی',
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
    description: 'گروه دارایی‌های جاری و غیرجاری موسسه',
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
    description: 'کل دارایی‌های جاری قابل تبدیل به نقد ظرف یک سال مالی',
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
    description: 'صندوق‌ها، حساب‌های بانکی ریالی و ارزی',
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
    description: 'چک‌ها و مطالبات تجاری و غیرتجاری',
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
    description: 'موجودی طلای خام، آبشده، سکه و مصنوعات طلا و نقره',
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
    description: 'پیش‌پرداخت خرید طلا، اجاره و خدمات',
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
    description: 'تجهیزات طلاسازی، گاوصندوق، ویترین، اثاثه و وسایط نقلیه',
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
    description: 'سرقفلی، نرم‌افزارها و علائم تجاری',
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
    description: 'چک‌های صادره پرداختی و بستانکاران تجاری',
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
    description: 'بدهی‌های وزنی و ریالی به بنکداران، آبکاران، مخراجکاران و مشتریان',
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
    description: 'ارزش افزوده اجرت و سود، مالیات عملکرد و تکلیفی',
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
    description: 'سرمایه اولیه و ثبت‌شده موسسه',
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
    description: 'برداشت‌ها و واریزی‌های موقت شرکا و مالکین',
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
    description: 'درآمد حاصل از فروش طلای خام و آبشده',
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
    description: 'فروش مصنوعات و جواهرات ساخته‌شده',
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
    description: 'سکه، جعبه، متعلقات و سایر اقلام',
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
    description: 'اجرت طراحی، عیارسنجی، ری‌گیری و حکاکی',
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
    description: 'کسری ذوب، کسری عیار، اجرت ریختگری و نگین',
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
    description: 'اجاره محل فروشگاه یا کارگاه طلاسازی',
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
    isPostable: true,
    sortOrder: 6200,
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
    description: 'کارمزد تراکنش‌های کارتخوان، انتقال ساتنا، پایا و سود تسهیلات',
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
    description: 'چک‌ها و سفته‌های ضمانتی دریافتی از مشتریان و همکاران',
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
    description: 'اسناد و چک‌های ضمانتی تحویل‌شده به دیگران',
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
