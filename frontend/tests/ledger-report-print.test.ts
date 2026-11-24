import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import path from 'path';
import {
  chunkLedgerRowsForPrint,
} from '../src/components/reports/LedgerReportPrintPortal';

describe('Customer Ledger Report Print (A4 & A5 Multi-page) Tests', () => {
  it('correctly chunks small dataset into a single page with summary capacity', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `row-${i}` }));
    const pages = chunkLedgerRowsForPrint(items, 16, 11);

    expect(pages.length).toBe(1);
    expect(pages[0].length).toBe(5);
  });

  it('correctly chunks datasets exceeding last page capacity into multiple pages', () => {
    // 25 items for A4 (normal: 16, last: 11)
    const items = Array.from({ length: 25 }, (_, i) => ({ id: `row-${i}` }));
    const pages = chunkLedgerRowsForPrint(items, 16, 11);

    expect(pages.length).toBe(2);
    expect(pages[0].length).toBe(16);
    expect(pages[1].length).toBe(9);
  });

  it('balances chunks evenly when items are near the normal page threshold to prevent overflowing the last page', () => {
    // 14 items for A4: 14 > lastPageCapacity (11), but 14 <= normalPageSize (16)
    // Should split evenly into 2 pages (7 and 7)
    const items = Array.from({ length: 14 }, (_, i) => ({ id: `row-${i}` }));
    const pages = chunkLedgerRowsForPrint(items, 16, 11);

    expect(pages.length).toBe(2);
    expect(pages[0].length).toBe(7);
    expect(pages[1].length).toBe(7);
  });

  it('supports A5 paper size with smaller page capacities', () => {
    // A5 normal: 10, last: 7
    const items = Array.from({ length: 15 }, (_, i) => ({ id: `row-${i}` }));
    const pages = chunkLedgerRowsForPrint(items, 10, 7);

    expect(pages.length).toBe(2);
    expect(pages[0].length).toBe(10);
    expect(pages[1].length).toBe(5);
  });

  it('handles empty lists gracefully with a single empty page', () => {
    const pages = chunkLedgerRowsForPrint([], 16, 11);
    expect(pages.length).toBe(1);
    expect(pages[0].length).toBe(0);
  });

  it('ensures CustomerLedgerReport includes both A4 and A5 print buttons with proper titles', () => {
    const reportCode = fs.readFileSync(
      path.join(__dirname, '../src/components/reports/CustomerLedgerReport.tsx'),
      'utf-8'
    );

    // Verifies A4 print button
    expect(reportCode).toContain("handleTriggerPrint('A4')");
    expect(reportCode).toContain('<span>چاپ A4</span>');

    // Verifies A5 print button
    expect(reportCode).toContain("handleTriggerPrint('A5')");
    expect(reportCode).toContain('<span>چاپ A5</span>');

    // Verifies old broken print styles are removed
    expect(reportCode).not.toContain('#printable-ledger-table-area {');
    expect(reportCode).not.toContain('position: absolute !important;');
  });

  it('ensures LedgerReportPrintPortal defines repeated headers, footer page numbering, and final page totals', () => {
    const portalCode = fs.readFileSync(
      path.join(__dirname, '../src/components/reports/LedgerReportPrintPortal.tsx'),
      'utf-8'
    );

    // 1. Header on every page (سربرگ گزارش)
    expect(portalCode).toContain('سربرگ گزارش');
    expect(portalCode).toContain('گزارش جامع ریز اسناد و صورت‌حساب');
    expect(portalCode).toContain('customerTitle');
    expect(portalCode).toContain('storeName');

    // 2. Footer page numbering on every page (صفحات در پایین باید شماره گذاری شده باشه)
    expect(portalCode).toContain('صفحه {pageNumberPersian} از {totalPagesPersian}');
    expect(portalCode).toContain('borderTop: \'1px solid #cbd5e1\'');

    // 3. Weight and financial column totals at the end of every page (در انتهای هر صفحه باید مجموع ستون های وزنی و مالی نوشته بشه)
    expect(portalCode).toContain('جمع این صفحه');
    expect(portalCode).toContain('formatWeight(pageStats.goldDebtor)');
    expect(portalCode).toContain('formatWeight(pageStats.goldCreditor)');
    expect(portalCode).toContain('formatMoney(pageStats.rialDebtor)');
    expect(portalCode).toContain('formatMoney(pageStats.rialCreditor)');

    // 4. Overall grand total on the final page (در صفحه انتهایی باید مجموع کل نوشته بشه)
    expect(portalCode).toContain('isLastPage');
    expect(portalCode).toContain('مجموع کل دوره');
    expect(portalCode).toContain('مانده نهایی {metalLabel}:');
    expect(portalCode).toContain('مانده نهایی مالی:');

    // 5. Correct column spans for header groups and total rows (ردیف، تاریخ، شماره سند، [طرف‌حساب]، آرتیکل، شرح ردیف سند)
    expect(portalCode).toContain('colSpan={customer ? 5 : 6}');
    expect(portalCode).toContain('گردش و مانده {metalLabel} (گرم)');
    expect(portalCode).toContain('گردش مالی ({baseCurrencySymbol})');

    // 6. Proper media print rules hiding the rest of the body cleanly
    expect(portalCode).toContain('body > *:not(.ledger-report-print-root)');
    expect(portalCode).toContain('display: none !important');
    expect(portalCode).toContain('A5 portrait');
    expect(portalCode).toContain('A4 landscape');

    // 7. Number cells match date font family without forced monospace override
    expect(portalCode).not.toContain("fontFamily: 'monospace'");

    // 8. Default margin is none (0) and footer includes logo with Zarfolio branding
    expect(portalCode).toContain('margin: 0 !important;');
    expect(portalCode).toContain('src="/logo.svg"');
    expect(portalCode).toContain('سامانه مدیریت و حسابداری طلا و جواهر زرفولیو');
  });

  it('ensures CustomerLedgerReport supports metal separation (gold, silver, platinum) and dynamic headers', () => {
    const reportCode = fs.readFileSync(
      path.join(__dirname, '../src/components/reports/CustomerLedgerReport.tsx'),
      'utf-8'
    );

    // 1. MetalFilterType and METAL_FILTER_OPTIONS
    expect(reportCode).toContain("export type MetalFilterType = 'gold' | 'silver' | 'platinum';");
    expect(reportCode).toContain('METAL_FILTER_OPTIONS');
    expect(reportCode).toContain("label: 'طلا'");
    expect(reportCode).toContain("label: 'نقره'");
    expect(reportCode).toContain("label: 'پلاتین'");

    // 2. Dynamic column groups and metalLabel
    expect(reportCode).toContain('getColumnGroups');
    expect(reportCode).toContain('گردش و مانده ${metalLabel} و مالی');
    expect(reportCode).toContain('بدهکار ${metalLabel}');
    expect(reportCode).toContain('بستانکار ${metalLabel}');
    expect(reportCode).toContain('مانده ${metalLabel}');

    // 3. Dynamic Super Header and Sub Header in table
    expect(reportCode).toContain('گردش و مانده {metalLabel}');
    expect(reportCode).toContain('مانده {metalLabel} (g)');

    // 4. Passes metalType and metalLabel to print portal
    expect(reportCode).toContain('metalType={selectedMetal}');
    expect(reportCode).toContain('metalLabel={metalLabel}');

    // 5. Metal separation is rendered as a 3-state toggle button (segmented control)
    expect(reportCode).toContain('aria-label="تفکیک فلز گزارش"');
    expect(reportCode).toContain('role="radiogroup"');
    expect(reportCode).toContain('role="radio"');
  });

  it('ensures CustomerLedgerReport supports professional multi-select category filter and cash-fund currency filter', async () => {
    const reportCode = fs.readFileSync(
      path.join(__dirname, '../src/components/reports/CustomerLedgerReport.tsx'),
      'utf-8'
    );

    // 1. Multi-select category filtering
    expect(reportCode).toContain("useState<string[]>(['all'])");
    expect(reportCode).toContain('handleToggleCategory');
    expect(reportCode).toContain('selectedCategories');
    expect(reportCode).toContain('categoryLabel');

    // 2. Currency filtering based on created cash funds and executed transactions
    expect(reportCode).toContain('selectedCurrencies');
    expect(reportCode).toContain('handleToggleCurrency');
    expect(reportCode).toContain('activeCurrencyOptions');
    expect(reportCode).toContain('currencyLabel');
    expect(reportCode).toContain('فیلتر ارز:');
    expect(reportCode).toContain('همه ارزها');

    // 3. Currency matching logic and helper functions
    const { getTransactionCurrencies, transactionMatchesCurrency } = await import(
      '../src/components/reports/CustomerLedgerReport'
    );

    const mockFunds = [
      { id: 'fund-usd', name: 'صندوق دلار', currencyCode: 'USD', currencyName: 'دلار', currencySymbol: '$' },
      { id: 'fund-eur', name: 'صندوق یورو', currencyCode: 'EUR', currencyName: 'یورو', currencySymbol: '€' },
      { id: 'fund-irt', name: 'صندوق تومان', currencyCode: 'IRT', currencyName: 'تومان', currencySymbol: 'تومان' },
    ];

    // Transaction with foreignCurrency USD
    const txUSD = {
      id: 'tx-1',
      date: '1403/08/20',
      documentNumber: 101,
      foreignCurrency: 'USD',
      foreignAmount: 500,
    } as any;

    expect(getTransactionCurrencies(txUSD, 'IRT', mockFunds)).toContain('USD');
    expect(transactionMatchesCurrency(txUSD, 'USD', 'IRT', mockFunds)).toBe(true);
    expect(transactionMatchesCurrency(txUSD, 'EUR', 'IRT', mockFunds)).toBe(false);
    expect(transactionMatchesCurrency(txUSD, 'all', 'IRT', mockFunds)).toBe(true);

    // Transaction referencing a cash fund in documentDetails
    const txFundEUR = {
      id: 'tx-2',
      date: '1403/08/21',
      documentNumber: 102,
      documentDetails: JSON.stringify({ cashFundId: 'fund-eur' }),
    } as any;

    expect(getTransactionCurrencies(txFundEUR, 'IRT', mockFunds)).toContain('EUR');
    expect(transactionMatchesCurrency(txFundEUR, 'EUR', 'IRT', mockFunds)).toBe(true);
    expect(transactionMatchesCurrency(txFundEUR, 'USD', 'IRT', mockFunds)).toBe(false);

    // Domestic rial transaction matches IRT/IRR/TOMAN
    const txRial = {
      id: 'tx-3',
      date: '1403/08/22',
      documentNumber: 103,
      rialAmount: 10000000,
    } as any;

    expect(transactionMatchesCurrency(txRial, 'IRT', 'IRT', mockFunds)).toBe(true);
    expect(transactionMatchesCurrency(txRial, 'IRR', 'IRT', mockFunds)).toBe(true);
    expect(transactionMatchesCurrency(txRial, 'USD', 'IRT', mockFunds)).toBe(false);

    // Tests for separated currency filter: 'foreign-only' and 'domestic'
    const { isTransactionForeign, isTransactionDomestic } = await import(
      '../src/components/reports/CustomerLedgerReport'
    );
    expect(isTransactionForeign(txUSD, 'IRT', mockFunds)).toBe(true);
    expect(isTransactionForeign(txRial, 'IRT', mockFunds)).toBe(false);
    expect(isTransactionDomestic(txUSD, 'IRT', mockFunds)).toBe(false);
    expect(isTransactionDomestic(txRial, 'IRT', mockFunds)).toBe(true);

    expect(transactionMatchesCurrency(txUSD, 'foreign-only', 'IRT', mockFunds)).toBe(true);
    expect(transactionMatchesCurrency(txRial, 'foreign-only', 'IRT', mockFunds)).toBe(false);
    expect(transactionMatchesCurrency(txUSD, 'domestic', 'IRT', mockFunds)).toBe(false);
    expect(transactionMatchesCurrency(txRial, 'domestic', 'IRT', mockFunds)).toBe(true);

    // Verifies 'فقط معاملات ارزی' and dynamic domestic currency label are in report UI
    expect(reportCode).toContain('فقط معاملات ارزی');
    expect(reportCode).toContain("baseCurrency === 'IRT' ? 'تومان' : 'ریال'");
    expect(reportCode).toContain('handleSearch(metal.id');

    // 4. Combined print filter label integrates both category and currency
    expect(reportCode).toContain('combinedPrintFilterLabel');
    expect(reportCode).toContain('categoryLabel={combinedPrintFilterLabel}');

    // 5. Visual metadata and compact styling consistency
    const { getCurrencyVisualMeta } = await import(
      '../src/components/reports/CustomerLedgerReport'
    );
    expect(getCurrencyVisualMeta('USD').symbol).toBe('$');
    expect(getCurrencyVisualMeta('USD').label).toBe('دلار');
    expect(getCurrencyVisualMeta('USD').activeClass).toContain('bg-emerald-600');
    expect(getCurrencyVisualMeta('EUR').symbol).toBe('€');
    expect(getCurrencyVisualMeta('EUR').activeClass).toContain('bg-sky-600');
    expect(getCurrencyVisualMeta('AED').symbol).toBe('د.إ');
    expect(getCurrencyVisualMeta('AED').activeClass).toContain('bg-amber-500');

    // Tooltip showing connected funds
    expect(reportCode).toContain('صندوق‌های متصل:');
    expect(reportCode).toContain('ارز فعال');
  });

  it('ensures LedgerReportPrintPortal renders rows with unique keys avoiding opening-bal key collisions', () => {
    const portalCode = fs.readFileSync(
      path.join(__dirname, '../src/components/reports/LedgerReportPrintPortal.tsx'),
      'utf-8'
    );

    // Verifies hardcoded duplicate key 'opening-bal' is eliminated
    expect(portalCode).not.toContain('<tr key="opening-bal"');
    expect(portalCode).toContain('key={rowKey}');
  });
});
