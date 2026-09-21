import type { DocumentLine } from '@/src/components/documents/RawGoldTab';
import { normalizeDigits, toPersianDigits } from '@/lib/jalali';

export type MetalType = 'gold' | 'silver' | 'platinum';

export type SettlementStatus =
  | 'unsettled_trade'      // معامله بدون تسویه (طلب/بدهی طلا و وجه در حساب)
  | 'fully_settled'        // تسویه کامل (ردیف فیزیکی معادل یا کامل وارد/خارج شده است)
  | 'partially_settled'    // تسویه ناقص (بخشی از فلز تسویه شده و بخشی باقیمانده است)
  | 'no_settlement_metal'; // معامله با تسویه اما ردیف فلز فیزیکی هنوز ثبت نشده است

export interface MetalSettlementItem {
  tradeLineIndex: number;
  lineId: string;
  metalType: MetalType;
  nature: 'received' | 'paid'; // received = خرید, paid = فروش
  rawKind: string;
  isUnsettledTrade: boolean;
  tradedRawWeight: number;
  tradedPurity: number;
  tradedBaseWeight: number;
  settledBaseWeight: number;
  remainingBaseWeight: number;
  settlementStatus: SettlementStatus;
  settlementPercentage: number;
}

export interface SettlementAnalysis {
  isFullySettled: boolean;
  hasUnsettledTrades: boolean;
  hasPartialSettlement: boolean;
  hasMissingSettlementMetal: boolean;
  items: MetalSettlementItem[];
}

export interface SettlementValidationResult {
  isValid: boolean;
  errors: string[];
  analysis: SettlementAnalysis;
}

export const BASE_KARATS: Record<MetalType, number> = {
  gold: 750,
  silver: 999,
  platinum: 999,
};

export function getMetalLabelFa(metal: MetalType): string {
  switch (metal) {
    case 'gold':
      return 'طلا';
    case 'silver':
      return 'نقره';
    case 'platinum':
      return 'پلاتین';
    default:
      return 'طلا';
  }
}

/**
 * تبدیل وزن و عیار به وزن بر مبنای عیار پایه (مثلاً ۷۵۰ برای طلا)
 * عیارهای مختلف (مانند ۷۴۰، ۷۶۷) با این رابطه معادل‌سازی می‌شوند:
 * baseWeight = (rawWeight * purity) / baseKarat
 */
export function convertToBaseWeight(
  rawWeight: number,
  purity: number,
  baseKarat: number = 750,
): number {
  if (rawWeight <= 0 || purity <= 0 || baseKarat <= 0) return 0;
  const result = (rawWeight * purity) / baseKarat;
  return Math.round(result * 100000) / 100000;
}

/**
 * آیا ردیف داده‌شده یک معامله خرید یا فروش فلز است؟
 */
export function isMetalTradeLine(line: DocumentLine): boolean {
  return line.documentTab === 'gold-sale';
}

/**
 * آیا ردیف معامله از نوع «بدون تسویه» است؟
 */
export function isUnsettledTrade(line: DocumentLine): boolean {
  if (line.details.unsettledTrade === true) return true;
  if (line.details.rawKind === 'unsettled') return true;
  if (line.settlementMethod === 'unsettled') return true;
  return false;
}

/**
 * تحلیل وضعیت تسویه تمامی معاملات فلز موجود در سند
 */
