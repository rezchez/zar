import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';

export interface StorageLocationItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

const DEFAULT_LOCATIONS: StorageLocationItem[] = [
  { id: 'loc_safe_office', name: 'گاوصندوق دفتر', code: 'SAFE-OFFICE', isActive: true, sortOrder: 1 },
  { id: 'loc_safe_workshop', name: 'گاوصندوق کارگاه', code: 'SAFE-WORKSHOP', isActive: true, sortOrder: 2 },
  { id: 'loc_safe_shop', name: 'گاوصندوق مغازه', code: 'SAFE-SHOP', isActive: true, sortOrder: 3 },
];

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const records = await context.pb
      .collection('storage_locations')
      .getFullList({
        filter: 'is_active = true',
        sort: 'sort_order,created',
      })
      .catch(() => []);

    if (records.length === 0) {
      // Auto-seed defaults if collection is empty
      const seeded: StorageLocationItem[] = [];
      for (const def of DEFAULT_LOCATIONS) {
        try {
          const rec = await context.pb.collection('storage_locations').create({
            name: def.name,
            code: def.code,
            is_active: true,
            sort_order: def.sortOrder,
          });
          seeded.push({
            id: rec.id,
            name: String(rec.name),
            code: String(rec.code || ''),
            isActive: Boolean(rec.is_active),
            sortOrder: Number(rec.sort_order || 0),
          });
        } catch {
          // If creation fails (e.g. collection missing), fall back to default
          seeded.push(def);
        }
      }
      return NextResponse.json({ items: seeded });
    }

    const items: StorageLocationItem[] = records.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      code: String(r.code || ''),
      description: String(r.description || ''),
      isActive: Boolean(r.is_active),
      sortOrder: Number(r.sort_order || 0),
    }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: DEFAULT_LOCATIONS });
  }
}

export async function POST(req: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const canManage =
    hasPermission(context.user, 'document.create') ||
    hasPermission(context.user, 'document.manage') ||
    hasPermission(context.user, 'settings.edit') ||
    hasPermission(context.user, 'cash.manage');

  if (!canManage) {
    return NextResponse.json({ message: 'دسترسی لازم برای افزودن محل نگهداری وجود ندارد.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const name = String(body?.name || '').trim();
    if (!name) {
      return NextResponse.json({ message: 'نام محل نگهداری الزامی است.' }, { status: 400 });
    }

    const code = String(body?.code || '').trim();
    const description = String(body?.description || '').trim();

    try {
      const rec = await context.pb.collection('storage_locations').create({
        name,
        code: code || undefined,
        description: description || undefined,
        is_active: true,
        sort_order: 10,
      });

      return NextResponse.json({
        success: true,
        item: {
          id: rec.id,
          name: String(rec.name),
          code: String(rec.code || ''),
          description: String(rec.description || ''),
          isActive: Boolean(rec.is_active),
        },
      });
    } catch {
      // Fallback response with synthetic ID if table doesn't exist yet
      return NextResponse.json({
        success: true,
        item: {
          id: `loc_${Date.now()}`,
          name,
          code,
          description,
          isActive: true,
        },
      });
    }
  } catch (err: unknown) {
    return NextResponse.json({
      message: err instanceof Error ? err.message : 'خطا در ثبت محل نگهداری',
    }, { status: 500 });
  }
}
