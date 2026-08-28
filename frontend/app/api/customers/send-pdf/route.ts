import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomersWithBalances } from '@/lib/customer-service';
import { createCustomersPdf } from '@/lib/pdf-reports';
import { getMessengerProvider } from '@/lib/messengers';

import { getServerAppSettings } from '@/lib/server-settings';
import { DEFAULT_REPORT_TEMPLATES } from '@/lib/report-templates';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { providerName, chatId, options, customerIds, templateId } = body as {
      providerName: string;
      chatId: string;
      options?: {
        title?: string;
        showBalances?: boolean;
        showContact?: boolean;
        showGroupAndCity?: boolean;
      };
      customerIds?: string[];
      templateId?: string;
    };

    if (!providerName || !chatId) {
      return NextResponse.json({ message: 'ارسال کننده و شناسه گیرنده الزامی است.' }, { status: 400 });
    }

    const provider = await getMessengerProvider(providerName);
    if (!provider.isConfigured()) {
      return NextResponse.json({ message: `سرویس ${provider.name} پیکربندی نشده است.` }, { status: 400 });
    }

    let customers = (await getCustomersWithBalances(context.pb))
      .sort((left, right) => left.customerCode - right.customerCode);

    if (customerIds && customerIds.length > 0) {
      customers = customers.filter(c => customerIds.includes(c.id));
    }

    const settings = await getServerAppSettings();
    const reportTemplates = Array.isArray(settings.reportTemplates) && settings.reportTemplates.length > 0
      ? settings.reportTemplates
      : DEFAULT_REPORT_TEMPLATES;

    const chosenTemplate = (templateId ? reportTemplates.find((t) => t.id === templateId) : null)
      || reportTemplates.find((t) => t.reportType === 'customer' && t.isDefault)
      || reportTemplates.find((t) => t.reportType === 'customer')
      || DEFAULT_REPORT_TEMPLATES[0];

    const templateCols = chosenTemplate?.table?.columns?.filter((c) => c.visible !== false).map((c) => c.id);

    const reportBuffer = await createCustomersPdf(customers, {
      title: options?.title || chosenTemplate?.header?.customTitle || chosenTemplate?.name || 'گزارش طرف‌حساب‌ها',
      subtitle: chosenTemplate?.header?.customSubtitle,
      orientation: chosenTemplate?.page?.orientation || 'landscape',
      showBalances: options?.showBalances !== false,
      showContact: options?.showContact !== false,
      showGroupAndCity: options?.showGroupAndCity !== false,
      showLogo: chosenTemplate?.header?.showLogo !== false,
      storeName: settings.printStoreName || settings.organizationName || 'زر فولیـو',
      columns: templateCols && templateCols.length > 0 ? templateCols : settings.printCustomerColumns,
      footerNotes: chosenTemplate?.footer?.customFooterText || settings.printFooterText,
      showStamp: chosenTemplate?.footer?.showStamp,
      showSignature: chosenTemplate?.footer?.showSignature,
      showTotalCount: chosenTemplate?.footer?.showTotalCount !== false,
    });

    await provider.sendDocument({
      chatId,
      document: reportBuffer,
      filename: 'customers_report.pdf',
      caption: options?.title || chosenTemplate?.header?.customTitle || chosenTemplate?.name || 'گزارش طرف‌حساب‌ها',
    });

    return NextResponse.json({ message: 'گزارش با موفقیت ارسال شد.' });
  } catch (error: any) {
    return NextResponse.json(
      { message: error.message || 'خطا در ارسال گزارش.' },
      { status: 500 }
    );
  }
}
