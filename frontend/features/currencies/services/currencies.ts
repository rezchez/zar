import type Client from 'pocketbase';

export interface Currency {
  id: string;
  name: string;
  symbol: string;
  code: string;
  isSystem?: boolean;
  decimals?: number;
  sortOrder?: number;
  createdBy?: string;
  created?: string;
  updated?: string;
}

type PocketBaseCurrencyRecord = Record<string, any>;

export class DuplicateCurrencyError extends Error {
  constructor(name: string, code: string) {
    super(`ارز «${name}» با کد ${code} قبلاً ثبت شده است.`);
    this.name = 'DuplicateCurrencyError';
  }
}

function mapCurrencyRecord(record: PocketBaseCurrencyRecord): Currency {
  return {
    id: String(record.id ?? ''),
    name: String(record.name ?? record.title ?? '').trim(),
    symbol: String(record.symbol ?? record.sign ?? '').trim(),
    code: String(record.code ?? record.currency_code ?? record.symbol ?? record.sign ?? '').trim().toUpperCase(),
    isSystem: Boolean(record.is_system ?? record.isSystem),
    decimals: typeof (record.decimals ?? record.precision) === 'number'
      ? (record.decimals ?? record.precision)
      : 2,
    sortOrder: typeof (record.sort_order ?? record.sortOrder) === 'number'
      ? (record.sort_order ?? record.sortOrder)
      : 100,
    createdBy: record.created_by ?? record.createdBy,
    created: record.created,
    updated: record.updated,
  };
}

export function getCurrencyDisplayName(currency: Currency): string {
  if (currency.symbol && currency.symbol !== currency.name) return `${currency.name} (${currency.symbol})`;
  if (currency.code && currency.code !== currency.name) return `${currency.name} (${currency.code})`;
  return currency.name;
}

export function formatDynamicAmountLabel(currency?: Currency | null): string {
  if (!currency) return 'موجودی اولیه';
  return `موجودی اولیه ${currency.name || currency.symbol || currency.code || 'ارز'}`;
}

export async function getCurrencies(pb?: Client | null): Promise<Currency[]> {
  if (!pb) return [];

  try {
    const collection = pb.collection('currencies');
    let records: PocketBaseCurrencyRecord[];
    try {
      records = await collection.getFullList({ sort: '+sort_order,+created' });
    } catch {
      records = await collection.getFullList();
    }
    const mapped = records.map(mapCurrencyRecord).filter((currency) => currency.id && currency.name);
    return mapped;
  } catch {
    return [];
  }
}

export async function createCurrency(
  pb: Client,
  data: { name: string; symbol: string; code?: string; decimals?: number },
  userId?: string,
): Promise<Currency> {
  const name = data.name.trim();
  const symbol = data.symbol.trim();
  const code = (data.code || data.symbol).trim().toUpperCase();
  const decimals = typeof data.decimals === 'number' ? data.decimals : 2;

  if (!name) throw new Error('نام ارز الزامی است.');
  if (!symbol) throw new Error('نماد ارز الزامی است.');
  if (!code) throw new Error('کد ارز الزامی است.');

  const existing = await pb.collection('currencies').getFirstListItem(
    pb.filter('code = {:code} || name = {:name}', { code, name }),
  ).catch(() => null);
  if (existing) {
    throw new DuplicateCurrencyError(
      String(existing.name || name).trim(),
      String(existing.code || code).trim().toUpperCase(),
    );
  }

  const payload: Record<string, unknown> = { name, symbol, code, decimals };
  try {
    const collection = await pb.collections.getOne('currencies');
    const fieldNames = new Set(
      Array.isArray(collection.fields)
        ? collection.fields.map((field: { name?: string }) => field.name).filter(Boolean)
        : [],
    );
    if (fieldNames.has('is_system')) payload.is_system = false;
    else if (fieldNames.has('isSystem')) payload.isSystem = false;
    if (userId && fieldNames.has('created_by')) payload.created_by = userId;
    else if (userId && fieldNames.has('createdBy')) payload.createdBy = userId;
    if (userId && fieldNames.has('updated_by')) payload.updated_by = userId;
    else if (userId && fieldNames.has('updatedBy')) payload.updatedBy = userId;
  } catch {
    // Minimal existing collections may expose only name/symbol/code/decimals.
  }

  const record = await pb.collection('currencies').create(payload);
  return mapCurrencyRecord({ ...record, is_system: false });
}

export async function deleteCurrency(pb: Client, idOrCode: string): Promise<boolean> {
  const clean = idOrCode.trim();
  if (!clean) throw new Error('شناسه ارز الزامی است.');

  let recordId = clean;
  const record = await pb.collection('currencies').getOne(clean).catch(() => null);
  if (record) recordId = record.id;
  else {
    const found = await pb.collection('currencies').getFirstListItem(
      pb.filter('code = {:code} || id = {:id}', { code: clean.toUpperCase(), id: clean }),
    ).catch(() => null);
    if (found) recordId = found.id;
  }
  await pb.collection('currencies').delete(recordId);
  return true;
}
