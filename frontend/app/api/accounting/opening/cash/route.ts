import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات صندوق.' }, { status: 403 });
  }

  try {
    const records = await context.pb.collection('cash_funds').getFullList({
      sort: '-created',
      expand: 'currency',
    }).catch(() => []);

    return NextResponse.json({
      funds: records.map((r) => ({
        id: r.id,
        currencyId: String(r.currency || r.currency_id || ''),
        currencyName: String(r.expand?.currency?.name || r.currency_name || ''),
        currencyCode: String(r.expand?.currency?.code || ''),
        currencySymbol: String(r.expand?.currency?.symbol || ''),
        balance: Number(r.balance ?? 0),
        openingBalance: Number(r.opening_balance ?? 0),
        created: r.created,
        updated: r.updated,
      })),
    });
  } catch {
    return NextResponse.json({ message: 'دریافت موجودی‌ها انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }
  if (!hasPermission(context.user, 'cash.create') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت موجودی صندوق.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const requestedCurrencyId = String(body?.currencyId ?? '').trim();
    const rawAmount = Number(String(body?.amount ?? '').replace(/,/g, ''));
    const description = String(body?.description ?? '').trim();

    if (!requestedCurrencyId) {
      return NextResponse.json({ message: 'انتخاب ارز الزامی است.' }, { status: 400 });
    }

    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return NextResponse.json({ message: 'مبلغ موجودی اولیه باید عددی مثبت باشد.' }, { status: 400 });
    }
    const amount = Math.round(rawAmount);

    // The persisted currency ID is authoritative; names/codes supplied by the
    // client must never create a cash fund for an unknown currency.
    let currencyRecord: Record<string, any>;
    try {
      currencyRecord = await context.pb.collection('currencies').getOne(requestedCurrencyId);
    } catch {
      return NextResponse.json({ message: 'ارز انتخاب‌شده در کالکشن ارزها یافت نشد.' }, { status: 400 });
    }

    const currencyName = String(currencyRecord.name || currencyRecord.code).trim();
    const currencyCode = String(currencyRecord.code || currencyName).trim().toUpperCase();
    const currencySymbol = String(currencyRecord.symbol || currencyCode).trim();

    // Idempotent sourceKey
    const sourceKey = `opening:cash:${currencyRecord.id}`;

    // Read both records before changing either one. This lets an edited
    // opening balance preserve later cash movements instead of resetting the
    // fund to the opening amount.
    const existingFund = await context.pb.collection('cash_funds').getFirstListItem(
      context.pb.filter('currency = {:currencyId}', { currencyId: currencyRecord.id }),
    ).catch(async () => context.pb.collection('cash_funds').getFirstListItem(
      context.pb.filter('currency_name = {:currency}', { currency: currencyName }),
    ).catch(() => null));

    const existingTx = await context.pb.collection('cash_transactions').getFirstListItem(
      context.pb.filter('source_key = {:sourceKey}', { sourceKey }),
    ).catch(() => null);
    const hasPriorOpening = Boolean(
      existingTx
      || (existingFund && existingFund.opening_balance !== undefined && existingFund.opening_balance !== null),
    );
    const previousOpening = Number(existingFund?.opening_balance ?? existingTx?.amount ?? 0);
    const currentBalance = Number(existingFund?.balance ?? 0);
    const nextBalance = existingFund
      ? (hasPriorOpening ? currentBalance - previousOpening + amount : amount)
      : amount;
    if (nextBalance < 0) {
      return NextResponse.json({ message: 'موجودی صندوق نمی‌تواند منفی شود.' }, { status: 400 });
    }

    const fundPayload = {
      currency: currencyRecord.id,
      currency_name: currencyName,
      opening_balance: amount,
      balance: nextBalance,
      updated_by: context.user.id,
    };

    const fund = existingFund
      ? await context.pb.collection('cash_funds').update(existingFund.id, fundPayload)
      : await context.pb.collection('cash_funds').create({
          ...fundPayload,
          created_by: context.user.id,
        });

    if (!fund) {
      throw new Error('ایجاد موجودی صندوق انجام نشد.');
    }

    try {
      const transactionPayload = {
        vault: fund.id,
        currency: currencyCode,
        currency_name: currencyName,
        currency_symbol: currencySymbol,
        currency_ref: currencyRecord.id,
        amount,
        source_key: sourceKey,
        transaction_type: 'opening_balance',
        is_opening_balance: true,
        description: description || `موجودی اول دوره صندوق - ${currencySymbol}`,
        created_by: context.user.id,
      };
      if (existingTx) {
        await context.pb.collection('cash_transactions').update(existingTx.id, transactionPayload);
      } else {
        await context.pb.collection('cash_transactions').create(transactionPayload);
      }
    } catch (transactionError) {
      // Do not leave a fund whose opening row was not persisted.
      if (existingFund) {
        await context.pb.collection('cash_funds').update(existingFund.id, {
          currency: existingFund.currency,
          currency_name: existingFund.currency_name,
          opening_balance: existingFund.opening_balance,
          balance: existingFund.balance,
          updated_by: existingFund.updated_by,
        }).catch(() => undefined);
      } else {
        await context.pb.collection('cash_funds').delete(fund.id).catch(() => undefined);
      }
      throw transactionError;
    }

    return NextResponse.json({
      success: true,
      fund: {
        id: fund.id,
        currencyName,
        currencyCode,
        currencySymbol,
        balance: Number(fund.balance ?? amount),
        openingBalance: amount,
      },
    }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'ثبت موجودی اولیه انجام نشد.';
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
