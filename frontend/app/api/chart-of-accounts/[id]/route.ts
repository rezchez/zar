import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization/authorize';
import {
  canDeleteAccount,
  canEditAccount,
  validateAccountCode,
  wouldCreateCycle,
  computeAccountPath,
  normalizeAccountCode,
  type ChartOfAccountRecord,
  type AccountType,
  type NormalBalance,
  type AccountLevel,
} from '@/lib/chart-of-accounts';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const r = await context.pb.collection('chart_of_accounts').getOne(id);
    return NextResponse.json({
      account: {
        id: r.id,
        code: r.code,
        name: r.name,
        parentId: r.parentId || null,
        path: r.path || `/${r.code}/`,
        level: Number(r.level || 1) as AccountLevel,
        accountType: (r.accountType || 'asset') as AccountType,
        normalBalance: (r.normalBalance || 'debit') as NormalBalance,
        requiresWeight: Boolean(r.requiresWeight),
        isMultiCurrency: Boolean(r.isMultiCurrency),
        isSystem: Boolean(r.isSystem),
        isActive: r.isActive !== false,
        isPostable: Boolean(r.isPostable),
        sortOrder: Number(r.sortOrder || 0),
        description: r.description || '',
        tags: Array.isArray(r.tags) ? r.tags : [],
        createdBy: r.createdBy || null,
        updatedBy: r.updatedBy || null,
        created: r.created,
        updated: r.updated,
      },
    });
  } catch (error) {
    return NextResponse.json({ message: 'سرفصل حسابداری مورد نظر یافت نشد.' }, { status: 404 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const allowed =
    hasPermission(context.user, 'settings.edit') ||
    context.user.role === 'admin' ||
    context.user.role === 'manager';
  if (!allowed) {
    return NextResponse.json(
      { message: 'شما مجوز لازم برای ویرایش سرفصل حسابداری را ندارید.' },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const existing = await context.pb.collection('chart_of_accounts').getOne(id);
    if (!existing) {
      return NextResponse.json({ message: 'سرفصل حسابداری یافت نشد.' }, { status: 404 });
    }

    const currentAccount: ChartOfAccountRecord = {
      id: existing.id,
      code: existing.code,
      name: existing.name,
      parentId: existing.parentId || null,
      path: existing.path,
      level: Number(existing.level || 1) as AccountLevel,
      accountType: existing.accountType as AccountType,
      normalBalance: existing.normalBalance as NormalBalance,
      isSystem: Boolean(existing.isSystem),
      isActive: existing.isActive !== false,
      isPostable: Boolean(existing.isPostable),
    };

    const editPermissions = canEditAccount(currentAccount);
    const body = await request.json();

    // Fetch all accounts for relationship / path / cycle validations
    const allRecords = await context.pb.collection('chart_of_accounts').getFullList();
    const allAccounts: ChartOfAccountRecord[] = allRecords.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      parentId: r.parentId || null,
      path: r.path,
      level: Number(r.level || 1) as AccountLevel,
      accountType: r.accountType as AccountType,
      normalBalance: r.normalBalance as NormalBalance,
      isSystem: Boolean(r.isSystem),
      isActive: r.isActive !== false,
    }));
    const accountsMap = new Map<string, ChartOfAccountRecord>(allAccounts.map((a) => [a.id, a]));

    const updatePayload: Record<string, any> = {};

    // 1. Name update
    if (body.name !== undefined) {
      const newName = String(body.name).trim();
      if (!newName || newName.length < 2 || newName.length > 200) {
        return NextResponse.json({ message: 'نام حساب باید بین ۲ تا ۲۰۰ کاراکتر باشد.' }, { status: 400 });
      }
      if (!editPermissions.canEditName && newName !== currentAccount.name) {
        return NextResponse.json(
          { message: editPermissions.reason || 'امکان تغییر نام برای این سرفصل سیستمی وجود ندارد.' },
          { status: 400 },
        );
      }
      updatePayload.name = newName;
    }

    // 2. Active status update
    if (body.isActive !== undefined) {
      const newActive = Boolean(body.isActive);
      if (!editPermissions.canToggleActive && newActive !== currentAccount.isActive) {
        return NextResponse.json(
          { message: editPermissions.reason || 'امکان غیرفعال‌سازی سرفصل‌های ریشه سیستم وجود ندارد.' },
          { status: 400 },
        );
      }
      updatePayload.isActive = newActive;
    }

    // 3. Description, tags, flags, sortOrder
    if (body.description !== undefined) {
      updatePayload.description = body.description ? String(body.description).trim() : null;
    }
    if (body.tags !== undefined) {
      updatePayload.tags = Array.isArray(body.tags) ? body.tags : [];
    }
    if (body.requiresWeight !== undefined) {
      updatePayload.requiresWeight = Boolean(body.requiresWeight);
    }
    if (body.isMultiCurrency !== undefined) {
      updatePayload.isMultiCurrency = Boolean(body.isMultiCurrency);
    }
    if (body.isPostable !== undefined) {
      if (currentAccount.level === 1 && body.isPostable) {
        return NextResponse.json({ message: 'سرفصل‌های سطح ۱ (گروه) مجاز به گردش مستقیم و ثبت سند نیستند.' }, { status: 400 });
      }
      updatePayload.isPostable = Boolean(body.isPostable);
    }
    if (body.sortOrder !== undefined) {
      updatePayload.sortOrder = Number(body.sortOrder || 0);
    }

    // 4. Code update
    let targetCode = currentAccount.code;
    if (body.code !== undefined && normalizeAccountCode(body.code) !== currentAccount.code) {
      if (!editPermissions.canEditCode) {
        return NextResponse.json(
          { message: editPermissions.reason || 'کد سرفصل‌های سیستمی غیرقابل تغییر است.' },
          { status: 400 },
        );
      }

      const newCode = normalizeAccountCode(body.code);
      const parentAcc = currentAccount.parentId ? accountsMap.get(currentAccount.parentId) : undefined;
      const codeValidation = validateAccountCode(newCode, parentAcc ? parentAcc.code : null, currentAccount.level);
      if (!codeValidation.valid) {
        return NextResponse.json({ message: codeValidation.error || 'کد حساب نامعتبر است.' }, { status: 400 });
      }

      // Check collision
      const codeCollision = allAccounts.some((a) => a.id !== currentAccount.id && a.code === newCode);
      if (codeCollision) {
        return NextResponse.json({ message: `کد حساب "${newCode}" قبلاً استفاده شده است.` }, { status: 409 });
      }

      targetCode = newCode;
      updatePayload.code = newCode;
    }

    // 5. Parent change (Hierarchy Reparenting)
    let newParentId = currentAccount.parentId;
    let parentChanged = false;
    if (body.parentId !== undefined) {
      const requestedParentId = body.parentId ? String(body.parentId).trim() : null;
      if (requestedParentId !== currentAccount.parentId) {
        if (currentAccount.isSystem && currentAccount.level <= 2) {
          return NextResponse.json({ message: 'سلسله‌مراتب سرفصل‌های سیستمی اصلی غیرقابل جابجایی است.' }, { status: 400 });
        }

        // Cycle check
        if (wouldCreateCycle(currentAccount.id, requestedParentId, allAccounts)) {
          return NextResponse.json(
            { message: 'تغییر والد منجر به ایجاد چرخه در درختواره حسابداری می‌شود (یک حساب نمی‌تواند والدِ والد خود شود).' },
            { status: 400 },
          );
        }

        let newParentAcc: ChartOfAccountRecord | undefined;
        if (requestedParentId) {
          newParentAcc = accountsMap.get(requestedParentId);
          if (!newParentAcc) {
            return NextResponse.json({ message: 'والد جدید انتخابی یافت نشد.' }, { status: 400 });
          }
          updatePayload.level = (newParentAcc.level + 1) as AccountLevel;
          updatePayload.accountType = newParentAcc.accountType;
          updatePayload.normalBalance = newParentAcc.normalBalance;
        } else {
          updatePayload.level = 1;
        }

        newParentId = requestedParentId;
        updatePayload.parentId = requestedParentId;
        parentChanged = true;
      }
    }

    // If code or parent changed, recompute path and cascade to descendants
    if (targetCode !== currentAccount.code || parentChanged) {
      const updatedPath = computeAccountPath(
        { code: targetCode, parentId: newParentId },
        accountsMap,
      );
      updatePayload.path = updatedPath;
    }

    updatePayload.updatedBy = context.user.id;

    const updatedRecord = await context.pb.collection('chart_of_accounts').update(id, updatePayload);

    // If path changed, cascade update to all child accounts in background
    if (updatePayload.path && updatePayload.path !== currentAccount.path) {
      Promise.resolve().then(async () => {
        try {
          const freshList = (await context.pb.collection('chart_of_accounts').getFullList()) as any[];
          const freshMap = new Map<string, ChartOfAccountRecord>(
            freshList.map((r: any) => [
              String(r.id),
              {
                id: String(r.id),
                code: String(r.code),
                name: String(r.name),
                parentId: r.parentId ? String(r.parentId) : null,
                path: String(r.path || ''),
                level: Number(r.level || 1) as AccountLevel,
                accountType: r.accountType as AccountType,
                normalBalance: r.normalBalance as NormalBalance,
              },
            ]),
          );

          for (const item of freshList) {
            if (item.id !== id && item.parentId) {
              const recalculated = computeAccountPath({ code: item.code, parentId: item.parentId }, freshMap);
              if (recalculated !== item.path) {
                await context.pb.collection('chart_of_accounts').update(item.id, { path: recalculated }).catch(() => null);
              }
            }
          }
        } catch {
          // ignore background cascade errors
        }
      });
    }

    return NextResponse.json({
      account: {
        id: updatedRecord.id,
        code: updatedRecord.code,
        name: updatedRecord.name,
        parentId: updatedRecord.parentId || null,
        path: updatedRecord.path,
        level: updatedRecord.level,
        accountType: updatedRecord.accountType,
        normalBalance: updatedRecord.normalBalance,
        requiresWeight: Boolean(updatedRecord.requiresWeight),
        isMultiCurrency: Boolean(updatedRecord.isMultiCurrency),
        isSystem: Boolean(updatedRecord.isSystem),
        isActive: updatedRecord.isActive !== false,
        isPostable: Boolean(updatedRecord.isPostable),
        sortOrder: updatedRecord.sortOrder,
        description: updatedRecord.description || '',
        tags: updatedRecord.tags || [],
        created: updatedRecord.created,
        updated: updatedRecord.updated,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'ویرایش سرفصل حسابداری انجام نشد.' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const allowed =
    hasPermission(context.user, 'settings.manage') ||
    hasPermission(context.user, 'settings.edit') ||
    context.user.role === 'admin' ||
    context.user.role === 'manager';
  if (!allowed) {
    return NextResponse.json(
      { message: 'شما مجوز لازم برای حذف سرفصل حسابداری را ندارید.' },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
    const existing = await context.pb.collection('chart_of_accounts').getOne(id);
    if (!existing) {
      return NextResponse.json({ message: 'سرفصل حسابداری یافت نشد.' }, { status: 404 });
    }

    // Check children count
    const allRecords = await context.pb.collection('chart_of_accounts').getFullList();
    const children = allRecords.filter((r) => r.parentId === id);

    const account: ChartOfAccountRecord = {
      id: existing.id,
      code: existing.code,
      name: existing.name,
      parentId: existing.parentId || null,
      path: existing.path,
      level: Number(existing.level || 1) as AccountLevel,
      accountType: existing.accountType as AccountType,
      normalBalance: existing.normalBalance as NormalBalance,
      isSystem: Boolean(existing.isSystem),
      isActive: existing.isActive !== false,
    };

    const deleteRule = canDeleteAccount(account, children.length, false);
    if (!deleteRule.canDelete) {
      return NextResponse.json(
        {
          message: deleteRule.reason || 'حذف این سرفصل امکان‌پذیر نیست.',
          action: deleteRule.action,
        },
        { status: 400 },
      );
    }

    await context.pb.collection('chart_of_accounts').delete(id);

    return NextResponse.json({
      success: true,
      message: `سرفصل "${account.name}" با موفقیت حذف شد.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'حذف سرفصل حسابداری انجام نشد.' },
      { status: 400 },
    );
  }
}
