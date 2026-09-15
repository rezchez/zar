import 'server-only';

import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { metalAtBaseKarat, roundWeight } from '@/lib/weight';
import { formatJalaliDate, normalizeDigits } from '@/lib/jalali';
import { recordAuditEvent } from '@/lib/audit';
import { isRefinerGroup } from '@/lib/customer-groups';
import { postRefiningFee } from '@/features/accounting/posting/posting-engine';
import type {
  RefiningCase,
  RefiningCaseStatus,
  RefiningCaseSummary,
  RefiningItem,
  RefiningItemType,
  RefiningItemStatus,
  RefiningSample,
  RefiningSampleStatus,
} from '../types';

export class RefiningError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'RefiningError';
  }
}

/**
 * Validates that a counterparty belongs strictly to the 'ریگیر' group.
 * Rejects with 400 if customer is missing or belongs to another group.
 */
export async function validateRefinerCustomer(
  pb: PocketBase,
  customerId: string,
): Promise<RecordModel> {
  if (!customerId) {
    throw new RefiningError('شناسه طرف‌حساب الزامی است.', 400);
  }

  const customer = await pb.collection('customers').getOne(customerId).catch(() => null);
  if (!customer) {
    throw new RefiningError('طرف‌حساب مورد نظر یافت نشد.', 404);
  }

  const groupName = String(customer.groupName || '').trim();
  if (!isRefinerGroup(groupName)) {
    throw new RefiningError(
      `طرف‌حساب "${customer.name}" عضو گروه ریگیر نیست (گروه فعلی: ${groupName || 'نامشخص'}). امکان ثبت پرونده ری‌گیری وجود ندارد.`,
      400,
    );
  }

  return customer;
}

/**
 * Generates a deterministic, sequential, unique case number (e.g. REF-1405-0001).
 */
