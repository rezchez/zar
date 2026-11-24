import { describe, it, expect } from 'bun:test';
import { APP_VERSION, APP_VERSION_FA } from '@/lib/version';
import { CHANGELOG_RELEASES } from '@/features/changelog/data/changelog';

describe('Version 1.7 BETA & About Us Page Specifications', () => {
  it('APP_VERSION is correctly set to 1.7 BETA and Persian representation', () => {
    expect(APP_VERSION).toBe('1.7 BETA');
    expect(APP_VERSION_FA).toBe('۱.۷ بتا');
  });

  it('CHANGELOG_RELEASES has 1.7 BETA as the active latest release', () => {
    const latest = CHANGELOG_RELEASES[0];
    expect(latest).toBeDefined();
    expect(latest.version).toBe('1.7 BETA');
    expect(latest.versionFa).toBe('۱.۷ بتا');
    expect(latest.isCurrent).toBe(true);
    expect(latest.dateFa).toBe('۳ آذر ۱۴۰۵');
    expect(latest.title).toContain('تبدیل');
    expect(latest.summary).toContain('۱.۷ بتا');

    // Document conversion tab feature
    const conversionTabFeature = latest.changes.find(
      (c) => c.title.includes('تبدیل') && (c.title.includes('اسناد') || c.title.includes('سند')),
    );
    expect(conversionTabFeature).toBeDefined();
    expect(conversionTabFeature?.type).toBe('feature');

    // Tahesab pooli kardan migration feature
    const pooliKardanFeature = latest.changes.find(
      (c) => c.title.includes('پولی کردن') || c.title.includes('ته‌حساب'),
    );
    expect(pooliKardanFeature).toBeDefined();
    expect(pooliKardanFeature?.type).toBe('feature');
  });

  it('Previous release 1.6 BETA is archived and not marked current', () => {
    const rel16 = CHANGELOG_RELEASES.find((r) => r.version === '1.6 BETA');
    expect(rel16).toBeDefined();
    expect(rel16?.isCurrent).toBeFalsy();

    // Conditional gold batch settlement feature in 1.6
    const batchConditionalFeature = rel16?.changes.find(
      (c) => c.title.includes('شرطی') && c.title.includes('گروهی'),
    );
    expect(batchConditionalFeature).toBeDefined();

    // Customer ledger & print portal feature in 1.6
    const ledgerPrintFeature = rel16?.changes.find(
      (c) => c.title.includes('صورت‌حساب') || c.title.includes('چاپ'),
    );
    expect(ledgerPrintFeature).toBeDefined();

    // Inventory report feature in 1.6
    const inventoryFeature = rel16?.changes.find((c) => c.title.includes('انبار'));
    expect(inventoryFeature).toBeDefined();
  });

  it('Previous release 1.5 BETA is archived and not marked current', () => {
    const rel15 = CHANGELOG_RELEASES.find((r) => r.version === '1.5 BETA');
    expect(rel15).toBeDefined();
    expect(rel15?.isCurrent).toBeFalsy();

    // Etiquette migration feature in 1.5
    const etiquetteMigrationFeature = rel15?.changes.find(
      (c) => c.title.includes('اتیکت') || c.description.includes('اتیکت'),
    );
    expect(etiquetteMigrationFeature).toBeDefined();

    // Conditional gold feature in 1.5
    const conditionalGoldFeature = rel15?.changes.find((c) => c.title.includes('شرطی'));
    expect(conditionalGoldFeature).toBeDefined();

    // Hawala pairing and currency fix in 1.5
    const hawalaFix = rel15?.changes.find((c) => c.title.includes('حواله') || c.title.includes('ارزی'));
    expect(hawalaFix).toBeDefined();

    // Data cleanup feature in 1.5
    const cleanupFeature = rel15?.changes.find((c) => c.title.includes('پاکسازی'));
    expect(cleanupFeature).toBeDefined();
  });

  it('Previous release 1.4 BETA is archived and not marked current', () => {
    const rel14 = CHANGELOG_RELEASES.find((r) => r.version === '1.4 BETA');
    expect(rel14).toBeDefined();
    expect(rel14?.isCurrent).toBeFalsy();
  });

  it('Previous release 1.3 BETA is archived and not marked current', () => {
    const rel13 = CHANGELOG_RELEASES.find((r) => r.version === '1.3 BETA');
    expect(rel13).toBeDefined();
    expect(rel13?.isCurrent).toBeFalsy();
  });
});
