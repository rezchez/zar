import { describe, expect, it } from 'bun:test';
import {
  getRecentDocuments,
  transactionRecordToDocumentLine,
  type RecentDocumentItem,
} from '../features/accounting/documents/services/document-service';

describe('Recent Documents Service & Transformation Tests', () => {
  it('correctly maps transaction record to DocumentLine', () => {
    const record = {
      id: 'tx_row_1',
      customer: 'cust_1',
      customerCode: 101,
      documentId: 'doc_100',
      documentNumber: 'ZF-100',
      documentDateJalali: '1403/07/17',
      documentNature: 'received',
      documentTab: 'raw-gold',
      documentSubType: 'incoming-molten',
      documentLineNumber: 1,
      goldAmount: 15.25,
      rialAmount: 0,
      description: 'طلای آبشده تحویلی',
      documentDetails: JSON.stringify({
        metalType: 'gold',
        rawKind: 'molten',
        rawWeight: '15.250',
        purity: '750',
        convertedWeight: '15.250',
      }),
    };

    const line = transactionRecordToDocumentLine(record);
    expect(line.id).toBe('tx_row_1');
    expect(line.documentNature).toBe('received');
    expect(line.documentTab).toBe('raw-gold');
    expect(line.converted750).toBe(15.25);
    expect(line.details.rawWeight).toBe('15.250');
    expect(line.details.purity).toBe('750');
    expect(line.description).toBe('طلای آبشده تحویلی');
  });

  it('correctly groups multiple transaction lines by documentId and aggregates totals', async () => {
    const mockRecords = [
      {
        id: 'tx_line_2',
        documentId: 'doc_1',
        documentNumber: 'ZF-101',
        documentDateJalali: '1403/07/18',
        documentNature: 'received',
        documentTab: 'cash',
        documentLineNumber: 2,
        goldAmount: 0,
        rialAmount: 50_000_000,
        created: '2026-10-08T10:05:00Z',
        customer: 'cust_1',
        expand: {
          customer: { id: 'cust_1', name: 'طلافروشی امید', customerCode: '202' },
        },
        documentDetails: JSON.stringify({ totalAmount: '50000000' }),
      },
      {
        id: 'tx_line_1',
        documentId: 'doc_1',
        documentNumber: 'ZF-101',
        documentDateJalali: '1403/07/18',
        documentNature: 'received',
        documentTab: 'raw-gold',
        documentLineNumber: 1,
        goldAmount: 20,
        rialAmount: 0,
        created: '2026-10-08T10:00:00Z',
        customer: 'cust_1',
        expand: {
          customer: { id: 'cust_1', name: 'طلافروشی امید', customerCode: '202' },
        },
        documentDetails: JSON.stringify({ rawWeight: '20', purity: '750' }),
      },
      {
        id: 'tx_doc_2',
        documentId: 'doc_2',
        documentNumber: 'ZF-102',
        documentDateJalali: '1403/07/17',
        documentNature: 'paid',
        documentTab: 'gold-sale',
        documentLineNumber: 1,
        goldAmount: -10,
        rialAmount: 200_000_000,
        created: '2026-10-08T09:00:00Z',
        customer: 'cust_2',
        expand: {
          customer: { id: 'cust_2', name: 'جواهری زرین', customerCode: '303' },
        },
        documentDetails: JSON.stringify({ rawWeight: '10' }),
      },
    ];

    const mockPb = {
      collection: (name: string) => {
        expect(name).toBe('transactions');
        return {
          getList: async (page: number, perPage: number, options: any) => {
            expect(options.filter).toContain('is_deleted = false');
            expect(options.sort).toBe('-created');
            return { items: mockRecords, totalItems: mockRecords.length };
          },
        };
      },
    } as any;

    const recentDocs = await getRecentDocuments(mockPb, 10);
    expect(recentDocs).toHaveLength(2);

    // First document (doc_1)
    const doc1 = recentDocs[0];
    expect(doc1.documentId).toBe('doc_1');
    expect(doc1.documentNumber).toBe('ZF-101');
    expect(doc1.customerName).toBe('طلافروشی امید');
    expect(doc1.linesCount).toBe(2);
    expect(doc1.totalGoldWeight).toBe(20);
    expect(doc1.totalRialAmount).toBe(50_000_000);
    expect(doc1.lines).toHaveLength(2);
    // Verified lines are sorted by line number (line 1 before line 2)
    expect(doc1.lines[0].id).toBe('tx_line_1');
    expect(doc1.lines[1].id).toBe('tx_line_2');

    // Second document (doc_2)
    const doc2 = recentDocs[1];
    expect(doc2.documentId).toBe('doc_2');
    expect(doc2.documentNumber).toBe('ZF-102');
    expect(doc2.customerName).toBe('جواهری زرین');
    expect(doc2.linesCount).toBe(1);
    expect(doc2.totalGoldWeight).toBe(10);
    expect(doc2.totalRialAmount).toBe(200_000_000);
  });

  it('respects the limit argument to return at most requested count', async () => {
    const mockRecords = Array.from({ length: 15 }, (_, i) => ({
      id: `tx_${i}`,
      documentId: `doc_${i}`,
      documentNumber: `ZF-${100 + i}`,
      documentDateJalali: '1403/07/18',
      documentNature: 'received',
      documentTab: 'raw-gold',
      documentLineNumber: 1,
      goldAmount: 5,
      rialAmount: 0,
      created: `2026-10-08T${10 + Math.floor(i / 60)}:${i % 60}:00Z`,
      customer: `cust_${i}`,
      expand: {
        customer: { id: `cust_${i}`, name: `مشتری ${i}`, customerCode: `${i}` },
      },
      documentDetails: '{}',
    }));

    const mockPb = {
      collection: () => ({
        getList: async () => ({ items: mockRecords, totalItems: mockRecords.length }),
      }),
    } as any;

    const top10 = await getRecentDocuments(mockPb, 10);
    expect(top10).toHaveLength(10);

    const top5 = await getRecentDocuments(mockPb, 5);
    expect(top5).toHaveLength(5);
  });
});

