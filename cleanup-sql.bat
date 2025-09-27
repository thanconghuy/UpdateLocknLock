@echo off
echo ====================================
echo    SQL FILES CLEANUP SCRIPT
echo ====================================
echo.

REM Count current SQL files
for /f %%i in ('dir /b *.sql 2^>nul ^| find /c /v ""') do set count=%%i
echo Found %count% SQL files to clean up
echo.

REM Show what will be deleted (preview)
echo Files that will be DELETED:
echo ----------------------------
dir /b *.sql | findstr /v /c:"archive"
echo.

set /p confirm="Do you want to DELETE all these SQL files? (y/N): "
if /i "%confirm%"=="y" (
    echo.
    echo Deleting SQL files...
    del *.sql
    echo ✅ All SQL files deleted successfully!
) else (
    echo.
    echo ❌ Cleanup cancelled. No files were deleted.
)

echo.
echo Remaining files:
dir /b *.sql 2>nul || echo No SQL files remaining
echo.
pause