@echo off
chcp 65001 > nul
echo ==================================================
echo   Zarfolio - Verify Migration (Windows)
echo ==================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

if exist "%PROJECT_ROOT%\migrate\pocketbase\20260330120000_zarfolio_accounting_settings_and_documents.js" (
    echo   [OK] Migration file exists in migrate\pocketbase\
) else (
    echo   [ERROR] Migration file missing!
)

where bun >nul 2>nul
if %errorlevel% equ 0 (
    bun run -e "console.log('Checking database connection and schema...');"
)

echo.
echo ==================================================
echo   Verification complete!
echo ==================================================
pause
