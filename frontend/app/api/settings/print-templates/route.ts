import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import {
  DEFAULT_SYSTEM_TEMPLATES,
  CUSTOMER_DEFAULT_TABLE_COLUMNS,
  DEFAULT_TABLE_COLUMNS,
  type InvoicePrintTemplate,
  type InvoiceTableConfiguration,
} from '@/lib/print-templates';
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

    const templates: InvoicePrintTemplate[] = records.map((rec) => {
      const rawTable = rec.table || (rec.design as any)?.table;
      const defaultCols = rec.templateType === 'customer' ? CUSTOMER_DEFAULT_TABLE_COLUMNS : DEFAULT_TABLE_COLUMNS;
      const resolvedTable: InvoiceTableConfiguration | undefined = rawTable
        ? {
            ...rawTable,
            columns: rawTable.columns && rawTable.columns.length > 0 ? rawTable.columns : defaultCols,
          }
        : undefined;

      return {
        id: rec.id,
        name: rec.name,
        templateType: rec.templateType === 'customer' ? 'customer' : 'invoice',
        isActive: Boolean(rec.isActive),
        isSystemDefault: Boolean(rec.isSystemDefault),
        page: rec.page,
        design: rec.design || { zoom: 1, gridEnabled: true, gridSizeMm: 5 },
        elements: rec.elements || [],
        table: resolvedTable,
        footer: rec.footer || (rec.design as any)?.footer || undefined,
        created: rec.created,
        updated: rec.updated,
      };
    });

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

    // Handle isActive single selection per templateType
    const templateType = body.templateType === 'customer' ? 'customer' : 'invoice';
    if (body.isActive) {
      const activeRecords = await collection.getFullList({
        filter: `isActive = true && templateType = "${templateType}"`,
      });
      for (const rec of activeRecords) {
        await collection.update(rec.id, { isActive: false });
      }
    }

    const defaultCols = templateType === 'customer' ? CUSTOMER_DEFAULT_TABLE_COLUMNS : DEFAULT_TABLE_COLUMNS;
    const finalTable = body.table
      ? {
          ...body.table,
          columns: body.table.columns && body.table.columns.length > 0 ? body.table.columns : defaultCols,
        }
      : undefined;

    const designPayload = {
      ...(body.design || DEFAULT_SYSTEM_TEMPLATES[0].design),
      table: finalTable,
      footer: body.footer,
    };

    let record;
    try {
      record = await collection.create({
        name,
        templateType,
        isActive: Boolean(body.isActive),
        isSystemDefault: false,
        page: body.page || DEFAULT_SYSTEM_TEMPLATES[0].page,
        design: designPayload,
        elements: body.elements || DEFAULT_SYSTEM_TEMPLATES[0].elements,
        table: finalTable,
        footer: body.footer,
      });
    } catch {
      record = await collection.create({
        name,
        templateType,
        isActive: Boolean(body.isActive),
        isSystemDefault: false,
        page: body.page || DEFAULT_SYSTEM_TEMPLATES[0].page,
        design: designPayload,
        elements: body.elements || DEFAULT_SYSTEM_TEMPLATES[0].elements,
      });
    }

    const createdTemplate: InvoicePrintTemplate = {
      id: record.id,
      name: record.name,
      templateType: record.templateType === 'customer' ? 'customer' : 'invoice',
      isActive: Boolean(record.isActive),
      isSystemDefault: Boolean(record.isSystemDefault),
      page: record.page,
      design: record.design,
      elements: record.elements,
      table: record.table || (record.design as any)?.table || body.table,
      footer: record.footer || (record.design as any)?.footer || body.footer,
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
