'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isDisabled = useMemo(
    () => loading || !name.trim() || !email.trim() || !phone.trim() || !password || !passwordConfirm,
    [email, loading, name, password, passwordConfirm, phone],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          passwordConfirm,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        setErrorMessage(data?.message ?? 'ثبت‌نام انجام نشد.');
        return;
      }

      router.replace('/');
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

      <section className="login-card register-card" aria-labelledby="register-title">
        <div className="login-brand" aria-hidden="true">Z</div>

        <div className="login-heading">
          <p className="eyebrow">ZARFOLIO</p>
          <h1 id="register-title">ساخت حساب جدید</h1>
          <p>حساب‌های جدید به‌صورت خودکار با نقش کاربر ساخته می‌شوند.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="register-phone">شماره تلفن همراه</label>
            <div className="field-shell">
              <Phone className="field-icon" size={18} aria-hidden="true" />
              <input
                id="register-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="۰۹۱۲۱۲۳۴۵۶۷۸"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="name">نام و نام خانوادگی</label>
            <div className="field-shell">
              <UserRound className="field-icon" size={18} aria-hidden="true" />
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="نام شما"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="register-email">ایمیل</label>
            <div className="field-shell">
              <Mail className="field-icon" size={18} aria-hidden="true" />
              <input
                id="register-email"
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

          <div className="field">
            <label htmlFor="register-password">رمز عبور</label>
            <div className="field-shell">
              <LockKeyhole className="field-icon" size={18} aria-hidden="true" />
              <input
                id="register-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="حداقل ۸ کاراکتر"
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

          <div className="field">
            <label htmlFor="password-confirm">تکرار رمز عبور</label>
            <div className="field-shell">
              <LockKeyhole className="field-icon" size={18} aria-hidden="true" />
              <input
                id="password-confirm"
                name="passwordConfirm"
                type={showPasswordConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="رمز عبور را دوباره وارد کنید"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPasswordConfirm((value) => !value)}
                aria-label={showPasswordConfirm ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
              >
                {showPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMessage ? (
            <p className="form-error" role="alert">{errorMessage}</p>
          ) : null}

          <button type="submit" disabled={isDisabled}>
            {loading ? 'در حال ساخت حساب...' : 'ساخت حساب'}
          </button>
        </form>

        <p className="auth-switch">
          قبلاً حساب ساخته‌اید؟ <Link href="/">وارد شوید</Link>
        </p>
      </section>
    </main>
  );
}
