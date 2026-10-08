import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapCheckRecord } from '@/lib/check';
import { ensureChecksCollection } from '@/lib/check-collection';
import { imageService } from '@/lib/images';
import { POCKETBASE_URL } from '@/lib/pocketbase/pocketbase';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

async function writerFor(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  if (!context) return null;
  try {
    return await getPocketBaseServiceClient();
  } catch {
    return context.pb;
  }
}

/**
 * GET /api/checks/[id]/image
 * Streams the check image directly to the client
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه چک الزامی است.' }, { status: 400 });
  }

  try {
    const service = await getPocketBaseServiceClient().catch(() => null);
    const client = service || context.pb;
    const record = await client.collection('checks').getOne(id);

    if (!record.image || typeof record.image !== 'string') {
      return NextResponse.json({ message: 'تصویری برای این چک ثبت نشده است.' }, { status: 404 });
    }

    const pbFileUrl = `${POCKETBASE_URL}/api/files/checks/${id}/${record.image}`;
    const res = await fetch(pbFileUrl);

    if (!res.ok) {
      return NextResponse.json({ message: 'فایل تصویر در سرور یافت نشد.' }, { status: 404 });
    }

    const contentType = res.headers.get('content-type') || 'image/webp';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return NextResponse.json({ message: 'خطا در بارگذاری تصویر چک.' }, { status: 500 });
  }
}

/**
 * POST /api/checks/[id]/image
 * Uploads, converts to WebP, and attaches an image to a check
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای تغییر تصویر چک.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه چک الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureChecksCollection(writer);
    const existing = await writer.collection('checks').getOne(id);
    if (!existing) {
      return NextResponse.json({ message: 'چک مورد نظر یافت نشد.' }, { status: 404 });
    }

    const formData = await request.formData();
    const imageEntry = formData.get('image');
    const imageFile = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;

    if (!imageFile) {
      return NextResponse.json({ message: 'فایل تصویر ارسال نشده است.' }, { status: 400 });
    }

    // Validate and process image to WebP format
    const uploadResult = await imageService.processUpload({
      file: imageFile,
      purpose: 'check',
      entityId: id,
      declaredMimeType: imageFile.type,
    });

    const updateFormData = new FormData();
    updateFormData.append('image', uploadResult.file, uploadResult.filename);
    updateFormData.append('updatedBy', context.user.id);

    const updated = await writer.collection('checks').update(id, updateFormData);
    const fullRecord = await writer.collection('checks').getOne(id, {
      expand: 'bankAccount,customer',
    }).catch(() => updated);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_updated',
      request,
      details: `تصویر چک ${existing.check_number || existing.sayadId} با فرمت WebP ثبت گردید.`,
      entityType: 'check',
      entityId: id,
      entityLabel: `تصویر چک ${existing.check_number || existing.sayadId}`,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      check: mapCheckRecord(fullRecord),
    });
  } catch (error: any) {
    console.error('check_image_upload_failed', error);
    return NextResponse.json(
      { message: error?.message || 'بارگذاری و تبدیل تصویر چک با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}

/**
 * DELETE /api/checks/[id]/image
 * Removes the image from a check
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'bank.view') && !hasPermission(context.user, 'bank.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه چک الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    await ensureChecksCollection(writer);
    const existing = await writer.collection('checks').getOne(id);
    if (!existing) {
      return NextResponse.json({ message: 'چک مورد نظر یافت نشد.' }, { status: 404 });
    }

    const updateFormData = new FormData();
    updateFormData.append('image', '');
    updateFormData.append('updatedBy', context.user.id);

    const updated = await writer.collection('checks').update(id, updateFormData);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_updated',
      request,
      details: `تصویر چک ${existing.check_number || existing.sayadId} حذف شد.`,
      entityType: 'check',
      entityId: id,
      entityLabel: `حذف تصویر چک ${existing.check_number || existing.sayadId}`,
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      check: mapCheckRecord(updated),
    });
  } catch (error: any) {
    console.error('check_image_delete_failed', error);
    return NextResponse.json(
      { message: error?.message || 'حذف تصویر چک با خطا مواجه شد.' },
      { status: 400 },
    );
  }
}
