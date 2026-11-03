import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { imageService } from '@/lib/images';
import { mapEtiquetteRecord } from '@/lib/etiquette';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

async function writerFor(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  if (!context) return null;
  try {
    return await getPocketBaseServiceClient();
  } catch {
    return context.pb;
  }
}

const POCKETBASE_URL =
  process.env.POCKETBASE_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_POCKETBASE_URL ||
  'http://127.0.0.1:8090';

/**
 * GET /api/etiquettes/[id]/image
 * Streams the product photo directly to the client or browser.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه اتیکت الزامی است.' }, { status: 400 });
  }

  try {
    const record = await context.pb.collection('etiquettes').getOne(id);
    if (!record || record.is_deleted) {
      return NextResponse.json({ message: 'اتیکت یافت نشد.' }, { status: 404 });
    }

    if (!record.image || typeof record.image !== 'string') {
      return NextResponse.json({ message: 'تصویری برای این اتیکت ثبت نشده است.' }, { status: 404 });
    }

    const pbFileUrl = `${POCKETBASE_URL}/api/files/etiquettes/${id}/${record.image}`;
    const res = await fetch(pbFileUrl);

    if (!res.ok) {
      return NextResponse.json({ message: 'تصویر در سرور یافت نشد.' }, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/webp';
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Image requests require an authenticated session; never let a shared
        // cache replay a private product image to another tenant or user.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to get etiquette image:', error);
    return NextResponse.json({ message: 'خطا در بارگذاری تصویر محصول.' }, { status: 500 });
  }
}

/**
 * POST /api/etiquettes/[id]/image
 * Uploads, converts to optimized WebP, and attaches an image to an etiquette.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.edit') &&
    !hasPermission(context.user, 'document.manage') &&
    context.user.role !== 'admin'
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای تغییر تصویر اتیکت.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه اتیکت الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    const existing = await writer.collection('etiquettes').getOne(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ message: 'اتیکت مورد نظر یافت نشد.' }, { status: 404 });
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
      purpose: 'jewelry',
      entityId: id,
      declaredMimeType: imageFile.type,
    });

    const updateFormData = new FormData();
    updateFormData.append('image', uploadResult.file, uploadResult.filename);

    const updated = await writer.collection('etiquettes').update(id, updateFormData);

    return NextResponse.json({
      success: true,
      message: 'تصویر محصول طلا با موفقیت ذخیره شد.',
      item: mapEtiquetteRecord(updated),
      imageUrl: `/api/etiquettes/${id}/image`,
    });
  } catch (error: any) {
    console.error('Failed to upload etiquette image:', error);
    return NextResponse.json(
      { message: error?.message || 'خطا در پردازش و ذخیره تصویر محصول.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/etiquettes/[id]/image
 * Removes the image from an etiquette.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.edit') &&
    !hasPermission(context.user, 'document.manage') &&
    context.user.role !== 'admin'
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ message: 'شناسه اتیکت الزامی است.' }, { status: 400 });
  }

  const writer = await writerFor(context);
  if (!writer) {
    return NextResponse.json({ message: 'اتصال به پایگاه داده برقرار نشد.' }, { status: 500 });
  }

  try {
    const existing = await writer.collection('etiquettes').getOne(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ message: 'اتیکت مورد نظر یافت نشد.' }, { status: 404 });
    }

    const updateFormData = new FormData();
    updateFormData.append('image', '');

    const updated = await writer.collection('etiquettes').update(id, updateFormData);

    return NextResponse.json({
      success: true,
      message: 'تصویر با موفقیت حذف گردید.',
      item: mapEtiquetteRecord(updated),
    });
  } catch (error: any) {
    console.error('Failed to delete etiquette image:', error);
    return NextResponse.json(
      { message: error?.message || 'خطا در حذف تصویر اتیکت.' },
      { status: 500 },
    );
  }
}
