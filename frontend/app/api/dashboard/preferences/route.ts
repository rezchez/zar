import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getDefaultDashboardPreferences, normalizeDashboardPreferences } from '@/lib/dashboard-widgets';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const record = await context.pb.collection('dashboard_preferences').getFirstListItem(
      context.pb.filter('user = {:userId}', { userId: context.user.id })
    ).catch(() => null);

    const config = record ? normalizeDashboardPreferences(record.widget_config) : getDefaultDashboardPreferences();

    return NextResponse.json({ preferences: config });
  } catch {
    return NextResponse.json({ preferences: getDefaultDashboardPreferences() });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rawPreferences = body?.preferences;
    if (!rawPreferences || typeof rawPreferences !== 'object') {
      return NextResponse.json({ message: 'تنظیمات معتبر ارسال نشده است.' }, { status: 400 });
    }

    const normalizedConfig = normalizeDashboardPreferences(rawPreferences);

    const existingRecord = await context.pb.collection('dashboard_preferences').getFirstListItem(
      context.pb.filter('user = {:userId}', { userId: context.user.id })
    ).catch(() => null);

    if (existingRecord) {
      await context.pb.collection('dashboard_preferences').update(existingRecord.id, {
        widget_config: normalizedConfig,
      });
    } else {
      await context.pb.collection('dashboard_preferences').create({
        user: context.user.id,
        widget_config: normalizedConfig,
      });
    }

    return NextResponse.json({ success: true, preferences: normalizedConfig });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'ذخیره تنظیمات داشبورد انجام نشد.';
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}
