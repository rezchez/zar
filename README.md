# Zarfolio

Zarfolio یک نرم‌افزار حسابداری تخصصی برای کسب‌وکار طلا و فلزات گران‌بهاست.
این پوشه شامل رابط کاربری و APIهای سروری Next.js است و داده‌ها را از PocketBase
دریافت و ثبت می‌کند.

## فناوری‌ها

- Next.js با App Router و TypeScript
- PocketBase برای احراز هویت و ذخیره‌سازی
- Bun برای نصب بسته‌ها و اجرای پروژه
- احراز هویت دومرحله‌ای ایمیلی و Authenticator/TOTP
- خروجی Excel و PDF

## راه‌اندازی سریع

ابتدا در ریشه پروژه PocketBase را با migrationها اجرا کنید:

```powershell
cd ..
.\pocketbase.exe serve --migrationsDir .\pb_migrations
```

سپس در همین پوشه:

```powershell
bun install
bun dev
```

برنامه در آدرس زیر در دسترس است:

```text
http://localhost:3000
```

## متغیرهای محیطی

فایل `frontend/.env.local` باید شامل تنظیمات PocketBase و رمزساز باشد. مقدارهای
واقعی را در Git یا پیام‌های عمومی قرار ندهید:

```env
POCKETBASE_URL=http://127.0.0.1:8090
PB_AUTH_COOKIE=pb_auth
TOTP_ENCRYPTION_KEY=کلید هگزادسیمال ۶۴ کاراکتری
POCKETBASE_SUPERUSER_EMAIL=ایمیل سوپریوزر PocketBase
POCKETBASE_SUPERUSER_PASSWORD=رمز سوپریوزر PocketBase
```

به‌جای ایمیل و رمز می‌توان از `POCKETBASE_SUPERUSER_TOKEN` استفاده کرد.
پس از تغییر `.env.local`، Next.js را متوقف و دوباره اجرا کنید.

## نقش‌ها

ثبت‌نام عمومی همیشه کاربر با نقش `user` می‌سازد.

- `user`: استفاده از داشبورد و اطلاعات طرف‌حساب‌ها
- `manager`: مدیریت کاربران عادی و Managerها، گزارش‌ها و لاگ برنامه
- `admin`: دسترسی کامل مدیریتی

کاربر فعلی نمی‌تواند نقش یا وضعیت حساب خودش را تغییر دهد. Manager نیز اجازه
مدیریت حساب Admin یا ارتقای کاربر به Admin را ندارد.

## کالکشن‌های اصلی

- `users`: کاربران، نقش، وضعیت و تنظیمات امنیتی
- `customers`: اطلاعات هویتی، تماس، ارزها و مشخصات طرف‌حساب
- `transactions`: دفتر مستقل و منبع اصلی مانده هر طرف‌حساب
- `auth_events`: لاگ ورود، خروج، امنیت و عملیات مدیریتی
- `authenticator_secrets`: کلید رمزنگاری‌شده Authenticator

مانده‌های طلا، نقره، پلاتین، ریال، ارز دوم و ارز سوم در کالکشن
`transactions` نگهداری می‌شوند و از جمع تراکنش‌های `posted` به دست می‌آیند.
تراکنش نوع `opening_balance` با کلید یکتای
`opening:{customerId}` مانده اول دوره را نگه می‌دارد.

کد حساب طرف‌حساب در `customers` یکتا است. هنگام تغییر کد حساب، کد snapshot تمام
تراکنش‌های وابسته نیز همگام می‌شود.

## امکانات آماده

- ورود و خروج امن
- نمایش پیام مسدودی هنگام تلاش ورود
- تایید دومرحله‌ای ایمیلی و Authenticator با QR
- مدیریت کاربران، نقش، نام، مسدودی موقت یا دائمی
- مجوز یک‌بارمصرف ویرایش کد ملی
- ثبت طرف‌حساب با کد خودکار یا دستی
- نمایش اولیه طلا و ریال و افزودن اختیاری نقره، پلاتین و دو ارز
- جست‌وجو و مرتب‌سازی کاربران و طرف‌حساب‌ها
- ریز تراکنش‌های طرف‌حساب در بخش گزارشات
- خروجی Excel و PDF
- تاریخچه پنج فعالیت اخیر هر کاربر
- خروجی Excel کامل تاریخچه کاربر
- لاگ برنامه برای Admin و Manager با زمان دقیق، IP، سیستم‌عامل و تغییرات فیلدها
- جست‌وجوی سریع با میانبر `Alt+Z`
- دسترسی سریع افزودن مخاطب و ثبت سند
- حالت روز، شب و خودکار

## مسیرهای مهم

```text
/dashboard/customers
/dashboard/reports
/dashboard/users
/dashboard/activity-log
/dashboard/settings
```

## داده آزمایشی

برای ایجاد ۵۰ طرف‌حساب فارسی آزمایشی:

```powershell
bun run seed:customers
```

این اسکریپت به Superuser PocketBase نیاز دارد و فقط رکوردهای آزمایشی خودش را
مدیریت می‌کند. اجرای آن روی دیتابیس محلی، تراکنش‌های افتتاحیه‌ی آزمایشی نیز
ایجاد می‌کند؛ قبل از اجرا از دیتابیس پشتیبان بگیرید.

## بررسی کد

```powershell
bun run lint
bunx tsc --noEmit
$env:NODE_OPTIONS='--max-old-space-size=4096'
$env:NEXT_DIST_DIR='.next-build'
bun run build
```

## نکات امنیتی

- `pb_data` را حذف یا reset نکنید.
- secretها را داخل کد و Git قرار ندهید.
- کالکشن `authenticator_secrets` از مرورگر عمومی نیست.
- کد Authenticator فقط سمت سرور بررسی می‌شود.
- نشست ورود در کوکی HttpOnly نگهداری می‌شود.
- عملیات مهم در `auth_events` ثبت می‌شوند.

صفحه تنظیمات کلی به کالکشن‌های `app_settings` و `custom_fonts` در PocketBase
متصل است. این کالکشن‌ها در اولین درخواست تنظیمات، در صورت نبودن، با دسترسی
سرویس ادمین به‌صورت خودکار ساخته و همگام می‌شوند. برای اجرای دستی نیز می‌توان از
`bun run pocketbase:ensure-settings-collections` استفاده کرد.
