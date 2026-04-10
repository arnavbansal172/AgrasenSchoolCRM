@echo off
title SAVM ERP - Stop
echo Stopping SAVM ERP...
pm2 stop all
echo Done. Services stopped.
pause
