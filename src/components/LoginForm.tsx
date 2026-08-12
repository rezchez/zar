'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isDisabled = useMemo(
    () => loading || !email.trim() || !password,
    [email, password, loading],
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
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;

        setErrorMessage(data?.message ?? 'ورود انجام نشد.');
        return;
      }

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

          <div className="field">
            <label htmlFor="password">رمز عبور</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="رمز عبور خود را وارد کنید"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {errorMessage ? (
            <p className="form-error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button type="submit" disabled={isDisabled}>
            {loading ? 'در حال بررسی...' : 'ورود به داشبورد'}
          </button>
        </form>
      </section>
    </main>
  );
}
