import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { getServerAuthContext } from '@/lib/auth';
import { currencyDisplay } from '@/lib/customer';
import { getCustomersWithBalances } from '@/lib/customer-service';
import { createCustomersPdf, type CustomerPdfOptions } from '@/lib/pdf-reports';
import { getServerAppSettings } from '@/lib/server-settings';

import { DEFAULT_REPORT_TEMPLATES } from '@/lib/report-templates';

export const runtime = 'nodejs';

function dateLabel(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(value));
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { format, options, customerIds, templateId } = body as {
      format?: string;
      options?: CustomerPdfOptions;
      customerIds?: string[];
      templateId?: string;
    };

    if (format !== 'pdf') {
      return NextResponse.json({ message: 'فرمت خروجی معتبر نیست.' }, { status: 400 });
    }

    let customers = (await getCustomersWithBalances(context.pb))
      .sort((left, right) => left.customerCode - right.customerCode);

    if (customerIds && customerIds.length > 0) {
      customers = customers.filter((c) => customerIds.includes(c.id));
    }

    const settings = await getServerAppSettings();
    const reportTemplates = Array.isArray(settings.reportTemplates) && settings.reportTemplates.length > 0
      ? settings.reportTemplates
      : DEFAULT_REPORT_TEMPLATES;

    const chosenTemplate = (templateId ? reportTemplates.find((t) => t.id === templateId) : null)
      || reportTemplates.find((t) => t.reportType === 'customer' && t.isDefault)
      || reportTemplates.find((t) => t.reportType === 'customer')
      || DEFAULT_REPORT_TEMPLATES[0];

    const templateCols = chosenTemplate?.table?.columns?.filter((c) => c.visible !== false).map((c) => c.id);

    const resolvedOptions: CustomerPdfOptions = {
      title: options?.title || chosenTemplate?.header?.customTitle || chosenTemplate?.name || 'گزارش طرف‌حساب‌ها',
      subtitle: chosenTemplate?.header?.customSubtitle,
      orientation: chosenTemplate?.page?.orientation || 'landscape',
      showBalances: options?.showBalances !== false,
      showContact: options?.showContact !== false,
      showGroupAndCity: options?.showGroupAndCity !== false,
      showLogo: chosenTemplate?.header?.showLogo !== false,
      storeName: options?.storeName || settings.printStoreName || settings.organizationName || 'زر فولیـو',
      columns: options?.columns && options.columns.length > 0
        ? options.columns
        : (templateCols && templateCols.length > 0 ? templateCols : settings.printCustomerColumns),
      footerNotes: chosenTemplate?.footer?.customFooterText || settings.printFooterText,
      showStamp: chosenTemplate?.footer?.showStamp,
      showSignature: chosenTemplate?.footer?.showSignature,
      showTotalCount: chosenTemplate?.footer?.showTotalCount !== false,
    };

    const reportBuffer = await createCustomersPdf(customers, resolvedOptions);
    return new NextResponse(new Uint8Array(reportBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="customers.pdf"',
        'Content-Length': String(reportBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Customer PDF Export Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'ساخت گزارش PDF انجام نشد.';
    return new NextResponse(errorMsg, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const format = new URL(request.url).searchParams.get('format');
  if (format !== 'xlsx' && format !== 'pdf') {
    return NextResponse.json({ message: 'فرمت خروجی معتبر نیست.' }, { status: 400 });
  }

  try {
    const customers = (await getCustomersWithBalances(context.pb))
      .sort((left, right) => left.customerCode - right.customerCode);

    if (format === 'xlsx') {
      const rows = customers.map((customer) => ({
        'کد حساب': customer.customerCode,
        'نام': customer.name,
        'گروه': customer.groupName,
        'استان': customer.province,
        'شهر': customer.city,
        'جنسیت': customer.gender === 'male' ? 'آقا' : customer.gender === 'female' ? 'خانم' : '',
        'تلفن': customer.phone1,
        'طلا (گرم)': customer.goldBalance,
        'نقره (گرم)': customer.silverBalance,
        'پلاتین (گرم)': customer.platinumBalance,
        'مانده ریالی': customer.rialBalance,
        [`مانده ارز دوم (${currencyDisplay(customer.secondaryCurrency, customer.secondaryCurrencySymbol)})`]: customer.foreignBalance,
        [`مانده ارز سوم (${currencyDisplay(customer.tertiaryCurrency, customer.tertiaryCurrencySymbol)})`]: customer.tertiaryBalance,
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 },
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
        { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'طرف حساب‌ها');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="customers.xlsx"',
          'Cache-Control': 'no-store',
        },
      });
    }

    const settings = await getServerAppSettings();
    const reportBuffer = await createCustomersPdf(customers, {
      storeName: settings.printStoreName || settings.organizationName || 'زر فولیـو',
      columns: settings.printCustomerColumns,
    });
    return new NextResponse(new Uint8Array(reportBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="customers.pdf"',
        'Content-Length': String(reportBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Customer Export GET Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'ساخت گزارش PDF انجام نشد.';
    return new NextResponse(errorMsg, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
