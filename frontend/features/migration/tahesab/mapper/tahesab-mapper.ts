import { normalizePersianDigits } from '@/lib/normalize-persian-digits';
import type {
  NormalizedMigrationData,
  NormalizedParty,
  MigrationMappings,
  PartyMappingItem,
  AccountMappingItem,
} from '../types';

export interface ExistingCustomerSummary {
  id: string;
  name: string;
  phone1?: string;
  customerCode?: number;
}

export interface ExistingAccountSummary {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
}

function cleanString(val?: string): string {
  if (!val) return '';
  return normalizePersianDigits(val)
    .replace(/[\s\-_]/g, '')
    .toLowerCase();
}

/**
 * Standard System Account Code mappings for jewelry double-entry accounting.
 */
export const DEFAULT_TAHESAB_ACCOUNT_MAPPINGS: Array<{
  sourceCode: string;
  sourceName: string;
  targetAccountCode: string;
  targetAccountName: string;
}> = [
  { sourceCode: '101', sourceName: 'صندوق و موجودی نقد', targetAccountCode: '1110', targetAccountName: 'موجودی نقد و بانک' },
  { sourceCode: '102', sourceName: 'بانک‌ها و حساب‌های جاری', targetAccountCode: '1110', targetAccountName: 'موجودی نقد و بانک' },
  { sourceCode: '103', sourceName: 'موجودی طلای خام و آبشده', targetAccountCode: '1130', targetAccountName: 'موجودی کالا و طلا' },
  { sourceCode: '104', sourceName: 'اسناد دریافتنی (چک‌ها)', targetAccountCode: '1120', targetAccountName: 'اسناد دریافتنی تجاری' },
  { sourceCode: '201', sourceName: 'بدهی طرف‌حساب‌ها (بستانکاران)', targetAccountCode: '2120', targetAccountName: 'حساب‌های پرداختنی تجاری' },
  { sourceCode: '202', sourceName: 'اسناد پرداختنی (چک‌های صادره)', targetAccountCode: '2110', targetAccountName: 'اسناد پرداختنی تجاری' },
  { sourceCode: '301', sourceName: 'سرمایه و موجودی اولیه', targetAccountCode: '3100', targetAccountName: 'سرمایه اول دوره' },
  { sourceCode: '401', sourceName: 'فروش طلا و درآمدها', targetAccountCode: '4110', targetAccountName: 'فروش طلا و مسکوکات' },
  { sourceCode: '501', sourceName: 'بهای تمام‌شده طلا', targetAccountCode: '5200', targetAccountName: 'بهای تمام‌شده کالای فروش‌رفته' },
];

/**
 * Generates deterministic initial mappings between Tahesab entities and Zarfolio targets.
 * Strictly avoids ambiguous fuzzy matching.
 */
export function buildInitialMappings(
  data: NormalizedMigrationData,
  existingCustomers: ExistingCustomerSummary[] = [],
  existingAccounts: ExistingAccountSummary[] = [],
): MigrationMappings {
  // Index existing customers by clean name and clean phone
  const customersByName = new Map<string, ExistingCustomerSummary[]>();
  const customersByPhone = new Map<string, ExistingCustomerSummary[]>();

  for (const c of existingCustomers) {
    const cName = cleanString(c.name);
    if (cName) {
      const list = customersByName.get(cName) || [];
      list.push(c);
      customersByName.set(cName, list);
    }

    const cPhone = cleanString(c.phone1);
    if (cPhone && cPhone.length >= 7) {
      const list = customersByPhone.get(cPhone) || [];
      list.push(c);
      customersByPhone.set(cPhone, list);
    }
  }

  // 1. Party Mappings
  const partyMappings: PartyMappingItem[] = [];

  for (const party of data.parties) {
    const pName = cleanString(party.name);
    const pPhone = cleanString(party.phone1);

    const nameMatches = customersByName.get(pName) || [];
    const phoneMatches = pPhone && pPhone.length >= 7 ? customersByPhone.get(pPhone) || [] : [];

    // Ambiguous multiple matches
    if (nameMatches.length > 1 || phoneMatches.length > 1) {
      partyMappings.push({
        sourceCode: party.sourceCode,
        sourceName: party.name,
        sourcePhone: party.phone1,
        status: 'needs_review',
        notes: 'بیش از یک طرف‌حساب با نام یا شماره مشابه در سیستم وجود دارد. تطبیق خودکار متوقف شد.',
      });
      continue;
    }

    // Exact single match on name
    if (nameMatches.length === 1) {
      const matched = nameMatches[0];
      partyMappings.push({
        sourceCode: party.sourceCode,
        sourceName: party.name,
        sourcePhone: party.phone1,
        targetCustomerId: matched.id,
        targetCustomerName: matched.name,
        status: 'mapped',
        matchType: 'exact_name',
        notes: `تطبیق دقیق بر اساس نام شخص (${matched.name})`,
      });
      continue;
    }

    // Exact single match on phone
    if (phoneMatches.length === 1) {
      const matched = phoneMatches[0];
      partyMappings.push({
        sourceCode: party.sourceCode,
        sourceName: party.name,
        sourcePhone: party.phone1,
        targetCustomerId: matched.id,
        targetCustomerName: matched.name,
        status: 'mapped',
        matchType: 'exact_phone',
        notes: `تطبیق دقیق بر اساس شماره تماس (${matched.phone1})`,
      });
      continue;
    }

    // New Party
    partyMappings.push({
      sourceCode: party.sourceCode,
      sourceName: party.name,
      sourcePhone: party.phone1,
      status: 'new_party',
      matchType: 'create_new',
      notes: 'طرف‌حساب جدید (در زمان ایمپورت به صورت خودکار ایجاد خواهد شد)',
    });
  }

  // 2. Account Mappings
  const accountsByCode = new Map<string, ExistingAccountSummary>();
  for (const a of existingAccounts) {
    accountsByCode.set(a.code, a);
  }

  const accountMappings: AccountMappingItem[] = [];

  for (const def of DEFAULT_TAHESAB_ACCOUNT_MAPPINGS) {
    const existing = accountsByCode.get(def.targetAccountCode);
    if (existing) {
      accountMappings.push({
        sourceCode: def.sourceCode,
        sourceName: def.sourceName,
        targetAccountId: existing.id,
        targetAccountCode: existing.code,
        targetAccountName: existing.name,
        status: 'mapped',
        notes: 'نگاشت سیستمی به سرفصل دفتر کل زرفولیو',
      });
    } else {
      accountMappings.push({
        sourceCode: def.sourceCode,
        sourceName: def.sourceName,
        targetAccountId: '',
        targetAccountCode: def.targetAccountCode,
        targetAccountName: def.targetAccountName,
        status: 'needs_review',
        notes: `سرفصل حساب ${def.targetAccountCode} در کدینگ زرفولیو یافت نشد. نیازمند بازبینی است.`,
      });
    }
  }

  return {
    accounts: accountMappings,
    parties: partyMappings,
    defaultMetalKarat: 750,
    defaultCurrency: 'IRR',
  };
}
