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
import type { TahesabRawDatabase } from '../features/migration/tahesab/parser/tahesab-parser';

const FIXTURE_PATH = path.resolve(process.cwd(), '../migration/tahesab/fixtures/1.mcbk');
const SYMLINK_FIXTURE_PATH = path.resolve(process.cwd(), '../migration/tahesab/fixtures/Tahesab_Backup_1405-06-26.Mcbk');

describe('Tahesab Accounting Migration Engine Tests', () => {
  // 1. Detection
  it('1. Backup Detection: correctly detects Tahesab .Mcbk archive container and metadata', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) return;

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

  // 1.2 .mbck Extension Detection
  it('1.2. Detects via .mbck file extension path', async () => {
    const mbckPath = path.resolve(process.cwd(), '../migration/tahesab/fixtures/1.mbck');
    if (fs.existsSync(mbckPath)) {
      const result = await detectTahesabBackup(mbckPath);
      expect(result.isTahesab).toBe(true);
      expect(result.backupInfo?.version).toBe('10.1405.4.20');
    }
  });

  // 2. Parser & SQL Table Discovery
  it('2. Parser & Table Discovery: parses SQL Server dump and discovers all financial tables', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) return;
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
    if (!fs.existsSync(FIXTURE_PATH)) return;
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
    if (!fs.existsSync(FIXTURE_PATH)) return;
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
    if (!fs.existsSync(FIXTURE_PATH)) return;
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
    if (!fs.existsSync(FIXTURE_PATH)) return;
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 500 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    let conditionalFound = false;
    for (const doc of normalized.documents) {
      for (const line of doc.lines) {
        if ((line.isConditional || line.kind === 'melted') && line.assayStampNumber) {
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
    if (!fs.existsSync(FIXTURE_PATH)) return;
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
    if (!fs.existsSync(FIXTURE_PATH)) return;
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 1000 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    const usdDoc = normalized.documents.find((d) => d.currency === 'USD' || d.lines.some((l) => l.foreignCurrency === 'USD'));
    expect(usdDoc).toBeDefined();
  });

  // 12. Validation & Preview
  it('12. Validation & Preview: generates full preview stats without blocking errors', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) return;
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

  // 22. Assay Laboratory Reconciliation & Matching
  it('22. Assay Laboratory Reconciliation: accurately reconciles Tahesab raygiri with Zarfolio catalog and document lines', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) return;
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 200 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    expect(normalized.assayLabs.length).toBe(305);

    // Verify document line assayLabName extraction from name_az
    const docWithAssay = normalized.documents.find((d) => d.lines.some((l) => l.assayLabName));
    expect(docWithAssay).toBeDefined();
    const assayLine = docWithAssay?.lines.find((l) => l.assayLabName);
    expect(assayLine?.assayLabName).toBeTruthy();

    // Verify buildAssayLabMappings matches against official Zarfolio catalog
    const existingDbLabs = [
      { id: 'db_lab_kaveh', name: 'آزمایشگاه طلا و نقره کاوه', phone: '02155555555' },
      { id: 'db_lab_daghigh', name: 'ری‌گیری دقیق ری', phone: '02155933299' },
    ];

    const mappings = buildInitialMappings(normalized, [], [], existingDbLabs);
    expect(mappings.assayLabs).toBeDefined();
    expect(mappings.assayLabs?.length).toBe(305);

    // Check specific known laboratories
    const daghighMatch = mappings.assayLabs?.find((l) => l.sourceName === 'دقیق ری تهران');
    expect(daghighMatch).toBeDefined();
    expect(daghighMatch?.status).toBe('mapped');
    expect(daghighMatch?.targetAssayLabName).toContain('ری');

    const masoudMatch = mappings.assayLabs?.find((l) => l.sourceName === 'مسعود تهران');
    expect(masoudMatch).toBeDefined();
    expect(masoudMatch?.status).toBe('mapped');
    expect(masoudMatch?.matchType).toBe('exact_phone');

    // Test validation stats
    const validation = validateTahesabMigration(normalized, mappings);
    expect(validation.preview.totalAssayLabs).toBe(305);
    expect(validation.preview.totalMappedAssayLabs).toBeGreaterThan(200);
    expect(validation.preview.totalNewAssayLabs).toBeLessThan(100);

    // Test import linking to metal_inventory and docDetails
    const createdTransactions: any[] = [];
    const createdMetalInventory: any[] = [];
    const mockPb: any = {
      filter: (tmpl: string) => tmpl,
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        getFullList: async () => [],
        create: async (data: any) => {
          if (col === 'transactions') createdTransactions.push(data);
          if (col === 'metal_inventory') createdMetalInventory.push(data);
          return { id: `rec_${col}_${Date.now()}`, ...data };
        },
      }),
    };

    const mockDocData = {
      backupInfo: { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 },
      parties: [{ sourceCode: '100', name: 'مشتری طلا', openingGoldWeight: 0, openingRialBalance: 0, currency: 'IRR', raw: {} }],
      bankAccounts: [],
      coins: [],
      gemstones: [],
      inventory: [],
      assayLabs: [{ name: 'دقیق ری تهران', phone: '02155933299', raw: {} }],
      documents: [
        {
          sourceFactorCode: 'DOC_TEST_ASSAY',
          documentNumber: '9001',
          dateIso: '2026-09-01T10:00:00Z',
          dateJalali: '1405/06/11',
          sourceCustomerCode: '100',
          currency: 'IRR',
          lines: [
            {
              sourceFactorCode: 'DOC_TEST_ASSAY',
              lineNumber: 1,
              nature: 'received',
              kind: 'melted',
              metalType: 'gold',
              weight: 50,
              grade: 750,
              convertedWeight750: 50,
              amountIrr: 0,
              assayStampNumber: '78451',
              assayLabName: 'دقیق ری تهران',
              isConditional: false,
              signedGoldAmount: 50,
              signedRialAmount: 0,
              raw: {},
            },
          ],
        },
      ],
    };

    const testMappings = buildInitialMappings(mockDocData as any, [], [], existingDbLabs);
    const impRes = await importTahesabData(mockPb, mockDocData as any, testMappings, {
      migrationId: 'test_assay_mig',
      userId: 'test_user',
    });

    expect(impRes.importedDocuments).toBe(1);
    expect(createdMetalInventory.length).toBe(1);
    expect(createdMetalInventory[0].lab_name).toContain('ری');
    expect(createdMetalInventory[0].stamp_number).toBe('78451');

    expect(createdTransactions.length).toBe(1);
    const docDetails = JSON.parse(createdTransactions[0].documentDetails);
    expect(docDetails.assayStampNumber).toBe('78451');
    expect(docDetails.assayLabName).toContain('ری');
    expect(docDetails.labName).toContain('ری');
  });

  // 23. Metal Type & Karat Precision Detection
  it('23. Metal Type & Karat Detection: accurately distinguishes silver vs gold, extracts line-level ayar and deduces missing ayar from tabdil', () => {
    const rawDb: any = {
      moshtarian: [{ mcode: '10', name: 'مشتری طلا و نقره' }],
      hesab: [
        {
          Factor_Code: 'F_MIXED_1',
          sh_factor: '101',
          mcode: '10',
          Tarikh: '2026-09-01 12:00:00',
          Jens_Felez: '0', // Factor header says gold
        },
      ],
      hesab_detail: [
        {
          Factor_Code: 'F_MIXED_1',
          no: 'ورود طلا',
          vazn: '100',
          ayar: '750',
          tabdil750_v: '100',
          Jens_Felez: '0',
          Abshode: '-1',
        },
        {
          Factor_Code: 'F_MIXED_1',
          no: 'ورود طلا',
          vazn: '200',
          ayar: '925',
          tabdil750_v: '200',
          Jens_Felez: '2', // Detail explicitly silver
          Abshode: '-1',
        },
        {
          Factor_Code: 'F_MIXED_1',
          no: 'ورود طلا',
          vazn: '10',
          ayar: '0', // Missing ayar, but tabdil is 10
          tabdil750_v: '10',
          Jens_Felez: '0',
          Abshode: '-1',
        },
        {
          Factor_Code: 'F_MIXED_1',
          no: 'خرید سنگ',
          vazn: '5.5',
          ayar: null,
          Jens_Felez: null,
          Sharh: 'یاقوت قرمز',
        },
      ],
      Hesab_bank: [],
      bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 });
    const doc = norm.documents[0];
    expect(doc.lines.length).toBe(4);

    // Line 1: Gold 750
    expect(doc.lines[0].metalType).toBe('gold');
    expect(doc.lines[0].grade).toBe(750);
    expect(doc.lines[0].convertedWeight750).toBe(100);

    // Line 2: Silver 925
    expect(doc.lines[1].metalType).toBe('silver');
    expect(doc.lines[1].grade).toBe(925);

    // Line 3: Gold with missing ayar deduced as 750 from tabdil 10 / vazn 10
    expect(doc.lines[2].metalType).toBe('gold');
    expect(doc.lines[2].grade).toBe(750);
    expect(doc.lines[2].convertedWeight750).toBe(10);

    // Line 4: Stone -> metalType is none
    expect(doc.lines[3].metalType).toBe('none');
    expect(doc.lines[3].signedGoldAmount).toBe(0);
  });

  // 24. Customer Balance Accuracy
  it('24. Customer Balance Accuracy: customer balances computed from migrated records match Tahesab balances', async () => {
    const rawDb: TahesabRawDatabase = {
      moshtarian: [
        {
          code: '101',
          name: 'محمد رضایی',
          tahesabtala: '0',
          tahesabriali: '0',
          JamV_T: '85.250',
          JamV_P: '15000000',
          Tel: '09121111111',
        },
        {
          code: '102',
          name: 'حساب انتقالی بدون سند',
          tahesabtala: '0',
          tahesabriali: '0',
          JamV_T: '-12.500',
          JamV_P: '-2500000',
          Tel: '09122222222',
        },
      ],
      hesab: [
        {
          Factor_Code: 'F_1',
          sh_factor: '1',
          mcode: '101',
          Tarikh: '2026-01-01 10:00:00',
          geram_v: '0',
          geram_kh: '10',
          rial_v: '0',
          rial_kh: '5000000',
        },
        {
          Factor_Code: 'F_2',
          sh_factor: '2',
          mcode: '101',
          Tarikh: '2026-01-02 11:00:00',
          geram_v: '100',
          geram_kh: '0',
          rial_v: '20000000',
          rial_kh: '0',
        },
        {
          Factor_Code: 'F_3',
          sh_factor: '3',
          mcode: '101',
          Tarikh: '2026-01-03 12:00:00',
          geram_v: '0',
          geram_kh: '4.750',
          rial_v: '0',
          rial_kh: '0',
        },
        {
          Factor_Code: 'F_4',
          sh_factor: '4',
          mcode: '101',
          Tarikh: '2026-01-04 13:00:00',
          geram_v: '0',
          geram_kh: '0',
          rial_v: '0',
          rial_kh: '0',
        },
      ],
      hesab_detail: [
        // F_1: Opening balance (از قبل) -> Gold exit 10g, Rial exit 5M
        {
          Factor_Code: 'F_1',
          mcode: '101',
          no: 'از قبل',
          tabdil750_v: '0',
          tabdil750_kh: '10',
          rial_V: '0',
          rial_kh: '5000000',
          Jens_Felez: '0',
        },
        // F_2: Entry -> Gold in 100g, Rial in 20M
        {
          Factor_Code: 'F_2',
          mcode: '101',
          no: 'ورود طلا',
          tabdil750_v: '100',
          tabdil750_kh: '0',
          rial_V: '20000000',
          rial_kh: '0',
          Jens_Felez: '0',
        },
        // F_3: Exit -> Gold out 4.750g
        {
          Factor_Code: 'F_3',
          mcode: '101',
          no: 'خروج طلا',
          tabdil750_v: '0',
          tabdil750_kh: '4.750',
          rial_V: '0',
          rial_kh: '0',
          Jens_Felez: '0',
        },
        // F_4 Row 1: Sale of goods (Resin) with vazn: 0.89 but tv=0, tkh=0 -> MUST NOT affect gold!
        {
          Factor_Code: 'F_4',
          mcode: '101',
          no: 'فروش کالا',
          NO_kar: 'رزین قالب‌گیری',
          vazn: '0.89',
          ayar: null,
          tabdil750_v: '0',
          tabdil750_kh: '0',
          rial_V: '0',
          rial_kh: '0',
          Jens_Felez: null,
        },
        // F_4 Row 2: Silver entry -> Goes to silver, MUST NOT affect gold!
        {
          Factor_Code: 'F_4',
          mcode: '101',
          no: 'ورود طلا',
          NO_kar: 'شمش نقره',
          vazn: '50',
          ayar: '925',
          tabdil750_v: '50',
          tabdil750_kh: '0',
          rial_V: '0',
          rial_kh: '0',
          Jens_Felez: '2',
        },
      ],
      Hesab_bank: [],
      bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 });

    // Customer 101 verification
    const party101 = norm.parties.find((p) => p.sourceCode === '101');
    expect(party101).toBeDefined();
    expect(party101?.openingGoldWeight).toBe(85.250);
    expect(party101?.openingRialBalance).toBe(15000000);

    const docs101 = norm.documents.filter((d) => d.sourceCustomerCode === '101');
    let sumGold101 = 0;
    let sumSilver101 = 0;
    let sumRial101 = 0;
    for (const d of docs101) {
      for (const l of d.lines) {
        if (l.metalType === 'gold') sumGold101 += l.signedGoldAmount || 0;
        if (l.metalType === 'silver') sumSilver101 += l.signedGoldAmount || 0;
        sumRial101 += l.signedRialAmount || 0;
      }
    }

    // Exact gold balance match: -10 + 100 - 4.750 = 85.250g
    expect(Math.round(sumGold101 * 1000) / 1000).toBe(85.250);
    expect(Math.round(sumGold101 * 1000) / 1000).toBe(party101?.openingGoldWeight ?? 0);

    // Exact rial balance match: -5,000,000 + 20,000,000 = 15,000,000 IRR
    expect(sumRial101).toBe(15000000);
    expect(sumRial101).toBe(party101?.openingRialBalance ?? 0);

    // Silver segregated accurately: 50g silver
    expect(sumSilver101).toBe(50);

    // Customer 102 (Party with opening balance and no documents)
    const party102 = norm.parties.find((p) => p.sourceCode === '102');
    expect(party102).toBeDefined();
    expect(party102?.openingGoldWeight).toBe(-12.500);
    expect(party102?.openingRialBalance).toBe(-2500000);

    // Test import process creates opening balance transaction for documentless party 102
    const createdRecords: Record<string, any[]> = {};
    const createdKeys = new Set<string>();
    const mockWriter = {
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
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `created_${col}_${Date.now()}_${Math.random()}`, ...data };
          createdRecords[col].push(rec);
          if (data.sourceKey) {
            createdKeys.add(data.sourceKey);
          }
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(
      mockWriter as any,
      norm,
      buildInitialMappings(norm, [], []),
      { migrationId: 'test_bal_mig', dryRun: false },
    );

    const txRecords = createdRecords['transactions'] || [];
    const openTx102 = txRecords.find((tx) => tx.customerCode === 102 && tx.isOpeningBalance);
    expect(openTx102).toBeDefined();
    expect(openTx102.goldAmount).toBe(-12.500);
    expect(openTx102.rialAmount).toBe(-2500000);
  });

  // 25. Foreign Currency & Remittance Differentiation
  it('25. Foreign Currency & Remittance Differentiation: correctly identifies unsettled currency purchase/sale from description, distinguishes from gold misc, and sets accurate accounting article and tab', async () => {
    const rawDb: TahesabRawDatabase = {
      moshtarian: [
        {
          code: '481',
          name: 'شاهین زینالی دلار',
          Arz: 'IRR',
          Arz2: 'USD',
          tahesabtala: '0',
          tahesabriali: '0',
          JamV_T: '0',
          JamV_P: '0',
        },
        {
          code: '188',
          name: 'بهروز نعمتی',
          Arz: 'IRR',
          Arz2: 'USD',
          tahesabtala: '0',
          tahesabriali: '0',
          JamV_T: '0',
          JamV_P: '0',
        },
      ],
      hesab: [
        {
          Factor_Code: 'F_HAVALEH_REC',
          sh_factor: '3',
          mcode: '481',
          Tarikh: '2025-02-18 13:46:25.567',
          Rec: 'شاهین زینالی دلار',
          Arz: 'USD',
        },
        {
          Factor_Code: 'F_HAVALEH_SND',
          sh_factor: '5',
          mcode: '188',
          Tarikh: '2025-02-18 13:46:27.180',
          Rec: 'بهروز نعمتی',
          Arz: 'USD',
        },
      ],
      hesab_detail: [
        {
          Factor_Code: 'F_HAVALEH_REC',
          mcode: '481',
          no: 'خروج وجه نقد',
          Sharh: '(حواله از: 188 بهروز نعمتی)',
          Command: '#HAVALEH#811085188#46446',
          Arz: 'USD',
          rial_kh: '50',
          Tahesab_p: '-50',
          Tahesab_t: '0',
        },
        {
          Factor_Code: 'F_HAVALEH_SND',
          mcode: '188',
          no: 'ورود وجه نقد',
          Sharh: '(حواله به: 481 شاهین زینالی دلار)',
          Command: '#hshbe#811085188#46446',
          Arz: 'USD',
          rial_V: '50',
          Tahesab_p: '-1.52',
          Tahesab_t: '0',
        },
      ],
      Hesab_bank: [],
      bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, { mohitCount: 1, dbType: 'SQL', version: '10.0', archiveCount: 0 });

    // 1. Verify receiver (Shahin Zeinali Dollar)
    const docRec = norm.documents.find((d) => d.sourceFactorCode === 'F_HAVALEH_REC');
    expect(docRec).toBeDefined();
    const lineRec = docRec!.lines[0];
    expect(lineRec.kind).toBe('currency');
    expect(lineRec.metalType).toBe('none');
    expect(lineRec.nature).toBe('received');
    expect(lineRec.partySide).toBe('creditor');
    expect(lineRec.foreignAmount).toBe(50);
    expect(lineRec.foreignCurrency).toBe('USD');
    expect(lineRec.signedForeignAmount).toBe(50);
    expect(lineRec.weight).toBe(0);
    expect(lineRec.convertedWeight750).toBe(0);

    // 2. Verify sender (Behrouz Nemati)
    const docSnd = norm.documents.find((d) => d.sourceFactorCode === 'F_HAVALEH_SND');
    expect(docSnd).toBeDefined();
    const lineSnd = docSnd!.lines[0];
    expect(lineSnd.kind).toBe('currency');
    expect(lineSnd.metalType).toBe('none');
    expect(lineSnd.nature).toBe('paid');
    expect(lineSnd.partySide).toBe('debtor');
    expect(lineSnd.foreignAmount).toBe(50);
    expect(lineSnd.foreignCurrency).toBe('USD');
    expect(lineSnd.signedForeignAmount).toBe(-50);

    // 3. Test Import
    const createdRecords: Record<string, any[]> = {};
    const mockWriter = {
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: Record<string, any>) => {
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `tx_${Date.now()}_${Math.random()}`, ...data };
          createdRecords[col].push(rec);
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(
      mockWriter,
      norm,
      buildInitialMappings(norm, [], []),
      { migrationId: 'test_cur_mig', dryRun: false },
    );

    const txList = createdRecords['transactions'] || [];
    expect(txList.length).toBe(2);

    const txRec = txList.find((t) => t.customerCode === 481);
    expect(txRec).toBeDefined();
    expect(txRec.documentTab).toBe('currency');
    expect(txRec.documentSubType).toBe('currency-buy');
    expect(txRec.documentNature).toBe('received');
    expect(txRec.foreignAmount).toBe(50);
    expect(txRec.foreignCurrency).toBe('USD');
    expect(txRec.goldAmount).toBe(0);
    expect(txRec.rialAmount).toBe(0);

    const recDetails = JSON.parse(txRec.documentDetails);
    expect(recDetails.rawKind).toBeUndefined();
    expect(recDetails.metalType).toBeUndefined();
    expect(recDetails.currencyQuantity).toBe(50);
    expect(recDetails.currencyUnit).toBe('USD');
    expect(recDetails.isHawala).toBe(true);
    expect(recDetails.hawalaCounterCustomerName).toBe('بهروز نعمتی');
    expect(recDetails.hawalaCounterCustomerCode).toBe('188');

    // 4. Verify breakdown
    const {
      getDocumentLineDescription,
      getJournalLineBadge,
      parseTransactionBreakdown,
    } = await import('@/features/customers/utils/document-breakdown');

    const desc = getDocumentLineDescription(txRec);
    expect(desc.primary).toBe('حواله ارزی از: بهروز نعمتی (188)');

    const badge = getJournalLineBadge(txRec);
    expect(badge.accountCode).toBe('۱۱۲۰');
    expect(badge.accountTitle).toBe('اسناد و حساب‌های دریافتنی');
    expect(badge.badgeColor).toBe('sky');

    const itemSpec = parseTransactionBreakdown(txRec);
    expect(itemSpec.category).toBe('currency');
    expect(itemSpec.categoryLabel).toBe('حواله ارزی');
    expect(itemSpec.badgeColor).toBe('purple');
    expect(itemSpec.attributes.find((a) => a.label === 'طرف حواله')?.value).toContain('بهروز نعمتی');
  });

  // 26. Currency Mapping & Foreign Currency Cash Receipt Detection
  it('26. Foreign Currency Cash Receipt & Currency Mapping: accurately detects currency unit in cash receipts and generates currency mappings', async () => {
    const rawDb: TahesabRawDatabase = {
      moshtarian: [
        {
          code: '481',
          name: 'شاهین زینالی دلار',
          Arz2: 'USD',
          tel: '09120000000',
        },
      ],
      hesab: [
        {
          Factor_Code: '2',
          code: '481',
          sh_factor: '2',
          tarikh: '1403/11/23',
          Arz: 'USD',
          mande_bed: '0',
          mande_bes: '0',
        },
      ],
      hesab_detail: [
        {
          Factor_Code: '2',
          radif: '1',
          no: 'خرید ارز',
          Count: '800',
          FiF: '927000',
          rial_V: '741600000',
          rial_kh: '0',
          Sharh: '',
        },
        {
          Factor_Code: '2',
          radif: '2',
          no: 'طلب',
          Count: '0',
          FiF: '0',
          rial_V: '0',
          rial_kh: '800',
          Sharh: '#DSD1',
        },
        {
          Factor_Code: '2',
          radif: '3',
          no: 'ورود وجه نقد',
          Count: '0',
          FiF: '0',
          rial_V: '800',
          rial_kh: '0',
          Sharh: '',
        },
        {
          Factor_Code: '2',
          radif: '4',
          no: 'خروج وجه از حساب بانکی',
          Count: '0',
          FiF: '0',
          rial_V: '0',
          rial_kh: '741600000',
          name_bank: 'اقتصاد نوین',
          Sharh: '',
        },
      ],
      bank: [],
      Hesab_bank: [
        {
          n_bank: 'اقتصاد نوین',
          Sh_Hesab: '6274121198087223',
          MojoodiA: '1000000000',
          MoJoodi: '1000000000',
        },
      ],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const info = parseBackupInfo('Info.Date=1403/11/23\nMohitCount=1\nVersion=10.1405.4.20');
    const norm = normalizeTahesabData(rawDb, info);

    // 1. Verify detected currencies in normalized data
    expect(norm.currencies).toContain('USD');

    // 2. Verify mappings generation includes currency mapping
    const mappings = buildInitialMappings(norm, [], [], [], [
      { id: 'curr_usd_pb', code: 'USD', name: 'دلار آمریکا', symbol: '$', isSystem: true },
    ]);
    expect(mappings.currencies).toBeDefined();
    expect(mappings.currencies!.length).toBeGreaterThan(0);

    const usdMapping = mappings.currencies!.find((c) => c.sourceCode === 'USD');
    expect(usdMapping).toBeDefined();
    expect(usdMapping?.targetCurrencyCode).toBe('USD');
    expect(usdMapping?.targetCurrencyName).toBe('دلار آمریکا');
    expect(usdMapping?.targetCurrencySymbol).toBe('$');
    expect(usdMapping?.status).toBe('mapped');

    // 3. Verify normalized document and lines: Error pair (طلب 800 & ورود وجه نقد 800) neutralized!
    const doc = norm.documents.find((d) => d.sourceFactorCode === '2');
    expect(doc).toBeDefined();
    expect(doc!.lines.length).toBe(2); // exactly 2 clean lines, zero 80 Toman phantom line!

    // Line 1: خرید ارز (800 USD, 741,600,000 IRR)
    const lineTrade = doc!.lines[0];
    expect(lineTrade.kind).toBe('currency');
    expect(lineTrade.foreignAmount).toBe(800);
    expect(lineTrade.foreignCurrency).toBe('USD');
    expect(lineTrade.amountIrr).toBe(741600000);

    // Line 2: خروج وجه از حساب بانکی (اقتصاد نوین)
    const lineBank = doc!.lines[1];
    expect(lineBank.kind).toBe('bank');
    expect(lineBank.bankName).toBe('اقتصاد نوین');
    expect(lineBank.bankAccountNumber).toBe('6274121198087223');
    expect(lineBank.amountIrr).toBe(741600000);
    expect(lineBank.nature).toBe('paid');

    // 4. Test Import to verify transactions table persistence
    const createdRecords: Record<string, any[]> = {};
    const mockWriter = {
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: Record<string, any>) => {
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `tx_${Date.now()}_${Math.random()}`, ...data };
          createdRecords[col].push(rec);
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(
      mockWriter,
      norm,
      mappings,
      { migrationId: 'test_factor2_mig', dryRun: false },
    );

    const txList = createdRecords['transactions'] || [];
    expect(txList.length).toBe(2);

    const txBank = txList.find((t) => t.documentTab === 'bank');
    expect(txBank).toBeDefined();
    expect(txBank.documentSubType).toBe('pay-to-customer');
    expect(txBank.rialAmount).toBe(-741600000);

    const bankDetails = JSON.parse(txBank.documentDetails);
    expect(bankDetails.bankName).toBe('اقتصاد نوین');
    expect(bankDetails.bankAccountNumber).toBe('6274121198087223');
  });

  // 27. Direct Foreign Cash Receipt (Factor 4804 - Shahin Zeinali)
  it('27. Foreign Cash Receipt: accurately imports direct USD cash in to cash vault with 0 IRR effect', async () => {
    const rawDb: any = {
      moshtarian: [
        {
          code: '481',
          name: 'شاهین زینالی دلار',
          Arz2: 'USD',
        },
      ],
      hesab: [
        {
          Factor_Code: '4804',
          code: '481',
          sh_factor: '4804',
          Arz: 'USD',
        },
      ],
      hesab_detail: [
        {
          Factor_Code: '4804',
          radif: '1',
          no: 'ورود وجه نقد',
          rial_V: '600',
          rial_kh: '0',
          Arz: 'USD',
          Sharh: 'دریافت از زینالی',
        },
      ],
      bank: [],
      Hesab_bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, parseBackupInfo('Version=10.0'));
    const doc = norm.documents.find((d) => d.sourceFactorCode === '4804');
    expect(doc).toBeDefined();
    expect(doc!.lines.length).toBe(1);

    const line = doc!.lines[0];
    expect(line.kind).toBe('cash');
    expect(line.foreignAmount).toBe(600);
    expect(line.foreignCurrency).toBe('USD');
    expect(line.amountIrr).toBe(0); // Zero IRR
    expect(line.nature).toBe('received');
    expect(line.partySide).toBe('creditor');

    const createdRecords: Record<string, any[]> = {};
    const mockWriter = {
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: Record<string, any>) => {
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `tx_${Date.now()}_${Math.random()}`, ...data };
          createdRecords[col].push(rec);
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(mockWriter, norm, buildInitialMappings(norm, [], [], [], []), {
      migrationId: 'test_f4804_mig',
      dryRun: false,
    });

    const txList = createdRecords['transactions'] || [];
    expect(txList.length).toBe(1);
    const tx = txList[0];
    expect(tx.documentTab).toBe('cash');
    expect(tx.documentSubType).toBe('cash-in');
    expect(tx.foreignAmount).toBe(600);
    expect(tx.foreignCurrency).toBe('USD');
    expect(tx.rialAmount).toBe(0);
  });

  // 28. Melted Gold vs Conditional Gold & Opening Inventory
  it('28. Melted Gold & Opening Inventory: classifies melted gold with assay stamp as melted, not conditional, and records opening inventory', async () => {
    const rawDb: any = {
      moshtarian: [],
      hesab: [
        {
          Factor_Code: 'OP_GOLD_1',
          code: '0',
          mcode: '0',
          sh_factor: '0',
          SanadType: '9',
          Rec: 'موجودی اولیه طلایی',
        },
      ],
      hesab_detail: [
        {
          Factor_Code: 'OP_GOLD_1',
          mcode: '0',
          no: 'ورود طلا',
          vazn: '70.78',
          ayar: '749',
          tabdil750_v: '70.686',
          sh_sharti: '19862',
          name_az: 'گلستانی پیرانشهر',
          Sharh: 'موجودی اولیه طلایی [M#0035]',
          SanadType: '9',
        },
      ],
      bank: [],
      Hesab_bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [
        { name: 'گلستانی پیرانشهر', Tel: '', Add: '' },
      ],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, parseBackupInfo('Version=10.0'));
    const doc = norm.documents.find((d) => d.sourceFactorCode === 'OP_GOLD_1');
    expect(doc).toBeDefined();
    expect(doc!.isOpeningInventory).toBe(true);

    const line = doc!.lines[0];
    expect(line.isConditional).toBe(false); // NOT conditional because 'شرطی' is not in description/type
    expect(line.kind).toBe('melted');
    expect(line.metalType).toBe('gold');
    expect(line.weight).toBe(70.78);
    expect(line.grade).toBe(749);
    expect(line.convertedWeight750).toBe(70.686);
    expect(line.assayStampNumber).toBe('19862');
    expect(line.assayLabName).toBe('گلستانی پیرانشهر');
    expect(line.isOpeningInventory).toBe(true);

    const createdRecords: Record<string, any[]> = {};
    const mockWriter = {
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: Record<string, any>) => {
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `rec_${Date.now()}_${Math.random()}`, ...data };
          createdRecords[col].push(rec);
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(mockWriter, norm, buildInitialMappings(norm, [], [], [], []), {
      migrationId: 'test_opening_melted',
      dryRun: false,
    });

    const lots = createdRecords['metal_inventory'] || [];
    expect(lots.length).toBe(1);
    expect(lots[0].inventory_type).toBe('melted');
    expect(lots[0].raw_weight).toBe(70.78);
    expect(lots[0].purity).toBe(749);
    expect(lots[0].converted_weight).toBe(70.686);
    expect(lots[0].stamp_number).toBe('19862');
    expect(lots[0].lab_name).toBe('گلستانی پیرانشهر');
    expect(lots[0].is_opening_balance).toBe(true);
  });

  // 29. Manufactured Gold with Percentage Wage (Factor 1 - Mrs. Tavakol)
  it('29. Workmanship with Percentage Wage: accurately retains base line and separate golden percentage row with child linking', async () => {
    const rawDb: any = {
      moshtarian: [
        {
          code: '418',
          name: 'خانم توکل (شیخ)',
        },
      ],
      hesab: [
        {
          Factor_Code: 'F_TAVAKOL_1',
          code: '418',
          sh_factor: '1',
        },
      ],
      hesab_detail: [
        {
          Factor_Code: 'F_TAVAKOL_1',
          radif: '1',
          no: 'خروج کارساخته',
          vazn: '36.12',
          ayar: '750',
          tabdil750_kh: '36.12',
          Darsad: '16',
          NO_kar: 'کارساخته1',
          Sharh: 'سرویس',
        },
        {
          Factor_Code: 'F_TAVAKOL_1',
          radif: '2',
          no: '16 درصد',
          vazn: '5.779',
          ayar: '750',
          tabdil750_kh: '5.779',
          Sharh: '#DSD1',
        },
      ],
      bank: [],
      Hesab_bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, parseBackupInfo('Version=10.0'));
    const doc = norm.documents.find((d) => d.sourceFactorCode === 'F_TAVAKOL_1');
    expect(doc).toBeDefined();
    expect(doc!.lines.length).toBe(2); // Preserves exact breakdown into 2 lines!

    const line1 = doc!.lines[0];
    expect(line1.kind).toBe('workmanship');
    expect(line1.workmanshipName).toBe('سرویس');
    expect(line1.weight).toBe(36.12);
    expect(line1.grade).toBe(750);
    expect(line1.wagePercent).toBe(16);
    expect(line1.wageGoldWeight).toBe(5.779);
    expect(line1.convertedWeight750).toBe(36.12);
    expect(line1.amountIrr).toBe(0);
    expect(line1.nature).toBe('paid');
    expect(line1.partySide).toBe('debtor');
    expect(line1.signedGoldAmount).toBe(-36.12);

    const line2 = doc!.lines[1];
    expect(line2.kind).toBe('workmanship');
    expect(line2.isGoldenPercentageLine).toBe(true);
    expect(line2.parentLineNumber).toBe(1);
    expect(line2.wagePercent).toBe(16);
    expect(line2.weight).toBe(5.779);
    expect(line2.convertedWeight750).toBe(5.779);
    expect(line2.signedGoldAmount).toBe(-5.779);

    const createdRecords: Record<string, any[]> = {};
    const mockWriter = {
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: Record<string, any>) => {
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `tx_${Date.now()}_${Math.random()}`, ...data };
          createdRecords[col].push(rec);
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(mockWriter, norm, buildInitialMappings(norm, [], [], [], []), {
      migrationId: 'test_tavakol_workmanship',
      dryRun: false,
    });

    const txList = createdRecords['transactions'] || [];
    expect(txList.length).toBe(2);
    const tx1 = txList[0];
    expect(tx1.documentTab).toBe('workmanship');
    expect(tx1.documentSubType).toBe('exit_manufactured');
    expect(tx1.goldAmount).toBe(-36.12);
    expect(tx1.rialAmount).toBe(0);

    const details1 = JSON.parse(tx1.documentDetails);
    expect(details1.workmanshipName).toBe('سرویس');
    expect(details1.wagePercent).toBe(16);
    expect(details1.hasChildLines).toBe(true);

    const tx2 = txList[1];
    expect(tx2.documentTab).toBe('workmanship');
    expect(tx2.documentSubType).toBe('workmanship-golden-percentage');
    expect(tx2.goldAmount).toBe(-5.779);

    const details2 = JSON.parse(tx2.documentDetails);
    expect(details2.linkedLineId).toBe(tx1.id);
    expect(details2.isChildLine).toBe(true);
    expect(details2.isGoldenPercentageLine).toBe(true);

    // Sum of gold amounts = -41.899
    expect(tx1.goldAmount + tx2.goldAmount).toBeCloseTo(-41.899, 3);
  });

  // 30. End-to-End Hawala (Remittance) Pairing & Ledger Integration
  it('30. End-to-End Hawala Pairing & Ledger Integration: perfectly pairs gold remittances, avoids physical inventory impact, and displays full Hawala details in ledger', async () => {
    const rawDb: TahesabRawDatabase = {
      moshtarian: [
        {
          code: '148',
          name: 'کارگاه تهران',
          Tel: '09121111111',
          gorooh: 'کارگاه‌ها',
          GID: '2',
          tahesabtala: '0',
          tahesabriali: '0',
          Arz: 'IRR',
        },
        {
          code: '211',
          name: 'اجرت کارگاه مرکزی',
          Tel: '09122222222',
          gorooh: 'اجرت',
          GID: '2',
          tahesabtala: '0',
          tahesabriali: '0',
          Arz: 'IRR',
        },
      ],
      hesab: [
        {
          Factor_Code: 'FACT_HAWALA_SND',
          sh_factor: '101',
          mcode: '148',
          Tarikh: '2024-04-09 15:10:59',
          Rec: 'کارگاه تهران',
          geram_kh: '12.450',
          Arz: 'IRR',
        },
        {
          Factor_Code: 'FACT_HAWALA_REC',
          sh_factor: '102',
          mcode: '211',
          Tarikh: '2024-04-09 15:12:24',
          Rec: 'اجرت کارگاه مرکزی',
          geram_v: '12.450',
          Arz: 'IRR',
        },
      ],
      hesab_detail: [
        {
          Factor_Code: 'FACT_HAWALA_SND',
          mcode: '148',
          no: 'طلب',
          Sharh: '(حواله به: 211 اجرت کارگاه مرکزی)',
          Command: '#hshbe#HAWALA_TOKEN_12345#99',
          vazn: '12.450',
          ayar: '750',
          tabdil750_kh: '12.450',
          Tahesab_t: '-12.450',
          Tahesab_p: '0',
        },
        {
          Factor_Code: 'FACT_HAWALA_REC',
          mcode: '211',
          no: 'بدهی',
          Sharh: '(حواله از: 148 کارگاه تهران)',
          Command: '#HAVALEH#HAWALA_TOKEN_12345#99',
          vazn: '12.450',
          ayar: '750',
          tabdil750_v: '12.450',
          Tahesab_t: '12.450',
          Tahesab_p: '0',
        },
      ],
      Hesab_bank: [],
      bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, {
      mohitCount: 1,
      dbType: 'SQL',
      version: '10.0',
      archiveCount: 0,
    });

    // 1. Verify normalized pair links
    const docSnd = norm.documents.find((d) => d.sourceFactorCode === 'FACT_HAWALA_SND');
    const docRec = norm.documents.find((d) => d.sourceFactorCode === 'FACT_HAWALA_REC');
    expect(docSnd).toBeDefined();
    expect(docRec).toBeDefined();

    const lineSnd = docSnd!.lines[0];
    const lineRec = docRec!.lines[0];

    expect(lineSnd.isHawala).toBe(true);
    expect(lineSnd.kind).toBe('melted');
    expect(lineSnd.metalType).toBe('gold');
    expect(lineSnd.nature).toBe('paid');
    expect(lineSnd.signedGoldAmount).toBe(-12.45);
    expect(lineSnd.hawalaCounterCustomerCode).toBe('211');
    expect(lineSnd.hawalaCounterCustomerName).toBe('اجرت کارگاه مرکزی');
    expect(lineSnd.hawalaCounterFactorCode).toBe('FACT_HAWALA_REC');

    expect(lineRec.isHawala).toBe(true);
    expect(lineRec.kind).toBe('melted');
    expect(lineRec.metalType).toBe('gold');
    expect(lineRec.nature).toBe('received');
    expect(lineRec.signedGoldAmount).toBe(12.45);
    expect(lineRec.hawalaCounterCustomerCode).toBe('148');
    expect(lineRec.hawalaCounterCustomerName).toBe('کارگاه تهران');
    expect(lineRec.hawalaCounterFactorCode).toBe('FACT_HAWALA_SND');

    // 2. Import into Zarfolio domain
    const createdRecords: Record<string, any[]> = {};
    const mockWriter = {
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: Record<string, any>) => {
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `id_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, ...data };
          createdRecords[col].push(rec);
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(
      mockWriter,
      norm,
      buildInitialMappings(norm, [], []),
      { migrationId: 'test_hawala_mig', dryRun: false },
    );

    const txList = createdRecords['transactions'] || [];
    expect(txList.length).toBe(2);

    const txSnd = txList.find((t) => t.customerCode === 148);
    const txRec = txList.find((t) => t.customerCode === 211);
    expect(txSnd).toBeDefined();
    expect(txRec).toBeDefined();

    // Verify Sender (Line A)
    expect(txSnd.documentTab).toBe('raw-gold');
    expect(txSnd.documentSubType).toBe('outgoing-molten');
    expect(txSnd.goldAmount).toBe(-12.45);
    expect(txSnd.rialAmount).toBe(0);

    const detailsSnd = JSON.parse(txSnd.documentDetails);
    expect(detailsSnd.isHawala).toBe(true);
    expect(detailsSnd.hawalaGroupId).toBe('HAWALA_TOKEN_12345#99');
    expect(detailsSnd.documentTypeLabel).toBe('حواله طلا');
    expect(detailsSnd.hawalaCounterCustomerCode).toBe('211');
    expect(detailsSnd.hawalaCounterCustomerName).toBe('اجرت کارگاه مرکزی');
    expect(detailsSnd.hawalaCounterDocumentId).toBe(txRec.documentId);

    // Verify Receiver (Line B)
    expect(txRec.documentTab).toBe('raw-gold');
    expect(txRec.documentSubType).toBe('incoming-molten');
    expect(txRec.goldAmount).toBe(12.45);
    expect(txRec.rialAmount).toBe(0);

    const detailsRec = JSON.parse(txRec.documentDetails);
    expect(detailsRec.isHawala).toBe(true);
    expect(detailsRec.hawalaGroupId).toBe('HAWALA_TOKEN_12345#99');
    expect(detailsRec.documentTypeLabel).toBe('حواله طلا');
    expect(detailsRec.hawalaCounterCustomerCode).toBe('148');
    expect(detailsRec.hawalaCounterCustomerName).toBe('کارگاه تهران');
    expect(detailsRec.hawalaCounterDocumentId).toBe(txSnd.documentId);

    // Crucial: Interpersonal Hawala MUST NOT write physical inventory into metal_inventory!
    const inventoryLots = createdRecords['metal_inventory'] || [];
    expect(inventoryLots.length).toBe(0);

    // 3. Verify Customer Ledger Breakdown & Filter Matching
    const {
      getDocumentLineDescription,
      parseTransactionBreakdown,
      matchesLedgerCategoryFilter,
    } = await import('@/features/customers/utils/document-breakdown');

    // Sender breakdown
    const breakdownSnd = parseTransactionBreakdown(txSnd);
    expect(breakdownSnd.category).toBe('gold-raw');
    expect(breakdownSnd.categoryLabel).toBe('حواله طلا');
    expect(breakdownSnd.badgeColor).toBe('purple');
    expect(breakdownSnd.attributes.find((a) => a.label === 'طرف حواله')?.value).toContain('اجرت کارگاه مرکزی');

    const descSnd = getDocumentLineDescription(txSnd);
    expect(descSnd.primary).toBe('حواله طلا به: اجرت کارگاه مرکزی (211)');

    // Receiver breakdown
    const breakdownRec = parseTransactionBreakdown(txRec);
    expect(breakdownRec.category).toBe('gold-raw');
    expect(breakdownRec.categoryLabel).toBe('حواله طلا');
    expect(breakdownRec.badgeColor).toBe('purple');
    expect(breakdownRec.attributes.find((a) => a.label === 'طرف حواله')?.value).toContain('کارگاه تهران');

    const descRec = getDocumentLineDescription(txRec);
    expect(descRec.primary).toBe('حواله طلا از: کارگاه تهران (148)');

    // Filter matching
    expect(matchesLedgerCategoryFilter(txSnd, 'raw-gold')).toBe(true);
    expect(matchesLedgerCategoryFilter(txRec, 'raw-gold')).toBe(true);
    expect(matchesLedgerCategoryFilter(txSnd, 'bank')).toBe(false);
  });

  // 31. Conditional Gold with Karat (عیار شرطی): Accurately detects conditional gold even with populated ayar
  it('31. Conditional Gold with Karat: identifies conditional gold with provisional karat, stamp number and assay lab, and handles conditional hawala', async () => {
    const rawDb: any = {
      moshtarian: [
        {
          code: '35',
          name: 'قاسم ضیغمی',
          Tel: '09121111111',
          gorooh: 'بنکدار',
          GID: '2',
          tahesabtala: '0',
          tahesabriali: '0',
          Arz: 'IRR',
        },
        {
          code: '148',
          name: 'کارگاه تهران',
          Tel: '09122222222',
          gorooh: 'کارگاه',
          GID: '2',
          tahesabtala: '0',
          tahesabriali: '0',
          Arz: 'IRR',
        },
      ],
      hesab: [
        {
          Factor_Code: 'FACT_COND_1',
          sh_factor: '2155',
          mcode: '35',
          Tarikh: '2025-05-28 12:41:48',
          Rec: 'قاسم ضیغمی',
          geram_v: '40.570',
          Arz: 'IRR',
        },
        {
          Factor_Code: 'FACT_COND_HAWALA',
          sh_factor: '2156',
          mcode: '35',
          Tarikh: '2025-05-28 14:00:00',
          Rec: 'قاسم ضیغمی',
          geram_kh: '25.600',
          Arz: 'IRR',
        },
      ],
      hesab_detail: [
        {
          // Direct Conditional Gold Trade with Ayar (Command2: 171)
          Factor_Code: 'FACT_COND_1',
          mcode: '35',
          sh_factor: '2155',
          Tarikh: '2025-05-28 12:41:48',
          no: 'ورود طلا',
          vazn: '40.57',
          ayar: '746',
          tabdil750_v: '40.354',
          sh_sharti: '460917',
          name_az: 'بلوط',
          Temp: 'ورود آبشده شرطی (40/57*746) [460917 بلوط]',
          Command2: '171',
          SanadType: '0',
          Abshode: '-1',
        },
        {
          // Conditional Gold Hawala with Ayar
          Factor_Code: 'FACT_COND_HAWALA',
          mcode: '35',
          sh_factor: '2156',
          Tarikh: '2025-05-28 14:00:00',
          no: 'طلب',
          vazn: '25.60',
          ayar: '746',
          tabdil750_kh: '25.463',
          sh_sharti: '848643',
          name_az: 'حمیدقدیم',
          Sharh: '(حواله به: 148 کارگاه تهران)',
          Command: '#hshbe#COND_TOKEN_999#1',
          Command2: '171',
          SanadType: '0',
          Abshode: '-1',
        },
      ],
      Hesab_bank: [],
      bank: [],
      Sekeh_Shemsh: [],
      Sang: [],
      raygiri: [
        { name: 'بلوط', Tel: '', Add: '' },
        { name: 'حمیدقدیم', Tel: '', Add: '' },
      ],
      khar_sakhte: [],
      Cities: [],
      Hazine_Baabat: [],
      gorooh: [],
      otherTables: {},
    };

    const norm = normalizeTahesabData(rawDb, {
      mohitCount: 1,
      dbType: 'SQL',
      version: '10.0',
      archiveCount: 0,
    });

    // 1. Verify Normalizer recognizes conditional gold with ayar
    const doc1 = norm.documents.find((d) => d.sourceFactorCode === 'FACT_COND_1');
    expect(doc1).toBeDefined();
    const line1 = doc1!.lines[0];

    expect(line1.isConditional).toBe(true);
    expect(line1.kind).toBe('conditional');
    expect(line1.metalType).toBe('gold');
    expect(line1.weight).toBe(40.57);
    expect(line1.grade).toBe(746);
    expect(line1.convertedWeight750).toBe(40.354);
    expect(line1.assayStampNumber).toBe('460917');
    expect(line1.assayLabName).toBe('بلوط');
    expect(line1.isHawala).toBe(false);

    // Conditional Hawala line
    const docHawala = norm.documents.find((d) => d.sourceFactorCode === 'FACT_COND_HAWALA');
    expect(docHawala).toBeDefined();
    const lineHawala = docHawala!.lines[0];

    expect(lineHawala.isConditional).toBe(true);
    expect(lineHawala.isHawala).toBe(true);
    expect(lineHawala.kind).toBe('conditional');
    expect(lineHawala.weight).toBe(25.6);
    expect(lineHawala.grade).toBe(746);
    expect(lineHawala.convertedWeight750).toBe(25.463);
    expect(lineHawala.assayStampNumber).toBe('848643');

    // 2. Verify Importer maps into Zarfolio schema correctly
    const createdRecords: Record<string, any[]> = {};
    const mockWriter = {
      collection: (col: string) => ({
        getFirstListItem: async () => { throw new Error('Not found'); },
        create: async (data: Record<string, any>) => {
          if (!createdRecords[col]) createdRecords[col] = [];
          const rec = { id: `rec_${Date.now()}_${Math.random()}`, ...data };
          createdRecords[col].push(rec);
          return rec;
        },
        getFullList: async () => createdRecords[col] || [],
      }),
    } as any;

    await importTahesabData(mockWriter, norm, buildInitialMappings(norm, [], [], [], []), {
      migrationId: 'test_conditional_karat',
      dryRun: false,
    });

    const txRecords = createdRecords['transactions'] || [];
    expect(txRecords.length).toBe(2);

    const txDirect = txRecords.find((t) => t.sourceKey?.includes('FACT_COND_1'));
    expect(txDirect).toBeDefined();
    expect(txDirect.documentTab).toBe('raw-gold');
    expect(txDirect.documentSubType).toBe('incoming-conditional');
    expect(txDirect.goldAmount).toBe(40.354);

    const detailsDirect = JSON.parse(txDirect.documentDetails);
    expect(detailsDirect.isConditional).toBe(true);
    expect(detailsDirect.rawKind).toBe('conditional');
    expect(detailsDirect.purity).toBe('746');
    expect(detailsDirect.rawWeight).toBe('40.57');
    expect(detailsDirect.stampNumber).toBe('460917');
    expect(detailsDirect.labName).toContain('بلوط');

    // Verify metal_inventory lot created for direct trade
    const inventoryLots = createdRecords['metal_inventory'] || [];
    expect(inventoryLots.length).toBe(1);
    expect(inventoryLots[0].inventory_type).toBe('conditional');
    expect(inventoryLots[0].direction).toBe('in');
    expect(inventoryLots[0].transaction_type).toBe('incoming-conditional');
    expect(inventoryLots[0].purity).toBe(746);
    expect(inventoryLots[0].raw_weight).toBe(40.57);
    expect(inventoryLots[0].stamp_number).toBe('460917');
    expect(inventoryLots[0].lab_name).toContain('بلوط');

    // Verify Hawala transaction has conditional details but NO inventory lot
    const txHawala = txRecords.find((t) => t.sourceKey?.includes('FACT_COND_HAWALA'));
    expect(txHawala).toBeDefined();
    expect(txHawala.documentTab).toBe('raw-gold');
    expect(txHawala.goldAmount).toBe(-25.463);

    const detailsHawala = JSON.parse(txHawala.documentDetails);
    expect(detailsHawala.isHawala).toBe(true);
    expect(detailsHawala.isConditional).toBe(true);
    expect(detailsHawala.rawKind).toBe('conditional');
    expect(detailsHawala.documentTypeLabel).toBe('حواله طلای شرطی');

    // 3. Verify Ledger Breakdown for Conditional Gold
    const {
      getDocumentLineDescription,
      parseTransactionBreakdown,
      matchesLedgerCategoryFilter,
    } = await import('@/features/customers/utils/document-breakdown');

    const breakdownDirect = parseTransactionBreakdown(txDirect);
    expect(breakdownDirect.category).toBe('gold-raw');
    expect(breakdownDirect.categoryLabel).toBe('طلای آبشده شرطی');
    expect(breakdownDirect.badgeColor).toBe('amber');

    const karatAttr = breakdownDirect.attributes.find((a) => a.label === 'عیار موقت');
    expect(karatAttr).toBeDefined();
    expect(karatAttr?.value).toBe('746');

    const stampAttr = breakdownDirect.attributes.find((a) => a.label === 'شماره انگ');
    expect(stampAttr).toBeDefined();
    expect(stampAttr?.value).toBe('460917');

    const labAttr = breakdownDirect.attributes.find((a) => a.label?.includes('ری‌گیری'));
    expect(labAttr).toBeDefined();
    expect(labAttr?.value).toContain('بلوط');

    const descDirect = getDocumentLineDescription(txDirect);
    expect(descDirect.primary).toBe('ورود آبشده شرطی طلا');

    // Breakdown for conditional Hawala
    const breakdownHawala = parseTransactionBreakdown(txHawala);
    expect(breakdownHawala.category).toBe('gold-raw');
    expect(breakdownHawala.categoryLabel).toBe('حواله طلای شرطی');
    expect(breakdownHawala.badgeColor).toBe('purple');

    const descHawala = getDocumentLineDescription(txHawala);
    expect(descHawala.primary).toContain('حواله طلای شرطی به: کارگاه تهران (148)');

    expect(matchesLedgerCategoryFilter(txDirect, 'raw-gold')).toBe(true);
    expect(matchesLedgerCategoryFilter(txHawala, 'raw-gold')).toBe(true);
  });

  // 32. Jewelry Etiquette Migration & Forensics
  it('32. Jewelry Etiquette Migration: accurately distinguishes genuine etiquettes, migrates available/sold items and mounted stones', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) return;
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH, { maxDetailRows: 500 });
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    expect(normalized.etiquettes).toBeDefined();
    expect(normalized.etiquettes?.length).toBe(215);

    const available = normalized.etiquettes?.filter((e) => e.status === 'available') || [];
    const sold = normalized.etiquettes?.filter((e) => e.status === 'sold') || [];

    expect(available.length).toBe(62);
    expect(sold.length).toBe(153);

    // Verify mounted stones
    const withStones = normalized.etiquettes?.filter((e) => e.mountedStones.length > 0) || [];
    expect(withStones.length).toBe(62);

    const sampleWithStones = withStones.find((e) => e.barcode === '43');
    expect(sampleWithStones).toBeDefined();
    expect(sampleWithStones?.title).toBe('گردنبند تنیس');
    expect(sampleWithStones?.totalWeight).toBe(16.41);
    expect(sampleWithStones?.mountedStones.length).toBe(1);
    expect(sampleWithStones?.mountedStones[0].name).toBe('اتمی');
    expect(sampleWithStones?.mountedStones[0].quantity).toBe(56);
    expect(sampleWithStones?.mountedStones[0].weightCarat).toBe(25.4);

    // Verify sold item exit link details
    const sampleSold = sold.find((e) => e.barcode === '1');
    expect(sampleSold).toBeDefined();
    expect(sampleSold?.title).toBe('انگشتر');
    expect(sampleSold?.itemCode).toBe('SH1000');
    expect(sampleSold?.exitCustomerName).toContain('لیلا خلیفه');
    expect(sampleSold?.exitDateJalali).toBe('1404/09/22');
    expect(sampleSold?.status).toBe('sold');

    // Test Validation Preview Stats
    const mappings = buildInitialMappings(normalized, [], []);
    const validation = validateTahesabMigration(normalized, mappings);
    expect(validation.preview.totalEtiquettes).toBe(215);
    expect(validation.preview.totalAvailableEtiquettes).toBe(62);
    expect(validation.preview.totalSoldEtiquettes).toBe(153);

    // Test Importer with Mock PB
    const createdEtiquettes: any[] = [];
    const mockPb: any = {
      filter: (tmpl: string) => tmpl,
      collection: (col: string) => ({
        getFullList: async () => [],
        getFirstListItem: async () => null,
        create: async (data: any) => {
          if (col === 'etiquettes') {
            createdEtiquettes.push(data);
          }
          return { id: `rec_${col}_${Date.now()}`, ...data };
        },
      }),
    };

    const importResult = await importTahesabData(mockPb, normalized, mappings, {
      migrationId: 'etiquette_test_mig',
      userId: 'admin_test_user',
      dryRun: false,
    });

    expect(importResult.importedEtiquettes).toBe(215);
    expect(createdEtiquettes.length).toBe(215);

    const createdAvailable = createdEtiquettes.filter((e) => e.status === 'available');
    const createdSold = createdEtiquettes.filter((e) => e.status === 'sold');
    expect(createdAvailable.length).toBe(62);
    expect(createdSold.length).toBe(153);

    const createdStonesItem = createdEtiquettes.find((e) => e.barcode === '43');
    expect(createdStonesItem).toBeDefined();
    expect(createdStonesItem.etiquette_type).toBe('gemstone');
    expect(createdStonesItem.mounted_stones.length).toBe(1);

    // Test Idempotency: Running again should skip all 215 as duplicates
    const mockPbWithExisting: any = {
      filter: (tmpl: string) => tmpl,
      collection: (col: string) => ({
        getFullList: async () => createdEtiquettes.map((e) => ({ barcode: e.barcode, sourceKey: `tahesab:etiquette:${e.barcode}` })),
        getFirstListItem: async () => null,
        create: async () => {
          throw new Error('Should not be called during idempotent second run');
        },
      }),
    };

    const secondRun = await importTahesabData(mockPbWithExisting, normalized, mappings, {
      migrationId: 'etiquette_test_mig_2',
      userId: 'admin_test_user',
      dryRun: false,
    });

    expect(secondRun.importedEtiquettes).toBe(0);
    expect(secondRun.skippedDuplicates).toBeGreaterThanOrEqual(215);
  });

  // 34. Salmanzadeh Factor 3532: Gold Etiquette Exit (2.87g) + Golden Percentage (11%, 0.316g)
  it('34. Salmanzadeh Factor 3532: accurately normalizes and imports etiquette exit with separate golden percentage line', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) return;
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH);
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    const doc3532 = normalized.documents.find(
      (d) => d.sourceFactorCode === '401174399202605311259263288343925' || (d.documentNumber === '3532' && d.sourceCustomerCode === '565'),
    );
    expect(doc3532).toBeDefined();
    expect(doc3532!.sourceCustomerCode).toBe('565'); // Reza Salmanzadeh
    expect(doc3532!.lines.length).toBe(2);

    const mainLine = doc3532!.lines[0];
    expect(mainLine.kind).toBe('etiquette');
    expect(mainLine.isEtiquette).toBe(true);
    expect(mainLine.etiquetteBarcode).toBe('178');
    expect(mainLine.weight).toBe(2.87);
    expect(mainLine.convertedWeight750).toBe(2.87);
    expect(mainLine.wagePercent).toBe(11);
    expect(mainLine.documentTypeLabel).toBe('خروج اتیکت طلا');
    expect(mainLine.nature).toBe('paid');
    expect(mainLine.signedGoldAmount).toBe(-2.87);

    const goldenLine = doc3532!.lines[1];
    expect(goldenLine.kind).toBe('etiquette');
    expect(goldenLine.isEtiquette).toBe(true);
    expect(goldenLine.isGoldenPercentageLine).toBe(true);
    expect(goldenLine.parentLineNumber).toBe(1);
    expect(goldenLine.weight).toBe(0.316);
    expect(goldenLine.convertedWeight750).toBe(0.316);
    expect(goldenLine.wagePercent).toBe(11);
    expect(goldenLine.documentTypeLabel).toBe('درصد طلایی اتیکت طلا (۱۱٪)');
    expect(goldenLine.nature).toBe('paid');
    expect(goldenLine.signedGoldAmount).toBe(-0.316);

    // Mock importer run for document 3532
    const createdTransactions: any[] = [];
    const mockPb: any = {
      filter: (tmpl: string) => tmpl,
      collection: (col: string) => ({
        getFullList: async () => [],
        getFirstListItem: async () => null,
        create: async (data: any) => {
          const rec = { id: `tx_${col}_${Date.now()}_${Math.random()}`, ...data };
          if (col === 'transactions') createdTransactions.push(rec);
          return rec;
        },
      }),
    };

    const singleDocData = {
      ...normalized,
      parties: normalized.parties.filter((p) => p.sourceCode === '565'),
      documents: [doc3532!],
    };

    await importTahesabData(mockPb, singleDocData, buildInitialMappings(singleDocData, [], [], [], []), {
      migrationId: 'test_salmanzadeh_3532',
      dryRun: false,
    });

    expect(createdTransactions.length).toBe(2);
    const tx1 = createdTransactions[0];
    expect(tx1.documentTab).toBe('etiquette');
    expect(tx1.documentSubType).toBe('exit_etiquette');
    expect(tx1.goldAmount).toBe(-2.87);
    const details1 = JSON.parse(tx1.documentDetails);
    expect(details1.isEtiquette).toBe(true);
    expect(details1.barcode).toBe('178');
    expect(details1.hasChildLines).toBe(true);

    const tx2 = createdTransactions[1];
    expect(tx2.documentTab).toBe('etiquette');
    expect(tx2.documentSubType).toBe('workmanship-golden-percentage');
    expect(tx2.goldAmount).toBe(-0.316);
    const details2 = JSON.parse(tx2.documentDetails);
    expect(details2.isEtiquette).toBe(true);
    expect(details2.isGoldenPercentageLine).toBe(true);
    expect(details2.linkedLineId).toBe(tx1.id);
  });

  // 35. Salmanzadeh Factor 3531: Remittance of Gold Debt (32g) registered as "بدهی ما"
  it('35. Salmanzadeh Factor 3531: accurately maps melted debt remittance to label="بدهی ما"', async () => {
    if (!fs.existsSync(FIXTURE_PATH)) return;
    const { rawDb } = await parseTahesabBackup(FIXTURE_PATH);
    const info = parseBackupInfo('Version=10.0');
    const normalized = normalizeTahesabData(rawDb, info);

    const doc3531 = normalized.documents.find(
      (d) => d.sourceFactorCode === '8419931482026051813312961444858552' || (d.documentNumber === '3531' && d.sourceCustomerCode === '565'),
    );
    expect(doc3531).toBeDefined();
    expect(doc3531!.sourceCustomerCode).toBe('565'); // Reza Salmanzadeh
    expect(doc3531!.lines.length).toBe(1);

    const line = doc3531!.lines[0];
    expect(line.nature).toBe('received');
    expect(line.weight).toBe(32);
    expect(line.convertedWeight750).toBe(32);
    expect(line.signedGoldAmount).toBe(32);
    expect(line.isHawala).toBe(true);
    expect(line.documentTypeLabel).toBe('بدهی ما');

    // Mock importer run for document 3531
    const createdTransactions: any[] = [];
    const mockPb: any = {
      filter: (tmpl: string) => tmpl,
      collection: (col: string) => ({
        getFullList: async () => [],
        getFirstListItem: async () => null,
        create: async (data: any) => {
          if (col === 'transactions') createdTransactions.push({ id: `tx_salman_debt_${Date.now()}`, ...data });
          return { id: `rec_${col}_${Date.now()}`, ...data };
        },
      }),
    };

    const singleDocData = {
      ...normalized,
      parties: normalized.parties.filter((p) => p.sourceCode === '565'),
      documents: [doc3531!],
    };

    await importTahesabData(mockPb, singleDocData, buildInitialMappings(singleDocData, [], [], [], []), {
      migrationId: 'test_salmanzadeh_3531',
      dryRun: false,
    });

    expect(createdTransactions.length).toBe(1);
    const tx = createdTransactions[0];
    expect(tx.goldAmount).toBe(32);
    const details = JSON.parse(tx.documentDetails);
    expect(details.documentTypeLabel).toBe('بدهی ما');
    expect(details.claimDocumentTypeLabel).toBe('بدهی ما');
    expect(details.claimWeight).toBe('32');
  });
});


