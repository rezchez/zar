import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapBankAccount } from '@/lib/bank';
import { ensureBankAccountsCollection } from '@/lib/bank-collection';
import { parseLocalizedAmount } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

function text(value: unknown, max = 120) {
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه حساب بانکی الزامی است.' }, { status: 400 });
  }

  try {
    const record = await context.pb.collection('bank_accounts').getOne(id, {
      expand: 'accountId',
    });
    return NextResponse.json({ bank: mapBankAccount(record) });
  } catch {
    return NextResponse.json({ message: 'اطلاعات حساب بانکی یافت نشد.' }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه حساب بانکی الزامی است.' }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureBankAccountsCollection(writer);
    const existing = await writer.collection('bank_accounts').getOne(id);

    const updateData: Record<string, unknown> = {
      updatedBy: context.user.id,
    };

    if (body?.bankName !== undefined) updateData.bankName = text(body.bankName);
    if (body?.branchName !== undefined) updateData.branchName = text(body.branchName);
    if (body?.accountNumber !== undefined) updateData.accountNumber = text(body.accountNumber);
    if (body?.currency !== undefined) updateData.currency = text(body.currency).toUpperCase();
    if (body?.isActive !== undefined) updateData.isActive = Boolean(body.isActive);

    if (body?.accountId !== undefined) {
      const accountId = body.accountId ? text(body.accountId, 40) : null;
      if (accountId) {
        const coaRecord = await writer.collection('chart_of_accounts').getOne(accountId).catch(() => null);
        if (!coaRecord) {
          return NextResponse.json({ message: 'سرفصل حسابداری انتخاب‌شده در سیستم یافت نشد.' }, { status: 400 });
        }
        if (coaRecord.isActive === false) {
          return NextResponse.json({ message: 'سرفصل حسابداری انتخاب‌شده غیرفعال است.' }, { status: 400 });
        }
      }
      updateData.accountId = accountId;
    }

    const rawBalance = body?.currentBalance ?? body?.balance;
    if (rawBalance !== undefined) {
      const balanceVal = parseLocalizedAmount(String(rawBalance));
      if (balanceVal < 0) {
        return NextResponse.json({ message: 'موجودی نمی‌تواند منفی باشد.' }, { status: 400 });
      }
      updateData.balance = balanceVal;
      updateData.currentBalance = balanceVal;
    }

    await writer.collection('bank_accounts').update(id, updateData);

    const fullRecord = await writer.collection('bank_accounts').getOne(id, {
      expand: 'accountId',
    }).catch(() => existing);

    // Sync linked Chart of Accounts detail record if present
    if (fullRecord.accountId) {
      try {
        const effectiveBankName = fullRecord.bankName || existing.bankName;
        const effectiveBranch = fullRecord.branchName || existing.branchName;
        const effectiveAccNumber = fullRecord.accountNumber || existing.accountNumber;
        const updatedName = `بانک ${effectiveBankName}${effectiveBranch ? ' - ' + effectiveBranch : ''} (${effectiveAccNumber})`;
        const updatedDesc = `حساب بانکی تفصیلی مربوط به ${effectiveBankName} شماره حساب ${effectiveAccNumber}`;

        const coaUpdate: Record<string, unknown> = {
          name: updatedName,
          description: updatedDesc,
          updatedBy: context.user.id,
        };
        if (updateData.isActive !== undefined) {
          coaUpdate.isActive = updateData.isActive;
        }
        await writer.collection('chart_of_accounts').update(fullRecord.accountId, coaUpdate).catch(() => null);
      } catch {
        // silent catch
      }
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حساب بانکی ${existing.bankName} (${existing.accountNumber}) ویرایش شد.`,
      entityType: 'bank_account',
      entityId: id,
      entityLabel: `${fullRecord.bankName} - ${fullRecord.accountNumber}`,
      changes: updateData,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ bank: mapBankAccount(fullRecord) });
  } catch (error) {
    console.error('bank_account_update_failed', error);
    return NextResponse.json({ message: 'ویرایش حساب بانکی انجام نشد.' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.delete') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به حذف حساب بانکی.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه حساب بانکی الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureBankAccountsCollection(writer);

    // 1. بارگذاری حساب بانکی
    let existing: Record<string, unknown>;
    try {
      existing = await writer.collection('bank_accounts').getOne(id);
    } catch {
      return NextResponse.json({ message: 'حساب بانکی مورد نظر یافت نشد.' }, { status: 404 });
    }

    // 2. بررسی وجود تراکنش — شرط حذف: transaction_count === 0 (نه balance === 0)
    let transactionCount = 0;
    try {
      const txResult = await writer.collection('bank_transactions').getList(1, 1, {
        filter: writer.filter('bank_account = {:accountId}', { accountId: id }),
      });
      transactionCount += txResult.totalItems;
    } catch {
      // اگر collection bank_transactions وجود نداشت، صفر می‌ماند
    }

    // بررسی چک‌های صادرشده یا دریافت‌شده برای این حساب
    try {
      const checkResult = await writer.collection('checks').getList(1, 1, {
        filter: writer.filter('bankAccount = {:accountId}', { accountId: id }),
      });
      transactionCount += checkResult.totalItems;
    } catch {
      // silent
    }

    // بررسی اسناد و انتقالات مالی دارای این حساب در جزئیات
    try {
      const docResult = await writer.collection('transactions').getList(1, 1, {
        filter: writer.filter(
          '(documentDetails ~ {:accountId} || sourceKey ~ {:accountId}) && is_deleted = false',
          { accountId: id },
        ),
      });
      transactionCount += docResult.totalItems;
    } catch {
      // silent
    }

    if (transactionCount > 0) {
      // Audit log برای تلاش ناموفق
      await recordAuditEvent({
        userId: context.user.id,
        event: 'settings_updated',
        request,
        details: `تلاش برای حذف حساب بانکی ${String(existing.bankName || '')} (${String(existing.accountNumber || '')}) رد شد — ${transactionCount} تراکنش وجود دارد.`,
        entityType: 'bank_account',
        entityId: id,
        entityLabel: `${String(existing.bankName || '')} - ${String(existing.accountNumber || '')}`,
        changes: { action: 'bank_account.delete_rejected', reason: 'has_transactions', transactionCount, result: 'failed' },
        authenticatedClient: context.pb,
      }).catch(() => undefined);

      return NextResponse.json(
        {
          success: false,
          code: 'BANK_ACCOUNT_HAS_TRANSACTIONS',
          message: `این حساب بانکی قابل حذف نیست؛ برای این حساب ${transactionCount} تراکنش مالی ثبت شده است.`,
          transactionCount,
        },
        { status: 409 },
      );
    }

    // 3. حذف linked Chart of Accounts record اگر وجود داشت و بدون سند باشد
    const linkedAccountId = typeof existing.accountId === 'string' ? existing.accountId : null;
    if (linkedAccountId) {
      try {
        const journalLines = await writer.collection('journal_lines').getList(1, 1, {
          filter: writer.filter('accountId = {:accId}', { accId: linkedAccountId }),
        }).catch(() => ({ totalItems: 0 }));
        if (journalLines.totalItems === 0) {
          await writer.collection('chart_of_accounts').delete(linkedAccountId).catch(() => undefined);
        }
      } catch {
        // اگر حذف CoA ممکن نبود، حساب بدون آن حذف می‌شود
      }
    }

    // 4. حذف حساب بانکی
    await writer.collection('bank_accounts').delete(id);

    // 5. Audit log برای حذف موفق
    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حساب بانکی ${String(existing.bankName || '')} (${String(existing.accountNumber || '')}) حذف شد.`,
      entityType: 'bank_account',
      entityId: id,
      entityLabel: `${String(existing.bankName || '')} - ${String(existing.accountNumber || '')}`,
      changes: { action: 'bank_account.deleted', linkedAccountId, result: 'success' },
      authenticatedClient: context.pb,
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: 'حساب بانکی با موفقیت حذف شد.',
    });
  } catch (error) {
    console.error('bank_account_delete_failed', error);
    return NextResponse.json({ message: 'حذف حساب بانکی انجام نشد.' }, { status: 400 });
  }
}

