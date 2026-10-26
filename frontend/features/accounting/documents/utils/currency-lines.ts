import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { generateUUID } from '@/lib/uuid';
import { getDocumentLineForeignCurrency } from './currency-effects';
import { numberValue, sanitizeLineDetailsForTab } from './document-helpers';

export function createSettledCurrencyLines(
  line: DocumentLine,
  cashLineId = generateUUID(),
): [DocumentLine, DocumentLine] {
  const currency = getDocumentLineForeignCurrency(line);
  const isPurchase = line.documentNature === 'received';
  const trade: DocumentLine = {
    ...line,
    settlementMethod: 'cash',
    details: {
      ...line.details,
      currencyUnit: currency,
      unsettledTrade: false,
      hasChildLines: true,
      linkedLineId: cashLineId,
    },
  };
  const cash: DocumentLine = {
    id: cashLineId,
    documentNature: line.documentNature,
    documentTab: 'cash',
    sourceTab: 'cash',
    documentTypeLabel: isPurchase ? 'ورود وجه نقد' : 'خروج وجه نقد',
    documentSubType: isPurchase ? 'cash-in' : 'cash-out',
    settlementMethod: 'cash',
    balanceSource: 'current',
    description: `${isPurchase ? 'ورود' : 'خروج'} ${numberValue(line.details.currencyQuantity).toLocaleString('fa-IR')} ${currency} ${isPurchase ? 'به' : 'از'} صندوق ${line.details.cashFundName || ''} بابت ${isPurchase ? 'خرید' : 'فروش'} ارز`,
    details: sanitizeLineDetailsForTab('cash', {
      ...line.details,
      totalAmount: line.details.currencyQuantity,
      currencyUnit: currency,
      cashFundCurrencyCode: currency,
      isForeignCash: true,
      isChildLine: true,
      linkedLineId: line.id,
      unsettledTrade: false,
    }),
  };
  return [trade, cash];
}
