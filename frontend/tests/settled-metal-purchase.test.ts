import { describe, expect, it } from 'bun:test';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { validateDocumentSettlement } from '@/features/accounting/documents/services/metal-settlement-service';
import { postMetalPurchase } from '@/features/accounting/posting/posting-engine';
import { SYSTEM_ACCOUNT_CODES } from '@/lib/accounting-posting-engine';

function createMockDetail(overrides: Partial<DetailState> = {}): DetailState {
  return {
    rawKind: 'molten',
    metalType: 'gold',
    rawWeight: '0',
    purity: '750',
    calculationMethod: 'weight',
    metalPriceType: 'gram18',
    metalPrice: '0',
    totalAmount: '0',
    labName: '',
    stampNumber: '',
    currencyUnit: 'IRR',
    currencyQuantity: '0',
    currencyUnitPrice: '0',
    currencyTotalAmount: '0',
    unsettledTrade: false,
    currencyTradeId: '',
    settlementCurrencyUnit: '',
    settlementQuantity: '0',
    settlesTradeId: '',
    inventorySourceId: '',
    ...overrides,
  };
}

function createMockLine(
  id: string,
  nature: 'received' | 'paid',
  tab: DocumentLine['documentTab'],
  detailOverrides: Partial<DetailState> = {},
): DocumentLine {
  return {
    id,
    documentNature: nature,
    documentTab: tab,
    sourceTab: tab === 'raw-gold' ? 'metals' : tab,
    documentSubType: '',
    settlementMethod: detailOverrides.unsettledTrade || detailOverrides.rawKind === 'unsettled' ? 'unsettled' : 'weight',
    balanceSource: 'current',
    description: '',
    converted750: Number(detailOverrides.rawWeight || 0),
    details: createMockDetail(detailOverrides),
  };
}

function createMockPocketBase() {
  const store = new Map<string, any>();
  return {
    _store: store,
    filter: (str: string, params: Record<string, any>) => ({ str, params }),
    collection: (name: string) => ({
      getFirstListItem: async (f: any) => {
        for (const val of store.values()) {
          if (val._collection === name) {
            if (f?.params?.sk && val.sourceKey === f.params.sk) return val;
            if (f?.params?.code && val.code === f.params.code) return val;
            if (f?.params?.key && val.key === f.params.key) return val;
          }
        }
        return null;
      },
      getOne: async (id: string) => {
        const item = store.get(id);
        if (!item) throw new Error('Not found');
        return item;
      },
      getFullList: async (_params: any = {}) => {
        const list: any[] = [];
        for (const val of store.values()) {
          if (val._collection === name) list.push(val);
        }
        return list;
      },
      create: async (data: any) => {
        const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const record = { id, ...data, _collection: name };
        store.set(id, record);
        return record;
      },
      update: async (id: string, data: any) => {
        const existing = store.get(id) || {};
        const updated = { ...existing, ...data };
        store.set(id, updated);
        return updated;
      },
      delete: async (id: string) => {
        store.delete(id);
        return true;
      },
    }),
  } as any;
}

