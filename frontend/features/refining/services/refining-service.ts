import 'server-only';

import type PocketBase from 'pocketbase';
import { formatJalaliDate } from '@/lib/jalali';
import { metalAtBaseKarat, roundWeight, DEFAULT_BASE_KARATS } from '@/lib/weight';
import { isRefinerCustomer } from '@/features/customers/services/customer-groups';
import { postJournalEntry, SYSTEM_ACCOUNT_CODES } from '@/features/accounting/posting/posting-engine';

export interface RefiningCase {
  id: string;
  caseNumber: string;
  refiner: string;
  refinerName?: string;
  status: 'open' | 'delivered' | 'processing' | 'partially_received' | 'completed';
  createdDate: string;
  description: string;
  createdBy?: string;
  updatedBy?: string;
  created: string;
  updated: string;
}

export interface RefiningItem {
  id: string;
  refiningCase: string;
  direction: 'input' | 'output';
  itemType: string;
  inputWeight: number;
  inputGrade: number;
  outputWeight: number;
  outputGrade: number;
  stampNumber?: string;
  status: 'pending' | 'processed' | 'received';
  description?: string;
  createdBy?: string;
  created: string;
  updated: string;
}

export interface RefiningSample {
  id: string;
  refiningCase: string;
  caseNumber?: string;
  refiner: string;
  refinerName?: string;
  sampleCode: string;
  declaredWeight: number;
  receivedWeight?: number;
  status: 'pending' | 'received';
  declaredDate: string;
  receivedDate?: string;
  description?: string;
  createdBy?: string;
  created: string;
  updated: string;
}

export interface RefiningOperation {
  id: string;
  refiningCase: string;
  operationType: 'send_gold' | 'refine_process' | 'receive_gold' | 'receive_sample' | 'service_fee';
  operationDate: string;
  weight?: number;
  grade?: number;
  amount?: number;
  reference?: string;
  description?: string;
  createdBy?: string;
  created: string;
}

export function mapRefiningCase(record: any): RefiningCase {
  return {
    id: record.id,
    caseNumber: record.case_number || record.caseNumber || '',
    refiner: record.refiner || '',
    refinerName: record.expand?.refiner?.name || '',
    status: record.status || 'open',
    createdDate: record.created_date || record.createdDate || '',
    description: record.description || '',
    createdBy: record.created_by || record.createdBy || '',
    updatedBy: record.updated_by || record.updatedBy || '',
    created: record.created || '',
    updated: record.updated || '',
  };
}

export function mapRefiningSample(record: any): RefiningSample {
  return {
    id: record.id,
    refiningCase: record.refining_case || record.refiningCase || '',
    caseNumber: record.expand?.refining_case?.case_number || '',
    refiner: record.refiner || '',
    refinerName: record.expand?.refiner?.name || '',
    sampleCode: record.sample_code || record.sampleCode || '',
    declaredWeight: Number(record.declared_weight ?? record.declaredWeight) || 0,
    receivedWeight: record.received_weight != null || record.receivedWeight != null
      ? Number(record.received_weight ?? record.receivedWeight)
      : undefined,
    status: record.status || 'pending',
    declaredDate: record.declared_date || record.declaredDate || '',
    receivedDate: record.received_date || record.receivedDate || '',
    description: record.description || '',
    createdBy: record.created_by || record.createdBy || '',
    created: record.created || '',
    updated: record.updated || '',
  };
}

/**
 * Creates a new Refining Case.
 * Enforces server-side that refiner is a customer in the refining group.
 */
