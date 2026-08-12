import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { getServerAuthContext } from '@/lib/auth';

export const runtime = 'nodejs';

const eventLabels: Record<string, string> = {
  login: 'ورود موفق',
  logout: 'خروج',
  login_failed: 'تلاش ورود ناموفق',
  email_change_requested: 'درخواست تغییر ایمیل',
  name_changed: 'تغییر نام',
  two_factor_enabled: 'فعال‌سازی تایید دومرحله‌ای',
  two_factor_disabled: 'غیرفعال‌سازی تایید دومرحله‌ای',
  authenticator_enabled: 'فعال‌سازی رمزساز',
  authenticator_disabled: 'غیرفعال‌سازی رمزساز',
  role_changed: 'تغییر نقش',
  user_blocked: 'مسدودسازی کاربر',
  user_unblocked: 'رفع مسدودی',
  national_code_permission_granted: 'اعطای مجوز ویرایش کد ملی',
  password_reset_requested: 'درخواست بازنشانی رمز',
  customer_created: 'افزودن طرف‌حساب',
  customer_updated: 'ویرایش طرف‌حساب',
  customer_deleted: 'حذف طرف‌حساب',
  transaction_created: 'ثبت تراکنش',
  transaction_updated: 'ویرایش تراکنش',
  settings_updated: 'تغییر تنظیمات',
};

function formatChanges(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();

  if (
    !context
    || (context.user.role !== 'admin' && context.user.role !== 'manager')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const targetUser = await context.pb.collection('users').getOne(id);

    if (context.user.role === 'manager' && targetUser.role === 'admin') {
      return NextResponse.json(
        { message: 'Manager اجازه مشاهده گزارش Admin را ندارد.' },
        { status: 403 },
      );
    }

    const events = await context.pb.collection('auth_events').getFullList({
      filter: context.pb.filter(
        'user = {:userId} || entityId = {:userId}',
        { userId: id },
      ),
      sort: '-created',
    });

    const rows = events.map((event) => ({
      'نوع فعالیت': eventLabels[String(event.event)] ?? String(event.event ?? ''),
      'تاریخ و ساعت': new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      }).format(new Date(event.created)),
      'نوع موضوع': String(event.entityType ?? ''),
      'شناسه موضوع': String(event.entityId ?? ''),
      'عنوان موضوع': String(event.entityLabel ?? ''),
      'IP': String(event.ipAddress ?? ''),
      'سیستم‌عامل': String(event.operatingSystem ?? 'نامشخص'),
      'User-Agent': String(event.userAgent ?? ''),
      'جزئیات': String(event.details ?? ''),
      'تغییرات فیلدها': formatChanges(event.changes),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 24 },
      { wch: 18 },
      { wch: 28 },
      { wch: 36 },
      { wch: 18 },
      { wch: 16 },
      { wch: 52 },
      { wch: 70 },
      { wch: 100 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'گزارش فعالیت');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const safeName = String(targetUser.name || targetUser.email || id)
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .slice(0, 40) || id;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="user-${safeName}-activity.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'ساخت گزارش فعالیت انجام نشد.' },
      { status: 500 },
    );
  }
}
