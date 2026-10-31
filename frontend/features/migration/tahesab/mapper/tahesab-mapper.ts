import { normalizePersianDigits } from '@/lib/normalize-persian-digits';
import { DEFAULT_ASSAY_LABORATORIES } from '@/lib/assay-laboratories';
import type {
  NormalizedMigrationData,
  NormalizedParty,
  NormalizedAssayLab,
  MigrationMappings,
  PartyMappingItem,
  AccountMappingItem,
  AssayLabMappingItem,
  CurrencyMappingItem,
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

export interface ExistingAssayLabSummary {
  id: string;
  name: string;
  phone?: string;
  city?: string;
  province?: string;
  code?: string;
  isActive?: boolean;
  isCustom?: boolean;
}

export interface ExistingCurrencySummary {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isSystem?: boolean;
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
  existingAssayLabs: ExistingAssayLabSummary[] = [],
  existingCurrencies: ExistingCurrencySummary[] = [],
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

  // 3. Assay Laboratory Mappings
  const assayLabMappings = buildAssayLabMappings(data.assayLabs || [], existingAssayLabs);

  // 4. Currency Mappings
  const currencyMappings = buildCurrencyMappings(data.currencies || [], existingCurrencies);

  return {
    accounts: accountMappings,
    parties: partyMappings,
    assayLabs: assayLabMappings,
    currencies: currencyMappings,
    defaultMetalKarat: 750,
    defaultCurrency: 'IRR',
  };
}

export function normalizeAssayLabText(val?: string): string {
  if (!val) return '';
  return normalizePersianDigits(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\s\-_.,()\[\]]/g, '')
    .toLowerCase();
}

export function stripAssayLabAffixes(val?: string): string {
  if (!val) return '';
  let s = normalizePersianDigits(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .trim();
  s = s.replace(/^(?:ری‌گیری|ری گیری|ریگیری|آزمایشگاه طلا و نقره|آزمایشگاه عیارسنجی|آزمایشگاه|عیارسنجی و ذوب|عیارسنجی|دفتر ری‌گیری|مرکز استعلام و عیارسنجی|سواله|مرکز عیارسنجی|کارگاه عیارسنجی)\s*/gi, '');
  s = s.replace(/\s*\([^)]*\)\s*$/g, '');
  s = s.replace(/\s*(?:تهران|مشهد|اصفهان|تبریز|شیراز|اردبیل|ساری|رشت|یزد|قم|کرج|اهواز|همدان|زنجان|قزوین|کرمان|ارومیه|اسلامشهر|ورامین|ملارد|اندیشه)\s*$/gi, '');
  return s.trim();
}

function cleanPhoneDigits(p?: string): string {
  if (!p) return '';
  const digits = normalizePersianDigits(p).replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-8) : '';
}

function pickBestMatch(matches: ExistingAssayLabSummary[]): ExistingAssayLabSummary | null {
  if (!matches || matches.length === 0) return null;
  const dbMatch = matches.find((m) => m.id.startsWith('db_') || m.id.length === 15);
  if (dbMatch) return dbMatch;
  return matches[0];
}

function isConsistentMatches(matches: ExistingAssayLabSummary[]): boolean {
  if (matches.length <= 1) return true;
  if (matches.some((m) => m.id.startsWith('db_') || m.id.length === 15)) return true;
  const firstStripped = normalizeAssayLabText(stripAssayLabAffixes(matches[0].name));
  return matches.every((m) => normalizeAssayLabText(stripAssayLabAffixes(m.name)) === firstStripped);
}

/**
 * Reconciles Tahesab assay laboratories with Zarfolio's official catalog and existing DB records.
 */
