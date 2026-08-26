import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { SYSTEM_GROUPS } from '@/lib/customer-groups';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existingGroup = await context.pb.collection('customer_groups').getOne(id);
    if (!existingGroup) {
      return NextResponse.json({ message: 'گروه یافت نشد.' }, { status: 404 });
    }

    if (existingGroup.isSystem) {
      return NextResponse.json(
        { message: 'گروه‌های اصلی سیستم قابل تغییر نام نیستند.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const newName = String(body?.name ?? '').trim();
    const englishName = String(body?.englishName ?? body?.english_name ?? '').trim();

    if (!newName || newName.length < 2 || newName.length > 120) {
      return NextResponse.json({ message: 'نام جدید گروه معتبر نیست.' }, { status: 400 });
    }

    const isSystemName = SYSTEM_GROUPS.some((g) => g.name === newName);
    if (isSystemName) {
      return NextResponse.json(
        { message: 'نمی‌توانید نام گروه سفارشی را به نام یکی از گروه‌های اصلی تغییر دهید.' },
        { status: 400 },
      );
    }

    const duplicate = await context.pb.collection('customer_groups').getFirstListItem(
      context.pb.filter('name = {:name} && id != {:id}', { name: newName, id }),
    ).catch(() => null);

    if (duplicate) {
      return NextResponse.json({ message: 'گروهی با این نام قبلاً وجود دارد.' }, { status: 409 });
    }

    const updated = await context.pb.collection('customer_groups').update(id, {
      name: newName,
      english_name: englishName,
    });

    return NextResponse.json({
      group: {
        id: updated.id,
        name: updated.name,
        englishName: updated.english_name ?? englishName,
        slug: updated.slug,
        isSystem: Boolean(updated.isSystem),
      },
    });
  } catch {
    return NextResponse.json({ message: 'ویرایش نام گروه انجام نشد.' }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existingGroup = await context.pb.collection('customer_groups').getOne(id);
    if (!existingGroup) {
      return NextResponse.json({ message: 'گروه یافت نشد.' }, { status: 404 });
    }

    if (existingGroup.isSystem) {
      return NextResponse.json(
        { message: 'گروه‌های اصلی سیستم قابل حذف نیستند.' },
        { status: 403 },
      );
    }

    await context.pb.collection('customer_groups').delete(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: 'حذف گروه انجام نشد.' }, { status: 400 });
  }
}
