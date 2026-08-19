import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';

function text(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function positive(value: unknown) {
  const number = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function validDate(value: unknown) {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  const url = new URL(request.url);
  const status = text(url.searchParams.get('status'), 20);
  const filter = status
    ? context.pb.filter('status = {:status}', { status })
    : '';
  try {
    const checks = await context.pb.collection('checks').getFullList({
      filter,
      sort: 'due_date',
      expand: 'bank_account,customer',
    });
    return NextResponse.json({ checks });
  } catch {
    return NextResponse.json({ message: 'دریافت چک‌ها انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const bankAccount = text(body.bankAccount, 40);
  const customer = text(body.customer, 40);
  const checkNumber = text(body.checkNumber, 80);
  const dueDate = validDate(body.dueDate);
  const amount = positive(body.amount);
  const currency = text(body.currency, 16).toUpperCase() || 'IRR';
  if (!bankAccount || !customer || !checkNumber || !dueDate || amount === null) {
    return NextResponse.json({ message: 'حساب بانکی، طرف‌حساب، شماره چک، سررسید و مبلغ الزامی است.' }, { status: 400 });
  }
  try {
    const duplicate = await context.pb.collection('checks').getFirstListItem(
      context.pb.filter('check_number = {:checkNumber} && bank_account = {:bankAccount}', {
        checkNumber,
        bankAccount,
      }),
    ).catch(() => null);
    if (duplicate) return NextResponse.json({ message: 'این شماره چک برای حساب بانکی انتخاب‌شده قبلاً ثبت شده است.' }, { status: 409 });
    const record = await context.pb.collection('checks').create({
      bank_account: bankAccount,
      customer,
      check_number: checkNumber,
      due_date: dueDate,
      amount,
      currency,
      status: 'pending',
      description: text(body.description, 500),
      created_by: context.user.id,
    });
    return NextResponse.json({ check: record }, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'ثبت چک انجام نشد.' }, { status: 400 });
  }
}
