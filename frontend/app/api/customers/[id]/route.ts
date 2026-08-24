import { NextResponse } from 'next/server';

import {
  customerDateFields,
  emptyCustomerBalances,
  customerNumberFields,
  customerTextFields,
  type CustomerBalanceValues,
} from '@/lib/customer';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { recordAuditEvent } from '@/lib/audit';
import { buildCustomerChanges } from '@/lib/customer-audit';
import { getCustomerWithBalances } from '@/lib/customer-service';
import {
  syncCustomerCodeInTransactions,
  syncOpeningBalanceTransaction,
} from '@/lib/transaction-service';

function readFormValue(formData: FormData, field: string) {
  return String(formData.get(field) ?? '').trim();
}

function readBalanceValues(formData: FormData): CustomerBalanceValues {
  const balances = emptyCustomerBalances();
  for (const field of Object.keys(balances) as Array<keyof CustomerBalanceValues>) {
    const value = Number(readFormValue(formData, field) || 0);
    balances[field] = Number.isFinite(value) ? value : 0;
  }
  return balances;
}

function readCustomerCode(formData: FormData) {
  const value = Number(readFormValue(formData, 'customerCode'));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('کد حساب باید یک عدد صحیح بزرگ‌تر از صفر باشد.');
  }
  return value;
}

function buildUpdatePayload(formData: FormData, customerCode: number) {
  const payload = new FormData();
  payload.append('customerCode', String(customerCode));
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

  if (!hasPermission(context.user, 'customer.edit') && !hasPermission(context.user, 'customer.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ویرایش طرف‌حساب.' }, { status: 403 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 2 || name.length > 160) {
    return NextResponse.json({ message: 'نام طرف‌حساب معتبر نیست.' }, { status: 400 });
  }

  try {
    const beforeRecord = await context.pb.collection('customers').getOne(id);
    const before = (await getCustomerWithBalances(context.pb, beforeRecord)).customer;
    let customerCode: number;
    try {
      customerCode = readCustomerCode(formData);
    } catch (error) {
      return NextResponse.json(
        { message: error instanceof Error ? error.message : 'کد حساب معتبر نیست.' },
        { status: 400 },
      );
    }

    if (customerCode !== before.customerCode) {
      try {
        const duplicate = await context.pb.collection('customers').getFirstListItem(
          context.pb.filter(
            'customerCode = {:customerCode} && id != {:customerId}',
            { customerCode, customerId: id },
          ),
        );
        if (duplicate) {
          return NextResponse.json(
            { message: 'این کد حساب قبلاً برای طرف‌حساب دیگری ثبت شده است.' },
            { status: 409 },
          );
        }
      } catch {
        // A not-found response is expected here.
      }
    }

    const openingBalances = readBalanceValues(formData);
    const record = await context.pb.collection('customers').update(
      id,
      buildUpdatePayload(formData, customerCode),
    );
    let customer = (await getCustomerWithBalances(context.pb, record)).customer;
    try {
      await syncOpeningBalanceTransaction(
        context.pb,
        customer,
        openingBalances,
        context.user.id,
      );
      await syncCustomerCodeInTransactions(context.pb, id, customerCode);
    } catch {
      try {
        await context.pb.collection('customers').update(id, {
          customerCode: before.customerCode,
        });
        await syncOpeningBalanceTransaction(
          context.pb,
          before,
          before.openingBalances,
          context.user.id,
        );
        await syncCustomerCodeInTransactions(context.pb, id, before.customerCode);
      } catch {
        // Fallback
      }
      return NextResponse.json(
        {
          message:
            'اطلاعات طرف‌حساب ذخیره نشد چون همگام‌سازی دفتر تراکنش کامل نشد. دوباره تلاش کنید.',
          customer: before,
          transactionSyncFailed: true,
        },
        { status: 409 },
      );
    }

    const finalRecord = await context.pb.collection('customers').getOne(id);
    customer = (
      await getCustomerWithBalances(context.pb, finalRecord)
    ).customer;

    await recordAuditEvent({
      userId: context.user.id,
      event: 'customer_updated',
      request,
      details: `اطلاعات طرف‌حساب «${customer.name}» ویرایش شد.`,
      entityType: 'customer',
      entityId: customer.id,
      entityLabel: `${customer.customerCode} - ${customer.name}`,
      changes: buildCustomerChanges(before, customer),
      authenticatedClient: context.pb,
    });

    // Strip private notes for standard returned object in edit to ensure it doesn't leak unintentionally over API
    customer.privateDescription = '';

    return NextResponse.json({ customer });
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

  if (!hasPermission(context.user, 'customer.delete') && !hasPermission(context.user, 'customer.manage')) {
    return NextResponse.json({ message: 'حذف طرف‌حساب نیاز به مجوز مربوطه دارد.' }, { status: 403 });
  }

  try {
    const id = (await params).id;
    const record = await context.pb.collection('customers').getOne(id);
    const customer = (await getCustomerWithBalances(context.pb, record)).customer;
    await context.pb.collection('customers').update(id, {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: context.user.id,
    });
    await recordAuditEvent({
      userId: context.user.id,
      event: 'customer_deleted',
      request: _request,
      details: `طرف‌حساب «${customer.name}» حذف شد.`,
      entityType: 'customer',
      entityId: customer.id,
      entityLabel: `${customer.customerCode} - ${customer.name}`,
      changes: buildCustomerChanges(customer, null),
      authenticatedClient: context.pb,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: 'حذف طرف‌حساب انجام نشد.' }, { status: 400 });
  }
}