export function calculateTradeSettlementStatus(
  lines: DocumentLine[],
  defaultGoldBaseKarat: number = 750,
): SettlementAnalysis {
  const items: MetalSettlementItem[] = [];

  // جمع‌آوری ردیف‌های فیزیکی فلز (ورود یا خروج خام/آبشده)
  // کلید: `${nature}_${metalType}` -> وزن عیار مبنا
  const physicalMetalPool = new Map<string, number>();

  for (const line of lines) {
    if (line.documentTab === 'raw-gold') {
      const metal = (line.details.metalType || 'gold') as MetalType;
      const baseKarat = metal === 'gold' ? defaultGoldBaseKarat : (BASE_KARATS[metal] || 750);
      const rawWeight = Number(line.details.rawWeight) || 0;
      const purity = Number(line.details.purity) || baseKarat;
      const baseWeight = convertToBaseWeight(rawWeight, purity, baseKarat);
      if (baseWeight > 0) {
        const poolKey = `${line.documentNature}_${metal}`;
        physicalMetalPool.set(poolKey, (physicalMetalPool.get(poolKey) || 0) + baseWeight);
      }
    }
  }

  // تحلیل تک‌تک ردیف‌های معامله فلز
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!isMetalTradeLine(line)) continue;

    const metal = (line.details.metalType || 'gold') as MetalType;
    const baseKarat = metal === 'gold' ? defaultGoldBaseKarat : (BASE_KARATS[metal] || 750);
    const nature = line.documentNature; // paid = فروش, received = خرید
    const rawWeight = Number(line.details.rawWeight) || 0;
    const purity = Number(line.details.purity) || baseKarat;
    const tradedBaseWeight = convertToBaseWeight(rawWeight, purity, baseKarat);
    const unsettled = isUnsettledTrade(line);

    if (unsettled) {
      items.push({
        tradeLineIndex: index + 1,
        lineId: line.id,
        metalType: metal,
        nature,
        rawKind: 'unsettled',
        isUnsettledTrade: true,
        tradedRawWeight: rawWeight,
        tradedPurity: purity,
        tradedBaseWeight,
        settledBaseWeight: 0,
        remainingBaseWeight: tradedBaseWeight,
        settlementStatus: 'unsettled_trade',
        settlementPercentage: 0,
      });
      continue;
    }

    // معامله با تسویه:
    // الف) اگر ردیف مستقیماً از انبار صندوق تخصیص داده شده باشد (inventorySourceId برای فروش)
    let directInventoryBaseWeight = 0;
    if (nature === 'paid' && Boolean(line.details.inventorySourceId) && tradedBaseWeight > 0) {
      directInventoryBaseWeight = tradedBaseWeight;
    }

    // ب) بررسی تطابق با ردیف‌های فیزیکی فلز موجود در سند
    // برای فروش (paid): به ردیف خروج فیزیکی (paid) نیاز است
    // برای خرید (received): به ردیف ورود فیزیکی (received) نیاز است
    const poolKey = `${nature}_${metal}`;
    const availableInPool = physicalMetalPool.get(poolKey) || 0;

    let matchedFromPool = 0;
    if (directInventoryBaseWeight <= 0 && availableInPool > 0) {
      matchedFromPool = Math.min(tradedBaseWeight, availableInPool);
      physicalMetalPool.set(poolKey, Math.max(0, availableInPool - matchedFromPool));
    }

    const settledBaseWeight = Math.min(tradedBaseWeight, directInventoryBaseWeight + matchedFromPool);
    const remainingBaseWeight = Math.max(0, Math.round((tradedBaseWeight - settledBaseWeight) * 100000) / 100000);
    const settledPct = tradedBaseWeight > 0 ? Math.round((settledBaseWeight / tradedBaseWeight) * 100) : 0;

    let status: SettlementStatus;
    if (settledBaseWeight <= 0.00001) {
      status = 'no_settlement_metal';
    } else if (remainingBaseWeight <= 0.00001) {
      status = 'fully_settled';
    } else {
      status = 'partially_settled';
    }

    items.push({
      tradeLineIndex: index + 1,
      lineId: line.id,
      metalType: metal,
      nature,
      rawKind: line.details.rawKind || 'molten',
      isUnsettledTrade: false,
      tradedRawWeight: rawWeight,
      tradedPurity: purity,
      tradedBaseWeight,
      settledBaseWeight,
      remainingBaseWeight,
      settlementStatus: status,
      settlementPercentage: settledPct,
    });
  }

  const hasUnsettledTrades = items.some((it) => it.isUnsettledTrade);
  const hasPartialSettlement = items.some((it) => it.settlementStatus === 'partially_settled');
  const hasMissingSettlementMetal = items.some((it) => it.settlementStatus === 'no_settlement_metal');
  const isFullySettled = items.length > 0 && items.every((it) => it.settlementStatus === 'fully_settled');

  return {
    isFullySettled,
    hasUnsettledTrades,
    hasPartialSettlement,
    hasMissingSettlementMetal,
    items,
  };
}

/**
 * اعتبارسنجی جامع تسویه و ردیف‌های سند برای دو حالت «ثبت موقت» و «ثبت کل»
 */
export function validateDocumentSettlement(
  lines: DocumentLine[],
  saveMode: 'temporary' | 'final',
  defaultGoldBaseKarat: number = 750,
): SettlementValidationResult {
  const errors: string[] = [];

  // ۱. بررسی شماره انگ و پاکت (همواره فقط عددی)
  lines.forEach((line, idx) => {
    const lineNum = toPersianDigits(idx + 1);
    const stamp = line.details.stampNumber ? normalizeDigits(line.details.stampNumber.trim()) : '';
    if (stamp && !/^[0-9]+$/.test(stamp)) {
      errors.push(`شماره پاکت / انگ در ردیف ${lineNum} همواره فقط عدد است.`);
    }
    const packet = line.details.refiningPacketNumber ? normalizeDigits(line.details.refiningPacketNumber.trim()) : '';
    if (packet && !/^[0-9]+$/.test(packet)) {
      errors.push(`شماره پاکت در ردیف ${lineNum} همواره فقط عدد است.`);
    }
  });

  const analysis = calculateTradeSettlementStatus(lines, defaultGoldBaseKarat);

  // در حالت «ثبت موقت» (temporary):
  // وجود کسری یا نبود فلز تسویه مانع ثبت موقت نمی‌شود، فقط اعتبارسنجی سینتکسی انجام می‌پذیرد.
  if (saveMode === 'temporary') {
    return {
      isValid: errors.length === 0,
      errors,
      analysis,
    };
  }

  // در حالت «ثبت کل» (final):
  // ۱. برای هر معامله با تسویه، وجود ردیف فلز الزامی است
  for (const item of analysis.items) {
    if (item.isUnsettledTrade) {
      // معامله بدون تسویه مجاز است و برای ثبت کل منعی ندارد
      continue;
    }

    const metalLabel = getMetalLabelFa(item.metalType);

    if (item.settlementStatus === 'no_settlement_metal') {
      if (item.nature === 'paid') {
        errors.push(`برای ثبت فروش با تسویه، خروج ${metalLabel} مورد معامله باید در سند ثبت شود.`);
      } else {
        errors.push(`برای ثبت خرید با تسویه، دریافت ${metalLabel} مورد معامله باید در سند ثبت شود.`);
      }
    } else if (item.settlementStatus === 'partially_settled') {
      const remainingFa = toPersianDigits(item.remainingBaseWeight.toFixed(3));
      errors.push(
        `برای ثبت کل، تسویه معامله باید کامل باشد. کسری تسویه ${metalLabel}: ${remainingFa} گرم (عیار مبنا). برای تسویه در آینده، نوع معامله را «بدون تسویه» انتخاب کنید یا سند را به‌صورت «ثبت موقت» ذخیره فرمایید.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    analysis,
  };
}
