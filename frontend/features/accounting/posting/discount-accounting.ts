import 'server-only';

import type PocketBase from 'pocketbase';
import { SYSTEM_ACCOUNT_CODES, type JournalLineInput } from '@/lib/accounting-posting-engine';

export interface DiscountAccountMapping {
  /**
   * حساب معین تخفیفات اعطایی فروش (Sales Discounts)
   * پیش‌فرض: ۴۱۶۰ (در صورت عدم وجود سرفصل اختصاصی: ۴۱۵۰ یا ۴۱۰۰ یا ۶۲۰۰)
   */
  salesDiscountAccountId: string;

  /**
   * حساب معین تخفیفات دریافتی خرید (Purchase Discounts)
   * پیش‌فرض: ۵۱۶۰ (در صورت عدم وجود سرفصل اختصاصی: ۵۱۵۰ یا ۵۱۰۰ یا ۴۳۰۰)
   */
  purchaseDiscountAccountId: string;

  /**
   * حساب معین اسناد و حساب‌های دریافتنی تجاری / طرف‌حساب (مشتری بدهکار)
   * پیش‌فرض: ۱۱۲۰
   */
  counterpartyReceivableAccountId: string;

  /**
   * حساب معین بستانکاران تجاری / طرف‌حساب‌ها (مشتری بستانکار)
   * پیش‌فرض: ۲۱۲۰
   */
  counterpartyLiabilityAccountId: string;
}

export const DEFAULT_DISCOUNT_ACCOUNT_MAPPING: DiscountAccountMapping = {
  salesDiscountAccountId: '4160', // تخفیفات اعطایی فروش
  purchaseDiscountAccountId: '5160', // تخفیفات دریافتی خرید
  counterpartyReceivableAccountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE, // 1120
  counterpartyLiabilityAccountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY, // 2120
};

/**
 * Resolves account mapping from system settings or falls back to system chart defaults.
 */
export async function resolveDiscountAccountMapping(
  pb?: PocketBase,
): Promise<DiscountAccountMapping> {
  if (!pb) {
    return { ...DEFAULT_DISCOUNT_ACCOUNT_MAPPING };
  }

  try {
    const settingsRecord = await pb.collection('system_settings').getFirstListItem(
      pb.filter('key = {:key}', { key: 'discount_accounting_mapping' }),
    ).catch(() => null);

    if (settingsRecord?.value && typeof settingsRecord.value === 'object') {
      return {
        ...DEFAULT_DISCOUNT_ACCOUNT_MAPPING,
        ...settingsRecord.value,
      };
    }
  } catch {
    // collection may not exist yet
  }

  return { ...DEFAULT_DISCOUNT_ACCOUNT_MAPPING };
}

export interface BuildDiscountJournalLinesParams {
  direction: 'given' | 'received'; // 'given' = تخفیف به طرف‌حساب (اعطایی), 'received' = تخفیف از طرف‌حساب (دریافتی)
  amountRials: number;
  discountPercentage?: number;
  baseAmountRials?: number;
  customerId: string;
  customerName: string;
  documentNumber?: string;
  description?: string;
  mapping?: Partial<DiscountAccountMapping>;
}

/**
 * Prepares balanced Double-Entry Journal lines for Discounts.
 *
 * ۱. تخفیف اعطایی به طرف‌حساب (Sales Discount / Given to Customer):
 *    بدهکار: تخفیفات اعطایی فروش (۴۱۶۰) بابت هزینه/کاهش درآمد فروش
 *    بستانکار: اسناد و حساب‌های دریافتنی تجاری / طرف‌حساب (۱۱۲۰) بابت کاهش طلب از مشتری
 *
 * ۲. تخفیف دریافتی از طرف‌حساب (Purchase Discount / Received from Supplier/Customer):
 *    بدهکار: بستانکاران تجاری / طرف‌حساب (۲۱۲۰) بابت کاهش بدهی به طرف‌حساب
 *    بستانکار: تخفیفات دریافتی خرید (۵۱۶۰) بابت درآمد/کاهش بهای تمام‌شده خرید
 */
export function buildDiscountJournalLines(
  params: BuildDiscountJournalLinesParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_DISCOUNT_ACCOUNT_MAPPING, ...params.mapping };
  const roundedAmount = Math.round(params.amountRials);
  if (roundedAmount <= 0) {
    throw new Error('مبلغ تخفیف باید بزرگتر از صفر باشد.');
  }

  const lines: JournalLineInput[] = [];
  const percentNote =
    params.discountPercentage && params.discountPercentage > 0
      ? ` (${params.discountPercentage}٪ از مبلغ پایه)`
      : '';

  if (params.direction === 'given') {
    // ۱. تخفیف اعطایی به طرف‌حساب (Sales Discount):
    // بدهکار: تخفیفات اعطایی فروش (4160)
    lines.push({
      accountId: map.salesDiscountAccountId,
      accountCode: '4160',
      accountName: 'تخفیفات اعطایی فروش',
      debit: roundedAmount,
      credit: 0,
      description:
        params.description ||
        `تخفیف اعطایی${percentNote} به طرف‌حساب ${params.customerName}${params.documentNumber ? ` (سند ${params.documentNumber})` : ''}`,
    });

    // بستانکار: اسناد و حساب‌های دریافتنی تجاری / طرف‌حساب (1120)
    lines.push({
      accountId: map.counterpartyReceivableAccountId,
      accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
      accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
      debit: 0,
      credit: roundedAmount,
      description: `بستانکاری طرف‌حساب ${params.customerName} بابت تخفیف اعطایی${percentNote}${params.documentNumber ? ` (سند ${params.documentNumber})` : ''}`,
      partyId: params.customerId,
    });
  } else {
    // ۲. تخفیف دریافتی از طرف‌حساب (Purchase Discount):
    // بدهکار: بستانکاران تجاری / طرف‌حساب (2120)
    lines.push({
      accountId: map.counterpartyLiabilityAccountId,
      accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
      accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
      debit: roundedAmount,
      credit: 0,
      description: `بدهکاری طرف‌حساب ${params.customerName} بابت تخفیف دریافتی${percentNote}${params.documentNumber ? ` (سند ${params.documentNumber})` : ''}`,
      partyId: params.customerId,
    });

    // بستانکار: تخفیفات دریافتی خرید (5160)
    lines.push({
      accountId: map.purchaseDiscountAccountId,
      accountCode: '5160',
      accountName: 'تخفیفات دریافتی خرید',
      debit: 0,
      credit: roundedAmount,
      description:
        params.description ||
        `تخفیف دریافتی${percentNote} از طرف‌حساب ${params.customerName}${params.documentNumber ? ` (سند ${params.documentNumber})` : ''}`,
    });
  }

  return lines;
}
