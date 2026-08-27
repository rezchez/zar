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

const columnLabelsMap: Record<string, string> = {
  customerCode: 'کد حساب',
  name: 'نام / عنوان',
  englishName: 'نام انگلیسی',
  groupName: 'گروه',
  city: 'شهر',
  phone1: 'تلفن تماس',
  goldBalance: 'طلا (گرم)',
  silverBalance: 'نقره (گرم)',
  platinumBalance: 'پلاتین (گرم)',
  rialBalance: 'مانده ریالی/تومانی',
  foreignBalance: 'ارز دوم',
  tertiaryBalance: 'ارز سوم',
};

export function createCustomersPdf(customers: Customer[], options: CustomerPdfOptions = {}) {
  const {
    title = 'گزارش طرف‌حساب‌ها',
    showBalances = true,
    showContact = false,
    showGroupAndCity = true,
    columns,
    storeName,
  } = options;

  const pdf = createPdfDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  const width = pdf.page.width - 56;
  let y = 28;

  if (storeName) {
    pdf.font('Vazirmatn').fontSize(9).fillColor('#64748b').text(storeName, 28, y, { width, align: 'right' });
    y += 16;
  }

  pdf.font('DoranNoEn').fontSize(16).fillColor('#17202a').text(title, 28, y, { width, align: 'right' });
  y += 28;

  if (!customers.length) {
    pdf.font('Vazirmatn').fontSize(10).fillColor('#475569').text('رکوردی برای نمایش وجود ندارد.', 28, y, { width, align: 'right' });
    return pdfBuffer(pdf);
  }

  const selectedCols = columns && columns.length > 0
    ? columns
    : [
        'customerCode',
        'name',
        ...(showGroupAndCity ? ['groupName', 'city'] : []),
        ...(showContact ? ['phone1'] : []),
        ...(showBalances ? ['goldBalance', 'rialBalance'] : []),
      ];

  const colWidth = Math.max(50, Math.floor(width / selectedCols.length));

  const drawHeader = () => {
    pdf.rect(28, y, width, 24).fill('#e2e8f0');
    pdf.fillColor('#0f172a').font('DoranNoEn').fontSize(8);
    let x = 28;
    selectedCols.forEach((colKey) => {
      const headerTitle = columnLabelsMap[colKey] ?? colKey;
      pdf.text(headerTitle, x + 4, y + 7, { width: colWidth - 8, align: 'right', ellipsis: true });
      x += colWidth;
    });
    y += 24;
  };

  drawHeader();

  customers.forEach((customer, index) => {
    if (y > pdf.page.height - 45) {
      pdf.addPage();
      y = 28;
      drawHeader();
    }

    const rowHeight = 22;
    if (index % 2 === 0) pdf.rect(28, y, width, rowHeight).fill('#f8fafc');
    pdf.fillColor('#334155').font('Vazirmatn').fontSize(8);

    let x = 28;
    selectedCols.forEach((colKey) => {
      let cellText = '—';
      if (colKey === 'customerCode') cellText = String(customer.customerCode);
      else if (colKey === 'name') cellText = customer.name;
      else if (colKey === 'englishName') cellText = customer.englishName || '—';
      else if (colKey === 'groupName') cellText = customer.groupName || '—';
      else if (colKey === 'city') cellText = customer.city || '—';
      else if (colKey === 'phone1') cellText = customer.phone1 || '—';
      else if (colKey === 'goldBalance') cellText = `${formatNumber(customer.goldBalance)} گرم`;
      else if (colKey === 'silverBalance') cellText = `${formatNumber(customer.silverBalance)} گرم`;
      else if (colKey === 'platinumBalance') cellText = `${formatNumber(customer.platinumBalance)} گرم`;
      else if (colKey === 'rialBalance') cellText = formatNumber(customer.rialBalance);
      else if (colKey === 'foreignBalance') cellText = `${formatNumber(customer.foreignBalance)} ${currencyDisplay(customer.secondaryCurrency, customer.secondaryCurrencySymbol)}`;
      else if (colKey === 'tertiaryBalance') cellText = `${formatNumber(customer.tertiaryBalance)} ${currencyDisplay(customer.tertiaryCurrency, customer.tertiaryCurrencySymbol)}`;

      pdf.text(cellText, x + 4, y + 6, {
        width: colWidth - 8,
        height: rowHeight - 6,
        ellipsis: true,
        align: 'right',
      });
      x += colWidth;
    });

    pdf.strokeColor('#e2e8f0').lineWidth(0.4)
      .moveTo(28, y + rowHeight)
      .lineTo(28 + width, y + rowHeight)
      .stroke();

    y += rowHeight;
  });

  pdf.font('Vazirmatn').fontSize(8).fillColor('#64748b').text(
    `تعداد رکوردهای خروجی: ${formatNumber(customers.length)}    تاریخ چاپ: ${formatDate(new Date().toISOString())}`,
    28,
    pdf.page.height - 24,
    { width, align: 'right' },
  );

  return pdfBuffer(pdf);
}
