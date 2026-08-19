import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { defaultAppSettings, type AppSettings } from '@/lib/settings';

function allowed(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

function normalize(input: Record<string, unknown>): AppSettings {
  return {
    company_name: String(input.company_name ?? defaultAppSettings.company_name).trim().slice(0, 120),
    fiscal_year_start: String(input.fiscal_year_start ?? '').trim().slice(0, 20),
    base_currency: String(input.base_currency ?? defaultAppSettings.base_currency).trim().slice(0, 12),
    weight_precision: Number(input.weight_precision) === 3 ? 3 : 2,
    doc_code_prefix: String(input.doc_code_prefix ?? defaultAppSettings.doc_code_prefix).trim().slice(0, 12) || 'ZF',
  };
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!allowed(context)) return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: context ? 403 : 401 });
  try {
    const record = await context!.pb.collection('app_settings').getFirstListItem('id != ""');
    return NextResponse.json({ settings: normalize(record as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ settings: defaultAppSettings });
  }
}

export async function PUT(request: Request) {
  const context = await getServerAuthContext();
  if (!allowed(context)) return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: context ? 403 : 401 });
  const settings = normalize((await request.json().catch(() => ({}))) as Record<string, unknown>);
  try {
    const collection = context!.pb.collection('app_settings');
    const existing = await collection.getFirstListItem('id != ""').catch(() => null);
    const payload = { ...settings, updated_by: context!.user.id };
    const record = existing ? await collection.update(existing.id, payload) : await collection.create(payload);
    return NextResponse.json({ settings: normalize(record as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ settings }, { status: 200 });
  }
}
