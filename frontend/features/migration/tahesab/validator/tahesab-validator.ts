import type {
  NormalizedMigrationData,
  MigrationMappings,
  MigrationValidationResult,
  MigrationIssue,
  MigrationPreviewStats,
} from '../types';

/**
 * Validates normalized Tahesab migration data and active mappings before final import.
 */
export function validateTahesabMigration(
  data: NormalizedMigrationData,
  mappings: MigrationMappings,
): MigrationValidationResult {
  const errors: MigrationIssue[] = [];
  const warnings: MigrationIssue[] = [];
  const info: MigrationIssue[] = [];

  // 1. Validate File & Basic Metadata
  if (data.parties.length === 0) {
    errors.push({
      code: 'ERR_NO_PARTIES',
      message: 'هیچ طرف‌حسابی در فایل پشتیبان ته‌حساب یافت نشد.',
      severity: 'BLOCKING',
      sourceType: 'moshtarian',
    });
  }

  if (data.documents.length === 0) {
    errors.push({
      code: 'ERR_NO_DOCUMENTS',
      message: 'هیچ سند یا فاکتور مالی در فایل پشتیبان ته‌حساب یافت نشد.',
      severity: 'BLOCKING',
      sourceType: 'hesab',
    });
  }

  // 2. Validate Party Mappings
  const partyMapByCode = new Map(mappings.parties.map((p) => [p.sourceCode, p]));
  let newPartiesCount = 0;
  let mappedPartiesCount = 0;
  let needsReviewPartiesCount = 0;

  for (const party of data.parties) {
    const mapping = partyMapByCode.get(party.sourceCode);
    if (!mapping) {
      warnings.push({
        code: 'WARN_UNMAPPED_PARTY',
        message: `طرف‌حساب "${party.name}" (کد منبع ${party.sourceCode}) فاقد وضعیت نگاشت است. علت ناهماهنگی: در سیستم زرفولیو مشتری با نام یا شماره تلفن یکسان یافت نشد و باید تعیین شود که به صورت خودکار به عنوان مشتری جدید تعریف شود یا به مشتری موجود الصاق گردد.`,
        severity: 'WARNING',
        sourceType: 'party',
        sourceId: party.sourceCode,
      });
      continue;
    }

    if (mapping.status === 'new_party') {
      newPartiesCount++;
    } else if (mapping.status === 'mapped') {
      mappedPartiesCount++;
    } else if (mapping.status === 'needs_review') {
      needsReviewPartiesCount++;
      warnings.push({
        code: 'WARN_PARTY_NEEDS_REVIEW',
        message: `طرف‌حساب "${party.name}" (کد ${party.sourceCode}) نیازمند بررسی است. علت ناهماهنگی: شباهت اسمی تقریبی با مشتریان موجود شناسایی شده و جهت جلوگیری از تداخل حساب‌های مالی، نیازمند تأیید دستی شماست.`,
        severity: 'WARNING',
        sourceType: 'party',
        sourceId: party.sourceCode,
      });
    }

    // Validate opening balances
    if (party.openingGoldWeight < 0) {
      info.push({
        code: 'INFO_PARTY_GOLD_DEBTOR',
        message: `طرف‌حساب "${party.name}" مانده اول دوره منفی طلا دارد (${party.openingGoldWeight} گرم بدهکار). علت: در ته‌حساب بدهی طلا به صورت منفی ثبت شده است.`,
        severity: 'INFO',
        sourceType: 'party',
        sourceId: party.sourceCode,
      });
    }
  }

  // 3. Validate Account Mappings
  for (const acc of mappings.accounts) {
    if (acc.status === 'needs_review' || !acc.targetAccountId) {
      warnings.push({
        code: 'WARN_ACCOUNT_UNMAPPED',
        message: `سرفصل حساب "${acc.sourceName}" به هیچ حسابی در دفتر کل زرفولیو متصل نیست. علت ناهماهنگی: سرفصل متناظر در نمودار حساب‌های استاندارد انتخاب نشده و سیستم از حساب واسط موقت استفاده خواهد کرد.`,
        severity: 'WARNING',
        sourceType: 'account',
        sourceId: acc.sourceCode,
      });
    }
  }

  // 4. Validate Documents & Lines
  let totalDocLines = 0;
  let totalGoldGrams = 0;
  let totalSilverGrams = 0;
  let totalRialIrr = 0;
  let totalUsd = 0;
  let conditionalLots = 0;

  const transferPairs = new Map<string, { source?: number; dest?: number }>();

  for (const doc of data.documents) {
    if (doc.lines.length === 0) {
      warnings.push({
        code: 'WARN_EMPTY_DOCUMENT',
        message: `سند شماره ${doc.documentNumber} فاقد ردیف‌های مالی است. علت ناهماهنگی: فاکتور در نرم‌افزار ته‌حساب بدون ردیف ذخیره شده یا ردیف‌های آن ابطال شده است.`,
        severity: 'WARNING',
        sourceType: 'document',
        sourceId: doc.sourceFactorCode,
      });
    }

    let docGoldSum = 0;
    let docRialSum = 0;

    for (const line of doc.lines) {
      totalDocLines++;

      // Weights & Grades validation
      if (line.weight > 0) {
        if (line.metalType !== 'none' && (line.grade < 1 || line.grade > 1000)) {
          errors.push({
            code: 'ERR_INVALID_GRADE',
            message: `عیار نامعتبر ${line.grade} در ردیف ${line.lineNumber} سند ${doc.documentNumber}. علت: عیار فلز باید بین ۱ تا ۱۰۰۰ باشد.`,
            severity: 'ERROR',
            sourceType: 'document_line',
            sourceId: `${doc.sourceFactorCode}:${line.lineNumber}`,
          });
        }

        if (line.metalType === 'silver') {
          totalSilverGrams += line.convertedWeight750 || line.weight;
        } else if (line.metalType === 'gold') {
          totalGoldGrams += line.convertedWeight750 || line.weight;
          docGoldSum += line.convertedWeight750 || line.weight;
        }

        if (line.isConditional) {
          conditionalLots++;
          if (!line.assayStampNumber || line.assayStampNumber.trim() === '') {
            warnings.push({
              code: 'WARN_CONDITIONAL_NO_STAMP',
              message: `سند شماره ${doc.documentNumber} ردیف ${line.lineNumber}: طلای شرطی بدون شناسه قبض یا انگ آزمایشگاه. علت ناهماهنگی: در سیستم مبدأ شماره ری‌گیری ثبت نشده است و در انبار شرطی با شناسه موقت رهگیری خواهد شد.`,
              severity: 'WARNING',
              sourceType: 'document_line',
              sourceId: `${doc.sourceFactorCode}:${line.lineNumber}`,
            });
          }
        }
      }

      if (line.amountIrr > 0) {
        totalRialIrr += line.amountIrr;
        docRialSum += line.amountIrr;
      }

      if (line.foreignAmount && line.foreignAmount > 0) {
        totalUsd += line.foreignAmount;
      }

      // Track transfer pairings
      if (line.transferToken) {
        let pair = transferPairs.get(line.transferToken);
        if (!pair) {
          pair = {};
          transferPairs.set(line.transferToken, pair);
        }
        if (line.transferSide === 'source') {
          pair.source = (pair.source || 0) + (line.convertedWeight750 || line.amountIrr);
        } else {
          pair.dest = (pair.dest || 0) + (line.convertedWeight750 || line.amountIrr);
        }
      }
    }
  }

  // 5. Transfer Pair Consistency
  let matchedTransferPairs = 0;
  for (const [token, pair] of transferPairs.entries()) {
    if (pair.source !== undefined && pair.dest !== undefined) {
      matchedTransferPairs++;
      const diff = Math.abs(pair.source - pair.dest);
      if (diff > 0.01) {
        warnings.push({
          code: 'WARN_TRANSFER_DISCREPANCY',
          message: `عدم تطابق دو سر حواله با توکن ${token.slice(0, 12)}... علت ناهماهنگی: مقدار ارسال‌شده (${pair.source}) با مقدار دریافت‌شده (${pair.dest}) برابر نیست.`,
          severity: 'WARNING',
          sourceType: 'transfer',
          sourceId: token,
        });
      }
    }
  }

  const mappedAssayLabsCount = (mappings.assayLabs || []).filter((l) => l.status === 'mapped').length;
  const newAssayLabsCount = (mappings.assayLabs || []).filter((l) => l.status === 'new_lab').length;

  const isBlocked = errors.some((e) => e.severity === 'BLOCKING');
  const preview: MigrationPreviewStats = {
    totalDocuments: data.documents.length,
    totalDocumentLines: totalDocLines,
    totalParties: data.parties.length,
    totalNewParties: newPartiesCount,
    totalMappedParties: mappedPartiesCount,
    totalNeedsReviewParties: needsReviewPartiesCount,
    totalBankAccounts: data.bankAccounts.length,
    totalCoins: data.coins.length,
    totalGemstones: data.gemstones.length,
    totalAssayLabs: data.assayLabs.length,
    totalMappedAssayLabs: mappedAssayLabsCount,
    totalNewAssayLabs: newAssayLabsCount,
    totalConditionalLots: conditionalLots,
    totalTransferPairs: matchedTransferPairs,
    totalGoldVolumeGrams: Math.round(totalGoldGrams * 1000) / 1000,
    totalSilverVolumeGrams: Math.round(totalSilverGrams * 1000) / 1000,
    totalRialVolumeIrr: totalRialIrr,
    totalUsdVolume: totalUsd,
    readyToImportCount: data.documents.length + data.parties.length,
    blockedCount: errors.filter((e) => e.severity === 'BLOCKING').length,
    warningsCount: warnings.length,
    errorsCount: errors.length,
  };

  return {
    isValid: errors.length === 0,
    isBlocked,
    errors,
    warnings,
    info,
    preview,
  };
}
