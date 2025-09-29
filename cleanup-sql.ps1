# SQL Files Cleanup Script
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "    SQL FILES CLEANUP SCRIPT" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Get all SQL files
$sqlFiles = Get-ChildItem -Name "*.sql" -ErrorAction SilentlyContinue
$count = $sqlFiles.Count

Write-Host "Found $count SQL files to clean up" -ForegroundColor Yellow
Write-Host ""

if ($count -eq 0) {
    Write-Host "✅ No SQL files found. Directory is already clean!" -ForegroundColor Green
    Read-Host "Press Enter to exit"
    exit
}

# Show files that will be deleted
Write-Host "Files that will be DELETED:" -ForegroundColor Red
Write-Host "----------------------------" -ForegroundColor Red
$sqlFiles | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
Write-Host ""

# Confirm deletion
$confirm = Read-Host "Do you want to DELETE all these SQL files? (y/N)"

if ($confirm -eq "y" -or $confirm -eq "Y") {
    Write-Host ""
    Write-Host "Deleting SQL files..." -ForegroundColor Yellow

    Remove-Item "*.sql" -Force

    Write-Host "✅ All SQL files deleted successfully!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Cleanup cancelled. No files were deleted." -ForegroundColor Red
}

Write-Host ""
Write-Host "Archive directory contents:" -ForegroundColor Cyan
if (Test-Path "archive/sql-scripts") {
    Get-ChildItem "archive/sql-scripts" | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
} else {
    Write-Host "  No archive directory found" -ForegroundColor Gray
}

Write-Host ""
Read-Host "Press Enter to exit"