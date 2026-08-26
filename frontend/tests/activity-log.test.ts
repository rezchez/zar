import { describe, expect, test } from 'bun:test';

import {
  LOG_RETENTION_POLICIES,
  getCutoffDateForEvent,
  getRetentionDaysForEvent,
  isLogExpired,
} from '../lib/log-retention';

describe('Activity Log Retention Policies & Helper Tests', () => {
  test('returns correct retention days based on event categorization', () => {
    // Security events -> 365 days
    expect(getRetentionDaysForEvent('login_failed')).toBe(365);
    expect(getRetentionDaysForEvent('user_blocked')).toBe(365);

    // User access events -> 180 days
    expect(getRetentionDaysForEvent('login')).toBe(180);
    expect(getRetentionDaysForEvent('logout')).toBe(180);

    // Financial events -> 365 days
    expect(getRetentionDaysForEvent('transaction_created')).toBe(365);
    expect(getRetentionDaysForEvent('customer_deleted')).toBe(365);

    // Settings events -> 90 days
    expect(getRetentionDaysForEvent('settings_updated')).toBe(90);
    expect(getRetentionDaysForEvent('activity_log_cleaned')).toBe(90);

    // Default / Unknown events -> 30 days
    expect(getRetentionDaysForEvent('unknown_random_event')).toBe(30);
  });

  test('calculates correct cutoff date for events', () => {
    const refDate = new Date('2026-08-26T12:00:00Z');

    const securityCutoff = getCutoffDateForEvent('login_failed', refDate);
    expect(securityCutoff.toISOString()).toContain('2025-08-26');

    const accessCutoff = getCutoffDateForEvent('login', refDate);
    // 180 days prior to 2026-08-26
    const diffDays = Math.round((refDate.getTime() - accessCutoff.getTime()) / (1000 * 3600 * 24));
    expect(diffDays).toBe(180);

    const settingsCutoff = getCutoffDateForEvent('settings_updated', refDate);
    const settingsDiffDays = Math.round((refDate.getTime() - settingsCutoff.getTime()) / (1000 * 3600 * 24));
    expect(settingsDiffDays).toBe(90);
  });

  test('correctly identifies expired vs non-expired logs', () => {
    const refDate = new Date('2026-08-26T12:00:00Z');

    // Logout log created 200 days ago (Cutoff is 180 days) -> Expired
    const oldLogout = new Date('2026-01-01T12:00:00Z');
    expect(isLogExpired('logout', oldLogout, refDate)).toBe(true);

    // Logout log created 100 days ago -> Not expired
    const recentLogout = new Date('2026-05-18T12:00:00Z');
    expect(isLogExpired('logout', recentLogout, refDate)).toBe(false);

    // Security log created 300 days ago (Cutoff is 365 days) -> Not expired
    const securityLog = new Date('2025-10-30T12:00:00Z');
    expect(isLogExpired('user_blocked', securityLog, refDate)).toBe(false);

    // Security log created 400 days ago -> Expired
    const oldSecurityLog = new Date('2025-07-01T12:00:00Z');
    expect(isLogExpired('user_blocked', oldSecurityLog, refDate)).toBe(true);
  });

  test('all retention policies have valid labels and positive retention days', () => {
    for (const [key, policy] of Object.entries(LOG_RETENTION_POLICIES)) {
      expect(policy.category).toBe(key as any);
      expect(policy.label.length).toBeGreaterThan(0);
      expect(policy.days).toBeGreaterThan(0);
    }
  });
});

describe('Activity Log Pagination Utilities', () => {
  const ALLOWED_PER_PAGE = [25, 50, 75, 100, 500];

  test('validates perPage parameters strictly', () => {
    const validatePerPage = (input: number) => ALLOWED_PER_PAGE.includes(input) ? input : 25;

    expect(validatePerPage(25)).toBe(25);
    expect(validatePerPage(50)).toBe(50);
    expect(validatePerPage(75)).toBe(75);
    expect(validatePerPage(100)).toBe(100);
    expect(validatePerPage(500)).toBe(500);

    // Invalid values fallback to 25
    expect(validatePerPage(10)).toBe(25);
    expect(validatePerPage(200)).toBe(25);
    expect(validatePerPage(1000)).toBe(25);
  });

  test('calculates total pages accurately', () => {
    const calcTotalPages = (totalItems: number, perPage: number) =>
      Math.max(1, Math.ceil(totalItems / perPage));

    expect(calcTotalPages(0, 25)).toBe(1);
    expect(calcTotalPages(25, 25)).toBe(1);
    expect(calcTotalPages(26, 25)).toBe(2);
    expect(calcTotalPages(100, 25)).toBe(4);
    expect(calcTotalPages(140, 25)).toBe(6);
    expect(calcTotalPages(501, 500)).toBe(2);
  });

  test('generates page numbers with ellipsis pattern correctly', () => {
    function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
      if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      const pages: (number | '...')[] = [1];
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) {
        pages.push('...');
      }
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (end < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
      return pages;
    }

    // Small total pages
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);

    // Large total pages, page at start
    expect(getPageNumbers(1, 50)).toEqual([1, 2, '...', 50]);

    // Large total pages, page in middle
    expect(getPageNumbers(10, 50)).toEqual([1, '...', 9, 10, 11, '...', 50]);

    // Large total pages, page near end
    expect(getPageNumbers(49, 50)).toEqual([1, '...', 48, 49, 50]);
  });
});
