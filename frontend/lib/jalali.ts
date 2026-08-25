const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalizeDigits(value: string) {
  return value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

export function parseJalaliDate(value: string) {
  const normalized = normalizeDigits(value.trim()).replace(/[./-]/g, '/');
  const parts = normalized.split('/').map(Number);
  if (
    parts.length !== 3
    || !parts.every((part) => Number.isInteger(part))
    || parts[0] < 1200
    || parts[0] > 1600
    || parts[1] < 1
    || parts[1] > 12
    || parts[2] < 1
    || parts[2] > 31
  ) {
    return null;
  }

  return {
    year: parts[0],
    month: parts[1],
    day: parts[2],
  };
}

export function jalaliToGregorian(value: string) {
  const parsed = parseJalaliDate(value);
  if (!parsed) return null;

  const jy = parsed.year - 979;
  const jm = parsed.month - 1;
  const jd = parsed.day - 1;
  let jDayNo =
    365 * jy
    + Math.floor(jy / 33) * 8
    + Math.floor(((jy % 33) + 3) / 4);

  for (let index = 0; index < jm; index += 1) {
    jDayNo += index < 6 ? 31 : 30;
  }
  jDayNo += jd;

  const gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  let remainder = gDayNo % 146097;

  let leap = true;
  if (remainder >= 36525) {
    remainder -= 1;
    gy += 100 * Math.floor(remainder / 36524);
    remainder %= 36524;
    if (remainder >= 365) remainder += 1;
    else leap = false;
  }

  gy += 4 * Math.floor(remainder / 1461);
  remainder %= 1461;
  if (remainder >= 366) {
    leap = false;
    remainder -= 1;
    gy += Math.floor(remainder / 365);
    remainder %= 365;
  }

  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && remainder >= monthDays[gm]) {
    remainder -= monthDays[gm];
    gm += 1;
  }

  return {
    year: gy,
    month: gm + 1,
    day: remainder + 1,
  };
}

export function jalaliDateToIso(value: string) {
  const gregorian = jalaliToGregorian(value);
  if (!gregorian) return null;

  const date = new Date(Date.UTC(
    gregorian.year,
    gregorian.month - 1,
    gregorian.day,
    12,
    0,
    0,
  ));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatJalaliDate(date = new Date()) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\u200e/g, '');
}

export function gregorianToJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { year: jy, month: jm, day: jd };
}

export function dateToJalaliString(date: Date): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  return gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
    ? `${gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()).year}/${String(gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()).month).padStart(2, '0')}/${String(gregorianToJalali(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()).day).padStart(2, '0')}`
    : '';
}

export function isoToJalaliString(isoString: string): string {
  if (!isoString) return '';
  const clean = String(isoString).slice(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return '';
  const jalali = gregorianToJalali(parts[0], parts[1], parts[2]);
  return `${jalali.year}/${String(jalali.month).padStart(2, '0')}/${String(jalali.day).padStart(2, '0')}`;
}
