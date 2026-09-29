import 'server-only';

import type PocketBase from 'pocketbase';
import { SYSTEM_ACCOUNT_CODES, type JournalLineInput } from '@/lib/accounting-posting-engine';

export interface GemstoneAccountMapping {
  /**
   * حساب معین موجودی مواد و کالا (موجودی سنگ و نگین‌های قیمتی/نیمه‌قیمتی)
   * پیش‌فرض: ۱۱۳۰
   */
  gemstoneInventoryAccountId: string;

  /**
   * حساب معین درآمد حاصل از فروش سنگ و مصنوعات جواهر
   * پیش‌فرض: ۴۱۱۰
   */
  gemstoneSalesRevenueAccountId: string;

  /**
   * حساب معین طرف‌های حساب تجاری / بستانکاران (در خرید سنگ)
   * پیش‌فرض: ۲۱۲۰
   */
  counterpartyLiabilityAccountId: string;

  /**
   * حساب معین اسناد و حساب‌های دریافتنی تجاری (در فروش سنگ)
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

export const DEFAULT_GEMSTONE_ACCOUNT_MAPPING: GemstoneAccountMapping = {
  gemstoneInventoryAccountId: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY, // 1130
  gemstoneSalesRevenueAccountId: SYSTEM_ACCOUNT_CODES.GOLD_SALES_REVENUE, // 4110
  counterpartyLiabilityAccountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY, // 2120
  counterpartyReceivableAccountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE, // 1120
  roundingExpenseAccountId: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE, // 6500
  roundingIncomeAccountId: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME, // 4300
};

/**
 * Resolves account mapping from system settings or falls back to system chart defaults.
 */
export async function resolveGemstoneAccountMapping(
  pb?: PocketBase,
): Promise<GemstoneAccountMapping> {
  if (!pb) {
    return { ...DEFAULT_GEMSTONE_ACCOUNT_MAPPING };
  }

  try {
    const settingsRecord = await pb.collection('system_settings').getFirstListItem(
      pb.filter('key = {:key}', { key: 'gemstone_accounting_mapping' }),
    ).catch(() => null);

    if (settingsRecord?.value && typeof settingsRecord.value === 'object') {
      return {
        ...DEFAULT_GEMSTONE_ACCOUNT_MAPPING,
        ...settingsRecord.value,
      };
    }
  } catch {
    // collection may not exist yet
  }

  return { ...DEFAULT_GEMSTONE_ACCOUNT_MAPPING };
}

export interface BuildStonePurchaseJournalLinesParams {
  amountRials?: number;
  purchaseCostRials?: number;
  speciesName: string;
  carats?: number;
  grams?: number;
  pieces?: number;
  customerId: string;
  customerName: string;
  mapping?: Partial<GemstoneAccountMapping>;
  exactAmountRials?: number;
  roundingDifference?: number;
}

/**
 * Prepares planned Double-Entry Journal template lines for Gemstone Purchase Transactions.
 *
 * خرید سنگ از مشتری:
 * طبق قاعده بازار: خرید سنگ از مشتری یعنی مشتری سنگ رو به ما بدهکاره (طرف‌حساب بدهکار می‌شود)
 * ۱. بدهکار: حساب‌ها و اسناد دریافتنی تجاری / طرف‌حساب‌ها (کد ۱۱۲۰) - بدهی مشتری به ما
 * ۲. بستانکار: موجودی کالا و سنگ‌های قیمتی (کد ۱۱۳۰)
 * ۳. در صورت اختلاف گرد کردن: حساب‌های هزینه/درآمد گرد کردن (۶۵۰۰ / ۴۳۰۰)
 */
export function buildStonePurchaseJournalLines(
  params: BuildStonePurchaseJournalLinesParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_GEMSTONE_ACCOUNT_MAPPING, ...params.mapping };
  const rawAmount = params.amountRials ?? params.purchaseCostRials ?? 0;
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactGoodsValue = params.exactAmountRials !== undefined
    ? Math.round(params.exactAmountRials)
    : roundingDiff !== 0
      ? Math.round(rawAmount - roundingDiff)
      : Math.round(rawAmount);
  const customerDebtorAmount = exactGoodsValue + roundingDiff;

  const lines: JournalLineInput[] = [];

  const weightDesc = params.carats && params.carats > 0
    ? ` به وزن ${params.carats.toFixed(3)} قیراط`
    : params.grams && params.grams > 0
      ? ` به وزن ${params.grams.toFixed(4)} گرم`
      : params.pieces && params.pieces > 0
        ? ` به تعداد ${params.pieces} دانه`
        : '';

  // 1. Counterparty Debit recognition - مشتری سنگ رو به ما بدهکاره (طرف‌حساب بدهکار می‌شود)
  lines.push({
    accountId: map.counterpartyReceivableAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
    accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
    debit: customerDebtorAmount,
    credit: 0,
    description: `بدهکار طرف‌حساب ${params.customerName} بابت خرید سنگ (${params.speciesName}${weightDesc}) - مشتری سنگ رو به ما بدهکاره`,
    partyId: params.customerId,
  });

