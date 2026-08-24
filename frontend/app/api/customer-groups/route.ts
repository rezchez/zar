import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const records = await context.pb.collection('customer_groups').getFullList({ sort: 'created' });
    return NextResponse.json({ groups: records });
  } catch {
    return NextResponse.json({ message: 'Failed to fetch customer groups' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  try {
    const record = await context.pb.collection('customer_groups').create({
      identifier: body.identifier,
      name: body.name,
      is_system: false,
    });
    return NextResponse.json({ group: record }, { status: 201 });
  } catch {
    return NextResponse.json({ message: 'Failed to create customer group' }, { status: 500 });
  }
}
