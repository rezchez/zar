import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

import { getServerAuthContext } from '@/lib/auth';
import { currencyDisplay, mapCustomer } from '@/lib/customer';
import { getCustomersWithBalances } from '@/lib/customer-service';

export const runtime = 'nodejs';

function dateLabel(value: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(new Date(value));
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
        'تاریخ افتتاح': dateLabel(customer.accountOpenedAt),
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

    const pdfBuffer = await createCustomersPdf(customers);
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="customers.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ message: 'ساخت خروجی انجام نشد.' }, { status: 500 });
  }
}

function createCustomersPdf(customers: Array<ReturnType<typeof mapCustomer>>) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.fontSize(18).text('Zarfolio - Customers', { align: 'center' });
    document.moveDown();
    document.fontSize(9);

    if (!customers.length) {
      document.text('No customer records.');
    } else {
      customers.forEach((customer, index) => {
        document
          .fontSize(10)
          .text(`${index + 1}. ${customer.customerCode} - ${customer.name}`);
        document
          .fontSize(8)
          .text(
            `Group: ${customer.groupName || '-'} | City: ${customer.city || '-'} | `
              + `Gold: ${customer.goldBalance} g | Silver: ${customer.silverBalance} g | `
              + `Platinum: ${customer.platinumBalance} g | Rial: ${customer.rialBalance} | `
              + `Currency 2 (${currencyDisplay(customer.secondaryCurrency, customer.secondaryCurrencySymbol)}): ${customer.foreignBalance} | `
              + `Currency 3 (${currencyDisplay(customer.tertiaryCurrency, customer.tertiaryCurrencySymbol)}): ${customer.tertiaryBalance}`,
          );
        document.moveDown(0.5);
      });
    }

    document.end();
  });
}
