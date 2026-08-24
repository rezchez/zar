import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getAvailableAccountCodes, getNextAutoCustomerCode } from '@/lib/account-code';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const currentCodeParam = searchParams.get('currentCode');
  const currentCode = currentCodeParam ? Number(currentCodeParam) : undefined;

  try {
    const records = await context.pb.collection('customers').getFullList({
      filter: 'is_deleted = false',
      fields: 'customerCode',
    });

    const usedCodes = records
      .map((r) => Number(r.customerCode))
      .filter((c) => Number.isInteger(c) && c > 0);

    const availableCodes = getAvailableAccountCodes(usedCodes, currentCode);
    const nextAutoCode = getNextAutoCustomerCode(usedCodes);

    return NextResponse.json({
      usedCodes,
      availableCodes,
      nextAutoCode,
    });
  } catch {
    return NextResponse.json({ message: 'دریافت کدهای حساب انجام نشد.' }, { status: 500 });
  }
}
