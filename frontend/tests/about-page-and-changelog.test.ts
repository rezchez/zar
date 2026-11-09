import { describe, it, expect } from 'bun:test';
import { APP_VERSION, APP_VERSION_FA } from '@/lib/version';
import { CHANGELOG_RELEASES } from '@/features/changelog/data/changelog';

describe('Version 1.5 BETA & About Us Page Specifications', () => {
  it('APP_VERSION is correctly set to 1.5 BETA and Persian representation', () => {
    expect(APP_VERSION).toBe('1.5 BETA');
    expect(APP_VERSION_FA).toBe('۱.۵ بتا');
  });

  it('CHANGELOG_RELEASES has 1.5 BETA as the active latest release', () => {
    const latest = CHANGELOG_RELEASES[0];
    expect(latest).toBeDefined();
    expect(latest.version).toBe('1.5 BETA');
    expect(latest.versionFa).toBe('۱.۵ بتا');
    expect(latest.isCurrent).toBe(true);
    expect(latest.title).toContain('ته‌حساب');
    expect(latest.summary).toContain('۱.۵ بتا');

    // Etiquette migration feature
    const etiquetteMigrationFeature = latest.changes.find(
      (c) => c.title.includes('اتیکت') || c.description.includes('اتیکت'),
    );
    expect(etiquetteMigrationFeature).toBeDefined();
    expect(etiquetteMigrationFeature?.type).toBe('feature');

    // Conditional gold feature
    const conditionalGoldFeature = latest.changes.find((c) => c.title.includes('شرطی'));
    expect(conditionalGoldFeature).toBeDefined();

    // Hawala pairing and currency fix
    const hawalaFix = latest.changes.find((c) => c.title.includes('حواله') || c.title.includes('ارزی'));
    expect(hawalaFix).toBeDefined();

    // Data cleanup feature
    const cleanupFeature = latest.changes.find((c) => c.title.includes('پاکسازی'));
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