export async function createRefiningCase(
  pb: PocketBase,
  params: {
    refinerId: string;
    description?: string;
    createdDate?: string;
    userId?: string;
  },
): Promise<RefiningCase> {
  const { refinerId, description = '', createdDate, userId } = params;

  // 1. Backend Enforcement: Verify Refiner Customer and Refining Group Membership
  const refinerCustomer = await pb.collection('customers').getOne(refinerId).catch(() => null);
  if (!refinerCustomer) {
    throw new Error('طرف‌حساب انتخابی یافت نشد.');
  }

  if (!isRefinerCustomer(refinerCustomer)) {
    throw new Error('ایجاد پرونده ریگیری فقط برای طرف‌حساب‌های عضو گروه ریگیری مجاز است.');
  }

  const jalaliDate = createdDate || formatJalaliDate();
  const caseNumber = `REF-${Date.now().toString(36).toUpperCase()}`;

  const createdRecord = await pb.collection('refining_cases').create({
    case_number: caseNumber,
    refiner: refinerId,
    status: 'open',
    created_date: jalaliDate,
    description: description.trim(),
    created_by: userId || null,
    updated_by: userId || null,
  });

  return mapRefiningCase(createdRecord);
}

/**
 * Sends gold to refiner (تحویل طلا به ریگیر).
 * Deducts gold from free available stock in metal_inventory.
 * Creates an input item and logs a send_gold operation.
 */
export async function sendGoldToRefiner(
  pb: PocketBase,
  params: {
    caseId: string;
    inputWeight: number;
    inputGrade: number;
    itemType?: string;
    date?: string;
    description?: string;
    userId?: string;
  },
): Promise<{ caseRecord: RefiningCase; item: RefiningItem }> {
  const { caseId, inputWeight, inputGrade, itemType = 'molten', date, description, userId } = params;

  if (!inputWeight || inputWeight <= 0) {
    throw new Error('وزن طلای تحویلی باید بزرگتر از صفر باشد.');
  }
  if (!inputGrade || inputGrade <= 0 || inputGrade > 1000) {
    throw new Error('عیار طلای تحویلی باید بین ۱ تا ۱۰۰۰ باشد.');
  }

  const caseRecord = await pb.collection('refining_cases').getOne(caseId, { expand: 'refiner' }).catch(() => null);
  if (!caseRecord) {
    throw new Error('پرونده ریگیری یافت نشد.');
  }
  if (caseRecord.status === 'completed') {
    throw new Error('پرونده ریگیری مختومه است و امکان تغییر ندارد.');
  }

  const jalaliDate = date || formatJalaliDate();
  const refinerName = caseRecord.expand?.refiner?.name || 'ریگیر';

  // 1. Record input item in refining_items
  const itemRecord = await pb.collection('refining_items').create({
    refining_case: caseId,
    direction: 'input',
    item_type: itemType,
    input_weight: inputWeight,
    input_grade: inputGrade,
    status: 'processed',
    description: description || `تحویل طلا به ${refinerName}`,
    created_by: userId || null,
  });

  // 2. Register inventory outflow in metal_inventory
  const baseKarat = DEFAULT_BASE_KARATS.gold; // 750
  const convertedWeight = metalAtBaseKarat(inputWeight, inputGrade, baseKarat, 3);

  await pb.collection('metal_inventory').create({
    metal: 'gold',
    inventory_type: 'melted',
    direction: 'out',
    transaction_type: 'refining_send',
    raw_weight: inputWeight,
    purity: inputGrade,
    base_karat: baseKarat,
    converted_weight: convertedWeight,
    date: jalaliDate,
    description: `تحویل طلا به ریگیر (${refinerName}) - پرونده ${caseRecord.case_number}`,
    created_by: userId || null,
  }).catch((err) => {
    console.warn('Failed to record metal_inventory send outflow:', err);
  });

  // 3. Log operation
  await pb.collection('refining_operations').create({
    refining_case: caseId,
    operation_type: 'send_gold',
    operation_date: jalaliDate,
    weight: inputWeight,
    grade: inputGrade,
    reference: itemRecord.id,
    description: description || `تحویل ${inputWeight} گرم طلا (عیار ${inputGrade}) به ${refinerName}`,
    created_by: userId || null,
  });

  // 4. Update case status to delivered or processing
  const nextStatus = caseRecord.status === 'open' ? 'delivered' : caseRecord.status;
  const updatedCase = await pb.collection('refining_cases').update(caseId, {
    status: nextStatus,
    updated_by: userId || null,
  });

  return {
    caseRecord: mapRefiningCase(updatedCase),
    item: {
      id: itemRecord.id,
      refiningCase: caseId,
      direction: 'input',
      itemType: itemRecord.item_type,
      inputWeight: Number(itemRecord.input_weight) || 0,
      inputGrade: Number(itemRecord.input_grade) || 0,
      outputWeight: 0,
      outputGrade: 0,
      status: 'processed',
      description: itemRecord.description,
      created: itemRecord.created,
      updated: itemRecord.updated,
    },
  };
}

