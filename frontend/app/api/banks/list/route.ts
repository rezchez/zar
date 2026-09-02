import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به فهرست بانک‌ها.' }, { status: 403 });
  }

  try {
    const pbWriter = await getPocketBaseServiceClient().catch(() => context.pb);
    const records = await pbWriter.collection('banks').getFullList({
      filter: 'is_active = true',
      sort: 'code,name',
    }).catch(() => []);

    const banks = records.map((record) => ({
      id: record.id,
      code: String(record.code || ''),
      name: String(record.name || ''),
      iconKey: String(record.icon_key || ''),
      isActive: Boolean(record.is_active),
    }));

    return NextResponse.json({ banks });
  } catch (error) {
    console.error('banks_list_failed', error);
    return NextResponse.json({ message: 'دریافت بانک‌ها انجام نشد.' }, { status: 500 });
  }
}
