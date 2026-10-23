import { describe, it, expect } from 'bun:test';
import { POST as postDocuments } from '@/app/api/documents/route';
import { sharedMockPb, setMockAuthUser } from './setup';

describe('Document Edit Mode sourceKey Uniqueness & Lifecycle', () => {
  it('successfully edits an existing document without sourceKey unique collision', async () => {
    setMockAuthUser({
      id: 'admin_user',
      name: 'مدیر تست',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const docId = 'edit_lifecycle_doc_1';
    const originalDocNumber = 'ZF12345678';
    const updatedTransactions: Array<{ id: string; data: any }> = [];
    const createdTransactions: any[] = [];
    const updatedMetalInv: Array<{ id: string; data: any }> = [];

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
          // If filtering by documentId
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
              documentNumber: 'ZF87654321',
              documentSequence: 42,
              sourceKey: `document:${docId}:2`,
              is_deleted: false,
            },
          ];
        };
        coll.update = async (id: string, data: any) => {
          updatedTransactions.push({ id, data });
          return { id, ...data };
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
        coll.update = async (id: string, data: any) => {
          updatedMetalInv.push({ id, data });
          return { id, ...data };
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

      // Verify old transactions were soft-deleted and had sourceKey and documentNumber renamed
      expect(updatedTransactions.length).toBe(2);
      expect(updatedTransactions[0].data.is_deleted).toBe(true);
      expect(updatedTransactions[0].data.sourceKey).toContain(`document:${docId}:1:edited:`);
      expect(updatedTransactions[0].data.documentNumber).toContain(`${originalDocNumber}:edited:`);
      expect(updatedTransactions[1].data.is_deleted).toBe(true);
      expect(updatedTransactions[1].data.sourceKey).toContain(`document:${docId}:2:edited:`);

      // Verify old metal_inventory was soft-deleted and source_key renamed
      expect(updatedMetalInv.length).toBe(1);
      expect(updatedMetalInv[0].data.is_deleted).toBe(true);
      expect(updatedMetalInv[0].data.source_key).toContain(`document:${docId}:1:metal:edited:`);

      // Verify new transaction was created with clean canonical sourceKey and preserved number
      expect(createdTransactions.length).toBe(1);
      expect(createdTransactions[0].sourceKey).toBe(`document:${docId}:1`);
      expect(createdTransactions[0].documentNumber).toBe(originalDocNumber);
      expect(createdTransactions[0].documentSequence).toBe(42);
    } finally {
      sharedMockPb.collection = originalCollection;
    }
  });

  it('successfully edits an existing multi-line document and adds a discount line without sourceKey collision', async () => {
    setMockAuthUser({
      id: 'admin_user',
      name: 'مدیر تست',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const docId = 'edit_discount_doc_2';
    const originalDocNumber = 'ZF99887766';
    const updatedTransactions: Array<{ id: string; data: any }> = [];
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
          // Verify sort is NOT 'documentLineNumber' (which PocketBase rejects)
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
              documentNumber: 'ZF11223344',
              documentSequence: 10,
              sourceKey: `document:${docId}:2`,
              is_deleted: false,
            },
          ];
        };
        coll.update = async (id: string, data: any) => {
          updatedTransactions.push({ id, data });
          return { id, ...data };
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
      // Edit payload has 3 lines: original 2 lines + 1 discount line
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

      // Both previous transactions should be marked deleted with :edited: suffix
      expect(updatedTransactions.length).toBe(2);
      expect(updatedTransactions[0].data.sourceKey).toContain(`document:${docId}:1:edited:`);
      expect(updatedTransactions[1].data.sourceKey).toContain(`document:${docId}:2:edited:`);

      // All 3 new lines created with unique canonical sourceKeys
      expect(createdTransactions.length).toBe(3);
      expect(createdTransactions[0].sourceKey).toBe(`document:${docId}:1`);
      expect(createdTransactions[1].sourceKey).toBe(`document:${docId}:2`);
      expect(createdTransactions[2].sourceKey).toBe(`document:${docId}:3`);
      expect(createdTransactions[2].documentTab).toBe('discount');
    } finally {
      sharedMockPb.collection = originalCollection;
    }
  });
});
