/**
 * Safe RFC4122 v4 UUID generator that works across all environments:
 * - Secure contexts (native crypto.randomUUID)
 * - Non-secure HTTP contexts (mobile IP access, development LAN)
 * - Older mobile browsers / WebViews
 * - Server-side rendering (Node.js/Bun)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      try {
        return crypto.randomUUID();
      } catch {
        // Fallback if randomUUID fails
      }
    }
    if (typeof crypto.getRandomValues === 'function') {
      try {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      } catch {
        // Fallback to Math.random
      }
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Global polyfill for browser contexts where crypto.randomUUID is missing (e.g. HTTP non-secure contexts)
if (typeof window !== 'undefined') {
  try {
    if (!window.crypto) {
      (window as unknown as { crypto: unknown }).crypto = {};
    }
    if (typeof window.crypto.randomUUID !== 'function') {
      try {
        Object.defineProperty(window.crypto, 'randomUUID', {
          value: generateUUID,
          writable: true,
          configurable: true,
        });
      } catch {
        (window.crypto as { randomUUID?: () => string }).randomUUID = generateUUID;
      }
    }
  } catch {
    // Ignore polyfill assignment errors
  }
}
