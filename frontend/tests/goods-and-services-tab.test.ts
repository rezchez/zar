import { describe, expect, it, test } from 'bun:test';
import {
  sanitizeDocumentLine,
  sanitizeLineDetailsForTab,
  getLineDocumentTypeLabel,
  getLineFinancialValues,
  faNumber,
} from '@/features/accounting/documents/utils/document-helpers';
import {
  isLineReady,
  validateLine,
  createLine,
} from '@/features/accounting/documents/hooks/useDocumentLines';
import { postGoodsServiceJournalEntry } from '@/lib/accounting-posting-engine';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

function createMockPocketBase(accounts: Record<string, any>) {
  const store = new Map<string, any>();
  for (const [id, account] of Object.entries(accounts)) {
    store.set(id, { id, _collection: 'chart_of_accounts', ...account });
  }

  return {
    _store: store,
    filter: (template: string, params: Record<string, any>) => ({ template, params }),
    collection: (name: string) => ({
      getOne: async (id: string) => {
        const record = store.get(id);
        if (!record || record._collection !== name) throw new Error('Record not found');
        return record;
      },
      getFirstListItem: async (filter: any) => {
        for (const record of store.values()) {
          if (record._collection !== name) continue;
          if (filter?.params?.sourceKey && record.sourceKey === filter.params.sourceKey) return record;
          if (filter?.params?.code && record.code === filter.params.code) return record;
        }
        throw new Error('Record not found');
      },
      getFullList: async () => [...store.values()].filter((record) => record._collection === name),
      create: async (payload: any) => {
        const id = `rec_${store.size}`;
        const record = { id, _collection: name, ...payload };
        store.set(id, record);
        return record;
      },
      update: async (id: string, payload: any) => {
        const record = { ...store.get(id), ...payload };
        store.set(id, record);
        return record;
      },
      delete: async (id: string) => store.delete(id),
    }),
  } as any;
}

