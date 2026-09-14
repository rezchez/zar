import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { registerRefiningProcess } from '@/features/refining/services/refining-service';

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
    const {
      outputWeight,
      outputGrade,
      sampleCode,
      declaredSampleWeight,
      stampNumber,
      date,
      description,
    } = body;

    const result = await registerRefiningProcess(context.pb, {
      caseId: id,
      outputWeight: Number(outputWeight),
      outputGrade: Number(outputGrade),
      sampleCode,
      declaredSampleWeight: Number(declaredSampleWeight || 0),
      stampNumber,
      date,
      description,
      userId: context.user?.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'ثبت نتیجه ریگیری با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}
