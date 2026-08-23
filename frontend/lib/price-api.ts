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
