import 'server-only';

import { currencyDisplay, type Customer } from '@/lib/customer';
import type { CustomerTransaction } from '@/lib/transaction';
import { createPdfDocument, pdfBuffer } from '@/lib/pdf';

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

function transactionAmounts(transaction: CustomerTransaction) {
  return [
    transaction.goldAmount ? `${formatNumber(transaction.goldAmount)} گرم طلا` : '',
    transaction.silverAmount ? `${formatNumber(transaction.silverAmount)} گرم نقره` : '',
    transaction.platinumAmount ? `${formatNumber(transaction.platinumAmount)} گرم پلاتین` : '',
    transaction.rialAmount ? `${formatNumber(transaction.rialAmount)} ریال` : '',
    transaction.foreignAmount
      ? `${formatNumber(transaction.foreignAmount)} ${currencyDisplay(transaction.foreignCurrency, transaction.foreignCurrencySymbol)}`
      : '',
    transaction.tertiaryAmount
      ? `${formatNumber(transaction.tertiaryAmount)} ${currencyDisplay(transaction.tertiaryCurrency, transaction.tertiaryCurrencySymbol)}`
      : '',
  ].filter(Boolean).join(' | ') || 'بدون مبلغ';
}

export function createLedgerPdf(
  customer: Pick<Customer, 'customerCode' | 'name' | 'phone1'>,
  transactions: CustomerTransaction[],
) {
  const pdf = createPdfDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  const width = pdf.page.width - 56;
  const columns = [
    ['تاریخ', 82],
    ['نوع', 110],
    ['شماره سند', 82],
    ['شرح', 230],
    ['مبالغ', width - 504],
  ] as const;
  let y = 28;

  pdf.font('DoranNoEn').fontSize(16).fillColor('#17202a')
    .text('گزارش ریزحساب طرف‌حساب', 28, y, { width, align: 'right' });
  y += 28;
  pdf.font('Vazirmatn').fontSize(10).text(
    `کد حساب: ${customer.customerCode}    نام: ${customer.name}    تلفن: ${customer.phone1 || '—'}`,
    28,
    y,
    { width, align: 'right' },
  );
  y += 28;

  const drawHeader = () => {
    let x = 28;
    pdf.rect(28, y, width, 26).fill('#e8eef3');
    pdf.fillColor('#17202a').font('DoranNoEn').fontSize(9);
    for (const [title, columnWidth] of columns) {
      pdf.text(title, x + 4, y + 8, { width: columnWidth - 8, align: 'right' });
      x += columnWidth;
    }
    y += 26;
  };

  drawHeader();
  transactions.forEach((transaction, index) => {
    if (y > pdf.page.height - 55) {
      pdf.addPage();
      y = 28;
      drawHeader();
    }

    const rowHeight = 34;
    if (index % 2 === 0) pdf.rect(28, y, width, rowHeight).fill('#f7f9fb');
    pdf.fillColor('#263238').font('Vazirmatn').fontSize(8);
    const values = [
      formatDate(transaction.transactionDate),
      transactionLabels[transaction.transactionType] ?? 'تراکنش',
      transaction.documentNumber || '—',
      transaction.description || '—',
      transactionAmounts(transaction),
    ];
    let x = 28;
    values.forEach((value, valueIndex) => {
      const columnWidth = columns[valueIndex][1];
      pdf.text(value, x + 4, y + 9, {
        width: columnWidth - 8,
        height: rowHeight - 10,
        ellipsis: true,
        align: 'right',
      });
      x += columnWidth;
    });
    pdf.strokeColor('#d6dde3').lineWidth(0.4)
      .moveTo(28, y + rowHeight)
      .lineTo(28 + width, y + rowHeight)
      .stroke();
    y += rowHeight;
  });

  pdf.font('Vazirmatn').fontSize(8).fillColor('#66727d').text(
    `تعداد ردیف‌ها: ${formatNumber(transactions.length)}    تاریخ تولید: ${formatDate(new Date().toISOString())}`,
    28,
    pdf.page.height - 28,
    { width, align: 'right' },
  );

  return pdfBuffer(pdf);
}

