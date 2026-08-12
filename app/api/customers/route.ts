import { NextResponse } from 'next/server';

import {
  customerDateFields,
  customerNumberFields,
  customerTextFields,
  mapCustomer,
} from '@/lib/customer';
import { getServerAuthContext } from '@/lib/auth';

function readFormValue(formData: FormData, field: string) {
  return String(formData.get(field) ?? '').trim();
}

function buildPayload(formData: FormData, ownerId: string, customerCode: number) {
  const payload = new FormData();
  payload.append('customerCode', String(customerCode));
  payload.append('createdBy', ownerId);

  for (const field of customerTextFields) {
    payload.append(field, readFormValue(formData, field));
  }
  for (const field of customerNumberFields) {
    const value = Number(readFormValue(formData, field) || 0);
    payload.append(field, Number.isFinite(value) ? String(value) : '0');
  }
  for (const field of customerDateFields) {
    const value = readFormValue(formData, field);
    if (value) payload.append(field, value);
  }
  payload.append('showBalanceByUnit', readFormValue(formData, 'showBalanceByUnit') === 'true' ? 'true' : 'false');

  const avatar = formData.get('avatar');
  if (avatar instanceof File && avatar.size > 0) {
    payload.append('avatar', avatar, avatar.name);
  }

  return payload;
}

async function nextCustomerCode(context: NonNullable<Awaited<ReturnType<typeof getServerAuthContext>>>) {
  const records = await context.pb.collection('customers').getList(1, 1, {
    sort: '-customerCode',
    fields: 'customerCode',
  });
  return Number(records.items[0]?.customerCode ?? 0) + 1;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const records = await context.pb.collection('customers').getFullList({
      sort: '-customerCode',
    });
    return NextResponse.json({
      customers: records.map((record) => mapCustomer(context.pb, record)),
    });
  } catch {
    return NextResponse.json({ message: 'دریافت طرف‌حساب‌ها انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const formData = await request.formData();
  const name = readFormValue(formData, 'name');
  if (name.length < 2 || name.length > 160) {
    return NextResponse.json({ message: 'نام طرف‌حساب باید حداقل ۲ حرف داشته باشد.' }, { status: 400 });
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const code = await nextCustomerCode(context);
      const record = await context.pb.collection('customers').create(
        buildPayload(formData, context.user.id, code),
      );
      return NextResponse.json({ customer: mapCustomer(context.pb, record) }, { status: 201 });
    } catch {
      if (attempt === 4) {
        return NextResponse.json({ message: 'ثبت طرف‌حساب انجام نشد. دوباره تلاش کنید.' }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ message: 'ثبت طرف‌حساب انجام نشد.' }, { status: 400 });
}