/**
 * Registers refining process results (ثبت نتیجه ذوب و عیارسنجی).
 * Registers output weight, output grade, stamp number, and sample packet if applicable.
 */
export async function registerRefiningProcess(
  pb: PocketBase,
  params: {
    caseId: string;
    outputWeight: number;
    outputGrade: number;
    sampleCode?: string;
    declaredSampleWeight?: number;
    stampNumber?: string;
    date?: string;
    description?: string;
    userId?: string;
  },
): Promise<{ caseRecord: RefiningCase; outputItem: RefiningItem; sample?: RefiningSample }> {
  const {
    caseId,
    outputWeight,
    outputGrade,
    sampleCode,
    declaredSampleWeight = 0,
    stampNumber,
    date,
    description,
    userId,
  } = params;

  if (!outputWeight || outputWeight <= 0) {
    throw new Error('وزن خروجی ریگیری باید بزرگتر از صفر باشد.');
  }
  if (!outputGrade || outputGrade <= 0 || outputGrade > 1000) {
    throw new Error('عیار واقعی خروجی باید بین ۱ تا ۱۰۰۰ باشد.');
  }

  const caseRecord = await pb.collection('refining_cases').getOne(caseId, { expand: 'refiner' }).catch(() => null);
  if (!caseRecord) {
    throw new Error('پرونده ریگیری یافت نشد.');
  }

  const jalaliDate = date || formatJalaliDate();

  // 1. Create output item record in refining_items
  const itemRecord = await pb.collection('refining_items').create({
    refining_case: caseId,
    direction: 'output',
    item_type: 'molten',
    output_weight: outputWeight,
    output_grade: outputGrade,
    stamp_number: stampNumber || '',
    status: 'pending',
    description: description || `نتیجه ریگیری خروجی عیار ${outputGrade}`,
    created_by: userId || null,
  });

  // 2. Create sample packet record if declaredSampleWeight > 0 and sampleCode exists
  let sampleRecord: any = null;
  if (declaredSampleWeight > 0 && sampleCode && sampleCode.trim()) {
    sampleRecord = await pb.collection('refining_samples').create({
      refining_case: caseId,
      refiner: caseRecord.refiner,
      sample_code: sampleCode.trim(),
      declared_weight: declaredSampleWeight,
      status: 'pending',
      declared_date: jalaliDate,
      description: `نمونه نزد ریگیر - انگ ${stampNumber || sampleCode}`,
      created_by: userId || null,
    });
  }

  // 3. Log operation
  await pb.collection('refining_operations').create({
    refining_case: caseId,
    operation_type: 'refine_process',
    operation_date: jalaliDate,
    weight: outputWeight,
    grade: outputGrade,
    reference: itemRecord.id,
    description: description || `ثبت نتیجه ریگیری: خروجی ${outputWeight} گرم (عیار ${outputGrade}) ${stampNumber ? `انگ ${stampNumber}` : ''}`,
    created_by: userId || null,
  });

  // 4. Update case status to processing
  const updatedCase = await pb.collection('refining_cases').update(caseId, {
    status: 'processing',
    updated_by: userId || null,
  });

  return {
    caseRecord: mapRefiningCase(updatedCase),
    outputItem: {
      id: itemRecord.id,
      refiningCase: caseId,
      direction: 'output',
      itemType: itemRecord.item_type,
      inputWeight: 0,
      inputGrade: 0,
      outputWeight: Number(itemRecord.output_weight) || 0,
      outputGrade: Number(itemRecord.output_grade) || 0,
      stampNumber: itemRecord.stamp_number,
      status: 'pending',
      description: itemRecord.description,
      created: itemRecord.created,
      updated: itemRecord.updated,
    },
    sample: sampleRecord ? mapRefiningSample(sampleRecord) : undefined,
  };
}

