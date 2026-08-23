import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import {
  defaultPriceApiSettings,
  extractPriceUnits,
  normalizePriceApiSettings,
} from '@/lib/price-api';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  const force = new URL(request.url).searchParams.get('force') === '1';

  const settingsRecord = await context.pb.collection('price_api_settings')
    .getFirstListItem('id != ""')
    .catch(() => null);
  const settings = settingsRecord
    ? normalizePriceApiSettings(settingsRecord as Record<string, unknown>)
    : defaultPriceApiSettings;

  if (!settings.enabled && !force) return NextResponse.json({ skipped: true, message: 'دریافت قیمت غیرفعال است.' });
  if (!force && settingsRecord?.lastSyncAt) {
    const elapsed = Date.now() - new Date(settingsRecord.lastSyncAt).getTime();
    if (Number.isFinite(elapsed) && elapsed < settings.intervalMinutes * 60_000) {
      return NextResponse.json({ skipped: true, nextSyncAt: new Date(new Date(settingsRecord.lastSyncAt).getTime() + settings.intervalMinutes * 60_000).toISOString() });
    }
  }

  if (!settings.apiKey) {
    return NextResponse.json({ message: 'کلید API قیمت تنظیم نشده است.' }, { status: 400 });
  }

  const endpoint = new URL(settings.endpoint);
  endpoint.searchParams.set('key', settings.apiKey);

  try {
    const response = await fetch(endpoint.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`API پاسخ ${response.status} برگرداند.`);
    const payload = await response.json();
    const units = extractPriceUnits(payload);
    const selected = new Set(settings.selectedSymbols);
    const selectedSymbols = selected.size > 0
      ? settings.selectedSymbols
      : units.map((unit) => unit.symbol);
    const requestId = crypto.randomUUID();
    const fetchedAt = new Date().toISOString();
    const records = units.filter((unit) => selectedSymbols.includes(unit.symbol));

    await Promise.all(records.map((item) => context.pb.collection('price_history').create({
      category: item.category,
      symbol: item.symbol,
      name: item.name,
      nameEn: item.nameEn,
      price: Number(item.price) || 0,
      changeValue: Number(item.change_value) || 0,
      changePercent: Number(item.change_percent) || 0,
      unit: item.unit,
      marketCap: Number(item.market_cap) || 0,
      description: String(item.description || ''),
      sourceTimestamp: Number(item.time_unix) || 0,
      fetchedAt,
      requestId,
    })));

    const update = {
      availableUnits: JSON.stringify(units.map(({ category, symbol, name, nameEn, unit }) => ({ category, symbol, name, nameEn, unit }))),
      selectedSymbols: JSON.stringify(selectedSymbols),
      lastSyncAt: fetchedAt,
      lastError: '',
    };
    if (settingsRecord) await context.pb.collection('price_api_settings').update(settingsRecord.id, update);
    return NextResponse.json({ ok: true, stored: records.length, units: update.availableUnits });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در دریافت قیمت‌ها.';
    if (settingsRecord) await context.pb.collection('price_api_settings').update(settingsRecord.id, { lastError: message }).catch(() => undefined);
    return NextResponse.json({ message }, { status: 502 });
  }
}
