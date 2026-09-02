/**
 * Validates Iranian Sheba (IBAN) format strictly.
 * Format: "IR" + 24 digits (or 24 digits without IR prefix).
 */
export function validateIranianSheba(sheba: string): { valid: boolean; error?: string } {
  const clean = sheba.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!clean) return { valid: true }; // Optional field

  const norm = clean.startsWith('IR') ? clean : `IR${clean}`;
  if (!/^IR[0-9]{24}$/.test(norm)) {
    return { valid: false, error: 'شماره شبا باید با IR شروع شده و شامل ۲۴ رقم باشد (مثال: IR123456789012345678901234).' };
  }
  return { valid: true };
}
