import { describe, expect, it } from 'bun:test';
import type { MeltedInventoryItem, MetalInventoryMovement } from '@/lib/inventory-reservation';
import { getInventoryItemAvailability } from '@/lib/inventory-reservation';

describe('Metal Inventory Picker, Categorization & History Tests', () => {
  const sampleInventory: MeltedInventoryItem[] = [
    {
      id: 'item-1',
      weight: 100,
      remainingWeight: 60,
      purity: 750,
      stampNumber: 'ENG-1001',
      labName: 'ری‌گیری عیارسنج',
      customerName: 'حسینی',
      rawKind: 'molten',
      date: '1403/06/01',
      history: [
        {
          id: 'hist-1',
          type: 'received',
          date: '1403/06/01',
          customerName: 'حسینی',
          weight: 100,
          description: 'دریافت اولیه آبشده',
        },
        {
          id: 'hist-2',
          type: 'paid',
          date: '1403/06/10',
          customerName: 'احمدی',
          weight: 40,
          description: 'پرداخت بخش اول',
        },
      ],
    },
    {
      id: 'item-2',
      weight: 50,
      remainingWeight: 50,
      purity: 740,
      stampNumber: 'ENG-1002',
      labName: 'ری‌گیری تهران',
      customerName: 'صادقی',
      rawKind: 'molten',
      date: '1403/06/05',
      history: [
        {
          id: 'hist-3',
          type: 'received',
          date: '1403/06/05',
          customerName: 'صادقی',
          weight: 50,
        },
      ],
    },
    {
      id: 'item-3',
      weight: 30,
      remainingWeight: 30,
      purity: 750,
      stampNumber: '',
      labName: '',
      customerName: 'محمدی',
      rawKind: 'molten',
      date: '1403/06/12',
      history: [
        {
          id: 'hist-4',
          type: 'received',
          date: '1403/06/12',
          customerName: 'محمدی',
          weight: 30,
        },
      ],
    },
    {
      id: 'item-4',
      weight: 40,
      remainingWeight: 40,
      purity: 735,
      stampNumber: '',
      labName: '',
      customerName: 'کریمی',
      rawKind: 'misc',
      date: '1403/06/15',
    },
    {
      id: 'item-5',
      weight: 25,
      remainingWeight: 25,
      purity: 750,
      stampNumber: 'COND-55',
      labName: 'آزمایشگاه پارس',
      customerName: 'نجفی',
      rawKind: 'conditional',
      date: '1403/06/18',
    },
  ];

  it('correctly filters and categorizes items by rawKind (molten, misc, conditional, question)', () => {
    const moltenItems = sampleInventory.filter((i) => (i.rawKind || 'molten') === 'molten');
    const miscItems = sampleInventory.filter((i) => i.rawKind === 'misc');
    const conditionalItems = sampleInventory.filter((i) => i.rawKind === 'conditional');
    const questionItems = sampleInventory.filter((i) => i.rawKind === 'question');

    expect(moltenItems.length).toBe(3);
    expect(miscItems.length).toBe(1);
    expect(conditionalItems.length).toBe(1);
    expect(questionItems.length).toBe(0);
  });

  it('correctly computes stamped item count, total scale weight, and base carat converted weight for molten items', () => {
    const moltenItems = sampleInventory.filter((i) => (i.rawKind || 'molten') === 'molten');
    const baseKarat = 750;

    let stampedCount = 0;
    let totalScaleWeight = 0;
    let totalConvertedWeight = 0;

    for (const item of moltenItems) {
      if (item.stampNumber && item.stampNumber.trim() !== '') {
        stampedCount++;
      }
      totalScaleWeight += item.remainingWeight;
      totalConvertedWeight += (item.remainingWeight * (item.purity || 750)) / baseKarat;
    }

    // 2 out of 3 molten items have stamp numbers
    expect(stampedCount).toBe(2);
    // Total scale weight: 60 + 50 + 30 = 140
    expect(totalScaleWeight).toBe(140);

    // Item 1: (60 * 750) / 750 = 60
    // Item 2: (50 * 740) / 750 = 49.333333333333336
    // Item 3: (30 * 750) / 750 = 30
    // Total converted = 139.33333333333334
    expect(totalConvertedWeight).toBeCloseTo(139.3333, 3);
  });

  it('correctly calculates marked items summary when user checks two or more items', () => {
    const markedIds = new Set(['item-1', 'item-2']);
    const baseKarat = 750;

    let markedScaleSum = 0;
    let markedConvertedSum = 0;

    for (const item of sampleInventory) {
      if (markedIds.has(item.id)) {
        markedScaleSum += item.remainingWeight;
        markedConvertedSum += (item.remainingWeight * (item.purity || 750)) / baseKarat;
      }
    }

    expect(markedScaleSum).toBe(110); // 60 + 50
    expect(markedConvertedSum).toBeCloseTo(109.3333, 3); // 60 + 49.3333
  });

  it('provides complete turnover history (initial receipt and payouts) for each item', () => {
    const item1 = sampleInventory[0];
    expect(item1.history).toBeDefined();
    expect(item1.history!.length).toBe(2);

    const receipt = item1.history![0];
    expect(receipt.type).toBe('received');
    expect(receipt.date).toBe('1403/06/01');
    expect(receipt.customerName).toBe('حسینی');
    expect(receipt.weight).toBe(100);

    const payout = item1.history![1];
    expect(payout.type).toBe('paid');
    expect(payout.date).toBe('1403/06/10');
    expect(payout.customerName).toBe('احمدی');
    expect(payout.weight).toBe(40);

    const totalPaid = item1.history!.filter((h) => h.type === 'paid').reduce((s, h) => s + h.weight, 0);
    expect(totalPaid).toBe(40);
    expect(receipt.weight - totalPaid).toBe(item1.remainingWeight);
  });

  it('deducts committed draft lines in current document from available remaining weight', () => {
    const item1 = sampleInventory[0];
    const committedLines = [
      {
        id: 'line-1',
        documentNature: 'paid' as const,
        details: {
          inventorySourceId: 'item-1',
          rawWeight: '15.5',
        },
      },
    ];

    const availability = getInventoryItemAvailability(item1, committedLines, null);
    expect(availability.initialWeight).toBe(100);
    expect(availability.currentReserved).toBe(15.5);
    expect(availability.availableRemaining).toBe(44.5); // 60 - 15.5
  });
});
