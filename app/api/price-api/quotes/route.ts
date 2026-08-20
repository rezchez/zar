import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { defaultPriceApiSettings, normalizePriceApiSettings } from '@/lib/price-api';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const settingsRecord = await context.pb.collection('price_api_settings')
    .getFirstListItem('id != ""')
    .catch(() => null);
  const settings = settingsRecord
    ? normalizePriceApiSettings(settingsRecord as Record<string, unknown>)
    : defaultPriceApiSettings;

  const activeSymbols = settings.selectedSymbols.length > 0
    ? settings.selectedSymbols
    : settings.availableUnits.map((unit) => unit.symbol);

  if (activeSymbols.length === 0) {
    return NextResponse.json({ quotes: [], activeSymbols: [], intervalMinutes: settings.intervalMinutes });
  }

  const records = await context.pb.collection('price_history').getFullList({
    sort: '-fetchedAt',
  }).catch(() => []);

  const activeSet = new Set(activeSymbols);
  const latestBySymbol = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    const symbol = String(record.symbol || '');
    if (activeSet.has(symbol) && !latestBySymbol.has(symbol)) {
      latestBySymbol.set(symbol, record as unknown as Record<string, unknown>);
    }
  }

  const unitBySymbol = new Map(settings.availableUnits.map((unit) => [unit.symbol, unit]));
  const quotes = activeSymbols.flatMap((symbol) => {
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

  return NextResponse.json({
    quotes,
    activeSymbols,
    intervalMinutes: settings.intervalMinutes,
    lastSyncAt: settings.lastSyncAt,
  });
}
