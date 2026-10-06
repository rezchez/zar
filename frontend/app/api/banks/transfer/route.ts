import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { ensureBankAccountsCollection } from '@/lib/bank-collection';
import { generateUniqueZfDocumentNumber } from '@/lib/document-number';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

type TransferKind = 'bank-to-bank' | 'cash-to-bank' | 'bank-to-cash';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeServerCurrency(raw: any, currencyMap?: Map<string, any>): string {
  if (!raw) return 'IRR';

  const rawCode = String(raw.currency_code || raw.currencyCode || '').trim().toUpperCase();
  if (rawCode === 'IRR' || rawCode === 'RIAL' || rawCode.includes('ریال')) return 'IRR';
  if (rawCode === 'IRT' || rawCode === 'TOMAN' || rawCode.includes('تومان')) return 'IRT';
  if (rawCode) return rawCode;

  const rawField = String(raw.currency || '').trim();
  const rawName = String(raw.currency_name || raw.currencyName || '').trim();
  const rawSymbol = String(raw.currency_symbol || raw.currencySymbol || '').trim();

  if (currencyMap && (rawField || rawName)) {
    const fromMap =
      (rawField && (currencyMap.get(rawField.toLowerCase()) || currencyMap.get(rawField.toUpperCase()) || currencyMap.get(rawField))) ||
      (rawName && (currencyMap.get(rawName.toLowerCase()) || currencyMap.get(rawName.toUpperCase()) || currencyMap.get(rawName)));

    if (fromMap?.code) {
      const code = String(fromMap.code).trim().toUpperCase();
      if (code === 'IRR' || code === 'RIAL') return 'IRR';
      if (code === 'IRT' || code === 'TOMAN') return 'IRT';
      return code;
    }
  }

  if (rawField) {
    const upper = rawField.toUpperCase();
    if (upper === 'IRR' || upper === 'RIAL' || rawField.includes('ریال')) return 'IRR';
    if (upper === 'IRT' || upper === 'TOMAN' || rawField.includes('تومان')) return 'IRT';
    if (/^[A-Z]{3}$/.test(upper)) return upper;
  }

  if (rawName) {
    if (rawName.includes('ریال')) return 'IRR';
    if (rawName.includes('تومان')) return 'IRT';
  }

  if (rawSymbol === 'ریال') return 'IRR';
  if (rawSymbol === 'تومان') return 'IRT';

  return rawField ? rawField.toUpperCase() : 'IRR';
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = text(body?.kind) as TransferKind;
  const amount = positiveAmount(body?.amount);
  const transferFee = positiveAmount(body?.transferFee) || 0;
  const sourceBankId = text(body?.sourceBankId);
  const destinationBankId = text(body?.destinationBankId);
  const cashFundId = text(body?.cashFundId);
  const trackingNumber = text(body?.trackingNumber);
  const description = text(body?.description).slice(0, 500);
  const idempotencyKey = text(body?.idempotencyKey) || `transfer:${randomUUID()}`;

  if (!['bank-to-bank', 'cash-to-bank', 'bank-to-cash'].includes(kind) || amount === null) {
    return NextResponse.json({ message: 'نوع انتقال و مبلغ معتبر الزامی است.' }, { status: 400 });
  }

  if (kind === 'bank-to-bank' && (!sourceBankId || !destinationBankId || sourceBankId === destinationBankId)) {
    return NextResponse.json({ message: 'حساب مبدأ و مقصد باید متفاوت باشند.' }, { status: 400 });
  }

  if (kind === 'cash-to-bank') {
    if (!destinationBankId) {
      return NextResponse.json({ message: 'حساب مقصد بانکی را انتخاب کنید.' }, { status: 400 });
    }
    if (!cashFundId) {
      return NextResponse.json({ message: 'صندوق وجه نقد مبدأ را انتخاب کنید.' }, { status: 400 });
    }
  }

  if (kind === 'bank-to-cash') {
    if (!sourceBankId) {
      return NextResponse.json({ message: 'حساب مبدأ بانکی را انتخاب کنید.' }, { status: 400 });
    }
    if (!cashFundId) {
      return NextResponse.json({ message: 'صندوق وجه نقد مقصد را انتخاب کنید.' }, { status: 400 });
    }
  }

  let writer = context.pb;
  try {
    writer = await getPocketBaseServiceClient();
  } catch {
    // Use the authenticated client in local development when service credentials are absent.
  }

  const updatedBankIds: string[] = [];
  const createdTransactionIds: string[] = [];

  try {
    await ensureBankAccountsCollection(writer);
    const sourceBank = sourceBankId
      ? await writer.collection('bank_accounts').getOne(sourceBankId).catch(() => null)
      : null;
    const destinationBank = destinationBankId
      ? await writer.collection('bank_accounts').getOne(destinationBankId).catch(() => null)
      : null;
    const ledgerAccount = await writer.collection('customers').getFirstListItem(
      writer.filter('customerCode = {:customerCode}', { customerCode: 0 }),
    ).catch(() => null);

    if (!ledgerAccount) {
      return NextResponse.json(
        { message: 'حساب کد صفر برای ثبت سند انتقال پیدا نشد.' },
        { status: 400 },
      );
    }

    const currenciesList = await writer.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, any>();
    for (const c of (currenciesList as any[])) {
      if (c.id) currencyMap.set(String(c.id).toLowerCase(), c);
      if (c.code) currencyMap.set(String(c.code).toUpperCase(), c);
      if (c.name) currencyMap.set(String(c.name).trim(), c);
    }

    const totalRequiredSource = amount + transferFee;
    if (sourceBank && Number(sourceBank.balance ?? 0) < totalRequiredSource) {
      return NextResponse.json({ message: 'موجودی حساب مبدأ با احتساب کارمزد کافی نیست.' }, { status: 400 });
    }

    if (kind === 'bank-to-bank') {
      if (!sourceBank || !destinationBank) {
        return NextResponse.json({ message: 'حساب‌های بانکی انتخاب‌شده معتبر نیستند.' }, { status: 400 });
      }
      const sourceCurr = normalizeServerCurrency(sourceBank, currencyMap);
      const destCurr = normalizeServerCurrency(destinationBank, currencyMap);
      if (sourceCurr !== destCurr) {
        return NextResponse.json(
          { message: 'انتقال حساب به حساب فقط بین حساب‌های بانکی با واحد پولی یکسان امکان‌پذیر است.' },
          { status: 400 },
        );
      }
    }

    // Cash Fund resolution & validation for cash-to-bank or bank-to-cash
    let cashFund: any = null;
    if (cashFundId) {
      cashFund = await writer.collection('cash_funds').getOne(cashFundId).catch(() => null);
    }
    if (kind === 'cash-to-bank') {
      if (!destinationBank) {
        return NextResponse.json({ message: 'حساب مقصد بانکی معتبر نیست.' }, { status: 400 });
      }
      if (!cashFund) {
        return NextResponse.json({ message: 'صندوق وجه نقد مبدأ پیدا نشد.' }, { status: 400 });
      }
      if (cashFund && cashFund.isBlocked) {
        return NextResponse.json({ message: 'صندوق وجه نقد مبدأ مسدود است.' }, { status: 409 });
      }
      if (cashFund && Number(cashFund.balance ?? 0) < amount) {
        return NextResponse.json({ message: 'موجودی صندوق وجه نقد مبدأ کافی نیست.' }, { status: 400 });
      }
      const vaultCurr = normalizeServerCurrency(cashFund, currencyMap);
      const destCurr = normalizeServerCurrency(destinationBank, currencyMap);
      if (vaultCurr !== destCurr) {
        return NextResponse.json(
          { message: 'واریز از صندوق به حساب بانکی فقط به حساب‌های با واحد پولی یکسان امکان‌پذیر است.' },
          { status: 400 },
        );
      }
    }
    if (kind === 'bank-to-cash') {
      if (!sourceBank) {
        return NextResponse.json({ message: 'حساب مبدأ بانکی معتبر نیست.' }, { status: 400 });
      }
      if (!cashFund) {
        return NextResponse.json({ message: 'صندوق وجه نقد مقصد پیدا نشد.' }, { status: 400 });
      }
      if (cashFund && cashFund.isBlocked) {
        return NextResponse.json({ message: 'صندوق وجه نقد مقصد مسدود است.' }, { status: 409 });
      }
      const sourceCurr = normalizeServerCurrency(sourceBank, currencyMap);
      const vaultCurr = normalizeServerCurrency(cashFund, currencyMap);
      if (sourceCurr !== vaultCurr) {
        return NextResponse.json(
          { message: 'برداشت از حساب بانکی به صندوق فقط به صندوق‌های با واحد پولی یکسان امکان‌پذیر است.' },
          { status: 400 },
        );
      }
    }

    // isBlocked guard — Backend enforcement for blocked bank accounts
    if (sourceBank && sourceBank.isBlocked === true) {
      return NextResponse.json(
        {
          success: false,
          code: 'BANK_ACCOUNT_BLOCKED',
          message: 'حساب بانکی مبدأ مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.',
        },
        { status: 409 },
      );
    }
    if (destinationBank && destinationBank.isBlocked === true) {
      return NextResponse.json(
        {
          success: false,
          code: 'BANK_ACCOUNT_BLOCKED',
          message: 'حساب بانکی مقصد مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.',
        },
        { status: 409 },
      );
    }

    const existing = await writer.collection('transactions').getFirstListItem(
      writer.filter('sourceKey = {:sourceKey} && is_deleted = false', { sourceKey: `bank-transfer:${idempotencyKey}-out` }),
    ).catch(() => null);

    if (existing) {
      return NextResponse.json({
        message: 'انتقال مالی با موفقیت ثبت شد.',
        documentId: idempotencyKey,
        alreadyExists: true,
      }, { status: 200 });
    }

    const documentId = idempotencyKey;
    const ledgerCustomerCode = Number(ledgerAccount.customerCode);
    const transactionPayload: Record<string, unknown> = {
      customer: ledgerAccount.id,
      createdBy: context.user.id,
      updatedBy: context.user.id,
      transactionType: 'adjustment',
      status: 'posted',
      isOpeningBalance: false,
      sourceKey: `bank-transfer:${documentId}-out`,
      transactionDate: new Date().toISOString(),
      documentId,
      documentNumber: '',
      description: description || 'انتقال وجه بین حساب‌ها',
      documentNature: 'received',
      documentTab: 'bank',
      documentSubType: kind,
      rialAmount: amount,
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      foreignAmount: 0,
      tertiaryAmount: 0,
      documentDetails: JSON.stringify({
        kind,
        sourceBankId,
        destinationBankId,
        amount,
      }),
    };
    if (ledgerCustomerCode >= 1) {
      transactionPayload.customerCode = ledgerCustomerCode;
    }

    const baseDetailsObj = {
      kind,
      sourceBankId,
      destinationBankId,
      cashFundId,
      amount,
      transferFee,
      trackingNumber,
    };

    const outgoingDocNum = await generateUniqueZfDocumentNumber(writer);
    const incomingDocNum = await generateUniqueZfDocumentNumber(writer, 10, new Set([outgoingDocNum]));

    const outgoing = await writer.collection('transactions').create({
      ...transactionPayload,
      documentNumber: outgoingDocNum,
      documentNature: 'paid',
      rialAmount: -amount,
      documentDetails: JSON.stringify({
        ...baseDetailsObj,
        side: 'outgoing',
      }),
    });
    createdTransactionIds.push(outgoing.id);

    const incoming = await writer.collection('transactions').create({
      ...transactionPayload,
      documentNumber: incomingDocNum,
      sourceKey: `bank-transfer:${documentId}-in`,
      documentNature: 'received',
      rialAmount: amount,
      documentDetails: JSON.stringify({
        ...baseDetailsObj,
        side: 'incoming',
      }),
    });
    createdTransactionIds.push(incoming.id);

    if (sourceBank) {
      await writer.collection('bank_accounts').update(sourceBank.id, {
        balance: Number(sourceBank.balance ?? 0) - totalRequiredSource,
        updatedBy: context.user.id,
      }).catch(() => null);
    }

    if (destinationBank) {
      await writer.collection('bank_accounts').update(destinationBank.id, {
        balance: Number(destinationBank.balance ?? 0) + amount,
        updatedBy: context.user.id,
      }).catch(() => null);
    }

    if (kind === 'cash-to-bank' && cashFund) {
      await writer.collection('cash_funds').update(cashFund.id, {
        balance: Number(cashFund.balance ?? 0) - amount,
      }).catch(() => null);
    }

    if (kind === 'bank-to-cash' && cashFund) {
      await writer.collection('cash_funds').update(cashFund.id, {
        balance: Number(cashFund.balance ?? 0) + amount,
      }).catch(() => null);
    }

    return NextResponse.json({
      message: 'انتقال مالی با موفقیت ثبت شد.',
      documentId,
      transactionIds: [outgoing.id, incoming.id],
    }, { status: 201 });
  } catch (error) {
    for (const bankId of updatedBankIds) {
      // Balance rollback requires the original value in production; the failed
      // request is surfaced so the operator can reconcile the ledger safely.
      await writer.collection('bank_accounts').getOne(bankId).catch(() => null);
    }
    for (const transactionId of createdTransactionIds) {
      await writer.collection('transactions').delete(transactionId).catch(() => undefined);
    }

    console.error('bank_transfer_failed', error);
    return NextResponse.json(
      { message: 'ثبت انتقال انجام نشد. موجودی و ساختار کالکشن‌ها را بررسی کنید.' },
      { status: 400 },
    );
  }
}
