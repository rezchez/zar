export type PermissionCategory =
  | 'users'
  | 'customers'
  | 'transactions'
  | 'documents'
  | 'cash'
  | 'banks'
  | 'reports'
  | 'settings';

export type DangerLevel = 'normal' | 'sensitive' | 'critical';

export interface PermissionDefinition {
  key: string;
  name: string;
  description: string;
  category: PermissionCategory;
  categoryLabel: string;
  dangerLevel: DangerLevel;
}

export const CATEGORY_LABELS: Record<PermissionCategory, string> = {
  users: 'مدیریت کاربران',
  customers: 'مدیریت مشتریان',
  transactions: 'مدیریت تراکنش‌ها',
  documents: 'مدیریت اسناد',
  cash: 'مدیریت صندوق',
  banks: 'حساب‌های بانکی',
  reports: 'گزارش‌ها',
  settings: 'تنظیمات سیستم',
};

export const PERMISSIONS_REGISTRY: PermissionDefinition[] = [
  // کاربران
  {
    key: 'user.view',
    name: 'مشاهده کاربران',
    description: 'امکان مشاهده فهرست کاربران سیستم',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'normal',
  },
  {
    key: 'user.create',
    name: 'ایجاد کاربر جدید',
    description: 'امکان ثبت حساب کاربری جدید در سیستم',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'sensitive',
  },
  {
    key: 'user.edit',
    name: 'ویرایش کاربر',
    description: 'امکان ویرایش مشخصات کاربران سیستم',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'sensitive',
  },
  {
    key: 'user.delete',
    name: 'حذف/مسدودی کاربر',
    description: 'امکان مسدودسازی یا غیرفعال‌سازی کاربران',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'sensitive',
  },
  {
    key: 'user.manage',
    name: 'مدیریت کلی کاربران',
    description: 'دسترسی کامل به بخش مدیریت کاربران',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'sensitive',
  },
  {
    key: 'user.role.change',
    name: 'تغییر نقش کاربر',
    description: 'امکان تغییر نقش کاربران بین کاربر عادی، مدیر و مدیر ارشد',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'critical',
  },
  {
    key: 'user.permission.view',
    name: 'مشاهده دسترسی کاربران',
    description: 'امکان مشاهده سطح دسترسی‌ها و مجوزهای اختصاصی کاربران',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'normal',
  },
  {
    key: 'user.permission.grant',
    name: 'اعطای دسترسی به کاربر',
    description: 'امکان اضافه کردن مجوز اختصاصی به کاربران',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'critical',
  },
  {
    key: 'user.permission.revoke',
    name: 'لغو دسترسی کاربر',
    description: 'امکان مسدودسازی یا لغو مجوز اختصاصی از کاربران',
    category: 'users',
    categoryLabel: CATEGORY_LABELS.users,
    dangerLevel: 'critical',
  },

  // مشتریان
  {
    key: 'customer.view',
    name: 'مشاهده مشتریان',
    description: 'امکان مشاهده لیست و اطلاعات طرف‌حساب‌ها',
    category: 'customers',
    categoryLabel: CATEGORY_LABELS.customers,
    dangerLevel: 'normal',
  },
  {
    key: 'customer.create',
    name: 'ایجاد مشتری جدید',
    description: 'امکان ثبت طرف‌حساب جدید',
    category: 'customers',
    categoryLabel: CATEGORY_LABELS.customers,
    dangerLevel: 'normal',
  },
  {
    key: 'customer.edit',
    name: 'ویرایش مشتری',
    description: 'امکان تغییر اطلاعات مشتریان و مانده اول دوره',
    category: 'customers',
    categoryLabel: CATEGORY_LABELS.customers,
    dangerLevel: 'sensitive',
  },
  {
    key: 'customer.delete',
    name: 'حذف مشتری',
    description: 'امکان حذف یا بایگانی حساب مشتری',
    category: 'customers',
    categoryLabel: CATEGORY_LABELS.customers,
    dangerLevel: 'sensitive',
  },
  {
    key: 'customer.manage',
    name: 'مدیریت کلی مشتریان',
    description: 'دسترسی کامل مدیریت مشتریان و گزارش دفتر حساب',
    category: 'customers',
    categoryLabel: CATEGORY_LABELS.customers,
    dangerLevel: 'normal',
  },

  // تراکنش‌ها
  {
    key: 'transaction.view',
    name: 'مشاهده تراکنش‌ها',
    description: 'امکان مشاهده دفتر تراکنش‌ها و گردش حساب‌ها',
    category: 'transactions',
    categoryLabel: CATEGORY_LABELS.transactions,
    dangerLevel: 'normal',
  },
  {
    key: 'transaction.create',
    name: 'ثبت تراکنش',
    description: 'امکان ثبت تراکنش جدید در سیستم',
    category: 'transactions',
    categoryLabel: CATEGORY_LABELS.transactions,
    dangerLevel: 'normal',
  },
  {
    key: 'transaction.edit',
    name: 'ویرایش تراکنش',
    description: 'امکان ویرایش تراکنش‌های ثبت‌شده',
    category: 'transactions',
    categoryLabel: CATEGORY_LABELS.transactions,
    dangerLevel: 'sensitive',
  },
  {
    key: 'transaction.delete',
    name: 'حذف/ابطال تراکنش',
    description: 'امکان حذف یا ابطال تراکنش‌های مالی و طلایی',
    category: 'transactions',
    categoryLabel: CATEGORY_LABELS.transactions,
    dangerLevel: 'critical',
  },
  {
    key: 'transaction.manage',
    name: 'مدیریت کلی تراکنش‌ها',
    description: 'دسترسی کامل به دفتر تراکنش‌ها و تسویه‌ها',
    category: 'transactions',
    categoryLabel: CATEGORY_LABELS.transactions,
    dangerLevel: 'normal',
  },

  // اسناد
  {
    key: 'document.view',
    name: 'مشاهده اسناد',
    description: 'امکان مشاهده فاکتورها و اسناد ثبت‌شده',
    category: 'documents',
    categoryLabel: CATEGORY_LABELS.documents,
    dangerLevel: 'normal',
  },
  {
    key: 'document.create',
    name: 'ثبت سند/فاکتور جدید',
    description: 'امکان صدور و ثبت سند یا فاکتور جدید',
    category: 'documents',
    categoryLabel: CATEGORY_LABELS.documents,
    dangerLevel: 'normal',
  },
  {
    key: 'document.edit',
    name: 'ویرایش سند',
    description: 'امکان ویرایش ردیف‌ها و اطلاعات اسناد',
    category: 'documents',
    categoryLabel: CATEGORY_LABELS.documents,
    dangerLevel: 'sensitive',
  },
  {
    key: 'document.delete',
    name: 'حذف/ابطال سند',
    description: 'امکان حذف یا ابطال کامل سند/فاکتور',
    category: 'documents',
    categoryLabel: CATEGORY_LABELS.documents,
    dangerLevel: 'critical',
  },
  {
    key: 'document.manage',
    name: 'مدیریت اسناد',
    description: 'مدیریت کامل اسناد موقت و قطعی',
    category: 'documents',
    categoryLabel: CATEGORY_LABELS.documents,
    dangerLevel: 'normal',
  },

  // صندوق
  {
    key: 'cash.view',
    name: 'مشاهده صندوق',
    description: 'امکان مشاهده موجودی و گردش صندوق',
    category: 'cash',
    categoryLabel: CATEGORY_LABELS.cash,
    dangerLevel: 'normal',
  },
  {
    key: 'cash.create',
    name: 'ورود/خروج صندوق',
    description: 'امکان ثبت دریافتی و پرداختی صندوق',
    category: 'cash',
    categoryLabel: CATEGORY_LABELS.cash,
    dangerLevel: 'normal',
  },
  {
    key: 'cash.edit',
    name: 'ویرایش تراکنش صندوق',
    description: 'امکان اصلاح گردش صندوق',
    category: 'cash',
    categoryLabel: CATEGORY_LABELS.cash,
    dangerLevel: 'sensitive',
  },
  {
    key: 'cash.delete',
    name: 'حذف تراکنش صندوق',
    description: 'امکان حذف سوابق صندوق',
    category: 'cash',
    categoryLabel: CATEGORY_LABELS.cash,
    dangerLevel: 'critical',
  },
  {
    key: 'cash.manage',
    name: 'مدیریت کامل صندوق',
    description: 'مدیریت موجودی، بستن صندوق و کنترل صندوق‌ها',
    category: 'cash',
    categoryLabel: CATEGORY_LABELS.cash,
    dangerLevel: 'critical',
  },

  // حساب‌های بانکی
  {
    key: 'bank.view',
    name: 'مشاهده حساب‌های بانکی',
    description: 'امکان مشاهده لیست و موجودی کارت‌ها و حساب‌های بانکی',
    category: 'banks',
    categoryLabel: CATEGORY_LABELS.banks,
    dangerLevel: 'normal',
  },
  {
    key: 'bank.create',
    name: 'افزایش/افتتاح حساب بانکی',
    description: 'امکان تعریف حساب بانکی جدید یا انتقال وجه',
    category: 'banks',
    categoryLabel: CATEGORY_LABELS.banks,
    dangerLevel: 'normal',
  },
  {
    key: 'bank.edit',
    name: 'ویرایش حساب بانکی',
    description: 'امکان ویرایش شماره کارت/حساب بانکی',
    category: 'banks',
    categoryLabel: CATEGORY_LABELS.banks,
    dangerLevel: 'sensitive',
  },
  {
    key: 'bank.delete',
    name: 'حذف حساب بانکی',
    description: 'امکان حذف یا غیرفعال‌سازی حساب بانکی',
    category: 'banks',
    categoryLabel: CATEGORY_LABELS.banks,
    dangerLevel: 'critical',
  },
  {
    key: 'bank.manage',
    name: 'مدیریت حساب‌های بانکی',
    description: 'مدیریت کامل و انتقال بین حساب‌های بانکی',
    category: 'banks',
    categoryLabel: CATEGORY_LABELS.banks,
    dangerLevel: 'critical',
  },

  // گزارش‌ها
  {
    key: 'report.view',
    name: 'مشاهده گزارش‌های پایه',
    description: 'امکان مشاهده گزارش‌های عمومی سامانه',
    category: 'reports',
    categoryLabel: CATEGORY_LABELS.reports,
    dangerLevel: 'normal',
  },
  {
    key: 'report.financial',
    name: 'گزارش‌های مالی و سود و زیان',
    description: 'امکان مشاهده گزارش‌های جامع مالی، ترازنامه و سود و زیان',
    category: 'reports',
    categoryLabel: CATEGORY_LABELS.reports,
    dangerLevel: 'sensitive',
  },
  {
    key: 'report.customer',
    name: 'گزارش صورت‌حساب مشتریان',
    description: 'امکان اخذ خروجی PDF و گزارش کارکرد مشتریان',
    category: 'reports',
    categoryLabel: CATEGORY_LABELS.reports,
    dangerLevel: 'normal',
  },
  {
    key: 'report.transaction',
    name: 'گزارش گردش تراکنش‌ها',
    description: 'امکان اخذ خروجی و گزارش جامع تراکنش‌ها',
    category: 'reports',
    categoryLabel: CATEGORY_LABELS.reports,
    dangerLevel: 'normal',
  },

  // تنظیمات
  {
    key: 'settings.view',
    name: 'مشاهده تنظیمات',
    description: 'امکان مشاهده تنظیمات عمومی و عیار مبنا',
    category: 'settings',
    categoryLabel: CATEGORY_LABELS.settings,
    dangerLevel: 'normal',
  },
  {
    key: 'settings.edit',
    name: 'ویرایش تنظیمات',
    description: 'امکان ویرایش عیار مبنا، قالب فاکتور و تنظیمات عمومی',
    category: 'settings',
    categoryLabel: CATEGORY_LABELS.settings,
    dangerLevel: 'sensitive',
  },
  {
    key: 'settings.manage',
    name: 'مدیریت کامل تنظیمات',
    description: 'امکان پیکربندی کامل سیستم، سال مالی و پیشوند اسناد',
    category: 'settings',
    categoryLabel: CATEGORY_LABELS.settings,
    dangerLevel: 'critical',
  },
];

export type PermissionKey = typeof PERMISSIONS_REGISTRY[number]['key'];

export const PERMISSIONS_BY_KEY: Record<string, PermissionDefinition> = Object.fromEntries(
  PERMISSIONS_REGISTRY.map((p) => [p.key, p]),
);

export function isValidPermissionKey(key: string): key is PermissionKey {
  return key in PERMISSIONS_BY_KEY;
}

export function getPermissionDefinition(key: string): PermissionDefinition | undefined {
  return PERMISSIONS_BY_KEY[key];
}

export function getAllPermissions(): PermissionDefinition[] {
  return PERMISSIONS_REGISTRY;
}

export function getPermissionsByCategory(): Record<PermissionCategory, PermissionDefinition[]> {
  const result: Record<PermissionCategory, PermissionDefinition[]> = {
    users: [],
    customers: [],
    transactions: [],
    documents: [],
    cash: [],
    banks: [],
    reports: [],
    settings: [],
  };

  for (const perm of PERMISSIONS_REGISTRY) {
    if (result[perm.category]) {
      result[perm.category].push(perm);
    }
  }

  return result;
}
