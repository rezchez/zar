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
import {
  getCustomerWithBalances,
  getCustomersWithBalances,
} from '@/lib/customer-service';
import { syncOpeningBalanceTransaction } from '@/lib/transaction-service';

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
      filter: 'is_deleted = false',
  });
  return Number(records.items[0]?.customerCode ?? 0) + 1;
}

function readCustomerCode(formData: FormData) {
  const mode = readFormValue(formData, 'customerCodeMode');
  if (mode !== 'manual') return null;

  const value = Number(readFormValue(formData, 'customerCode'));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('کد حساب دستی باید یک عدد صحیح بزرگ‌تر از صفر باشد.');
  }

  return value;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'customer.view') && !hasPermission(context.user, 'customer.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات مشتریان.' }, { status: 403 });
  }

  try {
    return NextResponse.json({
      customers: await getCustomersWithBalances(context.pb),
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

  if (!hasPermission(context.user, 'customer.create') && !hasPermission(context.user, 'customer.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت مشتری جدید.' }, { status: 403 });
  }

  const formData = await request.formData();
  const name = readFormValue(formData, 'name');
  if (name.length < 2 || name.length > 160) {
    return NextResponse.json({ message: 'نام طرف‌حساب باید حداقل ۲ حرف داشته باشد.' }, { status: 400 });
  }

  let requestedCode: number | null;
  try {
    requestedCode = readCustomerCode(formData);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'کد حساب معتبر نیست.' },
      { status: 400 },
    );
  }

  if (requestedCode !== null) {
    try {
      const existing = await context.pb.collection('customers').getFirstListItem(
        context.pb.filter('customerCode = {:customerCode}', {
          customerCode: requestedCode,
        }),
      );
      if (existing) {
        return NextResponse.json(
          { message: 'این کد حساب قبلاً استفاده شده است. کد دیگری وارد کنید.' },
          { status: 409 },
        );
      }
    } catch {
      // A not-found response is expected here.
    }
  }

  const openingBalances = readBalanceValues(formData);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const code = requestedCode ?? await nextCustomerCode(context);
      const record = await context.pb.collection('customers').create(
        buildPayload(formData, context.user.id, code),
      );
      const customer = (await getCustomerWithBalances(context.pb, record)).customer;
      try {
        await syncOpeningBalanceTransaction(
          context.pb,
          customer,
          openingBalances,
          context.user.id,
        );
      } catch {
        return NextResponse.json(
          {
            message:
              'طرف‌حساب ثبت شد، اما ثبت مانده اول دوره در دفتر تراکنش انجام نشد. لطفاً دوباره ذخیره کنید.',
            customer,
            transactionSyncFailed: true,
          },
          { status: 202 },
        );
      }

      const hydratedCustomer = (
        await getCustomerWithBalances(
          context.pb,
          await context.pb.collection('customers').getOne(record.id),
        )
      ).customer;

      await recordAuditEvent({
        userId: context.user.id,
        event: 'customer_created',
        request,
        details: `طرف‌حساب «${hydratedCustomer.name}» با کد ${hydratedCustomer.customerCode} ثبت شد.`,
        entityType: 'customer',
        entityId: hydratedCustomer.id,
        entityLabel: `${hydratedCustomer.customerCode} - ${hydratedCustomer.name}`,
        changes: buildCustomerChanges(null, hydratedCustomer),
        authenticatedClient: context.pb,
      });

      return NextResponse.json({ customer: hydratedCustomer }, { status: 201 });
    } catch {
      if (requestedCode !== null) {
        return NextResponse.json(
          { message: 'ثبت کد حساب انجام نشد؛ احتمالاً این کد هم‌زمان استفاده شده است.' },
          { status: 409 },
        );
      }
      if (attempt === 4) {
        return NextResponse.json({ message: 'ثبت طرف‌حساب انجام نشد. دوباره تلاش کنید.' }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ message: 'ثبت طرف‌حساب انجام نشد.' }, { status: 400 });
}
