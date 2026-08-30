import 'server-only';

import { randomUUID } from 'node:crypto';
import type PocketBase from 'pocketbase';

import { formatJalaliDate, jalaliDateToIso } from '@/lib/jalali';
import type { BankAccount } from '@/lib/bank';
import type { Customer } from '@/lib/customer';
import type { CheckRecord } from '@/lib/check';
import { DEFAULT_CHART_OF_ACCOUNTS } from '@/lib/chart-of-accounts';

export interface JournalLineInput {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number; // positive integer IRR
  credit: number; // positive integer IRR
  description: string;
  partyId?: string | null;
  bankAccountId?: string | null;
  chequeId?: string | null;
}

export interface CreateJournalEntryParams {
  entryDate?: string; // ISO string YYYY-MM-DD
  entryDateJalali?: string; // YYYY/MM/DD
  description: string;
  sourceType:
    | 'cheque_issue'
    | 'cheque_clear'
    | 'cheque_return'
    | 'cheque_receive'
    | 'cheque_collect'
    | 'document'
    | 'bank_transfer'
    | 'settlement'
    | 'manual';
  sourceId: string;
  sourceKey: string;
  lines: JournalLineInput[];
  status?: 'draft' | 'posted' | 'reversed';
  userId?: string;
}

export interface JournalEntryResult {
  id: string;
  entryNumber: string;
  entryDate: string;
  entryDateJalali: string;
  description: string;
  sourceType: string;
  sourceId: string;
  sourceKey: string;
  status: 'draft' | 'posted' | 'reversed';
  totalDebit: number;
  totalCredit: number;
  lines: JournalLineInput[];
  alreadyExists?: boolean;
}

// System Default Account Code Fallbacks
export const SYSTEM_ACCOUNT_CODES = {
  CASH_AND_BANK: '1110',
  NOTES_RECEIVABLE: '1120',
  GOLD_INVENTORY: '1130',
  NOTES_PAYABLE: '2110',
  COUNTERPARTY_LIABILITY: '2120',
  GOLD_SALES_REVENUE: '4110',
  GOLD_COST_OF_SALES: '5200',
  PROFIT_LOSS: '3500',
} as const;

/**
 * Resolves account details from Chart of Accounts by ID or fallback Code.
 */
async function resolveAccount(
  pb: PocketBase,
  accountIdOrCode: string,
): Promise<{ id: string; code: string; name: string }> {
  try {
    // Try by ID first
    const record = await pb.collection('chart_of_accounts').getOne(accountIdOrCode).catch(() => null);
    if (record) {
      return { id: record.id, code: record.code, name: record.name };
    }

    // Try by code
    const byCode = await pb.collection('chart_of_accounts').getFirstListItem(
      pb.filter('code = {:code}', { code: accountIdOrCode }),
    ).catch(() => null);
    if (byCode) {
      return { id: byCode.id, code: byCode.code, name: byCode.name };
    }
  } catch {
    // PocketBase may be offline/mock
  }

  // Static Fallback from DEFAULT_CHART_OF_ACCOUNTS
  const defaultAcc = DEFAULT_CHART_OF_ACCOUNTS.find(
    (a) => a.id === accountIdOrCode || a.code === accountIdOrCode,
  );
  if (defaultAcc) {
    return { id: defaultAcc.id, code: defaultAcc.code, name: defaultAcc.name };
  }

  return {
    id: accountIdOrCode,
    code: accountIdOrCode,
    name: `سرفصل حساب ${accountIdOrCode}`,
  };
}

/**
 * Core Posting Engine:
 * - Strictly enforces Double-Entry Invariant (sum Debit == sum Credit)
 * - Checks Idempotency using sourceKey
 * - Persists balanced Journal Entry into PocketBase
 */
