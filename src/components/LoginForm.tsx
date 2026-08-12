'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pocketbase';

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isDisabled = useMemo(() => {
    return loading || !email.trim() || !password.trim();
  }, [email, password, loading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      await pb.collection('users').authWithPassword(email, password);
      router.push('/dashboard');
      router.refresh();
    } catch (error) {
      setErrorMessage('ایمیل یا رمز عبور اشتباه است.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="gooey-blob gooey-blob-1" />
      <div className="gooey-blob gooey-blob-2" />
      <div className="gooey-blob gooey-blob-3" />

      <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/8 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">ورود</h1>
          <p className="mt-2 text-sm text-white/70">
            برای ورود به داشبورد، ایمیل و رمز عبور را وارد کن
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-white/85">ایمیل</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@email.com"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-400/60 focus:bg-black/30"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/85">رمز عبور</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="رمز عبور"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-white/30 focus:border-fuchsia-400/60 focus:bg-black/30"
            />
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isDisabled}
            className="group relative flex h-12 w-full items-center justify-center overflow-hidden rounded-2xl bg-white font-semibold text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.95),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.9),transparent_45%),linear-gradient(135deg,#ffffff,#dbeafe)] opacity-100 transition group-hover:scale-105" />
            <span className="relative z-10">
              {loading ? 'در حال ورود...' : 'ورود به داشبورد'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
