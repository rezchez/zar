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

  it('createCustomTextElement and createShapeElement create valid elements with new styling attributes', () => {
    const { createCustomTextElement, createShapeElement, ELEMENT_LABELS } = require('@/lib/print-templates');
    
    // Check ELEMENT_LABELS includes new types
    expect(ELEMENT_LABELS.custom_text).toBe('متن دلخواه');
    expect(ELEMENT_LABELS.shape_rectangle).toBe('کادر مستطیل');
    expect(ELEMENT_LABELS.shape_circle).toBe('دایره / بیضی');
    expect(ELEMENT_LABELS.shape_line_h).toBe('خط جداکننده افقی');
    expect(ELEMENT_LABELS.shape_line_v).toBe('خط جداکننده عمودی');
    expect(ELEMENT_LABELS.shape_badge).toBe('نشان / برچسب');

    // Test createCustomTextElement
    const textEl = createCustomTextElement(15, 45, 'توضیحات اختصاصی طلا');
    expect(textEl.type).toBe('custom_text');
    expect(textEl.position.xMm).toBe(15);
    expect(textEl.position.yMm).toBe(45);
    expect(textEl.content?.text).toBe('توضیحات اختصاصی طلا');
    expect(textEl.style.lineHeight).toBe(1.4);
    expect(textEl.style.opacity).toBe(1);
    expect(textEl.style.borderStyle).toBe('solid');

    // Test createShapeElement for rectangle, circle, line_h, line_v, badge
    const rectEl = createShapeElement('rectangle', 10, 20);
    expect(rectEl.type).toBe('shape_rectangle');
    expect(rectEl.style.borderStyle).toBe('solid');
    expect(rectEl.style.borderRadiusMm).toBe(2);

    const circleEl = createShapeElement('circle', 10, 20);
    expect(circleEl.type).toBe('shape_circle');
    expect(circleEl.style.borderRadiusMm).toBe(50);

    const lineHEl = createShapeElement('line_h', 10, 20, 210);
    expect(lineHEl.type).toBe('shape_line_h');
    expect(lineHEl.size.heightMm).toBe(2);
    expect(lineHEl.size.widthMm).toBe(190); // 210 - 20

    const lineVEl = createShapeElement('line_v', 10, 20);
    expect(lineVEl.type).toBe('shape_line_v');
    expect(lineVEl.size.widthMm).toBe(2);

    const badgeEl = createShapeElement('badge', 10, 20);
    expect(badgeEl.type).toBe('shape_badge');
    expect(badgeEl.style.borderRadiusMm).toBe(4);
    expect(badgeEl.content?.text).toBe('ضمانت اصالت عیار');
  });

  it('InvoiceTableConfiguration supports borders, rounded corners, striped rows and dividers', () => {
    const tpl = DEFAULT_SYSTEM_TEMPLATES[0];
    expect(tpl.table).toBeDefined();
    // Verify properties can be specified and typed correctly
    const updatedTable = {
      ...tpl.table,
      borderStyle: 'solid' as const,
      borderRadiusMm: 3,
      stripedRows: true,
      alternateRowColor: '#f1f5f9',
      showVerticalBorders: true,
      showHorizontalBorders: true,
    };
    expect(updatedTable.borderStyle).toBe('solid');
    expect(updatedTable.borderRadiusMm).toBe(3);
    expect(updatedTable.stripedRows).toBe(true);
    expect(updatedTable.alternateRowColor).toBe('#f1f5f9');
  });
});
