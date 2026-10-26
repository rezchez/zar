import { normalizeCurrencyCode } from '@/lib/customer';
import { normalizeDigits } from '@/lib/jalali';

type CurrencyLine = {
  documentTab?: string;
  sourceTab?: string;
  documentNature?: string;
  documentSubType?: string;
  settlementMethod?: string;
  details?: object | null;
};

function quantity(value: unknown): number {
  const parsed = Number(normalizeDigits(String(value ?? '')).replace(/[,٬]/g, ''));
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

export function getDocumentLineForeignCurrency(line: CurrencyLine): string {
  const details = (line.details || {}) as Record<string, unknown>;
  const tab = line.documentTab || line.sourceTab;
  const unit = tab === 'currency'
    ? details.currencyUnit
    : tab === 'cash' && details.isForeignCash === true
      ? details.currencyUnit || details.cashFundCurrencyCode
      : tab === 'stone'
        ? details.settlementCurrencyUnit
        : tab === 'workmanship' && line.documentSubType !== 'workmanship-golden-percentage'
          ? details.wageCurrency || details.currencyUnit
          : '';
  const code = normalizeCurrencyCode(String(unit || ''));
  return code && code !== 'IRR' && code !== 'IRT' ? code : '';
}

/** Customer credit is positive, customer debt is negative, in the traded currency. */
export function getCurrencyTradeForeignEffect(line: CurrencyLine): number | null {
  const tab = line.documentTab || line.sourceTab;
  const details = (line.details || {}) as Record<string, unknown>;
  const direction = line.documentNature === 'paid' ? -1 : 1;
  if (tab === 'cash' && details.isForeignCash === true) {
    return direction * quantity(details.totalAmount);
  }
  if (tab !== 'currency') return null;

  const amount = quantity(details.currencyQuantity);
  const subType = line.documentSubType || details.documentSubType;
  if (subType === 'currency-claim') return -amount;
  if (subType === 'currency-debt') return amount;
  const isUnsettled = details.unsettledTrade === true || line.settlementMethod === 'unsettled';
  // Unsettled trades have a separate claim/debt row. Settled trades with a
  // cash row first create the obligation, then the cash row clears it.
  if (isUnsettled) return details.linkedLineId ? 0 : -direction * amount;
  return details.hasChildLines === true && details.linkedLineId ? -direction * amount : 0;
}
