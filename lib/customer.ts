import PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

export const customerTextFields = [
  'name',
  'gender',
  'groupName',
  'category',
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
  'telegramId',
  'address1',
  'address2',
  'postalCode',
  'nationalId',
  'fatherName',
  'email',
  'spouseName',
  'spouseNationalId',
  'spouseJob',
  'spouseMobile',
  'economicNumber',
  'registrationNumber',
  'rfid',
  'introductionMethod',
  'detailedDescription',
  'privateDescription',
  'startDocumentNumber',
] as const;

export const customerProfileNumberFields = [
  'collectionLevel',
  'discountLevel',
  'satisfactionLevel',
  'creditCeiling',
  'goldReturnDays',
  'contactCount',
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

export const customerDateFields = [
  'accountOpenedAt',
  'birthDate',
  'spouseBirthDate',
] as const;

export type Customer = {
  id: string;
  customerCode: number;
  openingBalanceTransaction: string;
  name: string;
  groupName: string;
  category: string;
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
  telegramId: string;
  address1: string;
  address2: string;
  postalCode: string;
  nationalId: string;
  fatherName: string;
  email: string;
  spouseName: string;
  spouseNationalId: string;
  spouseJob: string;
  spouseMobile: string;
  economicNumber: string;
  registrationNumber: string;
  rfid: string;
  accountOpenedAt: string;
  birthDate: string;
  spouseBirthDate: string;
  goldBalance: number;
  silverBalance: number;
  platinumBalance: number;
  rialBalance: number;
  foreignBalance: number;
  tertiaryBalance: number;
  collectionLevel: number;
  discountLevel: number;
  satisfactionLevel: number;
  creditCeiling: number;
  goldReturnDays: number;
  contactCount: number;
  showBalanceByUnit: boolean;
  introductionMethod: string;
  detailedDescription: string;
  privateDescription: string;
  startDocumentNumber: string;
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
    avatarUrl: record.avatar ? pb.files.getURL(record, record.avatar) : undefined,
    created: record.created,
    updated: record.updated,
  };
}

export const currencyOptions: Array<[string, string]> = [
  ['', 'انتخاب نشده'],
  ['rial', 'ریال (﷼)'],
  ['usd', 'دلار ($)'],
  ['eur', 'یورو (€)'],
  ['aed', 'درهم (د.إ)'],
  ['gbp', 'پوند (£)'],
  ['try', 'لیر (₺)'],
  ['cny', 'یوان (¥)'],
  ['sar', 'ریال سعودی (﷼)'],
  ['other', 'سایر'],
];

export function currencyDisplay(code: string, customSymbol = '') {
  const found = currencyOptions.find(([value]) => value === code);
  if (code === 'other') return customSymbol.trim() || 'ارز دیگر';
  if (!code) return 'ارز انتخاب‌نشده';
  return found?.[1] ?? code;
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
