#!/usr/bin/env bash
set -e

echo "=================================================="
echo "  سامانه حسابداری Zarfolio - اجرای اسکریپت Migration"
echo "=================================================="
echo ""

# 1. تشخیص مسیر پروژه
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
cd "$PROJECT_ROOT"

echo "📍 مسیر پروژه: $PROJECT_ROOT"

# 2. بررسی پوشه‌های مقصد و مبدأ
MIGRATE_SRC="$PROJECT_ROOT/migrate/pocketbase"
PB_MIGRATIONS_DIR="$PROJECT_ROOT/pb_migrations"

if [ ! -d "$MIGRATE_SRC" ]; then
  echo "❌ خطا: پوشه $MIGRATE_SRC پیدا نشد."
  exit 1
fi

mkdir -p "$PB_MIGRATIONS_DIR"

echo "🔄 در حال همگام‌سازی فایل‌های migration با پوشه استاندارد pb_migrations..."

for file in "$MIGRATE_SRC"/*.js; do
  if [ -f "$file" ]; then
    filename="$(basename "$file")"
    dest_file="$PB_MIGRATIONS_DIR/$filename"

    if [ ! -f "$dest_file" ]; then
      cp "$file" "$dest_file"
      echo "  ✅ فایل $filename به pb_migrations/ کپی شد."
    else
      echo "  ℹ️  فایل $filename قبلاً در pb_migrations/ وجود دارد."
    fi
  fi
done

echo ""
echo "⚙️  در حال اجرای به‌روزرسانی Schema و داده‌های اولیه‌ با Bun/PocketBase..."

if command -v bun >/dev/null 2>&1; then
  echo "  🚀 اجرای اسکریپت همگام‌سازی مجموعه‌ها با Bun..."
  bun scripts/ensure-settings-collections.ts
else
  echo "  ⚠️  دستور Bun پیدا نشد؛ لطفاً مطمئن شوید Bun در سیستم شما نصب است."
fi

echo ""
echo "=================================================="
echo "  ✅ عملیات Migration با موفقیت انجام شد!"
echo "=================================================="