describe('Goods and Services (کالا و خدمات) Tab & Accounting Tests', () => {
  describe('1. DetailState Isolation & Sanitization', () => {
    test('sanitizeLineDetailsForTab preserves goods details and completely clears precious metal weight', () => {
      const rawDetails = {
        goodsServiceType: 'goods' as const,
        goodsServiceOperation: 'buy' as const,
        goodsServiceCategory: 'resin_casting',
        goodsServiceAccountId: 'coa_group_goods_resin',
        goodsServiceAccountCode: '113040',
        goodsServiceAccountName: 'مواد اولیه و رزین ریخته‌گری',
        goodsServiceAccountPath: '/1000/1100/1130/113040/',
        itemName: 'رزین ریخته‌گری فوتون',
        quantity: '2',
        unit: 'لیتر',
        unitPrice: '15000000',
        totalAmount: '30000000',
        rawWeight: '12.450', // alien field from metals tab
        purity: '750', // alien field
        coinName: 'سکه تمام', // alien field
      };

      const sanitized = sanitizeLineDetailsForTab('goods', rawDetails, 'IRR');

      expect(sanitized.goodsServiceType).toBe('goods');
      expect(sanitized.goodsServiceOperation).toBe('buy');
      expect(sanitized.goodsServiceAccountId).toBe('coa_group_goods_resin');
      expect(sanitized.goodsServiceAccountCode).toBe('113040');
      expect(sanitized.goodsServiceAccountName).toBe('مواد اولیه و رزین ریخته‌گری');
      expect(sanitized.itemName).toBe('رزین ریخته‌گری فوتون');
      expect(sanitized.quantity).toBe('2');
      expect(sanitized.unit).toBe('لیتر');
      expect(sanitized.unitPrice).toBe('15000000');
      expect(sanitized.totalAmount).toBe('30000000');
      // Must NOT leak metal weight/purity
      expect(sanitized.rawWeight).toBe('');
      expect(sanitized.purity).toBe('');
    });

    test('sanitizeLineDetailsForTab preserves service details for 3D design', () => {
      const rawDetails = {
        goodsServiceType: 'service' as const,
        goodsServiceOperation: 'sell' as const,
        goodsServiceAccountId: 'sys_4240',
        goodsServiceAccountCode: '4240',
        goodsServiceAccountName: 'اجرت طراحی، ری‌گیری و حکاکی',
        goodsServiceAccountPath: '/4000/4200/4240/',
        itemName: 'طراحی سه‌بعدی انگشتر اسلیمی',
        quantity: '1',
        unit: 'پروژه',
        unitPrice: '25000000',
        totalAmount: '25000000',
      };

      const sanitized = sanitizeLineDetailsForTab('goods', rawDetails, 'IRR');

      expect(sanitized.goodsServiceType).toBe('service');
      expect(sanitized.goodsServiceOperation).toBe('sell');
      expect(sanitized.goodsServiceAccountId).toBe('sys_4240');
      expect(sanitized.itemName).toBe('طراحی سه‌بعدی انگشتر اسلیمی');
      expect(sanitized.unit).toBe('پروژه');
      expect(sanitized.totalAmount).toBe('25000000');
      expect(sanitized.rawWeight).toBe('');
      expect(sanitized.purity).toBe('');
    });
  });

  describe('2. Document Type Labels & Subtypes', () => {
    test('getLineDocumentTypeLabel generates accurate labels for buying vs selling goods and services', () => {
      expect(getLineDocumentTypeLabel('paid', 'goods', undefined, undefined, undefined, undefined, 'goods-sell')).toBe('فروش کالا');
      expect(getLineDocumentTypeLabel('received', 'goods', undefined, undefined, undefined, undefined, 'goods-buy')).toBe('خرید کالا');
      expect(getLineDocumentTypeLabel('paid', 'goods', undefined, undefined, undefined, undefined, 'service-sell')).toBe('ارائه خدمات');
      expect(getLineDocumentTypeLabel('received', 'goods', undefined, undefined, undefined, undefined, 'service-buy')).toBe('خرید خدمات');
    });

    test('createLine initializes goods tab correctly', () => {
      const buyLine = createLine('received', 'goods');
      expect(buyLine.documentTab).toBe('goods');
      expect(buyLine.sourceTab).toBe('goods');
      expect(buyLine.documentSubType).toBe('goods-buy');

      const sellLine = createLine('paid', 'goods');
      expect(sellLine.documentTab).toBe('goods');
      expect(sellLine.sourceTab).toBe('goods');
      expect(sellLine.documentSubType).toBe('goods-sell');
    });
  });

  describe('3. Financial Values & Debtor/Creditor Balances', () => {
    test('getLineFinancialValues calculates debit for selling goods/services and credit for buying', () => {
      const sellLine = {
        documentTab: 'goods',
        documentNature: 'paid' as const,
        details: {
          totalAmount: '50000000',
        },
      };

      const buyLine = {
        documentTab: 'goods',
        documentNature: 'received' as const,
        details: {
          totalAmount: '30000000',
        },
      };

      const sellVal = getLineFinancialValues(sellLine);
      expect(sellVal.hasValue).toBe(true);
      expect(sellVal.debit).toBe(50000000);
      expect(sellVal.credit).toBe(0);

      const buyVal = getLineFinancialValues(buyLine);
      expect(buyVal.hasValue).toBe(true);
      expect(buyVal.debit).toBe(0);
      expect(buyVal.credit).toBe(30000000);
    });
  });

  describe('4. Line Validation & Ready State', () => {
    test('validateLine rejects incomplete goods line and passes complete line', () => {
      const incompleteLine = createLine('received', 'goods');
      incompleteLine.details.itemName = '';
      incompleteLine.details.goodsServiceAccountId = '';
      incompleteLine.details.quantity = '';
      incompleteLine.details.totalAmount = '';

      expect(validateLine(incompleteLine)).toContain('نام کالا یا خدمت');

      incompleteLine.details.itemName = 'رزین فوتون';
      expect(validateLine(incompleteLine)).toContain('سرفصل کالا یا خدمت');

      incompleteLine.details.goodsServiceAccountId = 'coa_group_goods_resin';
      incompleteLine.details.quantity = '0';
      expect(validateLine(incompleteLine)).toContain('باید بیشتر از صفر باشد');

      incompleteLine.details.quantity = '2';
      incompleteLine.details.totalAmount = '0';
      expect(validateLine(incompleteLine)).toContain('باید بیشتر از صفر باشد');

      incompleteLine.details.totalAmount = '24000000';
      expect(validateLine(incompleteLine)).toBe('');
      expect(isLineReady(incompleteLine)).toBe(true);
    });
  });

  describe('5. Double-Entry Journal Posting (postGoodsServiceJournalEntry)', () => {
    it('posts sale of goods (Resin) debiting customer 1120 and crediting revenue account 4140', async () => {
      const pb = createMockPocketBase({
        sys_1120: { code: '1120', name: 'حساب‌های دریافتنی', accountType: 'asset', level: 3, isPostable: true },
        sys_4140: { code: '4140', name: 'فروش سکه، سنگ و سایر کالاها', accountType: 'revenue', level: 3, isPostable: true },
      });

      const result = await postGoodsServiceJournalEntry({
        documentId: 'doc_goods_1',
        lineNumber: 1,
        documentNumber: 'ZF-8801',
        entryDateJalali: '1405/08/10',
        amountRials: 35_000_000,
        nature: 'paid',
        operation: 'sell',
        itemType: 'goods',
        accountId: 'sys_4140',
        itemName: 'رزین ریخته‌گری فوتون',
        quantity: 2,
        unit: 'لیتر',
        description: 'فروش ۲ لیتر رزین ریخته‌گری فوتون',
        customer: { id: 'cust_zar', name: 'طلافروشی زرین' },
        userId: 'admin_1',
      }, pb);

      expect(result.totalDebit).toBe(35_000_000);
      expect(result.totalCredit).toBe(35_000_000);

      const lines = await pb.collection('journal_lines').getFullList();
      expect(lines).toHaveLength(2);

      const custDebitLine = lines.find((l: any) => l.account_id === 'sys_1120');
      expect(custDebitLine).toMatchObject({
        debit: 35_000_000,
        credit: 0,
        party_id: 'cust_zar',
      });

      const revenueCreditLine = lines.find((l: any) => l.account_id === 'sys_4140');
      expect(revenueCreditLine).toMatchObject({
        debit: 0,
        credit: 35_000_000,
      });
    });

    it('posts service provision (3D CAD Design) crediting service revenue 4240', async () => {
      const pb = createMockPocketBase({
        sys_1120: { code: '1120', name: 'حساب‌های دریافتنی', accountType: 'asset', level: 3, isPostable: true },
        sys_4240: { code: '4240', name: 'اجرت طراحی، ری‌گیری و حکاکی', accountType: 'revenue', level: 3, isPostable: true },
      });

      const result = await postGoodsServiceJournalEntry({
        documentId: 'doc_service_1',
        lineNumber: 2,
        documentNumber: 'ZF-8802',
        entryDateJalali: '1405/08/10',
        amountRials: 18_000_000,
        nature: 'paid',
        operation: 'sell',
        itemType: 'service',
        accountId: 'sys_4240',
        itemName: 'طراحی سه‌بعدی انگشتر سولیتر',
        quantity: 1,
        unit: 'پروژه',
        description: 'ارائه خدمات طراحی سه‌بعدی انگشتر سولیتر',
        customer: { id: 'cust_arash', name: 'گالری آرش' },
        userId: 'admin_1',
      }, pb);

      expect(result.totalDebit).toBe(18_000_000);
      expect(result.totalCredit).toBe(18_000_000);

      const lines = await pb.collection('journal_lines').getFullList();
      const srvLine = lines.find((l: any) => l.account_id === 'sys_4240');
      expect(srvLine).toMatchObject({
        debit: 0,
        credit: 18_000_000,
      });
    });

    it('posts purchase of goods (Resin) debiting inventory 1130 and crediting counterparty 2120', async () => {
      const pb = createMockPocketBase({
        sys_1130: { code: '1130', name: 'موجودی کالا و طلا', accountType: 'asset', level: 3, isPostable: true },
        sys_2120: { code: '2120', name: 'حساب‌های پرداختنی', accountType: 'liability', level: 3, isPostable: true },
      });

      const result = await postGoodsServiceJournalEntry({
        documentId: 'doc_buy_resin_1',
        lineNumber: 1,
        documentNumber: 'ZF-8803',
        entryDateJalali: '1405/08/11',
        amountRials: 60_000_000,
        nature: 'received',
        operation: 'buy',
        itemType: 'goods',
        accountId: 'sys_1130',
        itemName: 'رزین ریخته‌گری',
        quantity: 4,
        unit: 'لیتر',
        description: 'خرید ۴ لیتر رزین ریخته‌گری از تأمین‌کننده',
        customer: { id: 'supplier_resin', name: 'بازرگانی شیمی زر' },
        userId: 'admin_1',
      }, pb);

      expect(result.totalDebit).toBe(60_000_000);
      expect(result.totalCredit).toBe(60_000_000);

      const lines = await pb.collection('journal_lines').getFullList();
      const inventoryDebit = lines.find((l: any) => l.account_id === 'sys_1130');
      expect(inventoryDebit).toMatchObject({
        debit: 60_000_000,
        credit: 0,
      });

      const supplierCredit = lines.find((l: any) => l.account_id === 'sys_2120');
      expect(supplierCredit).toMatchObject({
        debit: 0,
        credit: 60_000_000,
        party_id: 'supplier_resin',
      });
    });

    it('enforces idempotency and prevents duplicate journal lines on retry', async () => {
      const pb = createMockPocketBase({
        sys_1120: { code: '1120', name: 'حساب‌های دریافتنی', accountType: 'asset', level: 3, isPostable: true },
        sys_4140: { code: '4140', name: 'فروش سایر کالاها', accountType: 'revenue', level: 3, isPostable: true },
      });

      const payload = {
        documentId: 'doc_idempotent_1',
        lineNumber: 1,
        documentNumber: 'ZF-9999',
        entryDateJalali: '1405/08/12',
        amountRials: 10_000_000,
        nature: 'paid' as const,
        operation: 'sell' as const,
        itemType: 'goods' as const,
        accountId: 'sys_4140',
        itemName: 'جعبه جواهرات',
        description: 'فروش جعبه',
        customer: { id: 'cust_idem', name: 'مشتری تست' },
        userId: 'user_1',
      };

      const first = await postGoodsServiceJournalEntry(payload, pb);
      const second = await postGoodsServiceJournalEntry(payload, pb);

      expect(first.id).toBe(second.id);
      const lines = await pb.collection('journal_lines').getFullList();
      expect(lines).toHaveLength(2); // Exactly 2 lines, no duplicates!
    });
  });

  describe('6. End-to-End Persistence Mapping (/api/documents)', () => {
    it('successfully processes and saves goods lines with correct rial amounts', async () => {
      const { setMockAuthUser, sharedMockPb } = await import('./setup');
      const { POST: postDocuments } = await import('@/app/api/documents/route');

      setMockAuthUser({
        id: 'admin_test_goods',
        name: 'مدیر تست کالا',
        email: 'admin_goods@zar.local',
        role: 'admin',
        status: 'active',
      });

      const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
      const createdTxRecords: any[] = [];

      sharedMockPb.collection = ((name: string) => {
        if (name === 'customers') {
          const coll = originalCollection(name);
          coll.getOne = async (id: string) => ({
            id,
            name: 'مشتری تست کالا',
            customerCode: 888,
          });
          coll.getFirstListItem = async () => null;
          return coll;
        }

        if (name === 'transactions') {
          const coll = originalCollection(name);
          coll.getFirstListItem = async () => null;
          coll.getFullList = async () => [];
          coll.create = async (data: any) => {
            const rec = { id: `tx_goods_${createdTxRecords.length + 1}`, ...data };
            createdTxRecords.push(rec);
            return rec;
          };
          return coll;
        }

        if (name === 'chart_of_accounts') {
          const coll = originalCollection(name);
          coll.getOne = async (id: string) => ({
            id,
            code: '113040',
            name: 'مواد اولیه و رزین ریخته‌گری',
            accountType: 'asset',
            isPostable: true,
          });
          coll.getFirstListItem = async () => ({
            id: 'coa_group_goods_resin',
            code: '113040',
            name: 'مواد اولیه و رزین ریخته‌گری',
            accountType: 'asset',
            isPostable: true,
          });
          return coll;
        }

        return originalCollection(name);
      }) as any;

      const reqBody = {
        customerId: 'customer_goods_1',
        documentDateJalali: '1405/08/15',
        status: 'draft',
        baseCurrency: 'IRT',
        lines: [
          {
            documentNature: 'received', // Purchase goods
            documentTab: 'goods',
            sourceTab: 'goods',
            description: 'خرید ۲ لیتر رزین فوتون',
            details: {
              goodsServiceType: 'goods',
              goodsServiceOperation: 'buy',
              goodsServiceAccountId: 'coa_group_goods_resin',
              goodsServiceAccountCode: '113040',
              itemName: 'رزین ریخته‌گری فوتون',
              quantity: '2',
              unit: 'لیتر',
              unitPrice: '1500000', // 1.5M Toman
              totalAmount: '3000000', // 3M Toman -> 30M IRR
              currencyUnit: 'IRT',
              baseCurrency: 'IRT',
            },
          },
        ],
      };

      const request = new Request('http://localhost:3000/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      const response = await postDocuments(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.documentId).toBeDefined();

      expect(createdTxRecords).toHaveLength(1);
      const tx = createdTxRecords[0];
      expect(tx.documentTab).toBe('goods');
      // In Toman mode, 3M Toman converts to 30,000,000 Rials
      expect(Math.abs(tx.rialAmount)).toBe(30_000_000);
      // Buying goods (nature: received) credits the supplier
      expect(tx.rialAmount).toBe(30_000_000);

      sharedMockPb.collection = originalCollection;
    });
  });
});
