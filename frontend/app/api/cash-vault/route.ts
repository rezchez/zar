import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';

function amount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });

  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات صندوق.' }, { status: 403 });
  }

  const vaults = await context.pb.collection('cash_funds').getFullList({ sort: 'currency_name', expand: 'currency' }).catch(async () =>
    context.pb.collection('cash_vaults').getFullList({ sort: 'currency' }).catch(() => []),
  );
  return NextResponse.json({
    vaults: vaults.map((vault: any) => ({
      ...vault,
      id: vault.id,
      name: String(vault.name || `صندوق ${vault.expand?.currency?.name || vault.currency_name || ''}`).trim(),
      currencyId: String(vault.currency || vault.currency_id || ''),
      currencyName: String(vault.expand?.currency?.name || vault.currency_name || ''),
      currencyCode: String(vault.expand?.currency?.code || ''),
      currencySymbol: String(vault.expand?.currency?.symbol || vault.currency_symbol || ''),
      balance: Number(vault.balance ?? 0),
      openingBalance: Number(vault.opening_balance ?? 0),
    })),
  });
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });

  if (!hasPermission(context.user, 'cash.create') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ایجاد تراکنش صندوق.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const requestedCurrencyId = String(body.currencyId ?? '').trim();
  const requestedCurrency = String(body.currency ?? '').trim();
  const value = amount(body.amount);
  const direction = body.direction === 'out' ? -1 : 1;
  const sourceKey = String(body.sourceKey ?? '').trim().slice(0, 120);
  if ((!requestedCurrencyId && !requestedCurrency) || value === null) {
    return NextResponse.json({ message: 'واحد ارز و مبلغ معتبر الزامی است.' }, { status: 400 });
  }
  try {
    const currencyRecord = requestedCurrencyId
      ? await context.pb.collection('currencies').getOne(requestedCurrencyId).catch(() => null)
      : await context.pb.collection('currencies').getFirstListItem(
        context.pb.filter('code = {:code} || name = {:name}', {
          code: requestedCurrency.toUpperCase(),
          name: requestedCurrency,
        }),
      ).catch(() => null);
    if (!currencyRecord) {
      return NextResponse.json({ message: 'ارز انتخاب‌شده در کالکشن ارزها یافت نشد.' }, { status: 400 });
    }
    const currencyName = String(currencyRecord.name || currencyRecord.code).trim();
    const currencyCode = String(currencyRecord.code || currencyName).trim().toUpperCase();
    const currencySymbol = String(currencyRecord.symbol || currencyCode).trim();

    const collection = context.pb.collection('cash_funds');
    if (sourceKey) {
      const existingTransaction = await context.pb.collection('cash_transactions').getFirstListItem(
        context.pb.filter('source_key = {:sourceKey}', { sourceKey }),
      ).catch(() => null);
      if (existingTransaction) return NextResponse.json({ alreadyExists: true, transaction: existingTransaction });
    }
    const vault = await collection.getFirstListItem(
      context.pb.filter('currency = {:currencyId}', { currencyId: currencyRecord.id }),
    ).catch(async () => collection.getFirstListItem(
      context.pb.filter('currency_name = {:currency}', { currency: currencyName }),
    ).catch(() => null));

    if (!vault) {
      return NextResponse.json({ message: 'صندوقی برای این ارز یافت نشد. ابتدا صندوق اولیه را ایجاد کنید.' }, { status: 400 });
    }

    const balance = Number(vault.balance ?? 0) + direction * value;
    if (balance < 0) return NextResponse.json({ message: 'موجودی صندوق کافی نیست.' }, { status: 400 });
    const payload = {
      currency: currencyRecord.id,
      currency_name: currencyName,
      balance,
      updated_by: context.user.id,
    };
    const record = await collection.update(vault.id, payload);
    await context.pb.collection('cash_transactions').create({
      currency: currencyCode,
      currency_name: currencyName,
      currency_symbol: currencySymbol,
      currency_ref: currencyRecord.id,
      amount: direction * value,
      transaction_type: direction < 0 ? 'cash_out' : 'cash_in',
      is_opening_balance: false,
      description: direction < 0 ? `پرداخت وجه نقد - ${currencySymbol}` : `دریافت وجه نقد - ${currencySymbol}`,
      created_by: context.user.id,
      vault: record.id,
      source_key: sourceKey,
    });
    return NextResponse.json({
      vault: { ...record, currencyCode, currencyName, currencySymbol },
    }, { status: 200 });
  } catch {
    return NextResponse.json({ message: 'ثبت تراکنش صندوق انجام نشد.' }, { status: 400 });
  }
}