export function buildAssayLabMappings(
  sourceLabs: NormalizedAssayLab[],
  existingDbLabs: ExistingAssayLabSummary[] = [],
): AssayLabMappingItem[] {
  const catalogLabs: ExistingAssayLabSummary[] = [];
  const seenIds = new Set<string>();

  // 1. Existing DB records take highest precedence
  for (const dbLab of existingDbLabs) {
    if (dbLab.id && !seenIds.has(dbLab.id)) {
      seenIds.add(dbLab.id);
      catalogLabs.push(dbLab);
    }
  }

  // 2. Default nationwide catalog records
  for (const def of DEFAULT_ASSAY_LABORATORIES) {
    if (!seenIds.has(def.id)) {
      seenIds.add(def.id);
      catalogLabs.push({
        id: def.id,
        name: def.name,
        phone: def.phone,
        city: def.city,
        province: def.province,
        code: def.code,
        isActive: def.isActive,
      });
    }
  }

  const labsByPhone = new Map<string, ExistingAssayLabSummary[]>();
  const labsByExactName = new Map<string, ExistingAssayLabSummary[]>();
  const labsByStrippedName = new Map<string, ExistingAssayLabSummary[]>();

  for (const lab of catalogLabs) {
    const p = cleanPhoneDigits(lab.phone);
    if (p) {
      const list = labsByPhone.get(p) || [];
      list.push(lab);
      labsByPhone.set(p, list);
    }

    const exact = normalizeAssayLabText(lab.name);
    if (exact) {
      const list = labsByExactName.get(exact) || [];
      list.push(lab);
      labsByExactName.set(exact, list);
    }

    const stripped = normalizeAssayLabText(stripAssayLabAffixes(lab.name));
    if (stripped) {
      const list = labsByStrippedName.get(stripped) || [];
      list.push(lab);
      labsByStrippedName.set(stripped, list);
    }
  }

  const results: AssayLabMappingItem[] = [];

  for (const src of sourceLabs) {
    const srcPhone = cleanPhoneDigits(src.phone);
    const srcExact = normalizeAssayLabText(src.name);
    const srcStripped = normalizeAssayLabText(stripAssayLabAffixes(src.name));

    // 1. Phone match
    if (srcPhone && labsByPhone.has(srcPhone)) {
      const matches = labsByPhone.get(srcPhone)!;
      if (isConsistentMatches(matches)) {
        const m = pickBestMatch(matches)!;
        results.push({
          sourceName: src.name,
          sourcePhone: src.phone,
          sourceAddress: src.address,
          targetAssayLabId: m.id,
          targetAssayLabName: m.name,
          targetProvince: m.province,
          targetCity: m.city,
          status: 'mapped',
          matchType: 'exact_phone',
          notes: `تطبیق قطعی با ری‌گیری (${m.name}) از طریق شماره تماس`,
        });
        continue;
      }
    }

    // 2. Exact clean name match
    if (srcExact && labsByExactName.has(srcExact)) {
      const matches = labsByExactName.get(srcExact)!;
      if (isConsistentMatches(matches)) {
        const m = pickBestMatch(matches)!;
        results.push({
          sourceName: src.name,
          sourcePhone: src.phone,
          sourceAddress: src.address,
          targetAssayLabId: m.id,
          targetAssayLabName: m.name,
          targetProvince: m.province,
          targetCity: m.city,
          status: 'mapped',
          matchType: 'exact_name',
          notes: `تطبیق دقیق نام با ری‌گیری (${m.name})`,
        });
        continue;
      }
    }

    // 3. Stripped canonical name match
    if (srcStripped && labsByStrippedName.has(srcStripped)) {
      const matches = labsByStrippedName.get(srcStripped)!;
      if (isConsistentMatches(matches)) {
        const m = pickBestMatch(matches)!;
        results.push({
          sourceName: src.name,
          sourcePhone: src.phone,
          sourceAddress: src.address,
          targetAssayLabId: m.id,
          targetAssayLabName: m.name,
          targetProvince: m.province,
          targetCity: m.city,
          status: 'mapped',
          matchType: 'canonical_name',
          notes: `تطبیق ساختاری عنوان با ری‌گیری (${m.name})`,
        });
        continue;
      }
    }

    // 4. City-aware / Containment stem match
    let stemMatch: ExistingAssayLabSummary | null = null;
    if (srcStripped.length >= 3) {
      for (const [st, list] of labsByStrippedName.entries()) {
        if (st.includes(srcStripped) || srcStripped.includes(st)) {
          if (Math.abs(st.length - srcStripped.length) <= 8) {
            stemMatch = pickBestMatch(list);
            if (stemMatch) break;
          }
        }
      }
    }

    if (stemMatch) {
      results.push({
        sourceName: src.name,
        sourcePhone: src.phone,
        sourceAddress: src.address,
        targetAssayLabId: stemMatch.id,
        targetAssayLabName: stemMatch.name,
        targetProvince: stemMatch.province,
        targetCity: stemMatch.city,
        status: 'mapped',
        matchType: 'stem_keyword',
        notes: `تطبیق کلیدواژه عنوان با ری‌گیری (${stemMatch.name})`,
      });
      continue;
    }

    // 5. New laboratory
    results.push({
      sourceName: src.name,
      sourcePhone: src.phone,
      sourceAddress: src.address,
      status: 'new_lab',
      matchType: 'create_new',
      notes: 'ری‌گیری جدید (در زمان ایمپورت به صورت خودکار به لیست ری‌گیری‌های سیستم افزوده خواهد شد)',
    });
  }

  return results;
}

