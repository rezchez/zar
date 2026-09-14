import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { registerRefiningServiceFee } from '@/features/refining/services/refining-service';

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
    const { amount, date, description } = body;

    const result = await registerRefiningServiceFee(context.pb, {
      caseId: id,
      amount: Number(amount),
      date,
      description,
      userId: context.user?.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'ثبت هزینه و اجرت ریگیری با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}
