import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import QRCode from 'qrcode';

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

export class TotpConfigurationError extends Error {
  constructor() {
    super('TOTP_ENCRYPTION_KEY is not configured correctly.');
    this.name = 'TotpConfigurationError';
  }
}

function getEncryptionKey() {
  const value = process.env.TOTP_ENCRYPTION_KEY ?? '';
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new TotpConfigurationError();
  }

  return Buffer.from(value, 'hex');
}

export function createTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function createTotpUri(email: string, secret: string) {
  const issuer = 'Zarfolio';
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export async function createTotpQrDataUrl(uri: string) {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
  });
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptTotpSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted TOTP secret.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function verifyTotpCode(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return false;

  const currentCounter = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  for (const offset of [-1, 0, 1]) {
    if (timingSafeEqual(generateTotpCode(secret, currentCounter + offset), code)) {
      return true;
    }
  }

  return false;
}

function generateTotpCode(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

function timingSafeEqual(left: string, right: string) {
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

function base32Encode(value: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let bitCount = 0;
  let output = '';

  for (const byte of value) {
    bits = (bits << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      output += alphabet[(bits >>> (bitCount - 5)) & 31];
      bitCount -= 5;
    }
  }

  if (bitCount > 0) {
    output += alphabet[(bits << (5 - bitCount)) & 31];
  }

  return output;
}

function base32Decode(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 value.');

    bits = (bits << 5) | index;
    bitCount += 5;
    if (bitCount >= 8) {
      bytes.push((bits >>> (bitCount - 8)) & 0xff);
      bitCount -= 8;
    }
  }

  return Buffer.from(bytes);
}
