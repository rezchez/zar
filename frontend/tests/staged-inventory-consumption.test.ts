import { describe, expect, it } from 'bun:test';

import {
  getInventoryItemAvailability,
  type DocumentLineMinimal,
  type MeltedInventoryItem,
} from '../lib/inventory-reservation';

describe('Staged Inventory Consumption & Reservation Logic', () => {
  const mockInventoryItem: MeltedInventoryItem = {
    id: 'inv-1',
    weight: 100,
    remainingWeight: 100,
    purity: 750,
    stampNumber: '123456',
    labName: 'ری‌گیری اصفهان',
    customerName: 'حساب اول دوره',
    rawKind: 'molten',
  };

  it('scenario 1: initial available weight is 100g when no lines are committed', () => {
    const availability = getInventoryItemAvailability(mockInventoryItem, []);
    expect(availability.initialWeight).toBe(100);
    expect(availability.currentReserved).toBe(0);
    expect(availability.availableRemaining).toBe(100);
  });

  it('scenario 2: staged exits in same document (100g -> 30g -> 20g -> remaining 50g)', () => {
    const line1: DocumentLineMinimal = {
      id: 'line-1',
      documentNature: 'paid',
      details: {
        inventorySourceId: 'inv-1',
        rawWeight: '30',
      },
    };

    const line2: DocumentLineMinimal = {
      id: 'line-2',
      documentNature: 'paid',
      details: {
        inventorySourceId: 'inv-1',
        rawWeight: '20',
      },
    };

    const availabilityAfterLine1 = getInventoryItemAvailability(mockInventoryItem, [line1]);
    expect(availabilityAfterLine1.currentReserved).toBe(30);
    expect(availabilityAfterLine1.availableRemaining).toBe(70);

    const availabilityAfterLine2 = getInventoryItemAvailability(mockInventoryItem, [line1, line2]);
    expect(availabilityAfterLine2.currentReserved).toBe(50);
    expect(availabilityAfterLine2.availableRemaining).toBe(50);
  });

  it('scenario 3: multi-stage total exits cannot exceed original available weight', () => {
    const line1: DocumentLineMinimal = {
      id: 'line-1',
      documentNature: 'paid',
      details: {
        inventorySourceId: 'inv-1',
        rawWeight: '80',
      },
    };

    const availability = getInventoryItemAvailability(mockInventoryItem, [line1]);
    expect(availability.availableRemaining).toBe(20);

    // Attempting to select 30g when remaining is 20g should be rejected
    const requestedWeight = 30;
    const isAllowed = requestedWeight <= availability.availableRemaining + 0.0000001;
    expect(isAllowed).toBe(false);
  });

  it('scenario 5: cancelling document or resetting committed lines restores full availability', () => {
    const line1: DocumentLineMinimal = {
      id: 'line-1',
      documentNature: 'paid',
      details: {
        inventorySourceId: 'inv-1',
        rawWeight: '50',
      },
    };

    // Before cancel
    expect(getInventoryItemAvailability(mockInventoryItem, [line1]).availableRemaining).toBe(50);

    // After cancel (clearing committedLines)
    expect(getInventoryItemAvailability(mockInventoryItem, []).availableRemaining).toBe(100);
  });
});
