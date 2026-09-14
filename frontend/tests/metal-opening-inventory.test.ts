import { describe, expect, it } from 'bun:test';

import {
  calculateMetalInventoryBalances,
  DEFAULT_METAL_TYPE_IDS,
  INVENTORY_TYPE_LABELS,
  isLabAndStampRequired,
  parseMetalDocumentDetails,
  resolveMetalTypeId,
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

  describe('Layer 2: Initial Metal Inventory Types (آبشده، شرطی، متفرقه، سواله)', () => {
    const metals: PreciousMetalType[] = ['gold', 'silver', 'platinum'];
    const types: MetalInventoryType[] = ['melted', 'conditional', 'miscellaneous', 'sowaleh'];

    for (const m of metals) {
      for (const t of types) {
        it(`properly processes and details combination: ${m} x ${t}`, () => {
          const rawWeight = 120.5;
          const purity = m === 'gold' ? 750 : m === 'silver' ? 999 : 950;
          const baseKarat = DEFAULT_BASE_KARATS[m];
          const convertedWeight = metalAtBaseKarat(rawWeight, purity, baseKarat, 3);
          const requiresAngAndLab = isLabAndStampRequired(t);

          const details = {
            metalType: m,
            inventoryType: t,
            rawWeight,
            purity,
            baseKarat,
            convertedWeight,
            labName: requiresAngAndLab ? 'ری‌گیری اعتماد' : undefined,
            stampNumber: requiresAngAndLab ? '98765' : undefined,
          };

          const parsed = parseMetalDocumentDetails(JSON.stringify(details));
          expect(parsed.metalType).toBe(m);
          expect(parsed.inventoryType).toBe(t);
          expect(parsed.rawWeight).toBe(rawWeight);
          expect(parsed.convertedWeight).toBe(convertedWeight);

          if (requiresAngAndLab) {
            expect(parsed.stampNumber).toBe('98765');
            expect(parsed.labName).toBe('ری‌گیری اعتماد');
          } else {
            expect(parsed.stampNumber).toBeUndefined();
          }
        });
      }
    }

    it('enforces mandatory labName and stampNumber for melted (آبشده) and conditional (شرطی)', () => {
      expect(isLabAndStampRequired('melted')).toBe(true);
      expect(isLabAndStampRequired('conditional')).toBe(true);
      expect(isLabAndStampRequired('conditional_melted')).toBe(true);
    });

    it('confirms that miscellaneous (متفرقه) and sowaleh (سواله) do not require labName and stampNumber', () => {
      expect(isLabAndStampRequired('miscellaneous')).toBe(false);
      expect(isLabAndStampRequired('sowaleh')).toBe(false);
      expect(isLabAndStampRequired('miscellaneous_melted')).toBe(false);
      expect(isLabAndStampRequired('general_metal')).toBe(false);
    });

    it('provides correct Persian labels for all inventory types', () => {
      expect(INVENTORY_TYPE_LABELS['melted']).toBe('آبشده');
      expect(INVENTORY_TYPE_LABELS['conditional']).toBe('شرطی');
      expect(INVENTORY_TYPE_LABELS['miscellaneous']).toBe('متفرقه');
      expect(INVENTORY_TYPE_LABELS['sowaleh']).toBe('سواله');
    });

    it('sets provisional purity of 750 for conditional gold until assay lab result is known', () => {
      const rawWeight = 100;
      const conditionalPurity = 750;
      const baseKarat = 750;
      const convertedWeight = metalAtBaseKarat(rawWeight, conditionalPurity, baseKarat, 3);
      expect(convertedWeight).toBe(100);
    });
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

  describe('Layer 5: Metal Type Relation (metal_type) Resolution', () => {
    it('resolves correct default metal_type ID for gold, silver, and platinum', () => {
      expect(resolveMetalTypeId('gold')).toBe(DEFAULT_METAL_TYPE_IDS.gold);
      expect(resolveMetalTypeId('gold')).toBe('metal_gold_0001');

      expect(resolveMetalTypeId('silver')).toBe(DEFAULT_METAL_TYPE_IDS.silver);
      expect(resolveMetalTypeId('silver')).toBe('metal_silver_001');

      expect(resolveMetalTypeId('platinum')).toBe(DEFAULT_METAL_TYPE_IDS.platinum);
      expect(resolveMetalTypeId('platinum')).toBe('metal_plat_0001');
    });

    it('resolves metal_type ID from Persian names or chemical symbols', () => {
      expect(resolveMetalTypeId('طلا')).toBe('metal_gold_0001');
      expect(resolveMetalTypeId('Au')).toBe('metal_gold_0001');

      expect(resolveMetalTypeId('نقره')).toBe('metal_silver_001');
      expect(resolveMetalTypeId('Ag')).toBe('metal_silver_001');

      expect(resolveMetalTypeId('پلاتین')).toBe('metal_plat_0001');
      expect(resolveMetalTypeId('Pt')).toBe('metal_plat_0001');
    });

    it('returns empty string for unrecognized metal strings', () => {
      expect(resolveMetalTypeId('copper')).toBe('');
      expect(resolveMetalTypeId('')).toBe('');
    });
  });

  describe('Layer 6: Purity Constraints & Upper Limit Validation (Max 999.9)', () => {
    function isValidOpeningPurity(purity: number, isConditional: boolean): boolean {
      const effectivePurity = isConditional ? 750 : purity;
      return Number.isFinite(effectivePurity) && effectivePurity > 0 && effectivePurity <= 999.9;
    }

    it('accepts valid purity values up to and including 999.9', () => {
      expect(isValidOpeningPurity(750, false)).toBe(true);
      expect(isValidOpeningPurity(900, false)).toBe(true);
      expect(isValidOpeningPurity(995, false)).toBe(true);
      expect(isValidOpeningPurity(999, false)).toBe(true);
      expect(isValidOpeningPurity(999.9, false)).toBe(true);
      expect(isValidOpeningPurity(1, false)).toBe(true);
      expect(isValidOpeningPurity(750, true)).toBe(true);
    });

    it('strictly prohibits purity values higher than 999.9 (e.g. 1000, 1000.1, 1050)', () => {
      expect(isValidOpeningPurity(1000, false)).toBe(false);
      expect(isValidOpeningPurity(999.91, false)).toBe(false);
      expect(isValidOpeningPurity(1000.5, false)).toBe(false);
      expect(isValidOpeningPurity(1200, false)).toBe(false);
      expect(isValidOpeningPurity(0, false)).toBe(false);
      expect(isValidOpeningPurity(-10, false)).toBe(false);
    });

    it('accurately calculates converted weight for fine metals at 999.9 purity', () => {
      // 100g of 999.9 gold at base 750 -> (100 * 999.9) / 750 = 133.32g
      const converted = metalAtBaseKarat(100, 999.9, 750, 3);
      expect(converted).toBe(133.32);
    });
  });
});
