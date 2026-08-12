import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();

  if (
    !context
    || (context.user.role !== 'admin' && context.user.role !== 'manager')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const targetUser = await context.pb.collection('users').getOne(id);

    if (context.user.role === 'manager' && targetUser.role === 'admin') {
      return NextResponse.json(
        { message: 'Manager اجازه مشاهده تاریخچه Admin را ندارد.' },
        { status: 403 },
      );
    }

    const events = await context.pb.collection('auth_events').getList(1, 5, {
      filter: context.pb.filter('user = {:userId}', { userId: id }),
      sort: '-created',
    });

    return NextResponse.json({
      events: events.items.map((event) => ({
        id: event.id,
        event: event.event,
        ipAddress: event.ipAddress ?? '',
        operatingSystem: event.operatingSystem ?? 'نامشخص',
        userAgent: event.userAgent ?? '',
        details: event.details ?? '',
        created: event.created,
      })),
    });
  } catch {
    return NextResponse.json(
      { message: 'دریافت تاریخچه ورود انجام نشد.' },
      { status: 500 },
    );
  }
}
