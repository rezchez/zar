import 'server-only';

export const DEFAULT_PRICE_API_ENDPOINT =
  'https://Api.BrsApi.ir/Market/Gold_Currency.php';

export type PriceApiUnit = {
  category: string;
  symbol: string;
  name: string;
  nameEn: string;
  unit: string;
};

export type PriceApiSettings = {
  id?: string;
  endpoint: string;
  apiKey: string;
  intervalMinutes: number;
  enabled: boolean;
  selectedSymbols: string[];
  availableUnits: PriceApiUnit[];
  lastSyncAt: string;
  lastError: string;
};

export const defaultPriceApiSettings: PriceApiSettings = {
  endpoint: DEFAULT_PRICE_API_ENDPOINT,
  apiKey: '',
  intervalMinutes: 15,
  enabled: false,
  selectedSymbols: [],
  availableUnits: [],
  lastSyncAt: '',
  lastError: '',
};

export function normalizePriceApiSettings(input: Record<string, unknown>): PriceApiSettings {
  const parseJson = <T>(value: unknown, fallback: T): T => {
    if (Array.isArray(value)) return value as T;
    try {
      return JSON.parse(String(value || '')) as T;
    } catch {
      return fallback;
    }
  };

  const rawInterval = Number(input.intervalMinutes);
  const intervalMinutes = Number.isInteger(rawInterval) && rawInterval >= 1 && rawInterval <= 1440
    ? rawInterval
    : defaultPriceApiSettings.intervalMinutes;

  return {
    id: input.id ? String(input.id) : undefined,
    endpoint: DEFAULT_PRICE_API_ENDPOINT,
    apiKey: String(input.apiKey || ''),
    intervalMinutes,
    enabled: input.enabled === true || input.enabled === 'true',
    selectedSymbols: parseJson<string[]>(input.selectedSymbols, []).filter(Boolean),
    availableUnits: parseJson<PriceApiUnit[]>(input.availableUnits, []).filter(
      (unit) => unit && typeof unit.symbol === 'string',
    ),
    lastSyncAt: String(input.lastSyncAt || ''),
    lastError: String(input.lastError || ''),
  };
}

export function extractPriceUnits(payload: unknown): Array<PriceApiUnit & Record<string, unknown>> {
  if (!payload || typeof payload !== 'object') return [];
  const result: Array<PriceApiUnit & Record<string, unknown>> = [];

  for (const [category, values] of Object.entries(payload as Record<string, unknown>)) {
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const symbol = String(item.symbol || '').trim();
      if (!symbol) continue;
      result.push({
        ...item,
        category,
        symbol,
        name: String(item.name || symbol),
        nameEn: String(item.name_en || ''),
        unit: String(item.unit || ''),
      });
    }
  }
  return result;
}

export type MarketQuoteItem = {
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

export async function getLatestMarketQuotes(pb: {
  collection: (name: string) => {
    getFirstListItem: (filter: string) => Promise<unknown>;
    getList: (page: number, perPage: number, options?: Record<string, unknown>) => Promise<{ items: unknown[] }>;
  };
}): Promise<MarketQuoteItem[]> {
  try {
    const settingsRecord = await pb.collection('price_api_settings')
      .getFirstListItem('id != ""')
      .catch(() => null);
    const settings = settingsRecord
      ? normalizePriceApiSettings(settingsRecord as Record<string, unknown>)
      : defaultPriceApiSettings;

    // Fetch the latest 150 records from price_history (instantly covers all symbols without loading 15k rows)
    const recordsResult = await pb.collection('price_history').getList(1, 150, {
      sort: '-fetchedAt',
    }).catch(() => ({ items: [] }));

    const records = recordsResult.items || [];
    const latestBySymbol = new Map<string, Record<string, unknown>>();
    for (const record of records) {
      const rec = record as Record<string, unknown>;
      const symbol = String(rec.symbol || '').trim();
      if (symbol && !latestBySymbol.has(symbol)) {
        latestBySymbol.set(symbol, rec);
      }
    }

    const activeSymbols = settings.selectedSymbols.length > 0
      ? settings.selectedSymbols
      : settings.availableUnits.map((unit) => unit.symbol);

    const unitBySymbol = new Map(settings.availableUnits.map((unit) => [unit.symbol, unit]));
    const allSymbols = Array.from(new Set([...activeSymbols, ...latestBySymbol.keys()]));

    return allSymbols.flatMap((symbol) => {
      const record = latestBySymbol.get(symbol);
      if (!record) return [];
      const unit = unitBySymbol.get(symbol);
      return [{
        id: symbol,
        category: String(record.category || unit?.category || ''),
        title: String(record.name || unit?.name || symbol),
        symbol,
        unit: String(record.unit || unit?.unit || ''),
        nameEn: String(record.nameEn || unit?.nameEn || ''),
        price: Number(record.price) || 0,
        changeValue: Number(record.changeValue) || 0,
        changePercent: Number(record.changePercent) || 0,
        fetchedAt: String(record.fetchedAt || ''),
        sourceTimestamp: Number(record.sourceTimestamp) || 0,
      }];
    });
  } catch {
    return [];
  }
}
