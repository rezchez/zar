import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { getServerAuthContext } from '@/lib/auth';
import { currencyDisplay } from '@/lib/customer';
import { getCustomersWithBalances } from '@/lib/customer-service';
import { createCustomersPdf } from '@/lib/pdf-reports';

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
    const { format, options, customerIds } = body as {
      format?: string;
      options?: {
        title?: string;
        showBalances?: boolean;
        showContact?: boolean;
        showGroupAndCity?: boolean;
      };
      customerIds?: string[];
    };

    if (format !== 'pdf') {
      return NextResponse.json({ message: 'فرمت خروجی معتبر نیست.' }, { status: 400 });
    }

    let customers = (await getCustomersWithBalances(context.pb))
      .sort((left, right) => left.customerCode - right.customerCode);

    if (customerIds && customerIds.length > 0) {
      customers = customers.filter(c => customerIds.includes(c.id));
    }

    const reportBuffer = await createCustomersPdf(customers, options);
    return new NextResponse(new Uint8Array(reportBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="customers.pdf"',
        'Content-Length': String(reportBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('ساخت گزارش PDF انجام نشد.', {
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
        'رسته': customer.category,
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
        { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
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

    const reportBuffer = await createCustomersPdf(customers);
    return new NextResponse(new Uint8Array(reportBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="customers.pdf"',
        'Content-Length': String(reportBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('ساخت گزارش PDF انجام نشد.', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
