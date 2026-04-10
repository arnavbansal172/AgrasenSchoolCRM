@echo off
title SAVM ERP - Start
echo Starting SAVM ERP services...
pm2 start ecosystem.config.js
pm2 status
echo.
echo App URL: http://localhost:5173
echo.
pause
