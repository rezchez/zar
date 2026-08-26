import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { LOG_RETENTION_RULES, runLogCleanup } from '@/lib/log-retention';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (
    !context
    || (context.user.role !== 'admin' && context.user.role !== 'manager')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { batchSize?: number };
    const batchSize = Math.min(500, Math.max(10, Number(body.batchSize || 100)));

    const result = await runLogCleanup(context.pb, batchSize);

    return NextResponse.json({
      message: 'عملیات پاک‌سازی لاگ‌های منقضی‌شده با موفقیت انجام شد.',
      totalDeleted: result.totalDeleted,
      deletedByEvent: result.deletedByEvent,
      errorsCount: result.errors.length,
      errors: result.errors.slice(0, 10),
    });
  } catch {
    return NextResponse.json(
      { message: 'خطا در اجرای عملیات پاک‌سازی لاگ‌ها.' },
      { status: 500 },
    );
  }
}

export async function GET() {
  const context = await getServerAuthContext();
  if (
    !context
    || (context.user.role !== 'admin' && context.user.role !== 'manager')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  return NextResponse.json({
    rules: LOG_RETENTION_RULES,
  });
}
