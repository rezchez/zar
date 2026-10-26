import { normalizeDigits } from '@/lib/jalali';

export type CoinBalanceLine = {
  documentTab?: string;
  sourceTab?: string;
  documentNature?: string;
  documentSubType?: string;
  converted750?: number;
  details?: Record<string, unknown> | null;
};

function numberValue(value: unknown): number {
  const parsed = Number(normalizeDigits(String(value ?? '')).replace(/[٬,]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getCoinIdentity(line: CoinBalanceLine): { id: string; name: string } {
  const details = line.details || {};
  return {
    id: String(details.coinType || '').trim(),
    name: String(details.coinBalanceName || details.coinName || details.coinTypeName || details.coinType || 'سکه/شمش نامشخص').trim(),
  };
}

/** Positive means coins are owed to the customer; negative means owed by the customer. */
export function getCoinBalanceEffect(line: CoinBalanceLine): number {
  const tab = line.documentTab || line.sourceTab;
  if (tab !== 'coin') return 0;
  const quantity = Math.abs(numberValue(line.details?.quantity || line.details?.currencyQuantity));
  if (quantity === 0) return 0;
  const subType = String(line.documentSubType || '').toLowerCase();
  if (subType === 'receipt_buy' || subType === 'payment_sale') return 0;
  const natureSign = line.documentNature === 'paid' ? -1 : 1;
  return natureSign * Math.round(quantity);
}

/** Physical movements include entry, exit, purchase, and sale; claim/debt rows are obligations only. */
export function getCoinInventoryEffect(line: CoinBalanceLine): number {
  const tab = line.documentTab || line.sourceTab;
  if (tab !== 'coin') return 0;
  const subType = String(line.documentSubType || '').toLowerCase();
  if (subType.includes('claim') || subType.includes('debt')) return 0;
  const quantity = Math.abs(numberValue(line.details?.quantity || line.details?.currencyQuantity));
  return (line.documentNature === 'paid' ? -1 : 1) * Math.round(quantity);
}

export function getCoinGoldEffect(line: CoinBalanceLine): number {
  const tab = line.documentTab || line.sourceTab;
  if (tab !== 'coin') return 0;
  const subType = String(line.documentSubType || '').toLowerCase();
  if (!subType.includes('unsettled') && !subType.includes('claim') && !subType.includes('debt')) return 0;
  const weight = Math.abs(numberValue(line.converted750 ?? line.details?.converted750 ?? line.details?.convertedWeight));
  return (line.documentNature === 'paid' ? -1 : 1) * weight;
}

export function sumCoinBalancesFromTransactions(
  transactions: Array<{ status?: string; documentTab?: string; sourceTab?: string; documentNature?: string; documentSubType?: string; documentDetails?: unknown }>,
): Record<string, number> {
  const balances: Record<string, number> = {};
  for (const transaction of transactions) {
    if (transaction.status !== 'posted' && transaction.status !== 'final') continue;
    let details: Record<string, unknown> = {};
    if (transaction.documentDetails && typeof transaction.documentDetails === 'object' && !Array.isArray(transaction.documentDetails)) {
      details = transaction.documentDetails as Record<string, unknown>;
    } else if (typeof transaction.documentDetails === 'string') {
      try {
        const parsed = JSON.parse(transaction.documentDetails);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) details = parsed;
      } catch { /* ignore malformed historical detail */ }
    }
    const line = { ...transaction, details };
    const effect = getCoinBalanceEffect(line);
    if (!effect) continue;
    const identity = getCoinIdentity(line);
    const key = identity.name || identity.id;
    balances[key] = (balances[key] || 0) + effect;
  }
  return balances;
}