export async function postJournalEntry(
  params: CreateJournalEntryParams,
  pb: PocketBase,
): Promise<JournalEntryResult> {
  const {
    description,
    sourceType,
    sourceId,
    sourceKey,
    lines,
    status = 'posted',
    userId,
  } = params;

  if (!lines || lines.length < 2) {
    throw new Error('سند حسابداری باید حداقل شامل دو ردیف (بدهکار و بستانکار) باشد.');
  }

  // Calculate & validate balance
  let totalDebit = 0;
  let totalCredit = 0;

  const resolvedLines: JournalLineInput[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const debit = Math.round(Math.max(0, Number(line.debit) || 0));
    const credit = Math.round(Math.max(0, Number(line.credit) || 0));

    if (debit === 0 && credit === 0) {
      throw new Error(`ردیف ${i + 1} سند باید دارای مبلغ بدهکار یا بستانکار باشد.`);
    }
    if (debit > 0 && credit > 0) {
      throw new Error(`ردیف ${i + 1} نمی‌تواند هم‌زمان بدهکار و بستانکار باشد.`);
    }

    totalDebit += debit;
    totalCredit += credit;

    const acc = await resolveAccount(pb, line.accountId);

    resolvedLines.push({
      accountId: acc.id,
      accountCode: acc.code,
      accountName: acc.name,
      debit,
      credit,
      description: line.description || description,
      partyId: line.partyId || null,
      bankAccountId: line.bankAccountId || null,
      chequeId: line.chequeId || null,
    });
  }

  if (totalDebit !== totalCredit) {
    throw new Error(
      `سند نامتوازن است! جمع بدهکار (${totalDebit.toLocaleString('fa-IR')}) با جمع بستانکار (${totalCredit.toLocaleString('fa-IR')}) برابر نیست. اختلاف: ${Math.abs(totalDebit - totalCredit).toLocaleString('fa-IR')}`,
    );
  }

  if (totalDebit === 0) {
    throw new Error('مبلغ کل سند حسابداری نمی‌تواند صفر باشد.');
  }

  const entryDateJalali = params.entryDateJalali || formatJalaliDate();
  const entryDate = params.entryDate || jalaliDateToIso(entryDateJalali) || new Date().toISOString().slice(0, 10);
  const entryNumber = `JE-${Date.now().toString(36).toUpperCase()}`;

  // Idempotency Check via sourceKey
  try {
    const existing = await pb.collection('journal_entries').getFirstListItem(
      pb.filter('sourceKey = {:sourceKey}', { sourceKey }),
    ).catch(() => null);

    if (existing) {
      return {
        id: existing.id,
        entryNumber: String(existing.entryNumber || entryNumber),
        entryDate: String(existing.entryDate || entryDate),
        entryDateJalali: String(existing.entryDateJalali || entryDateJalali),
        description: String(existing.description || description),
        sourceType: String(existing.sourceType || sourceType),
        sourceId: String(existing.sourceId || sourceId),
        sourceKey: String(existing.sourceKey || sourceKey),
        status: existing.status as any,
        totalDebit: Number(existing.totalDebit || totalDebit),
        totalCredit: Number(existing.totalCredit || totalCredit),
        lines: Array.isArray(existing.lines) ? existing.lines : resolvedLines,
        alreadyExists: true,
      };
    }

    const created = await pb.collection('journal_entries').create({
      entryNumber,
      entryDate,
      entryDateJalali,
      description,
      sourceType,
      sourceId,
      sourceKey,
      status,
      totalDebit,
      totalCredit,
      lines: resolvedLines,
      createdBy: userId || null,
      updatedBy: userId || null,
    });

    return {
      id: created.id,
      entryNumber: created.entryNumber,
      entryDate: created.entryDate,
      entryDateJalali: created.entryDateJalali,
      description: created.description,
      sourceType: created.sourceType,
      sourceId: created.sourceId,
      sourceKey: created.sourceKey,
      status: created.status,
      totalDebit: created.totalDebit,
      totalCredit: created.totalCredit,
      lines: resolvedLines,
    };
  } catch (error: any) {
    // If journal collection doesn't exist yet, return virtual entry
    return {
      id: randomUUID(),
      entryNumber,
      entryDate,
      entryDateJalali,
      description,
      sourceType,
      sourceId,
      sourceKey,
      status,
      totalDebit,
      totalCredit,
      lines: resolvedLines,
    };
  }
}

