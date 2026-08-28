import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { getServerAppSettings } from '@/lib/server-settings';

export const runtime = 'nodejs';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function sanitizeSvg(svgContent: string): boolean {
  const lower = svgContent.toLowerCase();
  if (
    lower.includes('<script') ||
    lower.includes('javascript:') ||
    lower.includes('onload=') ||
    lower.includes('onerror=') ||
    lower.includes('onclick=') ||
    lower.includes('onmouseover=')
  ) {
    return false;
  }
  return true;
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز جهت تغییر لوگو.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'فایلی ارسال نشده است.' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { message: 'فرمت فایل مجاز نیست. فقط فایل‌های PNG، JPG، WebP و SVG مجاز هستند.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { message: 'حجم فایل بیشتر از ۵ مگابایت است.' },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (file.type === 'image/svg+xml') {
      const svgText = buffer.toString('utf-8');
      if (!sanitizeSvg(svgText)) {
        return NextResponse.json(
          { message: 'فایل SVG ارسالی شامل کدهای غیرمجاز یا اسکریپت است.' },
          { status: 400 },
        );
      }
    }

    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64;${base64Data}`;

    // Update settings
    const settings = await getServerAppSettings();
    const updatedSettings = {
      ...settings,
      printLogoUrl: dataUrl,
    };

    const records = await context.pb.collection('app_settings').getFullList({ sort: '-created' });
    if (records.length > 0) {
      await context.pb.collection('app_settings').update(records[0].id, {
        printLogoUrl: dataUrl,
      });
    } else {
      await context.pb.collection('app_settings').create({
        printLogoUrl: dataUrl,
      });
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `آپلود لوگوی فروشگاه (${file.name})`,
      entityType: 'app_settings',
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      logoUrl: dataUrl,
      message: 'لوگو با موفقیت ذخیره شد.',
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ message: 'خطا در بارگذاری لوگو.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز جهت حذف لوگو.' }, { status: 403 });
  }

  try {
    const records = await context.pb.collection('app_settings').getFullList({ sort: '-created' });
    if (records.length > 0) {
      await context.pb.collection('app_settings').update(records[0].id, {
        printLogoUrl: '',
      });
    }

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: 'حذف لوگوی فروشگاه',
      entityType: 'app_settings',
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      success: true,
      logoUrl: '',
      message: 'لوگو با موفقیت حذف شد.',
    });
  } catch (error) {
    console.error('Logo delete error:', error);
    return NextResponse.json({ message: 'خطا در حذف لوگو.' }, { status: 500 });
  }
}
