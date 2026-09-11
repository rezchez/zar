export type GoodsCategory =
  | 'resin_casting'
  | 'gemstones'
  | 'workshop_tools'
  | 'packaging'
  | 'general_goods';

export interface GoodsCategoryMeta {
  key: GoodsCategory;
  name: string;
  codePrefix: string;
  description: string;
  accountCode: string;
  badgeColor: string;
}

/**
 * Active Goods Categories — Exclusively restricted to Resin Casting (113040).
 * Gemstones and Diamonds are strictly managed in the Gemstone Inventory (113050).
 */
export const GOODS_CATEGORIES: Record<'resin_casting', GoodsCategoryMeta> = {
  resin_casting: {
    key: 'resin_casting',
    name: 'مواد اولیه و رزین ریخته‌گری',
    codePrefix: '113040',
    description: 'رزین‌های سه‌بعدی ریخته‌گری طلا و نقره، موم و مواد قالب‌گیری کارگاهی',
    accountCode: '113040',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  },
};

/**
 * Comprehensive dictionary for historical / backward-compatible record lookup.
 */
export const ALL_GOODS_CATEGORIES: Record<GoodsCategory, GoodsCategoryMeta> = {
  ...GOODS_CATEGORIES,
  gemstones: {
    key: 'gemstones',
    name: 'سنگ و نگین (انتقال‌یافته به موجودی سنگ)',
    codePrefix: '113050',
    description: 'نگین‌های اتمی، سنگ‌های قیمتی و مروارید (ثبت در بخش موجودی سنگ)',
    accountCode: '113050',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  },
  workshop_tools: {
    key: 'workshop_tools',
    name: 'ملزومات مصرفی و ابزار کارگاهی',
    codePrefix: '113060',
    description: 'خمیر و صابون پولیش، فرچه و نمد، تیغ اره و بوته ذوب',
    accountCode: '113060',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  },
  packaging: {
    key: 'packaging',
    name: 'جعبه و ملزومات بسته‌بندی',
    codePrefix: '113070',
    description: 'جعبه‌های جواهر، بگ‌های مخمل و جیر، نخ و بند دستبند',
    accountCode: '113070',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  },
  general_goods: {
    key: 'general_goods',
    name: 'سایر کالاها و ملزومات',
    codePrefix: '113080',
    description: 'سایر ملزومات و اقلام متفرقه انبار',
    accountCode: '113080',
    badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-900/60 dark:text-gray-300 border-gray-200 dark:border-gray-700',
  },
};

export const COMMON_GOODS_UNITS = [
  'لیتر',
  'کیلوگرم',
  'گرم',
  'قوطی',
  'بسته',
  'عدد',
  'قالب',
  'متر',
] as const;

export type GoodsUnit = typeof COMMON_GOODS_UNITS[number] | string;

export interface GoodsTypeRecord {
  id: string;
  name: string;
  code?: string;
  category: GoodsCategory;
  unit: string;
  defaultUnitPrice?: number;
  description?: string;
  isActive: boolean;
  sortOrder?: number;
  created?: string;
  updated?: string;
}

export interface GoodsOpeningRecord {
  id: string;
  goodsTypeId?: string;
  goodsType?: GoodsTypeRecord;
  itemName: string;
  category: GoodsCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
  date: string;
  storageLocation?: string;
  sku?: string;
  description?: string;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export interface GoodsSummaryByCategory {
  category: GoodsCategory;
  categoryName: string;
  itemCount: number;
  totalQuantity: number;
  totalAmount: number;
}

export interface GoodsInventorySummary {
  totalItems: number;
  totalValuation: number;
  byCategory: Record<GoodsCategory, GoodsSummaryByCategory>;
}

export function calculateGoodsTotalAmount(quantity: number, unitPrice: number): number {
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safePrice = Math.max(0, Number(unitPrice) || 0);
  return Math.round(safeQty * safePrice);
}

export function calculateGoodsInventorySummary(items: GoodsOpeningRecord[]): GoodsInventorySummary {
  const categories = Object.keys(ALL_GOODS_CATEGORIES) as GoodsCategory[];
  const byCategory: Record<GoodsCategory, GoodsSummaryByCategory> = {} as any;

  for (const cat of categories) {
    byCategory[cat] = {
      category: cat,
      categoryName: ALL_GOODS_CATEGORIES[cat].name,
      itemCount: 0,
      totalQuantity: 0,
      totalAmount: 0,
    };
  }

  let totalItems = 0;
  let totalValuation = 0;

  for (const item of items) {
    const cat = (item.category || 'resin_casting') as GoodsCategory;
    if (!byCategory[cat]) {
      byCategory[cat] = {
        category: cat,
        categoryName: ALL_GOODS_CATEGORIES[cat]?.name || cat,
        itemCount: 0,
        totalQuantity: 0,
        totalAmount: 0,
      };
    }

    const qty = Number(item.quantity) || 0;
    const amount = Math.round(Number(item.totalAmount) || 0);

    byCategory[cat].itemCount += 1;
    byCategory[cat].totalQuantity += qty;
    byCategory[cat].totalAmount += amount;

    totalItems += 1;
    totalValuation += amount;
  }

  return {
    totalItems,
    totalValuation,
    byCategory,
  };
}
