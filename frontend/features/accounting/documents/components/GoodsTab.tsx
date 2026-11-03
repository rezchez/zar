'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  Flame,
  FlaskConical,
  FolderTree,
  Layers,
  ListPlus,
  Package,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Wrench,
} from 'lucide-react';

import AccountTreeSelector from '@/features/accounting/chart-of-accounts/components/AccountTreeSelector';
import Field from '@/src/components/documents/Field';
import MoneyInputField from '@/src/components/documents/MoneyInputField';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import type { Customer } from '@/lib/customer';
import type { ChartOfAccountRecord } from '@/lib/chart-of-accounts';
import { faNumber, numberValue, toPersianDigits } from '../utils/document-helpers';

export type GoodsServiceType = 'goods' | 'service';
export type GoodsServiceOperation = 'buy' | 'sell';

type QuickChip = {
  id: string;
  label: string;
  type: GoodsServiceType;
  accountCode: string;
  accountName: string;
  accountPath: string;
  accountId: string;
  defaultUnit: string;
  defaultItemName: string;
  defaultDescription: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

// Preset chips based on Zarfolio's Chart of Accounts
const QUICK_GOODS_CHIPS: QuickChip[] = [
  {
    id: 'goods_resin',
    label: 'رزین ریخته‌گری ۳بعدی',
    type: 'goods',
    accountCode: '113040',
    accountName: 'مواد اولیه و رزین ریخته‌گری',
    accountPath: '/1000/1100/1130/113040/',
    accountId: 'coa_group_goods_resin',
    defaultUnit: 'لیتر',
    defaultItemName: 'رزین ریخته‌گری فوتون',
    defaultDescription: 'بابت رزین ریخته‌گری ۳بعدی طلا و جواهر',
    icon: FlaskConical,
  },
  {
    id: 'goods_wax',
    label: 'موم تزریق و قالب‌گیری',
    type: 'goods',
    accountCode: '113040',
    accountName: 'مواد اولیه و رزین ریخته‌گری',
    accountPath: '/1000/1100/1130/113040/',
    accountId: 'coa_group_goods_resin',
    defaultUnit: 'کیلوگرم',
    defaultItemName: 'موم تزریقی ریخته‌گری',
    defaultDescription: 'بابت موم تزریق و ریخته‌گری زرگری',
    icon: Package,
  },
  {
    id: 'goods_powder',
    label: 'گچ ریخته‌گری طلا',
    type: 'goods',
    accountCode: '113040',
    accountName: 'مواد اولیه و رزین ریخته‌گری',
    accountPath: '/1000/1100/1130/113040/',
    accountId: 'coa_group_goods_resin',
    defaultUnit: 'کیلوگرم',
    defaultItemName: 'پودر گچ ریخته‌گری طلا',
    defaultDescription: 'بابت پودر گچ نسوز ریخته‌گری طلا و نقره',
    icon: Boxes,
  },
  {
    id: 'goods_polish',
    label: 'صابون و خمیر پرداخت',
    type: 'goods',
    accountCode: '113060',
    accountName: 'ملزومات مصرفی و ابزار کارگاهی',
    accountPath: '/1000/1100/1130/113060/',
    accountId: 'coa_group_goods_workshop',
    defaultUnit: 'قالب',
    defaultItemName: 'صابون پرداختکاری دیالوکس',
    defaultDescription: 'بابت صابون و مواد پرداختکاری زرگری',
    icon: Sparkles,
  },
  {
    id: 'goods_saw',
    label: 'تیغ اره مویی زرگری',
    type: 'goods',
    accountCode: '113060',
    accountName: 'ملزومات مصرفی و ابزار کارگاهی',
    accountPath: '/1000/1100/1130/113060/',
    accountId: 'coa_group_goods_workshop',
    defaultUnit: 'جین',
    defaultItemName: 'تیغ اره مویی سوئیسی',
    defaultDescription: 'بابت تیغ اره زرگری',
    icon: Wrench,
  },
  {
    id: 'goods_box',
    label: 'جعبه و قاب جواهرات',
    type: 'goods',
    accountCode: '113070',
    accountName: 'جعبه و ملزومات بسته‌بندی',
    accountPath: '/1000/1100/1130/113070/',
    accountId: 'coa_group_goods_packaging',
    defaultUnit: 'عدد',
    defaultItemName: 'جعبه انگشتر مخمل لوکس',
    defaultDescription: 'بابت جعبه و متعلقات بسته‌بندی طلا و جواهر',
    icon: Package,
  },
  {
    id: 'goods_bag',
    label: 'بگ و کیسه مخمل',
    type: 'goods',
    accountCode: '113070',
    accountName: 'جعبه و ملزومات بسته‌بندی',
    accountPath: '/1000/1100/1130/113070/',
    accountId: 'coa_group_goods_packaging',
    defaultUnit: 'عدد',
    defaultItemName: 'کیسه جیر بنددار طلا',
    defaultDescription: 'بابت بگ و ملزومات اهدای طلا',
    icon: ShoppingBag,
  },
];

const QUICK_SERVICE_CHIPS: QuickChip[] = [
  {
    id: 'srv_3d_design',
    label: 'طراحی سه‌بعدی و CAD',
    type: 'service',
    accountCode: '4240',
    accountName: 'اجرت طراحی، ری‌گیری و حکاکی',
    accountPath: '/4000/4200/4240/',
    accountId: 'sys_4240',
    defaultUnit: 'پروژه',
    defaultItemName: 'طراحی سه‌بعدی ماتریکس/راینو',
    defaultDescription: 'بابت خدمات طراحی سه‌بعدی طلا و جواهر و آماده‌سازی فایل پرینت',
    icon: Layers,
  },
  {
    id: 'srv_assay',
    label: 'ری‌گیری و عیارسنجی',
    type: 'service',
    accountCode: '4240',
    accountName: 'اجرت طراحی، ری‌گیری و حکاکی',
    accountPath: '/4000/4200/4240/',
    accountId: 'sys_4240',
    defaultUnit: 'قطعه',
    defaultItemName: 'خدمات ری‌گیری و آزمایش عیار',
    defaultDescription: 'بابت اجرت ری‌گیری و تعیین عیار طلا',
    icon: FlaskConical,
  },
  {
    id: 'srv_gem_setting',
    label: 'مخراج‌کاری و نگین‌نشانی',
    type: 'service',
    accountCode: '4220',
    accountName: 'اجرت مخراج‌کاری و نگین',
    accountPath: '/4000/4200/4220/',
    accountId: 'sys_4220',
    defaultUnit: 'نگین',
    defaultItemName: 'مخراجکاری برلیان و سنگ سوار',
    defaultDescription: 'بابت اجرت مخراج‌کاری و سوار کردن سنگ روی پایه',
    icon: Sparkles,
  },
  {
    id: 'srv_plating',
    label: 'آبکاری و پوشش‌دهی',
    type: 'service',
    accountCode: '4210',
    accountName: 'درآمد آبکاری',
    accountPath: '/4000/4200/4210/',
    accountId: 'sys_4210',
    defaultUnit: 'گرم',
    defaultItemName: 'آبکاری رادیوم / طلای زرد',
    defaultDescription: 'بابت خدمات آبکاری و پرداخت نهایی',
    icon: Flame,
  },
  {
    id: 'srv_repairs',
    label: 'تعمیرات و تغییر سایز',
    type: 'service',
    accountCode: '4230',
    accountName: 'اجرت تعمیرات و تعویض',
    accountPath: '/4000/4200/4230/',
    accountId: 'sys_4230',
    defaultUnit: 'قطعه',
    defaultItemName: 'تعمیر و جوشکاری طلا',
    defaultDescription: 'بابت خدمات تعمیرات، تغییر سایز و بازسازی طلا',
    icon: Wrench,
  },
  {
    id: 'srv_laser',
    label: 'حکاکی لیزری و برش',
    type: 'service',
    accountCode: '4240',
    accountName: 'اجرت طراحی، ری‌گیری و حکاکی',
    accountPath: '/4000/4200/4240/',
    accountId: 'sys_4240',
    defaultUnit: 'قطعه',
    defaultItemName: 'حکاکی لیزری و اسم‌نویسی',
    defaultDescription: 'بابت خدمات حکاکی لیزری داخل حلقه و پلاک',
    icon: Sparkles,
  },
];

const STANDARD_UNITS = [
  'عدد',
  'لیتر',
  'کیلوگرم',
  'گرم',
  'پروژه',
  'فایل',
  'قالب',
  'بسته',
  'قوطی',
  'جین',
  'نگین',
  'قطعه',
  'ساعت',
] as const;

type GoodsTabProps = {
  nature: 'received' | 'paid';
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId: string | null;
  isLinesPinned: boolean;
  commitDraftLine: () => void;
  updateDraftDetail: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter: (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => void;
  draftReady: boolean;
  baseCurrency?: 'IRR' | 'IRT';
  selectedCustomer?: Customer | null;
  onNatureChange?: (nextNature: 'received' | 'paid') => void;
};

export default function GoodsTab({
  nature,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId,
  isLinesPinned,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady,
  baseCurrency = 'IRR',
  selectedCustomer,
  onNatureChange,
}: GoodsTabProps) {
  const isToman = baseCurrency === 'IRT';
  const currencySuffix = isToman ? 'تومان' : 'ریال';

  // Determine current operation (buy vs sell) and item type (goods vs service)
  const currentItemType: GoodsServiceType = (draftLine.details?.goodsServiceType as GoodsServiceType) || 'goods';
  const currentOperation: GoodsServiceOperation =
    (draftLine.details?.goodsServiceOperation as GoodsServiceOperation) ||
    (nature === 'paid' ? 'sell' : 'buy');

  const isSale = currentOperation === 'sell';

  // Current values from draftLine details
  const selectedAccountId = draftLine.details?.goodsServiceAccountId || null;
  const selectedAccountName = draftLine.details?.goodsServiceAccountName || '';
  const selectedAccountCode = draftLine.details?.goodsServiceAccountCode || '';
  const selectedAccountPath = draftLine.details?.goodsServiceAccountPath || '';

  const itemName = draftLine.details?.itemName || '';
  const quantityStr = draftLine.details?.quantity || '1';
  const unit = draftLine.details?.unit || (currentItemType === 'goods' ? 'لیتر' : 'پروژه');
  const unitPriceStr = draftLine.details?.unitPrice || '';
  const totalAmountStr = draftLine.details?.totalAmount || '';
  const description = draftLine.description || '';

  // Synchronize currency settings in draftLine details
  useEffect(() => {
    if (draftLine.details?.currencyUnit !== baseCurrency) {
      updateDraftDetail('currencyUnit', baseCurrency);
    }
    if (draftLine.details?.baseCurrency !== baseCurrency) {
      updateDraftDetail('baseCurrency', baseCurrency);
    }
  }, [baseCurrency, draftLine.details?.currencyUnit, draftLine.details?.baseCurrency, updateDraftDetail]);

  // Load goods types from API for quick suggestions
  const [goodsTypes, setGoodsTypes] = useState<Array<{ id: string; name: string; unit: string; defaultUnitPrice?: number }>>([]);
  useEffect(() => {
    let active = true;
    fetch('/api/goods-types')
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (active && Array.isArray(data.items)) {
          setGoodsTypes(data.items);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  // Recalculate total amount when quantity or unitPrice changes
  const handleQuantityChange = (qtyStr: string) => {
    updateDraftDetail('quantity', qtyStr);
    const qty = numberValue(qtyStr);
    const unitPrice = numberValue(unitPriceStr);
    if (qty > 0 && unitPrice > 0) {
      const total = Math.round(qty * unitPrice);
      updateDraftDetail('totalAmount', String(total));
    }
  };

  const handleUnitPriceChange = (priceStr: string) => {
    const cleanPrice = priceStr.includes('.') ? priceStr.split('.')[0] : priceStr;
    updateDraftDetail('unitPrice', cleanPrice);
    const unitPrice = numberValue(cleanPrice);
    const qty = numberValue(quantityStr) || 1;
    if (qty > 0 && unitPrice > 0) {
      const total = Math.round(qty * unitPrice);
      updateDraftDetail('totalAmount', String(total));
    }
  };

  const handleTotalAmountChange = (totalStr: string) => {
    const cleanTotal = totalStr.includes('.') ? totalStr.split('.')[0] : totalStr;
    updateDraftDetail('totalAmount', cleanTotal);
    const total = numberValue(cleanTotal);
    const qty = numberValue(quantityStr) || 1;
    if (qty > 0 && total > 0) {
      const calcUnitPrice = Math.round(total / qty);
      updateDraftDetail('unitPrice', String(calcUnitPrice));
    }
  };

  // Change operation: buy vs sell
  const handleOperationChange = (nextOp: GoodsServiceOperation) => {
    const nextNature = nextOp === 'sell' ? 'paid' : 'received';
    onNatureChange?.(nextNature);

    updateDraftDetail('goodsServiceOperation', nextOp);

    setDraftLine((prev) => {
      const isS = nextOp === 'sell';
      const isG = (prev.details?.goodsServiceType || currentItemType) === 'goods';
      const docLabel = isS ? (isG ? 'فروش کالا' : 'ارائه خدمات') : (isG ? 'خرید کالا' : 'خرید خدمات');
      const docSub = isG ? (isS ? 'goods-sell' : 'goods-buy') : (isS ? 'service-sell' : 'service-buy');

      return {
        ...prev,
        documentNature: nextNature,
        documentTab: 'goods',
        sourceTab: 'goods',
        documentSubType: docSub,
        documentTypeLabel: prev.details?.itemName ? `${docLabel} (${prev.details.itemName})` : docLabel,
        details: {
          ...prev.details,
          goodsServiceOperation: nextOp,
        },
      };
    });
  };

  // Change item type: goods vs service
  const handleTypeChange = (nextType: GoodsServiceType) => {
    updateDraftDetail('goodsServiceType', nextType);
    const defaultUnitForType = nextType === 'goods' ? 'لیتر' : 'پروژه';
    updateDraftDetail('unit', defaultUnitForType);

    setDraftLine((prev) => {
      const isS = (prev.details?.goodsServiceOperation || currentOperation) === 'sell';
      const isG = nextType === 'goods';
      const docLabel = isS ? (isG ? 'فروش کالا' : 'ارائه خدمات') : (isG ? 'خرید کالا' : 'خرید خدمات');
      const docSub = isG ? (isS ? 'goods-sell' : 'goods-buy') : (isS ? 'service-sell' : 'service-buy');

      return {
        ...prev,
        documentTab: 'goods',
        sourceTab: 'goods',
        documentSubType: docSub,
        documentTypeLabel: prev.details?.itemName ? `${docLabel} (${prev.details.itemName})` : docLabel,
        details: {
          ...prev.details,
          goodsServiceType: nextType,
          unit: defaultUnitForType,
        },
      };
    });
  };

  // Select account from tree
  const handleAccountSelect = (accountId: string | null, account?: ChartOfAccountRecord) => {
    updateDraftDetail('goodsServiceAccountId', accountId || '');
    updateDraftDetail('goodsServiceAccountCode', account?.code || '');
    updateDraftDetail('goodsServiceAccountName', account?.name || '');
    updateDraftDetail('goodsServiceAccountPath', account?.path || '');

    setDraftLine((prev) => {
      const isS = (prev.details?.goodsServiceOperation || currentOperation) === 'sell';
      const isG = (prev.details?.goodsServiceType || currentItemType) === 'goods';
      const docLabel = isS ? (isG ? 'فروش کالا' : 'ارائه خدمات') : (isG ? 'خرید کالا' : 'خرید خدمات');
      const docSub = isG ? (isS ? 'goods-sell' : 'goods-buy') : (isS ? 'service-sell' : 'service-buy');

      return {
        ...prev,
        documentTab: 'goods',
        sourceTab: 'goods',
        documentSubType: docSub,
        documentTypeLabel: prev.details?.itemName ? `${docLabel} (${prev.details.itemName})` : docLabel,
        details: {
          ...prev.details,
          goodsServiceAccountId: accountId || '',
          goodsServiceAccountCode: account?.code || '',
          goodsServiceAccountName: account?.name || '',
          goodsServiceAccountPath: account?.path || '',
        },
      };
    });
  };

  // Select quick preset chip
  const handleChipSelect = (chip: QuickChip) => {
    handleAccountSelect(chip.accountId, {
      id: chip.accountId,
      code: chip.accountCode,
      name: chip.accountName,
      parentId: null,
      path: chip.accountPath,
      level: 3,
      accountType: isSale ? 'revenue' : 'asset',
      normalBalance: isSale ? 'credit' : 'debit',
      requiresWeight: false,
      isMultiCurrency: false,
      isSystem: true,
      isActive: true,
      isPostable: true,
      sortOrder: 1,
    });

    updateDraftDetail('unit', chip.defaultUnit);
    updateDraftDetail('itemName', chip.defaultItemName);

    setDraftLine((prev) => {
      const isS = (prev.details?.goodsServiceOperation || currentOperation) === 'sell';
      const isG = chip.type === 'goods';
      const docLabel = isS ? (isG ? 'فروش کالا' : 'ارائه خدمات') : (isG ? 'خرید کالا' : 'خرید خدمات');
      const docSub = isG ? (isS ? 'goods-sell' : 'goods-buy') : (isS ? 'service-sell' : 'service-buy');

      const currentDesc = prev.description?.trim();
      const needsDesc =
        !currentDesc ||
        QUICK_GOODS_CHIPS.some((c) => c.defaultDescription === currentDesc) ||
        QUICK_SERVICE_CHIPS.some((c) => c.defaultDescription === currentDesc);

      return {
        ...prev,
        description: needsDesc ? chip.defaultDescription : prev.description,
        documentTab: 'goods',
        sourceTab: 'goods',
        documentSubType: docSub,
        documentTypeLabel: `${docLabel} (${chip.defaultItemName})`,
        details: {
          ...prev.details,
          goodsServiceType: chip.type,
          itemName: chip.defaultItemName,
          unit: chip.defaultUnit,
        },
      };
    });
  };

  // Validation
  const quantityNum = numberValue(quantityStr);
  const totalAmountNum = Math.floor(numberValue(totalAmountStr));
  const isFormValid = Boolean(itemName.trim() && selectedAccountId && quantityNum > 0 && totalAmountNum > 0);

  const activeChips = currentItemType === 'goods' ? QUICK_GOODS_CHIPS : QUICK_SERVICE_CHIPS;

  return (
    <div className="space-y-4">
      {/* Title & Section Header */}
      <div className="document-operation-title flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              isSale
                ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                : 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
            }`}
          >
            <Package size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isSale
                ? currentItemType === 'goods'
                  ? 'فروش کالا (درختواره زرفولیو)'
                  : 'ارائه خدمات (درختواره زرفولیو)'
                : currentItemType === 'goods'
                  ? 'خرید کالا (درختواره زرفولیو)'
                  : 'خرید خدمات (درختواره زرفولیو)'}
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {isSale
                ? 'فروش اقلام مصرفی و ارائه خدمات کارگاهی برمبنای کدینگ حساب‌ها (بدهکار شدن طرف‌حساب)'
                : 'خرید مواد اولیه و دریافت خدمات فنی کارگاهی برمبنای کدینگ حساب‌ها (بستانکار شدن طرف‌حساب)'}
            </p>
          </div>
        </div>

        {/* Switchers: Item Type & Operation */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Goods vs Service */}
          <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => handleTypeChange('goods')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentItemType === 'goods'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Boxes size={13} />
              کالا (رزین و مواد)
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('service')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentItemType === 'service'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers size={13} />
              خدمات (طراحی و فنی)
            </button>
          </div>

          {/* Buy vs Sell */}
          <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border/50">
            <button
              type="button"
              onClick={() => handleOperationChange('buy')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                !isSale
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingDown size={13} />
              خرید
            </button>
            <button
              type="button"
              onClick={() => handleOperationChange('sell')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isSale
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TrendingUp size={13} />
              فروش
            </button>
          </div>
        </div>
      </div>

      {/* Quick Access Preset Chips */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-3.5 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-foreground">
          <div className="flex items-center gap-2">
            <Tag size={15} className="text-amber-500 shrink-0" />
            <span>میانبرهای پرکاربرد {currentItemType === 'goods' ? 'کالا' : 'خدمات'} (متصل به سرفصل درختواره)</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-normal">کلیک کنید تا سرفصل و مقادیر پیش‌فرض ثبت شوند</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => {
            const Icon = chip.icon;
            const isSelected = selectedAccountId === chip.accountId && itemName === chip.defaultItemName;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleChipSelect(chip)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? isSale
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-700/80'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-white' : 'text-amber-500'} />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart of Accounts Tree Selector */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-foreground">
          <div className="flex items-center gap-2">
            <FolderTree size={16} className="text-amber-500" />
            <span>سرفصل حسابداری مربوطه در درختواره زرفولیو (کدینگ حساب‌ها)</span>
          </div>
          {selectedAccountCode && (
            <span className="text-[11px] font-mono text-muted-foreground">کد: {toPersianDigits(selectedAccountCode)}</span>
          )}
        </div>

        <AccountTreeSelector
          value={selectedAccountId}
          onChange={handleAccountSelect}
          filterType="all"
          postableOnly={false}
          label="انتخاب سرفصل از درختواره حساب‌ها"
          placeholder="سرفصل را از درختواره انتخاب کنید یا جستجو نمایید..."
          required
        />

        {selectedAccountPath && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg border border-border/40">
            <span className="font-semibold text-foreground">مسیر درختی:</span>
            <span className="font-mono dir-ltr">{selectedAccountPath}</span>
          </div>
        )}
      </div>

      {/* Main Details Input Grid */}
      <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/90 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Item Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>{currentItemType === 'goods' ? 'نام کالا' : 'عنوان خدمت'}</span>
              <span className="text-rose-500 text-[10px]">*</span>
            </label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => updateDraftDetail('itemName', e.target.value)}
              onKeyDown={handleKeyDownEnter}
              placeholder={currentItemType === 'goods' ? 'مثلاً: رزین ریخته‌گری فوتون' : 'مثلاً: طراحی سه‌بعدی انگشتر اسلیمی'}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>مقدار / تعداد</span>
              <span className="text-rose-500 text-[10px]">*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={quantityStr}
              onChange={(e) => handleQuantityChange(e.target.value)}
              onKeyDown={handleKeyDownEnter}
              placeholder="مثلاً ۱ یا ۲.۵"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-bold tabular-nums text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>واحد سنجش</span>
              <span className="text-rose-500 text-[10px]">*</span>
            </label>
            <select
              value={unit}
              onChange={(e) => updateDraftDetail('unit', e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              {STANDARD_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Price (فی) */}
          <div>
            <MoneyInputField
              label={`قیمت واحد (فی) (${currencySuffix})`}
              value={unitPriceStr}
              onChange={handleUnitPriceChange}
              onKeyDown={handleKeyDownEnter as any}
              baseCurrency={baseCurrency}
              currencySuffix={currencySuffix}
              placeholder="فی واحد..."
            />
          </div>
        </div>

        {/* Total Amount & Description Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2 border-t border-border/40">
          {/* Total Amount */}
          <div>
            <MoneyInputField
              label={`مبلغ کل معامله (${currencySuffix})`}
              value={totalAmountStr}
              onChange={handleTotalAmountChange}
              onKeyDown={handleKeyDownEnter as any}
              baseCurrency={baseCurrency}
              currencySuffix={currencySuffix}
              placeholder="مبلغ کل..."
              required
            />
            {totalAmountNum > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">
                معادل: <span className="font-bold text-foreground">{faNumber(totalAmountNum, 0)}</span> {currencySuffix}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>شرح ردیف سند</span>
              <button
                type="button"
                onClick={() => {
                  const auto = `${isSale ? 'فروش' : 'خرید'} ${itemName || (currentItemType === 'goods' ? 'کالا' : 'خدمات')} به تعداد ${quantityStr || 1} ${unit || 'عدد'} فی ${faNumber(numberValue(unitPriceStr), 0)} ${currencySuffix}`;
                  setDraftLine((prev) => ({ ...prev, description: auto }));
                }}
                className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                تولید خودکار شرح
              </button>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDraftLine((prev) => ({ ...prev, description: e.target.value }))}
              onKeyDown={handleKeyDownEnter}
              placeholder="شرح دلخواه برای این ردیف..."
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Action Button: Commit Row */}
        <div className="pt-2 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {isFormValid ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={14} /> آماده ثبت در سند
              </span>
            ) : (
              <span className="text-muted-foreground">
                {!itemName.trim()
                  ? 'نام کالا یا خدمت را مشخص کنید.'
                  : !selectedAccountId
                    ? 'سرفصل را از درختواره انتخاب کنید.'
                    : totalAmountNum <= 0
                      ? 'مبلغ معامله باید بیشتر از صفر باشد.'
                      : 'فیلدهای الزامی را تکمیل کنید.'}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!isFormValid}
            onClick={() => {
              if (!isFormValid) return;
              commitDraftLine();
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
              isFormValid
                ? isSale
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
            }`}
          >
            <ListPlus size={16} />
            <span>ثبت ردیف در سند</span>
          </button>
        </div>
      </div>
    </div>
  );
}