export async function generateCaseNumber(pb: PocketBase): Promise<string> {
  const jalaliYear = formatJalaliDate(new Date()).split('/')[0] || '1405';
  const currentYear = normalizeDigits(jalaliYear);
  const prefix = `REF-${currentYear}-`;

  const existingCases = await pb.collection('refining_cases').getFullList({
    filter: `case_number ~ "${prefix}"`,
    sort: '-created',
    fields: 'case_number',
  }).catch(() => [] as RecordModel[]);

  let maxSeq = 0;
  for (const record of existingCases) {
    const numStr = String(record.case_number || '').replace(prefix, '');
    const seq = parseInt(numStr, 10);
    if (!isNaN(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Generates a unique packet number for an assay sample (e.g. PKT-1405-0001-1).
 */
export async function generatePacketNumber(
  pb: PocketBase,
  caseId: string,
  caseNumber: string,
): Promise<string> {
  const baseNumber = caseNumber.replace('REF-', '');
  const existingSamples = await pb.collection('refining_samples').getFullList({
    filter: pb.filter('case_id = {:caseId}', { caseId }),
    fields: 'packet_number',
  }).catch(() => [] as RecordModel[]);

  const nextSeq = existingSamples.length + 1;
  const candidate = `PKT-${baseNumber}-${nextSeq}`;

  // Ensure uniqueness
  const duplicate = await pb.collection('refining_samples').getFirstListItem(
    pb.filter('packet_number = {:pkt}', { pkt: candidate }),
  ).catch(() => null);

  if (!duplicate) return candidate;
  return `PKT-${baseNumber}-${nextSeq}-${Date.now().toString().slice(-4)}`;
}

/**
 * Maps PocketBase refining_cases record to RefiningCase domain model.
 */
export function mapRefiningCase(record: RecordModel, refinerName?: string): RefiningCase {
  return {
    id: record.id,
    caseNumber: record.case_number || '',
    refinerId: record.refiner || '',
    refinerName: refinerName || record.expand?.refiner?.name || '',
    status: (record.status as RefiningCaseStatus) || 'open',
    date: record.date || '',
    description: record.description || '',
    totalSentWeight: Number(record.total_sent_weight) || 0,
    totalReceivedWeight: Number(record.total_received_weight) || 0,
    totalSampleWeight: Number(record.total_sample_weight) || 0,
    remainingWeight: Number(record.remaining_weight) || 0,
    refiningFee: Number(record.refining_fee) || 0,
    feeSettled: Boolean(record.fee_settled),
    journalEntryId: record.journal_entry_id || undefined,
    createdBy: record.created_by || undefined,
    updatedBy: record.updated_by || undefined,
    created: record.created,
    updated: record.updated,
  };
}

/**
 * Maps PocketBase refining_items record to RefiningItem domain model.
 */
export function mapRefiningItem(record: RecordModel): RefiningItem {
  return {
    id: record.id,
    caseId: record.case_id || '',
    itemType: (record.item_type as RefiningItemType) || 'sent_gold',
    metal: record.metal || 'gold',
    inventoryType: record.inventory_type || 'melted',
    rawWeight: Number(record.raw_weight) || 0,
    purity: Number(record.purity) || 0,
    convertedWeight: Number(record.converted_weight) || 0,
    stampNumber: record.stamp_number || undefined,
    labName: record.lab_name || undefined,
    status: (record.status as RefiningItemStatus) || 'with_refiner',
    receiptDate: record.receipt_date || undefined,
    description: record.description || undefined,
    metalInventoryId: record.metal_inventory_id || undefined,
    createdBy: record.created_by || undefined,
    updatedBy: record.updated_by || undefined,
    created: record.created,
    updated: record.updated,
  };
}

/**
 * Maps PocketBase refining_samples record to RefiningSample domain model.
 */
export function mapRefiningSample(
  record: RecordModel,
  caseNumber?: string,
  refinerName?: string,
): RefiningSample {
  return {
    id: record.id,
    packetNumber: record.packet_number || '',
    caseId: record.case_id || '',
    caseNumber: caseNumber || record.expand?.case_id?.case_number || '',
    refinerId: record.refiner || '',
    refinerName: refinerName || record.expand?.refiner?.name || '',
    declaredWeight: Number(record.declared_weight) || 0,
    receivedWeight: Number(record.received_weight) || 0,
    weightDifference: Number(record.weight_difference) || 0,
    purity: Number(record.purity) || 750,
    convertedReceivedWeight: Number(record.converted_received_weight) || 0,
    status: (record.status as RefiningSampleStatus) || 'with_refiner',
    issueDate: record.issue_date || '',
    receivedDate: record.received_date || undefined,
    description: record.description || undefined,
    metalInventoryId: record.metal_inventory_id || undefined,
    createdBy: record.created_by || undefined,
    updatedBy: record.updated_by || undefined,
    created: record.created,
    updated: record.updated,
  };
}

/**
 * Recalculates case totals and remaining weight based on items and samples.
 */
export async function syncCaseTotals(pb: PocketBase, caseId: string): Promise<void> {
  const items = await pb.collection('refining_items').getFullList({
    filter: pb.filter('case_id = {:caseId}', { caseId }),
  }).catch(() => [] as RecordModel[]);

  const samples = await pb.collection('refining_samples').getFullList({
    filter: pb.filter('case_id = {:caseId}', { caseId }),
  }).catch(() => [] as RecordModel[]);

  const totalSentWeight = roundWeight(
    items
      .filter((i) => i.item_type === 'sent_gold')
      .reduce((sum, i) => sum + (Number(i.raw_weight) || 0), 0),
    3,
  );

  const totalReceivedWeight = roundWeight(
    items
      .filter((i) => i.item_type === 'output_gold' && i.status === 'received')
      .reduce((sum, i) => sum + (Number(i.raw_weight) || 0), 0),
    3,
  );

  const totalSampleWeight = roundWeight(
    samples.reduce((sum, s) => sum + (Number(s.declared_weight) || 0), 0),
    3,
  );

  const totalReceivedSampleWeight = roundWeight(
    samples
      .filter((s) => s.status === 'received')
      .reduce((sum, s) => sum + (Number(s.received_weight) || 0), 0),
    3,
  );

  // Remaining weight at refiner = Sent - Output Received - Received Sample
  const remainingWeight = roundWeight(
    Math.max(0, totalSentWeight - totalReceivedWeight - totalReceivedSampleWeight),
    3,
  );

  const caseRecord = await pb.collection('refining_cases').getOne(caseId).catch(() => null);
  if (!caseRecord) return;

  let nextStatus = caseRecord.status;
  if (totalSentWeight > 0 && nextStatus === 'open') {
    nextStatus = 'sent_to_refiner';
  }
  if (totalReceivedWeight > 0 || totalReceivedSampleWeight > 0) {
    if (remainingWeight <= 0.001) {
      nextStatus = 'completed';
    } else {
      nextStatus = 'partially_received';
    }
  }

  await pb.collection('refining_cases').update(caseId, {
    total_sent_weight: totalSentWeight,
    total_received_weight: totalReceivedWeight,
    total_sample_weight: totalSampleWeight,
    remaining_weight: remainingWeight,
    status: nextStatus,
  }).catch(() => undefined);
}

/**
 * 1. Create a new Refining Case.
 */
export async function createRefiningCase(
  pb: PocketBase,
  data: {
    refinerId: string;
    date?: string;
    description?: string;
  },
  userId: string,
  request?: Request,
): Promise<RefiningCase> {
  const refiner = await validateRefinerCustomer(pb, data.refinerId);
  const caseNumber = await generateCaseNumber(pb);
  const date = data.date?.trim() || formatJalaliDate(new Date());

  const record = await pb.collection('refining_cases').create({
    case_number: caseNumber,
    refiner: refiner.id,
    status: 'open',
    date,
    description: data.description?.trim() || '',
    total_sent_weight: 0,
    total_received_weight: 0,
    total_sample_weight: 0,
    remaining_weight: 0,
    refining_fee: 0,
    fee_settled: false,
    created_by: userId,
    updated_by: userId,
  });

  await recordAuditEvent({
    event: 'refining_case_created',
    userId,
    details: {
      caseId: record.id,
      caseNumber,
      refinerId: refiner.id,
      refinerName: refiner.name,
    },
    request,
  });

  return mapRefiningCase(record, refiner.name);
}

/**
 * 2. Deliver Gold to Refiner (تحویل طلا به ریگیر).
 * Removes gold from store's free inventory (metal_inventory out) and marks it as with refiner.
 */
export async function deliverGoldToRefiner(
  pb: PocketBase,
  caseId: string,
  data: {
    rawWeight: number;
    purity: number;
    inventoryType?: string;
    stampNumber?: string;
    labName?: string;
    description?: string;
  },
  userId: string,
  request?: Request,
): Promise<RefiningItem> {
  const caseRecord = await pb.collection('refining_cases').getOne(caseId).catch(() => null);
  if (!caseRecord) {
    throw new RefiningError('پرونده ری‌گیری یافت نشد.', 404);
  }

  const rawWeight = roundWeight(Number(data.rawWeight), 3);
  const purity = roundWeight(Number(data.purity), 1);

  if (!rawWeight || rawWeight <= 0) {
    throw new RefiningError('وزن طلای ارسالی باید بزرگتر از صفر باشد.', 400);
  }
  if (!purity || purity <= 0 || purity > 1000) {
    throw new RefiningError('عیار طلا باید عددی بین ۱ تا ۱۰۰۰ باشد.', 400);
  }

  const convertedWeight = metalAtBaseKarat(rawWeight, purity, 750);
  const invType = data.inventoryType || 'melted';
  const todayIso = new Date().toISOString();

  // 1. Record outflow in metal_inventory to remove from free store inventory
  const metalInvRecord = await pb.collection('metal_inventory').create({
    metal: 'gold',
    inventory_type: invType,
    direction: 'out',
    transaction_type: 'refining_delivery',
    raw_weight: rawWeight,
    purity,
    base_karat: 750,
    converted_weight: convertedWeight,
    stamp_number: data.stampNumber || '',
    lab_name: data.labName || '',
    date: todayIso,
    description: `تحویل به ریگیر - پرونده ${caseRecord.case_number} ${data.description ? `(${data.description})` : ''}`,
    created_by: userId,
    updated_by: userId,
  });

  // 2. Record item in refining_items
  const itemRecord = await pb.collection('refining_items').create({
    case_id: caseRecord.id,
    item_type: 'sent_gold',
    metal: 'gold',
    inventory_type: invType,
    raw_weight: rawWeight,
    purity,
    converted_weight: convertedWeight,
    stamp_number: data.stampNumber || '',
    lab_name: data.labName || '',
    status: 'with_refiner',
    description: data.description || '',
    metal_inventory_id: metalInvRecord.id,
    created_by: userId,
    updated_by: userId,
  });

  // 3. Update case totals
  await syncCaseTotals(pb, caseRecord.id);

  await recordAuditEvent({
    event: 'refining_gold_delivered',
    userId,
    details: {
      caseId: caseRecord.id,
      caseNumber: caseRecord.case_number,
      itemId: itemRecord.id,
      rawWeight,
      purity,
      convertedWeight,
    },
    request,
  });

  return mapRefiningItem(itemRecord);
}

/**
 * 3. Create Sample Packet for Refiner (مدیریت پاکت نمونه).
 */
export async function createSamplePacket(
  pb: PocketBase,
  caseId: string,
  data: {
    declaredWeight: number;
    purity?: number;
    description?: string;
  },
  userId: string,
  request?: Request,
): Promise<RefiningSample> {
  const caseRecord = await pb.collection('refining_cases').getOne(caseId).catch(() => null);
  if (!caseRecord) {
    throw new RefiningError('پرونده ری‌گیری یافت نشد.', 404);
  }

  const declaredWeight = roundWeight(Number(data.declaredWeight), 3);
  if (!declaredWeight || declaredWeight <= 0) {
    throw new RefiningError('وزن اعلام‌شده نمونه باید بزرگتر از صفر باشد.', 400);
  }

  const purity = data.purity ? roundWeight(Number(data.purity), 1) : 750;
  const packetNumber = await generatePacketNumber(pb, caseRecord.id, caseRecord.case_number);
  const issueDate = formatJalaliDate(new Date());

  const sampleRecord = await pb.collection('refining_samples').create({
    packet_number: packetNumber,
    case_id: caseRecord.id,
    refiner: caseRecord.refiner,
    declared_weight: declaredWeight,
    received_weight: 0,
    weight_difference: 0,
    purity,
    converted_received_weight: 0,
    status: 'with_refiner',
    issue_date: issueDate,
    description: data.description || '',
    created_by: userId,
    updated_by: userId,
  });

  await syncCaseTotals(pb, caseRecord.id);

  await recordAuditEvent({
    event: 'refining_sample_created',
    userId,
    details: {
      caseId: caseRecord.id,
      caseNumber: caseRecord.case_number,
      sampleId: sampleRecord.id,
      packetNumber,
      declaredWeight,
    },
    request,
  });

  return mapRefiningSample(sampleRecord, caseRecord.case_number);
}

/**
 * 4. Receive Sample Packet (دریافت پاکت نمونه).
 * Enforces IDEMPOTENCY: Re-receiving the same sample is strictly rejected.
 * Enforces ACCOUNTING RULE: weight difference does NOT affect refiner debt.
 * Enforces INVENTORY RULE: actual received weight enters metal_inventory.
 */
export async function receiveSamplePacket(
  pb: PocketBase,
  sampleId: string,
  data: {
    receivedWeight: number;
    receivedDate?: string;
    purity?: number;
  },
  userId: string,
  request?: Request,
): Promise<RefiningSample> {
  const sample = await pb.collection('refining_samples').getOne(sampleId).catch(() => null);
  if (!sample) {
    throw new RefiningError('پاکت نمونه مورد نظر یافت نشد.', 404);
  }

  // Idempotency check: Cannot receive an already received sample
  if (sample.status === 'received') {
    throw new RefiningError(
      `این پاکت نمونه (شماره ${sample.packet_number}) قبلاً دریافت شده است و ورود مجدد آن به انبار امکان‌پذیر نیست.`,
      400,
    );
  }

  const receivedWeight = roundWeight(Number(data.receivedWeight), 3);
  if (!receivedWeight || receivedWeight <= 0) {
    throw new RefiningError('وزن واقعی دریافتی پاکت باید بزرگتر از صفر باشد.', 400);
  }

  const purity = data.purity ? roundWeight(Number(data.purity), 1) : Number(sample.purity) || 750;
  const declaredWeight = Number(sample.declared_weight) || 0;
  // Difference = Declared - Received (Operational refining loss/difference)
  const weightDifference = roundWeight(declaredWeight - receivedWeight, 3);
  const convertedReceivedWeight = metalAtBaseKarat(receivedWeight, purity, 750);
  const receivedDate = data.receivedDate?.trim() || formatJalaliDate(new Date());
  const todayIso = new Date().toISOString();

  const caseRecord = await pb.collection('refining_cases').getOne(sample.case_id).catch(() => null);

  // 1. Enter actual received sample into store's inventory
  const metalInv = await pb.collection('metal_inventory').create({
    metal: 'gold',
    inventory_type: 'miscellaneous',
    direction: 'in',
    transaction_type: 'refining_sample_receipt',
    raw_weight: receivedWeight,
    purity,
    base_karat: 750,
    converted_weight: convertedReceivedWeight,
    date: todayIso,
    description: `ورود نمونه ری‌گیری پاکت ${sample.packet_number} پرونده ${caseRecord?.case_number || ''}`,
    created_by: userId,
    updated_by: userId,
  });

  // 2. Update sample record to received
  const updatedSample = await pb.collection('refining_samples').update(sample.id, {
    status: 'received',
    received_weight: receivedWeight,
    weight_difference: weightDifference,
    purity,
    converted_received_weight: convertedReceivedWeight,
    received_date: receivedDate,
    metal_inventory_id: metalInv.id,
    updated_by: userId,
  });

  // 3. Update case totals
  if (caseRecord) {
    await syncCaseTotals(pb, caseRecord.id);
  }

  await recordAuditEvent({
    event: 'refining_sample_received',
    userId,
    details: {
      caseId: sample.case_id,
      sampleId: sample.id,
      packetNumber: sample.packet_number,
      declaredWeight,
      receivedWeight,
      weightDifference,
    },
    request,
  });

  return mapRefiningSample(updatedSample, caseRecord?.case_number);
}

/**
 * 5. Receive Output Refined Gold (دریافت طلای خروجی).
 * Enters refined gold into metal_inventory and updates case totals.
 */
export async function receiveOutputGold(
  pb: PocketBase,
  caseId: string,
  data: {
    rawWeight: number;
    purity: number;
    stampNumber?: string;
    labName?: string;
    receiptDate?: string;
    description?: string;
  },
  userId: string,
  request?: Request,
): Promise<RefiningItem> {
  const caseRecord = await pb.collection('refining_cases').getOne(caseId).catch(() => null);
  if (!caseRecord) {
    throw new RefiningError('پرونده ری‌گیری یافت نشد.', 404);
  }

  const rawWeight = roundWeight(Number(data.rawWeight), 3);
  const purity = roundWeight(Number(data.purity), 1);

  if (!rawWeight || rawWeight <= 0) {
    throw new RefiningError('وزن طلای خروجی باید بزرگتر از صفر باشد.', 400);
  }
  if (!purity || purity <= 0 || purity > 1000) {
    throw new RefiningError('عیار طلا باید عددی بین ۱ تا ۱۰۰۰ باشد.', 400);
  }

  const convertedWeight = metalAtBaseKarat(rawWeight, purity, 750);
  const receiptDate = data.receiptDate?.trim() || formatJalaliDate(new Date());
  const todayIso = new Date().toISOString();

  // 1. Inflow into metal_inventory as refined melted gold
  const metalInv = await pb.collection('metal_inventory').create({
    metal: 'gold',
    inventory_type: 'melted',
    direction: 'in',
    transaction_type: 'refining_receipt',
    raw_weight: rawWeight,
    purity,
    base_karat: 750,
    converted_weight: convertedWeight,
    stamp_number: data.stampNumber || '',
    lab_name: data.labName || '',
    date: todayIso,
    description: `دریافت طلای خروجی ری‌گیری پرونده ${caseRecord.case_number} ${data.description ? `(${data.description})` : ''}`,
    created_by: userId,
    updated_by: userId,
  });

  // 2. Create item record in refining_items
  const itemRecord = await pb.collection('refining_items').create({
    case_id: caseRecord.id,
    item_type: 'output_gold',
    metal: 'gold',
    inventory_type: 'melted',
    raw_weight: rawWeight,
    purity,
    converted_weight: convertedWeight,
    stamp_number: data.stampNumber || '',
    lab_name: data.labName || '',
    status: 'received',
    receipt_date: receiptDate,
    description: data.description || '',
    metal_inventory_id: metalInv.id,
    created_by: userId,
    updated_by: userId,
  });

  // 3. Update case totals
  await syncCaseTotals(pb, caseRecord.id);

  await recordAuditEvent({
    event: 'refining_output_received',
    userId,
    details: {
      caseId: caseRecord.id,
      caseNumber: caseRecord.case_number,
      itemId: itemRecord.id,
      rawWeight,
      purity,
      convertedWeight,
      stampNumber: data.stampNumber,
    },
    request,
  });

  return mapRefiningItem(itemRecord);
}

/**
 * 6. Record Refining Fee and Post Double-Entry Accounting (ثبت اجرت و بدهی ریگیر).
 */
export async function recordCaseRefiningFee(
  pb: PocketBase,
  caseId: string,
  feeAmount: number,
  userId: string,
  request?: Request,
): Promise<RefiningCase> {
  const caseRecord = await pb.collection('refining_cases').getOne(caseId).catch(() => null);
  if (!caseRecord) {
    throw new RefiningError('پرونده ری‌گیری یافت نشد.', 404);
  }

  const fee = Math.round(Number(feeAmount));
  if (!fee || fee <= 0) {
    throw new RefiningError('مبلغ اجرت ری‌گیری باید بزرگتر از صفر باشد.', 400);
  }

  const refiner = await pb.collection('customers').getOne(caseRecord.refiner).catch(() => null);
  if (!refiner) {
    throw new RefiningError('طرف‌حساب ریگیر پرونده یافت نشد.', 404);
  }

  // Post double-entry journal entry and sync to customer transactions
  const journal = await postRefiningFee(
    {
      id: caseRecord.id,
      caseNumber: caseRecord.case_number,
      refiningFee: fee,
      description: caseRecord.description,
    },
    {
      id: refiner.id,
      name: refiner.name,
      customerCode: Number(refiner.customerCode) || 0,
    },
    userId,
    pb,
  );

  // Update case record
  const updatedCase = await pb.collection('refining_cases').update(caseRecord.id, {
    refining_fee: fee,
    fee_settled: true,
    journal_entry_id: journal.id,
    updated_by: userId,
  });

  await recordAuditEvent({
    event: 'refining_fee_recorded',
    userId,
    details: {
      caseId: caseRecord.id,
      caseNumber: caseRecord.case_number,
      refinerId: refiner.id,
      refinerName: refiner.name,
      refiningFee: fee,
      journalEntryId: journal.id,
    },
    request,
  });

  return mapRefiningCase(updatedCase, refiner.name);
}

/**
 * 7. Fetch all unreceived sample packets for sidebar view.
 */
export async function getUnreceivedPackets(pb: PocketBase): Promise<RefiningSample[]> {
  const records = await pb.collection('refining_samples').getFullList({
    filter: 'status = "with_refiner"',
    sort: '-created',
    expand: 'case_id,refiner',
  }).catch(() => [] as RecordModel[]);

  return records.map((record) => {
    const caseNumber = record.expand?.case_id?.case_number || '';
    const refinerName = record.expand?.refiner?.name || '';
    return mapRefiningSample(record, caseNumber, refinerName);
  });
}

/**
 * 8. Fetch complete refining case details (items, samples, summary).
 */
export async function getRefiningCaseDetails(
  pb: PocketBase,
  caseId: string,
): Promise<{
  refiningCase: RefiningCase;
  items: RefiningItem[];
  samples: RefiningSample[];
  summary: RefiningCaseSummary;
}> {
  const caseRecord = await pb.collection('refining_cases').getOne(caseId, {
    expand: 'refiner',
  }).catch(() => null);

  if (!caseRecord) {
    throw new RefiningError('پرونده ری‌گیری یافت نشد.', 404);
  }

  const itemsRecords = await pb.collection('refining_items').getFullList({
    filter: pb.filter('case_id = {:caseId}', { caseId }),
    sort: 'created',
  }).catch(() => [] as RecordModel[]);

  const sampleRecords = await pb.collection('refining_samples').getFullList({
    filter: pb.filter('case_id = {:caseId}', { caseId }),
    sort: 'created',
    expand: 'refiner',
  }).catch(() => [] as RecordModel[]);

  const refiningCase = mapRefiningCase(caseRecord);
  const items = itemsRecords.map(mapRefiningItem);
  const samples = sampleRecords.map((s) => mapRefiningSample(s, caseRecord.case_number));

  const totalSentWeight = roundWeight(
    items.filter((i) => i.itemType === 'sent_gold').reduce((s, i) => s + i.rawWeight, 0),
    3,
  );
  const totalOutputWeight = roundWeight(
    items.filter((i) => i.itemType === 'output_gold' && i.status === 'received').reduce((s, i) => s + i.rawWeight, 0),
    3,
  );
  const totalDeclaredSampleWeight = roundWeight(
    samples.reduce((s, sm) => s + sm.declaredWeight, 0),
    3,
  );
  const totalReceivedSampleWeight = roundWeight(
    samples.filter((sm) => sm.status === 'received').reduce((s, sm) => s + sm.receivedWeight, 0),
    3,
  );
  const totalWeightDifference = roundWeight(
    samples.filter((sm) => sm.status === 'received').reduce((s, sm) => s + sm.weightDifference, 0),
    3,
  );
  const remainingWeightAtRefiner = roundWeight(
    Math.max(0, totalSentWeight - totalOutputWeight - totalReceivedSampleWeight),
    3,
  );

  const summary: RefiningCaseSummary = {
    totalSentWeight,
    totalOutputWeight,
    totalDeclaredSampleWeight,
    totalReceivedSampleWeight,
    totalWeightDifference,
    remainingWeightAtRefiner,
    refiningFee: refiningCase.refiningFee,
    debtToRefiner: refiningCase.refiningFee,
  };

  return {
    refiningCase,
    items,
    samples,
    summary,
  };
}

/**
 * 9. Fetch all cases for a specific refiner customer.
 */
export async function getRefiningCasesByRefiner(
  pb: PocketBase,
  refinerId: string,
): Promise<RefiningCase[]> {
  const records = await pb.collection('refining_cases').getFullList({
    filter: pb.filter('refiner = {:refinerId}', { refinerId }),
    sort: '-created',
    expand: 'refiner',
  }).catch(() => [] as RecordModel[]);

  return records.map((r) => mapRefiningCase(r));
}