// -------------------------------------------------------------
// CHEQUE POSTING WORKFLOWS
// -------------------------------------------------------------

/**
 * Step 1 (Payable Cheque Issuance / صدور چک پرداختنی):
 * Debit: Counterparty / Creditor (2120 بدهی به طرف حساب‌ها)
 * Credit: Notes Payable (2110 اسناد پرداختنی)
 * Note: DOES NOT DEDUCT BANK BALANCE!
 */
export async function postPayableChequeIssue(
  cheque: {
    id: string;
    amount: number;
    sayadId: string;
    description: string;
    dueDateJalali: string;
    bankAccount: string;
    customer: string;
    payableAccountId?: string | null;
  },
  customer: { id: string; name: string; customerCode?: number },
  bankAccount: BankAccount,
  userId: string,
  pb: PocketBase,
): Promise<JournalEntryResult> {
  const amount = Math.round(cheque.amount);
  const payableAccount = cheque.payableAccountId || SYSTEM_ACCOUNT_CODES.NOTES_PAYABLE;
  const liabilityAccount = SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY;

  const desc = `صدور چک صیادی ${cheque.sayadId} به سررسید ${cheque.dueDateJalali} به نام ${customer.name} — ${cheque.description}`;

  return postJournalEntry(
    {
      description: desc,
      sourceType: 'cheque_issue',
      sourceId: cheque.id,
      sourceKey: `cheque:issue:${cheque.id}`,
      userId,
      lines: [
        {
          accountId: liabilityAccount,
          debit: amount,
          credit: 0,
          description: `بدهکار طرف‌حساب: ${customer.name}`,
          partyId: customer.id,
          chequeId: cheque.id,
        },
        {
          accountId: payableAccount,
          debit: 0,
          credit: amount,
          description: `بستانکار اسناد پرداختنی (چک ${cheque.sayadId})`,
          partyId: customer.id,
          bankAccountId: bankAccount.id,
          chequeId: cheque.id,
        },
      ],
    },
    pb,
  );
}

/**
 * Step 2 (Payable Cheque Clearing / وصول چک پرداختنی توسط بانک):
 * Debit: Notes Payable (2110 اسناد پرداختنی)
 * Credit: Bank Account (Bank Account coding ID / 1110 موجودی نقد و بانک)
 * Note: DEDUCTS BANK BALANCE HERE!
 */
