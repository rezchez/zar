import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { getPendingSamples, mapRefiningSample } from '@/features/refining/services/refining-service';

export async function GET(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'عدم دسترسی معتبر.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'pending';
  const refinerId = searchParams.get('refinerId') || undefined;
  const caseId = searchParams.get('caseId') || undefined;
  const search = searchParams.get('search') || undefined;

  try {
    if (status === 'pending') {
      const packets = await getPendingSamples(context.pb, {
        refinerId,
        caseId,
        search,
      });
      return NextResponse.json({ packets });
    }

    const filters: string[] = [];
    if (status !== 'all') filters.push(context.pb.filter('status = {:packetStatus}', { packetStatus: status }));
    if (refinerId) filters.push(context.pb.filter('refiner = {:refinementRefinerId}', { refinementRefinerId: refinerId }));
    if (caseId) filters.push(context.pb.filter('refining_case = {:refinementCaseId}', { refinementCaseId: caseId }));

    const records = await context.pb.collection('refining_samples').getFullList({
      filter: filters.length > 0 ? filters.join(' && ') : undefined,
      expand: 'refiner,refining_case',
      sort: '-created',
    }).catch(() => []);

    let packets = records.map(mapRefiningSample);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      packets = packets.filter(
        (p) =>
          p.sampleCode.toLowerCase().includes(q) ||
          (p.caseNumber && p.caseNumber.toLowerCase().includes(q)) ||
          (p.refinerName && p.refinerName.toLowerCase().includes(q)),
      );
    }

    return NextResponse.json({ packets });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'خطا در دریافت لیست پاکت‌های ریگیری.' },
      { status: 500 },
    );
  }
}
