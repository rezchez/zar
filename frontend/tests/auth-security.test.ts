import { describe, expect, test } from 'bun:test';
import { POST as handleLogin } from '../app/api/auth/login/route';
import { POST as handleBaleRequest } from '../app/api/auth/bale/request/route';

// Simple mock for IP extraction inside tests
const makeReq = (path: string, ip: string, body?: Record<string, unknown>) => new Request(`http://localhost${path}`, {
  method: 'POST',
  headers: new Headers({ 'x-forwarded-for': ip, 'content-type': 'application/json' }),
  body: body ? JSON.stringify(body) : undefined,
});

describe('Authentication & Rate Limit Security', () => {

  test('Login route rate limits after 10 failed attempts from same IP', async () => {
    const ip = '192.168.1.1';
    let res: Response | null = null;

    // Simulate 10 requests
    for (let i = 0; i < 11; i++) {
      res = await handleLogin(makeReq('/api/auth/login', ip, { email: 'test@example.com', password: 'bad' }));
    }

    // The 11th request should be rate limited (HTTP 429)
    expect(res?.status).toBe(429);
  });

  test('Different IP is not rate limited by the first IP limit', async () => {
    const ip2 = '10.0.0.1';
    const res = await handleLogin(makeReq('/api/auth/login', ip2, { email: 'test@example.com', password: 'bad' }));

    // Should be standard 401 (unauthorized due to bad mock / missing db setup), not 429
    expect(res.status).toBe(401);
  });

  test('Bale Request route limits after 5 attempts', async () => {
    const ip = '192.168.2.1';
    let res: Response | null = null;

    for (let i = 0; i < 6; i++) {
      res = await handleBaleRequest(makeReq('/api/auth/bale/request', ip, { phone: '09123456789' }));
    }

    // 6th request should hit 429
    expect(res?.status).toBe(429);
  });
});
