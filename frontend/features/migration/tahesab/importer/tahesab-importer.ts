import { randomUUID } from 'node:crypto';
import type PocketBase from 'pocketbase';
import { postJournalEntry, SYSTEM_ACCOUNT_CODES, type JournalLineInput } from '@/features/accounting/posting/posting-engine';
import { getNextDocumentSequenceForCustomer, buildDocumentNumber, getActiveDocumentPrefix } from '@/lib/document-service';
import { getNextAutoCustomerCode } from '@/features/accounting/chart-of-accounts/services/account-code';
import { generateZfDocumentNumber } from '@/lib/document-number';
import { normalizeAssayLabText, stripAssayLabAffixes } from '../mapper/tahesab-mapper';
import type {
  NormalizedMigrationData,
  NormalizedDocument,
  MigrationMappings,
  AssayLabMappingItem,
  MigrationResult,
  MigrationIssue,
  MigrationProgress,
} from '../types';

export interface ImporterOptions {
  migrationId: string;
  userId?: string;
  batchSize?: number;
  concurrency?: number;
  dryRun?: boolean;
  docOffset?: number;
  docLimit?: number;
  onProgress?: (progress: MigrationProgress) => void;
}

export interface ExistingTxMeta {
  id: string;
  customer: string;
  goldAmount: number;
  rialAmount: number;
  sourceKey: string;
  documentNumber?: string;
}

export interface MigrationSessionState {
  migrationId: string;
  loadedAt: number;
  customerIdBySourceCode: Map<string, string>;
  customerCodeBySourceCode: Map<string, number>;
  customerSequenceMap: Map<string, number>;
  usedCustomerCodes: Set<number>;
  usedDocNumbers: Set<string>;
  customerById: Map<string, { id: string; name: string; customerCode: number }>;
  customerByName: Map<string, { id: string; name: string; customerCode: number }>;
  bankAccountMap: Map<string, string>;
  existingTxByExactKey: Map<string, ExistingTxMeta>;
  existingTxByFactorAndLine: Map<string, ExistingTxMeta>;
  assayLabMapByName: Map<string, { id: string; name: string }>;
  currencyMapByCode: Map<string, { id?: string; code: string; name: string; symbol: string }>;
  activePrefix: string;
}

const migrationSessionCache = new Map<string, MigrationSessionState>();

export function clearMigrationSession(migrationId?: string) {
  if (migrationId) {
    migrationSessionCache.delete(migrationId);
  } else {
    migrationSessionCache.clear();
  }
}

/**
 * High-Speed & Resilient Importer Engine:
 * Migrates normalized Tahesab data into Zarfolio using the existing domain entities,
 * PocketBase collections, and posting engine.
 * Fully Idempotent via deterministic sourceKey and optimized with in-memory sequence caches,
 * cross-chunk session caching, and parallelized document line processing.
 */
