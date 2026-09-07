import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

export function createPhoneSessionToken() {
  return randomBytes(32).toString('hex');
}

export function hashPhoneSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export const PHONE_SESSION_DAYS = 30;
