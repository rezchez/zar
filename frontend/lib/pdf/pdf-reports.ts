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
  subtitle?: string;
  orientation?: 'landscape' | 'portrait';
  showBalances?: boolean;
  showContact?: boolean;
  showGroupAndCity?: boolean;
  showLogo?: boolean;
  columns?: string[];
  storeName?: string;
  logoUrl?: string;
  logoBuffer?: Buffer;
  footerNotes?: string;
  showStamp?: boolean;
  showSignature?: boolean;
  showTotalCount?: boolean;
}

export function createCustomersPdf(customers: Customer[], options: CustomerPdfOptions = {}) {
  const {
    title = 'گزارش طرف‌حساب‌ها',
    subtitle,
    orientation = 'landscape',
    showBalances = true,
    showContact = true,
    showGroupAndCity = true,
    showLogo = true,
    columns,
    storeName = 'زر فولیـو',
    logoBuffer,
    footerNotes,
    showStamp,
    showSignature,
    showTotalCount = true,
  } = options;

  const pdf = createPdfDocument({ size: 'A4', layout: orientation, margin: 28 });
  const width = pdf.page.width - 56;

  let y = 28;

  // Header Section with optional Logo
  if (showLogo && logoBuffer && logoBuffer.length > 0) {
    try {
      pdf.image(logoBuffer, 28, y, { width: 50, height: 35, fit: [50, 35] });
    } catch {
      // Ignore logo render error if format unsupported by pdfkit
    }
  }

  pdf.font('DoranNoEn').fontSize(16).fillColor('#17202a')
    .text(title, 28, y, { width, align: 'right' });

  const dateStr = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date());
  const headerMeta = subtitle
    ? `${subtitle}  |  ${storeName}  |  تاریخ: ${dateStr}`
    : `${storeName}  |  تاریخ گزارش: ${dateStr}`;

  pdf.font('Vazirmatn').fontSize(9).fillColor('#475569')
    .text(headerMeta, 28, y + 6, { width, align: 'left' });
  y += 34;

  // Available Column Definitions Map
  const availableColumnMap: Record<string, { label: string; widthRatio: number; align?: 'right' | 'center' | 'left'; getValue: (c: Customer, idx: number) => string }> = {
    index: { label: 'ردیف', widthRatio: 0.05, align: 'center', getValue: (_, idx) => String(idx + 1) },
    customerCode: { label: 'کد حساب', widthRatio: 0.09, align: 'center', getValue: (c) => String(c.customerCode || '—') },
    name: { label: 'نام طرف‌حساب', widthRatio: 0.22, align: 'right', getValue: (c) => c.name || '—' },
    groupName: { label: 'گروه', widthRatio: 0.12, align: 'center', getValue: (c) => c.groupName || '—' },
    city: { label: 'شهر', widthRatio: 0.10, align: 'center', getValue: (c) => c.city || '—' },
    province: { label: 'استان', widthRatio: 0.10, align: 'center', getValue: (c) => c.province || '—' },
    phone1: { label: 'تلفن تماس', widthRatio: 0.12, align: 'center', getValue: (c) => c.phone1 || '—' },
    phone2: { label: 'تلفن ۲', widthRatio: 0.12, align: 'center', getValue: (c) => c.phone2 || '—' },
    address: { label: 'آدرس', widthRatio: 0.20, align: 'right', getValue: (c) => c.address1 || '—' },
    goldBalance: { label: 'مانده طلا (گرم)', widthRatio: 0.14, align: 'center', getValue: (c) => `${c.goldBalance || 0}` },
    silverBalance: { label: 'مانده نقره (گرم)', widthRatio: 0.14, align: 'center', getValue: (c) => `${c.silverBalance || 0}` },
    platinumBalance: { label: 'مانده پلاتین (گرم)', widthRatio: 0.14, align: 'center', getValue: (c) => `${c.platinumBalance || 0}` },
    rialBalance: { label: 'مانده ریالی', widthRatio: 0.16, align: 'center', getValue: (c) => `${new Intl.NumberFormat('fa-IR').format(c.rialBalance || 0)}` },
    foreignBalance: { label: 'مانده ارز دوم', widthRatio: 0.14, align: 'center', getValue: (c) => `${c.foreignBalance || 0}` },
    tertiaryBalance: { label: 'مانده ارز سوم', widthRatio: 0.14, align: 'center', getValue: (c) => `${c.tertiaryBalance || 0}` },
  };

  // Determine Active Columns
  let activeColKeys: string[] = [];
  if (Array.isArray(columns) && columns.length > 0) {
    activeColKeys = ['index', ...columns.filter(c => c !== 'index' && availableColumnMap[c])];
  } else {
    activeColKeys = [
      'index',
      'customerCode',
      'name',
      ...(showGroupAndCity ? ['groupName', 'city'] : []),
      ...(showContact ? ['phone1'] : []),
      ...(showBalances ? ['goldBalance', 'rialBalance'] : []),
    ];
  }

  const columnDefs = activeColKeys.map(k => ({
    id: k,
    label: availableColumnMap[k]?.label || k,
    widthRatio: availableColumnMap[k]?.widthRatio || 0.1,
    align: availableColumnMap[k]?.align || 'center',
    getValue: availableColumnMap[k]?.getValue || ((c: Customer) => String((c as any)[k] ?? '—')),
  }));

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
      if (y > pdf.page.height - 70) {
        pdf.addPage();
        y = 28;
        drawHeader();
      }

      const rowHeight = 24;
      if (index % 2 === 0) pdf.rect(28, y, width, rowHeight).fill('#f8fafc');
      pdf.fillColor('#1e293b').font('Vazirmatn').fontSize(8.5);

      let x = 28;
      resolvedColumns.forEach((col) => {
        const value = col.getValue(customer, index);
        pdf.text(value, x + 3, y + 6, {
          width: col.widthMm - 6,
          height: rowHeight - 6,
          ellipsis: true,
          align: col.align,
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

  // Stamp and Signature Boxes if requested
  if ((showStamp || showSignature) && y < pdf.page.height - 80) {
    const boxY = Math.min(y + 20, pdf.page.height - 65);
    if (showStamp) {
      pdf.rect(28, boxY, 110, 40).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      pdf.font('Vazirmatn').fontSize(7.5).fillColor('#94a3b8')
        .text('محل مهر فروشگاه', 32, boxY + 14, { width: 102, align: 'center' });
    }
    if (showSignature) {
      pdf.rect(width - 82, boxY, 110, 40).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      pdf.font('Vazirmatn').fontSize(7.5).fillColor('#94a3b8')
        .text('امضای مسئول', width - 78, boxY + 14, { width: 102, align: 'center' });
    }
  }

  // Footer notes and total count
  const footerTextParts: string[] = [];
  if (showTotalCount) {
    footerTextParts.push(`تعداد کل طرف‌حساب‌ها: ${new Intl.NumberFormat('fa-IR').format(customers.length)} رکورد`);
  }
  if (footerNotes) {
    footerTextParts.push(footerNotes);
  } else {
    footerTextParts.push('سامانه زر فولیو');
  }

  pdf.font('Vazirmatn').fontSize(7.5).fillColor('#64748b').text(
    footerTextParts.join('  |  '),
    28,
    pdf.page.height - 24,
    { width, align: 'right' },
  );

  return pdfBuffer(pdf);
}
