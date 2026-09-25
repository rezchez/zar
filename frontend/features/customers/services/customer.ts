import PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

export const customerTextFields = [
  'name',
  'englishName',
  'gender',
  'groupName',
  'province',
  'city',
  'metalType',
  'primaryCurrency',
  'secondaryCurrency',
  'secondaryCurrencySymbol',
  'tertiaryCurrency',
  'tertiaryCurrencySymbol',
  'phone1',
  'phone2',
  'phone3',
  'address1',
  'postalCode',
  'nationalId',
  'fatherName',
  'email',
  'spouseMobile',
  'introductionMethod',
  'privateDescription',
] as const;

export const customerProfileNumberFields = [
  'discountLevel',
  'creditCeiling',
  'goldReturnDays',
] as const;

// These values are stored only in transactions. The names remain aligned
// with the form fields so the opening-balance form can stay readable.
export const customerBalanceFields = [
  'goldBalance',
  'silverBalance',
  'platinumBalance',
  'rialBalance',
  'foreignBalance',
  'tertiaryBalance',
] as const;

export const customerNumberFields = customerProfileNumberFields;

export type CustomerBalanceValues = {
  goldBalance: number;
  silverBalance: number;
  platinumBalance: number;
  rialBalance: number;
  foreignBalance: number;
  tertiaryBalance: number;
  currencyBalances?: Record<string, number>;
};

export function emptyCustomerBalances(): CustomerBalanceValues {
  return {
    goldBalance: 0,
    silverBalance: 0,
    platinumBalance: 0,
    rialBalance: 0,
    foreignBalance: 0,
    tertiaryBalance: 0,
  };
}

export const customerDateFields = ['birthDate'] as const;

export type Customer = {
  id: string;
  customerCode: number;
  openingBalanceTransaction: string;
  name: string;
  englishName: string;
  groupName: string;
  province: string;
  city: string;
  metalType: string;
  primaryCurrency: string;
  secondaryCurrency: string;
  secondaryCurrencySymbol: string;
  tertiaryCurrency: string;
  tertiaryCurrencySymbol: string;
  gender: 'male' | 'female' | '';
  phone1: string;
  phone2: string;
  phone3: string;
  address1: string;
  postalCode: string;
  nationalId: string;
  fatherName: string;
  email: string;
  spouseMobile: string;
  goldBalance: number;
  silverBalance: number;
  platinumBalance: number;
  rialBalance: number;
  foreignBalance: number;
  tertiaryBalance: number;
  currencyBalances?: Record<string, number>;
  discountLevel: number;
  creditCeiling: number;
  goldReturnDays: number;
  showBalanceByUnit: boolean;
  introductionMethod: string;
  privateDescription: string;
  birthDate: string;
  hasPrivateDescription?: boolean;
  avatarUrl?: string;
  openingBalances: CustomerBalanceValues;
  created: string;
  updated: string;
};

export function mapCustomer(
  pb: PocketBase,
  record: RecordModel,
  balances: {
    current?: Partial<CustomerBalanceValues>;
    opening?: Partial<CustomerBalanceValues>;
  } = {},
): Customer {
  const result = {} as Customer;

  for (const field of customerTextFields) {
    (result as Record<string, unknown>)[field] =
      typeof record[field] === 'string' ? record[field] : '';
  }
  for (const field of customerDateFields) {
    (result as Record<string, unknown>)[field] =
      typeof record[field] === 'string' ? record[field] : '';
  }
  for (const field of customerNumberFields) {
    (result as Record<string, unknown>)[field] =
      typeof record[field] === 'number' ? record[field] : 0;
  }

  const currentBalances = {
    ...emptyCustomerBalances(),
    ...balances.current,
  };
  const openingBalances = {
    ...emptyCustomerBalances(),
    ...balances.opening,
  };

  return {
    ...result,
    id: record.id,
    customerCode: Number(record.customerCode ?? 0),
    openingBalanceTransaction:
      typeof record.openingBalanceTransaction === 'string'
        ? record.openingBalanceTransaction
        : '',
    ...currentBalances,
    openingBalances,
    showBalanceByUnit: record.showBalanceByUnit === true,
    hasPrivateDescription: Boolean(record.privateDescription && String(record.privateDescription).trim().length > 0),
    avatarUrl: record.avatar ? pb.files.getURL(record, record.avatar) : undefined,
    created: record.created,
    updated: record.updated,
  };
}

