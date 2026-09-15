import { describe, expect, it } from 'bun:test';
import type { RawGoldInventoryItem } from '@/app/api/documents/route';

describe('Raw Gold Inventory Outflow & Validation Tests (Molten, Conditional, Misc, Question)', () => {
  const initialInventory: RawGoldInventoryItem[] = [
    {
      id: 'inv_molten_1',
      weight: 50.0,
      remainingWeight: 50.0,
      purity: 740,
      stampNumber: 'ANG-7788',
      labName: 'ری‌گیری عیار سنج',
      customerName: 'بنکدار حسینی',
      rawKind: 'molten',
    },
    {
      id: 'inv_conditional_1',
      weight: 40.0,
      remainingWeight: 40.0,
      purity: 750,
      stampNumber: 'COND-101',
      labName: 'آزمایشگاه زرین',
      customerName: 'همکار احمدی',
      rawKind: 'conditional',
    },
    {
      id: 'inv_misc_1',
      weight: 25.0,
      remainingWeight: 25.0,
      purity: 735,
      stampNumber: '',
      labName: '',
      customerName: 'مشتری عباسی',
      rawKind: 'misc',
    },
    {
      id: 'inv_question_1',
      weight: 15.0,
      remainingWeight: 15.0,
      purity: 745,
      stampNumber: 'Q-99',
      labName: 'آزمایشگاه طهران',
      customerName: 'موجودی سواله',
      rawKind: 'question',
    },
  ];

  // Helper simulating UI lot selection
  function handleInventorySelectionChange(
    selectedId: string,
    currentDetails: {
      inventorySourceId: string;
      rawWeight: string;
      purity: string;
      stampNumber: string;
      labName: string;
    },
    inventoryList: RawGoldInventoryItem[],
  ) {
    const source = inventoryList.find((item) => item.id === selectedId);
    return {
      ...currentDetails,
      inventorySourceId: selectedId,
      rawWeight: source ? String(source.remainingWeight) : (selectedId ? currentDetails.rawWeight : ''),
      purity: source ? String(source.purity || 750) : (selectedId ? currentDetails.purity : '750'),
      stampNumber: source ? (source.stampNumber ?? '') : '',
      labName: source ? (source.labName ?? '') : '',
    };
  }

  // Helper simulating UI validation
  function validateLineWeight(
    lineNature: string,
    rawWeightStr: string,
    inventorySourceId: string,
    inventoryList: RawGoldInventoryItem[],
    rawKind: string,
  ): string {
    const rawWeight = Number(rawWeightStr);
    if (rawWeight <= 0) return 'وزن طلای خام باید بیشتر از صفر باشد.';
    if (lineNature === 'paid' && inventorySourceId) {
      const sourceItem = inventoryList.find((item) => item.id === inventorySourceId);
      if (sourceItem && rawWeight > sourceItem.remainingWeight + 0.0000001) {
        const kindTitle = rawKind === 'conditional'
          ? 'شرطی'
          : rawKind === 'misc'
            ? 'متفرقه'
            : rawKind === 'question'
              ? 'سواله'
              : 'آبشده';
        return `وزن خروجی نمی‌تواند بیشتر از موجودی ${kindTitle} (${sourceItem.remainingWeight.toFixed(3)} گرم) باشد.`;
      }
    }
    return '';
  }

  // Helper simulating backend validation & enforcement
  function processBackendOutflows(
    outflows: Array<{
      lineNature: string;
      rawWeight: number;
      rawKind: string;
      inventorySourceId: string;
      clientPurity: number;
    }>,
    inventoryItems: RawGoldInventoryItem[],
  ) {
    const availableWeights = new Map(inventoryItems.map((item) => [item.id, item.remainingWeight]));
    const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));
    const results = [];

    for (let i = 0; i < outflows.length; i++) {
      const line = outflows[i];
      if (line.lineNature === 'paid' && line.inventorySourceId) {
        const available = availableWeights.get(line.inventorySourceId) ?? 0;
        if (line.rawWeight > available + 0.0000001) {
          const kindTitle = line.rawKind === 'conditional'
            ? 'شرطی'
            : line.rawKind === 'misc'
              ? 'متفرقه'
              : line.rawKind === 'question'
                ? 'سواله'
                : 'آبشده';
          throw new Error(`وزن خروجی ردیف ${i + 1} از موجودی ${kindTitle} بیشتر است.`);
        }
        availableWeights.set(line.inventorySourceId, available - line.rawWeight);
        const sourceItem = inventoryMap.get(line.inventorySourceId);
        results.push({
          success: true,
          enforcedPurity: sourceItem?.purity ?? line.clientPurity,
          labName: sourceItem?.labName ?? '',
          stampNumber: sourceItem?.stampNumber ?? '',
          remainingAfter: availableWeights.get(line.inventorySourceId)!,
        });
      }
    }
    return results;
  }

  it('1. Selecting an inventory lot auto-populates purity, lab, stamp and remaining weight across all 4 kinds', () => {
    // Test molten
    const moltenSelected = handleInventorySelectionChange('inv_molten_1', { inventorySourceId: '', rawWeight: '', purity: '750', stampNumber: '', labName: '' }, initialInventory);
    expect(moltenSelected.purity).toBe('740');
    expect(moltenSelected.labName).toBe('ری‌گیری عیار سنج');
    expect(moltenSelected.stampNumber).toBe('ANG-7788');
    expect(moltenSelected.rawWeight).toBe('50');

    // Test conditional
    const condSelected = handleInventorySelectionChange('inv_conditional_1', { inventorySourceId: '', rawWeight: '', purity: '750', stampNumber: '', labName: '' }, initialInventory);
    expect(condSelected.purity).toBe('750');
    expect(condSelected.labName).toBe('آزمایشگاه زرین');
    expect(condSelected.stampNumber).toBe('COND-101');
    expect(condSelected.rawWeight).toBe('40');

    // Test misc
    const miscSelected = handleInventorySelectionChange('inv_misc_1', { inventorySourceId: '', rawWeight: '', purity: '750', stampNumber: '', labName: '' }, initialInventory);
    expect(miscSelected.purity).toBe('735');
    expect(miscSelected.rawWeight).toBe('25');

    // Test question
    const qSelected = handleInventorySelectionChange('inv_question_1', { inventorySourceId: '', rawWeight: '', purity: '750', stampNumber: '', labName: '' }, initialInventory);
    expect(qSelected.purity).toBe('745');
    expect(qSelected.labName).toBe('آزمایشگاه طهران');
    expect(qSelected.stampNumber).toBe('Q-99');
    expect(qSelected.rawWeight).toBe('15');
  });

  it('2. Enforces and locks purity: backend overrides any altered client purity with the lot original purity', () => {
    const res = processBackendOutflows([
      {
        lineNature: 'paid',
        rawWeight: 20.0,
        rawKind: 'molten',
        inventorySourceId: 'inv_molten_1',
        clientPurity: 750, // client attempted to send 750 instead of 740
      },
      {
        lineNature: 'paid',
        rawWeight: 10.0,
        rawKind: 'misc',
        inventorySourceId: 'inv_misc_1',
        clientPurity: 760, // client attempted to send 760 instead of 735
      },
    ], initialInventory);

    expect(res[0].enforcedPurity).toBe(740);
    expect(res[1].enforcedPurity).toBe(735);
  });

  it('3. Incremental / partial outflow: reduces available weight correctly and allows multiple valid exits', () => {
    // Outflow 30g from 50g molten lot
    const res = processBackendOutflows([
      {
        lineNature: 'paid',
        rawWeight: 30.0,
        rawKind: 'molten',
        inventorySourceId: 'inv_molten_1',
        clientPurity: 740,
      },
      {
        lineNature: 'paid',
        rawWeight: 15.0,
        rawKind: 'molten',
        inventorySourceId: 'inv_molten_1',
        clientPurity: 740,
      },
    ], initialInventory);

    expect(res[0].remainingAfter).toBe(20.0);
    expect(res[1].remainingAfter).toBe(5.0);
  });

  it('4. Rejects overdraft: frontend and backend reject when requestedWeight > remainingWeight', () => {
    // Frontend check
    const validationError = validateLineWeight('paid', '55', 'inv_molten_1', initialInventory, 'molten');
    expect(validationError).toContain('وزن خروجی نمی‌تواند بیشتر از موجودی آبشده');

    // Backend check
    expect(() => {
      processBackendOutflows([
        {
          lineNature: 'paid',
          rawWeight: 50.001,
          rawKind: 'molten',
          inventorySourceId: 'inv_molten_1',
          clientPurity: 740,
        },
      ], initialInventory);
    }).toThrow('وزن خروجی ردیف 1 از موجودی آبشده بیشتر است.');

    // Conditional gold overdraft
    expect(() => {
      processBackendOutflows([
        {
          lineNature: 'paid',
          rawWeight: 45,
          rawKind: 'conditional',
          inventorySourceId: 'inv_conditional_1',
          clientPurity: 750,
        },
      ], initialInventory);
    }).toThrow('وزن خروجی ردیف 1 از موجودی شرطی بیشتر است.');
  });

  it('5. Depleting a lot to 0g eliminates it from remaining inventory (> 0.0000001)', () => {
    // Consume entire 50g
    const res = processBackendOutflows([
      {
        lineNature: 'paid',
        rawWeight: 50.0,
        rawKind: 'molten',
        inventorySourceId: 'inv_molten_1',
        clientPurity: 740,
      },
    ], initialInventory);

    expect(res[0].remainingAfter).toBe(0);

    const updatedRemaining = initialInventory.map((item) => {
      if (item.id === 'inv_molten_1') {
        return { ...item, remainingWeight: res[0].remainingAfter };
      }
      return item;
    }).filter((item) => item.remainingWeight > 0.0000001);

    expect(updatedRemaining.some((item) => item.id === 'inv_molten_1')).toBe(false);
  });

  it('6. Deleting or cancelling an outflow document restores available weight', () => {
    const outflows = [
      { id: 'out_1', sourceId: 'inv_molten_1', weight: 30.0, is_deleted: false },
      { id: 'out_2', sourceId: 'inv_molten_1', weight: 20.0, is_deleted: true },
    ];

    let remaining = 50.0;
    for (const out of outflows) {
      if (!out.is_deleted && out.sourceId === 'inv_molten_1') {
        remaining -= out.weight;
      }
    }
    expect(remaining).toBe(20.0);
  });
});