export async function importTahesabData(
  pb: PocketBase,
  data: NormalizedMigrationData,
  mappings: MigrationMappings,
  options: ImporterOptions,
): Promise<MigrationResult> {
  const startTime = Date.now();
  const startTimeIso = new Date(startTime).toISOString();

  const {
    migrationId,
    userId,
    batchSize = 400,
    concurrency = 12,
    dryRun = false,
    docOffset = 0,
    docLimit,
    onProgress,
  } = options;

  const errors: MigrationIssue[] = [];
  const warnings: MigrationIssue[] = [];

  let importedParties = 0;
  let importedBankAccounts = 0;
  let importedAssayLabs = 0;
  let importedDocuments = 0;
  let importedLines = 0;
  let importedJournalEntries = 0;
  let importedMetalLots = 0;
  let skippedDuplicates = 0;

  let writer = pb;
  if (!dryRun && pb && typeof (pb as any).authStore?.isValid === 'boolean') {
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) {
        writer = servicePb;
      }
    } catch {
      writer = pb;
    }
  }

  let effectiveUserId = userId;
  if (!effectiveUserId && !dryRun) {
    try {
      const firstUser = await writer.collection('users').getFirstListItem('').catch(() => null);
      if (firstUser) effectiveUserId = firstUser.id;
    } catch {}
  }

  // Get or initialize in-memory session cache for this migration run
  let session = migrationSessionCache.get(migrationId);
  if (!session) {
    session = {
      migrationId,
      loadedAt: Date.now(),
      customerIdBySourceCode: new Map(),
      customerCodeBySourceCode: new Map(),
      customerSequenceMap: new Map(),
      usedCustomerCodes: new Set(),
      usedDocNumbers: new Set(),
      customerById: new Map(),
      customerByName: new Map(),
      bankAccountMap: new Map(),
      existingTxByExactKey: new Map(),
      existingTxByFactorAndLine: new Map(),
      assayLabMapByName: new Map(),
      currencyMapByCode: new Map(),
      activePrefix: 'ZF',
    };
    migrationSessionCache.set(migrationId, session);
  }

  // Clean up any stale sessions (> 2 hours old) to prevent memory leaks
  const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
  for (const [k, v] of migrationSessionCache.entries()) {
    if (v.loadedAt < twoHoursAgo && k !== migrationId) {
      migrationSessionCache.delete(k);
    }
  }

  // Pre-load all collections in parallel on cold start
  if (!dryRun && session.customerById.size === 0) {
    try {
      const [existingCustomers, existingLabs, existingBanks, existingTxList, activePrefix] = await Promise.all([
        writer.collection('customers').getFullList({
          fields: 'id,name,customerCode,privateDescription',
        }).catch(() => []),
        writer.collection('assay_laboratories').getFullList({
          fields: 'id,name,phone,city,province,code',
        }).catch(() => []),
        writer.collection('bank_accounts').getFullList({
          fields: 'id,accountNumber,bankName',
        }).catch(() => []),
        writer.collection('transactions').getFullList({
          fields: 'id,sourceKey,customer,goldAmount,rialAmount,documentNumber,documentSequence',
        }).catch(() => []),
        getActiveDocumentPrefix(pb).catch(() => 'ZF'),
      ]);

      session.activePrefix = activePrefix;

      for (const c of existingCustomers) {
        const codeNum = Number(c.customerCode) || 0;
        if (codeNum > 0) session.usedCustomerCodes.add(codeNum);
        session.customerById.set(c.id, { id: c.id, name: c.name, customerCode: codeNum });
        if (c.name) session.customerByName.set(c.name.trim(), { id: c.id, name: c.name, customerCode: codeNum });
        const match = String(c.privateDescription || '').match(/کد منبع:\s*([^\s,)]+)/);
        if (match && match[1]) {
          session.customerIdBySourceCode.set(match[1], c.id);
          session.customerCodeBySourceCode.set(match[1], codeNum);
        }
      }

      for (const b of existingBanks) {
        if (b.accountNumber) session.bankAccountMap.set(String(b.accountNumber), b.id);
        if (b.bankName) session.bankAccountMap.set(String(b.bankName).trim(), b.id);
      }

      for (const lab of existingLabs) {
        const item = { id: String(lab.id), name: String(lab.name) };
        const norm = normalizeAssayLabText(lab.name);
        const stripped = normalizeAssayLabText(stripAssayLabAffixes(lab.name));
        if (norm) session.assayLabMapByName.set(norm, item);
        if (stripped) session.assayLabMapByName.set(stripped, item);
        session.assayLabMapByName.set(String(lab.name).trim(), item);
      }

      for (const r of existingTxList) {
        if (r.documentNumber) session.usedDocNumbers.add(r.documentNumber);
        if (r.customer) {
          const cId = String(r.customer);
          const seq = typeof r.documentSequence === 'number' && Number.isFinite(r.documentSequence) ? r.documentSequence : 0;
          const curMax = session.customerSequenceMap.get(cId) || 0;
          if (seq > curMax) session.customerSequenceMap.set(cId, seq);
        }
        if (r.sourceKey) {
          const meta: ExistingTxMeta = {
            id: r.id,
            customer: String(r.customer || ''),
            goldAmount: Number(r.goldAmount) || 0,
            rialAmount: Number(r.rialAmount) || 0,
            sourceKey: r.sourceKey,
            documentNumber: r.documentNumber,
          };
          session.existingTxByExactKey.set(r.sourceKey, meta);
          const parts = r.sourceKey.split(':');
          if (parts.length >= 4) {
            session.existingTxByFactorAndLine.set(`${parts[2]}:${parts[3]}`, meta);
          }
        }
      }
    } catch {
      // In tests or offline mode, continue
    }
  }

  // Pre-seed mappings
  for (const p of mappings.parties) {
    if (p.targetCustomerId && !session.customerIdBySourceCode.has(p.sourceCode)) {
      session.customerIdBySourceCode.set(p.sourceCode, p.targetCustomerId);
      const c = session.customerById.get(p.targetCustomerId);
      if (c && c.customerCode) session.customerCodeBySourceCode.set(p.sourceCode, c.customerCode);
    } else if (!session.customerIdBySourceCode.has(p.sourceCode)) {
      const c = session.customerByName.get(p.sourceName.trim());
      if (c) {
        session.customerIdBySourceCode.set(p.sourceCode, c.id);
        if (c.customerCode) session.customerCodeBySourceCode.set(p.sourceCode, c.customerCode);
      }
    }
  }

  if (mappings.assayLabs) {
    for (const m of mappings.assayLabs) {
      if (m.targetAssayLabId && m.targetAssayLabName) {
        const item = { id: m.targetAssayLabId, name: m.targetAssayLabName };
        const srcNorm = normalizeAssayLabText(m.sourceName);
        const srcStripped = normalizeAssayLabText(stripAssayLabAffixes(m.sourceName));
        if (srcNorm) session.assayLabMapByName.set(srcNorm, item);
        if (srcStripped) session.assayLabMapByName.set(srcStripped, item);
        session.assayLabMapByName.set(m.sourceName.trim(), item);
      }
    }
  }

  // Pre-seed currency mappings
  if (mappings.currencies) {
    for (const c of mappings.currencies) {
      const targetCode = (c.targetCurrencyCode || c.sourceCode || '').trim().toUpperCase();
      const item = {
        id: c.targetCurrencyId,
        code: targetCode,
        name: c.targetCurrencyName || c.sourceName || targetCode,
        symbol: c.targetCurrencySymbol || (targetCode === 'USD' ? '$' : targetCode),
      };
      const srcCode = (c.sourceCode || '').trim().toUpperCase();
      if (srcCode) session.currencyMapByCode.set(srcCode, item);
      if (targetCode) session.currencyMapByCode.set(targetCode, item);
      if (c.sourceName) session.currencyMapByCode.set(c.sourceName.trim(), item);
    }
  }

  if (session.currencyMapByCode.size === 0) {
    const defaultCurrencies = [
      { code: 'USD', name: 'دلار آمریکا', symbol: '$' },
      { code: 'EUR', name: 'یورو', symbol: '€' },
      { code: 'AED', name: 'درهم امارات', symbol: 'د.إ' },
      { code: 'GBP', name: 'پوند انگلیس', symbol: '£' },
      { code: 'TRY', name: 'لیر ترکیه', symbol: '₺' },
      { code: 'IRR', name: 'ریال ایران', symbol: 'تومان' },
      { code: 'IRT', name: 'تومان', symbol: 'تومان' },
    ];
    for (const def of defaultCurrencies) {
      session.currencyMapByCode.set(def.code, def);
    }
  }

  // 1. Process Customers / Parties (only on first chunk: docOffset === 0)
  if (docOffset === 0) {
    onProgress?.({
      stage: 'importing',
      percent: 10,
      currentStep: 1,
      totalSteps: 5,
      message: 'در حال تطبیق و ایجاد طرف‌حساب‌ها (Customers)...',
    });

    const partyMapByCode = new Map(mappings.parties.map((p) => [p.sourceCode, p]));

    for (const party of data.parties) {
      const mapping = partyMapByCode.get(party.sourceCode);
      let targetCustomerId = mapping?.targetCustomerId || session.customerIdBySourceCode.get(party.sourceCode);
      let targetCustomerCode = session.customerCodeBySourceCode.get(party.sourceCode);

      if (!targetCustomerId && mapping?.status === 'new_party') {
        if (!dryRun) {
          try {
            // Check if already created by name in this or previous migration
            const existing = session.customerByName.get(party.name.trim());

            if (existing) {
              targetCustomerId = existing.id;
              targetCustomerCode = existing.customerCode;
            } else {
              // Determine next unique customer code
              let assignedCode: number;
              const numericSourceCode = Number(party.sourceCode);
              if (
                Number.isInteger(numericSourceCode) &&
                numericSourceCode > 0 &&
                !session.usedCustomerCodes.has(numericSourceCode)
              ) {
                assignedCode = numericSourceCode;
              } else {
                assignedCode = getNextAutoCustomerCode(Array.from(session.usedCustomerCodes));
              }
              session.usedCustomerCodes.add(assignedCode);

              const newCust = await writer.collection('customers').create({
                customerCode: assignedCode,
                name: party.name,
                phone1: party.phone1 || '',
                phone2: party.phone2 || '',
                address1: party.address || '',
                city: party.city || '',
                postalCode: party.postalCode || '',
                groupName: party.groupName || 'متفرقه',
                primaryCurrency: 'rial',
                metalType: 'gold',
                createdBy: effectiveUserId || undefined,
                privateDescription: `مهاجرت‌شده از ته‌حساب (کد منبع: ${party.sourceCode}, شناسه مهاجرت: ${migrationId})`,
              });

              targetCustomerId = newCust.id;
              targetCustomerCode = assignedCode;
              session.customerById.set(newCust.id, { id: newCust.id, name: party.name, customerCode: assignedCode });
              session.customerByName.set(party.name.trim(), { id: newCust.id, name: party.name, customerCode: assignedCode });
              importedParties++;
            }
          } catch (err) {
            errors.push({
              code: 'ERR_CREATE_CUSTOMER',
              message: `خطا در ایجاد مشتری "${party.name}": ${err instanceof Error ? err.message : String(err)}`,
              severity: 'ERROR',
              sourceType: 'party',
              sourceId: party.sourceCode,
            });
          }
        } else {
          targetCustomerId = `dry_cust_${party.sourceCode}`;
          targetCustomerCode = Number(party.sourceCode) || 1000;
          importedParties++;
        }
      }

      if (targetCustomerId) {
        session.customerIdBySourceCode.set(party.sourceCode, targetCustomerId);
        if (targetCustomerCode) {
          session.customerCodeBySourceCode.set(party.sourceCode, targetCustomerCode);
        }
      }
    }

    onProgress?.({
      stage: 'importing',
      percent: 30,
      currentStep: 2,
      totalSteps: 5,
      message: 'در حال ایجاد حساب‌های بانکی (Bank Accounts)...',
    });

    // 2. Process Bank Accounts
    for (const bAcc of data.bankAccounts) {
      if (!dryRun) {
        try {
          if (!session.bankAccountMap.has(bAcc.accountNumber)) {
            const createdBank = await writer.collection('bank_accounts').create({
              bankName: bAcc.bankName,
              accountNumber: bAcc.accountNumber,
              balance: Math.max(0, bAcc.currentBalanceIrr),
              accountCodeZero: bAcc.accountNumber || '0',
              currency: 'IRR',
              createdBy: effectiveUserId || undefined,
            });
            session.bankAccountMap.set(bAcc.accountNumber, createdBank.id);
            if (bAcc.bankName) session.bankAccountMap.set(bAcc.bankName.trim(), createdBank.id);
            importedBankAccounts++;
          }
        } catch (err) {
          warnings.push({
            code: 'WARN_CREATE_BANK',
            message: `خطا در ایجاد حساب بانکی "${bAcc.bankName}": ${err instanceof Error ? err.message : String(err)}`,
            severity: 'WARNING',
            sourceType: 'bank_account',
            sourceId: bAcc.accountNumber,
          });
        }
      } else {
        importedBankAccounts++;
      }
    }

    onProgress?.({
      stage: 'importing',
      percent: 35,
      currentStep: 3,
      totalSteps: 5,
      message: 'در حال تطبیق و ایجاد ری‌گیری‌ها و آزمایشگاه‌ها (Assay Laboratories)...',
    });

    // 3. Process Assay Laboratories
    const assayLabsToProcess: AssayLabMappingItem[] = (mappings.assayLabs && mappings.assayLabs.length > 0)
      ? mappings.assayLabs
      : (data.assayLabs || []).map((l) => ({
          sourceName: l.name,
          sourcePhone: l.phone,
          sourceAddress: l.address,
          status: 'new_lab' as const,
        }));

    for (const labItem of assayLabsToProcess) {
      const srcNorm = normalizeAssayLabText(labItem.sourceName);
      const srcStripped = normalizeAssayLabText(stripAssayLabAffixes(labItem.sourceName));
      const existing = session.assayLabMapByName.get(srcNorm) ||
                       session.assayLabMapByName.get(srcStripped) ||
                       session.assayLabMapByName.get(labItem.sourceName.trim());

      if (existing) {
        continue;
      }

      if (labItem.status === 'new_lab' || !existing) {
        if (!dryRun) {
          try {
            const created = await writer.collection('assay_laboratories').create({
              name: labItem.sourceName,
              phone: labItem.sourcePhone || '',
              address: labItem.sourceAddress || '',
              city: labItem.targetCity || '',
              province: labItem.targetProvince || 'تهران',
              is_active: true,
              is_custom: true,
              created_by: effectiveUserId || undefined,
            });
            const newItem = { id: created.id, name: labItem.sourceName };
            if (srcNorm) session.assayLabMapByName.set(srcNorm, newItem);
            if (srcStripped) session.assayLabMapByName.set(srcStripped, newItem);
            session.assayLabMapByName.set(labItem.sourceName.trim(), newItem);
            importedAssayLabs++;
          } catch (err) {
            warnings.push({
              code: 'WARN_CREATE_ASSAY_LAB',
              message: `خطا در ایجاد ری‌گیری "${labItem.sourceName}": ${err instanceof Error ? err.message : String(err)}`,
              severity: 'WARNING',
              sourceType: 'assay_lab',
              sourceId: labItem.sourceName,
            });
          }
        } else {
          importedAssayLabs++;
        }
      }
    }
  } else {
    // If not first chunk, populate customer maps from existing mapped list or fallback
    for (const party of data.parties) {
      const mapping = mappings.parties.find((p) => p.sourceCode === party.sourceCode);
      if (mapping?.targetCustomerId && !session.customerIdBySourceCode.has(party.sourceCode)) {
        session.customerIdBySourceCode.set(party.sourceCode, mapping.targetCustomerId);
        const c = session.customerById.get(mapping.targetCustomerId);
        if (c && c.customerCode) session.customerCodeBySourceCode.set(party.sourceCode, c.customerCode);
      } else if (!session.customerIdBySourceCode.has(party.sourceCode)) {
        const c = session.customerByName.get(party.name.trim());
        if (c) {
          session.customerIdBySourceCode.set(party.sourceCode, c.id);
          if (c.customerCode) session.customerCodeBySourceCode.set(party.sourceCode, c.customerCode);
        } else {
          session.customerIdBySourceCode.set(party.sourceCode, `cust_${party.sourceCode}`);
          session.customerCodeBySourceCode.set(party.sourceCode, Number(party.sourceCode) || 1000);
        }
      }
    }
  }

  onProgress?.({
    stage: 'importing',
    percent: 50,
    currentStep: 3,
    totalSteps: 5,
    message: 'در حال ثبت اسناد و تراکنش‌های مالی در موتور حسابداری زرفولیو...',
  });

  const activePrefix = session.activePrefix || 'ZF';
  const totalDocs = data.documents.length;
  const startIndex = Math.max(0, docOffset);
  const endIndex = typeof docLimit === 'number' ? Math.min(totalDocs, startIndex + docLimit) : totalDocs;
  const docsSlice = data.documents.slice(startIndex, endIndex);

  // 3. Process Documents & Lines in Parallel Sub-Batches for High Throughput
  for (let i = 0; i < docsSlice.length; i += batchSize) {
    const chunk = docsSlice.slice(i, i + batchSize);

    for (let c = 0; c < chunk.length; c += concurrency) {
      const subBatch = chunk.slice(c, c + concurrency);

      await Promise.all(
        subBatch.map(async (doc) => {
          let targetCustId = session.customerIdBySourceCode.get(doc.sourceCustomerCode);
          let targetCustCode = session.customerCodeBySourceCode.get(doc.sourceCustomerCode) || 0;

          if (!targetCustId) {
            // Fallback match by party name
            const party = data.parties.find((p) => p.sourceCode === doc.sourceCustomerCode);
            if (party) {
              const matchedCust = session.customerByName.get(party.name.trim());
              if (matchedCust) {
                targetCustId = matchedCust.id;
                targetCustCode = matchedCust.customerCode;
                session.customerIdBySourceCode.set(doc.sourceCustomerCode, targetCustId);
                session.customerCodeBySourceCode.set(doc.sourceCustomerCode, targetCustCode);
              }
            }
          }

          let docImported = false;

          if (!targetCustId) {
            if (doc.isOpeningInventory || doc.sourceCustomerCode === '0') {
              // Direct opening inventory of metals without customer counterparty
              for (const line of doc.lines) {
                if (
                  line.weight > 0 &&
                  (line.kind === 'melted' || line.kind === 'conditional') &&
                  (line.metalType === 'gold' || line.metalType === 'silver')
                ) {
                  if (!dryRun) {
                    try {
                      let matchedAssayLabName = line.assayLabName || '';
                      if (matchedAssayLabName) {
                        const m = session.assayLabMapByName.get(normalizeAssayLabText(matchedAssayLabName)) ||
                                  session.assayLabMapByName.get(normalizeAssayLabText(stripAssayLabAffixes(matchedAssayLabName))) ||
                                  session.assayLabMapByName.get(matchedAssayLabName.trim());
                        if (m) matchedAssayLabName = m.name;
                      }
                      const baseKarat = line.metalType === 'silver' ? 999 : 750;
                      await writer.collection('metal_inventory').create({
                        metal: line.metalType,
                        inventory_type: line.kind === 'conditional' ? 'conditional' : 'melted',
                        direction: 'in',
                        transaction_type: 'opening-balance',
                        raw_weight: line.weight,
                        purity: line.grade,
                        base_karat: baseKarat,
                        converted_weight: line.convertedWeight750,
                        stamp_number: line.assayStampNumber || '',
                        lab_name: matchedAssayLabName || '',
                        date: line.dateIso || new Date().toISOString(),
                        is_opening_balance: true,
                        created_by: effectiveUserId || undefined,
                        description: line.description || `موجودی اول دوره طلا سند #${doc.documentNumber}`,
                      });
                      importedMetalLots++;
                      importedLines++;
                      docImported = true;
                    } catch {
                      // Non-blocking
                    }
                  } else {
                    importedMetalLots++;
                    importedLines++;
                    docImported = true;
                  }
                }
              }
              if (docImported) {
                importedDocuments++;
              }
              return;
            }

            warnings.push({
              code: 'WARN_DOC_SKIPPED_NO_PARTY',
              message: `سند شماره ${doc.documentNumber} (فاکتور: ${doc.sourceFactorCode}) نادیده گرفته شد. علت: طرف‌حساب با کد "${doc.sourceCustomerCode}" در سیستم زرفولیو یافت نشد و در جدول تطبیق تعیین تکلیف نشده بود.`,
              severity: 'WARNING',
              sourceType: 'document',
              sourceId: doc.sourceFactorCode,
            });
            return;
          }

          const docUuid = randomUUID();

          // In-memory atomic sequence increment to eliminate per-document HTTP calls
          let docSeq = (session.customerSequenceMap.get(targetCustId) || 0) + 1;
          session.customerSequenceMap.set(targetCustId, docSeq);

          await Promise.all(
            doc.lines.map(async (line) => {
              const lineSourceKey = `tahesab:${migrationId}:${doc.sourceFactorCode}:${line.lineNumber}`;
              const factorLineKey = `${doc.sourceFactorCode}:${line.lineNumber}`;

              if (!dryRun) {
                try {
                  // High-performance in-memory duplicate verification check
                  const existingTx = session.existingTxByExactKey.get(lineSourceKey) ||
                                     session.existingTxByFactorAndLine.get(factorLineKey);

                  if (existingTx) {
                    const expectedGold =
                      line.metalType === 'gold'
                        ? (typeof line.signedGoldAmount === 'number'
                            ? line.signedGoldAmount
                            : (line.convertedWeight750 || line.weight || 0))
                        : 0;
                    const expectedRial =
                      typeof line.signedRialAmount === 'number'
                        ? line.signedRialAmount
                        : (line.amountIrr || 0);

                    const goldMatches = Math.abs((existingTx.goldAmount || 0) - expectedGold) < 0.005;
                    const rialMatches = Math.abs((existingTx.rialAmount || 0) - expectedRial) <= 1;
                    const custMatches = !targetCustId || !existingTx.customer || existingTx.customer === targetCustId;

                    if (goldMatches && rialMatches && custMatches) {
                      // Verified duplicate: accurately migrated before, skip DB write to maximize throughput
                      skippedDuplicates++;
                      return;
                    } else {
                      const reasons: string[] = [];
                      if (!custMatches) {
                        reasons.push(`مغایرت طرف‌حساب (ثبت‌شده: ${existingTx.customer}، فایل جدید: ${targetCustId})`);
                      }
                      if (!goldMatches) {
                        reasons.push(`مغایرت وزن طلا (ثبت‌شده: ${existingTx.goldAmount} گرم، فایل جدید: ${expectedGold} گرم)`);
                      }
                      if (!rialMatches) {
                        reasons.push(`مغایرت مبلغ ریالی (ثبت‌شده: ${existingTx.rialAmount} ریال، فایل جدید: ${expectedRial} ریال)`);
                      }

                      warnings.push({
                        code: 'WARN_DUPLICATE_DATA_MISMATCH',
                        message: `سند شماره ${doc.documentNumber} ردیف ${line.lineNumber}: سند قبلاً در سیستم ثبت شده اما مقادیر با فایل جدید مغایرت دارد [علت ناهماهنگی: ${reasons.join(', ')}]. جهت حفظ سلامت دفاتر مالی بازنویسی نشد.`,
                        severity: 'WARNING',
                        sourceType: 'document',
                        sourceId: doc.sourceFactorCode,
                        details: {
                          existingId: existingTx.id,
                          expectedGold,
                          actualGold: existingTx.goldAmount,
                          expectedRial,
                          actualRial: existingTx.rialAmount,
                          mismatchReasons: reasons,
                        },
                      });
                      skippedDuplicates++;
                      return;
                    }
                  }

                  let matchedAssayLabName = line.assayLabName || '';
                  let matchedAssayLabId = '';
                  if (matchedAssayLabName) {
                    const m = session.assayLabMapByName.get(normalizeAssayLabText(matchedAssayLabName)) ||
                              session.assayLabMapByName.get(normalizeAssayLabText(stripAssayLabAffixes(matchedAssayLabName))) ||
                              session.assayLabMapByName.get(matchedAssayLabName.trim());
                    if (m) {
                      matchedAssayLabName = m.name;
                      matchedAssayLabId = m.id;
                    }
                  }

                  const isCurrencyLine = line.kind === 'currency' || Boolean(line.foreignCurrency);
                  const isGoldLine = line.metalType === 'gold';
                  const isSilverLine = line.metalType === 'silver';

                  const docDetailsObj: Record<string, any> = {
                    sourceSystem: 'tahesab',
                    sourceFactorCode: doc.sourceFactorCode,
                    sourceLineNumber: line.lineNumber,
                    migrationId,
                    metalType: isSilverLine ? 'silver' : isGoldLine ? 'gold' : undefined,
                    baseKarat: isSilverLine ? 999 : isGoldLine ? 750 : undefined,
                    rawKind: isGoldLine
                      ? line.kind === 'conditional'
                        ? 'conditional'
                        : line.kind === 'melted'
                        ? 'molten'
                        : 'misc'
                      : undefined,
                    rawWeight: line.weight > 0 ? String(line.weight) : '',
                    purity: line.grade > 0 ? String(line.grade) : '',
                    stampNumber: line.assayStampNumber || '',
                    labName: matchedAssayLabName || undefined,
                    assayStampNumber: line.assayStampNumber,
                    assayLabName: matchedAssayLabName || undefined,
                    assayLaboratoryId: matchedAssayLabId || undefined,
                    transferToken: line.transferToken,
                    transferSide: line.transferSide,
                    transferPartnerName: line.transferPartnerName,
                    weight: line.weight,
                    grade: line.grade,
                    convertedWeight750: line.convertedWeight750,
                    isConditional: line.isConditional,
                    partySide: line.partySide,
                    signedGoldAmount: line.signedGoldAmount,
                    signedRialAmount: line.signedRialAmount,
                    signedForeignAmount: line.signedForeignAmount,
                  };

                  if (line.kind === 'bank') {
                    const bankAccId =
                      (line.bankAccountNumber ? session.bankAccountMap.get(line.bankAccountNumber) : undefined) ||
                      (line.bankName ? session.bankAccountMap.get(line.bankName) : undefined);
                    docDetailsObj.bankName = line.bankName;
                    docDetailsObj.bankAccountNumber = line.bankAccountNumber;
                    docDetailsObj.bankAccountId = bankAccId;
                    docDetailsObj.financialAccountId = bankAccId;
                  }

                  if (line.kind === 'workmanship') {
                    docDetailsObj.workmanshipName = line.workmanshipName || line.description;
                    docDetailsObj.wagePercent = line.wagePercent;
                    docDetailsObj.wageGoldWeight = line.wageGoldWeight;
                  }

                  let lineCurrencyCode = '';
                  let lineCurrencySymbol = '';
                  let lineCurrencyName = '';

                  if (isCurrencyLine) {
                    const rawCurr = (line.foreignCurrency || 'USD').trim().toUpperCase();
                    const mappedCurr =
                      session.currencyMapByCode.get(rawCurr) ||
                      session.currencyMapByCode.get((line.foreignCurrency || '').trim());
                    lineCurrencyCode = mappedCurr?.code || rawCurr || 'USD';
                    lineCurrencySymbol = mappedCurr?.symbol || (lineCurrencyCode === 'USD' ? '$' : lineCurrencyCode);
                    lineCurrencyName = mappedCurr?.name || lineCurrencyCode;

                    docDetailsObj.currencyQuantity = line.foreignAmount;
                    docDetailsObj.currencyUnit = lineCurrencyCode;
                    docDetailsObj.currencyName = lineCurrencyName;
                    docDetailsObj.currencySymbol = lineCurrencySymbol;
                    if (line.kind === 'cash') {
                      docDetailsObj.isForeignCash = true;
                    } else {
                      docDetailsObj.unsettledTrade = true;
                    }
                  }

                  let lineDocNum = generateZfDocumentNumber();
                  while (session.usedDocNumbers.has(lineDocNum)) {
                    lineDocNum = generateZfDocumentNumber();
                  }
                  session.usedDocNumbers.add(lineDocNum);

                  const txRecord = await writer.collection('transactions').create({
                    customer: targetCustId,
                    customerCode: targetCustCode,
                    createdBy: effectiveUserId || undefined,
                    updatedBy: effectiveUserId || undefined,
                    transactionType: 'document',
                    status: 'posted',
                    isOpeningBalance: false,
                    transactionDate: line.dateIso || new Date().toISOString(),
                    documentId: docUuid,
                    documentSequence: docSeq,
                    documentNumberPrefixSnapshot: activePrefix,
                    documentNumber: lineDocNum,
                    description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                    goldAmount:
                      line.metalType === 'gold'
                        ? (typeof line.signedGoldAmount === 'number'
                            ? line.signedGoldAmount
                            : line.nature === 'received'
                            ? line.convertedWeight750
                            : -line.convertedWeight750)
                        : 0,
                    silverAmount:
                      line.metalType === 'silver'
                        ? (typeof line.signedGoldAmount === 'number'
                            ? line.signedGoldAmount
                            : line.nature === 'received'
                            ? line.convertedWeight750
                            : -line.convertedWeight750)
                        : 0,
                    platinumAmount: 0,
                    rialAmount:
                      typeof line.signedRialAmount === 'number'
                        ? line.signedRialAmount
                        : line.amountIrr > 0
                        ? line.nature === 'received'
                          ? line.amountIrr
                          : -line.amountIrr
                        : 0,
                    foreignAmount:
                      typeof line.signedForeignAmount === 'number'
                        ? line.signedForeignAmount
                        : line.foreignAmount || 0,
                    foreignCurrency: lineCurrencyCode,
                    foreignCurrencySymbol: lineCurrencySymbol,
                    documentNature: line.nature,
                    documentTab:
                      line.kind === 'bank'
                        ? 'bank'
                        : line.kind === 'workmanship'
                        ? 'workmanship'
                        : isCurrencyLine && line.kind !== 'cash'
                        ? 'currency'
                        : line.kind === 'melted' || line.kind === 'conditional'
                        ? 'raw-gold'
                        : line.kind === 'claim'
                        ? 'our-claim'
                        : line.kind === 'cash'
                        ? 'cash'
                        : 'general',
                    documentSubType:
                      line.kind === 'bank'
                        ? line.nature === 'paid'
                          ? 'pay-to-customer'
                          : 'receive-from-customer'
                        : line.kind === 'workmanship'
                        ? line.nature === 'paid'
                          ? 'exit_manufactured'
                          : 'entry_manufactured'
                        : line.kind === 'cash'
                        ? line.nature === 'received'
                          ? 'cash-in'
                          : 'cash-out'
                        : isCurrencyLine
                        ? line.nature === 'received'
                          ? 'currency-buy'
                          : 'currency-sale'
                        : line.kind === 'melted'
                        ? line.nature === 'received'
                          ? 'incoming-molten'
                          : 'outgoing-molten'
                        : line.kind === 'conditional'
                        ? line.nature === 'received'
                          ? 'incoming-conditional'
                          : 'outgoing-conditional'
                        : '',
                    documentDateJalali: line.dateJalali || doc.dateJalali,
                    settlementMethod: line.kind === 'cash' ? 'cash' : line.kind === 'bank' ? 'bank' : 'unsettled',
                    balanceSource: 'current',
                    documentDetails: JSON.stringify(docDetailsObj),
                    sourceKey: lineSourceKey,
                  });

                  const createdMeta: ExistingTxMeta = {
                    id: txRecord.id,
                    customer: targetCustId,
                    goldAmount: (txRecord as any).goldAmount || 0,
                    rialAmount: (txRecord as any).rialAmount || 0,
                    sourceKey: lineSourceKey,
                    documentNumber: lineDocNum,
                  };
                  session.existingTxByExactKey.set(lineSourceKey, createdMeta);
                  session.existingTxByFactorAndLine.set(factorLineKey, createdMeta);

                  importedLines++;
                  docImported = true;

                  // Register in metal_inventory if raw/melted/conditional metal (both incoming and outgoing)
                  if (
                    line.weight > 0 &&
                    (line.kind === 'melted' || line.kind === 'conditional') &&
                    (line.metalType === 'gold' || line.metalType === 'silver')
                  ) {
                    try {
                      const baseKarat = line.metalType === 'silver' ? 999 : 750;
                      const invDirection = line.nature === 'received' ? 'in' : 'out';
                      const invTxType =
                        line.isOpeningInventory
                          ? 'opening-balance'
                          : line.kind === 'melted'
                          ? invDirection === 'in'
                            ? 'incoming-molten'
                            : 'outgoing-molten'
                          : invDirection === 'in'
                          ? 'incoming-conditional'
                          : 'outgoing-conditional';

                      await writer.collection('metal_inventory').create({
                        metal: line.metalType,
                        inventory_type: line.kind === 'conditional' ? 'conditional' : 'melted',
                        direction: invDirection,
                        transaction_type: invTxType,
                        raw_weight: line.weight,
                        purity: line.grade,
                        base_karat: baseKarat,
                        converted_weight: line.convertedWeight750,
                        stamp_number: line.assayStampNumber || '',
                        lab_name: matchedAssayLabName || '',
                        date: line.dateIso || new Date().toISOString(),
                        transaction_id: txRecord.id,
                        document_id: docUuid,
                        customer: targetCustId,
                        is_opening_balance: Boolean(line.isOpeningInventory),
                        created_by: effectiveUserId || undefined,
                        description: `مهاجرت از ته‌حساب سند #${doc.documentNumber}`,
                      });
                      importedMetalLots++;
                    } catch {
                      // Non-blocking lot registration
                    }
                  }

                  // Post double-entry journal entry via posting engine if financial value exists
                  if (line.amountIrr > 0) {
                    try {
                      const journalSourceKey = `doc_mig:${lineSourceKey}`;
                      const partySide = line.partySide || (line.nature === 'received' ? 'creditor' : 'debtor');

                      let counterpartAccountId: string = SYSTEM_ACCOUNT_CODES.CASH_AND_BANK; // 1110
                      if (line.kind === 'sale') {
                        counterpartAccountId = SYSTEM_ACCOUNT_CODES.GOLD_SALES_REVENUE; // 4110
                      } else if (line.kind === 'purchase') {
                        counterpartAccountId = SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY; // 1130
                      } else if (line.kind === 'wage') {
                        counterpartAccountId = '4120'; // درآمد اجرت و خدمات
                      } else if (line.kind === 'opening' || line.isOpeningInventory) {
                        counterpartAccountId = SYSTEM_ACCOUNT_CODES.OPENING_EQUITY; // 3100
                      } else if (line.kind === 'bank' || line.kind === 'cash') {
                        counterpartAccountId = SYSTEM_ACCOUNT_CODES.CASH_AND_BANK; // 1110
                      }

                      const journalLines: JournalLineInput[] = [];

                      if (partySide === 'creditor') {
                        journalLines.push({
                          accountId: counterpartAccountId,
                          debit: line.amountIrr,
                          credit: 0,
                          description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                        });
                        journalLines.push({
                          accountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
                          debit: 0,
                          credit: line.amountIrr,
                          description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                          partyId: targetCustId,
                        });
                      } else {
                        journalLines.push({
                          accountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
                          debit: line.amountIrr,
                          credit: 0,
                          description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                          partyId: targetCustId,
                        });
                        journalLines.push({
                          accountId: counterpartAccountId,
                          debit: 0,
                          credit: line.amountIrr,
                          description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                        });
                      }

                      await postJournalEntry(
                        {
                          entryDate: line.dateIso ? line.dateIso.slice(0, 10) : undefined,
                          entryDateJalali: line.dateJalali || doc.dateJalali,
                          description: `سند #${doc.documentNumber} ته‌حساب: ${line.description || ''}`,
                          sourceType: 'document',
                          sourceId: txRecord.id,
                          sourceKey: journalSourceKey,
                          userId: effectiveUserId,
                          lines: journalLines,
                        },
                        writer,
                      );
                      importedJournalEntries++;
                    } catch (jErr) {
                      warnings.push({
                        code: 'WARN_JOURNAL_POST',
                        message: `هشدار در ثبت سند دوبل برای ردیف ${line.lineNumber}: ${jErr instanceof Error ? jErr.message : String(jErr)}`,
                        severity: 'WARNING',
                        sourceType: 'journal',
                        sourceId: lineSourceKey,
                      });
                    }
                  }
                } catch (err) {
                  errors.push({
                    code: 'ERR_IMPORT_LINE',
                    message: `خطا در ثبت ردیف ${line.lineNumber} سند ${doc.documentNumber}: ${err instanceof Error ? err.message : String(err)}`,
                    severity: 'ERROR',
                    sourceType: 'document_line',
                    sourceId: lineSourceKey,
                  });
                }
              } else {
                importedLines++;
                docImported = true;
              }
            }),
          );

          if (docImported) {
            importedDocuments++;
          }
        }),
      );
    }

    const currentPercent = Math.min(95, 50 + Math.round(((startIndex + i + chunk.length) / totalDocs) * 45));
    onProgress?.({
      stage: 'importing',
      percent: currentPercent,
      currentStep: 4,
      totalSteps: 5,
      message: `در حال ثبت اسناد (${Math.min(startIndex + i + batchSize, totalDocs)} از ${totalDocs})...`,
      importedItems: importedDocuments,
      totalItems: totalDocs,
    });
  }

  const nextOffset = endIndex < totalDocs ? endIndex : null;
  const isFinished = nextOffset === null;

  if (isFinished) {
    if (!dryRun) {
      for (const party of data.parties) {
        const custId = session.customerIdBySourceCode.get(party.sourceCode);
        const custCode = session.customerCodeBySourceCode.get(party.sourceCode);
        if (!custId) continue;

        const hasGoldOpening = Math.abs(party.openingGoldWeight || 0) >= 0.001;
        const hasRialOpening = Math.abs(party.openingRialBalance || 0) >= 1;

        if (!hasGoldOpening && !hasRialOpening) continue;

        const hasDocs = data.documents.some((d) => d.sourceCustomerCode === party.sourceCode);
        if (hasDocs) continue;

        const openKey = `tahesab:${migrationId}:cust_open:${party.sourceCode}`;
        if (session.existingTxByExactKey.has(openKey)) continue;

        try {
          let openDocNum = generateZfDocumentNumber();
          while (session.usedDocNumbers.has(openDocNum)) {
            openDocNum = generateZfDocumentNumber();
          }
          session.usedDocNumbers.add(openDocNum);

          const openTx = await writer.collection('transactions').create({
            customer: custId,
            customerCode: custCode,
            createdBy: effectiveUserId || undefined,
            updatedBy: effectiveUserId || undefined,
            transactionType: 'opening_balance',
            status: 'posted',
            isOpeningBalance: true,
            transactionDate: new Date().toISOString(),
            documentNumber: openDocNum,
            description: `مانده اول دوره ته‌حساب (${party.name})`,
            goldAmount: party.openingGoldWeight || 0,
            silverAmount: 0,
            platinumAmount: 0,
            rialAmount: party.openingRialBalance || 0,
            documentNature: (party.openingGoldWeight || 0) >= 0 && (party.openingRialBalance || 0) >= 0 ? 'received' : 'paid',
            documentTab: 'general',
            settlementMethod: 'unsettled',
            balanceSource: 'opening',
            sourceKey: openKey,
          });

          session.existingTxByExactKey.set(openKey, {
            id: openTx.id,
            customer: custId,
            goldAmount: party.openingGoldWeight || 0,
            rialAmount: party.openingRialBalance || 0,
            sourceKey: openKey,
            documentNumber: openDocNum,
          });
        } catch (openErr) {
          warnings.push({
            code: 'WARN_OPENING_TX',
            message: `خطا در ایجاد سند مانده اول دوره برای طرف‌حساب "${party.name}": ${openErr instanceof Error ? openErr.message : String(openErr)}`,
            severity: 'WARNING',
            sourceType: 'party',
            sourceId: party.sourceCode,
          });
        }
      }
    }

    onProgress?.({
      stage: 'finalizing',
      percent: 100,
      currentStep: 5,
      totalSteps: 5,
      message: 'مهاجرت با موفقیت پایان یافت.',
    });
  }

  const endTime = Date.now();
  const durationMs = endTime - startTime;
  const durationSec = Math.max(1, Math.round(durationMs / 1000));
  const averageSpeedDocsPerSec = Math.round((importedDocuments / (durationMs / 1000 || 1)) * 10) / 10;

  const completedDate = new Date(endTime);
  const completedTimeIso = completedDate.toISOString();

  const completedTimeJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(completedDate);

  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  const durationFormatted = mins > 0 ? `${mins} دقیقه و ${secs} ثانیه` : `${secs} ثانیه`;

  return {
    migrationId,
    sourceSystem: 'tahesab',
    status: isFinished ? (errors.length === 0 ? 'completed' : 'completed') : 'in_progress',
    importedParties,
    importedBankAccounts,
    importedAssayLabs,
    importedDocuments,
    importedLines,
    importedJournalEntries,
    importedMetalInventoryLots: importedMetalLots,
    skippedDuplicates,
    durationMs,
    startTimeIso,
    completedTimeIso,
    completedTimeJalali,
    durationFormatted,
    averageSpeedDocsPerSec,
    nextOffset,
    totalDocuments: totalDocs,
    errors,
    warnings,
  };
}
