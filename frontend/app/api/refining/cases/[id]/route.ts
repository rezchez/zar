import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { mapRefiningCase, mapRefiningSample, getRefinerGoldBalance } from '@/features/refining/services/refining-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'عدم دسترسی معتبر.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const caseRecord = await context.pb.collection('refining_cases').getOne(id, {
      expand: 'refiner',
    }).catch(() => null);

    if (!caseRecord) {
      return NextResponse.json({ message: 'پرونده ریگیری یافت نشد.' }, { status: 404 });
    }

    const items = await context.pb.collection('refining_items').getFullList({
      filter: context.pb.filter('refining_case = {:id}', { id }),
      sort: 'created',
    }).catch(() => []);

    const samples = await context.pb.collection('refining_samples').getFullList({
      filter: context.pb.filter('refining_case = {:id}', { id }),
      sort: 'created',
    }).catch(() => []);

    const operations = await context.pb.collection('refining_operations').getFullList({
      filter: context.pb.filter('refining_case = {:id}', { id }),
      sort: '-created',
    }).catch(() => []);

    const goldBalance = await getRefinerGoldBalance(context.pb, caseRecord.refiner);

    return NextResponse.json({
      case: mapRefiningCase(caseRecord),
      items,
      samples: samples.map(mapRefiningSample),
      operations,
      goldBalance,
    });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'خطا در دریافت اطلاعات پرونده.' },
      { status: 500 },
    );
  }
}
