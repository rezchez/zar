@echo off
chcp 65001 > nul
echo ==================================================
echo   Zarfolio - Run Migration Script (Windows)
echo ==================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

echo Path: %PROJECT_ROOT%

if not exist "%PROJECT_ROOT%\pb_migrations" mkdir "%PROJECT_ROOT%\pb_migrations"

echo.
echo Syncing migration files to pb_migrations...

for %%f in ("%PROJECT_ROOT%\migrate\pocketbase\*.js") do (
    if not exist "%PROJECT_ROOT%\pb_migrations\%%~nxf" (
        copy "%%f" "%PROJECT_ROOT%\pb_migrations\%%~nxf" > nul
        echo   Copied %%~nxf to pb_migrations\
    ) else (
        echo   File %%~nxf already exists in pb_migrations\
    )
)

echo.
echo Executing schema update script...
where bun >nul 2>nul
if %errorlevel% equ 0 (
    bun scripts/ensure-settings-collections.ts
) else (
    echo   Warning: bun is not installed or not in PATH.
)

echo.
echo ==================================================
echo   Migration completed successfully!
echo ==================================================
pause
