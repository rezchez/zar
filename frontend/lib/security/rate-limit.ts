import { NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

function cleanStore() {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (record.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

setInterval(cleanStore, 60_000);

export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = memoryStore.get(identifier);

  if (!record || record.resetAt < now) {
    memoryStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { success: true };
  }

  if (record.count >= limit) {
    return {
      success: false,
      retryAfter: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return { success: true };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}
