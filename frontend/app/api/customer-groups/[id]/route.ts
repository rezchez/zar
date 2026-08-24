import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const id = (await params).id;
  const body = await request.json();
  try {
    const record = await context.pb.collection('customer_groups').update(id, {
      name: body.name,
    });
    return NextResponse.json({ group: record }, { status: 200 });
  } catch {
    return NextResponse.json({ message: 'Failed to update customer group' }, { status: 500 });
  }
}
