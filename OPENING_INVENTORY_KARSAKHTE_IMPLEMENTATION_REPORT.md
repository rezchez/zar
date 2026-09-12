# گزارش جامع پیاده‌سازی موجودی اول دوره کارساخته (Manufactured Jewelry Opening Inventory)

این گزارش مستندسازی کامل طراحی، تحلیل، پیاده‌سازی و راستی‌آزمایی ماژول **موجودی اول دوره کارساخته** در نرم‌افزار حسابداری و مدیریت طلای **Zarfolio** است.

---

## ۱. تحلیل مقایسه‌ای: تب «کارساخته» در ثبت سند در برابر «موجودی اول دوره کارساخته»

برای تضمین یکپارچگی تجربه کاربری (UX) و انطباق کامل با منطق محاسباتی سیستم زر، تب «کارساخته» (`WorkmanshipTab.tsx`) به عنوان مرجع اصلی فرم و فیلدها تحلیل گردید:

| شاخص / فیلد | تب کارساخته (ثبت سند) | موجودی اول دوره کارساخته | توضیحات و هماهنگی |
| :--- | :--- | :--- | :--- |
| **نوع کالا و نام مصنوع** | ورودی متنی با دکمه‌های پیش‌فرض سریع (النگو، انگشتر، دستبند، و...) | ورودی متنی با چیپ‌های پیشنهادی یکسان (۱۲ آیتم استاندارد) | حفظ سرعت و سهولت ثبت برای طلافروشان و بنکداران |
| **نوع فلز پایه** | طلا، نقره، پلاتین | طلا (Au)، نقره (Ag)، پلاتین (Pt) | انتخاب رادیویی با عیار مبنای پویا |
| **عیار و عیار مبنا** | عیار انتخابی (۷۵۰ طلا، ۹۲۵ نقره، ۸۰۰ پلاتین) | عیار انتخابی + چیپ‌های عیار پرکاربرد (۷۵۰، ۷۴۰، ۷۰۵، ...) | تبدیل دقیق بر مبنای عیار پایه تعریف شده در تنظیمات سیستم |
| **روش محاسبه اجرت (Wage Mode)** | دوگانه: به ازای هر گرم (`per_gram`) و به ازای هر عدد (`per_item`) | دوگانه: به ازای هر گرم (`per_gram`) و به ازای هر عدد (`per_item`) | انطباق ۱۰۰٪ با فرمول محاسباتی تب کارساخته |
| **محاسبه وزن معادل** | `(وزن خام × عیار) / عیار پایه` | `(وزن خام × عیار) / عیار پایه` با گردکردن استاندارد | بدون خطاهای ممیز شناور (IEEE-754) |
| **ارزش‌گذاری و قیمت‌گذاری** | مظنه فلز خام + درصد سود + تخفیف + مبلغ کل | مظنه فلز خام + سود + تخفیف + ارزش کل با فرمول هوشمند | امکان درج دستی یا بازنشانی به فرمول خودکار |
| **انتخاب ارز** | ریال، تومان و ارزهای تعریف‌شده سیستم | ریال / تومان و ارزهای خارجی تعریف‌شده در سیستم | خواندن مستقیم از Master Data ارزها (`/api/currencies`) |
| **رویکرد حسابداری دوبل** | صدور سند حسابداری و بدهکار/بستانکار کردن طرف‌حساب | **صرفاً ثبت در انبار پایه اولیه** بدون صدور سند دوبل در موتور حسابداری | جلوگیری از هرگونه دستکاری ترازهای افتتاحیه و اسناد قبلی |

---

## ۲. ساختار دیتابیس و کالکشن جدید (`workmanship_inventory`)

یک کالکشن اختصاصی با نام `workmanship_inventory` از طریق میگریشن پاکت‌بیس (`20260912150000_create_workmanship_inventory_collection.js`) در دیتابیس ایجاد و اعمال شد:

