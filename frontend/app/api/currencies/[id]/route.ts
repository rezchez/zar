import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { deleteCurrency } from '@/lib/currencies';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  // Access Control: Only admin and manager can delete currencies
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    return NextResponse.json(
      { message: 'فقط مدیران و ادمین سیستم مجاز به حذف ارز هستند.' },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ message: 'شناسه ارز نامعتبر است.' }, { status: 400 });
    }

    await deleteCurrency(context.pb, id);
    return NextResponse.json({ success: true, message: 'ارز با موفقیت حذف شد.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'حذف ارز انجام نشد.';
    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
