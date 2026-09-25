import 'server-only';

import { SYSTEM_ACCOUNT_CODES, type JournalLineInput } from '@/lib/accounting-posting-engine';

export interface CurrencyAccountMapping {
  cashAndBankAccountId: string; // 1110
  counterpartyReceivableAccountId: string; // 1120
  counterpartyLiabilityAccountId: string; // 2120
}

export const DEFAULT_CURRENCY_ACCOUNT_MAPPING: CurrencyAccountMapping = {
  cashAndBankAccountId: SYSTEM_ACCOUNT_CODES.CASH_AND_BANK, // 1110
  counterpartyReceivableAccountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE, // 1120
  counterpartyLiabilityAccountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY, // 2120
};

export interface BuildCurrencyJournalLinesParams {
  tradeType: 'purchase' | 'sale'; // purchase = خرید ارز (received), sale = فروش ارز (paid)
  isUnsettled: boolean;
  currencyUnit: string;
  currencyQuantity: number;
  rialTotalAmount: number;
  customerId: string;
  customerName: string;
  cashFundAccountId?: string;
  mapping?: Partial<CurrencyAccountMapping>;
}

/**
 * Prepares planned Double-Entry Journal lines for Currency Trade Transactions.
 *
 * 1. خرید ارز با تسویه (Settled Purchase):
 *    بدهکار: صندوق ارز (1110 یا سرفصل تفضیلی صندوق) بابت ورود وجه نقد ارزی
 *    بستانکار: طرف‌حساب (2120 بستانکاران تجاری) بابت بستانکاری مالی حاصل از فروش ارز
 *
 * 2. خرید ارز بدون تسویه (Unsettled Purchase):
 *    بدهکار: اسناد و حساب‌های دریافتنی تجاری (1120) بابت تعهد تحویل ارز طرف‌حساب (بدهکار ارزی)
 *    بستانکار: طرف‌حساب (2120 بستانکاران تجاری) بابت طلب ریالی طرف‌حساب (بستانکار مالی)
 *
 * 3. فروش ارز با تسویه (Settled Sale):
 *    بدهکار: طرف‌حساب (1120 حساب‌های دریافتنی تجاری) بابت بدهکاری مالی خرید ارز
 *    بستانکار: صندوق ارز (1110 یا سرفصل تفضیلی صندوق) بابت خروج وجه نقد ارزی
 *
 * 4. فروش ارز بدون تسویه (Unsettled Sale):
 *    بدهکار: طرف‌حساب (1120 حساب‌های دریافتنی تجاری) بابت بدهکاری مالی خرید ارز
 *    بستانکار: بستانکاران تجاری (2120) بابت تعهد تحویل ارز به طرف‌حساب (بستانکاری ارزی)
 */
export function buildCurrencyJournalLines(
  params: BuildCurrencyJournalLinesParams,
): JournalLineInput[] {
  const map = { ...DEFAULT_CURRENCY_ACCOUNT_MAPPING, ...params.mapping };
  const roundedRial = Math.round(params.rialTotalAmount);
  const lines: JournalLineInput[] = [];

  const cashAccount = params.cashFundAccountId || map.cashAndBankAccountId;

  if (params.tradeType === 'purchase') {
    // خرید ارز (Nature: received)
    if (params.isUnsettled) {
      // خرید بدون تسویه:
      // بدهکار: دریافتنی ارزی از طرف‌حساب (1120)
      lines.push({
        accountId: map.counterpartyReceivableAccountId,
        accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
        accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
        debit: roundedRial,
        credit: 0,
        description: `بدهکاری ارزی طرف‌حساب ${params.customerName} بابت خرید نسیه ${params.currencyQuantity} ${params.currencyUnit}`,
        partyId: params.customerId,
      });

      // بستانکار: بستانکاران تجاری (2120)
      lines.push({
        accountId: map.counterpartyLiabilityAccountId,
        accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
        accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
        debit: 0,
        credit: roundedRial,
        description: `بستانکاری مالی طرف‌حساب ${params.customerName} بابت فروش ارز ${params.currencyUnit}`,
        partyId: params.customerId,
      });
    } else {
      // خرید با تسویه نقد:
      // بدهکار: موجودی صندوق ارز (1110)
      lines.push({
        accountId: cashAccount,
        accountCode: SYSTEM_ACCOUNT_CODES.CASH_AND_BANK,
        accountName: 'موجودی نقد و بانک - صندوق ارز',
        debit: roundedRial,
        credit: 0,
        description: `ورود نقدی ${params.currencyQuantity} ${params.currencyUnit} به صندوق بابت خرید ارز از ${params.customerName}`,
        partyId: params.customerId,
      });

      // بستانکار: طرف‌حساب (2120)
      lines.push({
        accountId: map.counterpartyLiabilityAccountId,
        accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
        accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
        debit: 0,
        credit: roundedRial,
        description: `بستانکاری طرف‌حساب ${params.customerName} بابت تحویل ${params.currencyQuantity} ${params.currencyUnit}`,
        partyId: params.customerId,
      });
    }
  } else {
    // فروش ارز (Nature: paid)
    if (params.isUnsettled) {
      // فروش بدون تسویه:
      // بدهکار: حساب‌های دریافتنی تجاری (1120)
      lines.push({
        accountId: map.counterpartyReceivableAccountId,
        accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
        accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
        debit: roundedRial,
        credit: 0,
        description: `بدهکاری مالی طرف‌حساب ${params.customerName} بابت معامله فروش ارز ${params.currencyUnit} بدون تسویه`,
        partyId: params.customerId,
      });

      // بستانکار: تعهد ارزی (2120)
      lines.push({
        accountId: map.counterpartyLiabilityAccountId,
        accountCode: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
        accountName: 'بستانکاران تجاری / طرف‌حساب‌ها',
        debit: 0,
        credit: roundedRial,
        description: `تعهد ارزی (بستانکاری ارزی) طرف‌حساب ${params.customerName} بابت خرید نسیه ${params.currencyQuantity} ${params.currencyUnit}`,
        partyId: params.customerId,
      });
    } else {
      // فروش با تسویه نقد:
      // بدهکار: حساب دریافتنی از مشتری (1120)
      lines.push({
        accountId: map.counterpartyReceivableAccountId,
        accountCode: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
        accountName: 'حساب‌ها و اسناد دریافتنی تجاری',
        debit: roundedRial,
        credit: 0,
        description: `بدهکاری طرف‌حساب ${params.customerName} بابت خرید ${params.currencyQuantity} ${params.currencyUnit}`,
        partyId: params.customerId,
      });

      // بستانکار: موجودی صندوق ارز (1110)
      lines.push({
        accountId: cashAccount,
        accountCode: SYSTEM_ACCOUNT_CODES.CASH_AND_BANK,
        accountName: 'موجودی نقد و بانک - صندوق ارز',
        debit: 0,
        credit: roundedRial,
        description: `خروج نقدی ${params.currencyQuantity} ${params.currencyUnit} از صندوق بابت فروش ارز به ${params.customerName}`,
        partyId: params.customerId,
      });
    }
  }

  return lines;
}