```javascript
// اسکیما و ایندکس‌های کالکشن workmanship_inventory
{
  name: "workmanship_inventory",
  type: "base",
  schema: [
    { name: "code", type: "text", required: true },
    { name: "name", type: "text", required: true },
    { name: "metal", type: "select", options: { values: ["gold", "silver", "platinum"] }, required: true },
    { name: "quantity", type: "number", required: true },
    { name: "raw_weight", type: "number", required: true },
    { name: "purity", type: "number", required: true },
    { name: "base_karat", type: "number", required: true },
    { name: "converted_weight", type: "number", required: true },
    { name: "wage", type: "number" },
    { name: "wage_mode", type: "select", options: { values: ["per_gram", "per_item"] } },
    { name: "total_wage", type: "number" },
    { name: "metal_price", type: "number" },
    { name: "profit_percentage", type: "number" },
    { name: "discount_amount", type: "number" },
    { name: "golden_percentage", type: "number" },
    { name: "total_amount", type: "number" },
    { name: "currency_id", type: "relation", options: { collectionId: "currencies" } },
    { name: "currency_code", type: "text" },
    { name: "currency_symbol", type: "text" },
    { name: "currency_amount", type: "number" },
    { name: "storage_location", type: "text" },
    { name: "description", type: "text" },
    { name: "date", type: "text", required: true },
    { name: "is_opening_balance", type: "bool", required: true },
    { name: "is_deleted", type: "bool", required: true },
    { name: "created_by", type: "relation", options: { collectionId: "users" } }
  ],
  indexes: [
    "CREATE INDEX idx_workmanship_inventory_code ON workmanship_inventory (code)",
    "CREATE INDEX idx_workmanship_inventory_metal ON workmanship_inventory (metal)",
    "CREATE INDEX idx_workmanship_inventory_opening ON workmanship_inventory (is_opening_balance, is_deleted)"
  ]
}
```

---

## ۳. فیلدهای پیاده‌سازی‌شده و فرمول‌های محاسباتی

### ۳.۱. فیلدهای فرم ورودی
1. **کد خودکار**: تولید فرمت استاندارد `WRK-XXXXXX` (۶ رقم یکتا بر مبنای شمارنده اقلام).
2. **نام کالا / مصنوع (`name`)**: ورودی متنی همراه با ۱۲ چیپ سریع (النگو، انگشتر، دستبند، زنجیر، گردنبند، گوشواره، سرویس طلا، نیم‌ست، مدال / پلاک، تک‌پوش، پابند، ساعت طلا).
3. **فلز پایه (`metal`)**: طلا (`gold`)، نقره (`silver`)، پلاتین (`platinum`).
4. **تعداد اقلام (`quantity`)**: عدد صحیح مثبت (حداقل ۱).
5. **وزن ناخالص / کل به گرم (`raw_weight`)**: عدد اعشاری با دقت تنظیمات برنامه (پیش‌فرض ۳ رقم اعشار).
6. **عیار کالا (`purity`)**: ورودی عددی با چیپ‌های رایج (۷۵۰، ۷۴۰، ۷۰۵، ۸۷۵، ۹۰۰ برای طلا؛ ۹۲۵، ۹۹۹، ۹۰۰، ۸۴۰ برای نقره؛ ۸۰۰، ۹۵۰، ۹۰۰، ۸۵۰ برای پلاتین).
7. **روش محاسبه اجرت (`wage_mode`)**: انتخاب دکمه‌ای بین «به ازای هر گرم» (`per_gram`) و «به ازای هر عدد» (`per_item`).
8. **نرخ اجرت (`wage`)**: ورودی با کاماگذاری ریالی/تومانی استاندارد (`PriceInput`).
9. **نرخ فلز خام (`metal_price`)**: نرخ هر گرم طلای خام (مظنه).
10. **درصد سود (`profit_percentage`)**: درصد سود متعارف فروشگاه/کارگاه.
11. **تخفیف (`discount_amount`)**: مبلغ تخفیف ریالی.
12. **ارزش کل نهایی (`total_amount`)**: با قابلیت بازنشانی هوشمند به فرمول یا بازنویسی دستی.
13. **ارز و مقدار ارزی (`currency_id`, `currency_code`, `currency_amount`)**: انتخاب از ارزهای سیستم.
14. **محل نگهداری (`storage_location`)**: ویترین، گاوصندوق، یا انبار.
15. **تاریخ ثبت (`date`)**: انتخابگر تاریخ شمسی تقویم جلالی (`DatePicker`).
16. **توضیحات (`description`)**: یادداشت‌های تکمیلی ردیف.

### ۳.۲. فرمول‌های ریاضی و دامنه محاسبات
- **اجرت کل (`total_wage`)**:
  $$\text{Total Wage} = \begin{cases} \text{round}(\text{raw\_weight} \times \text{wage}) & \text{mode} = \text{per\_gram} \\ \text{round}(\text{quantity} \times \text{wage}) & \text{mode} = \text{per\_item} \end{cases}$$
- **وزن معادل بر عیار مبنا (`converted_weight`)**:
  $$\text{Converted Weight} = \text{round}\left(\frac{\text{raw\_weight} \times \text{purity}}{\text{base\_karat}}, \text{precision}\right)$$
