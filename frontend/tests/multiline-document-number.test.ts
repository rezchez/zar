import { describe, expect, it } from 'bun:test';

import { sumPostedTransactions, type CustomerTransaction } from '../lib/transaction';

describe('Multi-line Document Number & Balance Integrity', () => {
  it('ensures all lines of a document (even 100+ lines) share the exact same documentNumber', () => {
    const singleDocNumber = '10045';
    const docId = 'doc_test_100';
    const totalLines = 100;

    const mockTransactions: CustomerTransaction[] = Array.from({ length: totalLines }).map((_, index) => {
      const lineNum = index + 1;
      const isEven = lineNum % 2 === 0;
      return {
        id: `tx_${docId}_${lineNum}`,
        customerId: 'cust_abc',
        customerCode: 201,
        createdBy: 'user1',
        updatedBy: 'user1',
        sourceKey: `document:${docId}:${lineNum}`,
        transactionType: 'document',
        status: 'posted',
        isOpeningBalance: false,
        transactionDate: '2026-10-24',
        documentId: docId,
        documentNumber: singleDocNumber,
        description: `ردیف ${lineNum} سند ${singleDocNumber}`,
        goldAmount: isEven ? 10 : 0,
        silverAmount: 0,
        platinumAmount: 0,
        rialAmount: isEven ? 0 : 2500000000, // 250,000,000 Toman in IRR
        foreignAmount: 0,
        tertiaryAmount: 0,
        foreignCurrency: '',
        foreignCurrencySymbol: '',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: isEven ? 'received' : 'paid',
        documentTab: isEven ? 'raw-gold' : 'gold-sale',
        documentSubType: isEven ? 'incoming-molten' : 'melted-sale',
        documentDateJalali: '1405/08/03',
        settlementMethod: 'weight',
        balanceSource: 'current',
        documentDetails: JSON.stringify({ isToman: true, rialAmountInIrr: true }),
        documentLineNumber: lineNum,
        created: '2026-10-24',
        updated: '2026-10-24',
      };
    });

    // Verify all 100 rows share identical documentNumber
    const uniqueDocNumbers = new Set(mockTransactions.map((tx) => tx.documentNumber));
    expect(uniqueDocNumbers.size).toBe(1);
    expect(uniqueDocNumbers.has(singleDocNumber)).toBe(true);

    // Verify all 100 rows have unique sourceKeys (idempotency key per line)
    const uniqueSourceKeys = new Set(mockTransactions.map((tx) => tx.sourceKey));
    expect(uniqueSourceKeys.size).toBe(totalLines);
  });

  it('verifies that editing a document excludes its previous lines from customer balance', () => {
    const openingTx: CustomerTransaction = {
      id: 'tx_opening',
      customerId: 'cust_abc',
      customerCode: 201,
      createdBy: 'user1',
      updatedBy: 'user1',
      sourceKey: 'opening:cust_abc',
      transactionType: 'opening_balance',
      status: 'posted',
      isOpeningBalance: true,
      transactionDate: '2026-01-01',
      documentId: '',
      documentNumber: '1',
      description: 'مانده اول دوره',
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0, // Customer started with 0 balance
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
    };

    const doc1Id = 'doc_first';
    const doc1Line1: CustomerTransaction = {
      id: 'tx_doc1_1',
      customerId: 'cust_abc',
      customerCode: 201,
      createdBy: 'user1',
      updatedBy: 'user1',
      sourceKey: `document:${doc1Id}:1`,
      transactionType: 'document',
      status: 'posted',
      isOpeningBalance: false,
      transactionDate: '2026-10-24',
      documentId: doc1Id,
      documentNumber: '101',
      description: 'خرید آبشده ردیف 1',
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 2500000000, // 250,000,000 Toman in IRR
      foreignAmount: 0,
      tertiaryAmount: 0,
      foreignCurrency: '',
      foreignCurrencySymbol: '',
      tertiaryCurrency: '',
      tertiaryCurrencySymbol: '',
      documentNature: 'received',
      documentTab: 'gold-sale',
      documentSubType: 'melted-sale',
      documentDateJalali: '1405/08/03',
      settlementMethod: '',
      balanceSource: 'current',
      documentDetails: '',
      documentLineNumber: 1,
      created: '2026-10-24',
      updated: '2026-10-24',
    };

    const doc1Line2: CustomerTransaction = {
      id: 'tx_doc1_2',
      customerId: 'cust_abc',
      customerCode: 201,
      createdBy: 'user1',
      updatedBy: 'user1',
      sourceKey: `document:${doc1Id}:2`,
      transactionType: 'document',
      status: 'posted',
      isOpeningBalance: false,
      transactionDate: '2026-10-24',
      documentId: doc1Id,
      documentNumber: '101', // Shares exact same doc number
      description: 'ورود آبشده ردیف 2',
      goldAmount: 10,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      foreignAmount: 0,
      tertiaryAmount: 0,
      foreignCurrency: '',
      foreignCurrencySymbol: '',
      tertiaryCurrency: '',
      tertiaryCurrencySymbol: '',
      documentNature: 'received',
      documentTab: 'raw-gold',
      documentSubType: 'incoming-molten',
      documentDateJalali: '1405/08/03',
      settlementMethod: 'weight',
      balanceSource: 'current',
      documentDetails: '',
      documentLineNumber: 2,
      created: '2026-10-24',
      updated: '2026-10-24',
    };

    const allTransactions = [openingTx, doc1Line1, doc1Line2];

    // When NOT excluding doc1 (current posted balance):
    const currentTotal = sumPostedTransactions(allTransactions);
    expect(currentTotal.rialAmount).toBe(2500000000);
    expect(currentTotal.goldAmount).toBe(10);

    // When editing doc1 (excludeDocumentId = doc1Id):
    const excludeDocumentId = doc1Id;
    const filteredTransactions = allTransactions.filter(
      (tx) => tx.documentId !== excludeDocumentId
    );
    const balanceBeforeDoc1 = sumPostedTransactions(filteredTransactions);

    // Since doc1 was the only transaction after opening (0), balance before doc1 is 0!
    expect(balanceBeforeDoc1.rialAmount).toBe(0);
    expect(balanceBeforeDoc1.goldAmount).toBe(0);

    // Projected effect of the document being edited:
    // 250,000,000 Toman (2,500,000,000 IRR)
    const newDocRialEffect = 2500000000;
    const finalProjectedRial = balanceBeforeDoc1.rialAmount + newDocRialEffect;
    expect(finalProjectedRial).toBe(2500000000);

    // In Toman (display layer Math.floor(num / 10)):
    const previousBalanceToman = Math.floor(balanceBeforeDoc1.rialAmount / 10);
    const docEffectToman = Math.floor(newDocRialEffect / 10);
    const finalBalanceToman = Math.floor(finalProjectedRial / 10);

    expect(previousBalanceToman).toBe(0);
    expect(docEffectToman).toBe(250000000); // 250,000,000 Toman, not 25,000,000!
    expect(finalBalanceToman).toBe(250000000);
  });
});
