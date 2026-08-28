/**
 * Recurring Iranian holidays and observances (month/day, not year-specific).
 *
 * Official days off (official: true) vs. commemorative observances (official: false).
 * "jalali" and "gregorian" entries are exact solar dates.
 * "hijri" (lunar) entries are resolved dynamically per year via the tabular Hijri algorithm.
 */
export interface PersianHolidayEntry {
  calendar: 'jalali' | 'gregorian' | 'hijri';
  /** Whether this is an official day off (تعطیل رسمی). */
  official: boolean;
  title: string;
  /** 1-indexed month in its respective calendar. */
  month: number;
  day: number;
}

export const persianHolidaysData: PersianHolidayEntry[] = [
  // --- فروردین ---
  { calendar: 'jalali', official: true, title: 'جشن نوروز / سال نو', month: 1, day: 1 },
  { calendar: 'jalali', official: true, title: 'عید نوروز', month: 1, day: 2 },
  { calendar: 'jalali', official: true, title: 'عید نوروز', month: 1, day: 3 },
  { calendar: 'jalali', official: true, title: 'عید نوروز', month: 1, day: 4 },
  { calendar: 'jalali', official: false, title: 'روز امید / روز شادباش‌نویسی', month: 1, day: 6 },
  { calendar: 'jalali', official: false, title: 'زادروز زرتشت', month: 1, day: 6 },
  { calendar: 'jalali', official: true, title: 'روز جمهوری اسلامی ایران', month: 1, day: 12 },
  { calendar: 'jalali', official: true, title: 'روز طبیعت (سیزده‌بدر)', month: 1, day: 13 },
  { calendar: 'jalali', official: false, title: 'روز دندانپزشک', month: 1, day: 23 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت عطار نیشابوری', month: 1, day: 25 },
  { calendar: 'jalali', official: false, title: 'روز ارتش جمهوری اسلامی ایران', month: 1, day: 29 },
  { calendar: 'jalali', official: false, title: 'روز علوم آزمایشگاهی', month: 1, day: 30 },

  // --- اردیبهشت ---
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت سعدی', month: 2, day: 1 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت شیخ بهایی و روز معماری', month: 2, day: 3 },
  { calendar: 'jalali', official: false, title: 'روز ملی خلیج فارس', month: 2, day: 10 },
  { calendar: 'jalali', official: false, title: 'روز معلم', month: 2, day: 12 },
  { calendar: 'jalali', official: false, title: 'روز شیراز / جشن بهاربد', month: 2, day: 15 },
  { calendar: 'jalali', official: false, title: 'زادروز مریم میرزاخانی و روز زن در ریاضیات', month: 2, day: 22 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت فردوسی', month: 2, day: 25 },
  { calendar: 'jalali', official: false, title: 'روز ارتباطات و روابط عمومی', month: 2, day: 27 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت حکیم عمر خیام', month: 2, day: 28 },

  // --- خرداد ---
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت ملاصدرا', month: 3, day: 1 },
  { calendar: 'jalali', official: false, title: 'فتح خرمشهر و روز مقاومت و پیروزی', month: 3, day: 3 },
  { calendar: 'jalali', official: false, title: 'روز دزفول (روز مقاومت و پایداری)', month: 3, day: 4 },
  { calendar: 'jalali', official: true, title: 'رحلت حضرت امام خمینی (ره)', month: 3, day: 14 },
  { calendar: 'jalali', official: true, title: 'قیام ۱۵ خرداد', month: 3, day: 15 },
  { calendar: 'jalali', official: false, title: 'روز ملی گل و گیاه', month: 3, day: 25 },
  { calendar: 'jalali', official: false, title: 'روز اصناف', month: 3, day: 31 },

  // --- تیر ---
  { calendar: 'jalali', official: false, title: 'جشن آغاز تابستان', month: 4, day: 1 },
  { calendar: 'jalali', official: false, title: 'روز قوه قضاییه', month: 4, day: 7 },
  { calendar: 'jalali', official: false, title: 'روز صنعت و معدن', month: 4, day: 10 },
  { calendar: 'jalali', official: false, title: 'روز قلم', month: 4, day: 14 },
  { calendar: 'jalali', official: false, title: 'روز بهزیستی و تأمین اجتماعی', month: 4, day: 25 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت خوارزمی و روز فناوری اطلاعات', month: 4, day: 22 },

  // --- مرداد ---
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت سهروردی', month: 5, day: 8 },
  { calendar: 'jalali', official: false, title: 'روز حقوق بشر اسلامی و کرامت انسانی', month: 5, day: 14 },
  { calendar: 'jalali', official: false, title: 'روز خبرنگار', month: 5, day: 17 },
  { calendar: 'jalali', official: false, title: 'روز حمایت از صنایع کوچک', month: 5, day: 21 },
  { calendar: 'jalali', official: false, title: 'سالروز بازگشت آزادگان به میهن', month: 5, day: 26 },
  { calendar: 'jalali', official: false, title: 'روز صنعت دفاعی', month: 5, day: 31 },

  // --- شهریور ---
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت بوعلی سینا و روز پزشک', month: 6, day: 1 },
  { calendar: 'jalali', official: false, title: 'آغاز هفته دولت', month: 6, day: 2 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت زکریای رازی و روز داروساز', month: 6, day: 5 },
  { calendar: 'jalali', official: false, title: 'روز صنعت چاپ', month: 6, day: 11 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت ابوریحان بیرونی', month: 6, day: 13 },
  { calendar: 'jalali', official: false, title: 'روز سینما', month: 6, day: 21 },
  { calendar: 'jalali', official: false, title: 'روز شعر و ادب فارسی و بزرگداشت استاد شهریار', month: 6, day: 27 },
  { calendar: 'jalali', official: false, title: 'آغاز هفته دفاع مقدس', month: 6, day: 31 },

  // --- مهر ---
  { calendar: 'jalali', official: false, title: 'روز آتش‌نشانی و ایمنی', month: 7, day: 7 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت شمس تبریزی', month: 7, day: 7 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت مولوی', month: 7, day: 8 },
  { calendar: 'jalali', official: false, title: 'روز ملی کودک', month: 7, day: 16 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت حافظ', month: 7, day: 20 },
  { calendar: 'jalali', official: false, title: 'روز استاندارد', month: 7, day: 22 },
  { calendar: 'jalali', official: false, title: 'روز تربیت بدنی و ورزش', month: 7, day: 26 },
  { calendar: 'jalali', official: false, title: 'روز صادرات', month: 7, day: 29 },

  // --- آبان ---
  { calendar: 'jalali', official: false, title: 'روز آمار و برنامه‌ریزی', month: 8, day: 1 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت ابوالفضل بیهقی', month: 8, day: 1 },
  { calendar: 'jalali', official: false, title: 'روز دانش‌آموز', month: 8, day: 13 },
  { calendar: 'jalali', official: false, title: 'روز کتاب و کتابخوانی', month: 8, day: 24 },

  // --- آذر ---
  { calendar: 'jalali', official: false, title: 'روز بسیج مستضعفان', month: 9, day: 5 },
  { calendar: 'jalali', official: false, title: 'روز نیروی دریایی', month: 9, day: 7 },
  { calendar: 'jalali', official: false, title: 'روز مجلس شورای اسلامی', month: 9, day: 10 },
  { calendar: 'jalali', official: false, title: 'روز بیمه', month: 9, day: 13 },
  { calendar: 'jalali', official: false, title: 'روز حسابدار', month: 9, day: 15 },
  { calendar: 'jalali', official: false, title: 'روز دانشجو', month: 9, day: 16 },
  { calendar: 'jalali', official: false, title: 'روز پژوهش و فناوری', month: 9, day: 25 },
  { calendar: 'jalali', official: false, title: 'شب یلدا (شب چله)', month: 9, day: 30 },

  // --- دی ---
  { calendar: 'jalali', official: false, title: 'شهادت سردار حاج قاسم سلیمانی', month: 10, day: 13 },
  { calendar: 'jalali', official: false, title: 'قتل امیرکبیر', month: 10, day: 20 },
  { calendar: 'jalali', official: false, title: 'روز هوای پاک', month: 10, day: 29 },

  // --- بهمن ---
  { calendar: 'jalali', official: false, title: 'زادروز فردوسی', month: 11, day: 1 },
  { calendar: 'jalali', official: false, title: 'بازگشت امام خمینی (ره) به ایران و آغاز دهه فجر', month: 11, day: 12 },
  { calendar: 'jalali', official: false, title: 'روز نیروی هوایی', month: 11, day: 19 },
  { calendar: 'jalali', official: true, title: 'پیروزی انقلاب اسلامی ایران (۲۲ بهمن)', month: 11, day: 22 },
  { calendar: 'jalali', official: false, title: 'جشن سپندارمذگان / روز عشق ایرانی', month: 11, day: 29 },

  // --- اسفند ---
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت خواجه نصیرالدین طوسی و روز مهندس', month: 12, day: 5 },
  { calendar: 'jalali', official: false, title: 'روز درختکاری', month: 12, day: 15 },
  { calendar: 'jalali', official: false, title: 'روز بزرگداشت پروین اعتصامی', month: 12, day: 25 },
  { calendar: 'jalali', official: true, title: 'روز ملی شدن صنعت نفت ایران', month: 12, day: 29 },
  { calendar: 'jalali', official: true, title: 'آخرین روز سال / روز عید نوروز', month: 12, day: 30 },

  // =========================================================================
  // تعطیلات و مناسبت‌های هجری قمری (Islamic Hijri Holidays)
  // =========================================================================
  // محرم (ماه ۱)
  { calendar: 'hijri', official: true, title: 'تاسوعای حسینی', month: 1, day: 9 },
  { calendar: 'hijri', official: true, title: 'عاشورای حسینی', month: 1, day: 10 },
  { calendar: 'hijri', official: false, title: 'شهادت امام زین‌العابدین (ع)', month: 1, day: 12 },

  // صفر (ماه ۲)
  { calendar: 'hijri', official: true, title: 'اربعین حسینی', month: 2, day: 20 },
  { calendar: 'hijri', official: true, title: 'رحلت رسول اکرم (ص) و شهادت امام حسن مجتبی (ع)', month: 2, day: 28 },
  { calendar: 'hijri', official: true, title: 'شهادت امام رضا (ع)', month: 2, day: 30 },

  // ربیع‌الاول (ماه ۳)
  { calendar: 'hijri', official: true, title: 'شهادت امام حسن عسکری (ع)', month: 3, day: 8 },
  { calendar: 'hijri', official: true, title: 'میلاد رسول اکرم (ص) و ولادت امام جعفر صادق (ع)', month: 3, day: 17 },

  // ربیع‌الثانی (ماه ۴)
  { calendar: 'hijri', official: false, title: 'ولادت امام حسن عسکری (ع)', month: 4, day: 8 },
  { calendar: 'hijri', official: false, title: 'وفات حضرت معصومه (س)', month: 4, day: 10 },

  // جمادی‌الاول (ماه ۵)
  { calendar: 'hijri', official: false, title: 'ولادت حضرت زینب (س) و روز پرستار', month: 5, day: 5 },

  // جمادی‌الثانی (ماه ۶)
  { calendar: 'hijri', official: true, title: 'شهادت حضرت فاطمه زهرا (س)', month: 6, day: 3 },
  { calendar: 'hijri', official: false, title: 'ولادت حضرت فاطمه زهرا (س) و روز زن و مادر', month: 6, day: 20 },

  // رجب (ماه ۷)
  { calendar: 'hijri', official: false, title: 'ولادت امام محمد باقر (ع)', month: 7, day: 1 },
  { calendar: 'hijri', official: false, title: 'شهادت امام علی‌النقی الهادی (ع)', month: 7, day: 3 },
  { calendar: 'hijri', official: false, title: 'ولادت امام محمد تقی (ع)', month: 7, day: 10 },
  { calendar: 'hijri', official: true, title: 'ولادت حضرت امام علی (ع) و روز پدر', month: 7, day: 13 },
  { calendar: 'hijri', official: false, title: 'وفات حضرت زینب (س)', month: 7, day: 15 },
  { calendar: 'hijri', official: false, title: 'شهادت امام موسی کاظم (ع)', month: 7, day: 25 },
  { calendar: 'hijri', official: true, title: 'مبعث حضرت رسول اکرم (ص)', month: 7, day: 27 },

  // شعبان (ماه ۸)
  { calendar: 'hijri', official: false, title: 'ولادت امام حسین (ع) و روز پاسدار', month: 8, day: 3 },
  { calendar: 'hijri', official: false, title: 'ولادت حضرت ابوالفضل العباس (ع) و روز جانباز', month: 8, day: 4 },
  { calendar: 'hijri', official: false, title: 'ولادت امام سجاد (ع)', month: 8, day: 5 },
  { calendar: 'hijri', official: false, title: 'ولادت حضرت علی‌اکبر (ع) و روز جوان', month: 8, day: 11 },
  { calendar: 'hijri', official: true, title: 'ولادت حضرت قائم (عج) و جشن نیمه شعبان', month: 8, day: 15 },

  // رمضان (ماه ۹)
  { calendar: 'hijri', official: false, title: 'ولادت امام حسن مجتبی (ع)', month: 9, day: 15 },
  { calendar: 'hijri', official: false, title: 'شب قدر', month: 9, day: 18 },
  { calendar: 'hijri', official: false, title: 'ضربت خوردن حضرت امام علی (ع)', month: 9, day: 19 },
  { calendar: 'hijri', official: true, title: 'شهادت حضرت امام علی (ع)', month: 9, day: 21 },
  { calendar: 'hijri', official: false, title: 'شب قدر', month: 9, day: 22 },

  // شوال (ماه ۱۰)
  { calendar: 'hijri', official: true, title: 'عید سعید فطر', month: 10, day: 1 },
  { calendar: 'hijri', official: true, title: 'تعطیل به مناسبت عید سعید فطر', month: 10, day: 2 },
  { calendar: 'hijri', official: true, title: 'شهادت امام جعفر صادق (ع)', month: 10, day: 25 },

  // ذی‌القعده (ماه ۱۱)
  { calendar: 'hijri', official: false, title: 'ولادت حضرت معصومه (س) و روز دختر', month: 11, day: 1 },
  { calendar: 'hijri', official: false, title: 'ولادت حضرت امام رضا (ع)', month: 11, day: 11 },
  { calendar: 'hijri', official: false, title: 'شهادت امام محمد تقی جوادالائمه (ع)', month: 11, day: 29 },

  // ذی‌الحجه (ماه ۱۲)
  { calendar: 'hijri', official: false, title: 'شهادت امام محمد باقر (ع)', month: 12, day: 7 },
  { calendar: 'hijri', official: false, title: 'روز عرفه', month: 12, day: 9 },
  { calendar: 'hijri', official: true, title: 'عید سعید قربان', month: 12, day: 10 },
  { calendar: 'hijri', official: false, title: 'ولادت امام علی‌النقی الهادی (ع)', month: 12, day: 15 },
  { calendar: 'hijri', official: true, title: 'عید سعید غدیر خم', month: 12, day: 18 },
  { calendar: 'hijri', official: false, title: 'ولادت امام موسی کاظم (ع)', month: 12, day: 20 },

  // =========================================================================
  // مناسبت‌های بین‌المللی میلادی (Gregorian International Days)
  // =========================================================================
  { calendar: 'gregorian', official: false, title: 'آغاز سال نو میلادی', month: 1, day: 1 },
  { calendar: 'gregorian', official: false, title: 'روز جهانی زن', month: 3, day: 8 },
  { calendar: 'gregorian', official: false, title: 'روز جهانی نوروز', month: 3, day: 21 },
  { calendar: 'gregorian', official: false, title: 'روز جهانی کارگر', month: 5, day: 1 },
  { calendar: 'gregorian', official: false, title: 'روز جهانی محیط زیست', month: 6, day: 5 },
  { calendar: 'gregorian', official: false, title: 'روز جهانی کودک', month: 11, day: 20 },
  { calendar: 'gregorian', official: false, title: 'روز جهانی حقوق بشر', month: 12, day: 10 },
  { calendar: 'gregorian', official: false, title: 'جشن کریسمس', month: 12, day: 25 },
];
