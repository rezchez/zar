import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { mapCustomer, isRefinerCustomer } from '@/lib/customer';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const counterpartyId = searchParams.get('counterpartyId');

  try {
    const filterParts = ['is_deleted = false'];
    if (counterpartyId) {
      filterParts.push(context.pb.filter('counterparty = {:counterpartyId}', { counterpartyId }));
    }

    let records: any[] = [];
    try {
      records = await context.pb.collection('refining_cases').getFullList({
        filter: filterParts.join(' && '),
        sort: '-created',
      });
    } catch {
      records = [];
    }

    const cases = records.map((r) => ({
      id: r.id,
      counterpartyId: r.counterparty,
      caseNumber: r.case_number,
      status: r.status,
      rawWeight: Number(r.raw_weight || 0),
      pureWeight: Number(r.pure_weight || 0),
      notes: r.notes || '',
      created: r.created,
      updated: r.updated,
    }));

    return NextResponse.json({ cases });
  } catch {
    return NextResponse.json({ message: 'دریافت پرونده‌های ریگیری انجام نشد.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const counterpartyId = String(body?.counterpartyId || '').trim();
    const caseNumber = String(body?.caseNumber || '').trim();
    const rawWeight = Number(body?.rawWeight || 0);
    const notes = String(body?.notes || '').trim();

    if (!counterpartyId) {
      return NextResponse.json({ message: 'طرف‌حساب ریگیر الزامی است.' }, { status: 400 });
    }

    if (!caseNumber) {
      return NextResponse.json({ message: 'شماره پرونده الزامی است.' }, { status: 400 });
    }

    // CANONICAL BACKEND ENFORCEMENT:
    // Verify counterparty exists and is actively a member of the "ریگیر / Refining" group
    let customerRecord;
    try {
      customerRecord = await context.pb.collection('customers').getOne(counterpartyId);
    } catch {
      return NextResponse.json({ message: 'طرف‌حساب مورد نظر یافت نشد.' }, { status: 404 });
    }

    const customer = mapCustomer(context.pb, customerRecord);
    if (!isRefinerCustomer(customer)) {
      return NextResponse.json(
        { message: 'طرف‌حساب انتخاب‌شده عضو گروه «ریگیر» نیست و امکان ثبت پرونده ریگیری برای وی وجود ندارد.' },
        { status: 403 },
      );
    }

    // Create the refining case
    let newRecord;
    try {
      newRecord = await context.pb.collection('refining_cases').create({
        counterparty: counterpartyId,
        case_number: caseNumber,
        status: 'in_progress',
        raw_weight: rawWeight,
        notes,
        created_by: context.user.id,
      });
    } catch (err: any) {
      return NextResponse.json(
        { message: err?.message || 'ثبت پرونده ریگیری در دیتابیس انجام نشد.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      case: {
        id: newRecord.id,
        counterpartyId: newRecord.counterparty,
        caseNumber: newRecord.case_number,
        status: newRecord.status,
        rawWeight: Number(newRecord.raw_weight || 0),
        notes: newRecord.notes || '',
        created: newRecord.created,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'پردازش درخواست پرونده ریگیری با خطا مواجه شد.' }, { status: 400 });
  }
}
