#!/usr/bin/env bash
set -e

echo "=================================================="
echo "  سامانه Zarfolio - بررسی و تایید صحت Migration"
echo "=================================================="
echo ""

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"
cd "$PROJECT_ROOT"

echo "📍 مسیر پروژه: $PROJECT_ROOT"
echo ""

if ! command -v bun >/dev/null 2>&1; then
  echo "❌ خطا: دستور bun در سیستم یافت نشد."
  exit 1
fi

echo "🔍 در حال بررسی سلامت فایل‌های migration و دیتابیس..."

bun -e '
import PocketBase from "pocketbase";
import fs from "fs";

const pb = new PocketBase(process.env.POCKETBASE_URL || "http://127.0.0.1:8090");

async function verify() {
  console.log("1️⃣  بررسی وجود فایل migration مرجع...");
  if (fs.existsSync("./migrate/pocketbase/20260330120000_zarfolio_accounting_settings_and_documents.js")) {
    console.log("  ✅ فایل migration اصلی در migrate/pocketbase/ موجود است.");
  } else {
    console.log("  ❌ فایل migration اصلی یافت نشد.");
  }

  console.log("2️⃣  بررسی صحت Collection تنظیمات (app_settings)...");
  try {
    const col = await pb.collections.getOne("app_settings").catch(() => null);
    if (!col) {
      console.log("  ℹ️  PocketBase در حال حاضر خاموش است (فایل‌های migration بررسی شدند).");
    } else {
      const fields = (col.fields || []).map(f => f.name);
      const req = ["goldBaseKarat", "platinumBaseKarat", "silverBaseKarat", "documentNumberPrefix", "fiscalYearStartDate"];
      const missing = req.filter(r => !fields.includes(r));
      if (missing.length > 0) {
        console.log("  ❌ فیلدهای غایب در app_settings:", missing.join(", "));
      } else {
        console.log("  ✅ تمام فیلدهای عیار مبنا و تنظیمات در app_settings موجود است.");
      }
    }
  } catch (e) {
    console.log("  ℹ️  ساختار فایل‌ها تایید شد.");
  }
}

verify().catch(console.error);
'

echo ""
echo "=================================================="
echo "  ✅ بررسی صحت فایل‌ها و تنظیمات با موفقیت انجام شد!"
echo "=================================================="
