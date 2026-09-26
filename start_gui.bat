@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Musikarchiv
cd /d "%~dp0"

rem --- Python-Befehl ermitteln (pythonw bevorzugt: kein Konsolenfenster) ---
set "PYCMD="
pythonw --version >nul 2>nul
if not errorlevel 1 set "PYCMD=pythonw"
if not defined PYCMD (
    python --version >nul 2>nul
    if not errorlevel 1 set "PYCMD=python"
)
if not defined PYCMD (
    py -3 --version >nul 2>nul
    if not errorlevel 1 set "PYCMD=py -3"
)
if not defined PYCMD (
    echo Python wurde nicht gefunden.
    echo Bitte installiere Python von https://www.python.org/downloads/
    echo und setze beim Installieren den Haken bei "Add Python to PATH".
    pause
    exit /b 1
)

rem --- Abhaengigkeiten pruefen und bei Bedarf installieren (dafuer "python" statt "pythonw") ---
rem Jede Bibliothek wird einzeln installiert: schlaegt eine fehl (z.B. pygame-ce
rem ohne fertiges Paket fuer diese Python-Version), startet die App trotzdem -
rem nur die jeweilige Zusatzfunktion fehlt dann.
set "CHECKCMD=%PYCMD%"
if "%PYCMD%"=="pythonw" set "CHECKCMD=python"
set "WARNUNG=0"

%CHECKCMD% -c "import mutagen" >nul 2>nul
if errorlevel 1 (
    echo Installiere 'mutagen' ^(fuer Titel/Interpret/Album aus den Dateien^) ...
    %CHECKCMD% -m pip install mutagen >nul
    if errorlevel 1 (
        echo Warnung: 'mutagen' konnte nicht installiert werden.
        echo Titel werden dann nur anhand des Dateinamens erkannt.
        set "WARNUNG=1"
    )
)

%CHECKCMD% -c "import pygame" >nul 2>nul
if errorlevel 1 (
    echo Installiere 'pygame-ce' ^(fuer Abspielen/Stopp^) ...
    %CHECKCMD% -m pip install pygame-ce >nul
    if errorlevel 1 (
        echo Warnung: 'pygame-ce' konnte nicht installiert werden.
        echo Abspielen/Stopp ist dann nicht verfuegbar, der Rest der App funktioniert trotzdem.
        echo Tipp: "python -m pip install --upgrade pip" ausfuehren und diese Datei erneut starten.
        set "WARNUNG=1"
    )
)

if "%WARNUNG%"=="1" (
    echo.
    echo Die App startet trotzdem gleich - dies ist nur eine Information.
    pause
)

%CHECKCMD% -c "import tkinter" >nul 2>nul
if errorlevel 1 (
    echo Tkinter ^(die grafische Oberflaeche^) fehlt in dieser Python-Installation.
    echo Bitte Python neu installieren und dabei "tcl/tk and IDLE" aktiviert lassen.
    pause
    exit /b 1
)

start "" %PYCMD% -m musikarchiv.gui