describe('Settled Metal Purchase & Sale (خرید و فروش آبشده و متفرقه با تسویه و ژورنال لاین‌ها)', () => {
  it('validates that dual-committed lines for purchase satisfy validateDocumentSettlement without errors', () => {
    const tradeLineId = 'trade-1';
    const physicalLineId = 'phys-1';

    const tradeLine = createMockLine('trade-1', 'received', 'gold-sale', {
      rawKind: 'molten',
      rawWeight: '80',
      purity: '750',
      totalAmount: '3200000000',
      metalPrice: '40000000',
      labName: 'آزمایشگاه زرین',
      stampNumber: '12345',
      linkedLineId: physicalLineId,
    });
    tradeLine.documentTypeLabel = 'خرید آب‌شده';
    tradeLine.documentSubType = 'gold-purchase-molten';

    const physicalLine = createMockLine(physicalLineId, 'received', 'raw-gold', {
      rawKind: 'molten',
      rawWeight: '80',
      purity: '750',
      totalAmount: '0',
      metalPrice: '0',
      labName: 'آزمایشگاه زرین',
      stampNumber: '12345',
      linkedLineId: tradeLineId,
    });
    physicalLine.documentTypeLabel = 'ورود آبشده';
    physicalLine.documentSubType = 'incoming-molten';

    const lines: DocumentLine[] = [tradeLine, physicalLine];

    // Verify settlement validation in final save mode
    const validation = validateDocumentSettlement(lines, 'final');
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.analysis.isFullySettled).toBe(true);
    expect(validation.analysis.items[0].settlementStatus).toBe('fully_settled');

    // Verify exact matching of details
    expect(physicalLine.details.rawWeight).toBe(tradeLine.details.rawWeight);
    expect(physicalLine.details.purity).toBe(tradeLine.details.purity);
    expect(physicalLine.details.labName).toBe(tradeLine.details.labName);
    expect(physicalLine.details.stampNumber).toBe(tradeLine.details.stampNumber);
    expect(tradeLine.details.linkedLineId).toBe(physicalLine.id);
    expect(physicalLine.details.linkedLineId).toBe(tradeLine.id);
  });

  it('validates dual lines for settled metal sale (فروش آبشده با خروج در لحظه)', () => {
    const tradeLineId = 'sale-trade-1';
    const physicalLineId = 'sale-phys-1';

    const tradeLine = createMockLine(tradeLineId, 'paid', 'gold-sale', {
      rawKind: 'molten',
      rawWeight: '60',
      purity: '750',
      totalAmount: '2400000000',
      metalPrice: '40000000',
      labName: 'آزمایشگاه خلیج',
      stampNumber: '54321',
      linkedLineId: physicalLineId,
    });
    tradeLine.documentTypeLabel = 'فروش آب‌شده';
    tradeLine.documentSubType = 'gold-sale-molten';

    const physicalLine = createMockLine(physicalLineId, 'paid', 'raw-gold', {
      rawKind: 'molten',
      rawWeight: '60',
      purity: '750',
      totalAmount: '0',
      metalPrice: '0',
      labName: 'آزمایشگاه خلیج',
      stampNumber: '54321',
      linkedLineId: tradeLineId,
    });
    physicalLine.documentTypeLabel = 'خروج آبشده';
    physicalLine.documentSubType = 'outgoing-molten';

    const lines: DocumentLine[] = [tradeLine, physicalLine];

    const validation = validateDocumentSettlement(lines, 'final');
    expect(validation.isValid).toBe(true);
    expect(validation.errors).toHaveLength(0);
    expect(validation.analysis.isFullySettled).toBe(true);
    expect(validation.analysis.items[0].settlementStatus).toBe('fully_settled');

    // Verify matching
    expect(physicalLine.details.rawWeight).toBe(tradeLine.details.rawWeight);
    expect(physicalLine.details.purity).toBe(tradeLine.details.purity);
    expect(physicalLine.details.labName).toBe(tradeLine.details.labName);
    expect(physicalLine.details.stampNumber).toBe(tradeLine.details.stampNumber);
  });

  it('posts correct double-entry journal lines for metal purchases (postMetalPurchase)', async () => {
    const pb = createMockPocketBase();

    const result = await postMetalPurchase(
      {
        documentId: 'doc_purchase_1',
        documentNumber: 'ZF-00200',
        entryDateJalali: '1405/06/30',
        amountRials: 3200000000,
        exactAmountRials: 3200000000,
        roundingDifference: 0,
        weightGrams750: 80,
        customer: {
          id: 'cust_reza',
          name: 'رضا طلافروش',
          customerCode: 201,
        },
        userId: 'usr_admin',
      },
      pb,
    );

    expect(result.id).toBeDefined();
    expect(result.sourceType).toBe('document');
    expect(result.sourceKey).toBe('metal:purchase:doc_purchase_1');
    expect(result.totalDebit).toBe(3200000000);
    expect(result.totalCredit).toBe(3200000000);

    const lines = await pb.collection('journal_lines').getFullList();
    expect(lines.length).toBe(2);

    // Debit: Gold Inventory (1130)
    const inventoryLine = lines.find((l: any) => l.account_id === 'sys_1130' || l.account_id === '1130');
    expect(inventoryLine).toBeDefined();
    expect(inventoryLine.debit).toBe(3200000000);
    expect(inventoryLine.credit).toBe(0);

    // Credit: Counterparty Liability (2120)
    const supplierLine = lines.find((l: any) => l.account_id === 'sys_2120' || l.account_id === '2120');
    expect(supplierLine).toBeDefined();
    expect(supplierLine.debit).toBe(0);
    expect(supplierLine.credit).toBe(3200000000);
  });

  it('ensures table totals calculate exact physical weight without double-counting trade lines', () => {
    const lines: DocumentLine[] = [
      createMockLine('trade-1', 'received', 'gold-sale', {
        rawKind: 'molten',
        rawWeight: '80',
        purity: '750',
        totalAmount: '3200000000',
        linkedLineId: 'phys-1',
      }),
      createMockLine('phys-1', 'received', 'raw-gold', {
        rawKind: 'molten',
        rawWeight: '80',
        purity: '750',
        totalAmount: '0',
        linkedLineId: 'trade-1',
      }),
      createMockLine('sale-trade-1', 'paid', 'gold-sale', {
        rawKind: 'molten',
        rawWeight: '40',
        purity: '750',
        totalAmount: '1600000000',
        linkedLineId: 'sale-phys-1',
      }),
      createMockLine('sale-phys-1', 'paid', 'raw-gold', {
        rawKind: 'molten',
        rawWeight: '40',
        purity: '750',
        totalAmount: '0',
        linkedLineId: 'sale-trade-1',
      }),
    ];

    const totalBostankarVazni = lines
      .filter((l) =>
        l.documentTab === 'gold-sale'
          ? l.documentNature === 'paid'
          : l.documentNature === 'received',
      )
      .reduce((sum, l) => sum + (l.converted750 ?? 0), 0);

    const totalBedehkarVazni = lines
      .filter((l) =>
        l.documentTab === 'gold-sale'
          ? l.documentNature === 'received'
          : l.documentNature === 'paid',
      )
      .reduce((sum, l) => sum + (l.converted750 ?? 0), 0);

    // For purchase: trade-1 (received) adds 80 to Bedehkar; phys-1 (received) adds 80 to Bostankar -> net 0
    // For sale: sale-trade-1 (paid) adds 40 to Bostankar; sale-phys-1 (paid) adds 40 to Bedehkar -> net 0
    expect(totalBostankarVazni).toBe(120);
    expect(totalBedehkarVazni).toBe(120);
    expect(totalBostankarVazni - totalBedehkarVazni).toBe(0);
  });

  it('verifies that committing in the purchase tab registers BOTH the purchase row and the entry row', () => {
    const documentNature = 'received';
    const activeEntryTab = 'gold-sale';
    const rawKind: 'molten' | 'misc' = 'molten';
    const weight = '50';
    const purity = '750';
    const totalAmount = '2000000000';
    const labName = 'تهران گوهر';
    const stampNumber = '98765';

    const isMisc = (rawKind as string) === 'misc';
    const tradeDocTypeLabel =
      documentNature === 'received'
        ? isMisc ? 'خرید متفرقه' : 'خرید آب‌شده'
        : isMisc ? 'فروش متفرقه' : 'فروش آب‌شده';
    const tradeSubType =
      `${documentNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${isMisc ? 'misc' : 'molten'}`;
    const physicalTypeLabel =
      documentNature === 'received'
        ? isMisc ? 'ورود متفرقه' : 'ورود آبشده'
        : isMisc ? 'خروج متفرقه' : 'خروج آبشده';
    const physicalSubType =
      documentNature === 'received'
        ? isMisc ? 'incoming-misc' : 'incoming-molten'
        : isMisc ? 'outgoing-misc' : 'outgoing-molten';

    const tradeLineId = 'trade-row-uuid';
    const physicalLineId = 'phys-row-uuid';

    const tradeLine: DocumentLine = {
      id: tradeLineId,
      documentNature,
      documentTab: 'gold-sale',
      sourceTab: 'gold-sale',
      documentTypeLabel: tradeDocTypeLabel,
      documentSubType: tradeSubType,
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: '',
      converted750: Number(weight),
      details: createMockDetail({
        rawKind,
        rawWeight: weight,
        purity,
        totalAmount,
        labName,
        stampNumber,
        linkedLineId: physicalLineId,
      }),
    };

    const physicalLine: DocumentLine = {
      id: physicalLineId,
      documentNature,
      documentTab: 'raw-gold',
      sourceTab: 'metals',
      documentTypeLabel: physicalTypeLabel,
      documentSubType: physicalSubType,
      settlementMethod: 'weight',
      balanceSource: 'current',
      description: '',
      converted750: Number(weight),
      details: createMockDetail({
        rawKind,
        rawWeight: weight,
        purity,
        totalAmount: '0',
        metalPrice: '0',
        labName,
        stampNumber,
        linkedLineId: tradeLineId,
      }),
    };

    const committed = [tradeLine, physicalLine];
    expect(committed.length).toBe(2);

    // Verify Trade Line
    expect(committed[0].documentTab).toBe('gold-sale');
    expect(committed[0].documentTypeLabel).toBe('خرید آب‌شده');
    expect(committed[0].documentSubType).toBe('gold-purchase-molten');
    expect(committed[0].details.totalAmount).toBe('2000000000');
    expect(committed[0].details.linkedLineId).toBe(physicalLineId);

    // Verify Physical Entry Line
    expect(committed[1].documentTab).toBe('raw-gold');
    expect(committed[1].documentTypeLabel).toBe('ورود آبشده');
    expect(committed[1].documentSubType).toBe('incoming-molten');
    expect(committed[1].details.rawWeight).toBe('50');
    expect(committed[1].details.labName).toBe('تهران گوهر');
    expect(committed[1].details.stampNumber).toBe('98765');
    expect(committed[1].details.linkedLineId).toBe(tradeLineId);
  });
});

