import { describe, expect, it } from 'bun:test';

import {
  validateRefinerCustomer,
  createRefiningCase,
  deliverGoldToRefiner,
  createSamplePacket,
  receiveSamplePacket,
  receiveOutputGold,
  recordCaseRefiningFee,
  getUnreceivedPackets,
  getRefiningCaseDetails,
  deleteRefiningCase,
  RefiningError,
} from '@/features/refining/services/refining-service';
import { SYSTEM_ACCOUNT_CODES } from '@/features/accounting/posting/posting-engine';
import { EXACT_PATH_LABELS, SEGMENT_FALLBACK_LABELS } from '@/components/layout/Breadcrumbs';

function createMockPocketBase() {
  const store: Record<string, any[]> = {
    customers: [
      { id: 'refiner_1', name: 'ری‌گیری اعتماد', groupName: 'ریگیر', customerCode: 101 },
      { id: 'customer_1', name: 'جناب احمدی', groupName: 'مشتری', customerCode: 102 },
    ],
    refining_cases: [],
    refining_items: [],
    refining_samples: [],
    metal_inventory: [],
    journal_entries: [],
    journal_lines: [],
    transactions: [],
    audit_logs: [],
    chart_of_accounts: [
      { id: 'coa_5500', code: '5500', name: 'هزینه‌های مستقیم تولید و خدمات', isActive: true },
      { id: 'coa_2120', code: '2120', name: 'بستانکاران تجاری', isActive: true },
    ],
  };

  const pb: any = {
    filter: (template: string, params?: Record<string, any>) => {
      let res = template;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          res = res.replace(`{: ${k} }`, String(v)).replace(`{:${k}}`, String(v));
        }
      }
      return res;
    },
    collection: (name: string) => {
      if (!store[name]) store[name] = [];
      const colData = store[name];

      return {
        getOne: async (id: string, _opts?: any) => {
          const item = colData.find((x) => x.id === id);
          if (!item) throw new Error(`Not found in ${name}`);
          return { ...item };
        },
        getFirstListItem: async (filterStr: string) => {
          for (const item of colData) {
            if (filterStr.includes('sourceKey') && item.sourceKey) {
              const matchKey = filterStr.split('"')[1] || filterStr.split("'")[1] || '';
              if (item.sourceKey === matchKey) return { ...item };
            }
            if (filterStr.includes('packet_number') && item.packet_number) {
              const matchPkt = filterStr.split('"')[1] || filterStr.split("'")[1] || '';
              if (item.packet_number === matchPkt) return { ...item };
            }
            if (filterStr.includes('code =') && item.code) {
              const matchCode = filterStr.split('=')[1]?.trim().replace(/['"]/g, '');
              if (item.code === matchCode) return { ...item };
            }
          }
          return null;
        },
        getFullList: async (opts?: any) => {
          let list = [...colData];
          if (opts?.filter) {
            if (opts.filter.includes('case_id =')) {
              const cId = opts.filter.split('=')[1]?.trim().replace(/['"]/g, '');
              list = list.filter((x) => x.case_id === cId);
            }
            if (opts.filter.includes('status = "with_refiner"')) {
              list = list.filter((x) => x.status === 'with_refiner');
            }
            if (opts.filter.includes('refiner =')) {
              const rId = opts.filter.split('=')[1]?.trim().replace(/['"]/g, '');
              list = list.filter((x) => x.refiner === rId);
            }
          }
          return list.map((item) => {
            const exp: any = {};
            if (item.refiner) {
              exp.refiner = store.customers.find((c) => c.id === item.refiner);
            }
            if (item.case_id) {
              exp.case_id = store.refining_cases.find((c) => c.id === item.case_id);
            }
            return { ...item, expand: exp };
          });
        },
        create: async (data: any) => {
          const record = {
            id: `id_${name}_${colData.length + 1}_${Date.now().toString().slice(-4)}`,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            ...data,
          };
          colData.push(record);
          return { ...record };
        },
        update: async (id: string, data: any) => {
          const idx = colData.findIndex((x) => x.id === id);
          if (idx === -1) throw new Error(`Not found in ${name}`);
          colData[idx] = { ...colData[idx], ...data, updated: new Date().toISOString() };
          return { ...colData[idx] };
        },
        delete: async (id: string) => {
          const idx = colData.findIndex((x) => x.id === id);
          if (idx !== -1) {
            colData.splice(idx, 1);
          }
          return true;
        },
      };
    },
    _store: store,
  };

  return pb;
}

describe('Zarfolio — Gold Refining Module Architecture (ماژول ری‌گیری طلا)', () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Refiner Group Boundary Tests
  // ─────────────────────────────────────────────────────────────
  describe('Refiner Customer Group Boundary Enforcement', () => {
    it('accepts refiner customer with groupName = "ریگیر"', async () => {
      const mockPb = createMockPocketBase();
      const customer = await validateRefinerCustomer(mockPb, 'refiner_1');
      expect(customer.id).toBe('refiner_1');
      expect(customer.groupName).toBe('ریگیر');
    });

    it('accepts any registered customer without restricting to refiner group', async () => {
      const mockPb = createMockPocketBase();
      const customer = await validateRefinerCustomer(mockPb, 'customer_1');
      expect(customer.id).toBe('customer_1');
      expect(customer.name).toBe('جناب احمدی');
    });

    it('rejects nonexistent customer ID', async () => {
      const mockPb = createMockPocketBase();
      expect(validateRefinerCustomer(mockPb, 'invalid_id')).rejects.toThrow(RefiningError);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Refining Case Lifecycle Tests
  // ─────────────────────────────────────────────────────────────
  describe('Refining Case Creation & Structure', () => {
    it('creates a new refining case with unique case number and open status', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        {
          refinerId: 'refiner_1',
          date: '1405/06/25',
          description: 'پرونده ری‌گیری طلای آبشده متفرقه کارگاه',
        },
        'user_admin',
      );

      expect(newCase.caseNumber).toMatch(/^REF-\d{4}-\d{4}$/);
      expect(newCase.refinerId).toBe('refiner_1');
      expect(newCase.status).toBe('open');
      expect(newCase.totalSentWeight).toBe(0);
      expect(newCase.remainingWeight).toBe(0);
      expect(newCase.refiningFee).toBe(0);
    });

    it('allows case creation for any valid customer', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'customer_1', description: 'ری‌گیری برای مشتری' },
        'user_admin',
      );
      expect(newCase.refinerId).toBe('customer_1');
      expect(newCase.status).toBe('open');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Gold Delivery (Outflow from Free Inventory)
  // ─────────────────────────────────────────────────────────────
  describe('Gold Delivery to Refiner & Inventory Integration', () => {
    it('records gold delivery, creates outflow in metal_inventory, and updates case', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      const item = await deliverGoldToRefiner(
        mockPb,
        newCase.id,
        {
          rawWeight: 150.25,
          purity: 750,
          inventoryType: 'melted',
          stampNumber: 'ENG-9988',
          labName: 'آزمایشگاه عیار سنجی طهران',
          description: 'ارسال شمش آبشده',
        },
        'user_admin',
      );

      expect(item.rawWeight).toBe(150.25);
      expect(item.purity).toBe(750);
      expect(item.convertedWeight).toBe(150.25);
      expect(item.status).toBe('with_refiner');

      // Verify metal_inventory outflow record was created
      const metalInv = mockPb._store.metal_inventory;
      expect(metalInv.length).toBe(1);
      expect(metalInv[0].direction).toBe('out');
      expect(metalInv[0].transaction_type).toBe('refining_delivery');
      expect(metalInv[0].raw_weight).toBe(150.25);

      // Verify case totals updated
      const updatedCase = mockPb._store.refining_cases[0];
      expect(updatedCase.total_sent_weight).toBe(150.25);
      expect(updatedCase.remaining_weight).toBe(150.25);
      expect(updatedCase.status).toBe('sent_to_refiner');
    });

    it('rejects non-positive weights or invalid purity', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      expect(
        deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: -5, purity: 750 }, 'user_admin'),
      ).rejects.toThrow('بزرگتر از صفر');

      expect(
        deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 10, purity: 1050 }, 'user_admin'),
      ).rejects.toThrow('بین ۱ تا ۱۰۰۰');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Sample Packet Management & Idempotency
  // ─────────────────────────────────────────────────────────────
  describe('Sample Packet Issuance, Receipt & Idempotency Protection', () => {
    it('issues sample packet with declared weight in with_refiner state', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      const sample = await createSamplePacket(
        mockPb,
        newCase.id,
        { declaredWeight: 2.5, purity: 750, description: 'پاکت اول عیارسنجی' },
        'user_admin',
      );

      expect(sample.packetNumber).toMatch(/^PKT-/);
      expect(sample.declaredWeight).toBe(2.5);
      expect(sample.status).toBe('with_refiner');
      expect(sample.receivedWeight).toBe(0);

      // Verify unreceived packets list shows this sample
      const unreceived = await getUnreceivedPackets(mockPb);
      expect(unreceived.length).toBe(1);
      expect(unreceived[0].id).toBe(sample.id);
    });

    it('receives sample packet: enters actual weight into inventory, calculates operational difference, and prevents re-receiving', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      // Deliver 100g first
      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');

      // Issue sample: declared 2.500g
      const sample = await createSamplePacket(
        mockPb,
        newCase.id,
        { declaredWeight: 2.5, purity: 750 },
        'user_admin',
      );

      // Receive sample: actual received 2.350g (operational loss of 0.150g)
      const received = await receiveSamplePacket(
        mockPb,
        sample.id,
        { receivedWeight: 2.35, receivedDate: '1405/06/26' },
        'user_admin',
      );

      expect(received.status).toBe('received');
      expect(received.receivedWeight).toBe(2.35);
      expect(received.weightDifference).toBe(0.15); // 2.500 - 2.350

      // Check metal_inventory record for sample receipt (inflow)
      const sampleInvRecord = mockPb._store.metal_inventory.find(
        (m: any) => m.transaction_type === 'refining_sample_receipt',
      );
      expect(sampleInvRecord).toBeDefined();
      expect(sampleInvRecord.direction).toBe('in');
      expect(sampleInvRecord.raw_weight).toBe(2.35);

      // Check that sample is NO LONGER in unreceived list
      const unreceivedAfter = await getUnreceivedPackets(mockPb);
      expect(unreceivedAfter.length).toBe(0);

      // CRITICAL IDEMPOTENCY TEST: Attempting to receive again must fail!
      expect(
        receiveSamplePacket(mockPb, sample.id, { receivedWeight: 2.35 }, 'user_admin'),
      ).rejects.toThrow('قبلاً دریافت شده است');

      // CRITICAL ACCOUNTING RULE: No counterparty transaction or debt created for difference
      const transactions = mockPb._store.transactions;
      expect(transactions.length).toBe(0); // 0 transactions created for sample difference!
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Output Gold Receipt
  // ─────────────────────────────────────────────────────────────
  describe('Output Gold Receipt & Inventory Return', () => {
    it('receives output refined gold, enters into inventory, and updates case', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');

      const outputItem = await receiveOutputGold(
        mockPb,
        newCase.id,
        {
          rawWeight: 98.4,
          purity: 750,
          stampNumber: 'ENG-FINAL-101',
          labName: 'ری‌گیری اعتماد',
          receiptDate: '1405/06/27',
        },
        'user_admin',
      );

      expect(outputItem.rawWeight).toBe(98.4);
      expect(outputItem.status).toBe('received');

      const receiptInv = mockPb._store.metal_inventory.find(
        (m: any) => m.transaction_type === 'refining_receipt',
      );
      expect(receiptInv).toBeDefined();
      expect(receiptInv.direction).toBe('in');
      expect(receiptInv.raw_weight).toBe(98.4);
      expect(receiptInv.stamp_number).toBe('ENG-FINAL-101');

      // Check remaining weight
      const caseRecord = mockPb._store.refining_cases[0];
      expect(caseRecord.remaining_weight).toBe(1.6); // 100 - 98.4
      expect(caseRecord.status).toBe('partially_received');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Refining Fee & Double-Entry Accounting
  // ─────────────────────────────────────────────────────────────
  describe('Refining Service Fee & Accounting Engine Integration', () => {
    it('records refining fee, creates balanced double-entry journal entry, and credits refiner liability', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      const feeAmount = 15_000_000; // 15M IRR
      const updatedCase = await recordCaseRefiningFee(
        mockPb,
        newCase.id,
        feeAmount,
        'user_admin',
      );

      expect(updatedCase.refiningFee).toBe(15_000_000);
      expect(updatedCase.feeSettled).toBe(true);
      expect(updatedCase.journalEntryId).toBeDefined();

      // Verify journal entry in posting engine
      const entries = mockPb._store.journal_entries;
      expect(entries.length).toBe(1);
      expect(entries[0].sourceType).toBe('document');
      expect(entries[0].sourceKey).toBe(`refining:fee:${newCase.id}`);

      // Verify journal lines: Debit 5500, Credit 2120
      const lines = mockPb._store.journal_lines;
      expect(lines.length).toBe(2);

      const debitLine = lines.find((l: any) => l.debit > 0);
      const creditLine = lines.find((l: any) => l.credit > 0);

      expect(debitLine.debit).toBe(15_000_000);
      expect(debitLine.account_id).toBe('coa_5500'); // REFINING_EXPENSE (5500)

      expect(creditLine.credit).toBe(15_000_000);
      expect(creditLine.account_id).toBe('coa_2120'); // COUNTERPARTY_LIABILITY (2120)
      expect(creditLine.party_id).toBe('refiner_1');

      // Verify transaction ledger for customer balance
      const tx = mockPb._store.transactions;
      expect(tx.length).toBe(1);
      expect(tx[0].customer).toBe('refiner_1');
      expect(tx[0].rialAmount).toBe(15_000_000); // positive = creditor (طلبکار از ما)
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Case Summary & Complete Details
  // ─────────────────────────────────────────────────────────────
  describe('Full Case Details & Calculations Verification', () => {
    it('computes accurate summary metrics across sent, output, samples, loss, remaining, and debt', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      // Deliver 200g gold
      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 200, purity: 750 }, 'user_admin');

      // Issue and receive sample: 2.000g declared, 1.850g received (loss: 0.150g)
      const sample = await createSamplePacket(mockPb, newCase.id, { declaredWeight: 2.0, purity: 750 }, 'user_admin');
      await receiveSamplePacket(mockPb, sample.id, { receivedWeight: 1.85 }, 'user_admin');

      // Receive 190g output gold
      await receiveOutputGold(mockPb, newCase.id, { rawWeight: 190, purity: 750 }, 'user_admin');

      // Record fee: 20,000,000 IRR
      await recordCaseRefiningFee(mockPb, newCase.id, 20_000_000, 'user_admin');

      const details = await getRefiningCaseDetails(mockPb, newCase.id);

      expect(details.summary.totalSentWeight).toBe(200);
      expect(details.summary.totalOutputWeight).toBe(190);
      expect(details.summary.totalDeclaredSampleWeight).toBe(2);
      expect(details.summary.totalReceivedSampleWeight).toBe(1.85);
      expect(details.summary.totalWeightDifference).toBe(0.15); // operational loss
      expect(details.summary.remainingWeightAtRefiner).toBe(8.15); // 200 - 190 - 1.85
      expect(details.summary.debtToRefiner).toBe(20_000_000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Case Deletion Verification
  // ─────────────────────────────────────────────────────────────
  describe('Case Deletion & Cleanup Verification', () => {
    it('deletes a refining case and cleans up related items, samples, inventory and journals', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      // Deliver gold (creates refining_item and metal_inventory)
      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');

      // Create sample packet and receive it (receive creates metal_inventory)
      const sample = await createSamplePacket(mockPb, newCase.id, { declaredWeight: 2.0, purity: 750 }, 'user_admin');
      await receiveSamplePacket(mockPb, sample.id, { receivedWeight: 1.9 }, 'user_admin');

      // Record fee (creates journal_entries, journal_lines, transactions)
      await recordCaseRefiningFee(mockPb, newCase.id, 10_000_000, 'user_admin');

      // Ensure records exist prior to deletion
      expect(mockPb._store.refining_cases.length).toBe(1);
      expect(mockPb._store.refining_items.length).toBe(1);
      expect(mockPb._store.refining_samples.length).toBe(1);
      expect(mockPb._store.metal_inventory.length).toBe(2);
      expect(mockPb._store.journal_entries.length).toBe(1);
      expect(mockPb._store.journal_lines.length).toBe(2);

      // Delete the case
      await deleteRefiningCase(mockPb, newCase.id, 'user_admin');

      // Verify case is removed
      expect(mockPb._store.refining_cases.length).toBe(0);

      // Verify cascading items and samples are removed
      expect(mockPb._store.refining_items.length).toBe(0);
      expect(mockPb._store.refining_samples.length).toBe(0);

      // Verify linked metal inventory is removed
      expect(mockPb._store.metal_inventory.length).toBe(0);

      // Verify linked journals and lines are removed
      expect(mockPb._store.journal_entries.length).toBe(0);
      expect(mockPb._store.journal_lines.length).toBe(0);
    });
  });
});

