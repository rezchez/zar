import { describe, expect, it } from 'bun:test';
import { metalAtBaseKarat, roundWeight } from '@/lib/weight';

describe('Conditional Karat (عیار شرطی) Business Logic & Settlement Tests', () => {
  it('converts conditional gold to melted gold and recalculates converted weight accurately', () => {
    const rawWeight = 100.0;
    const provisionalPurity = 750;
    const baseKarat = 750;

    const initialConverted = roundWeight(
      metalAtBaseKarat(rawWeight, provisionalPurity, baseKarat, 3),
      3,
    );
    expect(initialConverted).toBe(100.0);

    // Assay lab returns 760
    const finalPurity = 760;
    const finalConverted = roundWeight(
      metalAtBaseKarat(rawWeight, finalPurity, baseKarat, 3),
      3,
    );
    expect(finalConverted).toBe(101.333);

    const weightDifference = roundWeight(finalConverted - initialConverted, 3);
    expect(weightDifference).toBe(1.333);
  });

  it('accurately settles negative weight difference when assay lab returns lower purity', () => {
    const rawWeight = 50.0;
    const provisionalPurity = 750;
    const finalPurity = 745;
    const baseKarat = 750;

    const initialConverted = roundWeight(
      metalAtBaseKarat(rawWeight, provisionalPurity, baseKarat, 3),
      3,
    );
    expect(initialConverted).toBe(50.0);

    const finalConverted = roundWeight(
      metalAtBaseKarat(rawWeight, finalPurity, baseKarat, 3),
      3,
    );
    expect(finalConverted).toBe(49.667);

    const weightDifference = roundWeight(finalConverted - initialConverted, 3);
    expect(weightDifference).toBe(-0.333);
  });

  it('updates metal_inventory record from conditional to melted with new purity and description', async () => {
    const mockStore: Record<string, any[]> = {
      metal_inventory: [
        {
          id: 'inv_cond_001',
          metal: 'gold',
          inventory_type: 'conditional',
          raw_weight: 45.0,
          purity: 750,
          base_karat: 750,
          converted_weight: 45.0,
          stamp_number: '123456',
          lab_name: 'ری‌گیری امین',
          direction: 'in',
          transaction_id: 'tx_cond_001',
          description: 'ورود آبشده شرطی',
          is_deleted: false,
        },
      ],
      transactions: [
        {
          id: 'tx_cond_001',
          documentSubType: 'incoming-conditional',
          documentNature: 'received',
          goldAmount: 45.0,
          documentDetails: JSON.stringify({
            rawKind: 'conditional',
            isConditional: true,
            purity: 750,
            stampNumber: '123456',
            labName: 'ری‌گیری امین',
          }),
        },
      ],
      refining_items: [],
    };

    const mockPb: any = {
      collection: (name: string) => ({
        getOne: async (id: string) => {
          const found = mockStore[name]?.find((r) => r.id === id);
          if (!found) throw new Error('Not found');
          return found;
        },
        getFullList: async (opts: any) => mockStore[name] || [],
        update: async (id: string, data: any) => {
          const index = mockStore[name]?.findIndex((r) => r.id === id);
          if (index !== -1 && index !== undefined) {
            mockStore[name][index] = { ...mockStore[name][index], ...data };
            return mockStore[name][index];
          }
          throw new Error('Not found for update');
        },
      }),
      filter: (str: string, params: any) => str,
    };

    // Simulate settling:
    const record = await mockPb.collection('metal_inventory').getOne('inv_cond_001');
    const newPurity = 755;
    const newConverted = roundWeight(
      metalAtBaseKarat(record.raw_weight, newPurity, record.base_karat, 3),
      3,
    );

    await mockPb.collection('metal_inventory').update(record.id, {
      inventory_type: 'melted',
      purity: newPurity,
      converted_weight: newConverted,
      description: `${record.description} | [عیار قطعی: ${newPurity}]`,
    });

    if (record.transaction_id) {
      const tx = await mockPb.collection('transactions').getOne(record.transaction_id);
      const details = JSON.parse(tx.documentDetails);
      await mockPb.collection('transactions').update(tx.id, {
        goldAmount: newConverted,
        documentSubType: 'incoming-molten',
        documentDetails: JSON.stringify({
          ...details,
          purity: newPurity,
          isConditional: false,
          rawKind: 'molten',
          settledAt: '2026-10-23T18:00:00.000Z',
        }),
      });
    }

    // Assertions
    const updatedInv = mockStore.metal_inventory[0];
    expect(updatedInv.inventory_type).toBe('melted');
    expect(updatedInv.purity).toBe(755);
    expect(updatedInv.converted_weight).toBe(45.3);
    expect(updatedInv.description).toContain('[عیار قطعی: 755]');

    const updatedTx = mockStore.transactions[0];
    expect(updatedTx.goldAmount).toBe(45.3);
    expect(updatedTx.documentSubType).toBe('incoming-molten');
    const updatedDetails = JSON.parse(updatedTx.documentDetails);
    expect(updatedDetails.isConditional).toBe(false);
    expect(updatedDetails.rawKind).toBe('molten');
    expect(updatedDetails.purity).toBe(755);
  });

  it('accurately settles multiple conditional gold items simultaneously (Batch Settle)', async () => {
    const items = [
      { id: 'item_1', rawWeight: 100.0, initialPurity: 750, baseKarat: 750, convertedWeight: 100.0 },
      { id: 'item_2', rawWeight: 50.0, initialPurity: 750, baseKarat: 750, convertedWeight: 50.0 },
      { id: 'item_3', rawWeight: 200.0, initialPurity: 750, baseKarat: 750, convertedWeight: 200.0 },
    ];

    const finalPurity = 760; // Common definitive carat returned from assay lab

    const recalculated = items.map((item) => {
      const newConverted = roundWeight(
        metalAtBaseKarat(item.rawWeight, finalPurity, item.baseKarat, 3),
        3,
      );
      const diff = roundWeight(newConverted - item.convertedWeight, 3);
      return { ...item, newConverted, diff };
    });

    expect(recalculated[0].newConverted).toBe(101.333);
    expect(recalculated[0].diff).toBe(1.333);

    expect(recalculated[1].newConverted).toBe(50.667);
    expect(recalculated[1].diff).toBe(0.667);

    expect(recalculated[2].newConverted).toBe(202.667);
    expect(recalculated[2].diff).toBe(2.667);

    const totalRawWeight = roundWeight(
      items.reduce((acc, item) => acc + item.rawWeight, 0),
      3,
    );
    expect(totalRawWeight).toBe(350.0);

    const totalNewConverted = roundWeight(
      recalculated.reduce((acc, item) => acc + item.newConverted, 0),
      3,
    );
    expect(totalNewConverted).toBe(354.667);

    const totalDiff = roundWeight(
      recalculated.reduce((acc, item) => acc + item.diff, 0),
      3,
    );
    expect(totalDiff).toBe(4.667);
  });

  it('accurately settles multiple conditional gold items with distinct, non-identical purities per item', async () => {
    const items = [
      { id: 'item_A', rawWeight: 100.0, initialPurity: 750, baseKarat: 750, convertedWeight: 100.0, definitivePurity: 752.4 },
      { id: 'item_B', rawWeight: 80.0, initialPurity: 750, baseKarat: 750, convertedWeight: 80.0, definitivePurity: 748.0 },
      { id: 'item_C', rawWeight: 120.0, initialPurity: 750, baseKarat: 750, convertedWeight: 120.0, definitivePurity: 765.5 },
    ];

    const recalculated = items.map((item) => {
      const newConverted = roundWeight(
        metalAtBaseKarat(item.rawWeight, item.definitivePurity, item.baseKarat, 3),
        3,
      );
      const diff = roundWeight(newConverted - item.convertedWeight, 3);
      return { ...item, newConverted, diff };
    });

    // Item A: 100 * 752.4 / 750 = 100.32
    expect(recalculated[0].newConverted).toBe(100.32);
    expect(recalculated[0].diff).toBe(0.32);

    // Item B: 80 * 748 / 750 = 79.787
    expect(recalculated[1].newConverted).toBe(79.787);
    expect(recalculated[1].diff).toBe(-0.213);

    // Item C: 120 * 765.5 / 750 = 122.48
    expect(recalculated[2].newConverted).toBe(122.48);
    expect(recalculated[2].diff).toBe(2.48);

    const totalRawWeight = roundWeight(
      items.reduce((acc, item) => acc + item.rawWeight, 0),
      3,
    );
    expect(totalRawWeight).toBe(300.0);

    const totalNewConverted = roundWeight(
      recalculated.reduce((acc, item) => acc + item.newConverted, 0),
      3,
    );
    expect(totalNewConverted).toBe(302.587);

    const totalDiff = roundWeight(
      recalculated.reduce((acc, item) => acc + item.diff, 0),
      3,
    );
    expect(totalDiff).toBe(2.587);
  });
});
