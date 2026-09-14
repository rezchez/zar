import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { BANKS_REGISTRY } from '@/features/banks/services/bank';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    let records = await context.pb.collection('banks').getFullList({
      sort: 'name',
    }).catch(() => []);

    if (records.length === 0) {
      const service = await getPocketBaseServiceClient().catch(() => null);
      if (service) {
        records = await service.collection('banks').getFullList({
          sort: 'name',
        }).catch(() => []);
      }
    }

    if (records.length === 0) {
      return NextResponse.json({
        banks: BANKS_REGISTRY.map((b) => ({
          id: b.id,
          code: b.code,
          name: b.name,
          iconKey: b.iconKey,
          logoUrl: null,
          isActive: true,
        })),
      });
    }

    return NextResponse.json({
      banks: records.map((record) => {
        let logoUrl: string | null = null;
        if (record.logo && typeof record.logo === 'string') {
          try {
            logoUrl = context.pb.files.getURL(record, record.logo);
          } catch {
            logoUrl = null;
          }
        }

        return {
          id: record.id,
          code: record.code || '',
          name: record.name || '',
          iconKey: record.icon_key || record.iconKey || '',
          logoUrl,
          isActive: record.is_active ?? true,
        };
      }),
    });
  } catch (error) {
    console.error('get_banks_list_failed', error);
    return NextResponse.json(
      { message: 'دریافت فهرست بانک‌ها انجام نشد.' },
      { status: 500 },
    );
  }
}
