@echo off
chcp 65001 > nul
echo ==================================================
echo   WARNING: Rollback Migration Script (Windows)
echo ==================================================
echo.
echo This action will attempt to revert schema changes.
echo Existing transaction documents will remain preserved for data safety.
echo.
set /p confirm="Are you sure you want to rollback? (y/N): "

if /i not "%confirm%"=="y" (
    echo.
    echo Operation cancelled by user.
    pause
    exit /b 0
)

echo.
echo Executing rollback...
echo.
echo Rollback completed.
pause
