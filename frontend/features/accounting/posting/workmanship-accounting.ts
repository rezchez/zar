import 'server-only';

import type PocketBase from 'pocketbase';
import { SYSTEM_ACCOUNT_CODES, type JournalLineInput } from '@/lib/accounting-posting-engine';

export interface WorkmanshipAccountMapping {
  /**
   * حساب معین موجودی کارساخته و مصنوعات طلا و فلزات گرانبها
   * پیش‌فرض: ۱۱۳۰۶۰ یا ۱۱۳۰
   */
  workmanshipInventoryAccountId: string;

  /**
   * حساب معین درآمد حاصل از فروش مصنوعات و خدمات کار ساخته
   * پیش‌فرض: ۴۱۲۰
   */
  workmanshipSalesRevenueAccountId: string;

  /**
   * حساب معین برگشت از فروش و تخفیفات مصنوعات و طلا
   * پیش‌فرض: ۴۱۵۰ (در صورت عدم وجود سرفصل اختصاصی: ۴۱۲۰ کاهنده درآمد)
   */
  salesReturnAccountId: string;

  /**
   * حساب معین برگشت از خرید و تخفیفات مصنوعات و طلا
   * پیش‌فرض: ۵۱۵۰ (در صورت عدم وجود سرفصل اختصاصی: ۱۱۳۰ کاهنده موجودی)
   */
  purchaseReturnAccountId: string;

  /**
   * حساب معین طرف‌های حساب تجاری / بستانکاران
   * پیش‌فرض: ۲۱۲۰
   */
  counterpartyLiabilityAccountId: string;

  /**
   * حساب معین اسناد و حساب‌های دریافتنی تجاری
   * پیش‌فرض: ۱۱۲۰
   */
  counterpartyReceivableAccountId: string;

  /**
   * حساب معین هزینه تعدیلات و کسر ناشی از گرد کردن (سایر هزینه‌های عملیاتی)
   * پیش‌فرض: ۶۵۰۰
   */
  roundingExpenseAccountId?: string;

  /**
   * حساب معین درآمد و اضافه ناشی از گرد کردن (سایر درآمدها)
   * پیش‌فرض: ۴۳۰۰
   */
  roundingIncomeAccountId?: string;
}

export const DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING: WorkmanshipAccountMapping = {
  workmanshipInventoryAccountId: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY, // 1130
  workmanshipSalesRevenueAccountId: '4120', // درآمد فروش مصنوعات
  salesReturnAccountId: '4150', // برگشت از فروش و تخفیفات
  purchaseReturnAccountId: '5150', // برگشت از خرید و تخفیفات
  counterpartyLiabilityAccountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY, // 2120
  counterpartyReceivableAccountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE, // 1120
  roundingExpenseAccountId: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE, // 6500
  roundingIncomeAccountId: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME, // 4300
};

/**
 * Resolves account mapping from system settings or falls back to system chart defaults.
 */
export async function resolveWorkmanshipAccountMapping(
  pb?: PocketBase,
): Promise<WorkmanshipAccountMapping> {
  if (!pb) {
    return { ...DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING };
  }

  try {
    const settingsRecord = await pb.collection('system_settings').getFirstListItem(
      pb.filter('key = {:key}', { key: 'workmanship_accounting_mapping' }),
    ).catch(() => null);

    if (settingsRecord?.value && typeof settingsRecord.value === 'object') {
      return {
        ...DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING,
        ...settingsRecord.value,
      };
    }
  } catch {
    // collection may not exist yet
  }

  return { ...DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING };
}

export interface BuildWorkmanshipReturnParams {
  amountRials: number;
  exactAmountRials?: number;
  roundingDifference?: number;
  workmanshipName: string;
  weightGrams?: number;
  convertedWeight750?: number;
  quantity?: number;
  customerId: string;
  customerName: string;
  mapping?: Partial<WorkmanshipAccountMapping>;
}

/**
 * ورود مرجوعی = برگشت از فروش (Sales Returns & Allowances):
 * مشتری کالایی را که قبلاً به او فروخته یا خروج زده بودیم مرجوع کرده است.
 * ۱. بدهکار: برگشت از فروش و تخفیفات (کد ۴۱۵۰ یا ۴۱۲۰)
 * ۲. بستانکار: حساب‌های دریافتنی تجاری / طرف‌حساب (کد ۱۱۲۰)
 */
