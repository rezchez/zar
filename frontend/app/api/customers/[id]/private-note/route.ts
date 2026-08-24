import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'customer.view') && !hasPermission(context.user, 'customer.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به توضیحات محرمانه.' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const record = await context.pb.collection('customers').getOne(id, {
      fields: 'id,name,customerCode,privateDescription',
    });

    return NextResponse.json({
      id: record.id,
      name: record.name,
      customerCode: record.customerCode,
      privateDescription: String(record.privateDescription || ''),
    });
  } catch {
    return NextResponse.json({ message: 'دریافت توضیحات محرمانه انجام نشد.' }, { status: 400 });
  }
}
