import { describe, expect, it } from 'bun:test';

import {
  calculateCutoffDate,
  DEFAULT_RETENTION_DAYS,
  formatPocketBaseDate,
  getRetentionDaysForEvent,
  LOG_RETENTION_RULES,
} from '@/lib/log-retention';

describe('Activity Log Retention Policy & Cleanup Tests', () => {
  it('assigns 365 days retention for security events (e.g. role_changed, user_blocked)', () => {
    expect(getRetentionDaysForEvent('role_changed')).toBe(365);
    expect(getRetentionDaysForEvent('user_blocked')).toBe(365);
    expect(getRetentionDaysForEvent('two_factor_enabled')).toBe(365);
  });

  it('assigns 180 days retention for user access events (e.g. login, logout)', () => {
    expect(getRetentionDaysForEvent('login')).toBe(180);
    expect(getRetentionDaysForEvent('logout')).toBe(180);
    expect(getRetentionDaysForEvent('login_failed')).toBe(180);
  });

  it('assigns 365 days retention for financial events (e.g. transaction_created)', () => {
    expect(getRetentionDaysForEvent('transaction_created')).toBe(365);
    expect(getRetentionDaysForEvent('transaction_updated')).toBe(365);
    expect(getRetentionDaysForEvent('transaction_deleted')).toBe(365);
  });

  it('assigns 90 days retention for master data and settings events', () => {
    expect(getRetentionDaysForEvent('customer_created')).toBe(90);
    expect(getRetentionDaysForEvent('customer_updated')).toBe(90);
    expect(getRetentionDaysForEvent('settings_updated')).toBe(90);
  });

  it('falls back to default retention (30 days) for unknown events', () => {
    expect(getRetentionDaysForEvent('unknown_event_type')).toBe(DEFAULT_RETENTION_DAYS);
  });

  it('calculates correct cutoff date relative to reference date', () => {
    const refDate = new Date('2026-08-26T12:00:00Z');
    const cutoff30 = calculateCutoffDate(30, refDate);
    expect(cutoff30.toISOString().slice(0, 10)).toBe('2026-07-27');

    const cutoff365 = calculateCutoffDate(365, refDate);
    expect(cutoff365.getFullYear()).toBe(2025);
  });

  it('formats PocketBase date filter properly in UTC format YYYY-MM-DD HH:mm:ss', () => {
    const refDate = new Date('2026-08-26T14:30:45.000Z');
    const formatted = formatPocketBaseDate(refDate);
    expect(formatted).toBe('2026-08-26 14:30:45');
  });

  it('ensures all defined events across rules are unique without duplicates', () => {
    const allEvents: string[] = [];
    for (const rule of LOG_RETENTION_RULES) {
      for (const ev of rule.events) {
        expect(allEvents).not.toContain(ev);
        allEvents.push(ev);
      }
    }
  });
});
