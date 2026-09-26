@echo off
setlocal
chcp 65001 >nul
title Musikarchiv - Verknuepfung erstellen

set "SCRIPT_DIR=%~dp0"
set "TARGET=%SCRIPT_DIR%start_gui.bat"
set "ICON=%SCRIPT_DIR%icon.ico"
set "SHORTCUT=%USERPROFILE%\Desktop\Musikarchiv.lnk"

if not exist "%TARGET%" (
    echo Konnte start_gui.bat nicht finden. Bitte dieses Skript im selben Ordner ausfuehren.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%');" ^
  "$s.TargetPath = '%TARGET%';" ^
  "$s.WorkingDirectory = '%SCRIPT_DIR%';" ^
  "$s.IconLocation = '%ICON%';" ^
  "$s.Save()"

if errorlevel 1 (
    echo Verknuepfung konnte nicht erstellt werden.
) else (
    echo Fertig! Auf dem Desktop wurde die Verknuepfung "Musikarchiv" mit Icon angelegt.
)
pause
