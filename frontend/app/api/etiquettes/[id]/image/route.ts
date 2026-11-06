import { NextRequest, NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { imageService } from '@/lib/images';
import { sanitizeFileNameBase } from '@/lib/images/image-storage';
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
  request: NextRequest,
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

    const filenames = (Array.isArray(record.image) ? record.image : [record.image])
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
    const requestedName = new URL(request.url).searchParams.get('name');
    const filename = requestedName ? filenames.find((name: string) => name === requestedName) : filenames[0];
    if (!filename) {
      return NextResponse.json({ message: 'تصویری برای این اتیکت ثبت نشده است.' }, { status: 404 });
    }

    const pbFileUrl = `${POCKETBASE_URL}/api/files/etiquettes/${id}/${encodeURIComponent(filename)}`;
    const fileHeaders = new Headers();
    const pocketBaseToken = context.pb.authStore.token;
    if (pocketBaseToken) fileHeaders.set('Authorization', `Bearer ${pocketBaseToken}`);
    const res = await fetch(pbFileUrl, { headers: fileHeaders, cache: 'no-store' });

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

    const existingImages = (Array.isArray(existing.image) ? existing.image : [existing.image])
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
    const replaceName = formData.get('replace')?.toString();
    if (replaceName && !existingImages.includes(replaceName)) {
      return NextResponse.json({ message: 'تصویر انتخاب‌شده برای جایگزینی متعلق به این اتیکت نیست.' }, { status: 404 });
    }
    if (!replaceName && existingImages.length >= 5) {
      return NextResponse.json({ message: 'هر اتیکت حداکثر می‌تواند ۵ تصویر داشته باشد.' }, { status: 409 });
    }

    // Use the etiquette barcode as the stable filename stem. Additional
    // photos get a numbered suffix so PocketBase never replaces an earlier
    // image with the same filename (for example ETK-000042-2.webp).
    const filenameBase = sanitizeFileNameBase(String(existing.barcode || existing.item_code || id));
    const retainedImages = existingImages.filter((name: string) => name !== replaceName);
    const retainedStems = new Set(retainedImages.map((name) => name.replace(/\.[^.]+$/, '')));
    const replacedStem = replaceName?.replace(/\.[^.]+$/, '');
    let uploadStem = replacedStem && !retainedStems.has(replacedStem) ? replacedStem : filenameBase;
    if (retainedStems.has(uploadStem)) {
      let suffix = 2;
      while (retainedStems.has(`${filenameBase}-${suffix}`)) suffix += 1;
      uploadStem = `${filenameBase}-${suffix}`;
    }

    // Validate and process image to WebP format. Source encoding may be JPEG,
    // PNG or WebP; storage is normalized to WebP on the server.
    const uploadResult = await imageService.processUpload({
      file: imageFile,
      purpose: 'jewelry',
      entityId: id,
      filenameBase: uploadStem,
      declaredMimeType: imageFile.type,
    });

    const updateFormData = new FormData();
    retainedImages.forEach((name: string) => updateFormData.append('image', name));
    if (replaceName) updateFormData.append('image-', replaceName);
    updateFormData.append('image', uploadResult.file, uploadResult.filename);

    const updated = await writer.collection('etiquettes').update(id, updateFormData);

    return NextResponse.json({
      success: true,
      message: 'تصویر محصول طلا با موفقیت ذخیره شد.',
      item: mapEtiquetteRecord(updated),
      imageUrl: `/api/etiquettes/${id}/image`,
      images: (Array.isArray(updated.image) ? updated.image : [updated.image]).filter(Boolean),
      imageUrls: (Array.isArray(updated.image) ? updated.image : [updated.image]).filter(Boolean).map((name: string) => `/api/etiquettes/${id}/image?name=${encodeURIComponent(name)}`),
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
 * PATCH /api/etiquettes/[id]/image
 * Moves an existing image to the first position so it becomes the main image
 * used for the etiquette thumbnail.
 */
export async function PATCH(
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
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای تغییر تصویر اصلی اتیکت.' }, { status: 403 });
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
    const body = await request.json();
    const requestedName = typeof body?.name === 'string' ? body.name : '';
    if (!requestedName) {
      return NextResponse.json({ message: 'نام عکس اصلی الزامی است.' }, { status: 400 });
    }

    const existing = await writer.collection('etiquettes').getOne(id);
    if (!existing || existing.is_deleted) {
      return NextResponse.json({ message: 'اتیکت مورد نظر یافت نشد.' }, { status: 404 });
    }

    const existingImages = (Array.isArray(existing.image) ? existing.image : [existing.image])
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
    if (!existingImages.includes(requestedName)) {
      return NextResponse.json({ message: 'تصویر برای این اتیکت یافت نشد.' }, { status: 404 });
    }

    const updateFormData = new FormData();
    [requestedName, ...existingImages.filter((name: string) => name !== requestedName)]
      .forEach((name: string) => updateFormData.append('image', name));
    const updated = await writer.collection('etiquettes').update(id, updateFormData);

    return NextResponse.json({
      success: true,
      message: 'تصویر اصلی اتیکت به‌روز شد.',
      item: mapEtiquetteRecord(updated),
      images: (Array.isArray(updated.image) ? updated.image : [updated.image]).filter(Boolean),
      imageUrls: (Array.isArray(updated.image) ? updated.image : [updated.image]).filter(Boolean).map((name: string) => `/api/etiquettes/${id}/image?name=${encodeURIComponent(name)}`),
    });
  } catch (error: any) {
    console.error('Failed to set primary etiquette image:', error);
    return NextResponse.json(
      { message: error?.message || 'خطا در تغییر تصویر اصلی اتیکت.' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/etiquettes/[id]/image
 * Removes the image from an etiquette.
 */
export async function DELETE(
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

    const existingImages = (Array.isArray(existing.image) ? existing.image : [existing.image])
      .filter((value: unknown): value is string => typeof value === 'string' && value.length > 0);
    const requestedName = new URL(request.url).searchParams.get('name');
    if (requestedName && !existingImages.includes(requestedName)) {
      return NextResponse.json({ message: 'تصویر برای این اتیکت یافت نشد.' }, { status: 404 });
    }
    const updateFormData = new FormData();
    if (requestedName) {
      existingImages.filter((name: string) => name !== requestedName).forEach((name: string) => updateFormData.append('image', name));
      updateFormData.append('image-', requestedName);
    } else {
      existingImages.forEach((name: string) => updateFormData.append('image-', name));
    }

    const updated = await writer.collection('etiquettes').update(id, updateFormData);

    return NextResponse.json({
      success: true,
      message: 'تصویر با موفقیت حذف گردید.',
      item: mapEtiquetteRecord(updated),
      images: (Array.isArray(updated.image) ? updated.image : [updated.image]).filter(Boolean),
      imageUrls: (Array.isArray(updated.image) ? updated.image : [updated.image]).filter(Boolean).map((name: string) => `/api/etiquettes/${id}/image?name=${encodeURIComponent(name)}`),
    });
  } catch (error: any) {
    console.error('Failed to delete etiquette image:', error);
    return NextResponse.json(
      { message: error?.message || 'خطا در حذف تصویر اتیکت.' },
      { status: 500 },
    );
  }
}
