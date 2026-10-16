import { randomUUID } from 'node:crypto';
import type PocketBase from 'pocketbase';
import { postJournalEntry, SYSTEM_ACCOUNT_CODES, type JournalLineInput } from '@/features/accounting/posting/posting-engine';
import { getNextDocumentSequenceForCustomer, buildDocumentNumber, getActiveDocumentPrefix } from '@/lib/document-service';
import { getNextAutoCustomerCode } from '@/features/accounting/chart-of-accounts/services/account-code';
import { generateZfDocumentNumber } from '@/lib/document-number';
import type {
  NormalizedMigrationData,
  NormalizedDocument,
  MigrationMappings,
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

/**
 * High-Speed & Resilient Importer Engine:
 * Migrates normalized Tahesab data into Zarfolio using the existing domain entities,
 * PocketBase collections, and posting engine.
 * Fully Idempotent via deterministic sourceKey and optimized with in-memory sequence caches
 * and batch concurrency.
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
    batchSize = 200,
    concurrency = 6,
    dryRun = false,
    docOffset = 0,
    docLimit,
    onProgress,
  } = options;

  const errors: MigrationIssue[] = [];
  const warnings: MigrationIssue[] = [];

  let importedParties = 0;
  let importedBankAccounts = 0;
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

  // Maps to resolve target customer ID, customerCode, and cached sequence by source code
  const customerIdBySourceCode = new Map<string, string>();
  const customerCodeBySourceCode = new Map<string, number>();
  const customerSequenceMap = new Map<string, number>();

  const usedCustomerCodes = new Set<number>();
  const usedDocNumbers = new Set<string>();
  const customerById = new Map<string, { id: string; name: string; customerCode: number }>();
  const customerByName = new Map<string, { id: string; name: string; customerCode: number }>();

  // If executing live (not dry run), pre-load existing customers and codes
  if (!dryRun) {
    try {
      const existingCustomers = await writer.collection('customers').getFullList({
        fields: 'id,name,customerCode,privateDescription',
      });

      for (const c of existingCustomers) {
        const codeNum = Number(c.customerCode) || 0;
        if (codeNum > 0) {
          usedCustomerCodes.add(codeNum);
        }
        customerById.set(c.id, { id: c.id, name: c.name, customerCode: codeNum });
        if (c.name) {
          customerByName.set(c.name.trim(), { id: c.id, name: c.name, customerCode: codeNum });
        }
        // Match by Tahesab source code if tagged in privateDescription
        const match = String(c.privateDescription || '').match(/کد منبع:\s*([^\s,)]+)/);
        if (match && match[1]) {
          customerIdBySourceCode.set(match[1], c.id);
          customerCodeBySourceCode.set(match[1], codeNum);
        }
      }

      // Also map from mappings.parties
      for (const p of mappings.parties) {
        if (p.targetCustomerId && !customerIdBySourceCode.has(p.sourceCode)) {
          customerIdBySourceCode.set(p.sourceCode, p.targetCustomerId);
          const c = customerById.get(p.targetCustomerId);
          if (c && c.customerCode) {
            customerCodeBySourceCode.set(p.sourceCode, c.customerCode);
          }
        } else if (!customerIdBySourceCode.has(p.sourceCode)) {
          const c = customerByName.get(p.sourceName.trim());
          if (c) {
            customerIdBySourceCode.set(p.sourceCode, c.id);
            if (c.customerCode) customerCodeBySourceCode.set(p.sourceCode, c.customerCode);
          }
        }
      }

      // Pre-load used document numbers
      const existingTxDocs = await writer.collection('transactions').getFullList({
        fields: 'documentNumber',
      }).catch(() => []);
      for (const tx of existingTxDocs) {
        if (tx.documentNumber) usedDocNumbers.add(tx.documentNumber);
      }
    } catch {
      // In tests or offline mode, continue
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
      let targetCustomerId = mapping?.targetCustomerId || customerIdBySourceCode.get(party.sourceCode);
      let targetCustomerCode = customerCodeBySourceCode.get(party.sourceCode);

      if (!targetCustomerId && mapping?.status === 'new_party') {
        if (!dryRun) {
          try {
            // Check if already created by name in this or previous migration
            const existing = await pb
              .collection('customers')
              .getFirstListItem(pb.filter('name = {:name}', { name: party.name }))
              .catch(() => null);

            if (existing) {
              targetCustomerId = existing.id;
              targetCustomerCode = Number(existing.customerCode);
            } else {
              // Determine next unique customer code
              let assignedCode: number;
              const numericSourceCode = Number(party.sourceCode);
              if (
                Number.isInteger(numericSourceCode) &&
                numericSourceCode > 0 &&
                !usedCustomerCodes.has(numericSourceCode)
              ) {
                assignedCode = numericSourceCode;
              } else {
                assignedCode = getNextAutoCustomerCode(Array.from(usedCustomerCodes));
              }
              usedCustomerCodes.add(assignedCode);

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
        customerIdBySourceCode.set(party.sourceCode, targetCustomerId);
        if (targetCustomerCode) {
          customerCodeBySourceCode.set(party.sourceCode, targetCustomerCode);
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
          const existing = await writer
            .collection('bank_accounts')
            .getFirstListItem(writer.filter('accountNumber = {:acc}', { acc: bAcc.accountNumber }))
            .catch(() => null);

          if (!existing) {
            await writer.collection('bank_accounts').create({
              bankName: bAcc.bankName,
              accountNumber: bAcc.accountNumber,
              balance: Math.max(0, bAcc.currentBalanceIrr),
              accountCodeZero: bAcc.accountNumber || '0',
              currency: 'IRR',
              createdBy: effectiveUserId || undefined,
            });
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
  } else {
    // If not first chunk, populate customer maps from existing mapped list or fallback
    for (const party of data.parties) {
      const mapping = mappings.parties.find((p) => p.sourceCode === party.sourceCode);
      if (mapping?.targetCustomerId && !customerIdBySourceCode.has(party.sourceCode)) {
        customerIdBySourceCode.set(party.sourceCode, mapping.targetCustomerId);
        const c = customerById.get(mapping.targetCustomerId);
        if (c && c.customerCode) customerCodeBySourceCode.set(party.sourceCode, c.customerCode);
      } else if (!customerIdBySourceCode.has(party.sourceCode)) {
        const c = customerByName.get(party.name.trim());
        if (c) {
          customerIdBySourceCode.set(party.sourceCode, c.id);
          if (c.customerCode) customerCodeBySourceCode.set(party.sourceCode, c.customerCode);
        } else {
          customerIdBySourceCode.set(party.sourceCode, `cust_${party.sourceCode}`);
          customerCodeBySourceCode.set(party.sourceCode, Number(party.sourceCode) || 1000);
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

  const activePrefix = await getActiveDocumentPrefix(pb);
  const totalDocs = data.documents.length;
  const startIndex = Math.max(0, docOffset);
  const endIndex = typeof docLimit === 'number' ? Math.min(totalDocs, startIndex + docLimit) : totalDocs;
  const docsSlice = data.documents.slice(startIndex, endIndex);

  interface ExistingTxMeta {
    id: string;
    customer: string;
    goldAmount: number;
    rialAmount: number;
    sourceKey: string;
    documentNumber?: string;
  }

  // Pre-load known transactions originating from Tahesab to avoid per-line HTTP roundtrips
  // and enable instantaneous duplicate verification.
  const existingTxByExactKey = new Map<string, ExistingTxMeta>();
  const existingTxByFactorAndLine = new Map<string, ExistingTxMeta>();

  if (!dryRun) {
    try {
      const existingList = await writer.collection('transactions').getFullList({
        filter: writer.filter("sourceKey ~ 'tahesab:'"),
        fields: 'id,sourceKey,customer,goldAmount,rialAmount,documentNumber',
      });
      for (const r of existingList) {
        if (r.sourceKey) {
          const meta: ExistingTxMeta = {
            id: r.id,
            customer: String(r.customer || ''),
            goldAmount: Number(r.goldAmount) || 0,
            rialAmount: Number(r.rialAmount) || 0,
            sourceKey: r.sourceKey,
            documentNumber: r.documentNumber,
          };
          existingTxByExactKey.set(r.sourceKey, meta);
          const parts = r.sourceKey.split(':');
          if (parts.length >= 4) {
            existingTxByFactorAndLine.set(`${parts[2]}:${parts[3]}`, meta);
          }
        }
      }
    } catch {
      // In offline tests or when collection is empty, continue
    }
  }

  // 3. Process Documents & Lines in Parallel Sub-Batches for High Throughput
  for (let i = 0; i < docsSlice.length; i += batchSize) {
    const chunk = docsSlice.slice(i, i + batchSize);

    for (let c = 0; c < chunk.length; c += concurrency) {
      const subBatch = chunk.slice(c, c + concurrency);

      await Promise.all(
        subBatch.map(async (doc) => {
          let targetCustId = customerIdBySourceCode.get(doc.sourceCustomerCode);
          let targetCustCode = customerCodeBySourceCode.get(doc.sourceCustomerCode) || 0;

          if (!targetCustId) {
            // Fallback match by party name
            const party = data.parties.find((p) => p.sourceCode === doc.sourceCustomerCode);
            if (party) {
              const matchedCust = customerByName.get(party.name.trim());
              if (matchedCust) {
                targetCustId = matchedCust.id;
                targetCustCode = matchedCust.customerCode;
                customerIdBySourceCode.set(doc.sourceCustomerCode, targetCustId);
                customerCodeBySourceCode.set(doc.sourceCustomerCode, targetCustCode);
              }
            }
          }

          if (!targetCustId) {
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

          // Cached sequence increment to eliminate per-document HTTP calls
          let docSeq = customerSequenceMap.get(targetCustId);
          if (docSeq === undefined) {
            try {
              docSeq = await getNextDocumentSequenceForCustomer(writer, targetCustId);
            } catch {
              docSeq = 1;
            }
          } else {
            docSeq += 1;
          }
          customerSequenceMap.set(targetCustId, docSeq);

          let docImported = false;

          for (const line of doc.lines) {
            const lineSourceKey = `tahesab:${migrationId}:${doc.sourceFactorCode}:${line.lineNumber}`;
            const factorLineKey = `${doc.sourceFactorCode}:${line.lineNumber}`;

            if (!dryRun) {
              try {
                // High-performance idempotency & duplicate verification check
                let existingTx = existingTxByExactKey.get(lineSourceKey) || existingTxByFactorAndLine.get(factorLineKey);
                if (!existingTx) {
                  try {
                    const fallback = await writer
                      .collection('transactions')
                      .getFirstListItem(writer.filter('sourceKey = {:key}', { key: lineSourceKey }));
                    if (fallback) {
                      existingTx = {
                        id: fallback.id,
                        customer: String(fallback.customer || ''),
                        goldAmount: Number(fallback.goldAmount) || 0,
                        rialAmount: Number(fallback.rialAmount) || 0,
                        sourceKey: fallback.sourceKey,
                        documentNumber: fallback.documentNumber,
                      };
                      existingTxByExactKey.set(lineSourceKey, existingTx);
                      existingTxByFactorAndLine.set(factorLineKey, existingTx);
                    }
                  } catch {
                    // Not found, proceed with insertion
                  }
                }

                if (existingTx) {
                  // Fast verify in-memory
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
                    continue;
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
                    continue;
                  }
                }

                const docDetailsObj = {
                  sourceSystem: 'tahesab',
                  sourceFactorCode: doc.sourceFactorCode,
                  sourceLineNumber: line.lineNumber,
                  migrationId,
                  assayStampNumber: line.assayStampNumber,
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

                let lineDocNum = generateZfDocumentNumber();
                while (usedDocNumbers.has(lineDocNum)) {
                  lineDocNum = generateZfDocumentNumber();
                }
                usedDocNumbers.add(lineDocNum);

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
                  foreignCurrency: line.foreignCurrency || '',
                  foreignCurrencySymbol: line.foreignCurrency ? String(line.foreignCurrency) : '',
                  documentNature: line.nature,
                  documentTab:
                    line.kind === 'melted' || line.kind === 'conditional'
                      ? 'raw-gold'
                      : line.kind === 'claim'
                      ? 'our-claim'
                      : line.kind === 'cash'
                      ? 'cash'
                      : line.kind === 'currency'
                      ? 'currency'
                      : 'general',
                  documentSubType:
                    line.kind === 'melted'
                      ? line.nature === 'received'
                        ? 'incoming-molten'
                        : 'outgoing-molten'
                      : line.kind === 'conditional'
                      ? line.nature === 'received'
                        ? 'incoming-conditional'
                        : 'outgoing-conditional'
                      : '',
                  documentDateJalali: line.dateJalali || doc.dateJalali,
                  settlementMethod: line.kind === 'cash' ? 'cash' : 'unsettled',
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
                existingTxByExactKey.set(lineSourceKey, createdMeta);
                existingTxByFactorAndLine.set(factorLineKey, createdMeta);

                importedLines++;
                docImported = true;

                // Register in metal_inventory if raw gold
                if (line.weight > 0 && (line.kind === 'melted' || line.kind === 'conditional') && line.nature === 'received') {
                  try {
                    await writer.collection('metal_inventory').create({
                      metal: line.metalType === 'silver' ? 'silver' : 'gold',
                      inventory_type: line.kind === 'conditional' ? 'conditional' : 'melted',
                      direction: 'in',
                      transaction_type: 'document',
                      raw_weight: line.weight,
                      purity: line.grade,
                      base_karat: line.metalType === 'silver' ? 999 : 750,
                      converted_weight: line.convertedWeight750,
                      stamp_number: line.assayStampNumber || '',
                      date: line.dateIso || new Date().toISOString(),
                      transaction_id: txRecord.id,
                      document_id: docUuid,
                      customer: targetCustId,
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

                    // Determine counterpart account based on transaction kind
                    let counterpartAccountId: string = SYSTEM_ACCOUNT_CODES.CASH_AND_BANK; // 1110
                    if (line.kind === 'sale') {
                      counterpartAccountId = SYSTEM_ACCOUNT_CODES.GOLD_SALES_REVENUE; // 4110
                    } else if (line.kind === 'purchase') {
                      counterpartAccountId = SYSTEM_ACCOUNT_CODES.GOLD_INVENTORY; // 1130
                    } else if (line.kind === 'wage') {
                      counterpartAccountId = '4120'; // درآمد اجرت و خدمات
                    } else if (line.kind === 'opening') {
                      counterpartAccountId = SYSTEM_ACCOUNT_CODES.OPENING_EQUITY; // 3100
                    }

                    const journalLines: JournalLineInput[] = [];

                    if (partySide === 'creditor') {
                      // Customer is Creditor (بستانکار)
                      // 1. Counterpart account is Debited (بدهکار)
                      journalLines.push({
                        accountId: counterpartAccountId,
                        debit: line.amountIrr,
                        credit: 0,
                        description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                      });
                      // 2. Customer liability account (2120) is Credited (بستانکار)
                      journalLines.push({
                        accountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY,
                        debit: 0,
                        credit: line.amountIrr,
                        description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                        partyId: targetCustId,
                      });
                    } else {
                      // Customer is Debtor (بدهکار)
                      // 1. Customer receivable account (1120) is Debited (بدهکار)
                      journalLines.push({
                        accountId: SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE,
                        debit: line.amountIrr,
                        credit: 0,
                        description: line.description || `سند ته‌حساب #${doc.documentNumber}`,
                        partyId: targetCustId,
                      });
                      // 2. Counterpart account is Credited (بستانکار)
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
          }

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
