import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';

function text(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const weight = Number(String(body.weight ?? '').replace(/,/g, ''));
  const payload = {
    query: text(body.query),
    envelope_number: text(body.envelopeNumber, 80),
    ang: text(body.ang, 80),
    counterparty_name: text(body.counterpartyName, 160),
    weight: Number.isFinite(weight) ? weight : 0,
    user: context.user.id,
  };

  try {
    const record = await context.pb.collection('search_logs').create(payload);
    return NextResponse.json({ log: record }, { status: 201 });
  } catch {
    // Search remains useful even before the migration has been applied.
    return NextResponse.json({ logged: false }, { status: 202 });
  }
}
