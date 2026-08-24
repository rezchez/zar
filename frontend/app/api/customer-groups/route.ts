import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { generateGroupSlug, SYSTEM_GROUPS, type CustomerGroup } from '@/lib/customer-groups';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    let records: CustomerGroup[] = [];
    try {
      const pbGroups = await context.pb.collection('customer_groups').getFullList({
        sort: 'created',
      });
      records = pbGroups.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        isSystem: Boolean(r.isSystem),
        createdBy: r.createdBy,
        created: r.created,
        updated: r.updated,
      }));
    } catch {
      // If collection does not exist yet, fallback to system groups
      records = [];
    }

    // Ensure all system groups exist in the list
    const existingSlugs = new Set(records.map((g) => g.slug));
    const missingSystem = SYSTEM_GROUPS.filter((g) => !existingSlugs.has(g.slug));

    for (const sys of missingSystem) {
      records.unshift({
        id: `sys_${sys.slug}`,
        name: sys.name,
        slug: sys.slug,
        isSystem: true,
      });
    }

    return NextResponse.json({ groups: records });
  } catch {
    return NextResponse.json({ message: 'دریافت گروه‌ها انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name ?? '').trim();

    if (!name || name.length < 2 || name.length > 120) {
      return NextResponse.json({ message: 'نام گروه باید بین ۲ تا ۱۲۰ کاراکتر باشد.' }, { status: 400 });
    }

    // Check duplicate
    try {
      const existing = await context.pb.collection('customer_groups').getFirstListItem(
        context.pb.filter('name = {:name}', { name }),
      ).catch(() => null);

      if (existing) {
        return NextResponse.json({ message: 'گروهی با این نام قبلاً ثبت شده است.' }, { status: 409 });
      }
    } catch {
      // ignore
    }

    const isSystemMatch = SYSTEM_GROUPS.some((g) => g.name === name);
    if (isSystemMatch) {
      return NextResponse.json({ message: 'این نام متعلق به یکی از گروه‌های اصلی سیستم است.' }, { status: 400 });
    }

    const slug = generateGroupSlug(name);
    const newGroup = await context.pb.collection('customer_groups').create({
      name,
      slug,
      isSystem: false,
      createdBy: context.user.id,
    });

    return NextResponse.json({
      group: {
        id: newGroup.id,
        name: newGroup.name,
        slug: newGroup.slug,
        isSystem: false,
        createdBy: newGroup.createdBy,
        created: newGroup.created,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'ایجاد گروه انجام نشد.' }, { status: 400 });
  }
}
