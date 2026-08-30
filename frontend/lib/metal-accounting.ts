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
}

export const DEFAULT_METAL_ACCOUNT_MAPPING: MetalAccountMapping = {
  metalInventoryAccountId: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY, // 1130
  goldSalesRevenueAccountId: SYSTEM_ACCOUNT_CODES.GOLD_SALES_REVENUE, // 4110
  goldCostOfSalesAccountId: SYSTEM_ACCOUNT_CODES.GOLD_COST_OF_SALES, // 5200
  counterpartyLiabilityAccountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY, // 2120
  counterpartyReceivableAccountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE, // 1120
  wageIncomeAccountId: '4120',
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

/**
 * Prepares planned Double-Entry Journal template lines for Metal Transactions
 * (Ready for Phase 2 implementation without hardcoding brittle assumptions).
 */
export function buildMetalPurchaseJournalLines(params: {
  amountRials: number;
  weightGrams750: number;
  customerId: string;
  customerName: string;
  mapping?: Partial<MetalAccountMapping>;
}): JournalLineInput[] {
  const map = { ...DEFAULT_METAL_ACCOUNT_MAPPING, ...params.mapping };
  const amount = Math.round(params.amountRials);

  return [
    {
      accountId: map.metalInventoryAccountId,
      accountCode: SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY,
      accountName: 'موجودی طلا و فلزات گرانبها',
      debit: amount,
      credit: 0,
      description: `خرید طلا معادل ۷۵۰ به وزن ${params.weightGrams750.toFixed(3)} گرم از ${params.customerName}`,
      partyId: params.customerId,
    },
    {
      accountId: map.counterpartyLiabilityAccountId,
      accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
      accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
      debit: 0,
      credit: amount,
      description: `بستانکاری طرف‌حساب ${params.customerName} بابت تحویل طلا`,
      partyId: params.customerId,
    },
  ];
}

export function buildMetalSaleJournalLines(params: {
  salesRevenueRials: number;
  costOfSalesRials: number;
  weightGrams750: number;
  customerId: string;
  customerName: string;
  mapping?: Partial<MetalAccountMapping>;
}): JournalLineInput[] {
  const map = { ...DEFAULT_METAL_ACCOUNT_MAPPING, ...params.mapping };
  const salesAmount = Math.round(params.salesRevenueRials);
  const costAmount = Math.round(params.costOfSalesRials);

  return [
    // 1. Debt recognition for Customer
    {
      accountId: map.counterpartyReceivableAccountId,
      accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
      accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
      debit: salesAmount,
      credit: 0,
      description: `بدهکار طرف‌حساب ${params.customerName} بابت فروش طلا (${params.weightGrams750.toFixed(3)} گرم)`,
      partyId: params.customerId,
    },
    // 2. Sales Revenue recognition
    {
      accountId: map.goldSalesRevenueAccountId,
      accountCode: SYSTEM_ACCOUNT_CODES.GOLD_SALES_REVENUE,
      accountName: 'درآمد حاصل از فروش طلا و مسکوکات',
      debit: 0,
      credit: salesAmount,
      description: `شناسایی درآمد حاصل از فروش طلا به ${params.customerName}`,
      partyId: params.customerId,
    },
  ];
}
