import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { dateToJalaliString } from '@/lib/jalali';

interface BatchActionPayload {
  action: 'mark_printed' | 'change_status' | 'delete';
  ids: string[];
  status?: 'available' | 'sold' | 'reserved' | 'melted';
  sourceKey?: string;
}

export async function POST(request: NextRequest) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری شوید.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as BatchActionPayload;
    const { action, ids, status } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: 'هیچ شناسه‌ای برای عملیات انتخاب نشده است.' }, { status: 400 });
    }

    if (action === 'delete') {
      if (
        !hasPermission(context.user, 'document.delete') &&
        !hasPermission(context.user, 'document.manage') &&
        context.user.role !== 'admin'
      ) {
        return NextResponse.json({ message: 'دسترسی غیرمجاز برای حذف.' }, { status: 403 });
      }

      for (const id of ids) {
        try {
          await context.pb.collection('etiquettes').delete(id);
        } catch {
          await context.pb.collection('etiquettes').update(id, {
            is_deleted: true,
            deleted_at: new Date().toISOString(),
          });
        }
      }

      return NextResponse.json({ message: `${ids.length} اتیکت با موفقیت حذف شدند.` });
    }

    if (action === 'mark_printed') {
      const nowJalali = dateToJalaliString(new Date());
      for (const id of ids) {
        try {
          const item = await context.pb.collection('etiquettes').getOne(id);
          const currentCount = Number(item.print_count) || 0;
          await context.pb.collection('etiquettes').update(id, {
            print_status: 'printed',
            print_count: currentCount + 1,
            last_printed_at: nowJalali,
          });
        } catch (e) {
          console.error(`Failed to mark etiquette ${id} as printed:`, e);
        }
      }

      return NextResponse.json({ message: 'وضعیت چاپ اتیکت‌ها با موفقیت به‌روزرسانی شد.' });
    }

    if (action === 'change_status' && status) {
      if (
        !hasPermission(context.user, 'document.edit') &&
        !hasPermission(context.user, 'document.manage') &&
        context.user.role !== 'admin'
      ) {
        return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
      }

      for (const id of ids) {
        try {
          await context.pb.collection('etiquettes').update(id, { status });
        } catch (e) {
          console.error(`Failed to update status for ${id}:`, e);
        }
      }

      return NextResponse.json({ message: 'وضعیت اقلام با موفقیت تغییر کرد.' });
    }

    return NextResponse.json({ message: 'عملیات نامعتبر است.' }, { status: 400 });
  } catch (error) {
    console.error('Batch etiquette operation failed:', error);
    return NextResponse.json({ message: 'خطا در اجرای عملیات گروهی اتیکت‌ها.' }, { status: 500 });
  }
}