- **ارزش کل برآورد فرمولی (`total_amount`)**:
  $$\text{Metal Total} = \text{round}(\text{converted\_weight} \times \text{metal\_price})$$
  $$\text{Base Cost} = \text{Metal Total} + \text{Total Wage}$$
  $$\text{Profit Amount} = \text{round}\left(\text{Base Cost} \times \frac{\text{profit\_percentage}}{100}\right)$$
  $$\text{Formula Total} = \max(0, \text{Base Cost} + \text{Profit Amount} - \text{discount\_amount})$$

---

## ۴. مسیرها و روت‌های ایجادشده

1. **مسیر کاربری کلاینت و سرور**:
   - `/dashboard/documents/initial-inventory/workmanship`
   - کامپوننت سرور: `frontend/app/dashboard/documents/initial-inventory/workmanship/page.tsx`
   - کامپوننت کلاینت: `frontend/features/workmanship/components/InitialWorkmanshipInventoryClient.tsx`
   - مدال ثبت و ویرایش: `frontend/features/workmanship/components/InitialWorkmanshipInventoryModal.tsx`
2. **روت API حسابداری**:
   - `/api/accounting/opening/workmanship`
   - مسیر فایل: `frontend/app/api/accounting/opening/workmanship/route.ts`
   - پشتیبانی از متدهای:
     - `GET`: دریافت لیست اقلام فعال و محاسبه خلاصه آماری فلزات و ارزها
     - `POST`: ایجاد و ویرایش ردیف با اعتبارسنجی مقادیر، تولید کد `WRK-XXXXXX` و تضمین پرچم‌های `is_opening_balance = true`
     - `DELETE`: حذف با اولویت Hard-Delete و بازگشت خودکار به Soft-Delete در صورت قفل دیتابیسی

---

## ۵. نحوه اتصال به منوی موجودی اول دوره و ناوبری

1. **کارت ناوبری در داشبورد موجودی اول دوره**:
   - در مسیر `/dashboard/documents/initial-inventory`، کارت اختصاصی با آیکون `Sparkles`، عنوان «موجودی اول دوره کارساخته» و توضیحات «ثبت و تراز مصنوعات طلا و جواهر بر اساس قطعه، اجرت و عیار تبدیل شده» به همراه لینک مستقیم به `/dashboard/documents/initial-inventory/workmanship` تعبیه شد.
   - کامپوننت کارت: `frontend/features/workmanship/components/InitialWorkmanshipInventoryCard.tsx` (و بازنشر در `src/components/inventory/InitialWorkmanshipInventoryCard.tsx`).
2. **بردکرامب (Breadcrumbs)**:
   - در فایل‌های `frontend/components/layout/Breadcrumbs.tsx` و `frontend/src/components/Breadcrumbs.tsx`، مسیر `/dashboard/documents/initial-inventory/workmanship` و شناسه `workmanship` با عنوان فارسی **«کارساخته»** ثبت شد.

---

## ۶. تفکیک فلزات و خلاصه‌سازی آماری (KPI Summaries)

کارت‌های آماری در بالای جدول کارساخته به تفکیک فلزات پیاده‌سازی شدند:
1. **کارت مجموع اقلام و قطعات**: نمایش تعداد کل ردیف‌ها، مجموع کل قطعات فیزیکی، و ارزش‌گذاری کل ریالی.
2. **کارت کارساخته طلا (Au)**: وزن ناخالص طلا، وزن معادل عیار ۷۵۰، تعداد قطعات و مجموع اجرت طلا.
3. **کارت کارساخته نقره (Ag)**: وزن ناخالص نقره، وزن معادل عیار ۹۲۵، تعداد قطعات و مجموع اجرت نقره.
4. **کارت کارساخته پلاتین (Pt)**: وزن ناخالص پلاتین، وزن معادل عیار ۸۰۰، تعداد قطعات و مجموع اجرت پلاتین.
5. **فیلترهای همزمان**: فیلتر بر اساس فلز (همه، طلا، نقره، پلاتین)، فیلتر بر اساس روش اجرت (همه، هر گرم، هر عدد)، و جستجوی آنی در نام، کد، توضیحات و محل نگهداری.

---

## ۷. سیستم چندارزی و نحوه نگهداری

- ارز پیش‌فرض سیستم (ریال یا تومان) بر اساس تنظیمات اصلی نمایش داده می‌شود.
- در فرم ثبت و مدال، لیست کامل ارزهای فعال خارجی از اندپوینت `/api/currencies` فراخوانی می‌شود.
- کاربر در صورت تمایل می‌تواند ارز خارجی و مقدار ارزی متناظر را ثبت نماید؛ این اطلاعات در فیلدهای `currency_id`، `currency_code`، `currency_symbol` و `currency_amount` ذخیره شده و در جدول و خلاصه‌های تفکیکی گزارش می‌شوند.
- مبالغ ریالی بر اساس قوانین ریال در دیتابیس (عدد صحیح) نگهداری شده و تبدیل به تومان صرفاً در لایه نمایش با `convertRialToToman` انجام می‌گیرد.

