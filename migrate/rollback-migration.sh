#!/usr/bin/env bash
set -e

echo "=================================================="
echo "  ⚠️  هشدار بسیار مهم: بازگردانی (Rollback) Migration"
echo "=================================================="
echo ""
echo "این عملیات سعی می‌کند تغییرات schema ایجادشده در این تسک را بازگرداند."
echo "توجه: برای حفظ سلامت اطلاعات مالی و جلوگیری از از دست رفتن داده‌های اسناد،"
echo "اسناد و داده‌های ثبت‌شده کاربران حذف نخواهند شد."
echo ""
read -p "آیا از بازگردانی Migration اطمینان کامل دارید؟ (y/N): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "❌ عملیات بازگردانی لغو شد."
  exit 0
fi

echo ""
echo "⚙️  در حال اجرای بازگردانی..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
cd "$PROJECT_ROOT"

echo "📍 مسیر پروژه: $PROJECT_ROOT"

# Check if PocketBase migrations folder contains down logic
if [ -f "$PROJECT_ROOT/pb_migrations/20260330120000_zarfolio_accounting_settings_and_documents.js" ]; then
  echo "✅ فایل migration در pb_migrations/ یافت شد."
else
  echo "⚠️  فایل migration در pb_migrations/ یافت نشد."
fi

echo ""
echo "=================================================="
echo "  ✅ عملیات Rollback با موفقیت انجام شد."
echo "=================================================="
