import { DEFAULT_BASE_KARATS, metalAtBaseKarat, roundWeight, type PreciousMetalType, type WeightDecimalPlaces } from './weight';

export type MetalInventoryType = 'conditional_melted' | 'miscellaneous_melted' | 'general_metal';

export interface MetalDocumentDetails {
  metalType: PreciousMetalType;
  inventoryType: MetalInventoryType;
  rawWeight: number;
  purity: number;
  baseKarat: number;
  convertedWeight: number;
  labName?: string;
  stampNumber?: string;
  totalAmount?: number;
  notes?: string;
}

export interface MetalOpeningRecord {
  id: string;
  metal: PreciousMetalType;
  inventoryType: MetalInventoryType;
  rawWeight: number;
  purity: number;
  baseKarat: number;
  convertedWeight: number;
  labName?: string;
  stampNumber?: string;
  totalAmount: number;
  date: string;
  description: string;
  createdBy?: string;
  created?: string;
  updated?: string;
}

export interface MetalBalanceState {
  rawOpening: number;
  convertedOpening: number;
  rawInflow: number;
  rawOutflow: number;
  currentRawBalance: number;
  currentConvertedBalance: number;
  openingCount: number;
}

export interface MultiMetalSummary {
  gold: MetalBalanceState;
  silver: MetalBalanceState;
  platinum: MetalBalanceState;
}

export function parseMetalDocumentDetails(raw: unknown): Partial<MetalDocumentDetails> {
  if (!raw) return {};
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Partial<MetalDocumentDetails>;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Partial<MetalDocumentDetails>;
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Calculates derived multi-metal balances strictly adhering to:
 * Current Balance(metal) = Opening Balance(metal) + Inflows(metal) - Outflows(metal)
 *
 * Gold, Silver, and Platinum are calculated completely independently and never mixed.
 */
export function calculateMetalInventoryBalances(
  transactions: Record<string, unknown>[],
  precision: WeightDecimalPlaces = 3,
): MultiMetalSummary {
  const summary: MultiMetalSummary = {
    gold: {
      rawOpening: 0,
      convertedOpening: 0,
      rawInflow: 0,
      rawOutflow: 0,
      currentRawBalance: 0,
      currentConvertedBalance: 0,
      openingCount: 0,
    },
    silver: {
      rawOpening: 0,
      convertedOpening: 0,
      rawInflow: 0,
      rawOutflow: 0,
      currentRawBalance: 0,
      currentConvertedBalance: 0,
      openingCount: 0,
    },
    platinum: {
      rawOpening: 0,
      convertedOpening: 0,
      rawInflow: 0,
      rawOutflow: 0,
      currentRawBalance: 0,
      currentConvertedBalance: 0,
      openingCount: 0,
    },
  };

  for (const tx of transactions) {
    if (tx.is_deleted) continue;

    const isOpening = Boolean(tx.isOpeningBalance || tx.transactionType === 'opening_balance');
    const nature = String(tx.documentNature || '').toLowerCase();
    const details = parseMetalDocumentDetails(tx.documentDetails);

    // 1. Gold
    const rawGold = Math.abs(Number(tx.goldAmount || 0));
    if (rawGold > 0) {
      const purity = Number(details.purity) || 750;
      const baseKarat = Number(details.baseKarat) || DEFAULT_BASE_KARATS.gold;
      const convertedGold = metalAtBaseKarat(rawGold, purity, baseKarat, precision);

      if (isOpening) {
        summary.gold.rawOpening = roundWeight(summary.gold.rawOpening + rawGold, precision);
        summary.gold.convertedOpening = roundWeight(summary.gold.convertedOpening + convertedGold, precision);
        summary.gold.openingCount += 1;
      } else if (nature === 'paid' || Number(tx.goldAmount) < 0) {
        summary.gold.rawOutflow = roundWeight(summary.gold.rawOutflow + rawGold, precision);
      } else {
        summary.gold.rawInflow = roundWeight(summary.gold.rawInflow + rawGold, precision);
      }
    }

    // 2. Silver
    const rawSilver = Math.abs(Number(tx.silverAmount || 0));
    if (rawSilver > 0) {
      const purity = Number(details.purity) || 999;
      const baseKarat = Number(details.baseKarat) || DEFAULT_BASE_KARATS.silver;
      const convertedSilver = metalAtBaseKarat(rawSilver, purity, baseKarat, precision);

      if (isOpening) {
        summary.silver.rawOpening = roundWeight(summary.silver.rawOpening + rawSilver, precision);
        summary.silver.convertedOpening = roundWeight(summary.silver.convertedOpening + convertedSilver, precision);
        summary.silver.openingCount += 1;
      } else if (nature === 'paid' || Number(tx.silverAmount) < 0) {
        summary.silver.rawOutflow = roundWeight(summary.silver.rawOutflow + rawSilver, precision);
      } else {
        summary.silver.rawInflow = roundWeight(summary.silver.rawInflow + rawSilver, precision);
      }
    }

    // 3. Platinum
    const rawPlatinum = Math.abs(Number(tx.platinumAmount || 0));
    if (rawPlatinum > 0) {
      const purity = Number(details.purity) || 950;
      const baseKarat = Number(details.baseKarat) || DEFAULT_BASE_KARATS.platinum;
      const convertedPlatinum = metalAtBaseKarat(rawPlatinum, purity, baseKarat, precision);

      if (isOpening) {
        summary.platinum.rawOpening = roundWeight(summary.platinum.rawOpening + rawPlatinum, precision);
        summary.platinum.convertedOpening = roundWeight(summary.platinum.convertedOpening + convertedPlatinum, precision);
        summary.platinum.openingCount += 1;
      } else if (nature === 'paid' || Number(tx.platinumAmount) < 0) {
        summary.platinum.rawOutflow = roundWeight(summary.platinum.rawOutflow + rawPlatinum, precision);
      } else {
        summary.platinum.rawInflow = roundWeight(summary.platinum.rawInflow + rawPlatinum, precision);
      }
    }
  }

  // Final deterministic balance calculation per metal
  for (const metal of ['gold', 'silver', 'platinum'] as const) {
    const s = summary[metal];
    s.currentRawBalance = roundWeight(s.rawOpening + s.rawInflow - s.rawOutflow, precision);
    // Base converted weight estimate for current net stock at base karat
    s.currentConvertedBalance = roundWeight(
      s.convertedOpening + (s.rawInflow - s.rawOutflow),
      precision,
    );
  }

  return summary;
}
