import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { postOpeningChequeIssue } from '@/lib/accounting-posting-engine';
import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapBankAccount } from '@/lib/bank';
import { mapCheckRecord, type CheckStatus } from '@/lib/check';
import { ensureChecksCollection } from '@/lib/check-collection';
import { formatJalaliDate, jalaliDateToIso, normalizeDigits } from '@/lib/jalali';
import { parseLocalizedAmount } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function text(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function writerFor(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  if (!context) return null;
  try {
    return await getPocketBaseServiceClient();
  } catch {
    return context.pb;
  }
}

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const bankAccountId = text(url.searchParams.get('bankAccountId'), 40);

  let filter = 'is_opening_balance = true';
  if (bankAccountId) {
    filter += ` && bankAccount = "${bankAccountId}"`;
  }

  try {
    const service = await getPocketBaseServiceClient().catch(() => null);
    if (service) await ensureChecksCollection(service);

    const client = service || context.pb;
    const records = await client.collection('checks').getFullList({
      filter,
      sort: '-dueDate',
      expand: 'bankAccount,customer,created_by',
    }).catch(async () => {
      // Fallback in case is_opening_balance field isn't indexed yet
      return client.collection('checks').getFullList({
        sort: '-dueDate',
        expand: 'bankAccount,customer,created_by',
      }).catch(() => []);
    });

    const mapped = records
      .filter((r: Record<string, unknown>) => r.is_opening_balance === true || r.isOpeningBalance === true)
      .map(mapCheckRecord);

    // Calculate Summary Stats
    const totalCount = mapped.length;
    const totalAmount = mapped.reduce((sum, c) => sum + (c.amount || 0), 0);

    const outstandingStatuses: CheckStatus[] = ['issued', 'delivered', 'pending', 'due'];
    const outstandingChecks = mapped.filter((c) => outstandingStatuses.includes(c.status));
    const outstandingCount = outstandingChecks.length;
    const outstandingAmount = outstandingChecks.reduce((sum, c) => sum + (c.amount || 0), 0);

    // Breakdown by bank account
    const byBank: Record<string, { count: number; amount: number; outstandingCount: number; outstandingAmount: number }> = {};
    for (const c of mapped) {
      const bId = c.bankAccount || 'unknown';
      if (!byBank[bId]) {
        byBank[bId] = { count: 0, amount: 0, outstandingCount: 0, outstandingAmount: 0 };
      }
      byBank[bId].count += 1;
      byBank[bId].amount += c.amount || 0;
      if (outstandingStatuses.includes(c.status)) {
        byBank[bId].outstandingCount += 1;
        byBank[bId].outstandingAmount += c.amount || 0;
      }
    }

    return NextResponse.json({
      checks: mapped,
      summary: {
        totalCount,
        totalAmount,
        outstandingCount,
        outstandingAmount,
        byBank,
      },
    });
  } catch (error) {
    console.error('opening_checks_list_failed', error);
    return NextResponse.json({ message: 'دریافت لیست چک‌های افتتاحیه انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.create') && !hasPermission(context.user, 'bank.manage') && !hasPermission(context.user, 'bank.edit')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ثبت چک افتتاحیه.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const recordId = text(body?.id, 40);
  const bankAccountId = text(body?.bankAccount || body?.bankAccountId, 40);
  const customerId = text(body?.customer || body?.customerId, 40);
  const rawCheckNumber = text(body?.checkNumber || body?.sayadId, 80);
  const normalizedCheckNumber = normalizeDigits(rawCheckNumber).trim();
  const description = text(body?.description || body?.babat, 500);
  const dueDateJalali = text(body?.dueDateJalali, 20) || text(body?.dueDate, 20);
  const openingDateJalali = text(body?.openingBalanceDateJalali, 20) || text(body?.openingBalanceDate, 20) || text(body?.issueDateJalali, 20) || formatJalaliDate();
  const rawAmount = String(body?.amount ?? 0);
  const amount = parseLocalizedAmount(rawAmount);
  const rawStatus = text(body?.status, 20) || 'issued';

  // PART 11 — Status must strictly be 'issued' at opening registration
  if (rawStatus !== 'issued') {
    return NextResponse.json({
      message: 'وضعیت چک افتتاحیه در زمان ثبت فقط می‌تواند «صادرشده» (issued) باشد.',
    }, { status: 400 });
  }

  // PART 12 — Bank Account is strictly required
  if (!bankAccountId) {
    return NextResponse.json({ message: 'انتخاب حساب بانکی الزامی است.' }, { status: 400 });
  }

  // PART 16 — Check Number is strictly required
  if (!normalizedCheckNumber) {
    return NextResponse.json({ message: 'شماره چک الزامی است.' }, { status: 400 });
  }

  // PART 15 — Amount must be greater than zero
  if (amount <= 0) {
    return NextResponse.json({ message: 'مبلغ چک باید بیشتر از صفر باشد.' }, { status: 400 });
  }

  // PART 17 — Due date validation
  const dueDateIso = jalaliDateToIso(dueDateJalali);
  if (!dueDateIso) {
    return NextResponse.json({ message: 'تاریخ سررسید چک معتبر نیست.' }, { status: 400 });
  }

  const openingDateIso = jalaliDateToIso(openingDateJalali) || new Date().toISOString().slice(0, 10);

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureChecksCollection(writer);

    // PART 13 — Blocked Bank Account validation
    const rawBankAccount = await writer.collection('bank_accounts').getOne(bankAccountId, {
      expand: 'accountId,currency',
    }).catch(() => null);

    if (!rawBankAccount) {
      return NextResponse.json({ message: 'حساب بانکی انتخاب‌شده معتبر نیست.' }, { status: 404 });
    }

    if (rawBankAccount.isBlocked === true) {
      return NextResponse.json(
        {
          success: false,
          code: 'BANK_ACCOUNT_BLOCKED',
          message: 'این حساب بانکی مسدود است و امکان ثبت چک جدید برای آن وجود ندارد.',
        },
        { status: 409 },
      );
    }

    const bankAccount = mapBankAccount(rawBankAccount);

    // PART 14 — Currency synchronized with bank account
    const currency = bankAccount.currency || (typeof rawBankAccount.currency === 'string' ? rawBankAccount.currency : 'IRR');

    // PART 16 — Duplicate Check Number for the same bank account
    const duplicateCheck = await writer.collection('checks').getFirstListItem(
      writer.filter(
        'bankAccount = {:bankId} && (check_number = {:checkNo} || sayadId = {:checkNo})' + (recordId ? ' && id != {:recordId}' : ''),
        { bankId: bankAccount.id, checkNo: normalizedCheckNumber, recordId: recordId || '' },
      ),
    ).catch(() => null);

    if (duplicateCheck) {
      return NextResponse.json({
        message: 'این شماره چک قبلاً برای این حساب بانکی ثبت شده است.',
      }, { status: 409 });
    }

    // Resolve customer or party
    let resolvedCustomer: { id: string; name: string } | null = null;
    if (customerId) {
      const custRecord = await writer.collection('customers').getOne(customerId).catch(() => null);
      if (custRecord) {
        resolvedCustomer = { id: custRecord.id, name: custRecord.name };
      }
    }

    const documentId = text(body?.documentId, 80) || randomUUID();

    // customer relation must only point to valid customer record or be empty string/null
    const validCustomerId = resolvedCustomer?.id || (customerId && customerId !== bankAccount.id ? customerId : '');

    const checkPayload: Record<string, unknown> = {
      bankAccount: bankAccount.id,
      customer: validCustomerId || null,
      check_number: normalizedCheckNumber,
      checkNumber: normalizedCheckNumber,
      sayadId: normalizedCheckNumber,
      amount,
      currency,
      description: description || `موجودی اولیه چک صادرشده شماره ${normalizedCheckNumber}`,
      chequeType: 'payable',
      issueDate: openingDateIso,
      issueDateJalali: openingDateJalali,
      dueDate: dueDateIso,
      dueDateJalali,
      status: 'issued',
      is_opening_balance: true,
      opening_balance_date: openingDateIso,
      document: documentId,
      updated_by: context.user.id,
      updatedBy: context.user.id,
    };

    let checkRecord: Record<string, unknown>;
    if (recordId) {
      // Preserve original creator immutably on edit
      delete checkPayload.created_by;
      delete checkPayload.createdBy;
      checkRecord = await writer.collection('checks').update(recordId, checkPayload);
    } else {
      checkPayload.created_by = context.user.id;
      checkPayload.createdBy = context.user.id;
      checkRecord = await writer.collection('checks').create(checkPayload);
    }

    // PART 19 & 36 & 37 — Double-entry Opening Journal Integration
    // Debit 3100 (Opening Capital), Credit 2110 (Notes Payable)
    // NOTE: Does NOT create bank_transactions or deduct bank balance!
    let journalResult = null;
    try {
      journalResult = await postOpeningChequeIssue(
        {
          id: String(checkRecord.id),
          amount,
          checkNumber: normalizedCheckNumber,
          description: description || `موجودی اولیه چک صادرشده شماره ${normalizedCheckNumber}`,
          dueDateJalali,
          openingDateJalali,
          bankAccount: bankAccount.id,
          customer: resolvedCustomer?.id || null,
        },
        resolvedCustomer?.name || 'ذینفع اولیه',
        bankAccount,
        context.user.id,
        writer,
      );

      if (journalResult?.id) {
        await writer.collection('checks').update(String(checkRecord.id), {
          journalEntryId: journalResult.id,
        }).catch(() => undefined);
      }
    } catch (journalErr) {
      console.warn('opening_check_journal_warning', journalErr);
      // Non-fatal if chart of accounts is in baseline setup
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: recordId ? 'transaction_updated' : 'transaction_created',
      entityType: 'checks',
      entityId: String(checkRecord.id),
      changes: {
        action: recordId ? 'check.opening_updated' : 'check.opening_created',
        bankAccountId: bankAccount.id,
        checkNumber: normalizedCheckNumber,
        amount,
        currency,
        dueDateJalali,
      },
      authenticatedClient: writer,
    });

    const fullCheck = await writer.collection('checks').getOne(String(checkRecord.id), {
      expand: 'bankAccount,customer,created_by',
    }).catch(() => checkRecord);

    return NextResponse.json({
      success: true,
      check: mapCheckRecord(fullCheck),
      journalEntryId: journalResult?.id || null,
    }, { status: recordId ? 200 : 201 });
  } catch (error: any) {
    console.error('opening_check_save_failed', error);
    const detailMsg =
      error?.data?.message ||
      (error?.data?.data ? Object.values(error.data.data).map((e: any) => e.message || e).join(' - ') : null) ||
      error?.message ||
      'ثبت چک افتتاحیه با خطا مواجه شد.';
    return NextResponse.json({ message: detailMsg }, { status: error?.status || 500 });
  }
}

