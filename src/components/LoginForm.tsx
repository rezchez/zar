'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'totp'>('email');
  const [mfaChallenge, setMfaChallenge] = useState<{
    mfaId: string;
    otpId?: string;
    authenticatorAvailable: boolean;
    emailOtpAvailable: boolean;
  } | null>(null);

  const isDisabled = useMemo(
    () =>
      loading
      || !email.trim()
      || !password
      || Boolean(
        mfaChallenge
        && (authMethod === 'email' ? !otpCode.trim() : !totpCode.trim()),
      ),
    [authMethod, email, loading, mfaChallenge, otpCode, password, totpCode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          mfaId: mfaChallenge?.mfaId,
          otpId: mfaChallenge?.otpId,
          otpCode,
          totpCode,
          authMethod,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | {
              message?: string;
              mfaRequired?: boolean;
              mfaId?: string;
              otpId?: string;
              authenticatorAvailable?: boolean;
              emailOtpAvailable?: boolean;
            }
          | null;

        if (
          data?.mfaRequired
          && data.mfaId
          && (data.authenticatorAvailable || data.otpId)
        ) {
          const hasAuthenticator = data.authenticatorAvailable === true;
          const hasEmailOtp = data.emailOtpAvailable === true || Boolean(data.otpId);
          setMfaChallenge({
            mfaId: data.mfaId,
            otpId: data.otpId,
            authenticatorAvailable: hasAuthenticator,
            emailOtpAvailable: hasEmailOtp,
          });
          setAuthMethod(hasAuthenticator && !hasEmailOtp ? 'totp' : 'email');
          setErrorMessage(data.message ?? 'کد تایید به ایمیل شما ارسال شد.');
          return;
        }

        setErrorMessage(data?.message ?? 'ورود انجام نشد.');
        return;
      }

      setMfaChallenge(null);
      setOtpCode('');
      setTotpCode('');
      setAuthMethod('email');
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setErrorMessage(
        'ارتباط با سرور برقرار نشد. مطمئن شوید PocketBase در حال اجراست.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="gooey-page" dir="rtl">
      <div className="gooey-background" aria-hidden="true">
        <div className="gooey-blob gooey-blob-one" />
        <div className="gooey-blob gooey-blob-two" />
        <div className="gooey-blob gooey-blob-three" />
      </div>

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand" aria-hidden="true">
          Z
        </div>

        <div className="login-heading">
          <p className="eyebrow">ZARFOLIO</p>
          <h1 id="login-title">ورود به حساب</h1>
          <p>برای ورود به داشبورد، اطلاعات حساب خود را وارد کنید.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="email">ایمیل</label>
            <div className="field-shell">
              <Mail className="field-icon" size={18} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </div>

          {!mfaChallenge ? (
            <div className="field">
            <label htmlFor="password">رمز عبور</label>
            <div className="field-shell">
              <LockKeyhole className="field-icon" size={18} aria-hidden="true" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="رمز عبور خود را وارد کنید"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            </div>
          ) : (
            <div className="field">
              <div className="mfa-method-switcher">
                <button
                  type="button"
                  className={authMethod === 'email' ? 'is-active' : ''}
                  disabled={!mfaChallenge.emailOtpAvailable}
                  onClick={() => setAuthMethod('email')}
                >
                  کد ایمیلی
                </button>
                {mfaChallenge.authenticatorAvailable ? (
                  <button
                    type="button"
                    className={authMethod === 'totp' ? 'is-active' : ''}
                    onClick={() => setAuthMethod('totp')}
                  >
                    رمزساز
                  </button>
                ) : null}
              </div>
              <label htmlFor={authMethod === 'email' ? 'otp-code' : 'totp-code'}>
                {authMethod === 'email' ? 'کد تایید ایمیل' : 'کد Authenticator'}
              </label>
              <div className="field-shell">
                <input
                  id={authMethod === 'email' ? 'otp-code' : 'totp-code'}
                  name={authMethod === 'email' ? 'otpCode' : 'totpCode'}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={
                    authMethod === 'email'
                      ? 'کد ارسال‌شده به ایمیل'
                      : 'کد ۶ رقمی رمزساز'
                  }
                  value={authMethod === 'email' ? otpCode : totpCode}
                  onChange={(event) =>
                    authMethod === 'email'
                      ? setOtpCode(event.target.value)
                      : setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </div>
              <small className="mfa-hint">
                {authMethod === 'email'
                  ? 'کد یک‌بارمصرف را از ایمیل خود وارد کنید.'
                  : 'کد فعلی را از برنامه Google Authenticator یا رمزساز مشابه وارد کنید.'}
              </small>
            </div>
          )}

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button type="submit" disabled={isDisabled}>
            {loading
              ? 'در حال بررسی...'
              : mfaChallenge
                ? 'تایید و ورود'
                : 'ورود به داشبورد'}
          </button>
        </form>

        {mfaChallenge ? (
          <button
            type="button"
            className="mfa-cancel-button"
            onClick={() => {
              setMfaChallenge(null);
              setOtpCode('');
              setTotpCode('');
              setAuthMethod('email');
              setErrorMessage('');
            }}
          >
            بازگشت به ورود با رمز
          </button>
        ) : null}

        <p className="auth-switch">
          حساب کاربری ندارید؟ <Link href="/register">ثبت‌نام کنید</Link>
        </p>
      </section>
    </main>
  );
}
