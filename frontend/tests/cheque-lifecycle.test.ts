import { describe, expect, it } from 'bun:test';
import {
  canTransitionChequeStatus,
  mapCheckRecord,
  CHEQUE_STATUS_LABELS,
  type CheckStatus,
} from '@/lib/check';

describe('Cheque Lifecycle & Status Transitions', () => {
  it('supports all 8 required cheque states', () => {
    const requiredStates: CheckStatus[] = [
      'draft',
      'issued',
      'delivered',
      'pending',
      'due',
      'cleared',
      'returned',
      'cancelled',
    ];

    for (const st of requiredStates) {
      expect(CHEQUE_STATUS_LABELS[st]).toBeDefined();
      expect(typeof CHEQUE_STATUS_LABELS[st]).toBe('string');
    }
  });

  it('allows valid progressive transitions', () => {
    // draft -> issued
    expect(canTransitionChequeStatus('draft', 'issued').allowed).toBe(true);

    // issued -> delivered
    expect(canTransitionChequeStatus('issued', 'delivered').allowed).toBe(true);

    // delivered -> pending
    expect(canTransitionChequeStatus('delivered', 'pending').allowed).toBe(true);

    // pending -> due
    expect(canTransitionChequeStatus('pending', 'due').allowed).toBe(true);

    // due -> cleared
    expect(canTransitionChequeStatus('due', 'cleared').allowed).toBe(true);

    // cleared -> returned
    expect(canTransitionChequeStatus('cleared', 'returned').allowed).toBe(true);

    // returned -> pending (re-submission)
    expect(canTransitionChequeStatus('returned', 'pending').allowed).toBe(true);
  });

  it('blocks illegal status jumps and transitions from terminal states', () => {
    // cancelled is terminal
    expect(canTransitionChequeStatus('cancelled', 'issued').allowed).toBe(false);
    expect(canTransitionChequeStatus('cancelled', 'cleared').allowed).toBe(false);

    // cleared cannot jump back to draft
    expect(canTransitionChequeStatus('cleared', 'draft').allowed).toBe(false);
  });

  it('maps check record with extended accounting fields', () => {
    const raw = {
      id: 'chk_123',
      bankAccount: 'bnk_1',
      customer: 'cst_1',
      amount: 15000000,
      currency: 'IRR',
      sayadId: '1234567890123456',
      description: 'بابت تسویه',
      chequeType: 'payable',
      dueDate: '2026-09-05',
      dueDateJalali: '1405/06/15',
      status: 'cleared',
      clearedDate: '2026-09-05',
      clearedDateJalali: '1405/06/15',
      payableAccountId: 'coa_2110',
      journalEntryId: 'je_999',
    };

    const mapped = mapCheckRecord(raw);

    expect(mapped.id).toBe('chk_123');
    expect(mapped.status).toBe('cleared');
    expect(mapped.chequeType).toBe('payable');
    expect(mapped.dueDateJalali).toBe('1405/06/15');
    expect(mapped.clearedDateJalali).toBe('1405/06/15');
    expect(mapped.payableAccountId).toBe('coa_2110');
    expect(mapped.journalEntryId).toBe('je_999');
  });
});
