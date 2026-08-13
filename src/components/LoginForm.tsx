'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, LockKeyhole, Mail, Phone } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'email' | 'phone'>('email');
  const [phone, setPhone] = useState('');
  const [phoneChallenge, setPhoneChallenge] = useState<{ id: string; expiresAt: number } | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'totp'>('email');
  const [mfaChallenge, setMfaChallenge] = useState<{
    mfaId: string;
    otpId?: string;
    authenticatorAvailable: boolean;
    emailOtpAvailable: boolean;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const isDisabled = useMemo(
    () =>
      loading
      || (loginMode === 'email' && (!email.trim() || !password))
      || (loginMode === 'phone' && (!phone.trim() || (phoneChallenge && phoneCode.length !== 6)))
      || Boolean(
        mfaChallenge
        && (authMethod === 'email' ? !otpCode.trim() : !totpCode.trim()),
      ),
    [authMethod, email, loading, loginMode, mfaChallenge, otpCode, password, phone, phoneChallenge, phoneCode, totpCode],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      if (loginMode === 'phone') {
        const endpoint = phoneChallenge ? '/api/auth/bale/verify' : '/api/auth/bale/request';
        const payload = phoneChallenge
          ? { phone, challengeId: phoneChallenge.id, code: phoneCode }
          : { phone };
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => null)) as
          | { message?: string; challengeId?: string; expiresIn?: number; needsBaleLink?: boolean }
          | null;
        if (!response.ok) {
          setErrorMessage(data?.message ?? 'ورود با تلفن انجام نشد.');
          return;
        }
        if (!phoneChallenge && data?.challengeId) {
          setPhoneChallenge({
            id: data.challengeId,
            expiresAt: Date.now() + (data.expiresIn ?? 120) * 1000,
          });
          setErrorMessage('کد ورود در بله ارسال شد. تا ۱۲۰ ثانیه فرصت دارید.');
          return;
        }
        router.replace('/dashboard');
        router.refresh();
        return;
      }

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

        <form ref={formRef} onSubmit={handleSubmit} className="login-form">
          <div className="mfa-method-switcher login-mode-switcher">
            <button type="button" className={loginMode === 'email' ? 'is-active' : ''} onClick={() => { setLoginMode('email'); setPhoneChallenge(null); setErrorMessage(''); }}>ورود با ایمیل</button>
            <button type="button" className={loginMode === 'phone' ? 'is-active' : ''} onClick={() => { setLoginMode('phone'); setMfaChallenge(null); setErrorMessage(''); }}>ورود با تلفن و بله</button>
          </div>

          {loginMode === 'phone' ? (
            <div className="field">
              <label htmlFor="login-phone">شماره تلفن همراه</label>
              <div className="field-shell">
                <Phone className="field-icon" size={18} aria-hidden="true" />
                <input id="login-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="۰۹۱۲۱۲۳۴۵۶۷۸" value={phone} onChange={(event) => setPhone(event.target.value)} required />
              </div>
              {phoneChallenge ? <small className="mfa-hint">کد ۶ رقمی ارسال‌شده در بله را وارد کنید.</small> : null}
            </div>
          ) : null}

          {loginMode === 'phone' && phoneChallenge ? (
            <div className="field">
              <label htmlFor="bale-code">کد ورود بله</label>
              <div className="field-shell">
                <input id="bale-code" inputMode="numeric" autoComplete="one-time-code" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />
              </div>
            </div>
          ) : null}

          {loginMode === 'email' ? <div className="field">
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
          </div> : null}

          {loginMode === 'email' && !mfaChallenge ? (
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
          ) : loginMode === 'email' ? (
            <div className="field">
              {mfaChallenge ? <div className="mfa-method-switcher">
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
              </div> : null}
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
                  onChange={(event) => {
                    const nextValue = authMethod === 'email'
                      ? event.target.value.replace(/\D/g, '').slice(0, 6)
                      : event.target.value.replace(/\D/g, '').slice(0, 6);

                    if (authMethod === 'email') {
                      setOtpCode(nextValue);
                    } else {
                      setTotpCode(nextValue);
                    }

                    if (nextValue.length === 6 && !loading) {
                      window.setTimeout(() => formRef.current?.requestSubmit(), 0);
                    }
                  }}
                  required
                />
              </div>
              <small className="mfa-hint">
                {authMethod === 'email'
                  ? 'کد یک‌بارمصرف را از ایمیل خود وارد کنید.'
                  : 'کد فعلی را از برنامه Google Authenticator یا رمزساز مشابه وارد کنید.'}
              </small>
            </div>
          ) : null}

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
                : loginMode === 'phone'
                  ? phoneChallenge ? 'تایید کد بله' : 'ارسال کد در بله'
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