export function getSourceCurrencyName(code: string): string {
  switch (code.toUpperCase()) {
    case 'USD':
      return 'دلار آمریکا';
    case 'EUR':
      return 'یورو';
    case 'AED':
      return 'درهم امارات';
    case 'GBP':
      return 'پوند انگلیس';
    case 'TRY':
      return 'لیر ترکیه';
    case 'IQD':
      return 'دینار عراق';
    case 'CNY':
      return 'یوآن چین';
    case 'IRR':
    case 'IRT':
      return 'ریال ایران (تومان)';
    default:
      return code;
  }
}

/**
 * Maps Tahesab detected currencies to Zarfolio system currencies.
 */
export function buildCurrencyMappings(
  detectedCurrencies: string[] = [],
  existingCurrencies: ExistingCurrencySummary[] = [],
): CurrencyMappingItem[] {
  const standardCatalog: ExistingCurrencySummary[] = [
    { id: 'curr_usd', code: 'USD', name: 'دلار آمریکا', symbol: '$', isSystem: true },
    { id: 'curr_eur', code: 'EUR', name: 'یورو', symbol: '€', isSystem: true },
    { id: 'curr_aed', code: 'AED', name: 'درهم امارات', symbol: 'د.إ', isSystem: true },
    { id: 'curr_gbp', code: 'GBP', name: 'پوند انگلیس', symbol: '£', isSystem: true },
    { id: 'curr_try', code: 'TRY', name: 'لیر ترکیه', symbol: '₺', isSystem: false },
    { id: 'curr_irr', code: 'IRR', name: 'ریال ایران (تومان)', symbol: 'تومان', isSystem: true },
  ];

  const pool = [...existingCurrencies];
  for (const std of standardCatalog) {
    if (!pool.some((c) => c.code.toUpperCase() === std.code.toUpperCase())) {
      pool.push(std);
    }
  }

  const results: CurrencyMappingItem[] = [];
  const sourceList = detectedCurrencies.length > 0 ? detectedCurrencies : ['IRR', 'USD'];

  const seen = new Set<string>();
  for (const src of sourceList) {
    const srcUpper = (src || '').trim().toUpperCase();
    if (!srcUpper || seen.has(srcUpper)) continue;
    seen.add(srcUpper);

    const matched =
      pool.find((c) => c.code.toUpperCase() === srcUpper) ||
      pool.find((c) => c.name.includes(src) || src.includes(c.name));

    if (matched) {
      results.push({
        sourceCode: srcUpper,
        sourceName: getSourceCurrencyName(srcUpper),
        targetCurrencyId: matched.id,
        targetCurrencyCode: matched.code.toUpperCase(),
        targetCurrencyName: matched.name,
        targetCurrencySymbol: matched.symbol,
        status: 'mapped',
        isSystem: matched.isSystem,
        notes: `تطبیق خودکار با ارز ${matched.name} (${matched.code})`,
      });
    } else {
      results.push({
        sourceCode: srcUpper,
        sourceName: getSourceCurrencyName(srcUpper),
        targetCurrencyCode: srcUpper,
        targetCurrencyName: srcUpper,
        targetCurrencySymbol: srcUpper,
        status: 'needs_review',
        notes: 'ارز جدید نیازمند بررسی یا ایجاد در زرفولیو',
      });
    }
  }

  return results;
}
