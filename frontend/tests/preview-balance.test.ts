import { describe, expect, it } from 'bun:test';

import { sumPostedTransactions, type CustomerTransaction } from '../lib/transaction';

describe('Preview Balance Calculations', () => {
  it('correctly calculates previous balances from posted transactions', () => {
    const mockTransactions: CustomerTransaction[] = [
      {
        id: 'tx1',
        customerId: 'cust1',
        customerCode: 101,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'opening:cust1',
        transactionType: 'opening_balance',
        status: 'posted',
        isOpeningBalance: true,
        transactionDate: '2026-01-01',
        documentId: '',
        documentNumber: '1',
        description: 'مانده اول دوره',
        goldAmount: 100,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: 100000000,
        foreignAmount: 0,
        tertiaryAmount: 0,
        foreignCurrency: '',
        foreignCurrencySymbol: '',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: 'received',
        documentTab: '',
        documentSubType: '',
        documentDateJalali: '1404/10/11',
        settlementMethod: '',
        balanceSource: '',
        documentDetails: '',
        documentLineNumber: 1,
        created: '2026-01-01',
        updated: '2026-01-01',
      },
      {
        id: 'tx2',
        customerId: 'cust1',
        customerCode: 101,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: 'doc:1:1',
        transactionType: 'document',
        status: 'posted',
        isOpeningBalance: false,
        transactionDate: '2026-01-02',
        documentId: 'doc1',
        documentNumber: '2',
        description: 'خرید طلا',
        goldAmount: 20,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: -25000000,
        foreignAmount: 0,
        tertiaryAmount: 0,
        foreignCurrency: '',
        foreignCurrencySymbol: '',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: 'paid',
        documentTab: 'raw-gold',
        documentSubType: 'incoming-molten',
        documentDateJalali: '1404/10/12',
        settlementMethod: 'weight',
        balanceSource: 'current',
        documentDetails: '',
        documentLineNumber: 1,
        created: '2026-01-02',
        updated: '2026-01-02',
      },
    ];

    const previousTotals = sumPostedTransactions(mockTransactions);
    expect(previousTotals.rialAmount).toBe(75000000);
    expect(previousTotals.goldAmount).toBe(120);

    const lineEffect = {
      rial: -25000000,
      gold: -3.2,
    };

    const projected = {
      rial: previousTotals.rialAmount + lineEffect.rial,
      gold: previousTotals.goldAmount + lineEffect.gold,
    };

    expect(projected.rial).toBe(50000000);
    expect(projected.gold).toBe(116.8);
  });
});