export interface CustomerPdfOptions {
  title?: string;
  showBalances?: boolean;
  showContact?: boolean;
  showGroupAndCity?: boolean;
  columns?: string[];
}

export function createCustomersPdf(customers: Customer[], options: CustomerPdfOptions = {}) {
  const {
    title = 'گزارش طرف‌حساب‌ها',
    columns = ['customerCode', 'name', 'groupName', 'city', 'goldBalance', 'rialBalance'],
  } = options;

  const pdf = createPdfDocument({ size: 'A4', margin: 36, layout: 'landscape' });
  let y = 36;
  const width = pdf.page.width - 72;

  pdf.font('DoranNoEn').fontSize(16).fillColor('#17202a')
    .text(title, 36, y, { width, align: 'center' });
  y += 28;

  if (!customers.length) {
    pdf.font('Vazirmatn').fontSize(10).text('رکوردی برای نمایش وجود ندارد.', 36, y, { width, align: 'center' });
    return pdfBuffer(pdf);
  }

  // Determine headers
  const headerMap: Record<string, string> = {
    customerCode: 'کد',
    name: 'نام',
    gender: 'جنسیت',
    groupName: 'گروه',
    city: 'شهر',
    goldBalance: 'طلا',
    silverBalance: 'نقره',
    platinumBalance: 'پلاتین',
    rialBalance: 'ریال',
    foreignBalance: 'ارز دوم',
    tertiaryBalance: 'ارز سوم'
  };

  const activeCols = columns.filter((c: string) => headerMap[c]);
  if (activeCols.length === 0) activeCols.push('customerCode', 'name');

  const colWidth = width / activeCols.length;

  // Header Row
  pdf.rect(36, y - 6, width, 24).fill('#f1f5f9');
  pdf.fillColor('#475569');
  pdf.font('DoranNoEn').fontSize(10);

  let currentX = pdf.page.width - 36; // Start from right (RTL)

  for (const col of activeCols) {
    pdf.text(headerMap[col], currentX - colWidth, y, { width: colWidth, align: 'center' });
    currentX -= colWidth;
  }
  y += 24;

  pdf.font('Vazirmatn').fontSize(9).fillColor('#1e293b');

  for (const customer of customers) {
    if (y > pdf.page.height - 56) {
      pdf.addPage();
      y = 36;

      pdf.rect(36, y - 6, width, 24).fill('#f1f5f9');
      pdf.fillColor('#475569');
      pdf.font('DoranNoEn').fontSize(10);
      currentX = pdf.page.width - 36;
      for (const col of activeCols) {
        pdf.text(headerMap[col], currentX - colWidth, y, { width: colWidth, align: 'center' });
        currentX -= colWidth;
      }
      y += 24;
      pdf.font('Vazirmatn').fontSize(9).fillColor('#1e293b');
    }

    currentX = pdf.page.width - 36;
    for (const col of activeCols) {
      let val = '';
      if (col === 'customerCode') val = String(customer.customerCode);
      else if (col === 'name') val = customer.name;
      else if (col === 'gender') val = customer.gender === 'male' ? 'آقا' : customer.gender === 'female' ? 'خانم' : '-';
      else if (col === 'groupName') val = customer.groupName || '-';
      else if (col === 'city') val = customer.city || '-';
      else if (col === 'goldBalance') val = String(customer.goldBalance);
      else if (col === 'silverBalance') val = String(customer.silverBalance);
      else if (col === 'platinumBalance') val = String(customer.platinumBalance);
      else if (col === 'rialBalance') val = new Intl.NumberFormat('fa-IR').format(customer.rialBalance);
      else if (col === 'foreignBalance') val = String(customer.foreignBalance);
      else if (col === 'tertiaryBalance') val = String(customer.tertiaryBalance);

      pdf.text(val, currentX - colWidth, y, { width: colWidth, align: 'center' });
      currentX -= colWidth;
    }
    y += 20;

    // Draw row separator
    pdf.lineWidth(0.5).strokeColor('#e2e8f0').moveTo(36, y - 4).lineTo(pdf.page.width - 36, y - 4).stroke();
  }

  return pdfBuffer(pdf);
}
