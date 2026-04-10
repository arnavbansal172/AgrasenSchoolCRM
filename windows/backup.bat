@echo off
:: ============================================================
:: SAVM ERP — DATABASE BACKUP SCRIPT
:: Run this weekly or before any major update.
:: Backup is saved to: backups\ folder
:: ============================================================
title SAVM ERP - Database Backup
echo.
echo  ================================================
echo   SAVM ERP - Creating Database Backup
echo  ================================================

if not exist backups mkdir backups

:: Generate timestamp
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set DATESTR=%%c%%b%%a
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIMESTR=%%a%%b

set BACKUP_FILE=backups\savm_erp_backup_%DATESTR%_%TIMESTR%.sql

echo Creating backup: %BACKUP_FILE%

set PGPASSWORD=SavmErp@2026!
pg_dump -h localhost -U savm_user -d savm_erp -F p -f "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
  echo.
  echo [OK] Backup created: %BACKUP_FILE%
  echo      Copy this file to a USB drive or cloud storage for safety!
) else (
  echo [ERROR] Backup failed! Check PostgreSQL is running.
)

pause
