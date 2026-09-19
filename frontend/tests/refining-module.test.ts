import { describe, expect, it } from 'bun:test';

import {
  validateRefinerCustomer,
  createRefiningCase,
  deliverGoldToRefiner,
  createSamplePacket,
  receiveSamplePacket,
  receiveOutputGold,
  recordCaseRefiningFee,
  deleteCaseRefiningFee,
  updateRefiningItem,
  deleteRefiningItem,
  updateSamplePacket,
  deleteSamplePacket,
  deleteRefiningCase,
  settleSampleAssayPurity,
  getUnreceivedPackets,
  getRefiningCaseDetails,
  RefiningError,
} from '@/features/refining/services/refining-service';
import { SYSTEM_ACCOUNT_CODES } from '@/features/accounting/posting/posting-engine';
import { EXACT_PATH_LABELS, SEGMENT_FALLBACK_LABELS } from '@/components/layout/Breadcrumbs';
import {
  mapTransaction,
  transactionBalancesToCustomerBalances,
} from '@/features/accounting/transactions/services/transaction';


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
              const matchKey = (filterStr.split('sourceKey =')[1] || '').trim().replace(/['"]/g, '') ||
                filterStr.split('"')[1] || filterStr.split("'")[1] || '';
              if (item.sourceKey === matchKey) return { ...item };
            }
            if (filterStr.includes('packet_number') && item.packet_number) {
              const matchPkt = (filterStr.split('packet_number =')[1] || '').trim().replace(/['"]/g, '') ||
                filterStr.split('"')[1] || filterStr.split("'")[1] || '';
              if (item.packet_number === matchPkt) return { ...item };
            }
            if (filterStr.includes('code =') && item.code) {
              const matchCode = filterStr.split('code =')[1]?.trim().split(' ')[0]?.replace(/['"]/g, '');
              if (item.code === matchCode) return { ...item };
            }
          }
          return null;
        },
        getFullList: async (opts?: any) => {
          let list = [...colData];
          if (opts?.filter) {
            if (opts.filter.includes('case_id =')) {
              const cId = opts.filter.split('case_id =')[1]?.trim().split(' ')[0]?.replace(/['"]/g, '');
              list = list.filter((x) => x.case_id === cId);
            }
            if (opts.filter.includes('journal_entry_id =')) {
              const jId = opts.filter.split('journal_entry_id =')[1]?.trim().split(' ')[0]?.replace(/['"]/g, '');
              list = list.filter((x) => x.journal_entry_id === jId);
            }
            if (opts.filter.includes('item_type =')) {
              const iType = opts.filter.split('item_type =')[1]?.trim().split(' ')[0]?.replace(/['"]/g, '');
              list = list.filter((x) => x.item_type === iType);
            }
            if (opts.filter.includes('status = "with_refiner"')) {
              list = list.filter((x) => x.status === 'with_refiner');
            }
            if (opts.filter.includes('refiner =')) {
              const rId = opts.filter.split('refiner =')[1]?.trim().split(' ')[0]?.replace(/['"]/g, '');
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
          if (idx !== -1) colData.splice(idx, 1);
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

    it('strictly rejects customer who does NOT belong to "ریگیر" group', async () => {
      const mockPb = createMockPocketBase();
      expect(validateRefinerCustomer(mockPb, 'customer_1')).rejects.toThrow(RefiningError);
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

    it('prevents case creation for non-refiner counterparty', async () => {
      const mockPb = createMockPocketBase();
      expect(
        createRefiningCase(
          mockPb,
          { refinerId: 'customer_1', description: 'تست غیرمجاز' },
          'user_admin',
        ),
      ).rejects.toThrow('عضو گروه ریگیر نیست');
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
      expect(tx[0].status).toBe('final');
      expect(tx[0].is_deleted).toBe(false);

      // Verify that customer ledger balance immediately reflects 15M IRR debt to refiner
      const balances = transactionBalancesToCustomerBalances(tx.map(mapTransaction));
      expect(balances.rialBalance).toBe(15_000_000);
    });

    it('accepts string fees with commas and Persian numerals', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(
        mockPb,
        { refinerId: 'refiner_1' },
        'user_admin',
      );

      // Comma-formatted Persian string: "۲۵,۰۰۰,۰۰۰"
      const updatedCase = await recordCaseRefiningFee(
        mockPb,
        newCase.id,
        '۲۵,۰۰۰,۰۰۰' as any,
        'user_admin',
      );

      expect(updatedCase.refiningFee).toBe(25_000_000);
      expect(updatedCase.feeSettled).toBe(true);

      const tx = mockPb._store.transactions[0];
      expect(tx.rialAmount).toBe(25_000_000);
      expect(tx.documentDateJalali).toBeDefined();
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
      expect(details.summary.remainingWeightAtRefiner).toBe(8); // 200 - 190 - 1.85 (received) - 0.15 (loss) = 8
      expect(details.summary.debtToRefiner).toBe(20_000_000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Navigation & Breadcrumb Labels Verification
  // ─────────────────────────────────────────────────────────────
  describe('Breadcrumb Navigation Labels', () => {
    it('registers exact path /dashboard/refining', () => {
      expect(EXACT_PATH_LABELS['/dashboard/refining']).toBe('مدیریت ری‌گیری');
    });

    it('registers exact path /dashboard/refining/packets', () => {
      expect(EXACT_PATH_LABELS['/dashboard/refining/packets']).toBe('پاکت‌های نزد ریگیری');
    });

    it('registers fallback segments for refining and packets', () => {
      expect(SEGMENT_FALLBACK_LABELS['refining']).toBe('ری‌گیری طلا');
      expect(SEGMENT_FALLBACK_LABELS['packets']).toBe('پاکت‌های نزد ریگیری');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 9. Refining Fee Edit & Deletion Verification
  // ─────────────────────────────────────────────────────────────
  describe('Refining Fee Edit & Deletion', () => {
    it('updates existing refining fee with new amount and replaces journal lines and transaction', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');

      // 1. Initial fee: 10M IRR
      await recordCaseRefiningFee(mockPb, newCase.id, 10_000_000, 'user_admin');
      expect(mockPb._store.journal_entries.length).toBe(1);
      expect(mockPb._store.transactions.length).toBe(1);
      expect(mockPb._store.transactions[0].rialAmount).toBe(10_000_000);

      // 2. Edit fee: update to 12M IRR
      const updatedCase = await recordCaseRefiningFee(mockPb, newCase.id, 12_000_000, 'user_admin');
      expect(updatedCase.refiningFee).toBe(12_000_000);
      expect(updatedCase.feeSettled).toBe(true);

      // Verify transaction was updated to 12M IRR
      expect(mockPb._store.transactions.length).toBe(1);
      expect(mockPb._store.transactions[0].rialAmount).toBe(12_000_000);
      expect(mockPb._store.transactions[0].is_deleted).toBe(false);

      // Verify customer balance immediately reflects updated 12M IRR debt
      const updatedBalances = transactionBalancesToCustomerBalances(mockPb._store.transactions.map(mapTransaction));
      expect(updatedBalances.rialBalance).toBe(12_000_000);

      // Verify journal lines were updated to 12M IRR
      const lines = mockPb._store.journal_lines;
      expect(lines.length).toBe(2);
      const debitLine = lines.find((l: any) => l.debit > 0);
      const creditLine = lines.find((l: any) => l.credit > 0);
      expect(debitLine.debit).toBe(12_000_000);
      expect(creditLine.credit).toBe(12_000_000);
    });

    it('deletes refining fee, clears journal entry & lines, and removes transaction', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');

      await recordCaseRefiningFee(mockPb, newCase.id, 15_000_000, 'user_admin');
      expect(mockPb._store.journal_entries.length).toBe(1);
      expect(mockPb._store.journal_lines.length).toBe(2);
      expect(mockPb._store.transactions.length).toBe(1);
      const initialBalances = transactionBalancesToCustomerBalances(mockPb._store.transactions.map(mapTransaction));
      expect(initialBalances.rialBalance).toBe(15_000_000);

      // Delete fee
      const clearedCase = await deleteCaseRefiningFee(mockPb, newCase.id, 'user_admin');
      expect(clearedCase.refiningFee).toBe(0);
      expect(clearedCase.feeSettled).toBe(false);

      // GL and transaction should be deleted and customer balance returns to 0
      expect(mockPb._store.journal_entries.length).toBe(0);
      expect(mockPb._store.journal_lines.length).toBe(0);
      expect(mockPb._store.transactions.length).toBe(0);
      const clearedBalances = transactionBalancesToCustomerBalances(mockPb._store.transactions.map(mapTransaction));
      expect(clearedBalances.rialBalance).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 10. Refining Items (Sent & Output Gold) Edit & Deletion
  // ─────────────────────────────────────────────────────────────
  describe('Refining Items Edit & Deletion', () => {
    it('edits sent gold weight and purity, recalculating inventory and case totals', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');

      const sentItem = await deliverGoldToRefiner(
        mockPb,
        newCase.id,
        { rawWeight: 100, purity: 750, inventoryType: 'miscellaneous' },
        'user_admin',
      );

      // Initial checks
      expect(sentItem.rawWeight).toBe(100);
      const invRecord = mockPb._store.metal_inventory.find((i: any) => i.id === sentItem.metalInventoryId);
      expect(invRecord).toBeDefined();
      expect(invRecord.raw_weight).toBe(100);

      // Edit item: change weight to 105g and purity to 740
      const updatedItem = await updateRefiningItem(
        mockPb,
        newCase.id,
        sentItem.id,
        { rawWeight: 105, purity: 740 },
        'user_admin',
      );

      expect(updatedItem.rawWeight).toBe(105);
      expect(updatedItem.purity).toBe(740);

      // Verify linked metal_inventory updated
      const updatedInv = mockPb._store.metal_inventory.find((i: any) => i.id === sentItem.metalInventoryId);
      expect(updatedInv.raw_weight).toBe(105);
      expect(updatedInv.purity).toBe(740);

      // Verify case totals updated
      const caseRecord = mockPb._store.refining_cases.find((c: any) => c.id === newCase.id);
      expect(caseRecord.total_sent_weight).toBe(105);
      expect(caseRecord.remaining_weight).toBe(105);
    });

    it('deletes sent gold item and reverses linked inventory and updates case totals', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');

      const sentItem = await deliverGoldToRefiner(
        mockPb,
        newCase.id,
        { rawWeight: 100, purity: 750 },
        'user_admin',
      );

      expect(mockPb._store.refining_items.length).toBe(1);
      expect(mockPb._store.metal_inventory.length).toBe(1);

      // Delete item
      await deleteRefiningItem(mockPb, newCase.id, sentItem.id, 'user_admin');

      expect(mockPb._store.refining_items.length).toBe(0);
      expect(mockPb._store.metal_inventory.length).toBe(0);

      const caseRecord = mockPb._store.refining_cases.find((c: any) => c.id === newCase.id);
      expect(caseRecord.total_sent_weight).toBe(0);
      expect(caseRecord.remaining_weight).toBe(0);
    });

    it('edits output gold and deletes output gold with inventory reversal', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');
      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');

      // Receive 98g output conditional gold
      const outputItem = await receiveOutputGold(
        mockPb,
        newCase.id,
        { rawWeight: 98, purity: 750, inventoryType: 'conditional' },
        'user_admin',
      );

      expect(outputItem.rawWeight).toBe(98);
      expect(mockPb._store.metal_inventory.length).toBe(2);

      // Edit output item: change weight to 97.5g
      const updatedOutput = await updateRefiningItem(
        mockPb,
        newCase.id,
        outputItem.id,
        { rawWeight: 97.5 },
        'user_admin',
      );

      expect(updatedOutput.rawWeight).toBe(97.5);
      const outputInv = mockPb._store.metal_inventory.find((i: any) => i.id === outputItem.metalInventoryId);
      expect(outputInv.raw_weight).toBe(97.5);

      // Case remaining weight: 100 - 97.5 = 2.5g
      const caseRecord = mockPb._store.refining_cases.find((c: any) => c.id === newCase.id);
      expect(caseRecord.total_received_weight).toBe(97.5);
      expect(caseRecord.remaining_weight).toBe(2.5);

      // Delete output gold
      await deleteRefiningItem(mockPb, newCase.id, outputItem.id, 'user_admin');
      expect(mockPb._store.refining_items.length).toBe(1); // only sent item left
      expect(mockPb._store.metal_inventory.length).toBe(1); // only sent inv left
      const afterDeleteCase = mockPb._store.refining_cases.find((c: any) => c.id === newCase.id);
      expect(afterDeleteCase.total_received_weight).toBe(0);
      expect(afterDeleteCase.remaining_weight).toBe(100);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 11. Sample Packet Edit, Deletion & Assay Lab Settlement
  // ─────────────────────────────────────────────────────────────
  describe('Sample Packet Edit, Deletion & Assay Lab Settlement', () => {
    it('edits sample declared and received weight, recalculating refining loss', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');
      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');

      // Issue sample with 2.0g declared
      const sample = await createSamplePacket(mockPb, newCase.id, { declaredWeight: 2.0 }, 'user_admin');
      expect(sample.declaredWeight).toBe(2);

      // Edit declared weight to 2.5g before receipt
      const editedSample = await updateSamplePacket(
        mockPb,
        newCase.id,
        sample.id,
        { declaredWeight: 2.5 },
        'user_admin',
      );
      expect(editedSample.declaredWeight).toBe(2.5);

      // Now receive sample: 2.3g received (loss = 0.2g)
      const receivedSample = await receiveSamplePacket(
        mockPb,
        sample.id,
        { receivedWeight: 2.3 },
        'user_admin',
      );
      expect(receivedSample.weightDifference).toBe(0.2);

      // Edit received sample: change receivedWeight to 2.4g (loss = 0.1g)
      const updatedReceivedSample = await updateSamplePacket(
        mockPb,
        newCase.id,
        sample.id,
        { receivedWeight: 2.4 },
        'user_admin',
      );
      expect(updatedReceivedSample.receivedWeight).toBe(2.4);
      expect(updatedReceivedSample.weightDifference).toBe(0.1);

      // Check linked metal_inventory
      const invRecord = mockPb._store.metal_inventory.find((i: any) => i.id === receivedSample.metalInventoryId);
      expect(invRecord.raw_weight).toBe(2.4);
    });

    it('settles assay lab purity converting conditional gold to definitive melted gold', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');
      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');

      // Sample packet
      const sample = await createSamplePacket(mockPb, newCase.id, { declaredWeight: 2.0, purity: 750 }, 'user_admin');
      await receiveSamplePacket(mockPb, sample.id, { receivedWeight: 1.9 }, 'user_admin');

      // Output gold received conditionally
      const output = await receiveOutputGold(
        mockPb,
        newCase.id,
        { rawWeight: 98, purity: 750, inventoryType: 'conditional' },
        'user_admin',
      );
      expect(output.inventoryType).toBe('conditional');

      // Assay lab returns purity = 760
      const settledSample = await settleSampleAssayPurity(mockPb, sample.id, 760, 'user_admin');
      expect(settledSample.purity).toBe(760);

      // Output gold in case must be converted to melted with 760 purity
      const updatedOutputItem = mockPb._store.refining_items.find((i: any) => i.id === output.id);
      expect(updatedOutputItem.purity).toBe(760);
      expect(updatedOutputItem.inventory_type).toBe('melted');

      // Metal inventory record for output gold must also be converted to melted
      const outputInv = mockPb._store.metal_inventory.find((i: any) => i.id === output.metalInventoryId);
      expect(outputInv.purity).toBe(760);
      expect(outputInv.inventory_type).toBe('melted');
    });

    it('deletes sample packet and clears inventory and updates case totals', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');
      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');

      const sample = await createSamplePacket(mockPb, newCase.id, { declaredWeight: 2.0 }, 'user_admin');
      await receiveSamplePacket(mockPb, sample.id, { receivedWeight: 1.8 }, 'user_admin');

      expect(mockPb._store.refining_samples.length).toBe(1);
      // Inventory has sent gold + sample receipt
      expect(mockPb._store.metal_inventory.length).toBe(2);

      // Delete sample packet
      await deleteSamplePacket(mockPb, newCase.id, sample.id, 'user_admin');

      expect(mockPb._store.refining_samples.length).toBe(0);
      expect(mockPb._store.metal_inventory.length).toBe(1); // sample receipt inv deleted
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 12. Full Refining Case Deletion Verification
  // ─────────────────────────────────────────────────────────────
  describe('Full Refining Case Deletion', () => {
    it('deletes case, items, samples, journal entries, and inventory movements cleanly', async () => {
      const mockPb = createMockPocketBase();
      const newCase = await createRefiningCase(mockPb, { refinerId: 'refiner_1' }, 'user_admin');

      await deliverGoldToRefiner(mockPb, newCase.id, { rawWeight: 100, purity: 750 }, 'user_admin');
      const sample = await createSamplePacket(mockPb, newCase.id, { declaredWeight: 2.0 }, 'user_admin');
      await receiveSamplePacket(mockPb, sample.id, { receivedWeight: 1.8 }, 'user_admin');
      await receiveOutputGold(mockPb, newCase.id, { rawWeight: 90, purity: 750 }, 'user_admin');
      await recordCaseRefiningFee(mockPb, newCase.id, 5_000_000, 'user_admin');

      expect(mockPb._store.refining_cases.length).toBe(1);
      expect(mockPb._store.refining_items.length).toBe(2);
      expect(mockPb._store.refining_samples.length).toBe(1);
      expect(mockPb._store.metal_inventory.length).toBe(3);
      expect(mockPb._store.journal_entries.length).toBe(1);
      expect(mockPb._store.journal_lines.length).toBe(2);
      expect(mockPb._store.transactions.length).toBe(1);

      // Delete entire case
      await deleteRefiningCase(mockPb, newCase.id, 'user_admin');

      expect(mockPb._store.refining_cases.length).toBe(0);
      expect(mockPb._store.refining_items.length).toBe(0);
      expect(mockPb._store.refining_samples.length).toBe(0);
      expect(mockPb._store.metal_inventory.length).toBe(0);
      expect(mockPb._store.journal_entries.length).toBe(0);
      expect(mockPb._store.journal_lines.length).toBe(0);
      expect(mockPb._store.transactions.length).toBe(0);
    });
  });
});
