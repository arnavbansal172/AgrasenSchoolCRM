@echo off
:: ============================================================
:: SAVM ERP — REMOTE UPDATE SCRIPT
:: Run this to pull latest code from GitHub and restart.
:: ============================================================
:: This is how the admin (you) updates the application remotely.
:: The database is NEVER touched — only code is updated.
:: ============================================================

title SAVM ERP - Update
color 0B
echo.
echo  ====================================================
echo   SAVM ERP - Updating from GitHub
echo  ====================================================
echo.

:: Pull latest code
echo [1/5] Pulling latest code from GitHub...
git pull origin main
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Git pull failed! Check internet / git credentials.
  pause & exit /b 1
)
echo [OK] Code updated.

:: Install any new dependencies
echo.
echo [2/5] Installing new dependencies (if any)...
npm install --production
cd backend
npm install --production
cd ..
echo [OK] Dependencies ready.

:: Rebuild frontend
echo.
echo [3/5] Rebuilding frontend...
npm run build
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Build failed! Rolling back may be needed.
  pause & exit /b 1
)
echo [OK] Frontend rebuilt.

:: Restart PM2 services (database is completely unaffected)
echo.
echo [4/5] Restarting services (zero-downtime reload)...
pm2 reload ecosystem.config.js
echo [OK] Services restarted.

:: Save PM2 state
echo.
echo [5/5] Saving PM2 configuration...
pm2 save
echo [OK] Done!

echo.
echo  ====================================================
echo   Update COMPLETE! SAVM ERP is running latest code.
echo   Database data was NOT affected.
echo  ====================================================
echo.
pm2 status
pause
