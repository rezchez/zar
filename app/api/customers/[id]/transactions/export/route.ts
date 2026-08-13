import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';

import { getServerAuthContext } from '@/lib/auth';
import { currencyDisplay } from '@/lib/customer';
import { getCustomerTransactions } from '@/lib/customer-service';

export const runtime = 'nodejs';

const transactionLabels: Record<string, string> = {
  opening_balance: 'مانده اول دوره',
  document: 'سند',
  adjustment: 'اصلاحی',
  reversal: 'برگشتی',
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short' }).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 6 }).format(value);
}

function amounts(transaction: Awaited<ReturnType<typeof getCustomerTransactions>>[number]) {
  return [
    transaction.goldAmount ? `${formatNumber(transaction.goldAmount)} گرم طلا` : '',
    transaction.silverAmount ? `${formatNumber(transaction.silverAmount)} گرم نقره` : '',
    transaction.platinumAmount ? `${formatNumber(transaction.platinumAmount)} گرم پلاتین` : '',
    transaction.rialAmount ? `${formatNumber(transaction.rialAmount)} ریال` : '',
    transaction.foreignAmount ? `${formatNumber(transaction.foreignAmount)} ${currencyDisplay(transaction.foreignCurrency, transaction.foreignCurrencySymbol)}` : '',
    transaction.tertiaryAmount ? `${formatNumber(transaction.tertiaryAmount)} ${currencyDisplay(transaction.tertiaryCurrency, transaction.tertiaryCurrencySymbol)}` : '',
  ].filter(Boolean).join(' | ') || 'بدون مبلغ';
}

function createPdf(customer: { customerCode: number; name: string; phone1: string }, transactions: Awaited<ReturnType<typeof getCustomerTransactions>>) {
  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
    const chunks: Buffer[] = [];
    const font = process.env.PERSIAN_FONT_PATH || 'C:\\Windows\\Fonts\\Vazir.ttf';
    const boldFont = process.env.PERSIAN_FONT_BOLD_PATH || 'C:\\Windows\\Fonts\\Vazir Bold.ttf';
    let fontName = 'Helvetica';
    let boldFontName = 'Helvetica-Bold';
    try {
      pdf.registerFont('Vazir', font);
      pdf.registerFont('VazirBold', boldFont);
      fontName = 'Vazir';
      boldFontName = 'VazirBold';
    } catch {
      // Use PDFKit's fallback font if the optional Persian font is unavailable.
    }
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    const width = pdf.page.width - 56;
    const columns = [
      ['تاریخ', 82],
      ['نوع', 110],
      ['شماره سند', 82],
      ['شرح', 230],
      ['مبالغ', width - 504],
    ] as const;
    let y = 28;
    pdf.font(boldFontName).fontSize(16).text('گزارش ریزحساب طرف‌حساب', 28, y, { width, align: 'right' });
    y += 28;
    pdf.font(fontName).fontSize(10).text(
      `کد حساب: ${customer.customerCode}    نام: ${customer.name}    تلفن: ${customer.phone1 || '—'}`,
      28,
      y,
      { width, align: 'right' },
    );
    y += 28;

    const header = () => {
      let x = 28;
      pdf.rect(28, y, width, 26).fill('#e8eef3');
      pdf.fillColor('#17202a').font(boldFontName).fontSize(9);
      for (const [title, columnWidth] of columns) {
        pdf.text(title, x + 4, y + 8, { width: columnWidth - 8, align: 'right' });
        x += columnWidth;
      }
      y += 26;
    };
    header();

    transactions.forEach((transaction, index) => {
      if (y > pdf.page.height - 55) {
        pdf.addPage();
        y = 28;
        header();
      }
      const rowHeight = 34;
      if (index % 2 === 0) pdf.rect(28, y, width, rowHeight).fill('#f7f9fb');
      pdf.fillColor('#263238').font(fontName).fontSize(8);
      const values = [
        formatDate(transaction.transactionDate),
        transactionLabels[transaction.transactionType] ?? 'تراکنش',
        transaction.documentNumber || '—',
        transaction.description || '—',
        amounts(transaction),
      ];
      let x = 28;
      values.forEach((value, valueIndex) => {
        const columnWidth = columns[valueIndex][1];
        pdf.text(value, x + 4, y + 9, { width: columnWidth - 8, height: rowHeight - 10, ellipsis: true, align: 'right' });
        x += columnWidth;
      });
      pdf.strokeColor('#d6dde3').lineWidth(0.4).moveTo(28, y + rowHeight).lineTo(28 + width, y + rowHeight).stroke();
      y += rowHeight;
    });
    pdf.font(fontName).fontSize(8).fillColor('#66727d').text(
      `تعداد ردیف‌ها: ${formatNumber(transactions.length)}    تاریخ تولید: ${formatDate(new Date().toISOString())}`,
      28,
      pdf.page.height - 28,
      { width, align: 'right' },
    );
    pdf.end();
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  try {
    const { id } = await params;
    const customer = await context.pb.collection('customers').getOne(id);
    const transactions = await getCustomerTransactions(context.pb, id);
    const pdf = await createPdf({
      customerCode: Number(customer.customerCode ?? 0),
      name: String(customer.name ?? ''),
      phone1: String(customer.phone1 ?? ''),
    }, transactions);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ledger-${customer.customerCode}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ message: 'ساخت گزارش PDF انجام نشد.' }, { status: 500 });
  }
}
