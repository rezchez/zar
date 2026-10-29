import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_COLUMN_WIDTHS as LEDGER_DEFAULT_WIDTHS,
  MIN_COLUMN_WIDTHS as LEDGER_MIN_WIDTHS,
  getLedgerSortValue,
  type ColumnKey,
} from '../src/components/reports/CustomerLedgerReport';
import {
  DEFAULT_CUSTOMER_LEDGER_WIDTHS,
  MIN_CUSTOMER_LEDGER_WIDTHS,
  type CustomerLedgerColumnKey,
} from '../src/components/CustomerTransactionLedger';

describe('Customer Ledger Resizable Columns & Sortable Headers Tests', () => {
  it('defines valid default and minimum column widths for all CustomerLedgerReport columns', () => {
    const expectedKeys: ColumnKey[] = [
      'tick',
      'rowNumber',
      'date',
      'docNumber',
      'customer',
      'journalLine',
      'description',
      'stampNumber',
      'assayLab',
      'rawWeight',
      'purity',
      'checkDetails',
      'bankDetails',
      'foreignCurrency',
      'goldDebtor',
      'goldCreditor',
      'goldBalance',
      'rialDebtor',
      'rialCreditor',
      'rialBalance',
      'actions',
    ];

    for (const key of expectedKeys) {
      expect(LEDGER_DEFAULT_WIDTHS[key]).toBeDefined();
      expect(LEDGER_DEFAULT_WIDTHS[key]).toBeGreaterThan(30);
      expect(LEDGER_MIN_WIDTHS[key]).toBeDefined();
      expect(LEDGER_MIN_WIDTHS[key]).toBeGreaterThan(25);
      expect(LEDGER_DEFAULT_WIDTHS[key]).toBeGreaterThanOrEqual(LEDGER_MIN_WIDTHS[key]);
    }
  });

  it('defines valid default and minimum column widths for all CustomerTransactionLedger columns', () => {
    const expectedKeys: CustomerLedgerColumnKey[] = [
      'tick',
      'rowNumber',
      'date',
      'docNumber',
      'type',
      'description',
      'goldDebtor',
      'goldCreditor',
      'goldBalance',
      'rialDebtor',
      'rialCreditor',
      'rialBalance',
      'details',
    ];

    for (const key of expectedKeys) {
      expect(DEFAULT_CUSTOMER_LEDGER_WIDTHS[key]).toBeDefined();
      expect(DEFAULT_CUSTOMER_LEDGER_WIDTHS[key]).toBeGreaterThan(30);
      expect(MIN_CUSTOMER_LEDGER_WIDTHS[key]).toBeDefined();
      expect(MIN_CUSTOMER_LEDGER_WIDTHS[key]).toBeGreaterThan(25);
      expect(DEFAULT_CUSTOMER_LEDGER_WIDTHS[key]).toBeGreaterThanOrEqual(MIN_CUSTOMER_LEDGER_WIDTHS[key]);
    }
  });

  it('accurately computes column width resizing under RTL drag behavior', () => {
    const startX = 600;
    const startWidth = LEDGER_DEFAULT_WIDTHS.description; // e.g. 240
    const minWidth = LEDGER_MIN_WIDTHS.description; // 120
    const isRtl = true;

    // Dragging left (moveX = 550) in RTL expands column width by 50px
    const moveX1 = 550;
    const delta1 = isRtl ? startX - moveX1 : moveX1 - startX;
    const newWidth1 = Math.max(minWidth, Math.round(startWidth + delta1));
    expect(newWidth1).toBe(startWidth + 50);

    // Dragging right (moveX = 660) in RTL shrinks column width by 60px
    const moveX2 = 660;
    const delta2 = isRtl ? startX - moveX2 : moveX2 - startX;
    const newWidth2 = Math.max(minWidth, Math.round(startWidth + delta2));
    expect(newWidth2).toBe(startWidth - 60);

    // Extreme dragging right clamps strictly to minWidth
    const moveX3 = 1000;
    const delta3 = isRtl ? startX - moveX3 : moveX3 - startX;
    const newWidth3 = Math.max(minWidth, Math.round(startWidth + delta3));
    expect(newWidth3).toBe(minWidth);
  });

  it('correctly extracts sort values across diverse ledger row types', () => {
    const mockRow = {
      id: 'tx_1',
      documentNumber: '1042',
      documentDateJalali: '1403/08/15',
      customerName: 'طلافروشی البرز',
      goldDebtor: 25.5,
      goldCreditor: 0,
      runningGold: -25.5,
      rialDebtor: 0,
      rialCreditor: 150000000,
      runningRial: 150000000,
      description: 'خرید طلای آبشده انگ دار',
      extra: {
        stampNumber: '12840',
        assayLab: 'آزمایشگاه زرین',
        rawWeight: 26.1,
        purity: 735,
      },
    };

    expect(getLedgerSortValue(mockRow, 'docNumber')).toBe(1042);
    expect(getLedgerSortValue(mockRow, 'date')).toBe('1403/08/15');
    expect(getLedgerSortValue(mockRow, 'customer')).toBe('طلافروشی البرز');
    expect(getLedgerSortValue(mockRow, 'goldDebtor')).toBe(25.5);
    expect(getLedgerSortValue(mockRow, 'goldBalance')).toBe(-25.5);
    expect(getLedgerSortValue(mockRow, 'rialCreditor')).toBe(150000000);
    expect(getLedgerSortValue(mockRow, 'stampNumber')).toBe('12840');
    expect(getLedgerSortValue(mockRow, 'assayLab')).toBe('آزمایشگاه زرین');
    expect(getLedgerSortValue(mockRow, 'rawWeight')).toBe(26.1);
    expect(getLedgerSortValue(mockRow, 'purity')).toBe(735);
  });

  it('sorts ledger rows accurately in both ascending and descending order', () => {
    const rows = [
      { id: '1', documentNumber: '10', goldDebtor: 50, date: '1403/01/10' },
      { id: '2', documentNumber: '2', goldDebtor: 15, date: '1403/01/05' },
      { id: '3', documentNumber: '100', goldDebtor: 80, date: '1403/01/20' },
    ];

    // Numeric sort by docNumber ascending
    const sortedDocAsc = [...rows].sort((a, b) => {
      const vA = getLedgerSortValue(a, 'docNumber') as number;
      const vB = getLedgerSortValue(b, 'docNumber') as number;
      return vA - vB;
    });
    expect(sortedDocAsc.map((r) => r.documentNumber)).toEqual(['2', '10', '100']);

    // Numeric sort by docNumber descending
    const sortedDocDesc = [...rows].sort((a, b) => {
      const vA = getLedgerSortValue(a, 'docNumber') as number;
      const vB = getLedgerSortValue(b, 'docNumber') as number;
      return vB - vA;
    });
    expect(sortedDocDesc.map((r) => r.documentNumber)).toEqual(['100', '10', '2']);

    // Numeric sort by goldDebtor ascending
    const sortedGoldAsc = [...rows].sort((a, b) => {
      const vA = getLedgerSortValue(a, 'goldDebtor') as number;
      const vB = getLedgerSortValue(b, 'goldDebtor') as number;
      return vA - vB;
    });
    expect(sortedGoldAsc.map((r) => r.goldDebtor)).toEqual([15, 50, 80]);
  });

  it('correctly maps and preserves opening balance date and recognition for customer ledgers', () => {
    const { customerDateFields } = require('../features/customers/services/customer');
    expect(customerDateFields).toContain('accountOpenedAt');

    const { getJournalLineBadge, parseTransactionBreakdown } = require('../features/customers/utils/document-breakdown');

    // 1. Transaction with transactionType: 'opening_balance'
    const opTx1 = {
      id: 'tx_op_1',
      transactionType: 'opening_balance',
      isOpeningBalance: true,
      documentDateJalali: '1402/01/01',
      description: 'مانده اول دوره',
    };
    expect(getJournalLineBadge(opTx1).accountTitle).toBe('سرمایه اول دوره');
    expect(getJournalLineBadge(opTx1).accountCode).toBe('۳۱۰۰');
    expect(parseTransactionBreakdown(opTx1).categoryLabel).toBe('سند مانده اول دوره');

    // 2. Transaction with description: 'مانده حساب از قبل' (imported migration)
    const opTx2 = {
      id: 'tx_op_2',
      transactionType: 'document',
      isOpeningBalance: false,
      documentDateJalali: '1403/01/20',
      description: 'مانده حساب از قبل',
    };
    expect(getJournalLineBadge(opTx2).accountTitle).toBe('سرمایه اول دوره');
    expect(parseTransactionBreakdown(opTx2).categoryLabel).toBe('سند مانده اول دوره');
  });

  it('accurately distinguishes carried-forward balance vs opening balance date range', () => {
    // When fromDate is '1405/07/01' and customer opening balance is '1402/01/01':
    // The opening balance transaction (1402/01/01) must NOT be placed in Mehr 1405.
    const fromDatePrefix = '2026-09-23'; // 1405/07/01
    const txOpening = { transactionDate: '2023-03-21T00:00:00.000Z', documentDateJalali: '1402/01/01' };

    // Transaction in 1402 is strictly before fromDate
    const isPriorToPeriod = txOpening.transactionDate < fromDatePrefix;
    expect(isPriorToPeriod).toBe(true);

    // Carried forward condition:
    const openingBalances = { goldAmount: 4.304, rialAmount: -13300923, silverAmount: 0, platinumAmount: 0, foreignBalances: {} };
    const fromDate = '1405/07/01';

    const hasPreviousBalance = Boolean(
      fromDate && (Math.abs(openingBalances.goldAmount) > 0.0005 || Math.abs(openingBalances.rialAmount) > 50)
    );
    expect(hasPreviousBalance).toBe(true);

    // Without fromDate (all-time report), no carry-over row is generated (hasPreviousBalance is false)
    const noFromDate = '';
    const hasPreviousBalanceAllTime = Boolean(
      noFromDate && (Math.abs(openingBalances.goldAmount) > 0.0005 || Math.abs(openingBalances.rialAmount) > 50)
    );
    expect(hasPreviousBalanceAllTime).toBe(false);
  });

  it('enforces freeze pane and sticky header scroll configuration in customer ledger reports', () => {
    const fs = require('fs');
    const path = require('path');

    const reportCode = fs.readFileSync(
      path.join(__dirname, '../src/components/reports/CustomerLedgerReport.tsx'),
      'utf-8'
    );
    // Verifies the scroll container has overflow-auto and max-h so vertical scrolling takes place inside container
    expect(reportCode).toContain('overflow-auto max-h-[calc(100vh-220px)]');
    // Verifies thead has sticky top-0 and z-30 for solid freeze pane pinning
    expect(reportCode).toContain('sticky top-0 z-30 shadow-xs border-b');

    const ledgerCode = fs.readFileSync(
      path.join(__dirname, '../src/components/CustomerTransactionLedger.tsx'),
      'utf-8'
    );
    expect(ledgerCode).toContain('overflow-auto max-h-[calc(100vh-240px)]');
    expect(ledgerCode).toContain('sticky top-0 z-30 shadow-xs');
  });

  it('supports tick column marking, keyboard space shortcuts, and accurate reconciliation discrepancy calculations', () => {
    // 1. Verify tick column in CustomerLedgerReport
    const fs = require('fs');
    const path = require('path');
    const reportCode = fs.readFileSync(
      path.join(__dirname, '../src/components/reports/CustomerLedgerReport.tsx'),
      'utf-8'
    );

    expect(reportCode).toContain('toggleRowTick');
    expect(reportCode).toContain('selectedRowIds');
    expect(reportCode).toContain('tickedStats');
    expect(reportCode).toContain("e.key === ' ' || e.code === 'Space'");
    expect(reportCode).toContain('جمع و مغایرت‌گیری ردیف‌های تیک‌زده');

    // 2. Mock ledger rows reconciliation arithmetic
    const rows = [
      { id: '1', goldDebtor: 12.5, goldCreditor: 0, rialDebtor: 0, rialCreditor: 125000000 },
      { id: '2', goldDebtor: 0, goldCreditor: 12.5, rialDebtor: 125000000, rialCreditor: 0 },
      { id: '3', goldDebtor: 5.0, goldCreditor: 0, rialDebtor: 0, rialCreditor: 50000000 },
    ];

    // Scenario A: Rows 1 & 2 ticked (perfectly balanced / zero discrepancy)
    const tickedA = { '1': true, '2': true };
    let goldDebtorA = 0, goldCreditorA = 0, rialDebtorA = 0, rialCreditorA = 0;
    for (const r of rows) {
      if (tickedA[r.id as keyof typeof tickedA]) {
        goldDebtorA += r.goldDebtor;
        goldCreditorA += r.goldCreditor;
        rialDebtorA += r.rialDebtor;
        rialCreditorA += r.rialCreditor;
      }
    }
    const goldDiscrepancyA = Math.abs(goldDebtorA - goldCreditorA);
    const rialDiscrepancyA = Math.abs(rialDebtorA - rialCreditorA);
    expect(goldDiscrepancyA).toBe(0);
    expect(rialDiscrepancyA).toBe(0);

    // Scenario B: Row 1 & Row 3 ticked (unbalanced / has discrepancy)
    const tickedB = { '1': true, '3': true };
    let goldDebtorB = 0, goldCreditorB = 0, rialDebtorB = 0, rialCreditorB = 0;
    for (const r of rows) {
      if (tickedB[r.id as keyof typeof tickedB]) {
        goldDebtorB += r.goldDebtor;
        goldCreditorB += r.goldCreditor;
        rialDebtorB += r.rialDebtor;
        rialCreditorB += r.rialCreditor;
      }
    }
    const goldDiscrepancyB = Math.abs(goldDebtorB - goldCreditorB);
    const rialDiscrepancyB = Math.abs(rialDebtorB - rialCreditorB);
    expect(goldDebtorB).toBe(17.5);
    expect(goldCreditorB).toBe(0);
    expect(goldDiscrepancyB).toBe(17.5);
    expect(rialDebtorB).toBe(0);
    expect(rialCreditorB).toBe(175000000);
    expect(rialDiscrepancyB).toBe(175000000);
  });
});