import { GET as getDocuments, POST as postDocuments } from '../app/api/documents/route';
import { setMockAuthUser, sharedMockPb } from './setup';

describe('Document API Route Recent & Edit Endpoints', () => {
  it('GET /api/documents?recent=10 returns recent documents', async () => {
    setMockAuthUser({
      id: 'admin_user',
      name: 'مدیر سیستم',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    sharedMockPb.collection = ((name: string) => {
      if (name === 'transactions') {
        const coll = originalCollection(name);
        coll.getList = async () => ({
          items: [
            {
              id: 'tx_rec_1',
              documentId: 'doc_recent_1',
              documentNumber: 'ZF-999',
              documentDateJalali: '1403/07/18',
              documentNature: 'received',
              documentTab: 'raw-gold',
              documentLineNumber: 1,
              goldAmount: 12.5,
              rialAmount: 0,
              created: '2026-10-08T12:00:00Z',
              customer: 'cust_rec_1',
              expand: {
                customer: { id: 'cust_rec_1', name: 'طلافروشی احسان', customerCode: '555' },
              },
              documentDetails: '{}',
            },
          ],
          totalItems: 1,
        });
        return coll;
      }
      return originalCollection(name);
    }) as any;

    const req = new Request('http://localhost/api/documents?recent=10');
    const res = await getDocuments(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.documents).toBeDefined();
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0].documentId).toBe('doc_recent_1');
    expect(body.documents[0].documentNumber).toBe('ZF-999');
    expect(body.documents[0].customerName).toBe('طلافروشی احسان');

    sharedMockPb.collection = originalCollection;
  });

  it('GET /api/documents?documentId=... returns document details and lines for editing', async () => {
    setMockAuthUser({
      id: 'admin_user',
      name: 'مدیر سیستم',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    sharedMockPb.collection = ((name: string) => {
      if (name === 'transactions') {
        const coll = originalCollection(name);
        coll.getFullList = async () => [
          {
            id: 'tx_edit_1',
            documentId: 'doc_target_edit',
            documentNumber: 'ZF-777',
            documentSequence: 5,
            documentDateJalali: '1403/07/18',
            documentNature: 'received',
            documentTab: 'raw-gold',
            documentLineNumber: 1,
            goldAmount: 25.0,
            rialAmount: 0,
            customer: 'cust_edit_1',
            expand: {
              customer: { id: 'cust_edit_1', name: 'طلافروشی پارس', customerCode: '777' },
            },
            documentDetails: JSON.stringify({ rawWeight: '25', purity: '750' }),
          },
        ];
        return coll;
      }
      return originalCollection(name);
    }) as any;

    const req = new Request('http://localhost/api/documents?documentId=doc_target_edit');
    const res = await getDocuments(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.documentId).toBe('doc_target_edit');
    expect(body.documentNumber).toBe('ZF-777');
    expect(body.documentSequence).toBe(5);
    expect(body.lines).toHaveLength(1);
    expect(body.lines[0].details.rawWeight).toBe('25');

    sharedMockPb.collection = originalCollection;
  });

  it('POST /api/documents with isEdit: true marks previous records deleted and updates document', async () => {
    setMockAuthUser({
      id: 'admin_user',
      name: 'مدیر سیستم',
      email: 'admin@zar.local',
      role: 'admin',
      status: 'active',
    });

    const updatedTxIds: string[] = [];
    const updatedPayloads: any[] = [];
    const createdPayloads: any[] = [];

    const originalCollection = sharedMockPb.collection.bind(sharedMockPb);
    sharedMockPb.collection = ((name: string) => {
      if (name === 'customers') {
        const coll = originalCollection(name);
        coll.getOne = async (id: string) => ({
          id,
          name: 'مشتری تست',
          customerCode: 123,
        });
        coll.getFirstListItem = async () => null;
        return coll;
      }
      if (name === 'transactions') {
        const coll = originalCollection(name);
        coll.getFirstListItem = async () => null;
        coll.getFullList = async () => [
          {
            id: 'old_tx_1',
            documentId: 'doc_to_edit',
            documentNumber: 'ZF-888',
            documentSequence: 8,
            sourceKey: 'document:doc_to_edit:1',
            is_deleted: false,
          },
        ];
        coll.update = async (id: string, data: any) => {
          updatedTxIds.push(id);
          updatedPayloads.push(data);
          return { id, ...data };
        };
        coll.create = async (data: any) => {
          createdPayloads.push(data);
          return { id: `new_tx_${createdPayloads.length}`, ...data, created: new Date().toISOString() };
        };
        return coll;
      }
      if (name === 'metal_inventory') {
        const coll = originalCollection(name);
        coll.getFullList = async () => [];
        coll.getFirstListItem = async () => null;
        coll.create = async (d: any) => ({ id: 'metal_inv_1', ...d });
        return coll;
      }
      return originalCollection(name);
    }) as any;

    const payload = {
      customerId: 'cust_test_1',
      documentId: 'doc_to_edit',
      documentDateJalali: '1403/07/18',
      status: 'posted',
      isEdit: true,
      lines: [
        {
          documentNature: 'received',
          documentTab: 'raw-gold',
          goldAmount: 30,
          rialAmount: 0,
          silverAmount: 0,
          platinumAmount: 0,
          foreignAmount: 0,
          tertiaryAmount: 0,
          documentDetails: { rawWeight: '30', purity: '750' },
        },
      ],
    };

    const req = new Request('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await postDocuments(req);
    expect(res.status).toBe(200);

    // Assert that the old sibling record was marked is_deleted: true
    expect(updatedTxIds).toContain('old_tx_1');
    expect(updatedPayloads[0].is_deleted).toBe(true);
    expect(updatedPayloads[0].sourceKey).toContain('edited');

    // Assert that the new record preserved the original document number and sequence
    expect(createdPayloads).toHaveLength(1);
    expect(createdPayloads[0].documentNumber).toBe('ZF-888');
    expect(createdPayloads[0].documentSequence).toBe(8);

    sharedMockPb.collection = originalCollection;
  });
});

import RecentDocumentsWidget from '../src/components/dashboard/RecentDocumentsWidget';

describe('RecentDocumentsWidget Component Export Tests', () => {
  it('exports RecentDocumentsWidget component as a React functional component', () => {
    expect(typeof RecentDocumentsWidget).toBe('function');
  });
});

