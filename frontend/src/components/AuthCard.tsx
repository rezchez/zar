'use client';

import { FormEvent, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import { normalizeDigits } from '@/lib/jalali';

function digitsOnly(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 6);
}

// Google SVG Icon Component
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
      />
      <path
        fill="#FBBC05"
        d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.3s.7 2.6 1.9 5l3.7-2.5z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
      />
    </svg>
  );
}

interface AuthCardProps {
  initialMode?: 'login' | 'signup';
}

export default function AuthCard({ initialMode = 'login' }: AuthCardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Login Mode State: email or phone
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [phoneChallenge, setPhoneChallenge] = useState<{ id: string; expiresAt: number } | null>(null);
  const [phoneCode, setPhoneCode] = useState('');

  // MFA State
  const [otpCode, setOtpCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaAuthMethod, setMfaAuthMethod] = useState<'email' | 'totp'>('email');
  const [mfaChallenge, setMfaChallenge] = useState<{
    mfaId: string;
    otpId?: string;
    authenticatorAvailable: boolean;
    emailOtpAvailable: boolean;
  } | null>(null);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync mode if initialMode changes
  const [prevInitialMode, setPrevInitialMode] = useState(initialMode);
  if (initialMode !== prevInitialMode) {
    setPrevInitialMode(initialMode);
    setMode(initialMode);
    setErrorMessage('');
    setNoticeMessage('');
  }

  // 3D Tilt Effect on Desktop (Clean tilt without hover blur)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 200, damping: 25 });
  const mouseYSpring = useSpring(y, { stiffness: 200, damping: 25 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['6deg', '-6deg']);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-6deg', '6deg']);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) return;
      if (!cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const xPct = mouseX / width - 0.5;
      const yPct = mouseY / height - 0.5;

      x.set(xPct);
      y.set(yPct);
    },
    [x, y],
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  // Switch Mode Handler
  const handleSwitchMode = (targetMode: 'login' | 'signup') => {
    setErrorMessage('');
    setNoticeMessage('');
    setMfaChallenge(null);
    setPhoneChallenge(null);
    setMode(targetMode);
    if (targetMode === 'login') {
      router.push('/', { scroll: false });
    } else {
      router.push('/register', { scroll: false });
    }
  };

  // Google Sign In Handler
  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setErrorMessage('');
    setTimeout(() => {
      setGoogleLoading(false);
      setNoticeMessage('ورود با گوگل به‌زودی فعال می‌شود. لطفاً از ایمیل یا تلفن استفاده کنید.');
    }, 600);
  };

  // Forgot Password Handler
  const handleForgotPassword = () => {
    if (!email) {
      setErrorMessage('لطفاً ابتدا ایمیل خود را وارد کنید.');
      return;
    }
    setNoticeMessage(`لینک بازیابی رمز عبور به ${email} ارسال شد.`);
    setErrorMessage('');
  };

  // Submit Handler
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setNoticeMessage('');

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorMessage('لطفاً نام و نام خانوادگی را وارد کنید.');
        return;
      }
      if (!phone.trim()) {
        setErrorMessage('لطفاً شماره تلفن همراه را وارد کنید.');
        return;
      }
      if (!email.trim()) {
        setErrorMessage('لطفاً ایمیل خود را وارد کنید.');
        return;
      }
      if (!password || password.length < 8) {
        setErrorMessage('رمز عبور باید حداقل ۸ کاراکتر باشد.');
        return;
      }
      if (password !== passwordConfirm) {
        setErrorMessage('تکرار رمز عبور یکسان نیست.');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
            password,
            passwordConfirm,
          }),
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => null)) as { message?: string } | null;
          setErrorMessage(data?.message ?? 'ثبت‌نام انجام نشد.');
          return;
        }

        setNoticeMessage('حساب شما با موفقیت ساخته شد. اکنون می‌توانید وارد شوید.');
        setTimeout(() => {
          handleSwitchMode('login');
        }, 1200);
      } catch {
        setErrorMessage('ارتباط با سرور برقرار نشد. مطمئن شوید PocketBase در حال اجراست.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // LOGIN MODE
    if (loginMethod === 'phone') {
      const submittedPhone = phone.trim();
      const submittedPhoneCode = digitsOnly(phoneCode);

      if (!submittedPhone) {
        setErrorMessage('لطفاً شماره تلفن همراه را وارد کنید.');
        return;
      }
      if (phoneChallenge && submittedPhoneCode.length !== 6) {
        setErrorMessage('کد ۶ رقمی ارسال‌شده در بله را کامل وارد کنید.');
        return;
      }

      setLoading(true);
      try {
        const endpoint = phoneChallenge ? '/api/auth/bale/verify' : '/api/auth/bale/request';
        const payload = phoneChallenge
          ? {
              phone: submittedPhone,
              challengeId: phoneChallenge.id,
              code: submittedPhoneCode,
            }
          : { phone: submittedPhone };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as {
          message?: string;
          challengeId?: string;
          expiresIn?: number;
        } | null;

        if (!response.ok) {
          setErrorMessage(data?.message ?? 'ورود با تلفن انجام نشد.');
          return;
        }

        if (!phoneChallenge && data?.challengeId) {
          setPhoneChallenge({
            id: data.challengeId,
            expiresAt: Date.now() + (data.expiresIn ?? 120) * 1000,
          });
          setNoticeMessage('کد ورود در پیام‌رسان بله ارسال شد. تا ۱۲۰ ثانیه فرصت دارید.');
          return;
        }

        router.replace('/dashboard');
        router.refresh();
      } catch {
        setErrorMessage('ارتباط با سرور برقرار نشد. مطمئن شوید PocketBase در حال اجراست.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // EMAIL LOGIN MODE
    const submittedEmail = email.trim();
    const submittedPassword = password;
    const submittedOtpCode = digitsOnly(otpCode);
    const submittedTotpCode = digitsOnly(totpCode);

    if (!submittedEmail || !submittedPassword) {
      setErrorMessage('لطفاً ایمیل و رمز عبور خود را وارد کنید.');
      return;
    }

    if (
      mfaChallenge
      && (mfaAuthMethod === 'email' ? submittedOtpCode.length !== 6 : submittedTotpCode.length !== 6)
    ) {
      setErrorMessage('کد تأیید ۶ رقمی را کامل وارد کنید.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: submittedEmail,
          password: submittedPassword,
          mfaId: mfaChallenge?.mfaId,
          otpId: mfaChallenge?.otpId,
          otpCode: submittedOtpCode,
          totpCode: submittedTotpCode,
          authMethod: mfaAuthMethod,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
          mfaRequired?: boolean;
          mfaId?: string;
          otpId?: string;
          authenticatorAvailable?: boolean;
          emailOtpAvailable?: boolean;
        } | null;

        if (data?.mfaRequired && data.mfaId && (data.authenticatorAvailable || data.otpId)) {
          const hasAuthenticator = data.authenticatorAvailable === true;
          const hasEmailOtp = data.emailOtpAvailable === true || Boolean(data.otpId);

          setMfaChallenge({
            mfaId: data.mfaId,
            otpId: data.otpId,
            authenticatorAvailable: hasAuthenticator,
            emailOtpAvailable: hasEmailOtp,
          });
          setMfaAuthMethod(hasAuthenticator && !hasEmailOtp ? 'totp' : 'email');
          setNoticeMessage(data.message ?? 'کد تأیید به ایمیل شما ارسال شد.');
          return;
        }

        setErrorMessage(data?.message ?? 'ورود انجام نشد. اطلاعات حساب را بررسی کنید.');
        return;
      }

      setMfaChallenge(null);
      setOtpCode('');
      setTotpCode('');
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد. مطمئن شوید PocketBase در حال اجراست.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="relative min-h-dvh w-full flex items-center justify-center px-4 py-6 sm:py-8 bg-black overflow-x-hidden overflow-y-auto selection:bg-purple-500 selection:text-white"
    >
      {/* Background Noise Texture */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Static Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-[0]">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[600px] sm:w-[850px] h-[500px] sm:h-[650px] rounded-full bg-gradient-to-b from-purple-600/25 via-violet-900/15 to-transparent blur-[120px]" />
        <div className="absolute -bottom-[20%] left-1/2 -translate-x-1/2 w-[500px] sm:w-[750px] h-[400px] sm:h-[550px] rounded-full bg-gradient-to-t from-fuchsia-800/15 via-purple-900/10 to-transparent blur-[130px]" />
      </div>

      {/* 3D Tilt Wrapper */}
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="relative z-10 w-full max-w-md my-auto perspective-1000"
      >
        {/* Clean Static Glass Card with Sharp Text */}
        <div
          ref={cardRef}
          className="relative w-full rounded-2xl sm:rounded-3xl bg-neutral-950/85 backdrop-blur-xl p-5 sm:p-6 md:p-8 border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Logo / Brand Header */}
          <div className="flex flex-col items-center text-center mb-5 sm:mb-6">
            <div className="relative mb-3">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-neutral-900 via-purple-950 to-neutral-950 border border-white/20 flex items-center justify-center text-white shadow-lg">
                <span className="font-extrabold text-2xl tracking-wider bg-gradient-to-br from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                  Z
                </span>
              </div>
            </div>

            <span className="text-[11px] font-bold tracking-[0.22em] text-cyan-400/90 uppercase mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              ZARFOLIO
            </span>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {mode === 'login' ? 'ورود به حساب' : 'ساخت حساب جدید'}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-[280px] leading-relaxed">
              {mode === 'login'
                ? 'به حساب کاربری خود وارد شوید'
                : 'حساب کاربری جدید ایجاد کنید'}
            </p>
          </div>

          {/* Form & Transitions */}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode + (mfaChallenge ? '-mfa' : '') + (loginMethod === 'phone' ? '-phone' : '')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="space-y-3.5"
              >
                {/* Signup Full Name */}
                {mode === 'signup' && (
                  <div className="space-y-1.5">
                    <label htmlFor="auth-name" className="block text-xs font-medium text-neutral-300">
                      نام و نام خانوادگی
                    </label>
                    <div className="relative group">
                      <UserRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 group-focus-within:text-purple-300 transition-colors pointer-events-none" />
                      <input
                        id="auth-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        placeholder="مثال: علی محمدی"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full h-11 pr-10 pl-4 rounded-xl bg-neutral-900/70 border border-white/10 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Phone Input for Signup or Phone Login */}
                {(mode === 'signup' || (mode === 'login' && loginMethod === 'phone')) && (
                  <div className="space-y-1.5">
                    <label htmlFor="auth-phone" className="block text-xs font-medium text-neutral-300">
                      شماره تلفن همراه
                    </label>
                    <div className="relative group">
                      <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 group-focus-within:text-purple-300 transition-colors pointer-events-none" />
                      <input
                        id="auth-phone"
                        name="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="w-full h-11 pr-10 pl-4 rounded-xl bg-neutral-900/70 border border-white/10 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all dir-ltr text-right"
                      />
                    </div>
                  </div>
                )}

                {/* Bale Code Challenge Input */}
                {mode === 'login' && loginMethod === 'phone' && phoneChallenge && (
                  <div className="space-y-1.5">
                    <label htmlFor="bale-code" className="block text-xs font-medium text-neutral-300">
                      کد ورود پیام‌رسان بله
                    </label>
                    <div className="relative group">
                      <ShieldCheck className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 group-focus-within:text-purple-300 transition-colors pointer-events-none" />
                      <input
                        id="bale-code"
                        name="phoneCode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="کد ۶ رقمی"
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(digitsOnly(e.target.value))}
                        required
                        className="w-full h-11 pr-10 pl-4 rounded-xl bg-neutral-900/70 border border-purple-500/40 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all tracking-widest text-center"
                      />
                    </div>
                  </div>
                )}

                {/* Email Input */}
                {(mode === 'signup' || (mode === 'login' && loginMethod === 'email')) && (
                  <div className="space-y-1.5">
                    <label htmlFor="auth-email" className="block text-xs font-medium text-neutral-300">
                      ایمیل
                    </label>
                    <div className="relative group">
                      <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 group-focus-within:text-purple-300 transition-colors pointer-events-none" />
                      <input
                        id="auth-email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-11 pr-10 pl-4 rounded-xl bg-neutral-900/70 border border-white/10 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all dir-ltr text-right"
                      />
                    </div>
                  </div>
                )}

                {/* Password Input */}
                {mode === 'login' && loginMethod === 'email' && !mfaChallenge && (
                  <div className="space-y-1.5">
                    <label htmlFor="auth-password" className="block text-xs font-medium text-neutral-300">
                      رمز عبور
                    </label>
                    <div className="relative group">
                      <LockKeyhole className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 group-focus-within:text-purple-300 transition-colors pointer-events-none" />
                      <input
                        id="auth-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full h-11 pr-10 pl-11 rounded-xl bg-neutral-900/70 border border-white/10 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
                        aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Signup Passwords */}
                {mode === 'signup' && (
                  <>
                    <div className="space-y-1.5">
                      <label htmlFor="auth-password" className="block text-xs font-medium text-neutral-300">
                        رمز عبور (حداقل ۸ کاراکتر)
                      </label>
                      <div className="relative group">
                        <LockKeyhole className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 group-focus-within:text-purple-300 transition-colors pointer-events-none" />
                        <input
                          id="auth-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="w-full h-11 pr-10 pl-11 rounded-xl bg-neutral-900/70 border border-white/10 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
                          aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="auth-password-confirm" className="block text-xs font-medium text-neutral-300">
                        تکرار رمز عبور
                      </label>
                      <div className="relative group">
                        <LockKeyhole className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400/70 group-focus-within:text-purple-300 transition-colors pointer-events-none" />
                        <input
                          id="auth-password-confirm"
                          name="passwordConfirm"
                          type={showPasswordConfirm ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          required
                          className="w-full h-11 pr-10 pl-11 rounded-xl bg-neutral-900/70 border border-white/10 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-purple-500/60 focus:ring-2 focus:ring-purple-500/20 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordConfirm((v) => !v)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors p-1"
                          aria-label={showPasswordConfirm ? 'مخفی کردن تکرار رمز عبور' : 'نمایش تکرار رمز عبور'}
                        >
                          {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* MFA Challenge Screen */}
                {mode === 'login' && mfaChallenge && (
                  <div className="space-y-3 bg-neutral-900/80 p-4 rounded-2xl border border-purple-500/30">
                    <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/10">
                      {mfaChallenge.emailOtpAvailable && (
                        <button
                          type="button"
                          onClick={() => setMfaAuthMethod('email')}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            mfaAuthMethod === 'email'
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          کد ایمیل
                        </button>
                      )}
                      {mfaChallenge.authenticatorAvailable && (
                        <button
                          type="button"
                          onClick={() => setMfaAuthMethod('totp')}
                          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            mfaAuthMethod === 'totp'
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          رمزساز (TOTP)
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="mfa-code" className="block text-xs font-medium text-neutral-300">
                        {mfaAuthMethod === 'email' ? 'کد تأیید ایمیل' : 'کد 6 رقمی Authenticator'}
                      </label>
                      <input
                        id="mfa-code"
                        type="text"
                        inputMode="numeric"
                        placeholder="123456"
                        value={mfaAuthMethod === 'email' ? otpCode : totpCode}
                        onChange={(e) => {
                          const val = digitsOnly(e.target.value);
                          if (mfaAuthMethod === 'email') setOtpCode(val);
                          else setTotpCode(val);
                        }}
                        required
                        className="w-full h-11 px-4 text-center tracking-widest text-base font-mono rounded-xl bg-neutral-950 border border-purple-500/50 text-white focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>
                )}

                {/* Mode Options: Remember Me & Login Method Switcher */}
                {mode === 'login' && !mfaChallenge && (
                  <div className="flex items-center justify-between pt-1 text-xs text-neutral-400">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                            rememberMe
                              ? 'bg-purple-600 border-purple-500 text-white'
                              : 'bg-neutral-900 border-white/20 group-hover:border-white/40'
                          }`}
                        >
                          {rememberMe && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                      <span className="group-hover:text-neutral-200 transition-colors">مرا به خاطر بسپار</span>
                    </label>

                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-purple-400 hover:text-purple-300 transition-colors hover:underline"
                    >
                      رمز عبور را فراموش کرده‌اید؟
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Login Method Toggle Switcher for Email / Phone */}
            {mode === 'login' && !mfaChallenge && (
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('email');
                    setPhoneChallenge(null);
                    setErrorMessage('');
                  }}
                  className={`text-[11px] px-3 py-1 rounded-full transition-all ${
                    loginMethod === 'email'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  ورود با ایمیل
                </button>
                <span className="text-neutral-700">•</span>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMethod('phone');
                    setErrorMessage('');
                  }}
                  className={`text-[11px] px-3 py-1 rounded-full transition-all ${
                    loginMethod === 'phone'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  ورود با شماره تلفن (بله)
                </button>
              </div>
            )}

            {/* Messages / Alerts */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs leading-relaxed"
                role="alert"
              >
                {errorMessage}
              </motion.div>
            )}

            {noticeMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 text-xs leading-relaxed"
              >
                {noticeMessage}
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="relative w-full h-11 mt-2 rounded-xl bg-gradient-to-r from-white via-neutral-100 to-neutral-200 text-black font-bold text-sm shadow-[0_0_20px_rgba(255,255,255,0.12)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 overflow-hidden"
            >
              {loading ? (
                <span className="flex items-center gap-2 text-neutral-800">
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  در حال پردازش...
                </span>
              ) : (
                <>
                  <span>
                    {mode === 'login'
                      ? mfaChallenge
                        ? 'تأیید و ورود'
                        : loginMethod === 'phone'
                        ? phoneChallenge
                          ? 'تأیید کد بله'
                          : 'ارسال کد ورود'
                        : 'ورود به داشبورد'
                      : 'ساخت حساب جدید'}
                  </span>
                  <ArrowLeft className="w-4 h-4 text-black/80" />
                </>
              )}
            </motion.button>
          </form>

          {/* Cancel MFA Button */}
          {mfaChallenge && (
            <button
              type="button"
              onClick={() => {
                setMfaChallenge(null);
                setOtpCode('');
                setTotpCode('');
                setErrorMessage('');
              }}
              className="w-full mt-2 text-xs text-neutral-400 hover:text-white transition-colors text-center py-1"
            >
              انصراف و بازگشت به ورود با رمز
            </button>
          )}

          {/* Divider */}
          <div className="relative my-4 sm:my-5">
            <div className="absolute inset-0 flex items-center pointer-events-none">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase">
              <span className="bg-neutral-950 px-3 text-neutral-500 font-medium">یا</span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full h-11 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 shadow-sm"
          >
            <GoogleIcon />
            <span>{googleLoading ? 'در حال اتصال...' : 'ورود با حساب گوگل'}</span>
          </motion.button>

          {/* Footer Navigation Link */}
          <div className="mt-5 sm:mt-6 text-center text-xs text-neutral-400">
            {mode === 'login' ? (
              <p>
                حساب کاربری ندارید؟{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className="text-purple-300 font-semibold hover:text-purple-200 transition-colors hover:underline inline-flex items-center gap-1"
                >
                  ثبت‌نام کنید
                </button>
              </p>
            ) : (
              <p>
                قبلاً حساب ساخته‌اید؟{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-purple-300 font-semibold hover:text-purple-200 transition-colors hover:underline inline-flex items-center gap-1"
                >
                  وارد شوید
                </button>
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
