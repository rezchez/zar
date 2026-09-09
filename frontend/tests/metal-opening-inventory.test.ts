import { describe, expect, it } from 'bun:test';

import {
  calculateMetalInventoryBalances,
  parseMetalDocumentDetails,
  type MetalInventoryType,
} from '@/lib/metal-inventory';
import {
  DEFAULT_BASE_KARATS,
  goldAt750,
  metalAtBaseKarat,
  roundWeight,
  validateWeightPrecision,
  type PreciousMetalType,
} from '@/lib/weight';
import { postMetalOpeningInventory } from '@/features/accounting/posting/posting-engine';
import { SYSTEM_ACCOUNT_CODES } from '@/lib/accounting-posting-engine';

describe('Zarfolio — Opening Metal Inventory (Multi-Metal & Types)', () => {
  describe('Layer 1: Numeric Precision & Base Karat Conversion', () => {
    it('calculates gold converted weight at 750 base karat with precision rounding', () => {
      // 100g of 18k (750) -> 100.000g at 750
      expect(metalAtBaseKarat(100, 750, 750, 3)).toBe(100);
      expect(goldAt750(100, 750, 3)).toBe(100);

      // 100g of 705 karat -> (100 * 705) / 750 = 94.000g
      expect(metalAtBaseKarat(100, 705, 750, 3)).toBe(94);

      // 81.33g of 740 karat at precision 2 -> (81.33 * 740) / 750 = 80.2456 -> 80.25
      expect(metalAtBaseKarat(81.33, 740, 750, 2)).toBe(80.25);
    });

    it('calculates silver converted weight at 999 base karat without floating artifacts', () => {
      // 250g of 925 sterling silver at 999 base -> (250 * 925) / 999 = 231.48148... -> 231.481g
      expect(metalAtBaseKarat(250, 925, 999, 3)).toBe(231.481);

      // 500g of 999 pure silver -> 500.000g
      expect(metalAtBaseKarat(500, 999, 999, 3)).toBe(500);
    });

    it('calculates platinum converted weight at 950 base karat', () => {
      // 50g of 900 purity platinum at 950 base -> (50 * 900) / 950 = 47.3684... -> 47.368g
      expect(metalAtBaseKarat(50, 900, 950, 3)).toBe(47.368);

      // 100g of 950 pure platinum -> 100.000g
      expect(metalAtBaseKarat(100, 950, 950, 3)).toBe(100);
    });

    it('eliminates IEEE-754 floating point artifacts in precision rounding', () => {
      // Classic floating error: 81.32999999999998
      const artifactValue = 81.32999999999998;
      expect(roundWeight(artifactValue, 2)).toBe(81.33);
      expect(roundWeight(artifactValue, 3)).toBe(81.33);

      // Zero or invalid input safeguards
      expect(metalAtBaseKarat(0, 750, 750, 3)).toBe(0);
      expect(metalAtBaseKarat(100, 0, 750, 3)).toBe(0);
      expect(metalAtBaseKarat(100, 750, 0, 3)).toBe(0);
    });

    it('validates weight precision against app settings decimal places', () => {
      // Allowed precision = 2
      expect(validateWeightPrecision('12.34', 2).valid).toBe(true);
      expect(validateWeightPrecision('12.345', 2).valid).toBe(false);

      // Allowed precision = 3
      expect(validateWeightPrecision('12.345', 3).valid).toBe(true);
      expect(validateWeightPrecision('12.3456', 3).valid).toBe(false);
    });
  });

  describe('Layer 2: 9 Combinations Coverage (3 Metals x 3 Inventory Types)', () => {
    const metals: PreciousMetalType[] = ['gold', 'silver', 'platinum'];
    const types: MetalInventoryType[] = ['conditional_melted', 'miscellaneous_melted', 'general_metal'];

    for (const m of metals) {
      for (const t of types) {
        it(`properly processes and details combination: ${m} x ${t}`, () => {
          const rawWeight = 120.5;
          const purity = m === 'gold' ? 750 : m === 'silver' ? 999 : 950;
          const baseKarat = DEFAULT_BASE_KARATS[m];
          const convertedWeight = metalAtBaseKarat(rawWeight, purity, baseKarat, 3);

          const details = {
            metalType: m,
            inventoryType: t,
            rawWeight,
            purity,
            baseKarat,
            convertedWeight,
            labName: t === 'conditional_melted' ? 'ری‌گیری مرکزی' : undefined,
            stampNumber: t === 'conditional_melted' ? '98765' : undefined,
          };

          const parsed = parseMetalDocumentDetails(JSON.stringify(details));
          expect(parsed.metalType).toBe(m);
          expect(parsed.inventoryType).toBe(t);
          expect(parsed.rawWeight).toBe(rawWeight);
          expect(parsed.convertedWeight).toBe(convertedWeight);

          if (t === 'conditional_melted') {
            expect(parsed.stampNumber).toBe('98765');
            expect(parsed.labName).toBe('ری‌گیری مرکزی');
          } else {
            expect(parsed.stampNumber).toBeUndefined();
          }
        });
      }
    }
  });

  describe('Layer 3: Inventory Balances Derivation & Metal Isolation', () => {
    it('enforces Current Balance = Opening + Inflows - Outflows independently per metal', () => {
      const mockTransactions: Record<string, unknown>[] = [
        // Gold: Opening 100g, Inflow 50g, Outflow 30g -> Net = 120g
        {
          id: 'tx_g_open',
          isOpeningBalance: true,
          goldAmount: 100,
          documentNature: 'received',
          documentDetails: JSON.stringify({ purity: 750, baseKarat: 750 }),
        },
        {
          id: 'tx_g_in',
          isOpeningBalance: false,
          goldAmount: 50,
          documentNature: 'received',
          documentDetails: JSON.stringify({ purity: 750, baseKarat: 750 }),
        },
        {
          id: 'tx_g_out',
          isOpeningBalance: false,
          goldAmount: 30,
          documentNature: 'paid',
          documentDetails: JSON.stringify({ purity: 750, baseKarat: 750 }),
        },

        // Silver: Opening 500g, Inflow 200g, Outflow 100g -> Net = 600g
        {
          id: 'tx_s_open',
          isOpeningBalance: true,
          silverAmount: 500,
          documentNature: 'received',
          documentDetails: JSON.stringify({ purity: 999, baseKarat: 999 }),
        },
        {
          id: 'tx_s_in',
          isOpeningBalance: false,
          silverAmount: 200,
          documentNature: 'received',
          documentDetails: JSON.stringify({ purity: 999, baseKarat: 999 }),
        },
        {
          id: 'tx_s_out',
          isOpeningBalance: false,
          silverAmount: 100,
          documentNature: 'paid',
          documentDetails: JSON.stringify({ purity: 999, baseKarat: 999 }),
        },

        // Platinum: Opening 40g, Inflow 10g, Outflow 5g -> Net = 45g
        {
          id: 'tx_p_open',
          isOpeningBalance: true,
          platinumAmount: 40,
          documentNature: 'received',
          documentDetails: JSON.stringify({ purity: 950, baseKarat: 950 }),
        },
        {
          id: 'tx_p_in',
          isOpeningBalance: false,
          platinumAmount: 10,
          documentNature: 'received',
          documentDetails: JSON.stringify({ purity: 950, baseKarat: 950 }),
        },
        {
          id: 'tx_p_out',
          isOpeningBalance: false,
          platinumAmount: 5,
          documentNature: 'paid',
          documentDetails: JSON.stringify({ purity: 950, baseKarat: 950 }),
        },
      ];

      const balances = calculateMetalInventoryBalances(mockTransactions, 3);

      // Gold assertions
      expect(balances.gold.rawOpening).toBe(100);
      expect(balances.gold.rawInflow).toBe(50);
      expect(balances.gold.rawOutflow).toBe(30);
      expect(balances.gold.currentRawBalance).toBe(120);
      expect(balances.gold.openingCount).toBe(1);

      // Silver assertions (must NOT mix with Gold)
      expect(balances.silver.rawOpening).toBe(500);
      expect(balances.silver.rawInflow).toBe(200);
      expect(balances.silver.rawOutflow).toBe(100);
      expect(balances.silver.currentRawBalance).toBe(600);
      expect(balances.silver.openingCount).toBe(1);

      // Platinum assertions (must NOT mix with Gold or Silver)
      expect(balances.platinum.rawOpening).toBe(40);
      expect(balances.platinum.rawInflow).toBe(10);
      expect(balances.platinum.rawOutflow).toBe(5);
      expect(balances.platinum.currentRawBalance).toBe(45);
      expect(balances.platinum.openingCount).toBe(1);
    });

    it('ignores deleted transactions in balance derivation', () => {
      const mockTxs: Record<string, unknown>[] = [
        {
          id: 'tx_active',
          isOpeningBalance: true,
          goldAmount: 50,
          documentNature: 'received',
          is_deleted: false,
        },
        {
          id: 'tx_deleted',
          isOpeningBalance: true,
          goldAmount: 50,
          documentNature: 'received',
          is_deleted: true,
        },
      ];

      const balances = calculateMetalInventoryBalances(mockTxs, 3);
      expect(balances.gold.rawOpening).toBe(50);
      expect(balances.gold.openingCount).toBe(1);
    });
  });

  describe('Layer 4: Double-Entry Accounting Journal Posting', () => {
    it('creates balanced journal entry debiting 1130 and crediting 3100', async () => {
      let createdJournal: any = null;
      let createdLines: any[] = [];

      const mockPb: any = {
        collection: (name: string) => ({
          getFirstListItem: async () => null,
          create: async (data: any) => {
            if (name === 'journal_entries') {
              createdJournal = { id: 'je_metal_001', ...data };
              return createdJournal;
            }
            if (name === 'pbc_journal_lines' || name === 'journal_lines') {
              createdLines.push({ id: `jl_${createdLines.length + 1}`, ...data });
              return createdLines[createdLines.length - 1];
            }
            return { id: 'mock_id', ...data };
          },
          update: async () => ({}),
          delete: async () => ({}),
        }),
        filter: () => '',
      };

      const result = await postMetalOpeningInventory(
        {
          id: 'tx_metal_101',
          metal: 'gold',
          inventoryType: 'conditional_melted',
          weight: 100.5,
          purity: 750,
          convertedWeight: 100.5,
          totalAmount: 450_000_000,
        },
        '1403/06/19',
        'user_admin_01',
        mockPb,
      );

      expect(result.id).toBeDefined();
      expect(result.status).toBe('posted');
      expect(createdJournal).not.toBeNull();
      expect(createdJournal.sourceKey).toBe('opening:metal:tx_metal_101');
      expect(createdJournal.sourceType).toBe('opening_metal');

      // Check returned lines
      expect(result.lines.length).toBe(2);
      expect(result.lines[0].accountCode).toBe(SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY); // 1130
      expect(result.lines[0].debit).toBe(450_000_000);
      expect(result.lines[0].credit).toBe(0);

      expect(result.lines[1].accountCode).toBe(SYSTEM_ACCOUNT_CODES.OPENING_EQUITY); // 3100
      expect(result.lines[1].debit).toBe(0);
      expect(result.lines[1].credit).toBe(450_000_000);

      // Check persisted lines
      expect(createdLines.length).toBe(2);
      const debitLine = createdLines.find((l) => l.debit > 0);
      const creditLine = createdLines.find((l) => l.credit > 0);

      expect(debitLine).toBeDefined();
      expect(debitLine.account_id).toBe('sys_1130');
      expect(debitLine.debit).toBe(450_000_000);

      expect(creditLine).toBeDefined();
      expect(creditLine.account_id).toBe('sys_3100');
      expect(creditLine.credit).toBe(450_000_000);

      // Balanced check: sum(debit) == sum(credit)
      expect(debitLine.debit).toBe(creditLine.credit);
    });

    it('rejects journal posting when valuation amount is 0', async () => {
      const mockPb: any = { collection: () => ({}) };

      expect(
        postMetalOpeningInventory(
          {
            id: 'tx_zero',
            metal: 'silver',
            inventoryType: 'miscellaneous_melted',
            weight: 50,
            purity: 999,
            convertedWeight: 50,
            totalAmount: 0,
          },
          '1403/06/19',
          'user_1',
          mockPb,
        ),
      ).rejects.toThrow('مبلغ ارزشیابی موجودی اولیه فلزات نمی‌تواند صفر باشد.');
    });
  });
});