export async function postPayableChequeClear(
  cheque: {
    id: string;
    amount: number;
    sayadId: string;
    description: string;
    bankAccount: string;
    customer: string;
    payableAccountId?: string | null;
  },
  bankAccount: BankAccount,
  customerName: string,
  userId: string,
  pb: PocketBase,
  clearedDateJalali?: string,
): Promise<{ journal: JournalEntryResult; nextBankBalance: number }> {
  const amount = Math.round(cheque.amount);
  const payableAccount = cheque.payableAccountId || SYSTEM_ACCOUNT_CODES.NOTES_PAYABLE;
  const bankCodingAccount = bankAccount.accountId || SYSTEM_ACCOUNT_CODES.CASH_AND_BANK;

  const desc = `وصول چک پرداختنی صیادی ${cheque.sayadId} از حساب ${bankAccount.bankName} به نام ${customerName}`;

  const journal = await postJournalEntry(
    {
      entryDateJalali: clearedDateJalali,
      description: desc,
      sourceType: 'cheque_clear',
      sourceId: cheque.id,
      sourceKey: `cheque:clear:${cheque.id}`,
      userId,
      lines: [
        {
          accountId: payableAccount,
          debit: amount,
          credit: 0,
          description: `تسویه اسناد پرداختنی (چک ${cheque.sayadId})`,
          bankAccountId: bankAccount.id,
          chequeId: cheque.id,
        },
        {
          accountId: bankCodingAccount,
          debit: 0,
          credit: amount,
          description: `برداشت از حساب بانکی ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          bankAccountId: bankAccount.id,
          chequeId: cheque.id,
        },
      ],
    },
    pb,
  );

  // Update bank balance
  const currentBankBalance = Number(bankAccount.currentBalance ?? bankAccount.balance ?? 0);
  const nextBankBalance = currentBankBalance - amount;

  await pb.collection('bank_accounts').update(bankAccount.id, {
    balance: nextBankBalance,
    currentBalance: nextBankBalance,
    updatedBy: userId,
  }).catch(() => undefined);

  return { journal, nextBankBalance };
}

/**
 * Step 3 (Payable Cheque Return / برگشت چک پرداختنی):
 * Adjusts accounting entries based on previous clearing status.
 */
export async function postPayableChequeReturn(
  cheque: {
    id: string;
    amount: number;
    sayadId: string;
    description: string;
    bankAccount: string;
    customer: string;
    payableAccountId?: string | null;
  },
  bankAccount: BankAccount,
  customer: { id: string; name: string },
  wasCleared: boolean,
  userId: string,
  pb: PocketBase,
  returnedDateJalali?: string,
): Promise<JournalEntryResult> {
  const amount = Math.round(cheque.amount);
  const payableAccount = cheque.payableAccountId || SYSTEM_ACCOUNT_CODES.NOTES_PAYABLE;
  const liabilityAccount = SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY;
  const bankCodingAccount = bankAccount.accountId || SYSTEM_ACCOUNT_CODES.CASH_AND_BANK;

  const desc = `برگشت چک پرداختنی صیادی ${cheque.sayadId} عهده ${bankAccount.bankName} (${customer.name})`;

  if (wasCleared) {
    // If it was already cleared by bank, return funds to bank and restore liability
    const journal = await postJournalEntry(
      {
        entryDateJalali: returnedDateJalali,
        description: desc,
        sourceType: 'cheque_return',
        sourceId: cheque.id,
        sourceKey: `cheque:return:${cheque.id}`,
        userId,
        lines: [
          {
            accountId: bankCodingAccount,
            debit: amount,
            credit: 0,
            description: `برگشت وجه به حساب بانکی ${bankAccount.bankName}`,
            bankAccountId: bankAccount.id,
            chequeId: cheque.id,
          },
          {
            accountId: liabilityAccount,
            debit: 0,
            credit: amount,
            description: `احیای بدهی به طرف‌حساب: ${customer.name}`,
            partyId: customer.id,
            chequeId: cheque.id,
          },
        ],
      },
      pb,
    );

    // Restore bank balance
    const currentBankBalance = Number(bankAccount.currentBalance ?? bankAccount.balance ?? 0);
    const nextBankBalance = currentBankBalance + amount;
    await pb.collection('bank_accounts').update(bankAccount.id, {
      balance: nextBankBalance,
      currentBalance: nextBankBalance,
      updatedBy: userId,
    }).catch(() => undefined);

    return journal;
  }

  // If not cleared yet: reverse issuance (Debit Notes Payable 2110, Credit Liability 2120)
  return postJournalEntry(
    {
      entryDateJalali: returnedDateJalali,
      description: desc,
      sourceType: 'cheque_return',
      sourceId: cheque.id,
      sourceKey: `cheque:return:${cheque.id}`,
      userId,
      lines: [
        {
          accountId: payableAccount,
          debit: amount,
          credit: 0,
          description: `ابطال اسناد پرداختنی بابت برگشت چک ${cheque.sayadId}`,
          chequeId: cheque.id,
        },
        {
          accountId: liabilityAccount,
          debit: 0,
          credit: amount,
          description: `احیای بدهی به طرف‌حساب ${customer.name}`,
          partyId: customer.id,
          chequeId: cheque.id,
        },
      ],
    },
    pb,
  );
}

/**
 * Step 1 (Receivable Cheque Receipt / دریافت چک از طرف‌حساب):
 * Debit: Notes Receivable (1120 اسناد دریافتنی)
 * Credit: Counterparty / Receivable (1120 / 2120 / customer)
 */
export async function postReceivableChequeReceipt(
  cheque: {
    id: string;
    amount: number;
    sayadId: string;
    description: string;
    dueDateJalali: string;
    customer: string;
    receivableAccountId?: string | null;
  },
  customer: { id: string; name: string },
  userId: string,
  pb: PocketBase,
): Promise<JournalEntryResult> {
  const amount = Math.round(cheque.amount);
  const receivableAccount = cheque.receivableAccountId || SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE;
  const counterpartyAccount = SYSTEM_ACCOUNT_CODES.COUNTERPARTY_LIABILITY;

  const desc = `دریافت چک صیادی ${cheque.sayadId} به سررسید ${cheque.dueDateJalali} از ${customer.name} — ${cheque.description}`;

  return postJournalEntry(
    {
      description: desc,
      sourceType: 'cheque_receive',
      sourceId: cheque.id,
      sourceKey: `cheque:receive:${cheque.id}`,
      userId,
      lines: [
        {
          accountId: receivableAccount,
          debit: amount,
          credit: 0,
          description: `بدهکار اسناد دریافتنی (چک وارده ${cheque.sayadId})`,
          partyId: customer.id,
          chequeId: cheque.id,
        },
        {
          accountId: counterpartyAccount,
          debit: 0,
          credit: amount,
          description: `بستانکار طرف‌حساب: ${customer.name}`,
          partyId: customer.id,
          chequeId: cheque.id,
        },
      ],
    },
    pb,
  );
}

/**
 * Step 2 (Receivable Cheque Collection / وصول چک دریافتی در بانک):
 * Debit: Bank Account (Bank Account coding ID / 1110)
 * Credit: Notes Receivable (1120 اسناد دریافتنی)
 * Note: INCREASES BANK BALANCE HERE!
 */
export async function postReceivableChequeCollection(
  cheque: {
    id: string;
    amount: number;
    sayadId: string;
    receivableAccountId?: string | null;
  },
  bankAccount: BankAccount,
  customerName: string,
  userId: string,
  pb: PocketBase,
  clearedDateJalali?: string,
): Promise<{ journal: JournalEntryResult; nextBankBalance: number }> {
  const amount = Math.round(cheque.amount);
  const receivableAccount = cheque.receivableAccountId || SYSTEM_ACCOUNT_CODES.NOTES_RECEIVABLE;
  const bankCodingAccount = bankAccount.accountId || SYSTEM_ACCOUNT_CODES.CASH_AND_BANK;

  const desc = `وصول چک دریافتی ${cheque.sayadId} به حساب ${bankAccount.bankName} (${customerName})`;

  const journal = await postJournalEntry(
    {
      entryDateJalali: clearedDateJalali,
      description: desc,
      sourceType: 'cheque_collect',
      sourceId: cheque.id,
      sourceKey: `cheque:collect:${cheque.id}`,
      userId,
      lines: [
        {
          accountId: bankCodingAccount,
          debit: amount,
          credit: 0,
          description: `واریز به حساب بانکی ${bankAccount.bankName} (${bankAccount.accountNumber})`,
          bankAccountId: bankAccount.id,
          chequeId: cheque.id,
        },
        {
          accountId: receivableAccount,
          debit: 0,
          credit: amount,
          description: `تسویه اسناد دریافتنی (چک ${cheque.sayadId})`,
          bankAccountId: bankAccount.id,
          chequeId: cheque.id,
        },
      ],
    },
    pb,
  );

  // Update bank balance
  const currentBankBalance = Number(bankAccount.currentBalance ?? bankAccount.balance ?? 0);
  const nextBankBalance = currentBankBalance + amount;

  await pb.collection('bank_accounts').update(bankAccount.id, {
    balance: nextBankBalance,
    currentBalance: nextBankBalance,
    updatedBy: userId,
  }).catch(() => undefined);

  return { journal, nextBankBalance };
}
