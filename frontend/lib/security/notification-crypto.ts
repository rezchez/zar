import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type NotificationPayload = {
  title: string;
  body: string;
};

export type EncryptedNotificationPayload = {
  ciphertext: string; // base64
  iv: string;         // base64
  authTag: string;    // base64
  keyVersion: number;
};

const DEFAULT_KEY_VERSION = 1;

/**
 * Retrieves and validates the 256-bit (32-byte) AES-GCM encryption key from environment.
 * Handles valid base64 strings (32 decoded bytes) or UTF-8 strings.
 */
export function getEncryptionKey(): Buffer {
  const rawKey = process.env.NOTIFICATION_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('NOTIFICATION_ENCRYPTION_KEY is not configured.');
  }

  // Try decoding as base64 first
  try {
    const base64Buf = Buffer.from(rawKey, 'base64');
    if (base64Buf.length === 32) {
      return base64Buf;
    }
  } catch {
    // ignore
  }

  // Fallback: UTF-8 string
  const utfBuf = Buffer.from(rawKey, 'utf-8');
  if (utfBuf.length >= 32) {
    return utfBuf.subarray(0, 32);
  }

  // Pad UTF-8 string if less than 32 bytes
  const padded = Buffer.alloc(32);
  utfBuf.copy(padded);
  return padded;
}

/**
 * Encrypts a notification payload (title & body) using AES-256-GCM.
 */
export function encryptNotificationPayload(
  payload: NotificationPayload,
): EncryptedNotificationPayload {
  if (!payload || typeof payload.title !== 'string' || typeof payload.body !== 'string') {
    throw new Error('Invalid notification payload: title and body must be strings.');
  }

  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV recommended for AES-GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const jsonString = JSON.stringify({
    title: payload.title,
    body: payload.body,
  });

  const encrypted = Buffer.concat([
    cipher.update(jsonString, 'utf-8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion: DEFAULT_KEY_VERSION,
  };
}

/**
 * Decrypts and verifies an authenticated AES-256-GCM encrypted notification payload.
 */
export function decryptNotificationPayload(
  encrypted: EncryptedNotificationPayload,
): NotificationPayload {
  if (!encrypted || !encrypted.ciphertext || !encrypted.iv || !encrypted.authTag) {
    throw new Error('NOTIFICATION_DECRYPT_FAILED');
  }

  const key = getEncryptionKey();
  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: Buffer;

  try {
    iv = Buffer.from(encrypted.iv, 'base64');
    authTag = Buffer.from(encrypted.authTag, 'base64');
    ciphertext = Buffer.from(encrypted.ciphertext, 'base64');
  } catch {
    throw new Error('NOTIFICATION_DECRYPT_FAILED');
  }

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('NOTIFICATION_DECRYPT_FAILED');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    const parsed = JSON.parse(decrypted.toString('utf-8')) as Record<string, unknown>;

    if (typeof parsed.title !== 'string' || typeof parsed.body !== 'string') {
      throw new Error('NOTIFICATION_DECRYPT_FAILED');
    }

    return {
      title: parsed.title,
      body: parsed.body,
    };
  } catch {
    throw new Error('NOTIFICATION_DECRYPT_FAILED');
  }
}
