import { describe, expect, it } from 'bun:test';
import type { MeltedInventoryItem } from '@/src/components/documents/RawGoldTab';

describe('Molten Gold Exit Assay Lab Auto-population & Integrity Tests', () => {
  const inventory: MeltedInventoryItem[] = [
    {
      id: 'inv_item_1',
      weight: 125.45,
      remainingWeight: 125.45,
      purity: 750,
      stampNumber: 'ANG-9876',
      labName: 'اعتماد (تهران)',
      customerName: 'موجودی اول دوره',
    },
    {
      id: 'inv_item_2',
      weight: 200.0,
      remainingWeight: 200.0,
      purity: 745.5,
      stampNumber: 'ANG-5432',
      labName: 'آذین (تهران)',
      customerName: 'جواهرساز حسینی',
    },
    {
      id: 'inv_item_no_lab',
      weight: 50.0,
      remainingWeight: 50.0,
      purity: 750,
      stampNumber: 'ANG-1111',
      labName: '',
      customerName: 'کارگاه نمونه',
    },
  ];

  // Helper mimicking the UI selection logic implemented in RawGoldTab & GoldSaleTab
  function handleInventorySelectionChange(
    selectedId: string,
    currentDetails: {
      inventorySourceId: string;
      rawWeight: string;
      purity: string;
      stampNumber: string;
      labName: string;
    },
    inventoryList: MeltedInventoryItem[],
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

  // Helper mimicking the backend normalization & enforcement logic
  function enforceBackendInventoryDetails(
    lineNature: string,
    documentSubType: string,
    details: { inventorySourceId?: string; labName?: string; stampNumber?: string },
    inventoryMap: Map<string, MeltedInventoryItem>,
  ) {
    const enriched = { ...details };
    if (
      lineNature === 'paid' &&
      documentSubType === 'outgoing-molten' &&
      typeof enriched.inventorySourceId === 'string' &&
      enriched.inventorySourceId
    ) {
      const sourceItem = inventoryMap.get(enriched.inventorySourceId);
      if (sourceItem) {
        enriched.labName = (sourceItem.labName ?? '').trim();
        if (sourceItem.stampNumber) {
          enriched.stampNumber = (sourceItem.stampNumber ?? '').trim();
        }
      }
    }
    return enriched;
  }

  it('1. Selecting molten gold A auto-populates laboratory A', () => {
    const initialDetails = {
      inventorySourceId: '',
      rawWeight: '',
      purity: '750',
      stampNumber: '',
      labName: '',
    };

    const updated = handleInventorySelectionChange('inv_item_1', initialDetails, inventory);
    expect(updated.inventorySourceId).toBe('inv_item_1');
    expect(updated.labName).toBe('اعتماد (تهران)');
    expect(updated.stampNumber).toBe('ANG-9876');
    expect(updated.rawWeight).toBe('125.45');
    expect(updated.purity).toBe('750');
  });

  it('2. Selecting molten gold B auto-populates laboratory B', () => {
    const initialDetails = {
      inventorySourceId: '',
      rawWeight: '',
      purity: '750',
      stampNumber: '',
      labName: '',
    };

    const updated = handleInventorySelectionChange('inv_item_2', initialDetails, inventory);
    expect(updated.inventorySourceId).toBe('inv_item_2');
    expect(updated.labName).toBe('آذین (تهران)');
    expect(updated.stampNumber).toBe('ANG-5432');
    expect(updated.rawWeight).toBe('200');
    expect(updated.purity).toBe('745.5');
  });

  it('3. Switching from A to B immediately changes laboratory to B without keeping A', () => {
    let details = {
      inventorySourceId: '',
      rawWeight: '',
      purity: '750',
      stampNumber: '',
      labName: '',
    };

    // User selects A
    details = handleInventorySelectionChange('inv_item_1', details, inventory);
    expect(details.labName).toBe('اعتماد (تهران)');

    // User switches to B
    details = handleInventorySelectionChange('inv_item_2', details, inventory);
    expect(details.labName).toBe('آذین (تهران)');
    expect(details.stampNumber).toBe('ANG-5432');
  });

  it('4. Clearing inventory selection resets labName, stampNumber, and weight', () => {
    let details = {
      inventorySourceId: '',
      rawWeight: '',
      purity: '750',
      stampNumber: '',
      labName: '',
    };

    // User selects A
    details = handleInventorySelectionChange('inv_item_1', details, inventory);
    expect(details.labName).toBe('اعتماد (تهران)');

    // User clears selection
    details = handleInventorySelectionChange('', details, inventory);
    expect(details.inventorySourceId).toBe('');
    expect(details.labName).toBe('');
    expect(details.stampNumber).toBe('');
    expect(details.rawWeight).toBe('');
  });

  it('5. Selecting a molten lot without an assay lab clears any previously selected labName', () => {
    let details = {
      inventorySourceId: '',
      rawWeight: '',
      purity: '750',
      stampNumber: '',
      labName: '',
    };

    // First select lot with lab A
    details = handleInventorySelectionChange('inv_item_1', details, inventory);
    expect(details.labName).toBe('اعتماد (تهران)');

    // Then select lot with no lab
    details = handleInventorySelectionChange('inv_item_no_lab', details, inventory);
    expect(details.inventorySourceId).toBe('inv_item_no_lab');
    expect(details.labName).toBe('');
    expect(details.stampNumber).toBe('ANG-1111');
  });

  it('6. Backend enforcement overrides mismatched frontend labName with genuine source record lab', () => {
    const inventoryMap = new Map(inventory.map((item) => [item.id, item]));

    // Mismatched attack / client tampering scenario:
    // User picked item 1 (اعتماد) but manipulated client payload to submit laboratory "آزمایشگاه متفرقه Y"
    const tamperedPayload = {
      inventorySourceId: 'inv_item_1',
      labName: 'آزمایشگاه متفرقه Y',
      stampNumber: 'FAKE-STAMP',
    };

    const verified = enforceBackendInventoryDetails(
      'paid',
      'outgoing-molten',
      tamperedPayload,
      inventoryMap,
    );

    // Backend must enforce true source laboratory and stamp
    expect(verified.labName).toBe('اعتماد (تهران)');
    expect(verified.stampNumber).toBe('ANG-9876');
  });

  it('7. Backend preserves manual labName for non-inventory or incoming molten gold', () => {
    const inventoryMap = new Map(inventory.map((item) => [item.id, item]));

    const incomingPayload = {
      inventorySourceId: '',
      labName: 'ری‌گیری عیار گستر',
      stampNumber: 'IN-555',
    };

    const verified = enforceBackendInventoryDetails(
      'received',
      'incoming-molten',
      incomingPayload,
      inventoryMap,
    );

    // Should keep user-entered laboratory for incoming gold
    expect(verified.labName).toBe('ری‌گیری عیار گستر');
    expect(verified.stampNumber).toBe('IN-555');
  });
});
