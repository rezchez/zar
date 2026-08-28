import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import type { InvoicePrintTemplate } from '@/lib/print-templates';
import { recordAuditEvent } from '@/lib/audit';

function isAllowed(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const record = await context.pb.collection('print_templates').getOne(id);
    const template: InvoicePrintTemplate = {
      id: record.id,
      name: record.name,
      templateType: record.templateType === 'customer' ? 'customer' : 'invoice',
      isActive: Boolean(record.isActive),
      isSystemDefault: Boolean(record.isSystemDefault),
      page: record.page,
      design: record.design,
      elements: record.elements,
      table: record.table,
      footer: record.footer,
      created: record.created,
      updated: record.updated,
    };
    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ message: 'قالب چاپ مورد نظر یافت نشد.' }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!isAllowed(context)) {
    return NextResponse.json({ message: 'شما دسترسی لازم برای ویرایش قالب‌های چاپ را ندارید.' }, { status: 403 });
  }

  const { id } = await params;

  let body: Partial<InvoicePrintTemplate> = {};
  try {
    body = (await request.json()) as Partial<InvoicePrintTemplate>;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی نامعتبر است.' }, { status: 400 });
  }

  try {
    const collection = context.pb.collection('print_templates');
    const existing = await collection.getOne(id).catch(() => null);

    if (!existing) {
      return NextResponse.json({ message: 'قالب چاپ جهت ویرایش یافت نشد.' }, { status: 404 });
    }

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ message: 'نام قالب نباید خالی باشد.' }, { status: 400 });
      }

      // Check duplicate name excluding current record
      const existingSameName = await collection.getFullList({
        filter: `name = "${name.replace(/"/g, '\\"')}" && id != "${id}"`,
      });

      if (existingSameName.length > 0) {
        return NextResponse.json({ message: 'قالبی با این نام از قبل وجود دارد. لطفاً نام دیگری انتخاب کنید.' }, { status: 400 });
      }
    }

    const templateType = body.templateType !== undefined
      ? (body.templateType === 'customer' ? 'customer' : 'invoice')
      : (existing.templateType === 'customer' ? 'customer' : 'invoice');

    // Handle isActive toggle per templateType
    if (body.isActive && !existing.isActive) {
      const activeRecords = await collection.getFullList({
        filter: `isActive = true && templateType = "${templateType}" && id != "${id}"`,
      });
      for (const rec of activeRecords) {
        await collection.update(rec.id, { isActive: false });
      }
    }

    const payload = {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      templateType,
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.page !== undefined ? { page: body.page } : {}),
      ...(body.design !== undefined ? { design: body.design } : {}),
      ...(body.elements !== undefined ? { elements: body.elements } : {}),
      ...(body.table !== undefined ? { table: body.table } : {}),
      ...(body.footer !== undefined ? { footer: body.footer } : {}),
    };

    const updatedRecord = await collection.update(id, payload);

    const updatedTemplate: InvoicePrintTemplate = {
      id: updatedRecord.id,
      name: updatedRecord.name,
      templateType: updatedRecord.templateType === 'customer' ? 'customer' : 'invoice',
      isActive: Boolean(updatedRecord.isActive),
      isSystemDefault: Boolean(updatedRecord.isSystemDefault),
      page: updatedRecord.page,
      design: updatedRecord.design,
      elements: updatedRecord.elements,
      table: updatedRecord.table,
      footer: updatedRecord.footer,
      created: updatedRecord.created,
      updated: updatedRecord.updated,
    };

    await recordAuditEvent({
      userId: context.user.id,
      event: 'print_template_updated',
      request,
      details: `ویرایش قالب چاپ: ${updatedTemplate.name}`,
      entityType: 'print_templates',
      entityId: id,
      entityLabel: updatedTemplate.name,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ template: updatedTemplate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در ویرایش قالب چاپ.';
    return NextResponse.json({ message }, { status: 500 });
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

  if (!isAllowed(context)) {
    return NextResponse.json({ message: 'شما دسترسی لازم برای حذف قالب‌های چاپ را ندارید.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const collection = context.pb.collection('print_templates');
    const existing = await collection.getOne(id).catch(() => null);

    if (!existing) {
      return NextResponse.json({ message: 'قالب چاپ مورد نظر پیدا نشد.' }, { status: 404 });
    }

    if (existing.isSystemDefault) {
      return NextResponse.json({ message: 'قالب پیش‌فرض سیستمی قابل حذف نیست.' }, { status: 400 });
    }

    if (existing.isActive) {
      // Check if there's another template to fallback to
      const otherTemplates = await collection.getFullList({ filter: `id != "${id}"` });
      if (otherTemplates.length === 0) {
        return NextResponse.json({ message: 'حداقل باید یک قالب در سیستم باقی بماند.' }, { status: 400 });
      }
      // Make the first remaining template active
      await collection.update(otherTemplates[0].id, { isActive: true });
    }

    await collection.delete(id);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'print_template_deleted',
      request,
      details: `حذف قالب چاپ: ${existing.name}`,
      entityType: 'print_templates',
      entityId: id,
      entityLabel: existing.name,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ success: true, message: 'قالب چاپ با موفقیت حذف شد.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در حذف قالب چاپ.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
