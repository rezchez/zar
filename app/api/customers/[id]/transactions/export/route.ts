import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { getCustomerTransactions } from '@/lib/customer-service';
import { createLedgerPdf } from '@/lib/pdf-reports';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  try {
    const { id } = await params;
    const customer = await context.pb.collection('customers').getOne(id);
    const transactions = await getCustomerTransactions(context.pb, id);
    const pdf = await createLedgerPdf({
      customerCode: Number(customer.customerCode ?? 0),
      name: String(customer.name ?? ''),
      phone1: String(customer.phone1 ?? ''),
    }, transactions);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ledger-${customer.customerCode}.pdf"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('ledger_pdf_export_failed', error);
    return new NextResponse('ساخت گزارش PDF انجام نشد.', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
