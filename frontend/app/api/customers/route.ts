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
import { getNextAutoCustomerCode } from '@/lib/account-code';
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
  const records = await context.pb.collection('customers').getFullList({
    fields: 'customerCode',
    filter: 'is_deleted = false',
  });
  const usedCodes = records
    .map((r) => Number(r.customerCode))
    .filter((c) => Number.isInteger(c) && c > 0);
  return getNextAutoCustomerCode(usedCodes);
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


const ALLOWED_PER_PAGE = [25, 50, 75, 100, 500];

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'customer.view') && !hasPermission(context.user, 'customer.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات مشتریان.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const rawPage = Number(url.searchParams.get('page') || 1);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

  const rawPerPage = Number(url.searchParams.get('perPage') || 25);
  const perPage = ALLOWED_PER_PAGE.includes(rawPerPage) ? rawPerPage : 25;

  const group = url.searchParams.get('group')?.trim() ?? '';
  const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();

  // If page is provided we do pagination, else we just return all (for backward compatibility if needed, but we should probably migrate all to pagination)
  const isPaginated = url.searchParams.has('page') || url.searchParams.has('perPage');

  if (!isPaginated && !q && !group) {
    try {
      const rawCustomers = await getCustomersWithBalances(context.pb);
      const sanitized = rawCustomers.map((c) => ({
        ...c,
        hasPrivateDescription: Boolean(c.privateDescription && c.privateDescription.trim().length > 0),
        privateDescription: '', // Stripped from general list payload for security
      }));

      return NextResponse.json({
        customers: sanitized,
      });
    } catch {
      return NextResponse.json({ message: 'دریافت طرف‌حساب‌ها انجام نشد.' }, { status: 500 });
    }
  }

  // Handle paginated request
  try {
    const { getPaginatedCustomersWithBalances } = await import('@/lib/customer-service');
    const result = await getPaginatedCustomersWithBalances(context.pb, page, perPage, q, group);

    const sanitized = result.customers.map((c: any) => ({
      ...c,
      hasPrivateDescription: Boolean(c.privateDescription && c.privateDescription.trim().length > 0),
      privateDescription: '',
    }));

    return NextResponse.json({
      customers: sanitized,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (err) {
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





  const englishName = readFormValue(formData, 'englishName');
  if (englishName && !/^[a-zA-Z\s]*$/.test(englishName)) {
    return NextResponse.json({ message: 'نام انگلیسی فقط باید شامل حروف انگلیسی و فاصله باشد.' }, { status: 400 });
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
