import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomersWithBalances } from '@/lib/customer-service';
import { createCustomersPdf } from '@/lib/pdf-reports';
import { getMessengerProvider } from '@/lib/messengers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { providerName, chatId, options, customerIds } = body as {
      providerName: string;
      chatId: string;
      options?: {
        title?: string;
        showBalances?: boolean;
        showContact?: boolean;
        showGroupAndCity?: boolean;
      };
      customerIds?: string[];
    };

    if (!providerName || !chatId) {
      return NextResponse.json({ message: 'ارسال کننده و شناسه گیرنده الزامی است.' }, { status: 400 });
    }

    const provider = getMessengerProvider(providerName);
    if (!provider.isConfigured()) {
      return NextResponse.json({ message: `سرویس ${provider.name} پیکربندی نشده است.` }, { status: 400 });
    }

    let customers = (await getCustomersWithBalances(context.pb))
      .sort((left, right) => left.customerCode - right.customerCode);

    if (customerIds && customerIds.length > 0) {
      customers = customers.filter(c => customerIds.includes(c.id));
    }

    const reportBuffer = await createCustomersPdf(customers, options);

    await provider.sendDocument({
      chatId,
      document: reportBuffer,
      filename: 'customers_report.pdf',
      caption: options?.title || 'گزارش طرف‌حساب‌ها',
    });

    return NextResponse.json({ message: 'گزارش با موفقیت ارسال شد.' });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'خطا در ارسال گزارش.' },
      { status: 500 }
    );
  }
}
