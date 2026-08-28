import { describe, expect, it } from 'bun:test';
import { DEFAULT_SYSTEM_TEMPLATES, CUSTOMER_DEFAULT_TABLE_COLUMNS, type InvoicePrintTemplate } from '@/lib/print-templates';
import { defaultSettings, normalizeSettings, type AppSettings } from '@/lib/settings';

describe('Customer Print Template & Manager Notifications Tests', () => {
  it('DEFAULT_SYSTEM_TEMPLATES contains default customer template tpl_customer_default', () => {
    const customerTpl = DEFAULT_SYSTEM_TEMPLATES.find((t: InvoicePrintTemplate) => t.id === 'tpl_customer_default');
    expect(customerTpl).toBeDefined();
    expect(customerTpl?.templateType).toBe('customer');
    expect(customerTpl?.isSystemDefault).toBe(true);
    expect(customerTpl?.table?.columns.length).toBeGreaterThanOrEqual(5);
  });

  it('CUSTOMER_DEFAULT_TABLE_COLUMNS contains standard customer columns', () => {
    expect(CUSTOMER_DEFAULT_TABLE_COLUMNS.length).toBeGreaterThanOrEqual(6);
    const colIds = CUSTOMER_DEFAULT_TABLE_COLUMNS.map((c) => c.id);
    expect(colIds).toContain('customerCode');
    expect(colIds).toContain('name');
    expect(colIds).toContain('goldBalance');
    expect(colIds).toContain('rialBalance');
  });

  it('defaultSettings includes messenger defaults', () => {
    expect(defaultSettings.telegramEnabled).toBe(false);
    expect(defaultSettings.telegramSendPdf).toBe(true);
    expect(defaultSettings.telegramSendText).toBe(true);
    expect(defaultSettings.baleEnabled).toBe(false);
    expect(defaultSettings.baleSendPdf).toBe(true);
    expect(defaultSettings.baleSendText).toBe(true);
    expect(Array.isArray(defaultSettings.printCustomerColumns)).toBe(true);
    expect(Array.isArray(defaultSettings.printRecipients)).toBe(true);
  });

  it('normalizeSettings normalizes messenger and recipient inputs properly', () => {
    const normalized = normalizeSettings({
      telegramEnabled: true,
      telegramBotToken: '12345:TOKEN',
      telegramDefaultChatId: '987654321',
      telegramSendPdf: false,
      telegramSendText: true,
      baleEnabled: true,
      baleBotToken: '54321:BALETOKEN',
      baleDefaultChatId: '112233',
      printCustomerColumns: JSON.stringify(['customerCode', 'name', 'city']),
      printRecipients: JSON.stringify([
        { name: 'مدیر فروش', role: 'sales_manager', mobile: '09120000000', telegramId: '123', baleUserId: '456', enabled: true },
      ]),
    });

    expect(normalized.telegramEnabled).toBe(true);
    expect(normalized.telegramBotToken).toBe('12345:TOKEN');
    expect(normalized.telegramDefaultChatId).toBe('987654321');
    expect(normalized.telegramSendPdf).toBe(false);
    expect(normalized.telegramSendText).toBe(true);
    expect(normalized.baleEnabled).toBe(true);
    expect(normalized.baleBotToken).toBe('54321:BALETOKEN');
    expect(normalized.baleDefaultChatId).toBe('112233');
    expect(normalized.printCustomerColumns).toEqual(['customerCode', 'name', 'city']);
    expect(normalized.printRecipients).toHaveLength(1);
    expect(normalized.printRecipients[0].name).toBe('مدیر فروش');
  });
});
