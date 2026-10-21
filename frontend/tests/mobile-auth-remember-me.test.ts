import { describe, expect, it, mock } from 'bun:test';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { MobileAuthView } from '../src/components/auth/MobileAuthView';
import { DesktopAuthView } from '../src/components/auth/DesktopAuthView';

describe('MobileAuthView & DesktopAuthView Remember Me Checkbox', () => {
  const createMockLogic = (overrides = {}) => ({
    mode: 'login' as const,
    name: '',
    setName: mock(() => {}),
    email: 'test@example.com',
    setEmail: mock(() => {}),
    phone: '',
    setPhone: mock(() => {}),
    password: 'password123',
    setPassword: mock(() => {}),
    passwordConfirm: '',
    setPasswordConfirm: mock(() => {}),
    rememberMe: false,
    setRememberMe: mock(() => {}),
    loginMethod: 'email' as const,
    setLoginMethod: mock(() => {}),
    phoneChallenge: null,
    setPhoneChallenge: mock(() => {}),
    phoneCode: '',
    setPhoneCode: mock(() => {}),
    otpCode: '',
    setOtpCode: mock(() => {}),
    totpCode: '',
    setTotpCode: mock(() => {}),
    mfaAuthMethod: 'email' as const,
    setMfaAuthMethod: mock(() => {}),
    mfaChallenge: null,
    setMfaChallenge: mock(() => {}),
    showPassword: false,
    setShowPassword: mock(() => {}),
    showPasswordConfirm: false,
    setShowPasswordConfirm: mock(() => {}),
    errorMessage: '',
    setErrorMessage: mock(() => {}),
    noticeMessage: '',
    setNoticeMessage: mock(() => {}),
    loading: false,
    setLoading: mock(() => {}),
    googleLoading: false,
    setGoogleLoading: mock(() => {}),
    handleSwitchMode: mock(() => {}),
    handleGoogleSignIn: mock(() => {}),
    handleForgotPassword: mock(() => {}),
    handleSubmit: mock(async () => {}),
    digitsOnly: (v: string) => v,
    ...overrides,
  });

  it('renders mobile remember me checkbox with semantic input and matching label htmlFor', () => {
    const logic = createMockLogic({ rememberMe: false });
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(MobileAuthView, { logic }),
    );

    expect(html).toContain('for="mobile-auth-remember-me"');
    expect(html).toContain('id="mobile-auth-remember-me"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="rememberMe"');
    expect(html).toContain('مرا به خاطر بسپار');
    expect(html).toContain('touch-manipulation');
    // Ensure unchecked state does not have checked attribute
    expect(html).not.toMatch(/id="mobile-auth-remember-me"[^>]*checked/);
  });

  it('renders mobile remember me checkbox in checked state when rememberMe is true', () => {
    const logic = createMockLogic({ rememberMe: true });
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(MobileAuthView, { logic }),
    );

    expect(html).toContain('id="mobile-auth-remember-me"');
    expect(html).toContain('checked');
    expect(html).toContain('bg-purple-600');
  });

  it('renders desktop remember me checkbox with semantic input and matching label htmlFor', () => {
    const logic = createMockLogic({ rememberMe: false });
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DesktopAuthView, { logic }),
    );

    expect(html).toContain('for="desktop-auth-remember-me"');
    expect(html).toContain('id="desktop-auth-remember-me"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('name="rememberMe"');
    expect(html).toContain('مرا به خاطر بسپار');
    expect(html).toContain('touch-manipulation');
  });

  it('ensures form specifies method="POST" and action="/api/auth/login" for progressive enhancement fallback', () => {
    const logic = createMockLogic({ rememberMe: false });
    const mobileHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(MobileAuthView, { logic }),
    );
    const desktopHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(DesktopAuthView, { logic }),
    );

    // Forms must NOT use action="#" which causes URL hash navigation
    expect(mobileHtml).not.toContain('action="#"');
    expect(desktopHtml).not.toContain('action="#"');

    // Forms MUST have method="POST" and action="/api/auth/login" as a
    // progressive-enhancement fallback so that if JS fails to load or
    // hydrate, the browser submits via POST (not GET) and credentials
    // never appear in the URL bar.
    expect(mobileHtml).toContain('method="POST"');
    expect(mobileHtml).toContain('action="/api/auth/login"');
    expect(desktopHtml).toContain('method="POST"');
    expect(desktopHtml).toContain('action="/api/auth/login"');
  });
});
