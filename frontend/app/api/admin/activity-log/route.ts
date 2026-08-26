import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';

const eventLabels: Record<string, string> = {
  login: 'ورود موفق',
  logout: 'خروج',
  login_failed: 'تلاش ناموفق ورود',
  email_change_requested: 'درخواست تغییر ایمیل',
  name_changed: 'تغییر نام',
  two_factor_enabled: 'فعال‌سازی تایید دومرحله‌ای',
  two_factor_disabled: 'غیرفعال‌سازی تایید دومرحله‌ای',
  authenticator_enabled: 'فعال‌سازی رمزساز',
  authenticator_disabled: 'غیرفعال‌سازی رمزساز',
  role_changed: 'تغییر نقش',
  user_blocked: 'مسدودسازی کاربر',
  user_unblocked: 'رفع مسدودی',
  national_code_permission_granted: 'مجوز ویرایش کد ملی',
  phone_permission_granted: 'مجوز ویرایش تلفن همراه',
  password_reset_requested: 'درخواست بازنشانی رمز',
  customer_created: 'افزودن طرف‌حساب',
  customer_updated: 'ویرایش طرف‌حساب',
  customer_deleted: 'حذف طرف‌حساب',
  transaction_deleted: 'حذف سند',
  transaction_created: 'ثبت تراکنش',
  transaction_updated: 'ویرایش تراکنش',
  settings_updated: 'تغییر تنظیمات',
  print_template_created: 'ایجاد قالب چاپ',
  print_template_updated: 'ویرایش قالب چاپ',
  print_template_deleted: 'حذف قالب چاپ',
};

const ALLOWED_PER_PAGE_VALUES = [25, 50, 75, 100, 500];

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (
    !context
    || (context.user.role !== 'admin' && context.user.role !== 'manager')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));

  let perPage = Number(url.searchParams.get('perPage') || 25);
  if (!ALLOWED_PER_PAGE_VALUES.includes(perPage)) {
    perPage = 25;
  }

  const event = url.searchParams.get('event')?.trim() ?? '';
  const search = url.searchParams.get('q')?.trim() ?? '';

  try {
    const filterConditions: string[] = [];
    const filterParams: Record<string, unknown> = {};

    if (event) {
      filterConditions.push('event = {:event}');
      filterParams.event = event;
    }

    if (search) {
      // Escape special PocketBase filter characters if needed or use multi-field ~ search
      filterConditions.push('(details ~ {:search} || entityLabel ~ {:search} || ipAddress ~ {:search} || operatingSystem ~ {:search} || user.name ~ {:search} || user.email ~ {:search})');
      filterParams.search = search;
    }

    const filterString = filterConditions.length > 0
      ? context.pb.filter(filterConditions.join(' && '), filterParams)
      : '';

    const result = await context.pb.collection('auth_events').getList(page, perPage, {
      sort: '-created',
      filter: filterString,
      expand: 'user',
    });

    return NextResponse.json({
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      page: result.page,
      perPage: result.perPage,
      events: result.items.map((item) => {
        const actor = item.expand?.user;
        let changes: Record<string, unknown> | null = null;
        try {
          changes = item.changes ? JSON.parse(String(item.changes)) : null;
        } catch {
          changes = null;
        }

        return {
          id: item.id,
          event: String(item.event ?? ''),
          eventLabel: eventLabels[String(item.event ?? '')] ?? String(item.event ?? ''),
          created: item.created,
          ipAddress: String(item.ipAddress ?? ''),
          operatingSystem: String(item.operatingSystem ?? 'نامشخص'),
          details: String(item.details ?? ''),
          entityType: String(item.entityType ?? ''),
          entityId: String(item.entityId ?? ''),
          entityLabel: String(item.entityLabel ?? ''),
          changes,
          actor: {
            id: String(actor?.id ?? item.user ?? ''),
            name: String(actor?.name ?? ''),
            email: String(actor?.email ?? ''),
          },
        };
      }),
    });
  } catch {
    return NextResponse.json(
      { message: 'دریافت لاگ فعالیت‌ها انجام نشد.' },
      { status: 500 },
    );
  }
}
