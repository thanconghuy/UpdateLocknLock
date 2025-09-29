@echo off
echo Cleaning up development SQL and debug files...

echo Removing SQL files...
del /q *.sql 2>nul

echo Removing HTML test files...
del /q *.html 2>nul

echo Removing JS debug files...
del /q debug-*.js 2>nul
del /q test-*.js 2>nul

echo Removing migration markdown files...
del /q MIGRATION_*.md 2>nul

echo Removing archive directory...
rmdir /s /q archive 2>nul

echo Cleanup completed!
echo.
echo Files that will remain:
dir /b src\ docs\ *.json *.md *.txt *.env* package.json tsconfig.json vite.config.ts