import { randomUUID } from 'node:crypto';
import type PocketBase from 'pocketbase';
import { postJournalEntry } from '@/features/accounting/posting/posting-engine';
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

  // Maps to resolve target customer ID, customerCode, and cached sequence by source code
  const customerIdBySourceCode = new Map<string, string>();
  const customerCodeBySourceCode = new Map<string, number>();
  const customerSequenceMap = new Map<string, number>();

  const usedCustomerCodes = new Set<number>();
  const usedDocNumbers = new Set<string>();

  // If executing live (not dry run), pre-load existing customers and codes
  if (!dryRun) {
    try {
      const existingCustomers = await pb.collection('customers').getFullList({
        fields: 'id,name,customerCode,privateDescription',
      });
      for (const c of existingCustomers) {
        if (c.customerCode) {
          usedCustomerCodes.add(Number(c.customerCode));
        }
        // Match by Tahesab source code if tagged in privateDescription
        const match = String(c.privateDescription || '').match(/کد منبع:\s*([^\s,)]+)/);
        if (match && match[1]) {
          customerIdBySourceCode.set(match[1], c.id);
          customerCodeBySourceCode.set(match[1], Number(c.customerCode));
        }
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

              const newCust = await pb.collection('customers').create({
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
                createdBy: userId || undefined,
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
          const existing = await pb
            .collection('bank_accounts')
            .getFirstListItem(pb.filter('accountNumber = {:acc}', { acc: bAcc.accountNumber }))
            .catch(() => null);

          if (!existing) {
            await pb.collection('bank_accounts').create({
              bankName: bAcc.bankName,
              accountNumber: bAcc.accountNumber,
              balance: Math.max(0, bAcc.currentBalanceIrr),
              accountCodeZero: bAcc.accountNumber || '0',
              currency: 'IRR',
              createdBy: userId || undefined,
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
      } else if (!customerIdBySourceCode.has(party.sourceCode)) {
        customerIdBySourceCode.set(party.sourceCode, `cust_${party.sourceCode}`);
        customerCodeBySourceCode.set(party.sourceCode, Number(party.sourceCode) || 1000);
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

  // Pre-load known sourceKeys for this migration chunk to avoid per-line HTTP roundtrips
  const knownSourceKeys = new Set<string>();
  if (!dryRun) {
    try {
      const existingList = await pb.collection('transactions').getFullList({
        filter: pb.filter('sourceKey ~ {:migId}', { migId: `tahesab:${migrationId}:` }),
        fields: 'sourceKey',
      });
      for (const r of existingList) {
        if (r.sourceKey) knownSourceKeys.add(r.sourceKey);
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
          const targetCustId = customerIdBySourceCode.get(doc.sourceCustomerCode);
          const targetCustCode = customerCodeBySourceCode.get(doc.sourceCustomerCode) || 0;

          if (!targetCustId) {
            warnings.push({
              code: 'WARN_DOC_SKIPPED_NO_PARTY',
              message: `سند شماره ${doc.documentNumber} به دلیل عدم وجود طرف‌حساب تطبیق‌یافته نادیده گرفته شد.`,
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
              docSeq = await getNextDocumentSequenceForCustomer(pb, targetCustId);
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

            if (!dryRun) {
              try {
                // High-performance idempotency check (in-memory cache + fallback)
                let isDuplicate = knownSourceKeys.has(lineSourceKey);
                if (!isDuplicate) {
                  try {
                    const existing = await pb
                      .collection('transactions')
                      .getFirstListItem(pb.filter('sourceKey = {:key}', { key: lineSourceKey }));
                    if (existing) {
                      isDuplicate = true;
                      knownSourceKeys.add(lineSourceKey);
                    }
                  } catch {
                    // Not found, proceed with insertion
                  }
                }

                if (isDuplicate) {
                  skippedDuplicates++;
                  continue;
                }
                knownSourceKeys.add(lineSourceKey);

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
                };

                let lineDocNum = generateZfDocumentNumber();
                while (usedDocNumbers.has(lineDocNum)) {
                  lineDocNum = generateZfDocumentNumber();
                }
                usedDocNumbers.add(lineDocNum);

                const txRecord = await pb.collection('transactions').create({
                  customer: targetCustId,
                  customerCode: targetCustCode,
                  createdBy: userId || undefined,
                  updatedBy: userId || undefined,
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
                      ? line.nature === 'received'
                        ? line.convertedWeight750
                        : -line.convertedWeight750
                      : 0,
                  silverAmount:
                    line.metalType === 'silver'
                      ? line.nature === 'received'
                        ? line.convertedWeight750
                        : -line.convertedWeight750
                      : 0,
                  platinumAmount: 0,
                  rialAmount: line.amountIrr > 0 ? (line.nature === 'received' ? line.amountIrr : -line.amountIrr) : 0,
                  foreignAmount: line.foreignAmount || 0,
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

                importedLines++;
                docImported = true;

                // Register in metal_inventory if raw gold
                if (line.weight > 0 && (line.kind === 'melted' || line.kind === 'conditional') && line.nature === 'received') {
                  try {
                    await pb.collection('metal_inventory').create({
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
                      created_by: userId || undefined,
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
                    await postJournalEntry(
                      {
                        entryDate: line.dateIso.slice(0, 10),
                        entryDateJalali: line.dateJalali,
                        description: `سند #${doc.documentNumber} ته‌حساب: ${line.description}`,
                        sourceType: 'document',
                        sourceId: txRecord.id,
                        sourceKey: journalSourceKey,
                        userId: userId,
                        lines: [
                          {
                            accountId: '1110', // Cash / Bank
                            debit: line.nature === 'received' ? line.amountIrr : 0,
                            credit: line.nature === 'paid' ? line.amountIrr : 0,
                            description: line.description,
                            partyId: targetCustId,
                          },
                          {
                            accountId: '2120', // Counterparty Liability
                            debit: line.nature === 'paid' ? line.amountIrr : 0,
                            credit: line.nature === 'received' ? line.amountIrr : 0,
                            description: line.description,
                            partyId: targetCustId,
                          },
                        ],
                      },
                      pb,
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
