import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { recordAuditEvent } from '@/lib/audit';
import { getServerAppSettings } from '@/lib/server-settings';
import { DEFAULT_REPORT_TEMPLATES, type ReportPrintTemplate } from '@/lib/report-templates';

export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز جهت ویرایش قالب گزارش.' }, { status: 403 });
  }

  const { id } = await params;
  let body: Partial<ReportPrintTemplate> = {};
  try {
    body = (await request.json()) as Partial<ReportPrintTemplate>;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی نامعتبر است.' }, { status: 400 });
  }

  try {
    const settings = await getServerAppSettings();
    let currentTemplates = Array.isArray(settings.reportTemplates) && settings.reportTemplates.length > 0
      ? [...settings.reportTemplates]
      : [...DEFAULT_REPORT_TEMPLATES];

    const targetIndex = currentTemplates.findIndex((t) => t.id === id);
    if (targetIndex === -1) {
      return NextResponse.json({ message: 'قالب مورد نظر یافت نشد.' }, { status: 404 });
    }

    const existing = currentTemplates[targetIndex];
    const reportType = body.reportType || existing.reportType;
    const isDefault = typeof body.isDefault === 'boolean' ? body.isDefault : existing.isDefault;

    if (isDefault) {
      currentTemplates = currentTemplates.map((t) =>
        t.reportType === reportType && t.id !== id ? { ...t, isDefault: false } : t,
      );
    }

    const updatedTemplate: ReportPrintTemplate = {
      ...existing,
      ...body,
      id,
      reportType,
      isDefault,
      updated: new Date().toISOString(),
    };

    currentTemplates[targetIndex] = updatedTemplate;

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
      details: `ویرایش قالب گزارش: ${updatedTemplate.name}`,
      entityType: 'report_template',
      entityId: id,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      template: updatedTemplate,
      templates: currentTemplates,
    });
  } catch (error) {
    console.error('Error updating report template:', error);
    return NextResponse.json({ message: 'خطا در ویرایش قالب گزارش.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز جهت حذف قالب گزارش.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const settings = await getServerAppSettings();
    let currentTemplates = Array.isArray(settings.reportTemplates) && settings.reportTemplates.length > 0
      ? [...settings.reportTemplates]
      : [...DEFAULT_REPORT_TEMPLATES];

    const target = currentTemplates.find((t) => t.id === id);
    if (!target) {
      return NextResponse.json({ message: 'قالب مورد نظر یافت نشد.' }, { status: 404 });
    }

    if (target.isSystemDefault) {
      return NextResponse.json({ message: 'قالب‌های پیش‌فرض سیستمی قابل حذف نیستند.' }, { status: 400 });
    }

    currentTemplates = currentTemplates.filter((t) => t.id !== id);

    const records = await context.pb.collection('app_settings').getFullList({ sort: '-created' });
    if (records.length > 0) {
      await context.pb.collection('app_settings').update(records[0].id, {
        reportTemplates: JSON.stringify(currentTemplates),
      });
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حذف قالب گزارش با شناسه: ${id}`,
      entityType: 'report_template',
      entityId: id,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      templates: currentTemplates,
      message: 'قالب گزارش با موفقیت حذف شد.',
    });
  } catch (error) {
    console.error('Error deleting report template:', error);
    return NextResponse.json({ message: 'خطا در حذف قالب گزارش.' }, { status: 500 });
  }
}
