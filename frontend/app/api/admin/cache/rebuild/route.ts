import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const context = await getServerAuthContext();
    if (!context?.user) {
      return NextResponse.json({ error: 'عدم احراز هویت' }, { status: 401 });
    }

    if (context.user.role !== 'admin' && context.user.role !== 'manager') {
      return NextResponse.json({ error: 'دسترسی غیرمجاز' }, { status: 403 });
    }

    // 1. Revalidate Next.js router & data caches
    revalidatePath('/', 'layout');

    // 2. Clear .next/cache directory safely if present
    try {
      const cacheDir = path.join(process.cwd(), '.next', 'cache');
      await fs.rm(cacheDir, { recursive: true, force: true });
    } catch {
      // Ignore if cache directory is inaccessible or missing
    }

    // 3. Record audit event
    await recordAuditEvent({
      userId: context.user.id,
      event: 'cache_rebuilt',
      request,
      details: 'پاکسازی و بازسازی کامل کش سرور انجام شد.',
      entityType: 'system_cache',
      entityId: 'global_cache',
      entityLabel: 'بازسازی کامل کش برنامه',
    });

    return NextResponse.json({
      success: true,
      message: 'کش برنامه با موفقیت بازسازی و پاکسازی شد.',
      rebuildTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطای غیرمنتظره در پاکسازی کش';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
