import { z } from 'zod';

export const iranianNationalCodeSchema = z
  .string()
  .regex(/^\d{10}$/, 'کد ملی باید دقیقاً ۱۰ رقم باشد.')
  .refine((code) => {
    if (/^(\d)\1{9}$/.test(code)) return false;

    const checksum = code
      .slice(0, 9)
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0);
    const remainder = checksum % 11;
    const expectedControlDigit = remainder < 2 ? remainder : 11 - remainder;

    return Number(code[9]) === expectedControlDigit;
  }, 'کد ملی معتبر نیست.');
