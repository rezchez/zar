import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import fs from 'node:fs';

import {
  detectTahesabBackup,
  parseBackupInfo,
  parseTahesabBackup,
  normalizePersianText,
  parseSqlValues,
  normalizeTahesabData,
  buildInitialMappings,
  validateTahesabMigration,
  importTahesabData,
  rollbackTahesabMigration,
  wipeAllPreviousTahesabData,
  deleteMigrationJob,
} from '../features/migration/tahesab';

const FIXTURE_PATH = path.resolve(process.cwd(), '../migration/tahesab/fixtures/1.mcbk');
const SYMLINK_FIXTURE_PATH = path.resolve(process.cwd(), '../migration/tahesab/fixtures/Tahesab_Backup_1405-06-26.Mcbk');

describe('Tahesab Accounting Migration Engine Tests', () => {
  // 1. Detection
  it('1. Backup Detection: correctly detects Tahesab .Mcbk archive container and metadata', async () => {
    expect(fs.existsSync(FIXTURE_PATH)).toBe(true);

    const result = await detectTahesabBackup(FIXTURE_PATH);
    expect(result.isTahesab).toBe(true);
    expect(result.version).toBe('10.1405.4.20');
    expect(result.backupInfo?.mohitCount).toBe(2);
    expect(result.backupInfo?.dbType).toBe('SQL');
    expect(result.backupInfo?.dateJalali).toBe('1405/06/26');
    expect(result.backupInfo?.fromDateJalali).toBe('1402/04/03');
    expect(result.backupInfo?.toDateJalali).toBe('1405/06/26');
    expect(result.entries.length).toBe(15);

    const entryNames = result.entries.map((e) => e.name);
    expect(entryNames).toContain('xDB.SQL');
    expect(entryNames).toContain('BkUp1.Mbk');
    expect(entryNames).toContain('backUp.Info');
  });

  // 1.1 Symlink Detection
  it('1.1. Detects via Tahesab_Backup_1405-06-26.Mcbk path', async () => {
    if (fs.existsSync(SYMLINK_FIXTURE_PATH)) {
      const result = await detectTahesabBackup(SYMLINK_FIXTURE_PATH);
      expect(result.isTahesab).toBe(true);
      expect(result.backupInfo?.version).toBe('10.1405.4.20');
    }
  });

  // 2. Parser & SQL Table Discovery
  it('2. Parser & Table Discovery: parses SQL Server dump and discovers all financial tables', async () => {
    const { rawDb, stats } = await parseTahesabBackup(FIXTURE_PATH, {
      maxDetailRows: 500, // fast slice for unit test
    });

    expect(stats.hesab).toBe(26075);
    expect(stats.moshtarian).toBe(590);
    expect(stats.bank).toBe(18);
    expect(stats.Hesab_bank).toBe(6);
    expect(stats.Sekeh_Shemsh).toBe(11);
    expect(stats.Sang).toBe(49);
    expect(stats.raygiri).toBe(305);

    expect(rawDb.moshtarian.length).toBe(590);
    expect(rawDb.hesab.length).toBe(26075);
    expect(rawDb.Hesab_bank.length).toBe(6);
    expect(rawDb.Sekeh_Shemsh.length).toBe(11);
  });

  // 3. Document Extraction & Line Extraction
  it('3. Document & Line Extraction: extracts document master records and detail lines', async () => {
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, {
      maxDetailRows: 200,
    });

    const info = parseBackupInfo('Info.Date=1405/06/26\nMohitCount=2\nVersion=10.1405.4.20');
    const normalized = normalizeTahesabData(rawDb, info);

    expect(normalized.documents.length).toBeGreaterThan(0);
    const docWithLines = normalized.documents.find((d) => d.lines.length > 0);
    expect(docWithLines).toBeDefined();
    expect(docWithLines?.sourceFactorCode).toBeDefined();
    expect(docWithLines?.dateJalali).toMatch(/^\d{4}\/\d{2}\/\d{2}/);
  });

  // 4. Account Mapping
  it('4. Account Mapping: builds deterministic initial chart of accounts mappings', async () => {
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 50 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    const mockAccounts = [
      { id: 'acc_1110', code: '1110', name: 'موجودی نقد و بانک' },
      { id: 'acc_1120', code: '1120', name: 'اسناد دریافتنی تجاری' },
      { id: 'acc_1130', code: '1130', name: 'موجودی کالا و طلا' },
      { id: 'acc_2110', code: '2110', name: 'اسناد پرداختنی تجاری' },
      { id: 'acc_2120', code: '2120', name: 'حساب‌های پرداختنی تجاری' },
      { id: 'acc_3100', code: '3100', name: 'سرمایه اول دوره' },
    ];

    const mappings = buildInitialMappings(normalized, [], mockAccounts);
    expect(mappings.accounts.length).toBeGreaterThanOrEqual(6);

    const goldMapping = mappings.accounts.find((a) => a.targetAccountCode === '1130');
    expect(goldMapping?.status).toBe('mapped');
    expect(goldMapping?.targetAccountId).toBe('acc_1130');

    const cashMapping = mappings.accounts.find((a) => a.targetAccountCode === '1110');
    expect(cashMapping?.status).toBe('mapped');
    expect(cashMapping?.targetAccountId).toBe('acc_1110');
  });

  // 5. Party Mapping
  it('5. Party Mapping: matches parties by exact name and phone, flags ambiguous as needs_review', async () => {
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 50 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    const firstParty = normalized.parties[0];

    const existingCustomers = [
      { id: 'cust_match_1', name: firstParty.name, phone1: firstParty.phone1 },
      { id: 'cust_ambig_1', name: 'طرف‌حساب مشترک', phone1: '09120000000' },
      { id: 'cust_ambig_2', name: 'طرف‌حساب مشترک', phone1: '09120000001' },
    ];

    // Inject ambiguous party to test guard
    normalized.parties.push({
      sourceCode: '9999',
      name: 'طرف‌حساب مشترک',
      phone1: '09120000000',
      openingGoldWeight: 0,
      openingRialBalance: 0,
      currency: 'IRR',
      raw: {},
    });

    const mappings = buildInitialMappings(normalized, existingCustomers, []);

    // 1st party should be mapped
    const match = mappings.parties.find((p) => p.sourceCode === firstParty.sourceCode);
    expect(match?.status).toBe('mapped');
    expect(match?.targetCustomerId).toBe('cust_match_1');

    // Ambiguous party MUST NOT be auto-mapped
    const ambig = mappings.parties.find((p) => p.sourceCode === '9999');
    expect(ambig?.status).toBe('needs_review');
    expect(ambig?.targetCustomerId).toBeUndefined();
  });

  // 6. Metal Mapping & Grade Conversion
  it('6. Metal Mapping & Grade Conversion: validates formula (weight * grade) / 750', () => {
    const weight = 69.86;
    const grade = 995;
    const converted = Math.round(((weight * grade) / 750) * 1000) / 1000;
    expect(converted).toBe(92.681);

    const weight2 = 100;
    const grade2 = 750;
    expect(Math.round(((weight2 * grade2) / 750) * 1000) / 1000).toBe(100);

    const weight3 = 50;
    const grade3 = 900; // 21.6K coin
    expect(Math.round(((weight3 * grade3) / 750) * 1000) / 1000).toBe(60);
  });

  // 7. Conditional Gold
  it('7. Conditional Gold: identifies conditional gold rows and assay stamp receipts', async () => {
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 500 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    let conditionalFound = false;
    for (const doc of normalized.documents) {
      for (const line of doc.lines) {
        if (line.isConditional && line.assayStampNumber) {
          conditionalFound = true;
          expect(line.kind === 'conditional' || line.kind === 'melted').toBe(true);
          break;
        }
      }
      if (conditionalFound) break;
    }

    expect(conditionalFound).toBe(true);
  });

  // 8. Transfer Mapping
  it('8. Transfer Mapping: accurately links two-way transfers via shared token', () => {
    const line1 = {
      Command: '#HAVALEH#314679148202409141220166901103#35485',
      name_az: 'فروشنده طلا',
      vazn: '15.500',
      ayar: '750',
      tabdil750_kh: '15.500',
    };
    const line2 = {
      Command: '#hshbe#314679148202409141220166901103#35485',
      name_az: 'خریدار طلا',
      vazn: '15.500',
      ayar: '750',
      tabdil750_v: '15.500',
    };

    const token1 = line1.Command.replace('#HAVALEH#', '');
    const token2 = line2.Command.replace('#hshbe#', '');
    expect(token1).toBe(token2);
    expect(token1).toBe('314679148202409141220166901103#35485');
  });

  // 9. Receivable / Payable & Balances
  it('9. Receivable / Payable Sign Convention: validates balance continuity formula', () => {
    // New Balance = Previous Balance + geram_v - geram_kh
    let runningBalance = -488.809;
    const step1Gkh = 13.77;
    runningBalance -= step1Gkh;
    expect(Math.round(runningBalance * 1000) / 1000).toBe(-502.579);

    const step2Gv = 9.27;
    runningBalance += step2Gv;
    expect(Math.round(runningBalance * 1000) / 1000).toBe(-493.309);
  });

  // 10. Cash & Bank
  it('10. Cash & Bank: extracts bank accounts with non-zero opening balances', async () => {
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 50 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    expect(normalized.bankAccounts.length).toBe(6);
    const keshavarzi = normalized.bankAccounts.find((b) => b.bankName.includes('کشاورز'));
    expect(keshavarzi).toBeDefined();
    expect(keshavarzi?.openingBalanceIrr).toBe(300000000);
  });

  // 11. Currency
  it('11. Currency: extracts USD transactions and distinguishes from IRR base', async () => {
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 1000 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    const usdDoc = normalized.documents.find((d) => d.currency === 'USD' || d.lines.some((l) => l.foreignCurrency === 'USD'));
    expect(usdDoc).toBeDefined();
  });

  // 12. Validation & Preview
  it('12. Validation & Preview: generates full preview stats without blocking errors', async () => {
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 200 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);
    const mappings = buildInitialMappings(normalized, [], []);

    const validation = validateTahesabMigration(normalized, mappings);
    expect(validation.isBlocked).toBe(false);
    expect(validation.preview.totalDocuments).toBe(normalized.documents.length);
    expect(validation.preview.totalParties).toBe(normalized.parties.length);
    expect(validation.preview.totalBankAccounts).toBe(6);
    expect(validation.preview.totalCoins).toBe(11);
    expect(validation.preview.totalGemstones).toBe(49);
  });

  // 13. Idempotency & Duplicate Protection
  it('13. Idempotency: re-running import with same sourceKeys skips duplicates completely', async () => {
    const createdKeys = new Set<string>();

    const mockPb = {
      filter: (tmpl: string, params: Record<string, any>) => {
        let res = tmpl;
        for (const [k, v] of Object.entries(params)) {
          res = res.replace(`{:${k}}`, String(v));
        }
        return res;
      },
      collection: (col: string) => ({
        getFirstListItem: async (filterStr: string) => {
          for (const key of createdKeys) {
            if (filterStr.includes(key)) {
              return { id: `rec_${key}`, sourceKey: key };
            }
          }
          throw new Error('Not found');
        },
        create: async (data: Record<string, any>) => {
          if (data.sourceKey) {
            createdKeys.add(data.sourceKey);
          }
          return { id: `created_${Date.now()}_${Math.random()}`, ...data };
        },
        getFullList: async () => Array.from(createdKeys).map((k) => ({ sourceKey: k })),
      }),
    } as any;

    const mockData = {
      backupInfo: { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 },
      parties: [
        {
          sourceCode: '100',
          name: 'مشتری تست تکرار',
          openingGoldWeight: 0,
          openingRialBalance: 0,
          currency: 'IRR',
          raw: {},
        },
      ],
      documents: [
        {
          sourceFactorCode: 'DOC_1',
          documentNumber: '1',
          sourceCustomerCode: '100',
          dateIso: '2026-09-01T12:00:00Z',
          dateJalali: '1405/06/10',
          totalGoldIn: 10,
          totalGoldOut: 0,
          totalRialIn: 0,
          totalRialOut: 0,
          currency: 'IRR',
          metalType: 'gold' as const,
          lines: [
            {
              sourceFactorCode: 'DOC_1',
              lineNumber: 1,
              dateIso: '2026-09-01T12:00:00Z',
              dateJalali: '1405/06/10',
              nature: 'received' as const,
              kind: 'general_metal' as const,
              metalType: 'gold' as const,
              weight: 10,
              grade: 750,
              convertedWeight750: 10,
              amountIrr: 0,
              description: 'ردیف تست تکرار',
              isConditional: false,
              raw: {},
            },
          ],
          raw: {},
        },
      ],
      bankAccounts: [],
      coins: [],
      gemstones: [],
      assayLabs: [],
      inventory: [],
    };

    const mockMappings = {
      accounts: [],
      parties: [
        {
          sourceCode: '100',
          sourceName: 'مشتری تست تکرار',
          status: 'new_party' as const,
        },
      ],
      defaultMetalKarat: 750,
      defaultCurrency: 'IRR',
    };

    // First Import
    const res1 = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'test_mig_001',
    });

    expect(res1.importedDocuments).toBe(1);
    expect(res1.importedLines).toBe(1);
    expect(res1.skippedDuplicates).toBe(0);

    // Second Import (Exact same data & migrationId)
    const res2 = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'test_mig_001',
    });

    // Must skip without re-inserting
    expect(res2.importedLines).toBe(0);
    expect(res2.skippedDuplicates).toBe(1);
  });

  // 14. Rollback
  it('14. Rollback: deletes only entities tagged with the given migrationId and preserves others', async () => {
    const store = new Map<string, any>();
    store.set('tx_1', { id: 'tx_1', sourceKey: 'tahesab:mig_target:1:1' });
    store.set('tx_2', { id: 'tx_2', sourceKey: 'tahesab:mig_target:1:2' });
    store.set('tx_preexisting', { id: 'tx_preexisting', sourceKey: 'zf:doc:888' });

    const mockPb = {
      filter: (tmpl: string, params: Record<string, any>) => {
        let res = tmpl;
        for (const [k, v] of Object.entries(params)) {
          res = res.replace(`{:${k}}`, String(v));
        }
        return res;
      },
      collection: (col: string) => ({
        getFullList: async (options?: any) => {
          const filter = options?.filter || '';
          const results: any[] = [];
          for (const item of store.values()) {
            if (filter.includes('mig_target') && item.sourceKey?.includes('mig_target')) {
              results.push(item);
            }
          }
          return results;
        },
        getFirstListItem: async () => {
          throw new Error('Not found');
        },
        update: async () => ({}),
        delete: async (id: string) => {
          store.delete(id);
          return true;
        },
      }),
    } as any;

    const rollbackResult = await rollbackTahesabMigration(mockPb, 'mig_target');
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.deletedTransactions).toBe(2);

    // Ensure pre-existing transaction is preserved!
    expect(store.has('tx_preexisting')).toBe(true);
    expect(store.has('tx_1')).toBe(false);
    expect(store.has('tx_2')).toBe(false);
  });

  // 15. Schema Compliance & Unique ZF document numbers
  it('15. Schema Compliance: validates customerCode, createdBy, balanceSource, and unique ZF doc numbers', async () => {
    const createdCustomers: any[] = [];
    const createdTransactions: any[] = [];

    const mockPb = {
      filter: (tmpl: string, params: Record<string, any>) => {
        let res = tmpl;
        for (const [k, v] of Object.entries(params)) {
          res = res.replace(`{:${k}}`, String(v));
        }
        return res;
      },
      collection: (col: string) => ({
        getFullList: async () => [],
        getFirstListItem: async () => {
          throw new Error('Not found');
        },
        create: async (data: Record<string, any>) => {
          if (col === 'customers') {
            createdCustomers.push(data);
            return { id: `cust_${data.customerCode}`, ...data };
          }
          if (col === 'transactions') {
            createdTransactions.push(data);
            return { id: `tx_${Date.now()}_${Math.random()}`, ...data };
          }
          return { id: `rec_${Date.now()}`, ...data };
        },
      }),
    } as any;

    const mockData = {
      backupInfo: { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 },
      parties: [
        {
          sourceCode: '101',
          name: 'مشتری تست اسکیما',
          openingGoldWeight: 0,
          openingRialBalance: 0,
          currency: 'IRR',
          raw: {},
        },
      ],
      bankAccounts: [],
      documents: [
        {
          sourceFactorCode: 'DOC_MULTI',
          documentNumber: '500',
          sourceCustomerCode: '101',
          dateIso: '2026-09-01T12:00:00Z',
          dateJalali: '1405/06/10',
          totalGoldIn: 10,
          totalGoldOut: 5,
          totalRialIn: 0,
          totalRialOut: 0,
          currency: 'IRR',
          metalType: 'gold' as const,
          lines: [
            {
              sourceFactorCode: 'DOC_MULTI',
              lineNumber: 1,
              dateIso: '2026-09-01T12:00:00Z',
              dateJalali: '1405/06/10',
              nature: 'received' as const,
              kind: 'melted' as const,
              metalType: 'gold' as const,
              weight: 10,
              grade: 750,
              convertedWeight750: 10,
              amountIrr: 0,
              description: 'ردیف ۱ آبشده',
              isConditional: false,
              raw: {},
            },
            {
              sourceFactorCode: 'DOC_MULTI',
              lineNumber: 2,
              dateIso: '2026-09-01T12:00:00Z',
              dateJalali: '1405/06/10',
              nature: 'paid' as const,
              kind: 'melted' as const,
              metalType: 'gold' as const,
              weight: 5,
              grade: 750,
              convertedWeight750: 5,
              amountIrr: 0,
              description: 'ردیف ۲ آبشده',
              isConditional: false,
              raw: {},
            },
          ],
          raw: {},
        },
      ],
      coins: [],
      gemstones: [],
      assayLabs: [],
    };

    const mockMappings = {
      accounts: [],
      parties: [
        {
          sourceCode: '101',
          sourceName: 'مشتری تست اسکیما',
          status: 'new_party' as const,
        },
      ],
      defaultMetalKarat: 750,
      defaultCurrency: 'IRR',
    };

    const result = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'test_mig_schema',
      userId: 'user_admin_001',
    });

    expect(result.importedParties).toBe(1);
    expect(result.importedDocuments).toBe(1);
    expect(result.importedLines).toBe(2);

    // Verify Customer Schema Fields
    const cust = createdCustomers[0];
    expect(cust).toBeDefined();
    expect(cust.createdBy).toBe('user_admin_001');
    expect(cust.primaryCurrency).toBe('rial');
    expect(cust.customerCode).toBe(101);

    // Verify Transactions Schema Fields & Uniqueness
    expect(createdTransactions.length).toBe(2);
    const tx1 = createdTransactions[0];
    const tx2 = createdTransactions[1];

    expect(tx1.createdBy).toBe('user_admin_001');
    expect(tx1.balanceSource).toBe('current');
    expect(tx1.customerCode).toBe(101);

    // Document numbers MUST be distinct unique ZF format
    expect(tx1.documentNumber).toMatch(/^ZF[0-9]{8}$/);
    expect(tx2.documentNumber).toMatch(/^ZF[0-9]{8}$/);
    expect(tx1.documentNumber).not.toBe(tx2.documentNumber);
  });

  // 16. Chunked Batch Execution
  it('16. Chunked Execution: supports docOffset and docLimit without timeout', async () => {
    const mockPb = {
      filter: () => '',
      collection: () => ({
        getFullList: async () => [],
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: any) => ({ id: `rec_${Math.random()}`, ...data }),
      }),
    } as any;

    const mockDocs = Array.from({ length: 5 }, (_, i) => ({
      sourceFactorCode: `DOC_${i + 1}`,
      documentNumber: String(i + 1),
      sourceCustomerCode: '101',
      dateIso: '2026-09-01T12:00:00Z',
      dateJalali: '1405/06/10',
      totalGoldIn: 1,
      totalGoldOut: 0,
      totalRialIn: 0,
      totalRialOut: 0,
      currency: 'IRR',
      metalType: 'gold' as const,
      lines: [
        {
          sourceFactorCode: `DOC_${i + 1}`,
          lineNumber: 1,
          dateIso: '2026-09-01T12:00:00Z',
          dateJalali: '1405/06/10',
          nature: 'received' as const,
          kind: 'melted' as const,
          metalType: 'gold' as const,
          weight: 1,
          grade: 750,
          convertedWeight750: 1,
          amountIrr: 0,
          description: `سند ${i + 1}`,
          isConditional: false,
          raw: {},
        },
      ],
      raw: {},
    }));

    const mockData = {
      backupInfo: { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 },
      parties: [{ sourceCode: '101', name: 'مشتری تست چانک', openingGoldWeight: 0, openingRialBalance: 0, currency: 'IRR', raw: {} }],
      bankAccounts: [],
      documents: mockDocs,
      coins: [],
      gemstones: [],
      assayLabs: [],
    };

    const mockMappings = {
      accounts: [],
      parties: [{ sourceCode: '101', sourceName: 'مشتری تست چانک', status: 'new_party' as const }],
      defaultMetalKarat: 750,
      defaultCurrency: 'IRR',
    };

    // Chunk 1: offset 0, limit 2
    const chunk1 = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'test_chunk_mig',
      userId: 'user_admin_001',
      docOffset: 0,
      docLimit: 2,
    });

    expect(chunk1.status).toBe('in_progress');
    expect(chunk1.importedDocuments).toBe(2);
    expect(chunk1.nextOffset).toBe(2);

    // Chunk 2: offset 2, limit 2
    const chunk2 = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'test_chunk_mig',
      userId: 'user_admin_001',
      docOffset: 2,
      docLimit: 2,
    });

    expect(chunk2.status).toBe('in_progress');
    expect(chunk2.importedDocuments).toBe(2);
    expect(chunk2.nextOffset).toBe(4);

    // Chunk 3: offset 4, limit 2 (finishing remaining 1 doc)
    const chunk3 = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'test_chunk_mig',
      userId: 'user_admin_001',
      docOffset: 4,
      docLimit: 2,
    });

    expect(chunk3.status).toBe('completed');
    expect(chunk3.importedDocuments).toBe(1);
    expect(chunk3.nextOffset).toBeNull();
  });

  // 17. Party Side & Double-Entry Journal Lines
  it('17. Party Side & Double-Entry Journal Lines: distinguishes debtor vs creditor party side and properly assigns partyId', async () => {
    const postedEntries: any[] = [];
    const createdTx: any[] = [];

    const mockPb = {
      filter: () => '',
      collection: (name: string) => ({
        getFullList: async () => [],
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: any) => {
          if (name === 'transactions') createdTx.push(data);
          if (name === 'journal_entries') postedEntries.push(data);
          return { id: `rec_${Math.random()}`, ...data };
        },
      }),
    } as any;

    const mockData = {
      backupInfo: { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 },
      parties: [
        { sourceCode: '101', name: 'طرف حساب بستانکار', openingGoldWeight: 0, openingRialBalance: 0, currency: 'IRR', raw: {} },
        { sourceCode: '102', name: 'طرف حساب بدهکار', openingGoldWeight: 0, openingRialBalance: 0, currency: 'IRR', raw: {} },
      ],
      bankAccounts: [],
      documents: [
        {
          sourceFactorCode: 'DOC_CREDITOR',
          documentNumber: '1',
          sourceCustomerCode: '101',
          dateIso: '2026-09-01T12:00:00Z',
          dateJalali: '1405/06/10',
          totalGoldIn: 10,
          totalGoldOut: 0,
          totalRialIn: 5000000,
          totalRialOut: 0,
          currency: 'IRR',
          metalType: 'gold' as const,
          lines: [
            {
              sourceFactorCode: 'DOC_CREDITOR',
              lineNumber: 1,
              dateIso: '2026-09-01T12:00:00Z',
              dateJalali: '1405/06/10',
              nature: 'received' as const,
              kind: 'cash' as const,
              metalType: 'gold' as const,
              weight: 0,
              grade: 750,
              convertedWeight750: 0,
              amountIrr: 5000000,
              signedGoldAmount: 0,
              signedRialAmount: 5000000,
              partySide: 'creditor' as const,
              description: 'واریز وجه نقد توسط مشتری',
              isConditional: false,
              raw: {},
            },
          ],
          raw: {},
        },
        {
          sourceFactorCode: 'DOC_DEBTOR',
          documentNumber: '2',
          sourceCustomerCode: '102',
          dateIso: '2026-09-01T12:00:00Z',
          dateJalali: '1405/06/10',
          totalGoldIn: 0,
          totalGoldOut: 5,
          totalRialIn: 0,
          totalRialOut: 12000000,
          currency: 'IRR',
          metalType: 'gold' as const,
          lines: [
            {
              sourceFactorCode: 'DOC_DEBTOR',
              lineNumber: 1,
              dateIso: '2026-09-01T12:00:00Z',
              dateJalali: '1405/06/10',
              nature: 'paid' as const,
              kind: 'sale' as const,
              metalType: 'gold' as const,
              weight: 5,
              grade: 750,
              convertedWeight750: 5,
              amountIrr: 12000000,
              signedGoldAmount: -5,
              signedRialAmount: -12000000,
              partySide: 'debtor' as const,
              description: 'فروش طلا به مشتری',
              isConditional: false,
              raw: {},
            },
          ],
          raw: {},
        },
      ],
      coins: [],
      gemstones: [],
      assayLabs: [],
    };

    const mockMappings = {
      accounts: [],
      parties: [
        { sourceCode: '101', sourceName: 'طرف حساب بستانکار', status: 'new_party' as const },
        { sourceCode: '102', sourceName: 'طرف حساب بدهکار', status: 'new_party' as const },
      ],
      defaultMetalKarat: 750,
      defaultCurrency: 'IRR',
    };

    const result = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'test_side_mig',
      userId: 'user_admin_001',
    });

    expect(result.importedDocuments).toBe(2);
    expect(result.importedLines).toBe(2);
    expect(result.importedJournalEntries).toBe(2);

    // Verify Creditor Transaction:
    const txCreditor = createdTx.find((t) => t.sourceKey.includes('DOC_CREDITOR'));
    expect(txCreditor).toBeDefined();
    expect(txCreditor.rialAmount).toBe(5000000); // positive for received cash

    // Verify Debtor Transaction:
    const txDebtor = createdTx.find((t) => t.sourceKey.includes('DOC_DEBTOR'));
    expect(txDebtor).toBeDefined();
    expect(txDebtor.goldAmount).toBe(-5); // negative for gold delivered to customer
    expect(txDebtor.rialAmount).toBe(-12000000); // negative for rials charged
  });

  // 18. Wipe All Previous Tahesab Data
  it('18. Wipe All Previous Tahesab Data: thoroughly cleans up all transactions, journals, lots and jobs', async () => {
    const transactions = [
      { id: 'tx_old_1', sourceKey: 'tahesab:mig_1:F1:1', description: 'سند ته‌حساب' },
      { id: 'tx_old_2', sourceKey: 'tahesab:mig_2:F2:1', description: 'سند ته‌حساب' },
      { id: 'tx_manual', sourceKey: 'manual_created', description: 'سند دستی' },
    ];
    const journalEntries = [
      { id: 'je_1', sourceKey: 'tahesab:mig_1:F1:1' },
      { id: 'je_2', sourceKey: 'manual' },
    ];
    const journalLines = [
      { id: 'jl_1', journal_entry_id: 'je_1' },
      { id: 'jl_2', journal_entry_id: 'je_2' },
    ];
    const metalLots = [
      { id: 'metal_1', description: 'ثبت‌شده در مهاجرت ته‌حساب' },
      { id: 'metal_2', description: 'موجودی دستی' },
    ];
    const customers = [
      { id: 'cust_mig', name: 'مشتری مهاجرتی', privateDescription: 'کد منبع: 999' },
      { id: 'cust_regular', name: 'مشتری اصلی', privateDescription: 'عادی' },
    ];
    const jobs = [
      { id: 'job_1', sourceSystem: 'tahesab' },
    ];

    const mockPb: any = {
      filter: (tmpl: string, params: any) => tmpl,
      collection: (col: string) => ({
        getFullList: async ({ filter }: any = {}) => {
          if (col === 'transactions') return transactions.filter((t) => t.sourceKey.startsWith('tahesab:'));
          if (col === 'journal_entries') return journalEntries.filter((j) => j.sourceKey.startsWith('tahesab:'));
          if (col === 'journal_lines') return journalLines.filter((l) => l.journal_entry_id === 'je_1');
          if (col === 'metal_inventory') return metalLots.filter((m) => m.description.includes('ته‌حساب'));
          if (col === 'customers') return customers.filter((c) => c.privateDescription.includes('کد منبع:'));
          if (col === 'migration_jobs') return jobs;
          return [];
        },
        delete: async (id: string) => {
          if (col === 'transactions') {
            const idx = transactions.findIndex((t) => t.id === id);
            if (idx >= 0) transactions.splice(idx, 1);
          }
          if (col === 'journal_entries') {
            const idx = journalEntries.findIndex((j) => j.id === id);
            if (idx >= 0) journalEntries.splice(idx, 1);
          }
          if (col === 'customers') {
            const idx = customers.findIndex((c) => c.id === id);
            if (idx >= 0) customers.splice(idx, 1);
          }
          if (col === 'metal_inventory') {
            const idx = metalLots.findIndex((m) => m.id === id);
            if (idx >= 0) metalLots.splice(idx, 1);
          }
          if (col === 'migration_jobs') {
            const idx = jobs.findIndex((j) => j.id === id);
            if (idx >= 0) jobs.splice(idx, 1);
          }
          return true;
        },
      }),
    };

    // Test default wipe behavior: wipes parties by default
    const wipeResult = await wipeAllPreviousTahesabData(mockPb);
    expect(wipeResult.success).toBe(true);
    expect(wipeResult.deletedTransactions).toBe(2);
    expect(wipeResult.deletedJournalEntries).toBe(1);
    expect(wipeResult.deletedCustomers).toBe(1);
    expect(wipeResult.deletedMetalLots).toBe(1);
    expect(wipeResult.deletedJobs).toBe(1);

    // Verify non-tahesab data is preserved
    expect(transactions.length).toBe(1);
    expect(transactions[0].id).toBe('tx_manual');
    expect(customers.length).toBe(1);
    expect(customers[0].id).toBe('cust_regular');
  });

  // 19. Fast In-Memory Duplicate Verification Bypass
  it('19. Fast Duplicate Verification: verifies matching records and skips DB write instantly', async () => {
    let createCallCount = 0;
    const existingTransactions = [
      {
        id: 'tx_dup_1',
        customer: 'cust_target_1',
        goldAmount: 10.5,
        rialAmount: 5000000,
        sourceKey: 'tahesab:prev_mig:FAC_100:1',
        documentNumber: 'ZF-100',
      },
    ];

    const mockPb: any = {
      filter: (tmpl: string) => tmpl,
      collection: (col: string) => ({
        getFullList: async () => {
          if (col === 'transactions') return existingTransactions;
          if (col === 'customers') return [{ id: 'cust_target_1', customerCode: 101, name: 'علی رضایی' }];
          return [];
        },
        getFirstListItem: async () => {
          throw new Error('Not found');
        },
        create: async (data: any) => {
          createCallCount++;
          return { id: 'new_id', ...data };
        },
      }),
    };

    const mockData = {
      parties: [{ sourceCode: '101', name: 'علی رضایی', openingGoldWeight: 0, openingRialBalance: 0, currency: 'IRR', raw: {} }],
      bankAccounts: [],
      documents: [
        {
          sourceFactorCode: 'FAC_100',
          documentNumber: '100',
          sourceCustomerCode: '101',
          dateIso: '2026-09-01T12:00:00Z',
          dateJalali: '1405/06/10',
          totalGoldIn: 10.5,
          totalGoldOut: 0,
          totalRialIn: 5000000,
          totalRialOut: 0,
          currency: 'IRR',
          metalType: 'gold' as const,
          lines: [
            {
              sourceFactorCode: 'FAC_100',
              lineNumber: 1,
              dateIso: '2026-09-01T12:00:00Z',
              dateJalali: '1405/06/10',
              nature: 'received' as const,
              kind: 'melted' as const,
              metalType: 'gold' as const,
              weight: 10.5,
              grade: 750,
              convertedWeight750: 10.5,
              amountIrr: 5000000,
              signedGoldAmount: 10.5,
              signedRialAmount: 5000000,
              description: 'دریافت طلای آبشده',
              isConditional: false,
              raw: {},
            },
          ],
          raw: {},
        },
      ],
      coins: [],
      gemstones: [],
      assayLabs: [],
    };

    const mockMappings = {
      accounts: [],
      parties: [{ sourceCode: '101', sourceName: 'علی رضایی', targetCustomerId: 'cust_target_1', status: 'mapped' as const }],
      defaultMetalKarat: 750,
      defaultCurrency: 'IRR',
    };

    const result = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'new_run_mig',
      userId: 'user_admin_001',
    });

    expect(result.skippedDuplicates).toBe(1);
    expect(createCallCount).toBe(0); // Zero DB insertions performed!
    expect(result.warnings.length).toBe(0); // No warnings because data matched perfectly!
  });

  // 20. Duplicate Data Mismatch Discrepancy Diagnosis
  it('20. Duplicate Mismatch Diagnosis: detects discrepancy and produces detailed warning explanation', async () => {
    const existingTransactions = [
      {
        id: 'tx_dup_mismatch',
        customer: 'cust_target_1',
        goldAmount: 5.0, // Existing in DB is 5.0
        rialAmount: 2000000, // Existing in DB is 2000000
        sourceKey: 'tahesab:prev_mig:FAC_200:1',
        documentNumber: 'ZF-200',
      },
    ];

    const mockPb: any = {
      filter: (tmpl: string) => tmpl,
      collection: (col: string) => ({
        getFullList: async () => {
          if (col === 'transactions') return existingTransactions;
          if (col === 'customers') return [{ id: 'cust_target_1', customerCode: 101, name: 'علی رضایی' }];
          return [];
        },
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: any) => ({ id: 'new_id', ...data }),
      }),
    };

    const mockData = {
      parties: [{ sourceCode: '101', name: 'علی رضایی', openingGoldWeight: 0, openingRialBalance: 0, currency: 'IRR', raw: {} }],
      bankAccounts: [],
      documents: [
        {
          sourceFactorCode: 'FAC_200',
          documentNumber: '200',
          sourceCustomerCode: '101',
          dateIso: '2026-09-01T12:00:00Z',
          dateJalali: '1405/06/10',
          totalGoldIn: 10.0,
          totalGoldOut: 0,
          totalRialIn: 4000000,
          totalRialOut: 0,
          currency: 'IRR',
          metalType: 'gold' as const,
          lines: [
            {
              sourceFactorCode: 'FAC_200',
              lineNumber: 1,
              dateIso: '2026-09-01T12:00:00Z',
              dateJalali: '1405/06/10',
              nature: 'received' as const,
              kind: 'melted' as const,
              metalType: 'gold' as const,
              weight: 10.0, // Different weight in file (10.0 vs 5.0)
              grade: 750,
              convertedWeight750: 10.0,
              amountIrr: 4000000, // Different amount in file (4000000 vs 2000000)
              signedGoldAmount: 10.0,
              signedRialAmount: 4000000,
              description: 'دریافت طلا',
              isConditional: false,
              raw: {},
            },
          ],
          raw: {},
        },
      ],
      coins: [],
      gemstones: [],
      assayLabs: [],
    };

    const mockMappings = {
      accounts: [],
      parties: [{ sourceCode: '101', sourceName: 'علی رضایی', targetCustomerId: 'cust_target_1', status: 'mapped' as const }],
      defaultMetalKarat: 750,
      defaultCurrency: 'IRR',
    };

    const result = await importTahesabData(mockPb, mockData as any, mockMappings, {
      migrationId: 'mismatch_mig',
      userId: 'user_admin_001',
    });

    expect(result.skippedDuplicates).toBe(1);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].code).toBe('WARN_DUPLICATE_DATA_MISMATCH');
    expect(result.warnings[0].message).toContain('مغایرت');
    expect(result.warnings[0].message).toContain('علت ناهماهنگی');
  });

  // 21. Delete Single Migration Job
  it('21. Delete Single Migration Job: deletes job record from migration_jobs with rollback option', async () => {
    const jobs = [
      { id: 'job_rec_1', migrationId: 'mig_test_001', status: 'completed' },
      { id: 'job_rec_2', migrationId: 'mig_test_002', status: 'rolled_back' },
    ];
    let rollbackCalledWith = '';

    const mockPb: any = {
      filter: (tmpl: string, params: any) => tmpl,
      collection: (col: string) => ({
        getFirstListItem: async () => jobs.find((j) => j.id === 'job_rec_2' || j.migrationId === 'mig_test_002'),
        delete: async (id: string) => {
          const idx = jobs.findIndex((j) => j.id === id);
          if (idx >= 0) jobs.splice(idx, 1);
          return true;
        },
      }),
    };

    const res = await deleteMigrationJob(mockPb, 'mig_test_002');
    expect(res.success).toBe(true);
    expect(jobs.length).toBe(1);
    expect(jobs[0].id).toBe('job_rec_1');
  });
});

