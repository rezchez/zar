import { describe, expect, it } from 'bun:test';
import {
  canTransitionChequeStatus,
  mapCheckRecord,
  CHEQUE_STATUS_LABELS,
  type CheckStatus,
} from '@/lib/check';

describe('Cheque Lifecycle & Status Transitions', () => {
  it('supports all required cheque states including clearing and returned_to_drawer', () => {
    const requiredStates: CheckStatus[] = [
      'draft',
      'issued',
      'delivered',
      'pending',
      'due',
      'clearing',
      'cleared',
      'returned',
      'returned_to_drawer',
      'cancelled',
    ];

    for (const st of requiredStates) {
      expect(CHEQUE_STATUS_LABELS[st]).toBeDefined();
      expect(typeof CHEQUE_STATUS_LABELS[st]).toBe('string');
    }

    expect(CHEQUE_STATUS_LABELS.returned).toContain('کسر موجودی');
    expect(CHEQUE_STATUS_LABELS.clearing).toContain('کلر');
  });

  it('allows valid progressive transitions including clearing and returned_to_drawer', () => {
    // draft -> issued
    expect(canTransitionChequeStatus('draft', 'issued').allowed).toBe(true);

    // issued -> delivered
    expect(canTransitionChequeStatus('issued', 'delivered').allowed).toBe(true);

    // delivered -> pending
    expect(canTransitionChequeStatus('delivered', 'pending').allowed).toBe(true);

    // pending -> due
    expect(canTransitionChequeStatus('pending', 'due').allowed).toBe(true);

    // pending -> clearing (sent to clearing bank)
    expect(canTransitionChequeStatus('pending', 'clearing').allowed).toBe(true);

    // clearing -> cleared (bank collected/cleared)
    expect(canTransitionChequeStatus('clearing', 'cleared').allowed).toBe(true);

    // clearing -> returned (bank bounced)
    expect(canTransitionChequeStatus('clearing', 'returned').allowed).toBe(true);

    // returned -> returned_to_drawer (returned to drawer / customer)
    expect(canTransitionChequeStatus('returned', 'returned_to_drawer').allowed).toBe(true);

    // pending -> returned_to_drawer
    expect(canTransitionChequeStatus('pending', 'returned_to_drawer').allowed).toBe(true);

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

  it('supports intentional reversal from cleared state when allowReversal is specified', () => {
    // Reversal from cleared to pending (for receivable cheques)
    expect(canTransitionChequeStatus('cleared', 'pending', 'receivable', { allowReversal: true }).allowed).toBe(true);

    // Reversal from cleared to clearing (for receivable cheques)
    expect(canTransitionChequeStatus('cleared', 'clearing', 'receivable', { allowReversal: true }).allowed).toBe(true);

    // Reversal from cleared to returned_to_drawer
    expect(canTransitionChequeStatus('cleared', 'returned_to_drawer', 'receivable', { allowReversal: true }).allowed).toBe(true);

    // Payable cheque cleared -> pending
    expect(canTransitionChequeStatus('cleared', 'pending', 'payable').allowed).toBe(true);

    // Even with allowReversal, cleared cannot go to draft
    expect(canTransitionChequeStatus('cleared', 'draft', 'receivable', { allowReversal: true }).allowed).toBe(false);
  });

  it('maps check record with extended accounting fields and image', () => {
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
      image: 'chk_scan.webp',
    };

    const mapped = mapCheckRecord(raw);

    expect(mapped.id).toBe('chk_123');
    expect(mapped.status).toBe('cleared');
    expect(mapped.chequeType).toBe('payable');
    expect(mapped.dueDateJalali).toBe('1405/06/15');
    expect(mapped.clearedDateJalali).toBe('1405/06/15');
    expect(mapped.payableAccountId).toBe('coa_2110');
    expect(mapped.journalEntryId).toBe('je_999');
    expect(mapped.image).toBe('chk_scan.webp');
    expect(mapped.imageUrl).toBe('/api/checks/chk_123/image');
  });
});
