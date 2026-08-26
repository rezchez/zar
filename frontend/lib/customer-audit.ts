import 'server-only';

import {
  customerBalanceFields,
  customerDateFields,
  customerProfileNumberFields,
  customerTextFields,
  type Customer,
} from '@/lib/customer';

const labels: Record<string, string> = {
  customerCode: 'کد حساب',
  showBalanceByUnit: 'نمایش مانده به تفکیک واحد',
  avatarUrl: 'آواتار',
  goldBalance: 'مانده طلا',
  silverBalance: 'مانده نقره',
  platinumBalance: 'مانده پلاتین',
  rialBalance: 'مانده ریالی',
  foreignBalance: 'مانده ارز دوم',
  tertiaryBalance: 'مانده ارز سوم',
  name: 'نام / عنوان',
  gender: 'جنسیت',
  groupName: 'گروه',
  province: 'استان',
  city: 'شهر',
  metalType: 'جنس فلز',
  primaryCurrency: 'ارز اول',
  secondaryCurrency: 'ارز دوم',
  secondaryCurrencySymbol: 'نماد ارز دوم',
  tertiaryCurrency: 'ارز سوم',
  tertiaryCurrencySymbol: 'نماد ارز سوم',
  phone1: 'تلفن ۱',
  phone2: 'تلفن ۲',
  phone3: 'تلفن ۳',
  telegramId: 'شناسه تلگرام',
  address1: 'آدرس',
  address2: 'آدرس دوم',
  postalCode: 'کد پستی',
  nationalId: 'کد ملی',
  fatherName: 'نام پدر',
  email: 'ایمیل',
  spouseName: 'نام همسر',
  spouseMobile: 'موبایل همسر',
  economicNumber: 'شماره اقتصادی',
  registrationNumber: 'شماره ثبت',
  birthDate: 'تاریخ تولد',
  spouseBirthDate: 'تاریخ تولد همسر',
  collectionLevel: 'میزان تحصیلات',
  discountLevel: 'میزان تخفیف',
  satisfactionLevel: 'میزان رضایت',
  creditCeiling: 'سقف اعتبار',
  goldReturnDays: 'روزهای برگشت طلا',
  contactCount: 'تعداد تماس',
  introductionMethod: 'نحوه آشنایی',
  detailedDescription: 'توضیحات بیشتر',
  privateDescription: 'توضیحات محرمانه',
  startDocumentNumber: 'شماره سند آغازین',
};

const auditedFields = [
  'customerCode',
  ...customerTextFields,
  ...customerDateFields,
  ...customerProfileNumberFields,
  ...customerBalanceFields,
  'showBalanceByUnit',
  'avatarUrl',
];

function valueFor(customer: Customer | null, field: string) {
  if (!customer) return '';
  if (customerBalanceFields.includes(field as (typeof customerBalanceFields)[number])) {
    return customer.openingBalances[field as keyof Customer['openingBalances']];
  }
  if (field === 'avatarUrl') return customer.avatarUrl ? 'دارد' : 'ندارد';
  return customer[field as keyof Customer] ?? '';
}

function normalize(value: unknown) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : value;
}

export function buildCustomerChanges(
  before: Customer | null,
  after: Customer | null,
) {
  const changes: Record<string, { label: string; before: unknown; after: unknown }> = {};

  for (const field of auditedFields) {
    const oldValue = normalize(valueFor(before, field));
    const newValue = normalize(valueFor(after, field));
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) continue;

    changes[field] = {
      label: labels[field] ?? field,
      before: oldValue,
      after: newValue,
    };
  }

  return changes;
}
