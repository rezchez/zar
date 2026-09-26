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

export function getLineDocumentTypeLabel(
  nature: 'received' | 'paid',
  tab: string,
  rawKind?: RawOperationKind,
  unsettledTrade?: boolean,
  refiningOpKind?: string,
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
    if (unsettledTrade) {
      return nature === 'received' ? 'خرید ارز (بدون تسویه)' : 'فروش ارز (بدون تسویه)';
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
    return nature === 'received' ? 'دریافت سکه' : 'پرداخت سکه';
  }

  if (tab === 'goods') {
    return nature === 'received' ? 'ورود کالا و جواهر' : 'خروج کالا و جواهر';
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

  if (tab === 'workmanship') {
    return nature === 'received' ? 'ورود کار ساخته' : 'خروج کار ساخته';
  }

  if (tab === 'gold-sale') {
    if (rawKind === 'unsettled') return nature === 'received' ? 'خرید بدون تسویه' : 'فروش بدون تسویه';
    if (rawKind === 'misc') return nature === 'received' ? 'خرید متفرقه' : 'فروش متفرقه';
    return nature === 'received' ? 'خرید آب‌شده' : 'فروش آب‌شده';
  }

  // metals / raw-gold tab (ورود/خروج فلزات)
  if (rawKind === 'molten') return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
  if (rawKind === 'misc') return nature === 'received' ? 'ورود متفرقه' : 'خروج متفرقه';
  if (rawKind === 'conditional') return nature === 'received' ? 'ورود شرطی' : 'خروج شرطی';
  if (rawKind === 'question') return nature === 'received' ? 'ورود سواله' : 'خروج سواله';

  return nature === 'received' ? 'ورود آبشده' : 'خروج آبشده';
}

export function rawOperationLabel(nature: DocumentNature, kind: RawOperationKind): string {
  if (kind === 'conditional') return nature === 'received' ? 'ورود شرطی' : 'خروج شرطی';
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
  if (line.details.calculationMethod === 'money') {
    return actualWeightFromMoney(line.details, baseKarat);
  }
  return numberValue(line.details.rawWeight);
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

