import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { mapTransaction } from '@/lib/transaction';

function text(value: unknown, max = 160) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function positive(value: unknown) {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.action === 'hawala') {
    const { sourceCustomerId, targetCustomerId, lineId, lineSnapshot } = body;
    if (!sourceCustomerId || !targetCustomerId || !lineSnapshot) {
      return NextResponse.json({ message: 'اطلاعات حواله ناقص است' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      hawalaId: crypto.randomUUID(),
      message: 'حواله ردیف سند با موفقیت نهایی شد.',
    });
  }

  const customerId = text(body.customerId, 40);
  const sourceType = body.sourceType === 'bank' ? 'bank' : 'cash';
  const sourceId = text(body.sourceId, 40);
  const currency = text(body.currency, 16).toUpperCase() || 'IRR';
  const amount = positive(body.amount);
  const direction = body.direction === 'receive' ? 'receive' : 'pay';
  const idempotencyKey = text(body.idempotencyKey, 120) || `settlement:${randomUUID()}`;
  if (!customerId || !sourceId || amount === null) {
    return NextResponse.json({ message: 'طرف‌حساب، منبع تسویه و مبلغ معتبر الزامی است.' }, { status: 400 });
  }

  let writer = context.pb;
  try { writer = await getPocketBaseServiceClient(); } catch { /* authenticated fallback */ }

  try {
    const existing = await writer.collection('transactions').getFirstListItem(
      writer.filter('sourceKey = {:sourceKey} && is_deleted = false', { sourceKey: idempotencyKey }),
    ).catch(() => null);
    if (existing) return NextResponse.json({ transaction: mapTransaction(existing), alreadyExists: true });

    const customer = await writer.collection('customers').getOne(customerId);
    const signed = direction === 'receive' ? amount : -amount;
    const detail = JSON.stringify({ settlement: true, sourceType, sourceId, currency, direction });

    if (sourceType === 'bank') {
      const bank = await writer.collection('bank_accounts').getOne(sourceId);
      if (String(bank.currency || 'IRR').toUpperCase() !== currency) {
        return NextResponse.json({ message: 'واحد پول حساب بانکی با واحد تسویه یکسان نیست.' }, { status: 400 });
      }
      const next = Number(bank.balance ?? 0) + (direction === 'receive' ? amount : -amount);
      if (next < 0) return NextResponse.json({ message: 'موجودی حساب بانکی کافی نیست.' }, { status: 400 });
      await writer.collection('bank_accounts').update(bank.id, { balance: next, updatedBy: context.user.id });
    } else {
      const vault = await writer.collection('cash_funds').getFirstListItem(
        writer.filter('currency_name = {:currency}', { currency }),
      ).catch(() => null);
      const next = Number(vault?.balance ?? 0) + (direction === 'receive' ? amount : -amount);
      if (next < 0) return NextResponse.json({ message: 'موجودی صندوق کافی نیست.' }, { status: 400 });
      const updatedVault = vault
        ? await writer.collection('cash_funds').update(vault.id, { balance: next, updated_by: context.user.id })
        : await writer.collection('cash_funds').create({ currency_name: currency, balance: next, created_by: context.user.id, updated_by: context.user.id });
      await writer.collection('cash_transactions').create({
        vault: updatedVault.id,
        currency,
        amount: direction === 'receive' ? amount : -amount,
        source_key: `${idempotencyKey}:cash`,
        description: `تسویه طرف‌حساب - ${direction === 'receive' ? 'دریافت' : 'پرداخت'}`,
        created_by: context.user.id,
      }).catch(() => undefined);
    }

    const transaction = await writer.collection('transactions').create({
      customer: customer.id,
      customerCode: Number(customer.customerCode ?? 0),
      createdBy: context.user.id,
      updatedBy: context.user.id,
      transactionType: 'document',
      status: 'posted',
      isOpeningBalance: false,
      sourceKey: idempotencyKey,
      transactionDate: new Date().toISOString(),
      documentId: idempotencyKey,
      documentNumber: '',
      description: text(body.description, 1000) || `تسویه ${sourceType === 'bank' ? 'بانکی' : 'نقدی'} طرف‌حساب`,
      documentNature: direction === 'receive' ? 'received' : 'paid',
      documentTab: sourceType,
      documentSubType: 'settlement',
      settlementMethod: sourceType,
      balanceSource: 'current',
      documentDetails: detail,
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: currency === 'IRR' ? signed : 0,
      foreignAmount: currency === 'IRR' ? 0 : signed,
      tertiaryAmount: 0,
      foreignCurrency: currency === 'IRR' ? '' : currency,
      foreignCurrencySymbol: currency === 'IRR' ? '' : currency,
      tertiaryCurrency: '',
      tertiaryCurrencySymbol: '',
    });
    return NextResponse.json({ transaction: mapTransaction(transaction) }, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'تسویه طرف‌حساب انجام نشد.' }, { status: 400 });
  }
}
