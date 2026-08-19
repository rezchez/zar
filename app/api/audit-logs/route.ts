import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';

async function contextOrError() {
  const context = await getServerAuthContext();
  if (!context) return { response: NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 }) };
  if (context.user.role !== 'admin' && context.user.role !== 'manager') {
    return { response: NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 403 }) };
  }
  return { context };
}

export async function GET() {
  const result = await contextOrError();
  if (result.response) return result.response;
  const pb = result.context!.pb;
  const [contacts, documents] = await Promise.all([
    pb.collection('customers').getFullList({ filter: 'is_deleted = true', sort: '-deleted_at' }).catch(() => []),
    pb.collection('transactions').getFullList({ filter: 'is_deleted = true', sort: '-deleted_at' }).catch(() => []),
  ]);
  return NextResponse.json({
    contacts: contacts.map((item) => ({ id: item.id, name: item.name ?? item.customerCode ?? item.id, deleted_at: item.deleted_at ?? item.updated })),
    documents: documents.map((item) => ({ id: item.id, documentNumber: item.documentNumber ?? item.id, description: item.description ?? '', deleted_at: item.deleted_at ?? item.updated })),
  });
}

export async function PATCH(request: Request) {
  const result = await contextOrError();
  if (result.response) return result.response;
  const body = (await request.json().catch(() => ({}))) as { type?: string; id?: string };
  if (!body.id || (body.type !== 'contact' && body.type !== 'document')) {
    return NextResponse.json({ message: 'نوع و شناسه بازیابی معتبر نیست.' }, { status: 400 });
  }
  const collection = body.type === 'contact' ? 'customers' : 'transactions';
  try {
    const record = await result.context!.pb.collection(collection).getOne(body.id);
    const updates = {
      is_deleted: false,
      deleted_at: '',
      deleted_by: '',
    };
    if (body.type === 'document' && record.documentId) {
      const siblings = await result.context!.pb.collection(collection).getFullList({
        filter: result.context!.pb.filter('documentId = {:documentId} && is_deleted = true', {
          documentId: record.documentId,
        }),
      });
      for (const sibling of siblings) {
        await result.context!.pb.collection(collection).update(sibling.id, updates);
      }
      return NextResponse.json({ success: true, id: record.id, restoredCount: siblings.length });
    }
    const restored = await result.context!.pb.collection(collection).update(body.id, updates);
    return NextResponse.json({ success: true, id: restored.id, restoredCount: 1 });
  } catch {
    return NextResponse.json({ message: 'بازیابی انجام نشد.' }, { status: 400 });
  }
}
