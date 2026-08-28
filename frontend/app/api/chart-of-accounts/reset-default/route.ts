import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization/authorize';
import {
  DEFAULT_CHART_OF_ACCOUNTS,
  type AccountLevel,
} from '@/lib/chart-of-accounts';

export async function POST() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  const allowed =
    hasPermission(context.user, 'settings.manage') ||
    context.user.role === 'admin';
  if (!allowed) {
    return NextResponse.json(
      { message: 'شما مجوز لازم برای بازنشانی سرفصل‌های پیش‌فرض را ندارید.' },
      { status: 403 },
    );
  }

  try {
    // 1. Get existing records
    const existingRecords = await context.pb.collection('chart_of_accounts').getFullList().catch(() => []);
    const existingByCode = new Map(existingRecords.map((r) => [r.code, r]));

    // Map system codes to their IDs in DB (e.g. sys_1000 -> actual DB id)
    const codeToIdMap = new Map<string, string>();
    for (const [code, rec] of existingByCode) {
      codeToIdMap.set(code, rec.id);
    }

    // Process seeds in 3 passes: Level 1 (roots), Level 2 (general), Level 3 (subsidiary)
    const sortedSeeds = [...DEFAULT_CHART_OF_ACCOUNTS].sort(
      (a, b) => (a.level || 1) - (b.level || 1),
    );

    for (const seed of sortedSeeds) {
      const parentSeed = seed.parentId
        ? DEFAULT_CHART_OF_ACCOUNTS.find((s) => s.id === seed.parentId)
        : null;
      const actualParentId = parentSeed ? codeToIdMap.get(parentSeed.code) || null : null;

      const payload = {
        code: seed.code,
        name: seed.name,
        parentId: actualParentId,
        path: seed.path,
        level: seed.level as AccountLevel,
        accountType: seed.accountType,
        normalBalance: seed.normalBalance,
        requiresWeight: Boolean(seed.requiresWeight),
        isMultiCurrency: Boolean(seed.isMultiCurrency),
        isSystem: Boolean(seed.isSystem),
        isActive: Boolean(seed.isActive),
        isPostable: Boolean(seed.isPostable),
        sortOrder: seed.sortOrder || Number(seed.code) || 0,
        description: seed.description || '',
        updatedBy: context.user.id,
      };

      const existing = existingByCode.get(seed.code);
      if (existing) {
        await context.pb.collection('chart_of_accounts').update(existing.id, payload).catch(() => null);
        codeToIdMap.set(seed.code, existing.id);
      } else {
        const created = await context.pb.collection('chart_of_accounts').create({
          ...payload,
          createdBy: context.user.id,
        }).catch(() => null);
        if (created) {
          codeToIdMap.set(seed.code, created.id);
          existingByCode.set(seed.code, created);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'سرفصل‌های استاندارد با موفقیت بازنشانی و همگام‌سازی شدند.',
      totalDefaultAccounts: DEFAULT_CHART_OF_ACCOUNTS.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'خطا در بازنشانی سرفصل‌های پیش‌فرض.' },
      { status: 500 },
    );
  }
}
