import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { defaultSettings, normalizeSettings } from '@/lib/settings';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.view') && !hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به تنظیمات.' }, { status: 403 });
  }

  try {
    const record = await context.pb.collection('app_settings').getFirstListItem('id != ""');
    return NextResponse.json({ settings: normalizeSettings(record as Record<string, unknown>) });
  } catch {
    return NextResponse.json({ settings: defaultSettings });
  }
}

async function handleUpdate(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.edit') && !hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'شما دسترسی لازم برای تغییر تنظیمات برنامه را ندارید.' }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی نامعتبر است.' }, { status: 400 });
  }

  // Validations
  if (body.organizationName !== undefined) {
    const name = String(body.organizationName).trim();
    if (!name) {
      return NextResponse.json({ message: 'نام مجموعه نمی‌تواند خالی باشد.' }, { status: 400 });
    }
  }

  if (body.baseCurrency !== undefined) {
    const currency = String(body.baseCurrency).toUpperCase();
    if (currency !== 'IRR' && currency !== 'IRT') {
      return NextResponse.json({ message: 'ارز پایه باید ریال (IRR) یا تومان (IRT) باشد.' }, { status: 400 });
    }
  }

  if (body.weightDecimalPlaces !== undefined) {
    const precision = Number(body.weightDecimalPlaces);
    if (![1, 2, 3].includes(precision)) {
      return NextResponse.json({ message: 'دقت اعشار وزن باید ۱، ۲ یا ۳ رقم باشد.' }, { status: 400 });
    }
  }

  if (body.goldBaseKarat !== undefined) {
    const karat = Number(body.goldBaseKarat);
    if (!Number.isFinite(karat) || karat <= 0 || karat > 1000) {
      return NextResponse.json({ message: 'عیار مبنای طلا باید عددی بین ۱ تا ۱۰۰۰ باشد.' }, { status: 400 });
    }
  }

  if (body.platinumBaseKarat !== undefined) {
    const karat = Number(body.platinumBaseKarat);
    if (!Number.isFinite(karat) || karat <= 0 || karat > 1000) {
      return NextResponse.json({ message: 'عیار مبنای پلاتین باید عددی بین ۱ تا ۱۰۰۰ باشد.' }, { status: 400 });
    }
  }

  if (body.silverBaseKarat !== undefined) {
    const karat = Number(body.silverBaseKarat);
    if (!Number.isFinite(karat) || karat <= 0 || karat > 1000) {
      return NextResponse.json({ message: 'عیار مبنای نقره باید عددی بین ۱ تا ۱۰۰۰ باشد.' }, { status: 400 });
    }
  }

  if (body.documentNumberPrefix !== undefined || body.docCodePrefix !== undefined) {
    const rawPrefix = String(body.documentNumberPrefix ?? body.docCodePrefix).trim();
    if (/[\r\n\t\0]/.test(rawPrefix) || rawPrefix.length > 20) {
      return NextResponse.json({ message: 'متن شروع شماره فاکتور/سند معتبر نیست یا بیش از حد طولانی است.' }, { status: 400 });
    }
  }

  try {
    const collection = context.pb.collection('app_settings');
    const existing = await collection.getFirstListItem('id != ""').catch(() => null);

    const prevNormalized = existing ? normalizeSettings(existing as Record<string, unknown>) : defaultSettings;
    const nextNormalized = normalizeSettings({
      ...(existing ? (existing as Record<string, unknown>) : defaultSettings),
      ...body,
    });

    const payload = {
      organizationName: nextNormalized.organizationName,
      fiscalYearStartDate: nextNormalized.fiscalYearStartDate,
      fiscalYearStartDateJalali: nextNormalized.fiscalYearStartDateJalali,
      baseCurrency: nextNormalized.baseCurrency,
      weightDecimalPlaces: nextNormalized.weightDecimalPlaces,
      goldBaseKarat: nextNormalized.goldBaseKarat,
      platinumBaseKarat: nextNormalized.platinumBaseKarat,
      silverBaseKarat: nextNormalized.silverBaseKarat,
      documentNumberPrefix: nextNormalized.documentNumberPrefix,
      docCodePrefix: nextNormalized.documentNumberPrefix,

      bodyFontFamily: nextNormalized.bodyFontFamily,
      bodyFontSize: nextNormalized.bodyFontSize,
      bodyFontWeight: nextNormalized.bodyFontWeight,

      headingFontFamily: nextNormalized.headingFontFamily,
      headingFontSize: nextNormalized.headingFontSize,
      headingFontWeight: nextNormalized.headingFontWeight,

      // Legacy fallback fields
      company_name: nextNormalized.organizationName,
      fiscal_year_start: nextNormalized.fiscalYearStartDate ?? '',
      base_currency: nextNormalized.baseCurrency,
      weight_precision: nextNormalized.weightDecimalPlaces,

      updatedBy: context.user.id,
    };

    const record = existing
      ? await collection.update(existing.id, payload)
      : await collection.create(payload);

    const updatedSettings = normalizeSettings(record as Record<string, unknown>);

    // Audit Event Logging
    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: 'تغییر تنظیمات کلی سامانه',
      entityType: 'app_settings',
      entityId: record.id,
      entityLabel: nextNormalized.organizationName,
      changes: {
        before: prevNormalized,
        after: updatedSettings,
      },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ settings: updatedSettings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در ثبت تنظیمات در دیتابیس.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return handleUpdate(request);
}

export async function PATCH(request: Request) {
  return handleUpdate(request);
}
