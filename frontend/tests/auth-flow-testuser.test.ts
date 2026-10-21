import { describe, expect, it } from 'bun:test';

describe('End-to-End Test User Authentication Flow', () => {
  const testEmail = 'testuser@zarfolio.local';
  const testPhone = '09121112233';
  const testPassword = 'Password123456';

  it('successfully logs in with test user email and password via live API', async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).not.toBeNull();
    expect(setCookie).toContain('pb_auth=');
  });

  it('successfully logs in with test user phone number and password via live API', async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: testPhone,
        password: testPassword,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).not.toBeNull();
    expect(setCookie).toContain('pb_auth=');
  });

  it('rejects incorrect password without setting auth cookie', async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999',
      }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.message).toBe('ایمیل یا رمز عبور اشتباه است.');
  });
});
