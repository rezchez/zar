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
 * If the key is missing or invalid, throws an error to ensure fail-closed behavior.
 */
function getEncryptionKey(): Buffer {
  const rawKey = process.env.NOTIFICATION_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('NOTIFICATION_ENCRYPTION_KEY environment variable is required for notification encryption/decryption.');
  }

  // Check base64
  try {
    const keyBuf = Buffer.from(rawKey, 'base64');
    if (keyBuf.length === 32) {
      return keyBuf;
    }
  } catch {
    // invalid base64
  }

  // If provided as raw utf-8 string
  const utfBuf = Buffer.from(rawKey, 'utf-8');
  if (utfBuf.length >= 32) {
    return utfBuf.subarray(0, 32);
  }

  throw new Error('NOTIFICATION_ENCRYPTION_KEY must be a valid 32-byte (256-bit) base64 or UTF-8 string.');
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
    throw new Error('Invalid encrypted payload structure.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  if (iv.length !== 12) {
    throw new Error('Invalid IV length for AES-256-GCM.');
  }

  if (authTag.length !== 16) {
    throw new Error('Invalid authentication tag length.');
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
      throw new Error('Decrypted payload structure is missing title or body.');
    }

    return {
      title: parsed.title,
      body: parsed.body,
    };
  } catch (error) {
    throw new Error(
      `Failed to decrypt notification payload: ${error instanceof Error ? error.message : 'Authentication or integrity check failed.'}`,
    );
  }
}
