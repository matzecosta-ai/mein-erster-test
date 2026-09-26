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
set "CHECKCMD=%PYCMD%"
if "%PYCMD%"=="pythonw" set "CHECKCMD=python"
%CHECKCMD% -c "import mutagen" >nul 2>nul
if errorlevel 1 (
    echo Installiere benoetigte Bibliotheken, einen Moment ...
    %CHECKCMD% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Installation fehlgeschlagen. Bitte pruefe deine Internetverbindung.
        pause
        exit /b 1
    )
)

%CHECKCMD% -c "import tkinter" >nul 2>nul
if errorlevel 1 (
    echo Tkinter ^(die grafische Oberflaeche^) fehlt in dieser Python-Installation.
    echo Bitte Python neu installieren und dabei "tcl/tk and IDLE" aktiviert lassen.
    pause
    exit /b 1
)

start "" %PYCMD% -m musikarchiv.gui
