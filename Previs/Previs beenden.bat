@echo off
rem Beendet den lokalen Previs-Server.
set PORT=8173
set FOUND=
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr /c:"127.0.0.1:%PORT% " ^| findstr /c:"0.0.0.0:0"') do (
  taskkill /F /PID %%p >nul 2>&1
  set FOUND=1
)
if defined FOUND (echo Previs wurde beendet.) else (echo Previs lief nicht.)
timeout /t 2 /nobreak >nul
