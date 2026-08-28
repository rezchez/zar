import './setup';
import { describe, expect, it } from 'bun:test';
import { setMockAuthUser } from './setup';
import {
  REPORT_TYPE_DEFINITIONS,
  DEFAULT_REPORT_TEMPLATES,
  type ReportType,
} from '../lib/report-templates';
import { defaultSettings, normalizeSettings } from '../lib/settings';
import { GET as getReportTemplates, POST as createReportTemplate } from '../app/api/settings/report-templates/route';
import { PUT as updateReportTemplate, DELETE as deleteReportTemplate } from '../app/api/settings/report-templates/[id]/route';

describe('Report Templates & Logo System Tests', () => {
  it('REPORT_TYPE_DEFINITIONS contains definitions for all 8 standard report types', () => {
    const expectedTypes: ReportType[] = [
      'customer',
      'sales',
      'purchases',
      'inventory',
      'financial',
      'gold',
      'transactions',
      'general',
    ];

    expectedTypes.forEach((type) => {
      const def = REPORT_TYPE_DEFINITIONS[type];
      expect(def).toBeDefined();
      expect(def.label).toBeDefined();
      expect(def.availableColumns.length).toBeGreaterThanOrEqual(4);
      expect(def.sampleRows.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('DEFAULT_REPORT_TEMPLATES contains default customer report template', () => {
    const customerTpl = DEFAULT_REPORT_TEMPLATES.find((t) => t.reportType === 'customer');
    expect(customerTpl).toBeDefined();
    expect(customerTpl?.isSystemDefault).toBe(true);
    expect(customerTpl?.page.size).toBe('A4');
    expect(customerTpl?.page.orientation).toBe('landscape');
    expect(customerTpl?.table.columns.length).toBeGreaterThanOrEqual(5);
  });

  it('normalizeSettings normalizes reportTemplates array and JSON string properly', () => {
    const normalized = normalizeSettings({
      printLogoUrl: 'data:image/png;base64,mockLogo',
      reportTemplates: JSON.stringify([
        {
          id: 'rep_custom_1',
          name: 'قالب گزارش طلای خام',
          reportType: 'gold',
          isActive: true,
          isDefault: true,
          page: { size: 'A4', orientation: 'portrait' },
          header: { enabled: true, showLogo: true },
          table: { columns: [] },
          footer: { enabled: true },
        },
      ]),
    });

    expect(normalized.printLogoUrl).toBe('data:image/png;base64,mockLogo');
    expect(normalized.reportTemplates).toBeDefined();
    expect(normalized.reportTemplates?.length).toBe(1);
    expect(normalized.reportTemplates?.[0].name).toBe('قالب گزارش طلای خام');
  });

  it('normalizeSettings properly handles and validates numeric bodyFontSizeNumber', () => {
    // Valid number
    const customSize = normalizeSettings({ bodyFontSizeNumber: 17 });
    expect(customSize.bodyFontSizeNumber).toBe(17);

    // Named preset mapping
    const xsPreset = normalizeSettings({ bodyFontSize: 'xs' });
    expect(xsPreset.bodyFontSizeNumber).toBe(12);

    const lgPreset = normalizeSettings({ bodyFontSize: 'lg' });
    expect(lgPreset.bodyFontSizeNumber).toBe(16);

    // Out of bounds fallback
    const outOfBounds = normalizeSettings({ bodyFontSizeNumber: 99 });
    expect(outOfBounds.bodyFontSizeNumber).toBe(14);
  });

  it('GET /api/settings/report-templates returns templates for authenticated user', async () => {
    setMockAuthUser({
      id: 'admin_1',
      name: 'مدیر',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const response = await getReportTemplates();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.templates)).toBe(true);
    expect(data.templates.length).toBeGreaterThan(0);
  });

  it('POST /api/settings/report-templates creates a new template when user has permission', async () => {
    setMockAuthUser({
      id: 'admin_1',
      name: 'مدیر',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const request = new Request('http://localhost:3000/api/settings/report-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'قالب آزمایشی فروشگاه',
        reportType: 'inventory',
        isDefault: true,
        page: { size: 'A4', orientation: 'portrait' },
      }),
    });

    const response = await createReportTemplate(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.template.name).toBe('قالب آزمایشی فروشگاه');
    expect(data.template.reportType).toBe('inventory');
  });
});
