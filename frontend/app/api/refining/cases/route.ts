import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { createRefiningCase, mapRefiningCase } from '@/features/refining/services/refining-service';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'عدم دسترسی معتبر.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const refinerId = searchParams.get('refinerId');
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  try {
    const filters: string[] = [];
    if (refinerId) filters.push(context.pb.filter('refiner = {:refinementRefinerId}', { refinementRefinerId: refinerId }));
    if (status) filters.push(context.pb.filter('status = {:refinementStatus}', { refinementStatus: status }));

    const records = await context.pb.collection('refining_cases').getFullList({
      filter: filters.length > 0 ? filters.join(' && ') : undefined,
      expand: 'refiner',
      sort: '-created',
    }).catch(() => []);

    let cases = records.map(mapRefiningCase);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      cases = cases.filter(
        (c) =>
          c.caseNumber.toLowerCase().includes(q) ||
          (c.refinerName && c.refinerName.toLowerCase().includes(q)) ||
          c.description.toLowerCase().includes(q),
      );
    }

    return NextResponse.json({ cases });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'خطا در دریافت پرونده‌های ریگیری.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'عدم دسترسی معتبر.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { refinerId, description, createdDate } = body;

    if (!refinerId) {
      return NextResponse.json({ message: 'شناسه طرف‌حساب ریگیر الزامی است.' }, { status: 400 });
    }

    const createdCase = await createRefiningCase(context.pb, {
      refinerId,
      description,
      createdDate,
      userId: context.user?.id,
    });

    return NextResponse.json({ case: createdCase }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'ایجاد پرونده ریگیری با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}
