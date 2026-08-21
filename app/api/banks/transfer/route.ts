import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { ensureBankAccountsCollection } from '@/lib/bank-collection';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

type TransferKind = 'bank-to-bank' | 'cash-to-bank' | 'bank-to-cash';

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function positiveAmount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.create') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به انتقال مالی بین حساب‌ها.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = text(body?.kind) as TransferKind;
  const amount = positiveAmount(body?.amount);
  const sourceBankId = text(body?.sourceBankId);
  const destinationBankId = text(body?.destinationBankId);
  const description = text(body?.description).slice(0, 500);

  if (!['bank-to-bank', 'cash-to-bank', 'bank-to-cash'].includes(kind) || amount === null) {
    return NextResponse.json({ message: 'نوع انتقال و مبلغ معتبر الزامی است.' }, { status: 400 });
  }

  if (kind === 'bank-to-bank' && (!sourceBankId || !destinationBankId || sourceBankId === destinationBankId)) {
    return NextResponse.json({ message: 'حساب مبدأ و مقصد باید متفاوت باشند.' }, { status: 400 });
  }

  if (kind === 'cash-to-bank' && !destinationBankId) {
    return NextResponse.json({ message: 'حساب مقصد بانکی را انتخاب کنید.' }, { status: 400 });
  }

  if (kind === 'bank-to-cash' && !sourceBankId) {
    return NextResponse.json({ message: 'حساب مبدأ بانکی را انتخاب کنید.' }, { status: 400 });
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
      ? await writer.collection('bank_accounts').getOne(sourceBankId)
      : null;
    const destinationBank = destinationBankId
      ? await writer.collection('bank_accounts').getOne(destinationBankId)
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

    if (sourceBank && Number(sourceBank.balance ?? 0) < amount) {
      return NextResponse.json({ message: 'موجودی حساب مبدأ کافی نیست.' }, { status: 400 });
    }

    if (kind === 'bank-to-bank' && (!sourceBank || !destinationBank)) {
      return NextResponse.json({ message: 'حساب‌های بانکی انتخاب‌شده معتبر نیستند.' }, { status: 400 });
    }

    if (sourceBank) {
      await writer.collection('bank_accounts').update(sourceBank.id, {
        balance: Number(sourceBank.balance ?? 0) - amount,
        updatedBy: context.user.id,
      });
      updatedBankIds.push(sourceBank.id);
    }

    if (destinationBank) {
      await writer.collection('bank_accounts').update(destinationBank.id, {
        balance: Number(destinationBank.balance ?? 0) + amount,
        updatedBy: context.user.id,
      });
      updatedBankIds.push(destinationBank.id);
    }

    const documentId = randomUUID();
    const transactionPayload = {
      customer: ledgerAccount.id,
      customerCode: Number(ledgerAccount.customerCode ?? 0),
      createdBy: context.user.id,
      updatedBy: context.user.id,
      transactionType: 'adjustment',
      status: 'final',
      isOpeningBalance: false,
      sourceKey: `bank-transfer:${documentId}`,
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

    const outgoing = await writer.collection('transactions').create({
      ...transactionPayload,
      documentNature: 'paid',
      rialAmount: -amount,
      documentDetails: JSON.stringify({
        ...JSON.parse(transactionPayload.documentDetails),
        side: 'outgoing',
      }),
    });
    createdTransactionIds.push(outgoing.id);

    const incoming = await writer.collection('transactions').create({
      ...transactionPayload,
      documentNature: 'received',
      rialAmount: amount,
      documentDetails: JSON.stringify({
        ...JSON.parse(transactionPayload.documentDetails),
        side: 'incoming',
      }),
    });
    createdTransactionIds.push(incoming.id);

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