/**
 * Receives refined output gold (دریافت طلای خروجی).
 * Enforces single-receive integrity and adds gold into metal_inventory.
 */
export async function receiveRefinedGold(
  pb: PocketBase,
  params: {
    caseId: string;
    itemId: string;
    receivedWeight: number;
    receivedGrade: number;
    date?: string;
    description?: string;
    userId?: string;
  },
): Promise<{ caseRecord: RefiningCase; item: RefiningItem }> {
  const { caseId, itemId, receivedWeight, receivedGrade, date, description, userId } = params;

  if (!receivedWeight || receivedWeight <= 0) {
    throw new Error('وزن طلای دریافتی باید بزرگتر از صفر باشد.');
  }

  const itemRecord = await pb.collection('refining_items').getOne(itemId).catch(() => null);
  if (!itemRecord || itemRecord.refining_case !== caseId) {
    throw new Error('قلم خروجی ریگیری یافت نشد.');
  }

  // Backend Single-Receive Check
  if (itemRecord.status === 'received') {
    throw new Error('این قلم طلای خروجی قبلاً دریافت شده است.');
  }

  const caseRecord = await pb.collection('refining_cases').getOne(caseId, { expand: 'refiner' }).catch(() => null);
  if (!caseRecord) {
    throw new Error('پرونده ریگیری یافت نشد.');
  }

  const jalaliDate = date || formatJalaliDate();
  const refinerName = caseRecord.expand?.refiner?.name || 'ریگیر';

  // 1. Update item status to received
  const updatedItem = await pb.collection('refining_items').update(itemId, {
    output_weight: receivedWeight,
    output_grade: receivedGrade,
    status: 'received',
  });

  // 2. Register inventory inflow in metal_inventory
  const baseKarat = DEFAULT_BASE_KARATS.gold;
  const convertedWeight = metalAtBaseKarat(receivedWeight, receivedGrade, baseKarat, 3);

  await pb.collection('metal_inventory').create({
    metal: 'gold',
    inventory_type: 'melted',
    direction: 'in',
    transaction_type: 'refining_receive',
    raw_weight: receivedWeight,
    purity: receivedGrade,
    base_karat: baseKarat,
    converted_weight: convertedWeight,
    date: jalaliDate,
    stamp_number: itemRecord.stamp_number || '',
    description: description || `دریافت طلای خروجی ریگیری (${refinerName}) - انگ ${itemRecord.stamp_number || ''}`,
    created_by: userId || null,
  });

  // 3. Log operation
  await pb.collection('refining_operations').create({
    refining_case: caseId,
    operation_type: 'receive_gold',
    operation_date: jalaliDate,
    weight: receivedWeight,
    grade: receivedGrade,
    reference: itemId,
    description: description || `دریافت طلای خروجی ریگیری: ${receivedWeight} گرم (عیار ${receivedGrade})`,
    created_by: userId || null,
  });

  // 4. Update case status if all items & samples are received
  const allItems = await pb.collection('refining_items').getFullList({
    filter: pb.filter('refining_case = {:caseId}', { caseId }),
  }).catch(() => []);

  const allSamples = await pb.collection('refining_samples').getFullList({
    filter: pb.filter('refining_case = {:caseId}', { caseId }),
  }).catch(() => []);

  const unreceivedItems = allItems.filter((i) => i.direction === 'output' && i.status !== 'received');
  const unreceivedSamples = allSamples.filter((s) => s.status !== 'received');

  let nextStatus: RefiningCase['status'] = 'partially_received';
  if (unreceivedItems.length === 0 && unreceivedSamples.length === 0) {
    nextStatus = 'completed';
  }

  const updatedCase = await pb.collection('refining_cases').update(caseId, {
    status: nextStatus,
    updated_by: userId || null,
  });

  return {
    caseRecord: mapRefiningCase(updatedCase),
    item: {
      id: updatedItem.id,
      refiningCase: caseId,
      direction: 'output',
      itemType: updatedItem.item_type,
      inputWeight: 0,
      inputGrade: 0,
      outputWeight: Number(updatedItem.output_weight) || 0,
      outputGrade: Number(updatedItem.output_grade) || 0,
      stampNumber: updatedItem.stamp_number,
      status: 'received',
      description: updatedItem.description,
      created: updatedItem.created,
      updated: updatedItem.updated,
    },
  };
}

