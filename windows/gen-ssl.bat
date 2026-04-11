@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: gen-ssl.bat  —  Generate a self-signed SSL certificate for SAVM ERP
:: Allows phone cameras to work over HTTPS on the local WiFi network.
::
:: REQUIRES: Git for Windows (includes OpenSSL)
:: Run this ONCE after setup.bat, then restart the server.
:: ─────────────────────────────────────────────────────────────────────────────
setlocal

echo.
echo  ════════════════════════════════════════════════
echo   SAVM ERP — SSL Certificate Generator
echo  ════════════════════════════════════════════════
echo.

:: Find the project root (parent of windows\ folder)
set "ROOT=%~dp0.."
set "SSL_DIR=%ROOT%\backend\ssl"

:: Create ssl directory if it doesn't exist
if not exist "%SSL_DIR%" mkdir "%SSL_DIR%"

:: Try to find OpenSSL from Git for Windows
set "OPENSSL="
if exist "C:\Program Files\Git\usr\bin\openssl.exe" (
    set "OPENSSL=C:\Program Files\Git\usr\bin\openssl.exe"
) else if exist "C:\Program Files (x86)\Git\usr\bin\openssl.exe" (
    set "OPENSSL=C:\Program Files (x86)\Git\usr\bin\openssl.exe"
)

if "%OPENSSL%"=="" (
    echo  [ERROR] OpenSSL not found.
    echo  Please install Git for Windows from: https://git-scm.com/
    echo  Then run this script again.
    pause
    exit /b 1
)

echo  Found OpenSSL at: %OPENSSL%
echo.

:: Get the PC's local IP address
for /f "tokens=4 delims= " %%a in ('route print ^| findstr "0.0.0.0" ^| head -1') do (
    set "LOCAL_IP=%%a"
)

:: Fallback: get first WiFi/Ethernet IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1 delims= " %%b in ("%%a") do (
        if "%LOCAL_IP%"=="" set "LOCAL_IP=%%b"
    )
)

if "%LOCAL_IP%"=="" set "LOCAL_IP=192.168.1.100"

echo  Detected local IP: %LOCAL_IP%
echo  (If wrong, change it manually in the cert later)
echo.

:: Create OpenSSL config file
set "CONF=%SSL_DIR%\openssl.conf"
(
echo [req]
echo default_bits       = 2048
echo prompt             = no
echo default_md         = sha256
echo distinguished_name = dn
echo x509_extensions    = v3_req
echo.
echo [dn]
echo C  = IN
echo ST = Gujarat
echo L  = Ahmedabad
echo O  = Shri Agrasen Vidya Mandir
echo CN = %LOCAL_IP%
echo.
echo [v3_req]
echo subjectAltName = @alt_names
echo.
echo [alt_names]
echo IP.1   = %LOCAL_IP%
echo IP.2   = 127.0.0.1
echo DNS.1  = localhost
) > "%CONF%"

:: Generate the certificate
echo  Generating SSL certificate...
"%OPENSSL%" req -x509 -newkey rsa:2048 -sha256 -days 3650 ^
    -nodes ^
    -keyout "%SSL_DIR%\server.key" ^
    -out    "%SSL_DIR%\server.crt" ^
    -config "%CONF%" 2>nul

if exist "%SSL_DIR%\server.crt" (
    echo.
    echo  ✅ SSL Certificate created successfully!
    echo.
    echo  ┌──────────────────────────────────────────────────────┐
    echo  │  Next Steps:                                         │
    echo  │                                                      │
    echo  │  1. Restart the server:  windows\start.bat          │
    echo  │                                                      │
    echo  │  2. On each phone, open once:                        │
    echo  │     https://%LOCAL_IP%:3443                         │
    echo  │                                                      │
    echo  │  3. iPhone: tap "Advanced" → "Proceed"              │
    echo  │     Android: tap "Advanced" → "Proceed"             │
    echo  │                                                      │
    echo  │  4. Then open the app at:                            │
    echo  │     http://%LOCAL_IP%:5173                          │
    echo  │     (App uses HTTPS for camera automatically)        │
    echo  └──────────────────────────────────────────────────────┘
    echo.
) else (
    echo.
    echo  [ERROR] Certificate generation failed.
    echo  Check that OpenSSL is installed and try again.
    echo.
)

pause
