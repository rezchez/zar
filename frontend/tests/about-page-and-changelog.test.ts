import { describe, it, expect } from 'bun:test';
import { APP_VERSION, APP_VERSION_FA } from '@/lib/version';
import { CHANGELOG_RELEASES } from '@/features/changelog/data/changelog';

describe('Version 1.4 BETA & About Us Page Specifications', () => {
  it('APP_VERSION is correctly set to 1.4 BETA and Persian representation', () => {
    expect(APP_VERSION).toBe('1.4 BETA');
    expect(APP_VERSION_FA).toBe('۱.۴ بتا');
  });

  it('CHANGELOG_RELEASES has 1.4 BETA as the active latest release', () => {
    const latest = CHANGELOG_RELEASES[0];
    expect(latest).toBeDefined();
    expect(latest.version).toBe('1.4 BETA');
    expect(latest.versionFa).toBe('۱.۴ بتا');
    expect(latest.isCurrent).toBe(true);
    expect(latest.title).toContain('اندروید');
    expect(latest.summary).toContain('۱.۴ بتا');

    // Android app change
    const androidFeature = latest.changes.find(
      (c) => c.title.includes('اندروید') || c.description.includes('android'),
    );
    expect(androidFeature).toBeDefined();
    expect(androidFeature?.type).toBe('feature');

    // Etiquette & barcode change
    const etiquetteFeature = latest.changes.find((c) => c.title.includes('اتیکت'));
    expect(etiquetteFeature).toBeDefined();

    // Goods tab feature
    const goodsFeature = latest.changes.find((c) => c.title.includes('خدمات و کالا'));
    expect(goodsFeature).toBeDefined();

    // National code validation
    const nationalCodeFeature = latest.changes.find((c) => c.title.includes('کد ملی'));
    expect(nationalCodeFeature).toBeDefined();
  });

  it('Previous release 1.3 BETA is archived and not marked current', () => {
    const rel13 = CHANGELOG_RELEASES.find((r) => r.version === '1.3 BETA');
    expect(rel13).toBeDefined();
    expect(rel13?.isCurrent).toBeFalsy();
  });
});