/**
 * Receives a Sample Packet (دریافت پاکت نمونه).
 * CRITICAL BUSINESS RULES:
 * 1. Backend Enforces Single-Receive Protection: If packet status is 'received', throw error!
 * 2. Adds real received weight to main stock (`metal_inventory`).
 * 3. Operational difference (declared_weight - received_weight) is calculated and saved as operational loss,
 *    and MUST NOT alter customer accounting balance!
 */
export async function receiveSamplePacket(
  pb: PocketBase,
  params: {
    sampleId: string;
    receivedWeight: number;
    receivedDate?: string;
    description?: string;
    userId?: string;
  },
): Promise<{ sample: RefiningSample; weightDifference: number }> {
  const { sampleId, receivedWeight, receivedDate, description, userId } = params;

  if (receivedWeight == null || receivedWeight < 0) {
    throw new Error('وزن واقعی دریافت‌شده پاکت باید مشخص و معتبر باشد.');
  }

  const sampleRecord = await pb.collection('refining_samples').getOne(sampleId, {
    expand: 'refining_case,refining_case.refiner',
  }).catch(() => null);

  if (!sampleRecord) {
    throw new Error('پاکت نمونه مورد نظر یافت نشد.');
  }

  // 1. CRITICAL BACKEND CHECK: Prevent Duplicate Receipt & Race Conditions
  if (sampleRecord.status === 'received') {
    throw new Error('این پاکت نمونه قبلاً دریافت شده است و امکان دریافت مجدد وجود ندارد.');
  }

  const jalaliDate = receivedDate || formatJalaliDate();
  const declaredWeight = Number(sampleRecord.declared_weight) || 0;
  const weightDifference = roundWeight(declaredWeight - receivedWeight, 3);

  // 2. Update Sample Record Status to Received
  const updatedSample = await pb.collection('refining_samples').update(sampleId, {
    status: 'received',
    received_weight: receivedWeight,
    received_date: jalaliDate,
    description: description || sampleRecord.description,
  });

  // 3. Enter Received Weight into Main Gold Inventory
  const baseKarat = DEFAULT_BASE_KARATS.gold;
  const convertedWeight = metalAtBaseKarat(receivedWeight, baseKarat, baseKarat, 3);

  await pb.collection('metal_inventory').create({
    metal: 'gold',
    inventory_type: 'melted',
    direction: 'in',
    transaction_type: 'refining_sample_receive',
    raw_weight: receivedWeight,
    purity: baseKarat,
    base_karat: baseKarat,
    converted_weight: convertedWeight,
    date: jalaliDate,
    stamp_number: sampleRecord.sample_code,
    description: `دریافت پاکت نمونه ریگیری کد ${sampleRecord.sample_code} (وزن واقعی: ${receivedWeight} گرم - اعلامی: ${declaredWeight} گرم - افت: ${weightDifference} گرم)`,
    created_by: userId || null,
  });

  // 4. Log Operation
  await pb.collection('refining_operations').create({
    refining_case: sampleRecord.refining_case,
    operation_type: 'receive_sample',
    operation_date: jalaliDate,
    weight: receivedWeight,
    reference: sampleId,
    description: `دریافت پاکت نمونه ${sampleRecord.sample_code}: وزن واقعی ${receivedWeight} گرم (وزن اولیه ${declaredWeight} گرم - اختلاف/افت ${weightDifference} گرم)`,
    created_by: userId || null,
  });

  // 5. Update case status if all items & samples are received
  const caseId = sampleRecord.refining_case;
  if (caseId) {
    const allItems = await pb.collection('refining_items').getFullList({
      filter: pb.filter('refining_case = {:caseId}', { caseId }),
    }).catch(() => []);

    const allSamples = await pb.collection('refining_samples').getFullList({
      filter: pb.filter('refining_case = {:caseId}', { caseId }),
    }).catch(() => []);

    const unreceivedItems = allItems.filter((i) => i.direction === 'output' && i.status !== 'received');
    const unreceivedSamples = allSamples.filter((s) => s.status !== 'received');

    if (unreceivedItems.length === 0 && unreceivedSamples.length === 0) {
      await pb.collection('refining_cases').update(caseId, {
        status: 'completed',
        updated_by: userId || null,
      }).catch(() => undefined);
    }
  }

  return {
    sample: mapRefiningSample(updatedSample),
    weightDifference,
  };
}