export async function DELETE(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.delete') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حذف چک.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const id = text(url.searchParams.get('id'), 40);
  if (!id) {
    return NextResponse.json({ message: 'شناسه چک مشخص نشده است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    const check = await writer.collection('checks').getOne(id).catch(() => null);
    if (!check) {
      return NextResponse.json({ message: 'چک یافت نشد.' }, { status: 404 });
    }

    // PART 26 & 27 — Cannot delete if check has transitioned past 'issued' (e.g. cleared or returned)
    if (check.status !== 'issued' && check.status !== 'draft') {
      return NextResponse.json({
        message: 'امکان حذف چک افتتاحیه وجود ندارد زیرا وارد چرخه تسویه مالی شده است (وضعیت فعلی: ' + check.status + ').',
      }, { status: 400 });
    }

    // Clean up opening journal entry if exists
    if (check.journalEntryId) {
      try {
        const lines = await writer.collection('journal_lines').getFullList({
          filter: writer.filter('journal_entry_id = {:jeId}', { jeId: check.journalEntryId }),
        }).catch(() => []);
        for (const line of lines) {
          await writer.collection('journal_lines').delete(line.id).catch(() => undefined);
        }
        await writer.collection('journal_entries').delete(String(check.journalEntryId)).catch(() => undefined);
      } catch {
        // proceed
      }
    }

    await writer.collection('checks').delete(id);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_deleted',
      entityType: 'checks',
      entityId: id,
      changes: {
        action: 'check.opening_deleted',
        bankAccountId: check.bankAccount,
        checkNumber: check.checkNumber || check.sayadId,
        amount: check.amount,
      },
      authenticatedClient: writer,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('opening_check_delete_failed', error);
    return NextResponse.json({ message: 'حذف چک با خطا مواجه شد.' }, { status: 500 });
  }
}
