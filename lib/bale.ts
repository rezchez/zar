import 'server-only';

import { createHash, randomInt } from 'node:crypto';

const BALE_API_BASE = 'https://tapi.bale.ai';

export function normalizePhone(value: string) {
  const digits = value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/\D/g, '');
  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98')) return `0${digits.slice(2)}`;
  return digits;
}

export function isIranianMobile(value: string) {
  return /^09\d{9}$/.test(normalizePhone(value));
}

export function generateBaleCode() {
  return String(randomInt(100000, 1000000));
}

export function hashBaleValue(value: string) {
  return createHash('sha256')
    .update(`${value}:${process.env.TOTP_ENCRYPTION_KEY ?? 'zar-bale-auth'}`)
    .digest('hex');
}

export async function sendBaleMessage(chatId: string, text: string) {
  return sendBaleRequest('sendMessage', {
    chat_id: chatId,
    text,
  });
}

export async function sendBaleContactRequest(chatId: string) {
  return sendBaleRequest('sendMessage', {
    chat_id: chatId,
    text: 'برای اتصال حساب، دکمه «ارسال شماره تلفن» را بزنید.',
    components: {
      keyboard: [
        [{ text: 'ارسال شماره تلفن', request_contact: true }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function sendBaleRequest(method: string, payload: Record<string, unknown>) {
  const token = process.env.BALE_BOT_TOKEN;
  if (!token) throw new Error('BALE_BOT_TOKEN is not configured.');

  const response = await fetch(`${BALE_API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const data = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.description || `Bale API returned ${response.status}.`);
  }
  return data;
}

export const BALE_PHONE_COOKIE = 'zar_phone_auth';