/**
 * Registers Refining Service Fee & Wage (ثبت هزینه و اجرت ریگیری).
 * CRITICAL BUSINESS RULE:
 * Refining service cost is OUR DEBT (بدهی ما) to the refiner customer!
 * Posts double-entry journal entry:
 * - Debit: Refining Expense (6500 سایر هزینه‌های عملیاتی)
 * - Credit: Refiner Customer Liability (2120 بدهی به طرف حساب‌ها / party_id: refiner.id)
 * Increases refiner's credit balance / our payable to them.
 */
export async function registerRefiningServiceFee(
  pb: PocketBase,
  params: {
    caseId: string;
    amount: number;
    date?: string;
    description?: string;
    userId?: string;
  },
): Promise<{ operation: RefiningOperation; journalEntryId: string }> {
  const { caseId, amount, date, description, userId } = params;

  if (!amount || amount <= 0) {
    throw new Error('مبلغ هزینه و اجرت ریگیری باید بزرگتر از صفر باشد.');
  }

  const caseRecord = await pb.collection('refining_cases').getOne(caseId, { expand: 'refiner' }).catch(() => null);
  if (!caseRecord) {
    throw new Error('پرونده ریگیری یافت نشد.');
  }

  const refinerId = caseRecord.refiner;
  const refinerCustomer = await pb.collection('customers').getOne(refinerId).catch(() => null);
  if (!refinerCustomer) {
    throw new Error('طرف‌حساب ریگیر پرونده یافت نشد.');
  }

  const jalaliDate = date || formatJalaliDate();
  const feeDesc = description || `هزینه و اجرت خدمات ریگیری - پرونده ${caseRecord.case_number} - ${refinerCustomer.name}`;

  // Post Double-Entry Journal Entry
  // Expense account: 6500 (سایر هزینه‌های عملیاتی)
  // Liability account: 2120 (بدهی به طرف حساب‌ها / party_id: refinerId)
  const journalResult = await postJournalEntry(
    {
      entryDateJalali: jalaliDate,
      description: feeDesc,
      sourceType: 'document',
      sourceId: caseId,
      sourceKey: `refining:fee:${caseId}:${Date.now()}`,
      userId,
      lines: [
        {
          accountId: '6500',
          debit: amount,
          credit: 0,
          description: `هزینه خدمات ریگیری (${refinerCustomer.name})`,
        },
        {
          accountId: SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY, // 2120
          debit: 0,
          credit: amount,
          description: `بستانکار ریگیر بابت اجرت خدمات (${refinerCustomer.name})`,
          partyId: refinerId,
        },
      ],
    },
    pb,
  );

  // Record operation
  const opRecord = await pb.collection('refining_operations').create({
    refining_case: caseId,
    operation_type: 'service_fee',
    operation_date: jalaliDate,
    amount: amount,
    reference: journalResult.id,
    description: feeDesc,
    created_by: userId || null,
  });

  return {
    operation: {
      id: opRecord.id,
      refiningCase: caseId,
      operationType: 'service_fee',
      operationDate: jalaliDate,
      amount: amount,
      reference: journalResult.id,
      description: feeDesc,
      createdBy: userId,
      created: opRecord.created,
    },
    journalEntryId: journalResult.id,
  };
}

