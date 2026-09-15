import { randomInt } from 'node:crypto';
import type PocketBase from 'pocketbase';

export const ZF_DOCUMENT_NUMBER_REGEX = /^ZF[0-9]{8}$/;

/**
 * Validates whether a given string is a valid ZF document number.
 * Format: 'ZF' followed by exactly 8 digits (e.g. ZF00481732, ZF48273195).
 */
export function isValidZfDocumentNumber(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return ZF_DOCUMENT_NUMBER_REGEX.test(value.trim());
}

/**
 * Generates a random ZF document number in the format ZFXXXXXXXX (ZF + 8 digits).
 * Supports leading zeros (00000000 - 99999999).
 */
export function generateZfDocumentNumber(): string {
  const digits = randomInt(0, 100_000_000).toString().padStart(8, '0');
  return `ZF${digits}`;
}

/**
 * Generates a unique ZF document number verified against the transactions database and an optional local set of excluded numbers.
 * If collision occurs, retries up to maxAttempts.
 */
export async function generateUniqueZfDocumentNumber(
  pb: PocketBase,
  maxAttempts = 10,
  excludeSet?: Set<string>,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateZfDocumentNumber();
    if (excludeSet && excludeSet.has(candidate)) {
      continue;
    }
    try {
      const existing = await pb.collection('transactions').getFirstListItem(
        pb.filter('documentNumber = {:candidate}', { candidate }),
      );
      if (!existing) {
        excludeSet?.add(candidate);
        return candidate;
      }
    } catch {
      // Record not found in PocketBase throws, which means candidate is available!
      excludeSet?.add(candidate);
      return candidate;
    }
  }
  // Fallback if somehow collisions happen repeatedly
  const timestampSuffix = Date.now().toString().slice(-8);
  const fallback = `ZF${timestampSuffix}`;
  excludeSet?.add(fallback);
  return fallback;
}
