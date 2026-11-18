@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Freisteller

if not exist ".venv\Scripts\python.exe" (
    echo Erster Start: richte den Freisteller ein. Das dauert einige Minuten ^(ca. 3 GB Download^).
    where py >nul 2>nul || (
        echo.
        echo Python fehlt. Bitte Python 3.12 von https://www.python.org/downloads/ installieren
        echo und beim Installieren "Add python.exe to PATH" anhaken. Danach diese Datei erneut starten.
        pause
        exit /b 1
    )
    py -3 -m venv .venv || goto fehler
    ".venv\Scripts\python.exe" -m pip install --upgrade pip || goto fehler
    ".venv\Scripts\python.exe" -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128 || goto fehler
    ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto fehler
)

if "%~1"=="" (
    start "" ".venv\Scripts\pythonw.exe" freisteller.py
) else (
    ".venv\Scripts\python.exe" freisteller.py %*
    pause
)
exit /b 0

:fehler
echo.
echo Die Einrichtung ist fehlgeschlagen. Ordner .venv loeschen und erneut starten.
pause
exit /b 1
