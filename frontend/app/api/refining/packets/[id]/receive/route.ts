import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { receiveSamplePacket } from '@/features/refining/services/refining-service';

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
    const { receivedWeight, receivedDate, description } = body;

    if (receivedWeight == null || isNaN(Number(receivedWeight))) {
      return NextResponse.json({ message: 'ثبت وزن واقعی دریافت‌شده الزامی است.' }, { status: 400 });
    }

    const result = await receiveSamplePacket(context.pb, {
      sampleId: id,
      receivedWeight: Number(receivedWeight),
      receivedDate,
      description,
      userId: context.user?.id,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message || 'ثبت دریافت پاکت نمونه با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}
