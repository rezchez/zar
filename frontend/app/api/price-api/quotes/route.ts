import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { defaultPriceApiSettings, normalizePriceApiSettings, getLatestMarketQuotes } from '@/lib/price-api';

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

  const quotes = await getLatestMarketQuotes(context.pb);

  const activeSymbols = settings.selectedSymbols.length > 0
    ? settings.selectedSymbols
    : settings.availableUnits.map((unit) => unit.symbol);

  return NextResponse.json({
    quotes,
    activeSymbols,
    intervalMinutes: settings.intervalMinutes,
    lastSyncAt: settings.lastSyncAt,
  });
}
