import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const records = await context.pb.collection('banks').getFullList({
      sort: 'name',
    }).catch(() => []);

    return NextResponse.json({
      banks: records.map((record) => ({
        id: record.id,
        code: record.code || '',
        name: record.name || '',
        iconKey: record.icon_key || '',
        isActive: record.is_active ?? true,
      })),
    });
  } catch (error) {
    console.error('get_banks_list_failed', error);
    return NextResponse.json(
      { message: 'دریافت فهرست بانک‌ها انجام نشد.' },
      { status: 500 },
    );
  }
}
