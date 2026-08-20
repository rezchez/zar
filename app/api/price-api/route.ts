import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { defaultPriceApiSettings, normalizePriceApiSettings } from '@/lib/price-api';

function canManage(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

async function getSettings(
  context: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>,
) {
  const pb = context.pb;
  const record = await pb.collection('price_api_settings').getFirstListItem('id != ""').catch(() => null);
  return record ? normalizePriceApiSettings(record as Record<string, unknown>) : defaultPriceApiSettings;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  return NextResponse.json({ settings: await getSettings(context) });
}

export async function PUT(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  if (!canManage(context)) return NextResponse.json({ message: 'دسترسی تغییر تنظیمات را ندارید.' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی نامعتبر است.' }, { status: 400 });
  }

  const interval = Number(body.intervalMinutes);
  if (!Number.isInteger(interval) || interval < 1 || interval > 1440) {
    return NextResponse.json({ message: 'بازه درخواست باید عدد صحیحی بین ۱ تا ۱۴۴۰ دقیقه باشد.' }, { status: 400 });
  }
  const apiKey = String(body.apiKey || '').trim();
  if (!apiKey) {
    return NextResponse.json({ message: 'لطفاً کلید API قیمت را وارد کنید.' }, { status: 400 });
  }

  const current = await context.pb.collection('price_api_settings').getFirstListItem('id != ""').catch(() => null);
  const normalized = normalizePriceApiSettings({
    ...(current as Record<string, unknown> | null),
    ...body,
    intervalMinutes: interval,
  });
  const payload = {
    endpoint: normalized.endpoint,
    apiKey,
    intervalMinutes: normalized.intervalMinutes,
    enabled: normalized.enabled,
    selectedSymbols: JSON.stringify(normalized.selectedSymbols),
    availableUnits: JSON.stringify(normalized.availableUnits),
    lastSyncAt: current?.lastSyncAt || '',
    lastError: '',
    updatedBy: context.user.id,
  };
  const record = current
    ? await context.pb.collection('price_api_settings').update(current.id, payload)
    : await context.pb.collection('price_api_settings').create(payload);

  return NextResponse.json({ settings: normalizePriceApiSettings(record as Record<string, unknown>) });
}
