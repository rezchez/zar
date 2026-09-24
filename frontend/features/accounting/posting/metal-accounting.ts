import 'server-only';

import type PocketBase from 'pocketbase';
import { SYSTEM_ACCOUNT_CODES, type JournalLineInput } from '@/lib/accounting-posting-engine';
import { DEFAULT_CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts';

export interface MetalAccountMapping {
  /**
   * حساب معین موجودی مواد و کالا (موجودی طلا و فلزات گرانبها)
   * پیش‌فرض: ۱۱۳۰
   */
  metalInventoryAccountId: string;

  /**
   * حساب معین درآمد حاصل از فروش طلا و مصنوعات
   * پیش‌فرض: ۴۱۱۰
   */
  goldSalesRevenueAccountId: string;

  /**
   * حساب معین بهای تمام‌شده کالای فروش‌رفته (طلا و مسکوکات)
   * پیش‌فرض: ۵۲۰۰
   */
  goldCostOfSalesAccountId: string;

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
   * حساب معین درآمد حاصل از اجرت ساخت و خدمات
   * پیش‌فرض: ۴۱۲۰
   */
  wageIncomeAccountId?: string;

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

export const DEFAULT_METAL_ACCOUNT_MAPPING: MetalAccountMapping = {
  metalInventoryAccountId: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY, // 1130
  goldSalesRevenueAccountId: SYSTEM_ACCOUNT_CODES.GOLD_SALES_REVENUE, // 4110
  goldCostOfSalesAccountId: SYSTEM_ACCOUNT_CODES.GOLD_COST_OF_SALES, // 5200
  counterpartyLiabilityAccountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY, // 2120
  counterpartyReceivableAccountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE, // 1120
  wageIncomeAccountId: '4120',
  roundingExpenseAccountId: SYSTEM_ACCOUNT_CODES.ROUNDING_EXPENSE, // 6500
  roundingIncomeAccountId: SYSTEM_ACCOUNT_CODES.ROUNDING_INCOME, // 4300
};

/**
 * Resolves account mapping from system settings or falls back to system chart defaults.
 */
export async function resolveMetalAccountMapping(
  pb?: PocketBase,
): Promise<MetalAccountMapping> {
  if (!pb) {
    return { ...DEFAULT_METAL_ACCOUNT_MAPPING };
  }

  try {
    const settingsRecord = await pb.collection('system_settings').getFirstListItem(
      pb.filter('key = {:key}', { key: 'metal_accounting_mapping' }),
    ).catch(() => null);

    if (settingsRecord?.value && typeof settingsRecord.value === 'object') {
      return {
        ...DEFAULT_METAL_ACCOUNT_MAPPING,
        ...settingsRecord.value,
      };
    }
  } catch {
    // collection may not exist yet in Phase 1
  }

  return { ...DEFAULT_METAL_ACCOUNT_MAPPING };
}

export interface BuildMetalPurchaseJournalLinesParams {
  amountRials: number;
  weightGrams750: number;
  customerId: string;
  customerName: string;
  mapping?: Partial<MetalAccountMapping>;
  exactAmountRials?: number;
  roundingDifference?: number;
}

/**
 * Prepares planned Double-Entry Journal template lines for Metal Purchase Transactions.
 */
export function buildMetalPurchaseJournalLines(
  params: BuildMetalPurchaseJournalLinesParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_METAL_ACCOUNT_MAPPING, ...params.mapping };
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactGoodsValue = params.exactAmountRials !== undefined
    ? Math.round(params.exactAmountRials)
    : roundingDiff !== 0
      ? Math.round(params.amountRials - roundingDiff)
      : Math.round(params.amountRials);
  const supplierPayableAmount = exactGoodsValue + roundingDiff;

  const lines: JournalLineInput[] = [];

  // 1. Inventory Asset increase
  lines.push({
    accountId: map.metalInventoryAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY,
    accountName: 'موجودی طلا و فلزات گرانبها',
    debit: exactGoodsValue,
    credit: 0,
    description: `خرید طلا معادل ۷۵۰ به وزن ${params.weightGrams750.toFixed(3)} گرم از ${params.customerName}`,
    partyId: params.customerId,
  });

  // 2. If purchase rounded up (we paid more -> Expense)
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

  // 3. Supplier Liability recognition
  lines.push({
    accountId: map.counterpartyLiabilityAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
    accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
    debit: 0,
    credit: supplierPayableAmount,
    description: `بستانکاری طرف‌حساب ${params.customerName} بابت تحویل طلا`,
    partyId: params.customerId,
  });

  // 4. If purchase rounded down (we paid less -> Gain/Income)
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

export interface BuildMetalSaleJournalLinesParams {
  salesRevenueRials: number;
  costOfSalesRials?: number;
  weightGrams750: number;
  customerId: string;
  customerName: string;
  mapping?: Partial<MetalAccountMapping>;
  roundingDifference?: number;
  exactRevenueRials?: number;
}

/**
 * Prepares planned Double-Entry Journal template lines for Metal Sale Transactions.
 * Accurately creates distinct journal lines for rounding adjustments (account 6500 or 4300).
 */
export function buildMetalSaleJournalLines(
  params: BuildMetalSaleJournalLinesParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_METAL_ACCOUNT_MAPPING, ...params.mapping };
  const roundingDiff = Math.round(params.roundingDifference ?? 0);
  const exactRevenue = params.exactRevenueRials !== undefined
    ? Math.round(params.exactRevenueRials)
    : roundingDiff !== 0
      ? Math.round(params.salesRevenueRials - roundingDiff)
      : Math.round(params.salesRevenueRials);
  const customerReceivableAmount = exactRevenue + roundingDiff;

  const lines: JournalLineInput[] = [];

  // 1. Debt recognition for Customer (charged with final rounded/receivable amount)
  lines.push({
    accountId: map.counterpartyReceivableAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
    accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
    debit: customerReceivableAmount,
    credit: 0,
    description: `بدهکار طرف‌حساب ${params.customerName} بابت فروش طلا (${params.weightGrams750.toFixed(3)} گرم)`,
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
      description: `تعدیلات و کسر ناشی از گرد کردن در فروش به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  // 3. Sales Revenue recognition (credited with exact unrounded revenue)
  lines.push({
    accountId: map.goldSalesRevenueAccountId,
    accountCode: SYSTEM_ACCOUNT_CODES.GOLD_SALES_REVENUE,
    accountName: 'درآمد حاصل از فروش طلا و مسکوکات',
    debit: 0,
    credit: exactRevenue,
    description: `شناسایی درآمد حاصل از فروش طلا به ${params.customerName}`,
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
      description: `اضافه ناشی از گرد کردن در فروش به ${params.customerName}`,
      partyId: params.customerId,
    });
  }

  return lines;
}

export { postMetalSale, postMetalPurchase } from './posting-engine';