  // 2. If purchase rounded up (we charged/recorded extra -> Expense)
  if (roundingDiff > 0) {
    lines.push({
      accountId: map.roundingExpenseAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountName: 'سایر هزینه‌های عملیاتی - تعدیلات گرد کردن',
      debit: roundingDiff,
      credit: 0,
      description: `تعدیلات و اضافه ناشی از گرد کردن در خرید سنگ از ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  // 3. Inventory Asset recognition (Credit) - خروج/تعهد موجودی سنگ
  lines.push({
    accountId: map.gemstoneInventoryAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY,
    accountName: 'موجودی کالا و سنگ‌های قیمتی',
    debit: 0,
    credit: exactGoodsValue,
    description: `خرید سنگ ${params.speciesName}${weightDesc} از طرف‌حساب ${params.customerName}`,
    partyId: params.customerId,
  });

  // 4. If purchase rounded down (we recorded less -> Gain/Income)
  if (roundingDiff < 0) {
    lines.push({
      accountId: map.roundingIncomeAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountName: 'سایر درآمدها - کسر ناشی از گرد کردن',
      debit: 0,
      credit: Math.abs(roundingDiff),
      description: `کسر ناشی از گرد کردن در خرید سنگ از ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  return lines;
}

export interface BuildStoneSaleJournalLinesParams {
  salesRevenueRials?: number;
  amountRials?: number;
  speciesName: string;
  carats?: number;
  grams?: number;
  pieces?: number;
  customerId: string;
  customerName: string;
  mapping?: Partial<GemstoneAccountMapping>;
  roundingDifference?: number;
  exactRevenueRials?: number;
}

/**
 * Prepares planned Double-Entry Journal template lines for Gemstone Sale Transactions.
 *
 * فروش سنگ به مشتری:
 * طبق قاعده بازار: فروش سنگ به مشتری یعنی مشتری از ما طلب کاره (طرف‌حساب بستانکار می‌شود)
 * ۱. بستانکار: بستانکاران تجاری / طرف‌حساب‌ها (کد ۲۱۲۰) - طلب مشتری از ما
 * ۲. بدهکار: موجودی سنگ و نگین (کد ۱۱۳۰)
 * ۳. در صورت اختلاف گرد کردن: حساب‌های هزینه/درآمد گرد کردن (۶۵۰۰ / ۴۳۰۰)
 */
export function buildStoneSaleJournalLines(
  params: BuildStoneSaleJournalLinesParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_GEMSTONE_ACCOUNT_MAPPING, ...params.mapping };
  const rawRevenue = params.salesRevenueRials ?? params.amountRials ?? 0;
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactRevenue = params.exactRevenueRials !== undefined
    ? Math.round(params.exactRevenueRials)
    : roundingDiff !== 0
      ? Math.round(rawRevenue - roundingDiff)
      : Math.round(rawRevenue);
  const customerCreditorAmount = exactRevenue + roundingDiff;

  const lines: JournalLineInput[] = [];

  const weightDesc = params.carats && params.carats > 0
    ? ` (${params.carats.toFixed(3)} ct)`
    : params.grams && params.grams > 0
      ? ` (${params.grams.toFixed(4)} g)`
      : params.pieces && params.pieces > 0
        ? ` (${params.pieces} دانه)`
        : '';

  // 1. Inventory Asset recognition (Debit)
  lines.push({
    accountId: map.gemstoneInventoryAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY,
    accountName: 'موجودی کالا و سنگ‌های قیمتی',
    debit: exactRevenue,
    credit: 0,
    description: `فروش سنگ ${params.speciesName}${weightDesc} به ${params.customerName}`,
    partyId: params.customerId,
  });

  // 2. If rounded down (seller absorbed the discount -> Operating Expense)
  if (roundingDiff < 0) {
    lines.push({
      accountId: map.roundingExpenseAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE,
      accountName: 'سایر هزینه‌های عملیاتی - تعدیلات گرد کردن',
      debit: Math.abs(roundingDiff),
      credit: 0,
      description: `تعدیلات و کسر ناشی از گرد کردن در فروش سنگ به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  // 3. Customer Creditor recognition (Credit) - مشتری از ما طلب‌کاره (طرف‌حساب بستانکار می‌شود)
  lines.push({
    accountId: map.counterpartyLiabilityAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
    accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
    debit: 0,
    credit: customerCreditorAmount,
    description: `بستانکاری طرف‌حساب ${params.customerName} بابت فروش سنگ (${params.speciesName}${weightDesc}) - مشتری از ما طلب‌کاره`,
    partyId: params.customerId,
  });

  // 4. If rounded up (seller received extra -> Other Income)
  if (roundingDiff > 0) {
    lines.push({
      accountId: map.roundingIncomeAccountId || SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountCode: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME,
      accountName: 'سایر درآمدها - اضافات گرد کردن',
      debit: 0,
      credit: roundingDiff,
      description: `اضافه ناشی از گرد کردن در فروش سنگ به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  return lines;
}
