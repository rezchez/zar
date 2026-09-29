# ماژول مهاجرت از ته‌حساب به زرفولیو (Tahesab to Zarfolio Migration)

این ماژول وظیفه دریافت، تحلیل، استخراج، نرمال‌سازی، اعتبارسنجی و انتقال امن داده‌های مالی نرم‌افزار حسابداری ته‌حساب به سامانه زرفولیو را بر عهده دارد.

## ساختار لایه‌ها و ماژول‌ها

```
migration/tahesab/
├── fixtures/        # فایل‌های پشتیبان نمونه و تست (حفاظت‌شده با gitignore)
├── detector/        # اعتبارسنجی هدر و فرمت کانتینر باینری Zlib/Deflate
├── parser/          # استخراج فایل‌های فشرده و پارس دستورات SQL با انکودینگ CP1256
├── normalizer/      # تبدیل داده‌های خام به مدل میانی استاندارد
├── mapper/          # نگاشت مستقل حساب‌ها، طرف‌حساب‌ها، فلزات و ارزها
├── validator/       # اعتبارسنجی تراز، اوزان، عیارها و صحت داده‌ها
└── importer/        # ثبت نهایی در موتور حسابداری زرفولیو و قابلیت Rollback
```

## نحوه استفاده و اجرای Pipeline

```typescript
import {
  detectTahesabBackup,
  parseTahesabBackup,
  normalizeTahesabData,
  buildInitialMappings,
  validateTahesabMigration,
  importTahesabData,
  rollbackTahesabMigration,
} from './index';

// 1. تشخیص و بررسی صحت فایل
const detection = await detectTahesabBackup('fixtures/1.mcbk');

// 2. استخراج و پارس دیتابیس
const { rawDb } = await parseTahesabBackup('fixtures/1.mcbk');

// 3. نرمال‌سازی داده‌ها
const normalized = normalizeTahesabData(rawDb, detection.backupInfo!);

// 4. نگاشت خودکار و تعیین تکلیف
const mappings = buildInitialMappings(normalized, existingCustomers, existingAccounts);

// 5. اعتبارسنجی و پیش‌نمایش
const validation = validateTahesabMigration(normalized, mappings);

// 6. اجرای ایمپورت پایدار (Idempotent)
const result = await importTahesabData(pb, normalized, mappings, {
  migrationId: 'mig_14050626_001',
});

// 7. بازگشت به عقب در صورت نیاز (Rollback)
await rollbackTahesabMigration(pb, 'mig_14050626_001');
```

## امنیت و محرمانگی
فایل‌های `.Mcbk` حاوی اطلاعات مالی اشخاص و صنف طلا بوده و بر اساس قوانین پروژه زرفولیو، هرگز وارد گیت نمی‌شوند و مبالغ و اطلاعات هویتی در لاگ‌ها چاپ نمی‌گردند.
