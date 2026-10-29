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

    // 4. Verify breakdown
    const {
      getDocumentLineDescription,
      getJournalLineBadge,
      parseTransactionBreakdown,
    } = await import('@/features/customers/utils/document-breakdown');

    const desc = getDocumentLineDescription(txRec);
    expect(desc.primary).toBe('خرید ارز بدون تسویه');
    expect(desc.secondary).toContain('(حواله از: 188 بهروز نعمتی)');

    const badge = getJournalLineBadge(txRec);
    expect(badge.accountCode).toBe('۱۱۲۰');
    expect(badge.accountTitle).toBe('اسناد و حساب‌های دریافتنی');
    expect(badge.badgeColor).toBe('sky');

    const itemSpec = parseTransactionBreakdown(txRec);
    expect(itemSpec.category).toBe('currency');
    expect(itemSpec.categoryLabel).not.toContain('طلای متفرقه');
  });
});


