import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';

function isValidNationalCode(value: string) {
  return /^\d{10}$/.test(value);
}

export async function PATCH(request: Request) {
  const context = await getServerAuthContext();

  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  const formData = await request.formData();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const nationalCode = String(formData.get('nationalCode') ?? '').trim();
  const twoFactorEnabled = formData.get('twoFactorEnabled') === 'true';
  const removeAvatar = formData.get('removeAvatar') === 'true';
  const avatarEntry = formData.get('avatar');
  const avatar = avatarEntry instanceof File && avatarEntry.size > 0
    ? avatarEntry
    : null;

  if (!name || name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { message: 'نام باید حداقل ۲ حرف داشته باشد.' },
      { status: 400 },
    );
  }

  if (email && email !== context.user.email) {
    if (!email.includes('@') || email.length > 200) {
      return NextResponse.json(
        { message: 'ایمیل معتبر وارد کنید.' },
        { status: 400 },
      );
    }
  }

  if (nationalCode && !isValidNationalCode(nationalCode)) {
    return NextResponse.json(
      { message: 'کد ملی باید دقیقاً ۱۰ رقم باشد.' },
      { status: 400 },
    );
  }

  const nationalCodeChanged = nationalCode !== (context.user.nationalCode ?? '');

  if (
    context.user.nationalCode
    && nationalCodeChanged
    && !context.user.nationalCodeEditable
  ) {
    return NextResponse.json(
      { message: 'ویرایش کد ملی شما هنوز توسط مدیر مجاز نشده است.' },
      { status: 403 },
    );
  }

  if (avatar && !avatar.type.startsWith('image/')) {
    return NextResponse.json(
      { message: 'آواتار باید یک فایل تصویری باشد.' },
      { status: 400 },
    );
  }

  if (avatar && avatar.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { message: 'حجم آواتار نباید بیشتر از ۵ مگابایت باشد.' },
      { status: 400 },
    );
  }

  try {
    const previousName = context.user.name ?? '';
    const previousEmail = context.user.email ?? '';
    const previousTwoFactor = context.user.twoFactorEnabled === true;
    const updateData = new FormData();
    updateData.append('name', name);
    updateData.append('twoFactorEnabled', String(twoFactorEnabled));

    if (
      nationalCodeChanged
      && context.user.nationalCode
      && context.user.nationalCodeEditable
    ) {
      updateData.append('nationalCodeEditable', 'false');
    }

    updateData.append('nationalCode', nationalCode);

    if (avatar) {
      updateData.append('avatar', avatar, avatar.name);
    }

    if (removeAvatar && !avatar) {
      updateData.append('avatar', '');
    }

    await context.pb.collection('users').update(context.user.id, updateData);

    let emailChangeRequested = false;

    if (email && email !== context.user.email) {
      await context.pb.collection('users').requestEmailChange(email);
      emailChangeRequested = true;
    }

    if (name !== previousName) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'name_changed',
        request,
        details: 'نام کاربری تغییر کرد',
        authenticatedClient: context.pb,
      });
    }
    if (emailChangeRequested && email !== previousEmail) {
      await recordAuditEvent({
        userId: context.user.id,
        event: 'email_change_requested',
        request,
        details: 'درخواست تغییر ایمیل ثبت شد',
        authenticatedClient: context.pb,
      });
    }
    if (twoFactorEnabled !== previousTwoFactor) {
      await recordAuditEvent({
        userId: context.user.id,
        event: twoFactorEnabled ? 'two_factor_enabled' : 'two_factor_disabled',
        request,
        details: twoFactorEnabled
          ? 'تایید دومرحله‌ای فعال شد'
          : 'تایید دومرحله‌ای غیرفعال شد',
        authenticatedClient: context.pb,
      });
    }

    return NextResponse.json({
      success: true,
      emailChangeRequested,
      message: emailChangeRequested
        ? 'اطلاعات ذخیره شد؛ برای تغییر ایمیل، لینک تایید را بررسی کنید.'
        : 'اطلاعات حساب ذخیره شد.',
    });
  } catch {
    return NextResponse.json(
      { message: 'ذخیره اطلاعات حساب انجام نشد.' },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  const context = await getServerAuthContext();

  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  try {
    const updateData = new FormData();
    updateData.append('avatar', '');
    await context.pb.collection('users').update(context.user.id, updateData);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: 'حذف آواتار انجام نشد.' },
      { status: 400 },
    );
  }
}
