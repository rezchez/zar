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
  rawKind: RawOperationKind,
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

export function findCurrencyQuote(
  quotes: MarketQuote[],
  currencyCode: string,
): MarketQuote | undefined {
  if (!currencyCode || !Array.isArray(quotes) || quotes.length === 0) return undefined;
  const code = currencyCode.trim().toUpperCase();
  return quotes.find((q) => {
    const s = String(q.symbol || '').trim().toUpperCase();
    const t = String(q.title || '').trim().toLowerCase();
    if (s === code) return true;
    if (code === 'USD' && (s.includes('USD') || t.includes('دلار'))) return true;
    if (code === 'EUR' && (s.includes('EUR') || t.includes('یورو'))) return true;
    if (code === 'AED' && (s.includes('AED') || t.includes('درهم'))) return true;
    if (code === 'GBP' && (s.includes('GBP') || t.includes('پوند'))) return true;
    if ((code === 'USDT' || code === 'TETHER') && (s.includes('USDT') || t.includes('تتر'))) return true;
    return s === code || t === code.toLowerCase();
  });
}

export function getQuoteRateInRials(
  quotes: MarketQuote[],
  currencyCode: string,
): number {
  if (!currencyCode || !Array.isArray(quotes) || quotes.length === 0) return 0;
  const code = currencyCode.trim().toUpperCase();
  if (code === 'IRR') return 1;
  if (code === 'IRT') return 10;

  const found = findCurrencyQuote(quotes, code);
  if (!found || !found.price) return 0;
  const raw = Number(found.price);
  if (raw <= 0 || Number.isNaN(raw)) return 0;
  if (found.unit?.includes('ریال') || raw > 20_000_000) {
    return Math.round(raw);
  }
  return Math.round(raw * 10);
}
