import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';

function isAllowed(context: Awaited<ReturnType<typeof getServerAuthContext>>) {
  return context && (context.user.role === 'admin' || context.user.role === 'manager');
}

export type CustomFontRecord = {
  id: string;
  displayName: string;
  fontFamily: string;
  fontFile: string;
  fontUrl: string;
  format: string;
  availableWeights: number[];
  isActive: boolean;
  uploadedBy?: string;
  created: string;
  updated: string;
};

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 401 });
  }

  try {
    const records = await context.pb.collection('custom_fonts').getFullList({
      sort: '-created',
    });

    const fonts: CustomFontRecord[] = records.map((record) => {
      const file = String(record.fontFile ?? '');
      const fontUrl = context.pb.files.getURL(record, file);
      let weights: number[] = [400];
      if (Array.isArray(record.availableWeights)) {
        weights = record.availableWeights.map(Number).filter((n) => !Number.isNaN(n));
      } else if (typeof record.availableWeights === 'string') {
        try {
          weights = JSON.parse(record.availableWeights);
        } catch {
          weights = [400];
        }
      }

      return {
        id: record.id,
        displayName: record.displayName || 'فونت سفارشی',
        fontFamily: record.fontFamily || 'CustomFont',
        fontFile: file,
        fontUrl,
        format: record.format || 'woff2',
        availableWeights: weights.length > 0 ? weights : [400],
        isActive: record.isActive !== false,
        uploadedBy: record.uploadedBy,
        created: record.created,
        updated: record.updated,
      };
    });

    return NextResponse.json({ fonts });
  } catch {
    return NextResponse.json({ fonts: [] });
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!isAllowed(context)) {
    return NextResponse.json({ message: 'شما دسترسی لازم برای افزودن فونت را ندارید.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const displayName = String(formData.get('displayName') ?? '').trim();
    const fontFamilyRaw = String(formData.get('fontFamily') ?? '').trim();
    const weightsRaw = formData.get('availableWeights');
    const file = formData.get('file');

    if (!displayName) {
      return NextResponse.json({ message: 'نام نمایشی فونت الزامی است.' }, { status: 400 });
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: 'فایل فونت انتخاب نشده است.' }, { status: 400 });
    }

    // Check size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ message: 'حجم فایل فونت نباید بیش از ۱۰ مگابایت باشد.' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const ext = filename.split('.').pop() || '';
    const validExts = ['woff2', 'woff', 'ttf', 'otf'];

    if (!validExts.includes(ext)) {
      return NextResponse.json({
        message: 'فرمت فایل نا‌معتبر است. فرمت‌های مجاز: woff2, woff, ttf, otf',
      }, { status: 400 });
    }

    const sanitizedFamily = fontFamilyRaw.replace(/[^a-zA-Z0-9_-]/g, '') || `Font_${Date.now()}`;

    let availableWeights: number[] = [400];
    if (typeof weightsRaw === 'string') {
      try {
        const parsed = JSON.parse(weightsRaw);
        if (Array.isArray(parsed)) {
          availableWeights = parsed.map(Number).filter((w) => w >= 100 && w <= 900);
        }
      } catch {
        const num = Number(weightsRaw);
        if (num >= 100 && num <= 900) availableWeights = [num];
      }
    }

    const pbPayload = new FormData();
    pbPayload.append('displayName', displayName);
    pbPayload.append('fontFamily', sanitizedFamily);
    pbPayload.append('format', ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext);
    pbPayload.append('availableWeights', JSON.stringify(availableWeights));
    pbPayload.append('isActive', 'true');
    pbPayload.append('uploadedBy', context.user.id);
    pbPayload.append('fontFile', file);

    const record = await context.pb.collection('custom_fonts').create(pbPayload);

    await recordAuditEvent({
      userId: context.user.id,
      event: 'settings_updated',
      request,
      details: `افزودن فونت سفارشی: ${displayName}`,
      entityType: 'custom_fonts',
      entityId: record.id,
      entityLabel: displayName,
      authenticatedClient: context.pb,
    });

    const fontUrl = context.pb.files.getURL(record, record.fontFile);

    return NextResponse.json({
      font: {
        id: record.id,
        displayName,
        fontFamily: sanitizedFamily,
        fontFile: record.fontFile,
        fontUrl,
        format: record.format,
        availableWeights,
        isActive: true,
        created: record.created,
        updated: record.updated,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطا در آپلود فایل فونت.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
