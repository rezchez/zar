import { describe, it, expect, beforeEach } from 'bun:test';
import {
  postBankPaymentToCustomer,
  postBankReceiptFromCustomer,
  SYSTEM_ACCOUNT_CODES,
} from '@/features/accounting/posting/posting-engine';
import type { BankAccount } from '@/lib/bank';

describe('Bank Payment & Receipt Accounting Tests', () => {
  let mockPb: any;
  let journalEntries: any[] = [];
  let journalLines: any[] = [];

  const sampleBank: BankAccount = {
    id: 'bank_pasargad_main',
    bankName: 'پاسارگاد',
    branchName: 'جمهوری',
    accountNumber: '123456789',
    accountCodeZero: '0',
    currency: 'IRR',
    balance: 500000000,
    currentBalance: 500000000,
    isActive: true,
    isBlocked: false,
    accountId: 'acc_bank_pasargad',
    created: '2026-01-01',
    updated: '2026-01-01',
  };

  const sampleCustomer = {
    id: 'cust_reza_1',
    name: 'رضا محمدی',
    customerCode: 101,
    accountId: 'acc_cust_reza',
  };

  beforeEach(() => {
    journalEntries = [];
    journalLines = [];

    mockPb = {
      _store: true,
      filter: (tmpl: string, params: Record<string, any>) => ({ tmpl, params }),
      collection: (name: string) => {
        if (name === 'journal_entries' || name === 'pbc_journal_entries') {
          return {
            getFirstListItem: async (query: any) => {
              const srcKey = query?.params?.sourceKey;
              return journalEntries.find((e) => e.sourceKey === srcKey) || null;
            },
            create: async (data: any) => {
              const record = { id: `je_${Date.now()}_${Math.random()}`, ...data };
              journalEntries.push(record);
              return record;
            },
            update: async (id: string, data: any) => {
              const idx = journalEntries.findIndex((e) => e.id === id);
              if (idx >= 0) {
                journalEntries[idx] = { ...journalEntries[idx], ...data };
                return journalEntries[idx];
              }
              return data;
            },
          };
        }
        if (name === 'journal_lines' || name === 'pbc_journal_lines') {
          return {
            getFullList: async () => journalLines,
            create: async (data: any) => {
              const record = { id: `jl_${Date.now()}_${Math.random()}`, ...data };
              journalLines.push(record);
              return record;
            },
            delete: async (id: string) => {
              journalLines = journalLines.filter((l) => l.id !== id);
              return true;
            },
          };
        }
        if (name === 'chart_of_accounts') {
          return {
            getOne: async (id: string) => {
              if (id === 'acc_bank_pasargad') return { id, code: '111001', name: 'بانک پاسارگاد جمهوری', isActive: true };
              if (id === 'acc_cust_reza') return { id, code: '212001', name: 'رضا محمدی', isActive: true };
              if (id === 'sys_6300') return { id, code: '6300', name: 'هزینه‌های مالی و بانکی', isActive: true };
              return null;
            },
            getFirstListItem: async (query: any) => {
              const code = query?.params?.code;
              if (code === '6300') return { id: 'sys_6300', code: '6300', name: 'هزینه‌های مالی و بانکی', isActive: true };
              if (code === '1110') return { id: 'sys_1110', code: '1110', name: 'موجودی نزد بانک‌ها', isActive: true };
              if (code === '2120') return { id: 'sys_2120', code: '2120', name: 'بستانکاران تجاری', isActive: true };
              return null;
            },
          };
        }
        return {
          getFirstListItem: async () => null,
          getOne: async () => null,
          create: async (d: any) => d,
        };
      },
    };
  });

  it('posts bank payment with transfer fee: creates balanced journal entry with 3 lines', async () => {
    const paymentAmount = 100000000; // 100,000,000 Rials to customer
    const feeAmount = 150000; // 150,000 Rials bank fee

    const result = await postBankPaymentToCustomer(
      {
        documentId: 'doc_101:1',
        documentNumber: 'ZF-00101',
        entryDateJalali: '1405/01/15',
        amount: paymentAmount,
        transferFee: feeAmount,
        customer: sampleCustomer,
        bankAccount: sampleBank,
        userId: 'usr_admin',
        description: 'پرداخت وجه بابت تسویه فاکتور طلا',
        trackingNumber: 'TRK-998877',
      },
      mockPb,
    );

    expect(result).toBeDefined();
    expect(result.sourceType).toBe('bank_transfer');
    expect(result.sourceKey).toBe('bank:payment:doc_101:1');
    expect(result.totalDebit).toBe(100150000);
    expect(result.totalCredit).toBe(100150000);

    // Verify journal lines
    expect(result.lines.length).toBe(3);

    // 1. Customer liability debited by principal amount
    const customerLine = result.lines.find((l) => l.partyId === sampleCustomer.id && l.debit === paymentAmount);
    expect(customerLine).toBeDefined();
    expect(customerLine?.credit).toBe(0);

    // 2. Bank fee expense debited by transferFee
    const feeLine = result.lines.find((l) => l.accountCode === '6300' || l.accountId === 'sys_6300');
    expect(feeLine).toBeDefined();
    expect(feeLine?.debit).toBe(feeAmount);
    expect(feeLine?.credit).toBe(0);

    // 3. Bank account credited by total deduction (amount + fee)
    const bankLine = result.lines.find((l) => l.credit === paymentAmount + feeAmount);
    expect(bankLine).toBeDefined();
    expect(bankLine?.debit).toBe(0);
    expect(bankLine?.bankAccountId).toBe(sampleBank.id);
  });

  it('posts bank payment WITHOUT transfer fee: creates balanced 2-line entry', async () => {
    const paymentAmount = 50000000;

    const result = await postBankPaymentToCustomer(
      {
        documentId: 'doc_102:1',
        documentNumber: 'ZF-00102',
        entryDateJalali: '1405/01/15',
        amount: paymentAmount,
        transferFee: 0, // No fee
        customer: sampleCustomer,
        bankAccount: sampleBank,
        userId: 'usr_admin',
      },
      mockPb,
    );

    expect(result.lines.length).toBe(2);
    expect(result.totalDebit).toBe(paymentAmount);
    expect(result.totalCredit).toBe(paymentAmount);

    const feeLine = result.lines.find((l) => l.accountCode === '6300');
    expect(feeLine).toBeUndefined();
  });

  it('rejects bank payment with zero or negative amount', async () => {
    await expect(
      postBankPaymentToCustomer(
        {
          documentId: 'doc_103:1',
          amount: 0,
          customer: sampleCustomer,
          bankAccount: sampleBank,
          userId: 'usr_admin',
        },
        mockPb,
      ),
    ).rejects.toThrow('مبلغ پرداختی به طرف‌حساب باید بیشتر از صفر باشد.');
  });

  it('posts bank receipt from customer: debits bank and credits customer liability', async () => {
    const receiptAmount = 80000000;

    const result = await postBankReceiptFromCustomer(
      {
        documentId: 'doc_104:1',
        documentNumber: 'ZF-00104',
        entryDateJalali: '1405/01/15',
        amount: receiptAmount,
        customer: sampleCustomer,
        bankAccount: sampleBank,
        userId: 'usr_admin',
        trackingNumber: 'IN-776655',
      },
      mockPb,
    );

    expect(result.sourceType).toBe('bank_transfer');
    expect(result.sourceKey).toBe('bank:receipt:doc_104:1');
    expect(result.totalDebit).toBe(receiptAmount);
    expect(result.totalCredit).toBe(receiptAmount);
    expect(result.lines.length).toBe(2);

    const bankDebit = result.lines.find((l) => l.bankAccountId === sampleBank.id && l.debit === receiptAmount);
    expect(bankDebit).toBeDefined();

    const customerCredit = result.lines.find((l) => l.partyId === sampleCustomer.id && l.credit === receiptAmount);
    expect(customerCredit).toBeDefined();
  });

  it('ensures idempotency via sourceKey', async () => {
    const params = {
      documentId: 'doc_105:1',
      entryDateJalali: '1405/01/15',
      amount: 25000000,
      transferFee: 50000,
      customer: sampleCustomer,
      bankAccount: sampleBank,
      userId: 'usr_admin',
    };

    const first = await postBankPaymentToCustomer(params, mockPb);
    const second = await postBankPaymentToCustomer(params, mockPb);

    expect(first.id).toBe(second.id);
    expect(second.alreadyExists).toBe(true);
  });
});
