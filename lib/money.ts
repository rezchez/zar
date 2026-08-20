import { normalizeDigits } from './jalali';

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

export function parseLocalizedAmount(value: string | number): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) return 0;

  const normalized = normalizeDigits(String(value))
    .replace(/[,\u066B\u066C\u00A0\s]/g, '') // remove commas, Persian/Arabic separators, non-breaking space
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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

export function formatCurrencyAmount(
  amount: number | bigint,
  currencyCode = 'IRR',
  fractionDigits?: number,
): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  const currency = SUPPORTED_CURRENCIES[currencyCode.toUpperCase()] || SUPPORTED_CURRENCIES.IRR;
  const decimals = fractionDigits ?? currency.decimals;

  const formattedNumber = new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return `${formattedNumber} ${currency.symbol}`;
}

export function getReadableCurrencyAmount(
  amount: number | bigint,
  currencyCode = 'IRR',
): string {
  const num = typeof amount === 'bigint' ? Number(amount) : amount;
  if (num === 0) return 'صفر';

  const code = currencyCode.toUpperCase();
  const currency = SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.IRR;

  if (code === 'IRR') {
    const toman = Math.floor(Math.abs(num) / 10);
    const tomanWords = numberToPersianWords(toman);
    return `معادل ${tomanWords} تومان`;
  }

  if (code === 'IRT') {
    const tomanWords = numberToPersianWords(Math.abs(num));
    return `${tomanWords} تومان`;
  }

  const words = numberToPersianWords(Math.abs(num));
  return `${words} ${currency.faName}`;
}
