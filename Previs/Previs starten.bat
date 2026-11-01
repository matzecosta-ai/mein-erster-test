@echo off
rem Startet Previs: beendet einen alten Previs-Server, startet den aktuellen und oeffnet den Browser.
cd /d "%~dp0"
set PORT=8173
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr /c:"127.0.0.1:%PORT% " ^| findstr /c:"0.0.0.0:0"') do taskkill /F /PID %%p >nul 2>&1
set PY=
where py >nul 2>&1 && set PY=py -3
if not defined PY (
  python -c "import sys" >nul 2>&1 && set PY=python
)
if not defined PY (
  echo Python wurde nicht gefunden. Bitte zuerst Python installieren, siehe "Zuerst lesen.txt".
  pause
  exit /b 1
)
start "Previs Server (dieses Fenster offen lassen)" /min %PY% server.py %PORT%
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/"
