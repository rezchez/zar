import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
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
    const existing = await writer.collection('bank_accounts').getOne(id);
    await writer.collection('bank_accounts').delete(id);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حساب بانکی ${existing.bankName} (${existing.accountNumber}) حذف شد.`,
      entityType: 'bank_account',
      entityId: id,
      entityLabel: `${existing.bankName} - ${existing.accountNumber}`,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ message: 'حساب بانکی با موفقیت حذف شد.' });
  } catch (error) {
    console.error('bank_account_delete_failed', error);
    return NextResponse.json({ message: 'حذف حساب بانکی انجام نشد.' }, { status: 400 });
  }
}
