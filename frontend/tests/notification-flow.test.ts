import { setMockAuthUser } from './setup';
import { describe, expect, test, beforeEach } from 'bun:test';
import {
  encryptNotificationPayload,
  decryptNotificationPayload,
  getEncryptionKey,
} from '../lib/notification-crypto';
import { GET as getNotifications, POST as createNotification } from '../app/api/notifications/route';
import { GET as getNotificationDetail } from '../app/api/notifications/[id]/route';
import { PATCH as markNotificationRead } from '../app/api/notifications/[id]/read/route';

describe('Notification AES-256-GCM Crypto Tests', () => {
  test('encrypts and decrypts notification payload accurately', () => {
    const payload = {
      title: 'اطلاعیه مهم سیستم',
      body: 'سرور در ساعت ۲۴:۰۰ به‌مدت ۱۰ دقیقه به‌روزرسانی خواهد شد.',
    };

    const encrypted = encryptNotificationPayload(payload);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.authTag).toBeDefined();
    expect(encrypted.keyVersion).toBe(1);

    const decrypted = decryptNotificationPayload(encrypted);

    expect(decrypted.title).toBe(payload.title);
    expect(decrypted.body).toBe(payload.body);
  });

  test('key helper returns a valid 32-byte buffer', () => {
    const keyBuf = getEncryptionKey();
    expect(keyBuf).toBeInstanceOf(Buffer);
    expect(keyBuf.length).toBe(32);
  });

  test('tampered ciphertext or authTag throws controlled NOTIFICATION_DECRYPT_FAILED error', () => {
    const payload = {
      title: 'پیام امن',
      body: 'محتوای حساس مالی',
    };

    const encrypted = encryptNotificationPayload(payload);

    // Tamper ciphertext
    const tamperedCiphertext = {
      ...encrypted,
      ciphertext: Buffer.from('tampered-content-data').toString('base64'),
    };

    expect(() => decryptNotificationPayload(tamperedCiphertext)).toThrow(
      'NOTIFICATION_DECRYPT_FAILED',
    );

    // Tamper authTag
    const tamperedAuthTag = {
      ...encrypted,
      authTag: Buffer.from('0000000000000000').toString('base64'),
    };

    expect(() => decryptNotificationPayload(tamperedAuthTag)).toThrow(
      'NOTIFICATION_DECRYPT_FAILED',
    );
  });

  test('invalid IV or missing fields throw controlled NOTIFICATION_DECRYPT_FAILED error', () => {
    const invalidIv = {
      ciphertext: 'validbase64==',
      iv: Buffer.from('short').toString('base64'),
      authTag: Buffer.from('0123456789abcdef').toString('base64'),
      keyVersion: 1,
    };

    expect(() => decryptNotificationPayload(invalidIv)).toThrow(
      'NOTIFICATION_DECRYPT_FAILED',
    );
  });
});

describe('Notification Security & Auth Tests', () => {
  beforeEach(() => {
    setMockAuthUser(null);
  });

  test('GET /api/notifications returns 401 when unauthenticated and sets Cache-Control', async () => {
    setMockAuthUser(null);
    const res = await getNotifications();
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  test('POST /api/notifications returns 401 when unauthenticated and sets Cache-Control', async () => {
    setMockAuthUser(null);
    const req = new Request('http://localhost/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', body: 'Body' }),
    });
    const res = await createNotification(req);
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  test('POST /api/notifications returns 403 when user is regular user (not admin/manager)', async () => {
    setMockAuthUser({
      id: 'userA',
      name: 'User A',
      email: 'usera@example.com',
      role: 'user',
      status: 'active',
    });
    const req = new Request('http://localhost/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', body: 'Body' }),
    });
    const res = await createNotification(req);
    expect(res.status).toBe(403);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  test('GET /api/notifications/[id] returns 401 when unauthenticated', async () => {
    setMockAuthUser(null);
    const req = new Request('http://localhost/api/notifications/test-id');
    const res = await getNotificationDetail(req, {
      params: Promise.resolve({ id: 'test-id' }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  test('PATCH /api/notifications/[id]/read returns 401 when unauthenticated', async () => {
    setMockAuthUser(null);
    const req = new Request('http://localhost/api/notifications/test-id/read', {
      method: 'PATCH',
    });
    const res = await markNotificationRead(req, {
      params: Promise.resolve({ id: 'test-id' }),
    });
    expect(res.status).toBe(401);
  });
});
