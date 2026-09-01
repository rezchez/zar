import { normalizeDigits } from './jalali';

export type BaseCurrency = 'IRR' | 'IRT';

export type CurrencyInfo = {
  code: string;
  faName: string;
  symbol: string;
  decimals: number;
};

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  IRR: { code: 'IRR', faName: 'ریال ایران', symbol: 'ریال', decimals: 0 },
  IRT: { code: 'IRT', faName: 'تومان ایران', symbol: 'تومان', decimals: 0 },
  USD: { code: 'USD', faName: 'دلار آمریکا', symbol: '$', decimals: 2 },
  EUR: { code: 'EUR', faName: 'یورو', symbol: '€', decimals: 2 },
  GBP: { code: 'GBP', faName: 'پوند بریتانیا', symbol: '£', decimals: 2 },
  AED: { code: 'AED', faName: 'درهم امارات', symbol: 'د.إ', decimals: 2 },
  TRY: { code: 'TRY', faName: 'لیر ترکیه', symbol: '₺', decimals: 2 },
  CNY: { code: 'CNY', faName: 'یوان چین', symbol: '¥', decimals: 2 },
  JPY: { code: 'JPY', faName: 'ین ژاپن', symbol: '¥', decimals: 0 },
  CAD: { code: 'CAD', faName: 'دلار کانادا', symbol: 'CA$', decimals: 2 },
  AUD: { code: 'AUD', faName: 'دلار استرالیا', symbol: 'A$', decimals: 2 },
  CHF: { code: 'CHF', faName: 'فرانک سوئیس', symbol: 'CHF', decimals: 2 },
  SAR: { code: 'SAR', faName: 'ریال عربستان', symbol: 'ر.س', decimals: 2 },
  IQD: { code: 'IQD', faName: 'دینار عراق', symbol: 'ع.د', decimals: 0 },
  INR: { code: 'INR', faName: 'روپیه هند', symbol: '₹', decimals: 2 },
};

/**
 * Converts integer Rial to integer Toman (Toman = Rial / 10).
 */
export function convertRialToToman(rialAmount: number | bigint): number {
  const num = typeof rialAmount === 'bigint' ? Number(rialAmount) : rialAmount;
  if (!Number.isFinite(num)) return 0;
  return Math.floor(num / 10);
}

/**
 * Converts integer Toman to integer Rial (Rial = Toman * 10).
 */
export function convertTomanToRial(tomanAmount: number | bigint): number {
  const num = typeof tomanAmount === 'bigint' ? Number(tomanAmount) : tomanAmount;
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 10);
}

/**
 * Parses localized Persian or English currency input string to pure number.
 */
export function parseLocalizedAmount(value: string | number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;

  const normalized = normalizeDigits(String(value))
    .replace(/[,\u066B\u066C\u00A0\s]/g, '') // remove commas, Persian separators, spaces
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const parseLocalizedMoney = parseLocalizedAmount;

/**
 * Gets localized label for currency code.
 */
export function getCurrencyLabel(code: string): string {
  const key = (code || 'IRR').toUpperCase();
  return SUPPORTED_CURRENCIES[key]?.symbol || key;
}

const ones = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const teens = [
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
];
const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const hundreds = [
  '',
  'یکصد',
  'دویست',
  'سیصد',
  'چهارصد',
  'پانصد',
  'ششصد',
  'هفتصد',
  'هشتصد',
  'نهصد',
];
const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

function convertThreeDigits(num: number): string {
  if (num === 0) return '';
  const parts: string[] = [];

  const h = Math.floor(num / 100);
  const remainder = num % 100;
  const t = Math.floor(remainder / 10);
  const o = remainder % 10;

  if (h > 0) parts.push(hundreds[h]);

  if (remainder >= 10 && remainder < 20) {
    parts.push(teens[remainder - 10]);
  } else {
    if (t > 0) parts.push(tens[t]);
    if (o > 0) parts.push(ones[o]);
  }

  return parts.join(' و ');
}

export function numberToPersianWords(value: number | bigint): string {
  let num = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isFinite(num)) return '';
  if (num === 0) return 'صفر';

  const isNegative = num < 0;
  num = Math.abs(num);

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) return 'صفر';

  const groups: number[] = [];
  let temp = integerPart;

  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const groupValue = groups[i];
    if (groupValue > 0) {
      const words = convertThreeDigits(groupValue);
      const scale = scales[i];
      parts.push(scale ? `${words} ${scale}` : words);
    }
  }

  let result = parts.join(' و ');
  if (decimalPart > 0) {
    result += ` و ${convertThreeDigits(decimalPart)} صدم`;
  }

  return isNegative ? `منفی ${result}` : result;
}

/**
 * Formats standard amount based on given or active base currency.
 * Input amount is assumed to be stored in Base Rial integer units.
 */
export function formatMoney(
  amountInRial: number | bigint,
  baseCurrency: BaseCurrency = 'IRR',
  fractionDigits?: number,
): string {
  const num = typeof amountInRial === 'bigint' ? Number(amountInRial) : amountInRial;
  const isToman = baseCurrency === 'IRT';
  const displayAmount = isToman ? Math.floor(num / 10) : num;
  const symbol = isToman ? 'تومان' : 'ریال';
  const decimals = fractionDigits ?? 0;

  const formattedNumber = new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(displayAmount);

  return `${formattedNumber} ${symbol}`;
}

export function formatCurrencyAmount(
  amount: number | bigint,
  currencyCode = 'IRR',
  fractionDigits?: number,
): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  const code = currencyCode.toUpperCase();

  if (code === 'IRT') {
    return formatMoney(convertTomanToRial(num), 'IRT', fractionDigits);
  }

  if (code === 'IRR') {
    return formatMoney(num, 'IRR', fractionDigits);
  }

  const currency = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.IRR;
  const decimals = fractionDigits ?? currency.decimals;

  const formattedNumber = new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return `${formattedNumber} ${currency.symbol}`;
}

export function getReadableCurrencyAmount(
  amount: number | bigint,
  currencyCode: string = 'IRR',
): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  if (num === 0) return 'صفر';

  const code = (currencyCode || 'IRR').toUpperCase();
  const absNum = Math.abs(num);

  if (code === 'IRT') {
    const words = numberToPersianWords(absNum);
    return `${words} تومان`;
  }

  if (code === 'IRR') {
    const words = numberToPersianWords(absNum);
    return `${words} ریال`;
  }

  const currency = SUPPORTED_CURRENCIES[code];
  const words = numberToPersianWords(absNum);
  return currency ? `${words} ${currency.faName}` : `${words} ${code}`;
}

export function formatPriceWithCommas(cleanVal: string | number): string {
  if (!cleanVal && cleanVal !== 0) return '';
  const str = String(cleanVal);
  const isNeg = str.startsWith('-');
  const unsigned = isNeg ? str.slice(1) : str;

  const parts = unsigned.split('.');
  const intPart = parts[0] ? parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';

  return `${isNeg ? '-' : ''}${intPart}${decimalPart}`;
}
