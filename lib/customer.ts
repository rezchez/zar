import PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

export const customerTextFields = [
  'name',
  'groupName',
  'category',
  'city',
  'metalType',
  'primaryCurrency',
  'secondaryCurrency',
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

export const customerNumberFields = [
  'goldBalance',
  'silverBalance',
  'platinumBalance',
  'rialBalance',
  'foreignBalance',
  'collectionLevel',
  'discountLevel',
  'satisfactionLevel',
  'creditCeiling',
  'goldReturnDays',
  'contactCount',
] as const;

export const customerDateFields = [
  'accountOpenedAt',
  'birthDate',
  'spouseBirthDate',
] as const;

export type Customer = {
  id: string;
  customerCode: number;
  name: string;
  groupName: string;
  category: string;
  city: string;
  metalType: string;
  primaryCurrency: string;
  secondaryCurrency: string;
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
  created: string;
  updated: string;
};

export function mapCustomer(pb: PocketBase, record: RecordModel): Customer {
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

  return {
    ...result,
    id: record.id,
    customerCode: Number(record.customerCode ?? 0),
    showBalanceByUnit: record.showBalanceByUnit === true,
    avatarUrl: record.avatar ? pb.files.getURL(record, record.avatar) : undefined,
    created: record.created,
    updated: record.updated,
  };
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
