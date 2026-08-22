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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.edit') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به ویرایش حساب بانکی.' }, { status: 403 });
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

    const rawBalance = body?.currentBalance ?? body?.balance;
    if (rawBalance !== undefined) {
      const balanceVal = parseLocalizedAmount(String(rawBalance));
      if (balanceVal < 0) {
        return NextResponse.json({ message: 'موجودی نمی‌تواند منفی باشد.' }, { status: 400 });
      }
      updateData.balance = balanceVal;
      updateData.currentBalance = balanceVal;
    }

    const updated = await writer.collection('bank_accounts').update(id, updateData);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `حساب بانکی ${existing.bankName} (${existing.accountNumber}) ویرایش شد.`,
      entityType: 'bank_account',
      entityId: id,
      entityLabel: `${updated.bankName} - ${updated.accountNumber}`,
      changes: updateData,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({ bank: mapBankAccount(updated) });
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
