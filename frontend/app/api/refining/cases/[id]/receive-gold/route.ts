import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { receiveRefinedGold } from '@/features/refining/services/refining-service';

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
    const { itemId, receivedWeight, receivedGrade, date, description } = body;

    if (!itemId) {
      return NextResponse.json({ message: 'شناسه قلم خروجی الزامی است.' }, { status: 400 });
    }

    const result = await receiveRefinedGold(context.pb, {
      caseId: id,
      itemId,
      receivedWeight: Number(receivedWeight),
      receivedGrade: Number(receivedGrade),
      date,
      description,
      userId: context.user?.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'ثبت دریافت طلای خروجی با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}