---

## ۸. سازگاری با تاریخ شمسی و دقت اعشار

- **انتخابگر تاریخ**: از کامپوننت رسمی پروژه `@/components/ui/date-picker` و توابع تاریخ جلالی (`lib/jalali.ts`) برای تبدیل و ثبت تاریخ شمسی استفاده شده است.
- **دقت اعشار وزن**: بر اساس فیلد `weightDecimalPlaces` در تنظیمات عمومی برنامه (`app_settings`) وزن‌های خام و معادل محاسبه و فرمت‌بندی می‌شوند (`lib/weight.ts`).

---

## ۹. تضمین عدم تداخل با موتور دوبل و اسناد ثبت‌شده قبلی

- مطابق با دستور صریح کاربر، این بخش **هیچ‌گونه سند دوبلی به موتور حسابداری (`accounting-posting-engine`) تزریق نمی‌کند** و هیچ دستکاری در جدول `transactions` یا کدهای معین/تفصیلی حسابداری صورت نمی‌گیرد.
- رکوردهای موجودی اول دوره کارساخته در کالکشن مجزا و ایزوله `workmanship_inventory` نگهداری شده و تحت تراز انبار اول دوره مدیریت می‌شوند.

---

## ۱۰. لیست فایل‌های ایجادشده و تغییریافته

### فایل‌های جدید (Created):
1. `backend/pb_migrations/20260912150000_create_workmanship_inventory_collection.js`
2. `frontend/lib/workmanship-inventory.ts`
3. `frontend/app/api/accounting/opening/workmanship/route.ts`
4. `frontend/features/workmanship/components/InitialWorkmanshipInventoryCard.tsx`
5. `frontend/features/workmanship/components/InitialWorkmanshipInventoryModal.tsx`
6. `frontend/features/workmanship/components/InitialWorkmanshipInventoryClient.tsx`
7. `frontend/app/dashboard/documents/initial-inventory/workmanship/page.tsx`
8. `frontend/src/components/inventory/InitialWorkmanshipInventoryCard.tsx`
9. `frontend/src/components/inventory/InitialWorkmanshipInventoryModal.tsx`
10. `frontend/src/components/inventory/InitialWorkmanshipInventoryClient.tsx`
11. `frontend/tests/workmanship-opening-inventory.test.ts`
12. `OPENING_INVENTORY_KARSAKHTE_IMPLEMENTATION_REPORT.md`

### فایل‌های تغییریافته (Modified):
1. `frontend/app/dashboard/documents/initial-inventory/page.tsx` (افزودن کارت ناوبری به صفحه اول دوره)
2. `frontend/components/layout/Breadcrumbs.tsx` (افزودن برچسب فارسی مسیر کارساخته)
3. `frontend/src/components/Breadcrumbs.tsx` (افزودن برچسب فارسی مسیر کارساخته)

---

## ۱۱. نتیجه تست‌ها و دستورات وریفای

مطابق با فایل راهنمای پروژه (`AGENTS.md`)، تمامی تست‌های واحد و فرآیند بیلد کامل به دقت اجرا شدند:

### ۱. اجرای تست‌های اختصاصی کارساخته:
```bash
bun test tests/workmanship-opening-inventory.test.ts
```
**نتیجه**: ۱۷ تست در ۵ لایه محاسباتی با ۴۹ ارزیابی (`expect`) در کمتر از ۹۸ میلی‌ثانیه پاس شدند:
- محاسبات اجرت در حالت‌های هر گرم و هر عدد
- تبدیل وزن به عیار پایه طلا (۷۵۰)، نقره (۹۲۵) و پلاتین (۸۰۰)
- آزمون فرمول ارزش‌گذاری کل و اعمال تخفیف و سود
- تجمیع آماری و تفکیک طلا، نقره و پلاتین
- تست پیش‌فرض‌های مصنوعات طلا و جواهر

### ۲. اجرای کل تست‌های پروژه:
```bash
bun test tests/
```
**نتیجه**: تمامی **۴۲۲ تست در ۵۳ فایل تستی** با موفقیت ۱۰۰٪ پاس شدند (۰ خطا).

### ۳. اجرای بیلد نهایی Next.js:
```bash
bun run build
```
**نتیجه**: خروجی بدون هیچ‌گونه خطای تایپ یا کامپایل با وضعیت کد ۰ به اتمام رسید (`✓ Compiled successfully`, `✓ Finished TypeScript`, `✓ Generating static pages (74/74)`).
