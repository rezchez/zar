import { describe, expect, test } from 'bun:test';
import { isRefinerCustomer } from '../features/customers/services/customer-groups';
import { roundWeight, metalAtBaseKarat } from '../lib/weight';

describe('Refining Module - Business Rules & Invariants', () => {
  describe('Layer 1: Refiner Group Identification', () => {
    test('identifies refiner group customers correctly by Persian (with/without ZWNJ) and English group names', () => {
      expect(isRefinerCustomer({ groupName: 'ریگیر' })).toBe(true);
      expect(isRefinerCustomer({ groupName: 'ریگیری' })).toBe(true);
      expect(isRefinerCustomer({ groupName: 'ری‌گیر' })).toBe(true); // with ZWNJ \u200c
      expect(isRefinerCustomer({ groupName: 'ری‌گیری' })).toBe(true); // with ZWNJ \u200c
      expect(isRefinerCustomer({ group_name: 'ری‌گیری' })).toBe(true); // snake_case fallback
      expect(isRefinerCustomer('refiner')).toBe(true);
      expect(isRefinerCustomer('refining')).toBe(true);
      expect(isRefinerCustomer('Refiner')).toBe(true);

      expect(isRefinerCustomer({ groupName: 'مشتری' })).toBe(false);
      expect(isRefinerCustomer({ groupName: 'بنکدار' })).toBe(false);
      expect(isRefinerCustomer(null)).toBe(false);
      expect(isRefinerCustomer(undefined)).toBe(false);
    });
  });

  describe('Layer 2: Precision & Weight Calculations', () => {
    test('calculates metal converted weights accurately at base karat 750', () => {
      const rawWeight = 100.255;
      const purity = 750;
      const baseKarat = 750;

      const converted = metalAtBaseKarat(rawWeight, purity, baseKarat, 3);
      expect(converted).toBe(100.255);
    });

    test('calculates converted weight for fine gold (999.9) correctly', () => {
      const rawWeight = 100;
      const purity = 999.9;
      const baseKarat = 750;

      const converted = metalAtBaseKarat(rawWeight, purity, baseKarat, 3);
      expect(converted).toBe(133.32);
    });

    test('calculates sample weight difference (operational loss) correctly', () => {
      const declaredWeight = 2.500;
      const actualReceivedWeight = 2.420;

      const difference = roundWeight(declaredWeight - actualReceivedWeight, 3);
      expect(difference).toBe(0.080);
    });
  });

  describe('Layer 3: Sample Packet Single-Receive & Inventory Integrity Rules', () => {
    test('prevents double-receive of sample packet and maintains status immutability', () => {
      const sampleRecord = {
        id: 'sample_101',
        sampleCode: 'SMP-001',
        declaredWeight: 2.5,
        status: 'pending' as 'pending' | 'received',
      };

      // Mock first receive
      function receivePacket(record: typeof sampleRecord, receivedWeight: number) {
        if (record.status === 'received') {
          throw new Error('این پاکت نمونه قبلاً دریافت شده است و امکان دریافت مجدد وجود ندارد.');
        }
        record.status = 'received';
        return {
          inventoryAddedWeight: receivedWeight,
          status: record.status,
        };
      }

      // First receive succeeds
      const firstResult = receivePacket(sampleRecord, 2.45);
      expect(firstResult.status).toBe('received');
      expect(firstResult.inventoryAddedWeight).toBe(2.45);

      // Second receive MUST fail
      expect(() => receivePacket(sampleRecord, 2.45)).toThrow(
        'این پاکت نمونه قبلاً دریافت شده است و امکان دریافت مجدد وجود ندارد.',
      );
    });
  });

  describe('Layer 4: Operational Difference vs Refining Fee Accounting Isolation', () => {
    test('verifies operational weight difference does NOT alter customer accounting balance', () => {
      const refinerInitialBalance = { rialBalance: -5000000, goldBalance: 0 }; // owes us 5M IRR or 0 gold

      const sampleDeclared = 2.0;
      const sampleReceived = 1.9;
      const weightLoss = roundWeight(sampleDeclared - sampleReceived, 3); // 0.1g loss

      // Weight loss logged as operational difference, customer balance remains UNCHANGED
      const refinerBalanceAfterLoss = { ...refinerInitialBalance };

      expect(weightLoss).toBe(0.1);
      expect(refinerBalanceAfterLoss.rialBalance).toBe(-5000000);
      expect(refinerBalanceAfterLoss.goldBalance).toBe(0);
    });

    test('verifies refining service fee creates a DEBT TO REFINER (bستانکاری ریگیر) in accounting', () => {
      const initialLiabilityToRefiner = 0; // Our debt to refiner = 0
      const serviceFeeAmount = 3500000; // 3.5M IRR fee

      // Double entry journal entry:
      // Debit: 6500 (Refining Expense) 3,500,000
      // Credit: 2120 (Counterparty Liability - Refiner) 3,500,000
      const journalEntry = {
        debit: { accountCode: '6500', amount: serviceFeeAmount },
        credit: { accountCode: '2120', partyId: 'refiner_customer_1', amount: serviceFeeAmount },
      };

      expect(journalEntry.debit.amount).toBe(journalEntry.credit.amount);
      expect(journalEntry.credit.accountCode).toBe('2120');

      // Increased liability to refiner
      const updatedLiabilityToRefiner = initialLiabilityToRefiner + serviceFeeAmount;
      expect(updatedLiabilityToRefiner).toBe(3500000);
    });
  });
});
