import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeDigits } from '@/lib/jalali';

function digitsOnly(value: string) {
  return normalizeDigits(value).replace(/\D/g, '').slice(0, 6);
}

export function useAuthLogic(initialMode: 'login' | 'signup' = 'login') {
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

  // Sync mode if initialMode changes
  const [prevInitialMode, setPrevInitialMode] = useState(initialMode);
  if (initialMode !== prevInitialMode) {
    setPrevInitialMode(initialMode);
    setMode(initialMode);
    setErrorMessage('');
    setNoticeMessage('');
  }

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

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setErrorMessage('');
    setTimeout(() => {
      setGoogleLoading(false);
      setNoticeMessage('ورود با گوگل به‌زودی فعال می‌شود. لطفاً از ایمیل یا تلفن استفاده کنید.');
    }, 600);
  };

  const handleForgotPassword = () => {
    if (!email) {
      setErrorMessage('لطفاً ابتدا ایمیل خود را وارد کنید.');
      return;
    }
    setNoticeMessage(`لینک بازیابی رمز عبور به ${email} ارسال شد.`);
    setErrorMessage('');
  };

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

  return {
    mode,
    name, setName,
    email, setEmail,
    phone, setPhone,
    password, setPassword,
    passwordConfirm, setPasswordConfirm,
    rememberMe, setRememberMe,
    loginMethod, setLoginMethod,
    phoneChallenge, setPhoneChallenge,
    phoneCode, setPhoneCode,
    otpCode, setOtpCode,
    totpCode, setTotpCode,
    mfaAuthMethod, setMfaAuthMethod,
    mfaChallenge, setMfaChallenge,
    showPassword, setShowPassword,
    showPasswordConfirm, setShowPasswordConfirm,
    errorMessage, setErrorMessage,
    noticeMessage, setNoticeMessage,
    loading, setLoading,
    googleLoading, setGoogleLoading,
    handleSwitchMode,
    handleGoogleSignIn,
    handleForgotPassword,
    handleSubmit,
    digitsOnly
  };
}

export type AuthLogicReturn = ReturnType<typeof useAuthLogic>;
