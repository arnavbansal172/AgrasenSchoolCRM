@echo off
:: ============================================================
:: SAVM ERP — ONE-TIME SETUP SCRIPT
:: Run this ONCE as Administrator to set up the entire system.
:: ============================================================
:: Prerequisites: Install Before Running:
::   1. Node.js 20 LTS  -> https://nodejs.org/
::   2. PostgreSQL 16   -> https://www.postgresql.org/download/windows/
::      (Installer sets postgres password - remember it!)
::   3. Git             -> https://git-scm.com/download/win
:: ============================================================

title SAVM ERP - First Time Setup
color 0A
echo.
echo  ====================================================
echo   SAVM ERP - First Time Setup
echo   Shri Agrasen Vidya Mandir
echo  ====================================================
echo.

:: Check Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js is not installed!
  echo         Please install from: https://nodejs.org/
  pause & exit /b 1
)
echo [OK] Node.js found: 
node --version

:: Check npm
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] npm not found. Reinstall Node.js.
  pause & exit /b 1
)

:: Check PostgreSQL
psql --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] PostgreSQL is not installed or not in PATH!
  echo         Install from: https://www.postgresql.org/download/windows/
  echo         After install, ensure psql.exe is in PATH.
  pause & exit /b 1
)
echo [OK] PostgreSQL found:
psql --version

:: Install PM2 globally
echo.
echo [STEP 1] Installing PM2 process manager...
npm install -g pm2
npm install -g pm2-windows-service
npm install -g serve
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Failed to install PM2. Check internet connection.
  pause & exit /b 1
)
echo [OK] PM2 installed.

:: Install app dependencies
echo.
echo [STEP 2] Installing application dependencies...
npm install
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Frontend npm install failed. & pause & exit /b 1 )
cd backend
npm install
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Backend npm install failed. & pause & exit /b 1 )
cd ..
echo [OK] Dependencies installed.

:: PostgreSQL Database Setup
echo.
echo [STEP 3] Setting up PostgreSQL database...
echo.
echo   You need to enter the PostgreSQL 'postgres' (master) password.
echo   This was set during PostgreSQL installation.
echo.

:: Create database user and database
set PG_HOST=localhost
set PGPASSWORD=
set /p PGPASSWORD=Enter 'postgres' master password: 

psql -h %PG_HOST% -U postgres -c "CREATE USER savm_user WITH PASSWORD 'SavmErp@2026!';" 2>nul
psql -h %PG_HOST% -U postgres -c "CREATE DATABASE savm_erp OWNER savm_user;" 2>nul
psql -h %PG_HOST% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE savm_erp TO savm_user;" 2>nul

:: Apply schema
echo Applying database schema...
psql -h %PG_HOST% -U savm_user -d savm_erp -f backend\db\schema.sql
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Schema failed. Check PostgreSQL password.
  pause & exit /b 1
)

:: Seed initial data
echo Seeding initial data (admin accounts, fee structure)...
node backend/db/seed.js
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Seeding failed. & pause & exit /b 1 )

echo [OK] Database ready!

:: Generate JWT Secret
echo.
echo [STEP 4] Generating security credentials...
for /f %%i in ('node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"') do set JWT_SECRET=%%i

:: Generate .env if not exists
if not exist "backend\.env" (
  echo Creating backend\.env...
  (
    echo DB_HOST=localhost
    echo DB_PORT=5432
    echo DB_NAME=savm_erp
    echo DB_USER=savm_user
    echo DB_PASSWORD=SavmErp@2026!
    echo PORT=3002
    echo JWT_SECRET=%JWT_SECRET%
    echo JWT_EXPIRES_IN=8h
    echo NODE_ENV=production
  ) > backend\.env
  echo [OK] .env created with secure JWT secret.
) else (
  echo [SKIP] backend\.env already exists.
)

:: Create logs directory
if not exist logs mkdir logs
echo [OK] Logs directory created.

:: Build frontend
echo.
echo [STEP 5] Building frontend for production...
npm run build
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Build failed. Check for errors above.
  pause & exit /b 1
)
echo [OK] Frontend built!

:: Configure Windows Firewall (allow LAN access)
echo.
echo [STEP 6] Configuring Windows Firewall...
netsh advfirewall firewall add rule name="SAVM ERP Backend (3002)" dir=in action=allow protocol=TCP localport=3002 >nul 2>&1
netsh advfirewall firewall add rule name="SAVM ERP Frontend (5173)" dir=in action=allow protocol=TCP localport=5173 >nul 2>&1
echo [OK] Firewall rules added.

:: Start PM2 services
echo.
echo [STEP 7] Starting SAVM ERP services...
pm2 start ecosystem.config.js
pm2 save
echo [OK] Services started.

:: Install as Windows Service (auto-start on boot)
echo.
echo [STEP 8] Installing as Windows startup service...
pm2-service-install -n SAVM_ERP
pm2 save

:: Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set LOCAL_IP=%%a
  goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo.
echo  ====================================================
echo   SAVM ERP Setup COMPLETE!
echo  ====================================================
echo.
echo   Access from this computer:
echo     App    : http://localhost:5173
echo     API    : http://localhost:3002
echo.
echo   Access from phones/tablets on school WiFi:
echo     App    : http://%LOCAL_IP%:5173
echo.
echo   Default Logins:
echo     Super Admin : superadmin / Admin@2026  (CHANGE THIS!)
echo     Admin       : admin / Admin123
echo.
echo   IMPORTANT: Change default passwords after first login!
echo.
echo  ====================================================
pause