export function buildWorkmanshipReturnEntryJournalLines(
  params: BuildWorkmanshipReturnParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING, ...params.mapping };
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactReturn = params.exactAmountRials !== undefined
    ? Math.round(params.exactAmountRials)
    : roundingDiff !== 0
      ? Math.round(params.amountRials - roundingDiff)
      : Math.round(params.amountRials);
  const customerCreditAmount = exactReturn + roundingDiff;

  const lines: JournalLineInput[] = [];
  const weightText = params.weightGrams ? ` (وزن: ${params.weightGrams.toFixed(3)} گرم)` : '';

  // ۱. بدهکار: برگشت از فروش و تخفیفات
  lines.push({
    accountId: map.salesReturnAccountId || '4150',
    accountCode: '4150',
    accountName: 'برگشت از فروش و تخفیفات',
    debit: exactReturn,
    credit: 0,
    description: `برگشت از فروش کارساخته: ${params.workmanshipName}${weightText} از ${params.customerName}`,
    partyId: params.customerId,
  });

  // ۲. تعدیلات گرد کردن در صورت اضافه پرداخت
  if (roundingDiff > 0) {
    lines.push({
      accountId: map.roundingExpenseAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountName: 'سایر هزینه‌های عملیاتی - تعدیلات گرد کردن',
      debit: roundingDiff,
      credit: 0,
      description: `تعدیلات و اضافه بستانکاری ناشی از گرد کردن در برگشت از فروش از ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  // ۳. بستانکار: طرف‌حساب (کاهش بدهی مشتری / طلبکاری مشتری)
  lines.push({
    accountId: map.counterpartyReceivableAccountId || SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
    accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
    accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
    debit: 0,
    credit: customerCreditAmount,
    description: `بستانکاری طرف‌حساب ${params.customerName} بابت برگشت از فروش (ورود مرجوعی) کارساخته ${params.workmanshipName}`,
    partyId: params.customerId,
  });

  // ۴. تعدیلات گرد کردن در صورت کسر
  if (roundingDiff < 0) {
    lines.push({
      accountId: map.roundingIncomeAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountName: 'سایر درآمدها - کسر و اضافات گرد کردن',
      debit: 0,
      credit: Math.abs(roundingDiff),
      description: `تخفیف و کسر ناشی از گرد کردن در برگشت از فروش از ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  return lines;
}

/**
 * خروج مرجوعی = برگشت از خرید (Purchase Returns & Allowances):
 * کارساخته‌ای را که قبلاً از طرف‌حساب (تأمین‌کننده/بنکدار) تحویل گرفته یا خریده بودیم، به او پس می‌دهیم.
 * ۱. بدهکار: بستانکاران تجاری / طرف‌حساب (کد ۲۱۲۰)
 * ۲. بستانکار: برگشت از خرید و تخفیفات (کد ۵۱۵۰ یا ۱۱۳۰)
 */
export function buildWorkmanshipReturnExitJournalLines(
  params: BuildWorkmanshipReturnParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING, ...params.mapping };
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactReturn = params.exactAmountRials !== undefined
    ? Math.round(params.exactAmountRials)
    : roundingDiff !== 0
      ? Math.round(params.amountRials - roundingDiff)
      : Math.round(params.amountRials);
  const supplierDebitAmount = exactReturn + roundingDiff;

  const lines: JournalLineInput[] = [];
  const weightText = params.weightGrams ? ` (وزن: ${params.weightGrams.toFixed(3)} گرم)` : '';

  // ۱. بدهکار: طرف‌حساب (کاهش بدهی به تأمین‌کننده / بدهکاری او)
  lines.push({
    accountId: map.counterpartyLiabilityAccountId || SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
    accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
    accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
    debit: supplierDebitAmount,
    credit: 0,
    description: `بدهکار طرف‌حساب ${params.customerName} بابت برگشت از خرید (خروج مرجوعی) کارساخته ${params.workmanshipName}`,
    partyId: params.customerId,
  });

  // ۲. تعدیلات گرد کردن
  if (roundingDiff < 0) {
    lines.push({
      accountId: map.roundingExpenseAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountName: 'سایر هزینه‌های عملیاتی - تعدیلات گرد کردن',
      debit: Math.abs(roundingDiff),
      credit: 0,
      description: `تعدیلات ناشی از گرد کردن در برگشت از خرید به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  // ۳. بستانکار: برگشت از خرید و تخفیفات
  lines.push({
    accountId: map.purchaseReturnAccountId || '5150',
    accountCode: '5150',
    accountName: 'برگشت از خرید و تخفیفات',
    debit: 0,
    credit: exactReturn,
    description: `برگشت از خرید کارساخته: ${params.workmanshipName}${weightText} به ${params.customerName}`,
    partyId: params.customerId,
  });

  // ۴. تعدیلات گرد کردن مثبت
  if (roundingDiff > 0) {
    lines.push({
      accountId: map.roundingIncomeAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountName: 'سایر درآمدها - اضافات گرد کردن',
      debit: 0,
      credit: roundingDiff,
      description: `اضافه ناشی از گرد کردن در برگشت از خرید به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  return lines;
}

/**
 * فروش کار ساخته (Sale of Manufactured Gold / Jewelry):
 * ۱. بدهکار: حساب‌های دریافتنی تجاری / طرف‌حساب (کد ۱۱۲۰)
 * ۲. بستانکار: درآمد فروش مصنوعات (کد ۴۱۲۰)
 */
export function buildWorkmanshipSaleJournalLines(
  params: BuildWorkmanshipReturnParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING, ...params.mapping };
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactRevenue = params.exactAmountRials !== undefined
    ? Math.round(params.exactAmountRials)
    : roundingDiff !== 0
      ? Math.round(params.amountRials - roundingDiff)
      : Math.round(params.amountRials);
  const customerReceivableAmount = exactRevenue + roundingDiff;

  const lines: JournalLineInput[] = [];
  const weightText = params.weightGrams ? ` (${params.weightGrams.toFixed(3)} گرم)` : '';

  lines.push({
    accountId: map.counterpartyReceivableAccountId || SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
    accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
    accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
    debit: customerReceivableAmount,
    credit: 0,
    description: `بدهکار طرف‌حساب ${params.customerName} بابت فروش کارساخته ${params.workmanshipName}${weightText}`,
    partyId: params.customerId,
  });

  if (roundingDiff < 0) {
    lines.push({
      accountId: map.roundingExpenseAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountName: 'سایر هزینه‌های عملیاتی - تعدیلات گرد کردن',
      debit: Math.abs(roundingDiff),
      credit: 0,
      description: `تعدیلات و کسر ناشی از گرد کردن در فروش به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  lines.push({
    accountId: map.workmanshipSalesRevenueAccountId || '4120',
    accountCode: '4120',
    accountName: 'درآمد فروش مصنوعات',
    debit: 0,
    credit: exactRevenue,
    description: `شناسایی درآمد حاصل از فروش کارساخته ${params.workmanshipName}${weightText} به ${params.customerName}`,
    partyId: params.customerId,
  });

  if (roundingDiff > 0) {
    lines.push({
      accountId: map.roundingIncomeAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountName: 'سایر درآمدها - اضافات گرد کردن',
      debit: 0,
      credit: roundingDiff,
      description: `اضافه ناشی از گرد کردن در فروش به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  return lines;
}

/**
 * خرید کار ساخته (Purchase of Manufactured Gold / Jewelry):
 * ۱. بدهکار: موجودی کار ساخته / طلا (کد ۱۱۳۰ یا ۱۱۳۰۶۰)
 * ۲. بستانکار: بستانکاران تجاری / طرف‌حساب (کد ۲۱۲۰)
 */
export function buildWorkmanshipPurchaseJournalLines(
  params: BuildWorkmanshipReturnParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_WORKMANSHIP_ACCOUNT_MAPPING, ...params.mapping };
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactGoodsValue = params.exactAmountRials !== undefined
    ? Math.round(params.exactAmountRials)
    : roundingDiff !== 0
      ? Math.round(params.amountRials - roundingDiff)
      : Math.round(params.amountRials);
  const supplierPayableAmount = exactGoodsValue + roundingDiff;

  const lines: JournalLineInput[] = [];
  const weightText = params.weightGrams ? ` (${params.weightGrams.toFixed(3)} گرم)` : '';

  lines.push({
    accountId: map.workmanshipInventoryAccountId || SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY,
    accountCode: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY,
    accountName: 'موجودی کارساخته و طلا',
    debit: exactGoodsValue,
    credit: 0,
    description: `خرید کارساخته ${params.workmanshipName}${weightText} از ${params.customerName}`,
    partyId: params.customerId,
  });

  if (roundingDiff > 0) {
    lines.push({
      accountId: map.roundingExpenseAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountName: 'سایر هزینه‌های عملیاتی - تعدیلات گرد کردن',
      debit: roundingDiff,
      credit: 0,
      description: `تعدیلات و اضافه پرداختی ناشی از گرد کردن در خرید از ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  lines.push({
    accountId: map.counterpartyLiabilityAccountId || SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
    accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
    accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
    debit: 0,
    credit: supplierPayableAmount,
    description: `بستانکاری طرف‌حساب ${params.customerName} بابت خرید کارساخته ${params.workmanshipName}`,
    partyId: params.customerId,
  });

  if (roundingDiff < 0) {
    lines.push({
      accountId: map.roundingIncomeAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountName: 'سایر درآمدها - کسر و اضافات گرد کردن',
      debit: 0,
      credit: Math.abs(roundingDiff),
      description: `تخفیف و کسر ناشی از گرد کردن در خرید از ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  return lines;
}
