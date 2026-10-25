import type { DocumentNature } from '@/lib/document';
import type { RawOperationKind, DocumentLine, DetailState } from '@/src/components/documents/RawGoldTab';
import { isRefinerGroup } from '@/lib/customer-groups';
import { normalizeDigits, toPersianDigits, parseJalaliDate, formatJalaliDate } from '@/lib/jalali';

export { toPersianDigits, formatJalaliDate };

export function faNumber(value: number, fractionDigits = 3): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return '۰';
  const parts = value.toFixed(fractionDigits).split('.');
  const intPart = Number(parts[0]).toLocaleString('en-US');
  const fracPart = parts[1];
  const combined = fracPart !== undefined ? `${intPart}.${fracPart}` : intPart;
  return toPersianDigits(combined);
}

export function numberValue(value: string | number | undefined | null): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const normalized = normalizeDigits(String(value)).replace(/,/g, '');
  const parsed = parseFloat(normalized);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function convertedTo750(weight: string | number, purity: string | number, baseKarat = 750): number {
  const w = numberValue(weight);
  const p = numberValue(purity) || baseKarat;
  if (w <= 0 || p <= 0) return 0;
  return (w * p) / baseKarat;
}

export function getWorkmanshipPercentageLabel(metalType?: string): string {
  const m = (metalType || 'gold').toLowerCase().trim();
  if (m === 'silver') return 'درصد نقره‌ای';
  if (m === 'platinum') return 'درصد پلاتینی';
  return 'درصد طلایی';
}

export function getLineDocumentTypeLabel(
  nature: 'received' | 'paid',
  tab: string,
  rawKind?: RawOperationKind,
  unsettledTrade?: boolean,
  refiningOpKind?: string,
  workmanshipOptionId?: number | string,
  workmanshipSubType?: string,
  metalType?: string,
): string {
  if (tab === 'refining') {
    if (nature === 'paid') {
      if (refiningOpKind === 'sample_send') return 'ارسال نمونه به ری‌گیری';
      return 'تحویل طلا به ری‌گیری';
    } else {
      if (refiningOpKind === 'sample_receive') return 'دریافت نتیجه پاکت ری‌گیری';
      if (refiningOpKind === 'fee') return 'اجرت ری‌گیری';
      return 'دریافت طلا از ری‌گیری';
    }
  }

  if (tab === 'currency') {
    if (
      workmanshipSubType === 'currency-claim' ||
      workmanshipSubType === 'claim' ||
      workmanshipSubType?.includes('claim')
    ) {
      return 'طلب ارزی';
    }
    if (
      workmanshipSubType === 'currency-debt' ||
      workmanshipSubType === 'debt' ||
      workmanshipSubType?.includes('debt')
    ) {
      return 'بدهی ارزی';
    }
    if (unsettledTrade) {
      return nature === 'received' ? 'خرید ارزی بدون تسویه' : 'فروش ارزی بدون تسویه';
    }
    return nature === 'received' ? 'خرید ارز' : 'فروش ارز';
  }

  if (tab === 'cash') {
    return nature === 'received' ? 'دریافت نقد' : 'پرداخت نقد';
  }

  if (tab === 'bank') {
    return nature === 'received' ? 'دریافت بانکی' : 'پرداخت بانکی';
  }

  if (tab === 'coin') {
    const subTypeOrKind = String(workmanshipSubType || rawKind || metalType || '').toLowerCase();
    const isBullion =
      subTypeOrKind.includes('شمش') ||
      subTypeOrKind.includes('bar_') ||
      subTypeOrKind.includes('bullion');

    if (workmanshipSubType === 'payment_claim' || workmanshipSubType?.includes('claim')) {
      return isBullion ? 'طلب شمش' : 'طلب سکه';
    }
    if (workmanshipSubType === 'receipt_debt' || workmanshipSubType?.includes('debt')) {
      return isBullion ? 'بدهی شمش' : 'بدهی سکه';
    }

    return nature === 'received'
      ? (isBullion ? 'خرید شمش' : 'خرید سکه')
      : (isBullion ? 'فروش شمش' : 'فروش سکه');
  }

  if (tab === 'goods') {
    return nature === 'received' ? 'ورود کالا' : 'خروج کالا';
  }

  if (tab === 'stone') {
    if (unsettledTrade) {
      return nature === 'received' ? 'خرید سنگ (بدون تسویه)' : 'فروش سنگ (بدون تسویه)';
    }
    return nature === 'received' ? 'ورود سنگ' : 'خروج سنگ';
  }

  if (tab === 'income-expense') {
    return nature === 'received' ? 'درآمد' : 'هزینه';
  }

  if (tab === 'claim') {
    return nature === 'received' ? 'بدهی ما' : 'طلب ما';
  }

  if (tab === 'discount') {
    return nature === 'received' ? 'تخفیف اعطایی' : 'تخفیف دریافتی';
  }

  if (tab === 'workmanship') {
    if (workmanshipSubType === 'workmanship-golden-percentage') {
      return `${getWorkmanshipPercentageLabel(metalType)} کارساخته`;
    }
    if (workmanshipSubType === 'workmanship-wage') return 'اجرت کارساخته';
    const optId = Number(workmanshipOptionId);
    if (nature === 'paid') {
      if (optId === 2 || workmanshipSubType === 'sale_manufactured') return 'فروش کارساخته';
      if (optId === 3 || workmanshipSubType === 'return_exit') return 'خروج مرجوعی';
      if (optId === 4 || workmanshipSubType === 'return_sale') return 'فروش مرجوعی';
      return 'خروج کار ساخته';
    } else {
      if (optId === 2 || workmanshipSubType === 'buy_manufactured') return 'خرید کارساخته';
      if (optId === 3 || workmanshipSubType === 'return_entry') return 'ورود مرجوعی';
      if (optId === 4 || workmanshipSubType === 'return_buy') return 'خرید مرجوعی';
      return 'ورود کار ساخته';
    }
  }

  if (tab === 'gold-sale') {
    if (rawKind === 'unsettled') return nature === 'received' ? 'خرید بدون تسویه' : 'فروش بدون تسویه';
    if (rawKind === 'misc') return nature === 'received' ? 'خرید متفرقه' : 'فروش متفرقه';
    return nature === 'received' ? 'خرید آب‌شده' : 'فروش آب‌شده';
  }

  // metals / raw-gold tab (ورود/خروج فلزات)
  if (rawKind === 'molten') return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
  if (rawKind === 'misc') return nature === 'received' ? 'ورود متفرقه' : 'خروج متفرقه';
  if (rawKind === 'conditional') return nature === 'received' ? 'ورود آب شده شرطی' : 'خروج آب شده شرطی';
  if (rawKind === 'question') return nature === 'received' ? 'ورود سواله' : 'خروج سواله';

  return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
}

