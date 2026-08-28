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
  storeName?: string;
}

export function createCustomersPdf(customers: Customer[], options: CustomerPdfOptions = {}) {
  const {
    title = 'گزارش طرف‌حساب‌ها',
    showBalances = true,
    showContact = true,
    showGroupAndCity = true,
    columns = ['customerCode', 'name', 'groupName', 'phone1', 'city', 'goldBalance', 'rialBalance'],
    storeName = 'زر فولیـو',
  } = options;

  const pdf = createPdfDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  const width = pdf.page.width - 56;

  let y = 28;

  // Header Title & Store Name
  pdf.font('DoranNoEn').fontSize(16).fillColor('#17202a')
    .text(title, 28, y, { width, align: 'right' });
  pdf.font('Vazirmatn').fontSize(9).fillColor('#475569')
    .text(`${storeName}  |  تاریخ گزارش: ${new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date())}`, 28, y + 6, { width, align: 'left' });
  y += 30;

  // Define Columns
  const columnDefs: Array<{ id: string; label: string; widthRatio: number }> = [
    { id: 'index', label: 'ردیف', widthRatio: 0.05 },
    { id: 'customerCode', label: 'کد حساب', widthRatio: 0.09 },
    { id: 'name', label: 'نام طرف‌حساب', widthRatio: 0.22 },
    ...(showGroupAndCity ? [
      { id: 'groupName', label: 'گروه', widthRatio: 0.12 },
      { id: 'city', label: 'شهر', widthRatio: 0.10 },
    ] : []),
    ...(showContact ? [
      { id: 'phone1', label: 'تلفن تماس', widthRatio: 0.12 },
    ] : []),
    ...(showBalances ? [
      { id: 'goldBalance', label: 'مانده طلا (گرم)', widthRatio: 0.14 },
      { id: 'rialBalance', label: 'مانده ریالی', widthRatio: 0.16 },
    ] : []),
  ];

  const totalRatio = columnDefs.reduce((acc, c) => acc + c.widthRatio, 0);
  const resolvedColumns = columnDefs.map(c => ({
    ...c,
    widthMm: (c.widthRatio / totalRatio) * width,
  }));

  const drawHeader = () => {
    let x = 28;
    pdf.rect(28, y, width, 24).fill('#e8eef3');
    pdf.fillColor('#17202a').font('DoranNoEn').fontSize(9);
    for (const col of resolvedColumns) {
      pdf.text(col.label, x + 3, y + 7, { width: col.widthMm - 6, align: 'center' });
      x += col.widthMm;
    }
    y += 24;
  };

  drawHeader();

  if (!customers.length) {
    pdf.font('Vazirmatn').fontSize(10).fillColor('#64748b')
      .text('رکوردی برای نمایش وجود ندارد.', 28, y + 20, { width, align: 'center' });
  } else {
    customers.forEach((customer, index) => {
      if (y > pdf.page.height - 55) {
        pdf.addPage();
        y = 28;
        drawHeader();
      }

      const rowHeight = 24;
      if (index % 2 === 0) pdf.rect(28, y, width, rowHeight).fill('#f8fafc');
      pdf.fillColor('#1e293b').font('Vazirmatn').fontSize(8.5);

      let x = 28;
      resolvedColumns.forEach((col) => {
        let value = '—';
        if (col.id === 'index') value = String(index + 1);
        else if (col.id === 'customerCode') value = String(customer.customerCode || '—');
        else if (col.id === 'name') value = customer.name || '—';
        else if (col.id === 'groupName') value = customer.groupName || '—';
        else if (col.id === 'city') value = customer.city || '—';
        else if (col.id === 'phone1') value = customer.phone1 || '—';
        else if (col.id === 'goldBalance') value = `${customer.goldBalance || 0}`;
        else if (col.id === 'rialBalance') value = `${new Intl.NumberFormat('fa-IR').format(customer.rialBalance || 0)}`;

        pdf.text(value, x + 3, y + 6, {
          width: col.widthMm - 6,
          height: rowHeight - 6,
          ellipsis: true,
          align: col.id === 'name' ? 'right' : 'center',
        });
        x += col.widthMm;
      });

      pdf.strokeColor('#e2e8f0').lineWidth(0.4)
        .moveTo(28, y + rowHeight)
        .lineTo(28 + width, y + rowHeight)
        .stroke();
      y += rowHeight;
    });
  }

  // Footer text
  pdf.font('Vazirmatn').fontSize(7.5).fillColor('#64748b').text(
    `تعداد کل طرف‌حساب‌ها: ${new Intl.NumberFormat('fa-IR').format(customers.length)} رکورد  |  سامانه زر فولیو`,
    28,
    pdf.page.height - 24,
    { width, align: 'right' },
  );

  return pdfBuffer(pdf);
}
