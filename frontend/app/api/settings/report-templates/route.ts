import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { recordAuditEvent } from '@/lib/audit';
import { getServerAppSettings } from '@/lib/server-settings';
import { DEFAULT_REPORT_TEMPLATES, type ReportPrintTemplate } from '@/lib/report-templates';

export const runtime = 'nodejs';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 401 });
  }

  try {
    const settings = await getServerAppSettings();
    const templates = settings.reportTemplates && settings.reportTemplates.length > 0
      ? settings.reportTemplates
      : DEFAULT_REPORT_TEMPLATES;

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: DEFAULT_REPORT_TEMPLATES });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز جهت ایجاد قالب گزارش.' }, { status: 403 });
  }

  let body: Partial<ReportPrintTemplate> = {};
  try {
    body = (await request.json()) as Partial<ReportPrintTemplate>;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی نامعتبر است.' }, { status: 400 });
  }

  const name = String(body.name || '').trim();
  if (!name) {
    return NextResponse.json({ message: 'نام قالب نباید خالی باشد.' }, { status: 400 });
  }

  try {
    const settings = await getServerAppSettings();
    let currentTemplates = Array.isArray(settings.reportTemplates) && settings.reportTemplates.length > 0
      ? [...settings.reportTemplates]
      : [...DEFAULT_REPORT_TEMPLATES];

    const reportType = body.reportType || 'customer';
    const isDefault = Boolean(body.isDefault);

    if (isDefault) {
      currentTemplates = currentTemplates.map((t) =>
        t.reportType === reportType ? { ...t, isDefault: false } : t,
      );
    }

    const newTemplate: ReportPrintTemplate = {
      id: `rep_tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      reportType,
      isActive: body.isActive !== false,
      isDefault,
      isSystemDefault: false,
      page: body.page || DEFAULT_REPORT_TEMPLATES[0].page,
      header: body.header || DEFAULT_REPORT_TEMPLATES[0].header,
      table: body.table || DEFAULT_REPORT_TEMPLATES[0].table,
      footer: body.footer || DEFAULT_REPORT_TEMPLATES[0].footer,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    currentTemplates.push(newTemplate);

    const records = await context.pb.collection('app_settings').getFullList({ sort: '-created' });
    if (records.length > 0) {
      await context.pb.collection('app_settings').update(records[0].id, {
        reportTemplates: JSON.stringify(currentTemplates),
      });
    } else {
      await context.pb.collection('app_settings').create({
        reportTemplates: JSON.stringify(currentTemplates),
      });
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `ایجاد قالب گزارش: ${newTemplate.name}`,
      entityType: 'report_template',
      entityId: newTemplate.id,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      template: newTemplate,
      templates: currentTemplates,
    });
  } catch (error) {
    console.error('Error creating report template:', error);
    return NextResponse.json({ message: 'خطا در ذخیره قالب گزارش.' }, { status: 500 });
  }
}
