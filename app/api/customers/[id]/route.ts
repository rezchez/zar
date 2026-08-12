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

function buildUpdatePayload(formData: FormData) {
  const payload = new FormData();
  for (const field of customerTextFields) payload.append(field, readFormValue(formData, field));
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
  if (avatar instanceof File && avatar.size > 0) payload.append('avatar', avatar, avatar.name);
  if (readFormValue(formData, 'removeAvatar') === 'true' && !(avatar instanceof File && avatar.size > 0)) {
    payload.append('avatar', '');
  }
  return payload;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });

  const { id } = await params;
  const formData = await request.formData();
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2 || name.length > 160) {
    return NextResponse.json({ message: 'نام طرف‌حساب معتبر نیست.' }, { status: 400 });
  }

  try {
    const record = await context.pb.collection('customers').update(id, buildUpdatePayload(formData));
    return NextResponse.json({ customer: mapCustomer(context.pb, record) });
  } catch {
    return NextResponse.json({ message: 'ویرایش طرف‌حساب انجام نشد.' }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    return NextResponse.json({ message: 'حذف طرف‌حساب فقط برای مدیر مجاز است.' }, { status: 403 });
  }

  try {
    await context.pb.collection('customers').delete((await params).id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: 'حذف طرف‌حساب انجام نشد.' }, { status: 400 });
  }
}
