import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';

function amount(value: unknown) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  const vaults = await context.pb.collection('cash_funds').getFullList({ sort: 'currency_name' }).catch(async () =>
    context.pb.collection('cash_vaults').getFullList({ sort: 'currency' }).catch(() => []),
  );
  return NextResponse.json({ vaults });
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const currency = String(body.currency ?? '').trim().slice(0, 12).toUpperCase();
  const value = amount(body.amount);
  const direction = body.direction === 'out' ? -1 : 1;
  const sourceKey = String(body.sourceKey ?? '').trim().slice(0, 120);
  if (!currency || value === null) return NextResponse.json({ message: 'واحد ارز و مبلغ معتبر الزامی است.' }, { status: 400 });
  try {
    const collection = context.pb.collection('cash_funds');
    if (sourceKey) {
      const existingTransaction = await context.pb.collection('cash_transactions').getFirstListItem(
        context.pb.filter('source_key = {:sourceKey}', { sourceKey }),
      ).catch(() => null);
      if (existingTransaction) return NextResponse.json({ alreadyExists: true, transaction: existingTransaction });
    }
    const vault = await collection.getFirstListItem(context.pb.filter('currency_name = {:currency}', { currency })).catch(() => null);
    const balance = Number(vault?.balance ?? 0) + direction * value;
    if (balance < 0) return NextResponse.json({ message: 'موجودی صندوق کافی نیست.' }, { status: 400 });
    const payload = { currency_name: currency, balance, updated_by: context.user.id };
    const record = vault ? await collection.update(vault.id, payload) : await collection.create({ ...payload, created_by: context.user.id });
    await context.pb.collection('cash_transactions').create({
      currency,
      amount: direction * value,
      description: direction < 0 ? `پرداخت وجه نقد - ${currency}` : `دریافت وجه نقد - ${currency}`,
      created_by: context.user.id,
      vault: record.id,
      source_key: sourceKey,
    }).catch(() => undefined);
    return NextResponse.json({ vault: record }, { status: vault ? 200 : 201 });
  } catch {
    return NextResponse.json({ message: 'ثبت تراکنش صندوق انجام نشد.' }, { status: 400 });
  }
}
