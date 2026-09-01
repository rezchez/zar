import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { createCurrency, DuplicateCurrencyError, getCurrencies } from '@/lib/currencies';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const currencies = await getCurrencies(context.pb);
    return NextResponse.json({ currencies });
  } catch {
    return NextResponse.json({ message: 'دریافت لیست ارزها انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  // Access Control: Only admin and manager can create currencies
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    return NextResponse.json(
      { message: 'فقط مدیران و ادمین سیستم مجاز به افزودن ارز جدید هستند.' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const name = String(body?.name ?? '').trim();
    const symbol = String(body?.symbol ?? '').trim();
    const code = String(body?.code ?? body?.symbol ?? '').trim().toUpperCase();
    const decimals = typeof body?.decimals === 'number' ? body.decimals : 2;

    if (!name || name.length < 1 || name.length > 100) {
      return NextResponse.json({ message: 'نام ارز الزامی است (بین ۱ تا ۱۰۰ کاراکتر).' }, { status: 400 });
    }

    if (!symbol || symbol.length < 1 || symbol.length > 30) {
      return NextResponse.json({ message: 'نماد ارز الزامی است (بین ۱ تا ۳۰ کاراکتر).' }, { status: 400 });
    }

    const created = await createCurrency(
      context.pb,
      { name, symbol, code: code || symbol, decimals },
      context.user.id,
    );

    return NextResponse.json({ currency: created }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateCurrencyError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }
    const msg = error instanceof Error ? error.message : 'ثبت ارز جدید انجام نشد.';
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
