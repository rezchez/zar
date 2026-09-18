export type RefiningCaseStatus =
  | 'open'
  | 'sent_to_refiner'
  | 'refining'
  | 'partially_received'
  | 'completed';

export const REFINING_CASE_STATUS_LABELS: Record<RefiningCaseStatus, string> = {
  open: 'جدید',
  sent_to_refiner: 'ارسال‌شده به ریگیر',
  refining: 'در حال ری‌گیری',
  partially_received: 'دریافت بخشی از طلا',
  completed: 'تکمیل و تسویه‌شده',
};

export interface RefiningCase {
  id: string;
  caseNumber: string;
  refinerId: string;
  refinerName?: string;
  status: RefiningCaseStatus;
  date: string;
  description: string;
  totalSentWeight: number;
  totalReceivedWeight: number;
  totalSampleWeight: number;
  remainingWeight: number;
  refiningFee: number;
  feeSettled: boolean;
  journalEntryId?: string;
  stampNumber?: string;
  createdBy?: string;
  updatedBy?: string;
  created?: string;
  updated?: string;
}

export type RefiningItemType = 'sent_gold' | 'output_gold';
export type RefiningItemStatus = 'with_refiner' | 'received' | 'processed';

export const REFINING_ITEM_STATUS_LABELS: Record<RefiningItemStatus, string> = {
  with_refiner: 'نزد ریگیر',
  received: 'دریافت‌شده',
  processed: 'پردازش‌شده',
};

export interface RefiningItem {
  id: string;
  caseId: string;
  itemType: RefiningItemType;
  metal: string;
  inventoryType: string;
  rawWeight: number;
  purity: number;
  convertedWeight: number;
  stampNumber?: string;
  labName?: string;
  status: RefiningItemStatus;
  receiptDate?: string;
  description?: string;
  metalInventoryId?: string;
  createdBy?: string;
  updatedBy?: string;
  created?: string;
  updated?: string;
}

export type RefiningSampleStatus = 'with_refiner' | 'received';

export const REFINING_SAMPLE_STATUS_LABELS: Record<RefiningSampleStatus, string> = {
  with_refiner: 'نزد ریگیر (در انتظار دریافت)',
  received: 'دریافت‌شده',
};

export interface RefiningSample {
  id: string;
  packetNumber: string;
  caseId: string;
  caseNumber?: string;
  refinerId: string;
  refinerName?: string;
  declaredWeight: number;
  receivedWeight: number;
  weightDifference: number;
  purity: number;
  convertedReceivedWeight: number;
  status: RefiningSampleStatus;
  issueDate: string;
  receivedDate?: string;
  description?: string;
  metalInventoryId?: string;
  createdBy?: string;
  updatedBy?: string;
  created?: string;
  updated?: string;
}

export interface RefiningCaseSummary {
  totalSentWeight: number;
  totalOutputWeight: number;
  totalDeclaredSampleWeight: number;
  totalReceivedSampleWeight: number;
  totalWeightDifference: number;
  remainingWeightAtRefiner: number;
  refiningFee: number;
  debtToRefiner: number;
}