export const currencyOptions: Array<[string, string]> = [
  ['', 'انتخاب نشده'],
  ['rial', 'ریال (﷼)'],
  ['irr', 'ریال (﷼)'],
  ['irt', 'تومان'],
  ['usd', 'دلار ($)'],
  ['eur', 'یورو (€)'],
  ['aed', 'درهم (د.إ)'],
  ['gbp', 'پوند (£)'],
  ['try', 'لیر (₺)'],
  ['cny', 'یوان (¥)'],
  ['sar', 'ریال سعودی (﷼)'],
  ['other', 'سایر'],
];

export interface CurrencyDetails {
  name: string;
  symbol: string;
  fullName: string;
}

export const CURRENCY_METADATA: Record<string, CurrencyDetails> = {
  USD: { name: 'دلار', symbol: '$', fullName: 'دلار ($)' },
  EUR: { name: 'یورو', symbol: '€', fullName: 'یورو (€)' },
  AED: { name: 'درهم', symbol: 'د.إ', fullName: 'درهم (د.إ)' },
  GBP: { name: 'پوند', symbol: '£', fullName: 'پوند (£)' },
  TRY: { name: 'لیر', symbol: '₺', fullName: 'لیر (₺)' },
  CNY: { name: 'یوان', symbol: '¥', fullName: 'یوان (¥)' },
  SAR: { name: 'ریال سعودی', symbol: '﷼', fullName: 'ریال سعودی (﷼)' },
  IRR: { name: 'ریال', symbol: 'ریال', fullName: 'ریال (﷼)' },
  IRT: { name: 'تومان', symbol: 'تومان', fullName: 'تومان' },
};

export function getCurrencyMeta(code?: string, customSymbol = ''): CurrencyDetails {
  const raw = (code || '').trim();
  const norm = raw.toUpperCase();
  if (CURRENCY_METADATA[norm]) {
    const meta = CURRENCY_METADATA[norm];
    return {
      name: meta.name,
      symbol: customSymbol.trim() || meta.symbol,
      fullName: meta.fullName,
    };
  }

  const lower = raw.toLowerCase();
  const found = currencyOptions.find(([v]) => v.toLowerCase() === lower);
  if (found && found[0] && found[0] !== 'other') {
    const mainWord = found[1].split(' ')[0] || found[1];
    return {
      name: mainWord,
      symbol: customSymbol.trim() || norm || mainWord,
      fullName: found[1],
    };
  }

  if (norm === 'OTHER' || lower === 'other') {
    return {
      name: customSymbol.trim() || 'ارز دیگر',
      symbol: customSymbol.trim() || 'ارز',
      fullName: customSymbol.trim() || 'ارز دیگر',
    };
  }

  if (!raw) {
    return {
      name: customSymbol.trim() || 'ارز',
      symbol: customSymbol.trim() || 'واحد',
      fullName: customSymbol.trim() || 'ارز انتخاب‌نشده',
    };
  }

  return {
    name: raw,
    symbol: customSymbol.trim() || raw,
    fullName: customSymbol.trim() ? `${raw} (${customSymbol.trim()})` : raw,
  };
}

export function currencyDisplay(code: string, customSymbol = '') {
  if (!code && !customSymbol) return 'ارز انتخاب‌نشده';
  return getCurrencyMeta(code, customSymbol).fullName;
}

export const SYMBOL_TO_CODE: Record<string, string> = {
  '$': 'USD',
  '€': 'EUR',
  'د.إ': 'AED',
  '£': 'GBP',
  '₺': 'TRY',
  '¥': 'CNY',
  '﷼': 'SAR',
};

export function normalizeCurrencyCode(code?: string): string {
  if (!code) return '';
  const raw = String(code).trim();
  if (SYMBOL_TO_CODE[raw]) return SYMBOL_TO_CODE[raw];
  const upper = raw.toUpperCase();
  if (CURRENCY_METADATA[upper]) return upper;
  const lower = raw.toLowerCase();
  if (lower === 'usd') return 'USD';
  if (lower === 'eur') return 'EUR';
  if (lower === 'aed') return 'AED';
  if (lower === 'gbp') return 'GBP';
  if (lower === 'try') return 'TRY';
  if (lower === 'cny') return 'CNY';
  if (lower === 'sar') return 'SAR';
  if (lower === 'irr' || lower === 'rial') return 'IRR';
  if (lower === 'irt' || lower === 'toman') return 'IRT';
  return upper;
}

export function appendCustomerFormData(
  formData: FormData,
  source: Record<string, unknown>,
) {
  for (const field of customerTextFields) {
    formData.append(field, String(source[field] ?? ''));
  }
  for (const field of customerNumberFields) {
    formData.append(field, String(source[field] ?? 0));
  }
  for (const field of customerDateFields) {
    formData.append(field, String(source[field] ?? ''));
  }
  formData.append('showBalanceByUnit', String(source.showBalanceByUnit === true));
}