/**
 * Calculates current gold held at refiner (طلای نزد ریگیر) for a refiner customer or case.
 * Gold Held = Total Input Gold Sent - Total Output Gold Received - Total Sample Packets Received - Total Pending Sample Packets
 */
export async function getRefinerGoldBalance(
  pb: PocketBase,
  refinerId: string,
): Promise<{
  totalSentWeight: number;
  totalReceivedOutputWeight: number;
  pendingSampleWeight: number;
  receivedSampleWeight: number;
  currentGoldAtRefiner: number;
}> {
  const cases = await pb.collection('refining_cases').getFullList({
    filter: pb.filter('refiner = {:refinerId} && status != "completed"', { refinerId }),
  }).catch(() => []);

  if (cases.length === 0) {
    return {
      totalSentWeight: 0,
      totalReceivedOutputWeight: 0,
      pendingSampleWeight: 0,
      receivedSampleWeight: 0,
      currentGoldAtRefiner: 0,
    };
  }

  const caseIds = cases.map((c) => c.id);

  let totalSentWeight = 0;
  let totalReceivedOutputWeight = 0;
  let pendingSampleWeight = 0;
  let receivedSampleWeight = 0;

  for (const caseId of caseIds) {
    const items = await pb.collection('refining_items').getFullList({
      filter: pb.filter('refining_case = {:caseId}', { caseId }),
    }).catch(() => []);

    for (const item of items) {
      if (item.direction === 'input') {
        totalSentWeight += Number(item.input_weight) || 0;
      } else if (item.direction === 'output' && item.status === 'received') {
        totalReceivedOutputWeight += Number(item.output_weight) || 0;
      }
    }

    const samples = await pb.collection('refining_samples').getFullList({
      filter: pb.filter('refining_case = {:caseId}', { caseId }),
    }).catch(() => []);

    for (const sample of samples) {
      if (sample.status === 'pending') {
        pendingSampleWeight += Number(sample.declared_weight) || 0;
      } else if (sample.status === 'received') {
        receivedSampleWeight += Number(sample.received_weight ?? sample.declared_weight) || 0;
      }
    }
  }

  totalSentWeight = roundWeight(totalSentWeight, 3);
  totalReceivedOutputWeight = roundWeight(totalReceivedOutputWeight, 3);
  pendingSampleWeight = roundWeight(pendingSampleWeight, 3);
  receivedSampleWeight = roundWeight(receivedSampleWeight, 3);

  // Gold currently held at refiner = Total input gold sent minus output gold received and sample packets returned
  const currentGoldAtRefiner = roundWeight(
    Math.max(0, totalSentWeight - totalReceivedOutputWeight - receivedSampleWeight),
    3,
  );

  return {
    totalSentWeight,
    totalReceivedOutputWeight,
    pendingSampleWeight,
    receivedSampleWeight,
    currentGoldAtRefiner,
  };
}

/**
 * Lists unreceived sample packets across all refiners or filtered by refiner/case.
 */
export async function getPendingSamples(
  pb: PocketBase,
  options: {
    refinerId?: string;
    caseId?: string;
    search?: string;
  } = {},
): Promise<RefiningSample[]> {
  const filters: string[] = ['status = "pending"'];

  if (options.refinerId) {
    filters.push(pb.filter('refiner = {:refinerId}', { refinerId: options.refinerId }));
  }
  if (options.caseId) {
    filters.push(pb.filter('refining_case = {:caseId}', { caseId: options.caseId }));
  }

  const records = await pb.collection('refining_samples').getFullList({
    filter: filters.join(' && '),
    expand: 'refiner,refining_case',
    sort: '-created',
  }).catch(() => []);

  let samples = records.map(mapRefiningSample);

  if (options.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    samples = samples.filter(
      (s) =>
        s.sampleCode.toLowerCase().includes(q) ||
        (s.caseNumber && s.caseNumber.toLowerCase().includes(q)) ||
        (s.refinerName && s.refinerName.toLowerCase().includes(q)),
    );
  }

  return samples;
}