export function rawOperationLabel(nature: DocumentNature, kind: RawOperationKind): string {
  if (kind === 'conditional') return nature === 'received' ? 'ورود آب شده شرطی' : 'خروج آب شده شرطی';
  if (kind === 'question') return nature === 'received' ? 'ورود سواله' : 'خروج سواله';
  const prefix = nature === 'received' ? 'خرید' : 'فروش';
  if (kind === 'misc') return `${prefix} متفرقه`;
  if (kind === 'unsettled') return `${prefix} بدون تسویه`;
  return `${prefix} آب‌شده`;
}

export function getCustomerGroupBadge(groupName?: string) {
  const name = (groupName || '').trim();
  if (!name) return null;
  if (isRefinerGroup(name)) {
    return {
      label: 'ریگیر',
      classes: 'bg-amber-100 text-amber-900 border-amber-300/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    };
  }
  if (name === 'همکار' || name === 'بنکدار') {
    return {
      label: name,
      classes: 'bg-blue-100 text-blue-900 border-blue-300/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    };
  }
  if (name === 'supplier' || name === 'تأمین‌کننده') {
    return {
      label: 'تأمین‌کننده',
      classes: 'bg-purple-100 text-purple-900 border-purple-300/80 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    };
  }
  if (name === 'customer' || name === 'مشتری' || name === 'خریدار') {
    return {
      label: 'مشتری',
      classes: 'bg-emerald-100 text-emerald-900 border-emerald-300/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    };
  }
  return {
    label: name,
    classes: 'bg-slate-100 text-slate-800 border-slate-300/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  };
}

export function actualWeightFromMoney(
  details: Pick<DetailState, 'totalAmount' | 'purity' | 'metalPriceType' | 'metalPrice' | 'metalType'>,
  baseKarat = 750,
): number {
  const total = numberValue(details.totalAmount);
  const price = numberValue(details.metalPrice);
  const purity = numberValue(details.purity) || baseKarat;
  if (total <= 0 || price <= 0 || purity <= 0) return 0;

  let perGram = price;
  if (details.metalPriceType === 'mesghal17') {
    perGram = price / 4.3318;
  } else if (details.metalPriceType === 'ounceUsd') {
    perGram = price / 31.1035;
  } else if (details.metalPriceType === 'gramSilver925') {
    perGram = price * (baseKarat / 925);
  } else if (details.metalPriceType === 'gramSilver995') {
    perGram = price * (baseKarat / 995);
  } else if (details.metalPriceType === 'gramSilver999') {
    perGram = price * (baseKarat / 999);
  }

  if (perGram <= 0) return 0;
  const c750 = total / perGram;
  return (c750 * baseKarat) / purity;
}

export function actualWeightForLine(line: DocumentLine, baseKarat = 750): number {
  if (line.details?.calculationMethod === 'money') {
    return actualWeightFromMoney(line.details, baseKarat);
  }
  return numberValue(line.details?.rawWeight);
}

export interface DateDiffInfo {
  isDifferent: boolean;
  isPast: boolean;
  isFuture: boolean;
  todayJalali: string;
}

/**
 * Checks if a given Jalali date string is before, after, or equal to today's Jalali date.
 */
export function checkDocumentDateDiff(jalaliDateStr: string): DateDiffInfo {
  const normSelected = normalizeDigits(jalaliDateStr).trim().replace(/[./-]/g, '/');
  const todayRaw = formatJalaliDate();
  const normToday = normalizeDigits(todayRaw).trim().replace(/[./-]/g, '/');

  if (!normSelected) {
    return { isDifferent: false, isPast: false, isFuture: false, todayJalali: normToday };
  }

  const parsedSelected = parseJalaliDate(normSelected);
  const parsedToday = parseJalaliDate(normToday);

  if (!parsedSelected || !parsedToday) {
    return {
      isDifferent: normSelected !== normToday,
      isPast: false,
      isFuture: false,
      todayJalali: normToday,
    };
  }

  const selNum = parsedSelected.year * 10000 + parsedSelected.month * 100 + parsedSelected.day;
  const todayNum = parsedToday.year * 10000 + parsedToday.month * 100 + parsedToday.day;

  return {
    isDifferent: selNum !== todayNum,
    isPast: selNum < todayNum,
    isFuture: selNum > todayNum,
    todayJalali: normToday,
  };
}

export type MarketQuote = {
  id: string;
  category: string;
  title: string;
  symbol: string;
  unit: string;
  nameEn: string;
  price: number;
  changeValue?: number;
  changePercent?: number;
  fetchedAt?: string;
  sourceTimestamp?: number;
};

export const CURRENCY_ALIASES: Record<string, string> = {
  'USD': 'USD',
  '$': 'USD',
  'دلار': 'USD',
  'دلار آمریکا': 'USD',
  'EUR': 'EUR',
  '€': 'EUR',
  'یورو': 'EUR',
  'AED': 'AED',
  'د.إ': 'AED',
  'درهم': 'AED',
  'درهم امارات': 'AED',
  'GBP': 'GBP',
  '£': 'GBP',
  'پوند': 'GBP',
  'پوند انگلیس': 'GBP',
  'TRY': 'TRY',
  '₺': 'TRY',
  'لیر': 'TRY',
  'لیر ترکیه': 'TRY',
  'CNY': 'CNY',
  '¥': 'CNY',
  'یوآن': 'CNY',
  'یوآن چین': 'CNY',
  'SAR': 'SAR',
  '﷼': 'SAR',
  'ریال عربستان': 'SAR',
  'KWD': 'KWD',
  'دینار کویت': 'KWD',
  'CAD': 'CAD',
  'دلار کانادا': 'CAD',
  'AUD': 'AUD',
  'دلار استرالیا': 'AUD',
  'CHF': 'CHF',
  'فرانک': 'CHF',
  'فرانک سوئیس': 'CHF',
  'IQD': 'IQD',
  'دینار عراق': 'IQD',
  'QAR': 'QAR',
  'ریال قطر': 'QAR',
  'OMR': 'OMR',
  'ریال عمان': 'OMR',
  'BHD': 'BHD',
  'دینار بحرین': 'BHD',
  'SEK': 'SEK',
  'کرون سوئد': 'SEK',
  'INR': 'INR',
  'روپیه هند': 'INR',
  'PKR': 'PKR',
  'روپیه پاکستان': 'PKR',
  'AFN': 'AFN',
  'افغانی': 'AFN',
  'RUB': 'RUB',
  'روبل': 'RUB',
  'روبل روسیه': 'RUB',
  'JPY': 'JPY',
  'ین': 'JPY',
  'یکصد ین ژاپن': 'JPY',
  'USDT': 'USDT',
  'تتر': 'USDT',
  'دلار تتر': 'USDT',
};

export function findCurrencyQuote(
  quotes: MarketQuote[],
  currencyCode: string,
): MarketQuote | undefined {
  if (!currencyCode || !Array.isArray(quotes) || quotes.length === 0) return undefined;
  const rawCode = currencyCode.trim();
  const upper = rawCode.toUpperCase();
  const canonicalCode = CURRENCY_ALIASES[rawCode] || CURRENCY_ALIASES[upper] || upper;

  // 1. Special Tether / USDT handling: prefer USDT_IRT (in Tomans) if available
  if (canonicalCode === 'USDT' || canonicalCode === 'TETHER') {
    const usdtIrt = quotes.find((q) => String(q.symbol || '').trim().toUpperCase() === 'USDT_IRT');
    if (usdtIrt) return usdtIrt;
    const usdt = quotes.find((q) => String(q.symbol || '').trim().toUpperCase() === 'USDT');
    if (usdt) return usdt;
  }

  // 2. Direct exact symbol match (prefer currency category if multiple exist)
  const exactMatches = quotes.filter(
    (q) => String(q.symbol || '').trim().toUpperCase() === canonicalCode,
  );
  if (exactMatches.length > 0) {
    const currencyCat = exactMatches.find((q) => q.category === 'currency');
    return currencyCat || exactMatches[0];
  }

  // 3. Exact Persian title or standard alias match (ensure XAUUSD or gold never matches USD)
  const titleMatches = quotes.filter((q) => {
    const t = String(q.title || '').trim();
    if (canonicalCode === 'USD' && (t === 'دلار' || t === 'دلار آمریکا')) return true;
    if (canonicalCode === 'EUR' && t === 'یورو') return true;
    if (canonicalCode === 'AED' && (t === 'درهم' || t === 'درهم امارات')) return true;
    if (canonicalCode === 'GBP' && (t === 'پوند' || t === 'پوند انگلیس')) return true;
    if (canonicalCode === 'TRY' && (t === 'لیر' || t === 'لیر ترکیه')) return true;
    if (canonicalCode === 'CNY' && (t === 'یوآن' || t === 'یوآن چین')) return true;
    if (canonicalCode === 'SAR' && t === 'ریال عربستان') return true;
    if (canonicalCode === 'CAD' && t === 'دلار کانادا') return true;
    if (canonicalCode === 'AUD' && t === 'دلار استرالیا') return true;
    if (canonicalCode === 'KWD' && t === 'دینار کویت') return true;
    if (canonicalCode === 'IQD' && t === 'دینار عراق') return true;
    if (canonicalCode === 'QAR' && t === 'ریال قطر') return true;
    if (canonicalCode === 'CHF' && (t === 'فرانک' || t === 'فرانک سوئیس')) return true;
    return t.toLowerCase() === rawCode.toLowerCase();
  });
  if (titleMatches.length > 0) {
    const currencyCat = titleMatches.find((q) => q.category === 'currency');
    return currencyCat || titleMatches[0];
  }

  // 4. Exact nameEn match
  const nameEnMatch = quotes.find((q) => String(q.nameEn || '').trim().toUpperCase() === canonicalCode);
  if (nameEnMatch) return nameEnMatch;

  return undefined;
}

export function getQuoteRateInRials(
  quotes: MarketQuote[],
  currencyCode: string,
): number {
  if (!currencyCode || !Array.isArray(quotes) || quotes.length === 0) return 0;
  const rawCode = currencyCode.trim();
  const code = rawCode.toUpperCase();
  if (code === 'IRR') return 1;
  if (code === 'IRT') return 10;

  const found = findCurrencyQuote(quotes, rawCode);
  if (!found || !found.price) return 0;
  const raw = Number(found.price);
  if (raw <= 0 || Number.isNaN(raw)) return 0;
  if (found.unit?.includes('ریال') || raw > 20_000_000) {
    return Math.round(raw);
  }
  return Math.round(raw * 10);
}

export type CashVault = {
  id: string;
  name: string;
  currencyId?: string;
  currencyName?: string;
  currencyCode?: string;
  currencySymbol?: string;
  balance?: number;
  openingBalance?: number;
  isBlocked?: boolean;
};

export function findCashVault<T extends { currencyCode?: string; currencyName?: string; currencySymbol?: string; currencyId?: string; id?: string; name?: string }>(
  vaults: T[],
  currencyUnit: string,
): T | undefined {
  if (!currencyUnit || !Array.isArray(vaults) || vaults.length === 0) return undefined;
  const raw = currencyUnit.trim();
  const upper = raw.toUpperCase();
  const canonical = CURRENCY_ALIASES[raw] || CURRENCY_ALIASES[upper] || upper;

  return vaults.find((v) => {
    const code = String(v.currencyCode || '').trim().toUpperCase();
    const name = String(v.currencyName || '').trim();
    const sym = String(v.currencySymbol || '').trim().toUpperCase();
    const vName = String(v.name || '').trim();
    const vCanonical = CURRENCY_ALIASES[name] || CURRENCY_ALIASES[code] || code;

    if (code === canonical || vCanonical === canonical) return true;
    if (code === upper || sym === upper) return true;
    if (name === raw || vName === raw) return true;
    if (canonical === 'USD' && (name === 'دلار' || name === 'دلار آمریکا' || vName.includes('دلار'))) return true;
    if (canonical === 'EUR' && (name === 'یورو' || vName.includes('یورو'))) return true;
    if (canonical === 'AED' && (name === 'درهم' || name === 'درهم امارات' || vName.includes('درهم'))) return true;
    if (canonical === 'GBP' && (name === 'پوند' || vName.includes('پوند'))) return true;
    if (canonical === 'TRY' && (name === 'لیر' || vName.includes('لیر'))) return true;
    if (canonical === 'USDT' && (name.includes('تتر') || code.includes('USDT') || vName.includes('تتر'))) return true;
    if (v.currencyId === raw || v.id === raw) return true;
    return false;
  });
}

/**
 * Returns true if the tab strictly deals with precious metals (gold, silver, platinum).
 * Bank, Cash, Currency, Stone, Goods, and Income-Expense are strictly non-metal.
 */
export function isMetalBearingTab(tab: string | undefined): boolean {
  if (!tab) return false;
  return ['metals', 'raw-gold', 'gold-sale', 'coin', 'workmanship', 'refining'].includes(tab);
}

/**
 * Returns true if a document line or draft represents a metal-bearing operation.
 * Claim lines are only metal-bearing if they specifically have a claimWeight > 0.
 */
export function isMetalBearingLine(
  line: { documentTab?: string; sourceTab?: string; documentSubType?: string; details?: Partial<DetailState> | null } | undefined | null,
): boolean {
  if (!line) return false;
  if (line.documentSubType === 'workmanship-wage') return false;
  const tab = line.documentTab || line.sourceTab;
  if (tab === 'claim') {
    return numberValue(line.details?.claimWeight) > 0;
  }
  return isMetalBearingTab(tab);
}

export function getLineCurrencyValues(line: {
  documentTab?: string;
  sourceTab?: string;
  documentNature?: 'received' | 'paid';
  documentSubType?: string;
  settlementMethod?: string;
  details?: Partial<DetailState> | null;
}) {
  const tab = line.documentTab || line.sourceTab;
  const isCurrency = tab === 'currency';
  const isStone = tab === 'stone';
  const details = line.details || {};
  const stoneCurrency = isStone
    ? String(details.settlementCurrencyUnit || 'USD').trim().toUpperCase()
    : '';
  const isForeignStone = isStone && stoneCurrency !== 'IRR' && stoneCurrency !== 'IRT';
  const stoneAmount = isStone
    ? numberValue(details.stoneTotalAmount || details.totalAmount)
    : 0;

  const isWorkmanship = tab === 'workmanship';
  const workmanshipWageCurrency = String(details.wageCurrency || details.currencyUnit || '').trim().toUpperCase();
  const isForeignWorkmanship = Boolean(
    isWorkmanship &&
    line.documentSubType !== 'workmanship-golden-percentage' &&
    workmanshipWageCurrency &&
    workmanshipWageCurrency !== 'IRR' &&
    workmanshipWageCurrency !== 'IRT'
  );
  const workmanshipWageAmount = isForeignWorkmanship
    ? numberValue(details.totalAmount || details.wage)
    : 0;

  const currencyQty = isCurrency ? numberValue(details.currencyQuantity) : 0;
  const isClaimLine = line.documentSubType === 'currency-claim';
  const isDebtLine = line.documentSubType === 'currency-debt';
  const isUnsettled = details.unsettledTrade === true || line.settlementMethod === 'unsettled';
  const isPaid = line.documentNature === 'paid';
  const isReceived = line.documentNature === 'received';

  let debit = 0;
  let credit = 0;

  if (isCurrency && currencyQty > 0) {
    if (isClaimLine || (!details.linkedLineId && isUnsettled && isReceived)) {
      debit = currencyQty;
    } else if (isDebtLine || (!details.linkedLineId && isUnsettled && isPaid)) {
      credit = currencyQty;
    }
  } else if (isForeignStone && stoneAmount > 0) {
    if (isPaid) debit = stoneAmount;
    else if (isReceived) credit = stoneAmount;
  } else if (isForeignWorkmanship && workmanshipWageAmount > 0) {
    if (isPaid) debit = workmanshipWageAmount;
    else if (isReceived) credit = workmanshipWageAmount;
  }

  return { debit, credit, hasValue: debit > 0 || credit > 0 };
}

export function getLineFinancialValues(line: {
  documentTab?: string;
  sourceTab?: string;
  documentNature?: 'received' | 'paid';
  documentSubType?: string;
  details?: Partial<DetailState> | null;
}) {
  const tab = line.documentTab || line.sourceTab;
  const isCurrency = tab === 'currency';
  const isStone = tab === 'stone';
  const details = line.details || {};
  const stoneCurrency = isStone
    ? String(details.settlementCurrencyUnit || 'USD').trim().toUpperCase()
    : '';
  const isForeignStone = isStone && stoneCurrency !== 'IRR' && stoneCurrency !== 'IRT';
  const stoneAmount = isStone
    ? numberValue(details.stoneTotalAmount || details.totalAmount)
    : 0;

  const isWorkmanship = tab === 'workmanship';
  const workmanshipWageCurrency = String(details.wageCurrency || details.currencyUnit || '').trim().toUpperCase();
  const isForeignWorkmanship = Boolean(
    isWorkmanship &&
    line.documentSubType !== 'workmanship-golden-percentage' &&
    workmanshipWageCurrency &&
    workmanshipWageCurrency !== 'IRR' &&
    workmanshipWageCurrency !== 'IRT'
  );

  const isClaimLine = line.documentSubType === 'currency-claim';
  const isDebtLine = line.documentSubType === 'currency-debt';

  const financialAmount = isCurrency
    ? (isClaimLine || isDebtLine ? 0 : numberValue(details.currencyTotalAmount))
    : isStone
    ? (isForeignStone ? 0 : stoneAmount)
    : isForeignWorkmanship
    ? 0
    : line.documentSubType === 'workmanship-golden-percentage'
    ? 0
    : numberValue(details.claimFinancial || details.totalAmount);

  const isPaid = line.documentNature === 'paid';
  const isReceived = line.documentNature === 'received';

  const debit = isPaid && financialAmount > 0 ? financialAmount : 0;
  const credit = isReceived && financialAmount > 0 ? financialAmount : 0;

  return { debit, credit, hasValue: financialAmount > 0 };
}

/**
 * Sanitizes and isolates DetailState strictly according to the active document tab.
 * Any alien fields from previous tabs (e.g. coinName, coinYear, rawWeight, purity,
 * bankAccountId, cashFundId, stone* fields) are completely stripped out to prevent
 * cross-tab data leakage.
 */
export function sanitizeLineDetailsForTab(
  tab: string,
  details: Partial<DetailState> = {},
  baseCurrency = 'IRR',
  baseKarat = 750,
): DetailState {
  const normTab = tab || 'metals';

  // Base clean object with required defaults
  const baseDefaults: DetailState = {
    metalType: 'gold',
    baseKarat,
    rawKind: 'molten',
    rawWeight: '',
    purity: '',
    calculationMethod: 'weight',
    metalPriceType: 'gram18',
    metalPrice: '',
    totalAmount: '',
    labName: '',
    stampNumber: '',
    currencyUnit: details.currencyUnit || baseCurrency,
    currencyQuantity: '',
    currencyUnitPrice: '',
    currencyTotalAmount: '',
    unsettledTrade: false,
    currencyTradeId: '',
    settlementCurrencyUnit: '',
    settlementQuantity: '',
    settlesTradeId: '',
    inventorySourceId: '',
    baseCurrency: details.baseCurrency || baseCurrency,
  };

  switch (normTab) {
    case 'bank': {
      return {
        ...baseDefaults,
        totalAmount: String(details.totalAmount || ''),
        bankAccountId: details.bankAccountId || undefined,
        destinationBankId: details.destinationBankId || undefined,
        bankName: details.bankName || undefined,
        bankBranch: details.bankBranch || undefined,
        accountNumber: details.accountNumber || undefined,
        bankOperationKind: details.bankOperationKind || undefined,
        bankAccountBalance: details.bankAccountBalance !== undefined ? details.bankAccountBalance : undefined,
        rawBankAccountBalance: details.rawBankAccountBalance !== undefined ? details.rawBankAccountBalance : undefined,
        checkNumber: details.checkNumber || undefined,
        sayadId: details.sayadId || undefined,
        dueDateJalali: details.dueDateJalali || undefined,
        transferFee: details.transferFee || undefined,
        trackingNumber: details.trackingNumber || undefined,
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
        amountInIrr: details.amountInIrr,
        rialAmountInIrr: details.rialAmountInIrr,
        // Enforce 0 weight/purity for bank lines
        rawWeight: '',
        purity: '',
      };
    }

    case 'cash': {
      return {
        ...baseDefaults,
        totalAmount: String(details.totalAmount || ''),
        cashFundId: details.cashFundId || undefined,
        cashFundName: details.cashFundName || undefined,
        cashFundCurrency: details.cashFundCurrency || undefined,
        cashFundCurrencyId: details.cashFundCurrencyId || undefined,
        cashFundBalance: details.cashFundBalance !== undefined ? details.cashFundBalance : undefined,
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
        isForeignCash: details.isForeignCash,
        settlesTradeId: details.settlesTradeId || '',
        settlementCurrencyUnit: details.settlementCurrencyUnit || '',
        settlementQuantity: details.settlementQuantity || '',
        // Enforce 0 weight/purity for cash lines
        rawWeight: '',
        purity: '',
      };
    }

    case 'currency': {
      const curUnit = details.currencyUnit || 'USD';
      return {
        ...baseDefaults,
        currencyUnit: curUnit,
        currencyQuantity: String(details.currencyQuantity || ''),
        currencyUnitPrice: String(details.currencyUnitPrice || ''),
        currencyTotalAmount: String(details.currencyTotalAmount || ''),
        totalAmount: String(details.totalAmount || details.currencyTotalAmount || ''),
        unsettledTrade: Boolean(details.unsettledTrade),
        currencyTradeId: details.currencyTradeId || '',
        settlementCurrencyUnit: details.settlementCurrencyUnit || baseCurrency,
        settlementQuantity: details.settlementQuantity || '',
        settlesTradeId: details.settlesTradeId || '',
        baseCurrency: details.baseCurrency || baseCurrency,
        linkedLineId: details.linkedLineId,
        documentTypeLabel: details.documentTypeLabel,
        documentSubType: details.documentSubType,
        clientLineId: (details as any).clientLineId,
        // Enforce 0 weight/purity for currency lines
        rawWeight: '',
        purity: '',
      };
    }

    case 'stone': {
      return {
        ...baseDefaults,
        totalAmount: String(details.totalAmount || details.stoneTotalAmount || ''),
        currencyUnit: details.currencyUnit || details.settlementCurrencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
        unsettledTrade: Boolean(details.unsettledTrade),
        settlesTradeId: details.settlesTradeId || '',
        settlementCurrencyUnit: details.settlementCurrencyUnit || '',
        settlementQuantity: details.settlementQuantity || '',
        unsettledReferenceId: details.unsettledReferenceId || undefined,
        // Stone specific attributes
        stoneOperationKind: details.stoneOperationKind,
        stoneRootCategory: details.stoneRootCategory,
        stoneCategory: details.stoneCategory,
        stoneSpecies: details.stoneSpecies,
        stoneSpeciesName: details.stoneSpeciesName,
        stoneVariety: details.stoneVariety,
        stoneShape: details.stoneShape,
        stoneShapeName: details.stoneShapeName,
        stoneMode: details.stoneMode,
        stoneCarats: details.stoneCarats,
        stoneGrams: details.stoneGrams,
        stonePieces: details.stonePieces,
        stoneValuationMethod: details.stoneValuationMethod,
        stoneUnitPrice: details.stoneUnitPrice,
        stoneTotalAmount: details.stoneTotalAmount,
        stoneColor: details.stoneColor,
        stoneClarity: details.stoneClarity,
        stoneCut: details.stoneCut,
        stoneCertificateLab: details.stoneCertificateLab,
        stoneCertificateNumber: details.stoneCertificateNumber,
        stoneSieveSize: details.stoneSieveSize,
        stoneColorRange: details.stoneColorRange,
        stoneClarityRange: details.stoneClarityRange,
        stoneLotNumber: details.stoneLotNumber,
        stoneTreatment: details.stoneTreatment,
        stoneOrigin: details.stoneOrigin,
        stoneItemName: details.stoneItemName,
        stoneDiamondType: details.stoneDiamondType,
        stoneGrowthMethod: details.stoneGrowthMethod,
        stonePostGrowthTreatment: details.stonePostGrowthTreatment,
        stoneLaserInscription: details.stoneLaserInscription,
        stoneColorMode: details.stoneColorMode,
        stoneFancyIntensity: details.stoneFancyIntensity,
        stoneFancyHue: details.stoneFancyHue,
        stoneFancyOrigin: details.stoneFancyOrigin,
        stonePolish: details.stonePolish,
        stoneSymmetry: details.stoneSymmetry,
        stoneFluorescence: details.stoneFluorescence,
        stoneMeasurementsLength: details.stoneMeasurementsLength,
        stoneMeasurementsWidth: details.stoneMeasurementsWidth,
        stoneMeasurementsDepth: details.stoneMeasurementsDepth,
        stoneColorHue: details.stoneColorHue,
        stoneTone: details.stoneTone,
        stoneSaturation: details.stoneSaturation,
        stoneTransparency: details.stoneTransparency,
        stoneOriginSource: details.stoneOriginSource,
        stoneChemicalBasis: details.stoneChemicalBasis,
        stoneTreatmentMethod: details.stoneTreatmentMethod,
        stoneSizeUnit: details.stoneSizeUnit,
        stoneSizeMin: details.stoneSizeMin,
        stoneSizeMax: details.stoneSizeMax,
        stoneStorageLocation: details.stoneStorageLocation,
        stoneInternalCode: details.stoneInternalCode,
        stoneVerificationStatus: details.stoneVerificationStatus,
        isAmountRounded: details.isAmountRounded,
        roundingDigits: details.roundingDigits,
        roundingMode: details.roundingMode,
        // Enforce 0 precious metal weight/purity for stone lines
        rawWeight: '',
        purity: '',
      };
    }

    case 'coin': {
      const coinKarat = details.baseKarat || 900;
      return {
        ...baseDefaults,
        metalType: 'gold',
        baseKarat: coinKarat,
        rawKind: 'coin',
        rawWeight: String(details.rawWeight || ''),
        purity: String(details.purity || '900'),
        quantity: String(details.quantity || ''),
        coinType: details.coinType,
        coinName: details.coinName,
        coinYear: details.coinYear,
        mintYear: details.mintYear || details.coinYear,
        unitWeight: details.unitWeight,
        convertedWeight: details.convertedWeight,
        totalAmount: String(details.totalAmount || ''),
        currencyQuantity: String(details.currencyQuantity || details.quantity || ''),
        currencyUnitPrice: String(details.currencyUnitPrice || ''),
        currencyTotalAmount: String(details.currencyTotalAmount || details.totalAmount || ''),
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
        unsettledTrade: Boolean(details.unsettledTrade),
      };
    }

    case 'workmanship': {
      return {
        ...baseDefaults,
        metalType: details.metalType || 'gold',
        baseKarat: details.baseKarat || baseKarat,
        rawWeight: String(details.rawWeight || ''),
        purity: String(details.purity || String(baseKarat)),
        convertedWeight: details.convertedWeight,
        totalAmount: String(details.totalAmount || ''),
        quantity: details.quantity,
        workmanshipName: details.workmanshipName,
        workmanshipOptionId: details.workmanshipOptionId,
        workmanshipOptionLabel: details.workmanshipOptionLabel,
        workmanshipReturnSourceId: details.workmanshipReturnSourceId,
        wage: details.wage,
        wageMode: details.wageMode,
        wageCurrency: details.wageCurrency,
        wageCurrencyUnit: details.wageCurrencyUnit,
        wageCurrencyRate: details.wageCurrencyRate,
        goldenPercentage: details.goldenPercentage,
        profitPercentage: details.profitPercentage,
        metalTotalPrice: details.metalTotalPrice,
        profitAmount: details.profitAmount,
        discountAmount: details.discountAmount,
        currencyUnit: details.currencyUnit || baseCurrency,
        currencyTotalAmount: details.currencyTotalAmount || '',
        currencyQuantity: details.currencyQuantity || '',
        currencyUnitPrice: details.currencyUnitPrice || '',
        baseCurrency: details.baseCurrency || baseCurrency,
        linkedLineId: details.linkedLineId,
        wageTotalAmount: details.wageTotalAmount,
        hasChildLines: details.hasChildLines,
        isChildLine: details.isChildLine,
      };
    }

    case 'claim': {
      const hasWeight = numberValue(details.claimWeight) > 0;
      return {
        ...baseDefaults,
        claimFinancial: details.claimFinancial || (hasWeight ? '' : details.totalAmount || ''),
        claimWeight: details.claimWeight || '',
        claimPurpose: details.claimPurpose || '',
        totalAmount: details.totalAmount || details.claimFinancial || '',
        rawWeight: hasWeight ? String(details.claimWeight) : '',
        purity: hasWeight ? String(details.baseKarat || baseKarat) : '',
        baseKarat: details.baseKarat || baseKarat,
        metalType: details.metalType || 'gold',
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
      };
    }

    case 'discount': {
      return {
        ...baseDefaults,
        totalAmount: String(details.totalAmount || details.discountAmount || ''),
        discountAmount: String(details.discountAmount || details.totalAmount || ''),
        discountPercentage: String(details.discountPercentage || ''),
        discountBaseAmount: String(details.discountBaseAmount || ''),
        discountType: details.discountType || 'percent',
        discountDirection: details.discountDirection,
        claimPurpose: details.claimPurpose || '',
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
        rawWeight: '',
        purity: '',
      };
    }

    case 'refining': {
      return {
        ...baseDefaults,
        metalType: details.metalType || 'gold',
        baseKarat: details.baseKarat || baseKarat,
        rawWeight: String(details.rawWeight || ''),
        purity: String(details.purity || String(baseKarat)),
        totalAmount: String(details.totalAmount || ''),
        labName: details.labName || '',
        stampNumber: details.stampNumber || '',
        refiningCaseId: details.refiningCaseId,
        refiningCaseNumber: details.refiningCaseNumber,
        refiningOpKind: details.refiningOpKind,
        refiningPacketId: details.refiningPacketId,
        refiningPacketNumber: details.refiningPacketNumber,
        refiningSampleWeight: details.refiningSampleWeight,
        refiningReturnedWeight: details.refiningReturnedWeight,
        refiningWeightLoss: details.refiningWeightLoss,
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
      };
    }

    case 'gold-sale': {
      return {
        ...baseDefaults,
        metalType: details.metalType || 'gold',
        baseKarat: details.baseKarat || baseKarat,
        rawKind: details.rawKind || 'molten',
        rawWeight: String(details.rawWeight || ''),
        purity: String(details.purity || String(baseKarat)),
        calculationMethod: details.calculationMethod || 'weight',
        metalPriceType: details.metalPriceType || 'gram18',
        metalPrice: String(details.metalPrice || ''),
        totalAmount: String(details.totalAmount || ''),
        labName: details.labName || '',
        stampNumber: details.stampNumber || '',
        inventorySourceId: details.inventorySourceId || '',
        linkedLineId: details.linkedLineId,
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
        unsettledTrade: Boolean(details.unsettledTrade),
        roundingDifference: details.roundingDifference,
        exactCalculatedAmount: details.exactCalculatedAmount,
        isAmountRounded: details.isAmountRounded,
        roundingDigits: details.roundingDigits,
        roundingMode: details.roundingMode,
      };
    }

    case 'metals':
    case 'raw-gold':
    default: {
      return {
        ...baseDefaults,
        metalType: details.metalType || 'gold',
        baseKarat: details.baseKarat || baseKarat,
        rawKind: details.rawKind || 'molten',
        rawWeight: String(details.rawWeight || ''),
        purity: String(details.purity || String(baseKarat)),
        calculationMethod: details.calculationMethod || 'weight',
        metalPriceType: details.metalPriceType || 'gram18',
        metalPrice: String(details.metalPrice || ''),
        totalAmount: String(details.totalAmount || ''),
        labName: details.labName || '',
        stampNumber: details.stampNumber || '',
        inventorySourceId: details.inventorySourceId || '',
        linkedLineId: details.linkedLineId,
        currencyUnit: details.currencyUnit || baseCurrency,
        baseCurrency: details.baseCurrency || baseCurrency,
        unsettledTrade: Boolean(details.unsettledTrade),
      };
    }
  }
}

/**
 * Sanitizes an entire DocumentLine ensuring its details and converted750 adhere
 * to its documentTab / sourceTab boundaries.
 */
export function sanitizeDocumentLine(
  line: DocumentLine,
  tabOverride?: string,
  baseCurrency = 'IRR',
  baseKarat = 750,
): DocumentLine {
  const effectiveTab = tabOverride || line.documentTab || line.sourceTab || 'metals';
  const cleanDetails = sanitizeLineDetailsForTab(effectiveTab, line.details, baseCurrency, baseKarat);

  let c750 = 0;
  if (isMetalBearingLine({ documentTab: effectiveTab, sourceTab: line.sourceTab, details: cleanDetails })) {
    const rawW =
      cleanDetails.calculationMethod === 'money'
        ? actualWeightFromMoney(cleanDetails, Number(cleanDetails.baseKarat || baseKarat))
        : numberValue(cleanDetails.claimWeight || cleanDetails.rawWeight);
    const pVal = numberValue(cleanDetails.purity) || Number(cleanDetails.baseKarat || baseKarat);
    c750 = line.converted750 !== undefined && line.converted750 > 0
      ? line.converted750
      : convertedTo750(String(rawW), pVal, Number(cleanDetails.baseKarat || baseKarat));
  }

  return {
    ...line,
    converted750: c750,
    details: cleanDetails,
  };
}


