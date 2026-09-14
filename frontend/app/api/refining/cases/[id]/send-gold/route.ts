import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { sendGoldToRefiner } from '@/features/refining/services/refining-service';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'عدم دسترسی معتبر.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { inputWeight, inputGrade, itemType, date, description } = body;

    const result = await sendGoldToRefiner(context.pb, {
      caseId: id,
      inputWeight: Number(inputWeight),
      inputGrade: Number(inputGrade),
      itemType,
      date,
      description,
      userId: context.user?.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'تحویل طلا به ریگیر با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}
