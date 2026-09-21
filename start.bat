@echo off
chcp 65001 >nul
title Zarfolio Development Server

echo ============================================================
echo   🚀 اجرای محیط توسعه زرفولیو (Zarfolio Dev Server)
echo ============================================================
echo   🌐 فرانت‌اند (Next.js):     http://localhost:3000
echo   🗄️  بک‌اند (PocketBase):     http://127.0.0.1:8090
echo   🛠️  پنل ادمین (Dashboard): http://127.0.0.1:8090/_/
echo ------------------------------------------------------------
echo   برای متوقف کردن سرویس‌ها پنجره‌های ترمینال مربوطه را ببندید.
echo ============================================================
echo.

set "ROOT_DIR=%~dp0"

echo ▶ [1/2] در حال اجرای فرانت‌اند (bun run dev)...
start "Zarfolio - Frontend (Next.js)" /D "%ROOT_DIR%frontend" cmd /k "bun run dev"

timeout /t 2 /nobreak >nul

echo ▶ [2/2] در حال اجرای بک‌اند (PocketBase)...
if exist "%ROOT_DIR%backend\pocketbase.exe" (
    start "Zarfolio - Backend (PocketBase)" /D "%ROOT_DIR%backend" cmd /k "pocketbase.exe serve"
) else if exist "%ROOT_DIR%backend\pocketbase" (
    start "Zarfolio - Backend (PocketBase)" /D "%ROOT_DIR%backend" cmd /k "pocketbase serve"
) else (
    echo [هشدار] فایل اجرایی pocketbase در پوشه backend یافت نشد.
)

echo.
echo هر دو سرویس در ترمینال اجرا شدند.
pause
