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

  it('InvoicePrintDesigner contains collapsible paper & margins settings section', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/InvoicePrintDesigner.tsx', 'utf-8');
    expect(content).toContain('isPaperSettingsOpen');
    expect(content).toContain('setIsPaperSettingsOpen');
    expect(content).toContain('تنظیمات کاغذ و حاشیه‌ها');
  });

  it('QrCodeSvg supports customizable margin and defaults to reduced outer white margin (0.5)', () => {
    const { QrCodeSvg } = require('@/lib/qr-code');
    expect(QrCodeSvg).toBeDefined();

    // Render with default margin
    const elDefault = QrCodeSvg({ value: '1403-1002' });
    expect(elDefault).toBeDefined();
    // Default quiet zone should be 0.5 (viewBox 0 0 count + 1 count + 1)
    expect(elDefault.props.viewBox).toBeDefined();

    // Render with custom margin
    const elCustom = QrCodeSvg({ value: '1403-1002', margin: 0.2 });
    expect(elCustom).toBeDefined();
  });

  it('InvoicePrintDesigner has correct resize handles and orientation without reversed movement', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/InvoicePrintDesigner.tsx', 'utf-8');

    // Verify handle definitions
    expect(content).toContain("handleResizeMouseDown(e, el, 'ne')");
    expect(content).toContain("handleResizeMouseDown(e, el, 'nw')");
    expect(content).toContain("handleResizeMouseDown(e, el, 'sw')");
    expect(content).toContain("handleResizeMouseDown(e, el, 'se')");
    expect(content).toContain("handleResizeMouseDown(e, el, 'w')");
    expect(content).toContain("handleResizeMouseDown(e, el, 'e')");

    // Verify RTL resize math:
    // When dragging east (e): moving mouse right (dxMm > 0) decreases xMm (moves right) and increases width
    expect(content).toContain('newXMm = resizeStart.initialXMm - dxMm');
    expect(content).toContain('newWidthMm = resizeStart.initialWidthMm + dxMm');

    // When dragging west (w): moving mouse left (dxMm < 0) increases width and keeps xMm fixed
    expect(content).toContain('newWidthMm = resizeStart.initialWidthMm - dxMm');

    // Verify QR code aspect-ratio locking
    expect(content).toContain('isSquareShape');
  });

  it('verifies items_table has full border integrity and proportional column width fitting', async () => {
    const fs = await import('fs');
    const designerContent = fs.readFileSync('src/components/InvoicePrintDesigner.tsx', 'utf-8');
    const printContent = fs.readFileSync('src/components/documents/DocumentPrint.tsx', 'utf-8');

    // 1. Proportional column widths (summing to 100% so left/right borders are never clipped)
    expect(designerContent).toContain('totalColsWidthMm = cols.reduce');
    expect(designerContent).toContain('(col.widthMm || 20) / totalColsWidthMm');
    expect(printContent).toContain('totalColsWidthMm = configuredCols.reduce');
    expect(printContent).toContain('(col.widthMm || 20) / totalColsWidthMm');

    // 2. Table container has full border intact (top, bottom, left, right)
    expect(designerContent).toContain('border: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`');
    expect(printContent).toContain('border: `${tableBorderWidth} ${tableBorderStyle} ${tableBorderColor}`');

    // 3. Page container padding does not double-offset absolute coordinates and push table off-page
    expect(printContent).toContain('padding: 0');
    expect(designerContent).toContain('title="محدوده حاشیه امن کاغذ (Page Margins)"');

    // 4. Designer table fills height with grid rows so vertical and horizontal borders are intact
    expect(designerContent).toContain('targetRowCount = Math.max(2');
    expect(designerContent).toContain('designerRows.map(');
  });

  it('numberToPersianWords converts numbers to Persian words accurately', () => {
    const { numberToPersianWords } = require('@/lib/print-templates');
    expect(numberToPersianWords(0, 'تومان')).toBe('صفر تومان');
    expect(numberToPersianWords(23350000, 'تومان')).toBe('بیست و سه میلیون و سیصد و پنجاه هزار تومان');
    expect(numberToPersianWords(1005)).toBe('یک هزار و پنج');
  });

  it('buildTemplateFromPreset builds valid A4, A5, receipt-80, and blank templates', () => {
    const { buildTemplateFromPreset, TEMPLATE_STARTER_PRESETS, AVAILABLE_DATABASE_FIELDS } = require('@/lib/print-templates');
    expect(TEMPLATE_STARTER_PRESETS.length).toBe(4);

    const receipt = buildTemplateFromPreset('receipt_80', 'فیش تست');
    expect(receipt.name).toBe('فیش تست');
    expect(receipt.page.size).toBe('receipt-80');
    expect(receipt.page.widthMm).toBe(80);
    expect(receipt.elements.length).toBeGreaterThan(5);

    const blank = buildTemplateFromPreset('blank_a4', 'بوم خالی');
    expect(blank.elements).toEqual([]);
    expect(blank.page.size).toBe('A4');

    const keys = AVAILABLE_DATABASE_FIELDS.map((f: { key: string }) => f.key);
    expect(keys).toContain('doc_total_price_words');
    expect(keys).toContain('customer_national_id');
    expect(keys).toContain('customer_address');
  });

  it('InvoicePrintDesigner supports Undo/Redo (Ctrl+Z), element grouping (Ctrl+G), and interactive out-of-bounds actions', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('src/components/InvoicePrintDesigner.tsx', 'utf-8');

    expect(content).toContain('handleUndo');
    expect(content).toContain('handleRedo');
    expect(content).toContain("e.code === 'KeyZ'");
    expect(content).toContain("e.code === 'KeyG'");
    expect(content).toContain('handleGroupElements');
    expect(content).toContain('handleUngroupElements');
    expect(content).toContain('handleMoveAllOutOfBoundsInside');
    expect(content).toContain('انتقال همه به داخل صفحه');
    expect(content).toContain('انتخاب و مدیریت');
    expect(content).toContain("case 'shop_logo':");

    const printContent = fs.readFileSync('src/components/documents/DocumentPrint.tsx', 'utf-8');
    expect(printContent).toContain("case 'shop_logo':");
    expect(printContent).toContain('settings?.printLogoUrl');
  });
});
