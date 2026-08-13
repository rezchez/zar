'use client';

import {
  Camera,
  Check,
  ImagePlus,
  KeyRound,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useRef, useState } from 'react';

type AccountUser = {
  name?: string;
  email?: string;
  nationalCode?: string;
  nationalCodeEditable: boolean;
  phone?: string;
  phoneEditable: boolean;
  twoFactorEnabled: boolean;
  authenticatorEnabled: boolean;
  avatarUrl?: string;
};

export default function AccountSettings({ user }: { user: AccountUser }) {
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [nationalCode, setNationalCode] = useState(user.nationalCode ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user.twoFactorEnabled);
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(
    user.authenticatorEnabled,
  );
  const [authenticatorSetup, setAuthenticatorSetup] = useState<{
    secret: string;
    qrDataUrl: string;
  } | null>(null);
  const [authenticatorCode, setAuthenticatorCode] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function saveProfile() {
    setLoading(true);
    setMessage('');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('nationalCode', nationalCode);
    formData.append('phone', phone);
    formData.append('twoFactorEnabled', String(twoFactorEnabled));
    formData.append('removeAvatar', String(removeAvatar));
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? 'ذخیره اطلاعات انجام نشد.');
        return;
      }

      setMessage(data?.message ?? 'اطلاعات ذخیره شد.');
      setAvatarFile(null);
      if (removeAvatar && !avatarFile) {
        setAvatarUrl('');
      }
      setRemoveAvatar(false);
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAvatar() {
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/account/profile', { method: 'DELETE' });
      if (!response.ok) {
        setErrorMessage('حذف آواتار انجام نشد.');
        return;
      }

      setAvatarUrl('');
      setAvatarFile(null);
      setRemoveAvatar(false);
      setMessage('آواتار حذف شد.');
    } catch {
      setErrorMessage('حذف آواتار انجام نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function setupAuthenticator() {
    setLoading(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetch('/api/account/authenticator/setup', { method: 'POST' });
      const data = (await response.json().catch(() => null)) as
        | { secret?: string; qrDataUrl?: string; message?: string }
        | null;

      if (!response.ok || !data?.secret || !data.qrDataUrl) {
        setErrorMessage(data?.message ?? 'راه‌اندازی رمزساز انجام نشد.');
        return;
      }

      setAuthenticatorSetup({ secret: data.secret, qrDataUrl: data.qrDataUrl });
      setAuthenticatorCode('');
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyAuthenticator() {
    setLoading(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetch('/api/account/authenticator/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authenticatorCode }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? 'تایید رمزساز انجام نشد.');
        return;
      }

      setAuthenticatorEnabled(true);
      setAuthenticatorSetup(null);
      setAuthenticatorCode('');
      setMessage(data?.message ?? 'رمزساز فعال شد.');
    } catch {
      setErrorMessage('تایید رمزساز انجام نشد.');
    } finally {
      setLoading(false);
    }
  }

  async function disableAuthenticator() {
    setLoading(true);
    setErrorMessage('');
    setMessage('');

    try {
      const response = await fetch('/api/account/authenticator/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: authenticatorCode }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? 'غیرفعال‌سازی رمزساز انجام نشد.');
        return;
      }

      setAuthenticatorEnabled(false);
      setAuthenticatorCode('');
      setMessage(data?.message ?? 'رمزساز غیرفعال شد.');
    } catch {
      setErrorMessage('غیرفعال‌سازی رمزساز انجام نشد.');
    } finally {
      setLoading(false);
    }
  }

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarUrl(URL.createObjectURL(file));
  }

  return (
    <div className="account-settings-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">حساب کاربری</p>
          <h1>مدیریت حساب</h1>
          <p>اطلاعات شخصی و تنظیمات امنیتی خود را مدیریت کنید.</p>
        </div>
      </div>

      {message ? (
        <p className="account-message"><Check size={16} />{message}</p>
      ) : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <div className="account-settings-grid">
        <section className="dashboard-panel account-profile-panel">
          <div className="account-panel-heading">
            <div>
              <p className="eyebrow">پروفایل</p>
              <h2>اطلاعات شخصی</h2>
            </div>
            <UserRound size={20} />
          </div>

          <div className="account-avatar-editor">
            <div className="account-avatar-preview">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="آواتار کاربر" />
              ) : (
                <span>{(name || email || 'ک').charAt(0)}</span>
              )}
            </div>
            <div className="account-avatar-actions">
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={15} />
                انتخاب آواتار
              </button>
              <button
                type="button"
                className="account-danger-button"
                onClick={() => void deleteAvatar()}
                disabled={loading || (!avatarUrl && !avatarFile)}
              >
                <Trash2 size={15} />
                حذف
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={chooseAvatar}
              />
            </div>
          </div>

          <div className="account-fields">
            <label className="account-field">
              <span><UserRound size={15} />نام و نام خانوادگی</span>
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="account-field">
              <span><Phone size={15} />تلفن همراه</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                disabled={Boolean(user.phone) && !user.phoneEditable}
                onChange={(event) => setPhone(event.target.value)}
              />
              <small>
                {user.phone && !user.phoneEditable
                  ? 'ویرایش این مقدار باید توسط مدیر مجاز شود.'
                  : 'شماره تلفن همراه تکراری قابل ثبت نیست.'}
              </small>
            </label>
            <label className="account-field">
              <span><Mail size={15} />ایمیل</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <small>تغییر ایمیل با لینک تایید انجام می‌شود.</small>
            </label>
            <label className="account-field">
              <span><KeyRound size={15} />کد ملی</span>
              <input
                inputMode="numeric"
                maxLength={10}
                value={nationalCode}
                disabled={Boolean(user.nationalCode) && !user.nationalCodeEditable}
                onChange={(event) =>
                  setNationalCode(event.target.value.replace(/\D/g, ''))
                }
              />
              <small>
                {user.nationalCode && !user.nationalCodeEditable
                  ? 'ویرایش این مقدار باید توسط مدیر مجاز شود.'
                  : 'کد ملی دقیقاً ۱۰ رقم است.'}
              </small>
            </label>
          </div>
        </section>

        <section className="dashboard-panel account-security-panel">
          <div className="account-panel-heading">
            <div>
              <p className="eyebrow">امنیت</p>
              <h2>تایید دومرحله‌ای</h2>
            </div>
            <ShieldCheck size={20} />
          </div>

          <div className="security-card">
            <div className="security-card-icon"><ShieldCheck size={20} /></div>
            <div>
              <strong>تایید با کد ایمیلی</strong>
              <p>
                بعد از فعال‌سازی، هنگام ورود علاوه بر رمز عبور کد یک‌بارمصرف ایمیلی
                نیز لازم است.
              </p>
            </div>
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={twoFactorEnabled}
                onChange={(event) => setTwoFactorEnabled(event.target.checked)}
              />
              <span />
            </label>
          </div>

          <div className="account-security-note">
            <Camera size={16} />
            آدرس ایمیل حساب باید فعال باشد تا کد تایید را دریافت کنید.
          </div>

          <div className="authenticator-card">
            <div className="account-panel-heading">
              <div>
                <p className="eyebrow">امنیت پیشرفته</p>
                <h2>رمزساز Authenticator</h2>
              </div>
              <KeyRound size={20} />
            </div>
            <p className="authenticator-description">
              با فعال‌سازی، هنگام ورود می‌توانید به‌جای کد ایمیل از کد برنامه
              Google Authenticator یا برنامه‌های سازگار با TOTP استفاده کنید.
            </p>

            {authenticatorEnabled ? (
              <>
                <span className="security-enabled-badge">رمزساز فعال است</span>
                <label className="account-field">
                  <span><KeyRound size={15} />کد فعلی برای غیرفعال‌سازی</span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={authenticatorCode}
                    onChange={(event) =>
                      setAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="کد ۶ رقمی"
                  />
                </label>
                <button
                  type="button"
                  className="account-danger-button"
                  onClick={() => void disableAuthenticator()}
                  disabled={loading || authenticatorCode.length !== 6}
                >
                  غیرفعال‌سازی رمزساز
                </button>
              </>
            ) : authenticatorSetup ? (
              <div className="authenticator-setup">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={authenticatorSetup.qrDataUrl} alt="QR رمزساز" />
                <div>
                  <strong>QR را با برنامه رمزساز اسکن کنید</strong>
                  <small>
                    اگر اسکن ممکن نیست، این کلید را دستی وارد کنید:
                  </small>
                  <code>{authenticatorSetup.secret}</code>
                  <label className="account-field">
                    <span>کد شش‌رقمی برنامه</span>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={authenticatorCode}
                      onChange={(event) =>
                        setAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="کد فعلی"
                    />
                  </label>
                  <button
                    type="button"
                    className="account-save-button"
                    onClick={() => void verifyAuthenticator()}
                    disabled={loading || authenticatorCode.length !== 6}
                  >
                    <ShieldCheck size={16} />
                    تایید و فعال‌سازی
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="dashboard-secondary-button"
                onClick={() => void setupAuthenticator()}
                disabled={loading}
              >
                <KeyRound size={15} />
                راه‌اندازی رمزساز
              </button>
            )}
          </div>
        </section>
      </div>

      <button
        type="button"
        className="account-save-button"
        onClick={() => void saveProfile()}
        disabled={loading}
      >
        <Save size={16} />
        {loading ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
      </button>
    </div>
  );
}
