export type MigrationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING';

export interface MigrationIssue {
  code: string;
  message: string;
  severity: MigrationSeverity;
  sourceType: string;
  sourceId?: string;
  details?: Record<string, unknown>;
}

export interface TahesabBackupInfo {
  dateJalali?: string;
  mohitCount: number;
  dbType: string;
  version: string;
  archiveCount: number;
  fromDateJalali?: string;
  toDateJalali?: string;
}

export interface TahesabArchiveEntry {
  name: string;
  uncompressedSize: number;
  compressedSize: number;
  offset: number;
}

export interface NormalizedParty {
  sourceCode: string;
  name: string;
  phone1?: string;
  phone2?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  groupName?: string;
  groupId?: string;
  openingGoldWeight: number; // grams 750
  openingRialBalance: number; // IRR integer
  currency: string;
  secondaryCurrency?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedDocumentLine {
  sourceFactorCode: string;
  lineNumber: number;
  dateIso: string;
  dateJalali: string;
  nature: 'received' | 'paid';
  kind:
    | 'melted'
    | 'conditional'
    | 'misc'
    | 'coin'
    | 'general_metal'
    | 'cash'
    | 'bank'
    | 'currency'
    | 'claim'
    | 'sale'
    | 'purchase'
    | 'wage'
    | 'workmanship'
    | 'opening';
  metalType: 'gold' | 'silver' | 'none';
  weight: number;
  grade: number;
  convertedWeight750: number;
  amountIrr: number;
  foreignAmount?: number;
  foreignCurrency?: string;
  assayStampNumber?: string; // شماره قبض یا انگ
  assayLabName?: string;
  transferToken?: string; // UUID from #HAVALEH# or #hshbe#
  transferSide?: 'source' | 'destination';
  transferPartnerName?: string;
  description: string;
  unitPrice?: number;
  isConditional: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  wagePercent?: number;
  wageGoldWeight?: number;
  workmanshipName?: string;
  isOpeningInventory?: boolean;
  signedGoldAmount?: number;
  signedRialAmount?: number;
  signedForeignAmount?: number;
  goldNature?: 'received' | 'paid' | 'none';
  moneyNature?: 'received' | 'paid' | 'none';
  partySide?: 'debtor' | 'creditor';
  raw: Record<string, unknown>;
}

export interface NormalizedDocument {
  sourceFactorCode: string;
  documentNumber: string;
  sourceCustomerCode: string;
  dateIso: string;
  dateJalali: string;
  totalGoldIn: number;
  totalGoldOut: number;
  totalRialIn: number;
  totalRialOut: number;
  currency: string;
  metalType: 'gold' | 'silver';
  isOpeningInventory?: boolean;
  lines: NormalizedDocumentLine[];
  raw: Record<string, unknown>;
}

export interface NormalizedBankAccount {
  accountNumber: string;
  bankName: string;
  openingBalanceIrr: number;
  currentBalanceIrr: number;
  openingDateIso?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedCoin {
  name: string;
  weight: number;
  grade: number;
  isBar: boolean;
  raw: Record<string, unknown>;
}

export interface NormalizedGemstone {
  nameFa: string;
  nameEn?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedAssayLab {
  name: string;
  phone?: string;
  address?: string;
  raw: Record<string, unknown>;
}

export interface NormalizedInventoryItem {
  code: string;
  name: string;
  weight: number;
  grade: number;
  wagePercent?: number;
  raw: Record<string, unknown>;
}

export interface NormalizedMigrationData {
  backupInfo: TahesabBackupInfo;
  parties: NormalizedParty[];
  documents: NormalizedDocument[];
  bankAccounts: NormalizedBankAccount[];
  coins: NormalizedCoin[];
  gemstones: NormalizedGemstone[];
  assayLabs: NormalizedAssayLab[];
  inventory: NormalizedInventoryItem[];
  currencies: string[];
}

export type AccountMappingStatus = 'mapped' | 'unmapped' | 'needs_review' | 'ignored';

export interface AccountMappingItem {
  sourceCode: string;
  sourceName: string;
  targetAccountId: string;
  targetAccountCode: string;
  targetAccountName: string;
  status: AccountMappingStatus;
  notes?: string;
}

export type PartyMappingStatus = 'mapped' | 'unmapped' | 'needs_review' | 'new_party';

export interface PartyMappingItem {
  sourceCode: string;
  sourceName: string;
  sourcePhone?: string;
  targetCustomerId?: string;
  targetCustomerName?: string;
  status: PartyMappingStatus;
  matchType?: 'exact_name' | 'exact_phone' | 'manual' | 'create_new';
  notes?: string;
}

export type AssayLabMappingStatus = 'mapped' | 'unmapped' | 'needs_review' | 'new_lab';

export interface AssayLabMappingItem {
  sourceName: string;
  sourcePhone?: string;
  sourceAddress?: string;
  targetAssayLabId?: string;
  targetAssayLabName?: string;
  targetProvince?: string;
  targetCity?: string;
  status: AssayLabMappingStatus;
  matchType?: 'exact_name' | 'exact_phone' | 'canonical_name' | 'stem_keyword' | 'manual' | 'create_new';
  notes?: string;
}

export type CurrencyMappingStatus = 'mapped' | 'unmapped' | 'needs_review' | 'create_new';

export interface CurrencyMappingItem {
  sourceCode: string;
  sourceName: string;
  targetCurrencyId?: string;
  targetCurrencyCode: string;
  targetCurrencyName: string;
  targetCurrencySymbol: string;
  status: CurrencyMappingStatus;
  isSystem?: boolean;
  notes?: string;
}

export interface MigrationMappings {
  accounts: AccountMappingItem[];
  parties: PartyMappingItem[];
  assayLabs?: AssayLabMappingItem[];
  currencies?: CurrencyMappingItem[];
  defaultMetalKarat: number; // default 750
  defaultCurrency: string; // default IRR
}

export interface MigrationPreviewStats {
  totalDocuments: number;
  totalDocumentLines: number;
  totalParties: number;
  totalNewParties: number;
  totalMappedParties: number;
  totalNeedsReviewParties: number;
  totalBankAccounts: number;
  totalCoins: number;
  totalGemstones: number;
  totalAssayLabs: number;
  totalMappedAssayLabs?: number;
  totalNewAssayLabs?: number;
  totalConditionalLots: number;
  totalTransferPairs: number;
  totalGoldVolumeGrams: number;
  totalSilverVolumeGrams: number;
  totalRialVolumeIrr: number;
  totalUsdVolume: number;
  readyToImportCount: number;
  blockedCount: number;
  warningsCount: number;
  errorsCount: number;
}

export interface MigrationValidationResult {
  isValid: boolean;
  isBlocked: boolean;
  errors: MigrationIssue[];
  warnings: MigrationIssue[];
  info: MigrationIssue[];
  preview: MigrationPreviewStats;
}

export interface MigrationProgress {
  stage: 'analyzing' | 'parsing' | 'normalizing' | 'mapping' | 'validating' | 'importing' | 'finalizing' | 'completed' | 'failed';
  percent: number;
  currentStep: number;
  totalSteps: number;
  message: string;
  importedItems?: number;
  totalItems?: number;
}

export interface MigrationResult {
  migrationId: string;
  sourceSystem: 'tahesab';
  status: 'completed' | 'failed' | 'rolled_back' | 'in_progress';
  importedParties: number;
  importedBankAccounts: number;
  importedAssayLabs?: number;
  importedDocuments: number;
  importedLines: number;
  importedJournalEntries: number;
  importedMetalInventoryLots: number;
  skippedDuplicates: number;
  durationMs: number;
  startTimeIso?: string;
  completedTimeIso?: string;
  completedTimeJalali?: string;
  durationFormatted?: string;
  averageSpeedDocsPerSec?: number;
  nextOffset?: number | null;
  totalDocuments?: number;
  errors: MigrationIssue[];
  warnings: MigrationIssue[];
}
