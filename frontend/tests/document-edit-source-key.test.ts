import { describe, it, expect } from 'bun:test';
import { POST as postDocuments } from '@/app/api/documents/route';
import { sharedMockPb, setMockAuthUser } from './setup';

describe('Document Edit Mode sourceKey Uniqueness & Lifecycle', () => {
  it('successfully edits an existing document without sourceKey unique collision and cleans up previous rows', async () => {
    setMockAuthUser({
      id: 'admin_user',
      name: 'مدیر تست',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const docId = 'edit_lifecycle_doc_1';
    const originalDocNumber = 'ZF12345678';
    const deletedTransactions: string[] = [];
    const createdTransactions: any[] = [];
    const deletedMetalInv: string[] = [];

    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    sharedMockPb.collection = ((name: string) => {
      if (name === 'customers') {
        const coll = originalCollection(name);
        coll.getOne = async (id: string) => ({
          id,
          name: 'مشتری طلا فروش',
          customerCode: 999,
          secondaryCurrency: 'USD',
          secondaryCurrencySymbol: '$',
        });
        coll.getFirstListItem = async () => null;
        return coll;
      }

      if (name === 'transactions') {
        const coll = originalCollection(name);
        coll.getFirstListItem = async () => null;
        coll.getFullList = async (opts: any) => {
          return [
            {
              id: 'tx_old_line_1',
              documentId: docId,
              documentLineNumber: 1,
              documentNumber: originalDocNumber,
              documentSequence: 42,
              sourceKey: `document:${docId}:1`,
              is_deleted: false,
            },
            {
              id: 'tx_old_line_2',
              documentId: docId,
              documentLineNumber: 2,
              documentNumber: originalDocNumber,
              documentSequence: 42,
              sourceKey: `document:${docId}:2`,
              is_deleted: false,
            },
          ];
        };
        coll.delete = async (id: string) => {
          deletedTransactions.push(id);
          return true;
        };
        coll.create = async (data: any) => {
          createdTransactions.push(data);
          return { id: `tx_new_${createdTransactions.length}`, ...data, created: new Date().toISOString() };
        };
        return coll;
      }

      if (name === 'metal_inventory') {
        const coll = originalCollection(name);
        coll.getFullList = async () => [
          {
            id: 'inv_old_1',
            document_id: docId,
            source_key: `document:${docId}:1:metal`,
            is_deleted: false,
          },
        ];
        coll.delete = async (id: string) => {
          deletedMetalInv.push(id);
          return true;
        };
        coll.getFirstListItem = async () => null;
        coll.create = async (d: any) => ({ id: 'inv_new_1', ...d });
        return coll;
      }

      return originalCollection(name);
    }) as any;

    try {
      const payload = {
        customerId: 'cust_edit_test',
        documentId: docId,
        documentDateJalali: '1403/07/20',
        status: 'posted',
        isEdit: true,
        lines: [
          {
            documentNature: 'received',
            documentTab: 'raw-gold',
            goldAmount: 25.5,
            rialAmount: 0,
            silverAmount: 0,
            platinumAmount: 0,
            foreignAmount: 0,
            tertiaryAmount: 0,
            documentDetails: { rawWeight: '25.5', purity: '750' },
          },
        ],
      };

      const req = new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await postDocuments(req);
      const resJson = await res.json();

      expect(res.status).toBe(200);
      expect(resJson.documentId).toBe(docId);
      expect(resJson.documentNumber).toBe(originalDocNumber);
      expect(resJson.documentSequence).toBe(42);

      // Verify old transactions were cleanly deleted (no zombie records in transactions)
      expect(deletedTransactions.length).toBe(2);
      expect(deletedTransactions).toContain('tx_old_line_1');
      expect(deletedTransactions).toContain('tx_old_line_2');

      // Verify old metal_inventory was cleanly deleted
      expect(deletedMetalInv.length).toBe(1);
      expect(deletedMetalInv).toContain('inv_old_1');

      // Verify new transaction was created with clean canonical sourceKey and preserved number
      expect(createdTransactions.length).toBe(1);
      expect(createdTransactions[0].sourceKey).toBe(`document:${docId}:1`);
      expect(createdTransactions[0].documentNumber).toBe(originalDocNumber);
      expect(createdTransactions[0].documentSequence).toBe(42);
    } finally {
      sharedMockPb.collection = originalCollection;
    }
  });

  it('successfully edits an existing multi-line document and adds a discount line without leaving zombie records', async () => {
    setMockAuthUser({
      id: 'admin_user',
      name: 'مدیر تست',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const docId = 'edit_discount_doc_2';
    const originalDocNumber = 'ZF99887766';
    const deletedTransactions: string[] = [];
    const createdTransactions: any[] = [];

    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    sharedMockPb.collection = ((name: string) => {
      if (name === 'customers') {
        const coll = originalCollection(name);
        coll.getOne = async (id: string) => ({
          id,
          name: 'مشتری تخفیف',
          customerCode: 555,
          secondaryCurrency: 'USD',
          secondaryCurrencySymbol: '$',
        });
        coll.getFirstListItem = async () => null;
        return coll;
      }

      if (name === 'transactions') {
        const coll = originalCollection(name);
        coll.getFirstListItem = async () => null;
        coll.getFullList = async (opts: any) => {
          expect(opts?.sort).not.toBe('documentLineNumber');
          return [
            {
              id: 'tx_line_1',
              documentId: docId,
              documentNumber: originalDocNumber,
              documentSequence: 10,
              sourceKey: `document:${docId}:1`,
              is_deleted: false,
            },
            {
              id: 'tx_line_2',
              documentId: docId,
              documentNumber: originalDocNumber,
              documentSequence: 10,
              sourceKey: `document:${docId}:2`,
              is_deleted: false,
            },
          ];
        };
        coll.delete = async (id: string) => {
          deletedTransactions.push(id);
          return true;
        };
        coll.create = async (data: any) => {
          createdTransactions.push(data);
          return { id: `tx_new_${createdTransactions.length}`, ...data, created: new Date().toISOString() };
        };
        return coll;
      }

      return originalCollection(name);
    }) as any;

    try {
      const payload = {
        customerId: 'cust_edit_discount',
        documentId: docId,
        documentDateJalali: '1403/07/20',
        status: 'posted',
        isEdit: true,
        lines: [
          {
            documentNature: 'received',
            documentTab: 'raw-gold',
            goldAmount: 10,
            rialAmount: 0,
            silverAmount: 0,
            platinumAmount: 0,
            foreignAmount: 0,
            tertiaryAmount: 0,
            documentDetails: { rawWeight: '10', purity: '750' },
          },
          {
            documentNature: 'received',
            documentTab: 'cash',
            goldAmount: 0,
            rialAmount: 50000000,
            silverAmount: 0,
            platinumAmount: 0,
            foreignAmount: 0,
            tertiaryAmount: 0,
            documentDetails: { totalAmount: '50000000' },
          },
          {
            documentNature: 'received',
            documentTab: 'discount',
            documentSubType: 'discount-given',
            goldAmount: 0,
            rialAmount: 5000000,
            silverAmount: 0,
            platinumAmount: 0,
            foreignAmount: 0,
            tertiaryAmount: 0,
            documentDetails: {
              discountDirection: 'given',
              discountAmount: '5000000',
              totalAmount: '5000000',
              discountPercentage: '10',
              discountBaseAmount: '50000000',
            },
          },
        ],
      };

      const req = new Request('http://localhost/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await postDocuments(req);
      const resJson = await res.json();

      expect(res.status).toBe(200);
      expect(resJson.documentId).toBe(docId);
      expect(resJson.documentNumber).toBe(originalDocNumber);
      expect(resJson.documentSequence).toBe(10);

      // Previous transactions should be deleted
      expect(deletedTransactions.length).toBe(2);
      expect(deletedTransactions).toContain('tx_line_1');
      expect(deletedTransactions).toContain('tx_line_2');

      // All 3 new lines created with unique canonical sourceKeys and shared documentNumber
      expect(createdTransactions.length).toBe(3);
      expect(createdTransactions[0].sourceKey).toBe(`document:${docId}:1`);
      expect(createdTransactions[0].documentNumber).toBe(originalDocNumber);
      expect(createdTransactions[1].sourceKey).toBe(`document:${docId}:2`);
      expect(createdTransactions[1].documentNumber).toBe(originalDocNumber);
      expect(createdTransactions[2].sourceKey).toBe(`document:${docId}:3`);
      expect(createdTransactions[2].documentNumber).toBe(originalDocNumber);
      expect(createdTransactions[2].documentTab).toBe('discount');
    } finally {
      sharedMockPb.collection = originalCollection;
    }
  });
});
