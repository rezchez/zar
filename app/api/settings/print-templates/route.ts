import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { DEFAULT_SYSTEM_TEMPLATES, type InvoicePrintTemplate } from '@/lib/print-templates';
import { recordAuditEvent } from '@/lib/audit';

function isAllowed(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 401 });
  }

  try {
    const records = await context.pb.collection('print_templates').getFullList({
      sort: '-isActive,-created',
    });

    if (!records || records.length === 0) {
      return NextResponse.json({ templates: DEFAULT_SYSTEM_TEMPLATES });
    }

    const templates: InvoicePrintTemplate[] = records.map((rec) => ({
      id: rec.id,
      name: rec.name,
      isActive: Boolean(rec.isActive),
      isSystemDefault: Boolean(rec.isSystemDefault),
      page: rec.page,
      design: rec.design || { zoom: 1, gridEnabled: true, gridSizeMm: 5 },
      elements: rec.elements || [],
      created: rec.created,
      updated: rec.updated,
    }));

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: DEFAULT_SYSTEM_TEMPLATES });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!isAllowed(context)) {
    return NextResponse.json({ message: 'دستورالعمل‌های مدیریتی برای ساخت قالب نیازمند سطح دسترسی مدیر است.' }, { status: 403 });
  }

  let body: Partial<InvoicePrintTemplate> = {};
  try {
    body = (await request.json()) as Partial<InvoicePrintTemplate>;
  } catch {
    return NextResponse.json({ message: 'داده‌های ارسالی برای قالب نامعتبر است.' }, { status: 400 });
  }

  const name = String(body.name || '').trim();
  if (!name) {
    return NextResponse.json({ message: 'نام قالب نباید خالی باشد.' }, { status: 400 });
  }

  try {
    const collection = context.pb.collection('print_templates');

    // Check duplicate name
    const existingSameName = await collection.getFullList({
      filter: `name = "${name.replace(/"/g, '\\"')}"`,
    });

    if (existingSameName.length > 0) {
      return NextResponse.json({ message: 'قالبی با این نام از قبل وجود دارد. لطفاً نام دیگری انتخاب کنید.' }, { status: 400 });
    }

    // Handle isActive single selection
    if (body.isActive) {
      const activeRecords = await collection.getFullList({ filter: 'isActive = true' });
      for (const rec of activeRecords) {
        await collection.update(rec.id, { isActive: false });
      }
    }

    const payload = {
      name,
      isActive: Boolean(body.isActive),
      isSystemDefault: false,
      page: body.page || DEFAULT_SYSTEM_TEMPLATES[0].page,
      design: body.design || DEFAULT_SYSTEM_TEMPLATES[0].design,
      elements: body.elements || DEFAULT_SYSTEM_TEMPLATES[0].elements,
    };

    const record = await collection.create(payload);

    const createdTemplate: InvoicePrintTemplate = {
      id: record.id,
      name: record.name,
      isActive: Boolean(record.isActive),
      isSystemDefault: Boolean(record.isSystemDefault),
      page: record.page,
      design: record.design,
      elements: record.elements,
      created: record.created,
      updated: record.updated,
    };

    await recordAuditEvent({
      userId: context.user.id,
      event: 'print_template_created',
      request,
      details: `ایجاد قالب چاپ جدید: ${createdTemplate.name}`,
      entityType: 'print_templates',
      entityId: record.id,
      entityLabel: createdTemplate.name,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ template: createdTemplate });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در ثبت قالب چاپ جدید در پایگاه داده.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
