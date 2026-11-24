import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import path from 'path';

import { chunkInventoryRows } from '../src/components/reports/InventoryReportPrintPortal';
import { goldAt750, metalAtBaseKarat, roundWeight } from '../lib/weight';

describe('Gold & Jewelry Inventory Report Tests (Iranian & International Standards)', () => {
  describe('Weight & Karat Conversions', () => {
    it('accurately converts melted gold at various assay purities to standard 18k (750)', () => {
      // 100g at 750 purity -> 100g
      expect(goldAt750(100, 750)).toBe(100);

      // 100g at 740 purity (typical scrap) -> (100 * 740) / 750 = 98.667g
      expect(goldAt750(100, 740)).toBe(98.667);

      // 100g at 995 purity (bullion/bar) -> (100 * 995) / 750 = 132.667g
      expect(goldAt750(100, 995)).toBe(132.667);

      // 100g at 999.9 purity -> (100 * 999.9) / 750 = 133.32g
      expect(goldAt750(100, 999.9)).toBe(133.32);
    });

    it('accurately converts Iranian coins (900 purity) to 18k (750)', () => {
      // Emami / Bahar Full coin: 8.133g at 900 purity
      // Converted: (8.133 * 900) / 750 = 9.7596 -> 9.76g
      const coinRaw = 8.133;
      const converted = goldAt750(coinRaw, 900);
      expect(converted).toBe(9.76);

      // Half Bahar: 4.066g at 900 purity -> (4.066 * 900) / 750 = 4.8792 -> 4.879g
      expect(goldAt750(4.066, 900)).toBe(4.879);

      // Parsian coin: 1.000g at 750 purity -> exactly 1.000g
      expect(goldAt750(1.0, 750)).toBe(1.0);
    });

    it('calculates Mesghal accurately according to Iranian traditional standards', () => {
      // 1 Mesghal = 4.6083 grams
      const weightGram = 4.6083;
      const mesghal18 = roundWeight(weightGram / 4.6083, 4);
      expect(mesghal18).toBe(1);

      // Mazanneh 17 Karat Mesghal (705 base)
      const mesghal17 = roundWeight((weightGram / 4.6083) * (750 / 705), 4);
      expect(mesghal17).toBe(1.0638);
    });

    it('accurately calculates etiquette jewelry net weight by deducting stone weight', () => {
      const grossWeight = 12.45;
      const stoneWeight = 1.2;
      const netWeight = roundWeight(grossWeight - stoneWeight, 3);
      expect(netWeight).toBe(11.25);

      // Converted to 750
      const converted = goldAt750(netWeight, 750);
      expect(converted).toBe(11.25);
    });
  });

  describe('Print Portal Intelligent Chunking', () => {
    it('handles small datasets within a single page capacity', () => {
      const items = Array.from({ length: 6 }, (_, i) => ({ id: `item-${i}` }));
      const pages = chunkInventoryRows(items, 18, 12);
      expect(pages.length).toBe(1);
      expect(pages[0].length).toBe(6);
    });

    it('chunks datasets exceeding last page capacity into multiple pages', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({ id: `item-${i}` }));
      const pages = chunkInventoryRows(items, 18, 12);
      expect(pages.length).toBe(2);
      expect(pages[0].length).toBe(18);
      expect(pages[1].length).toBe(7);
    });

    it('handles empty lists gracefully with a single empty page', () => {
      const pages = chunkInventoryRows([], 18, 12);
      expect(pages.length).toBe(1);
      expect(pages[0].length).toBe(0);
    });
  });

  describe('Security and Permission Boundaries', () => {
    it('verifies explicit hasPermission check exists in route.ts', () => {
      const routeCode = fs.readFileSync(
        path.join(__dirname, '../app/api/reports/inventory/route.ts'),
        'utf-8'
      );

      // Verifies permissions
      expect(routeCode).toContain('hasPermission');
      expect(routeCode).toContain('getServerAuthContext');
      expect(routeCode).toContain('401');
      expect(routeCode).toContain('403');
    });

    it('verifies page.tsx is protected by authentication and permission checks', () => {
      const pageCode = fs.readFileSync(
        path.join(__dirname, '../app/dashboard/reports/inventory/page.tsx'),
        'utf-8'
      );

      expect(pageCode).toContain('getServerAuthContext');
      expect(pageCode).toContain('hasPermission');
      expect(pageCode).toContain("redirect('/dashboard')");
    });
  });
});
