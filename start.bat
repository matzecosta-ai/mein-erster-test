@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Musikarchiv
cd /d "%~dp0"

rem --- Python-Befehl ermitteln (python oder py) ---
set "PYCMD="
python --version >nul 2>nul
if not errorlevel 1 set "PYCMD=python"
if not defined PYCMD (
    py --version >nul 2>nul
    if not errorlevel 1 set "PYCMD=py"
)
if not defined PYCMD (
    echo Python wurde nicht gefunden.
    echo Bitte installiere Python von https://www.python.org/downloads/
    echo und setze beim Installieren den Haken bei "Add Python to PATH".
    pause
    exit /b 1
)

rem --- Abhaengigkeiten pruefen und bei Bedarf installieren ---
%PYCMD% -c "import mutagen" >nul 2>nul
if errorlevel 1 (
    echo Installiere benoetigte Bibliotheken, einen Moment ...
    %PYCMD% -m pip install -r requirements.txt
    if errorlevel 1 (
        echo Installation fehlgeschlagen. Bitte pruefe deine Internetverbindung.
        pause
        exit /b 1
    )
)

:menu
cls
echo ============================
echo         Musikarchiv
echo ============================
echo 1. Musik-Ordner importieren
echo 2. Stimmung(en) zu einem Titel hinzufuegen
echo 3. Stimmung von einem Titel entfernen
echo 4. Alle Stimmungen anzeigen
echo 5. Nach Titel suchen
echo 6. Nach Stimmung suchen
echo 7. Alle Titel auflisten
echo 8. Musik auf der Festplatte sortieren
echo 9. Beenden
echo.
set "wahl="
set /p wahl="Auswahl (1-9): "

if "%wahl%"=="1" goto import
if "%wahl%"=="2" goto moodadd
if "%wahl%"=="3" goto moodremove
if "%wahl%"=="4" goto moodlist
if "%wahl%"=="5" goto searchtitle
if "%wahl%"=="6" goto searchmood
if "%wahl%"=="7" goto list
if "%wahl%"=="8" goto organize
if "%wahl%"=="9" goto ende
goto menu

:import
echo.
set "ordner="
set /p ordner="Pfad zum Musik-Ordner (z.B. C:\Users\DeinName\Music): "
set ordner=%ordner:"=%
%PYCMD% -m musikarchiv import "%ordner%"
echo.
pause
goto menu

:moodadd
echo.
set "titel="
set "stimmungen="
set /p titel="Titel (oder ID, siehe Menuepunkt 7): "
set /p stimmungen="Stimmung(en), durch Leerzeichen getrennt (z.B. Freude Motivation): "
%PYCMD% -m musikarchiv mood-add "%titel%" %stimmungen%
echo.
pause
goto menu

:moodremove
echo.
set "titel="
set "stimmung="
set /p titel="Titel (oder ID): "
set /p stimmung="Zu entfernende Stimmung: "
%PYCMD% -m musikarchiv mood-remove "%titel%" "%stimmung%"
echo.
pause
goto menu

:moodlist
echo.
%PYCMD% -m musikarchiv mood-list
echo.
pause
goto menu

:searchtitle
echo.
set "suchtext="
set /p suchtext="Suchtext: "
%PYCMD% -m musikarchiv search-title "%suchtext%"
echo.
pause
goto menu

:searchmood
echo.
set "stimmung="
set /p stimmung="Stimmung: "
%PYCMD% -m musikarchiv search-mood "%stimmung%"
echo.
pause
goto menu

:list
echo.
%PYCMD% -m musikarchiv list
echo.
pause
goto menu

:organize
echo.
set "ziel="
set /p ziel="Zielordner (wird ggf. angelegt): "
set ziel=%ziel:"=%
echo Sortieren nach:  1) Stimmung   2) Interpret   3) Stimmung/Interpret
set "bywahl="
set /p bywahl="Auswahl (1-3, Standard 1): "
if "%bywahl%"=="2" (set "by=artist") else if "%bywahl%"=="3" (set "by=mood-artist") else (set "by=mood")
echo Aktion:  1) Kopieren   2) Verschieben   3) Verknuepfen
set "aktwahl="
set /p aktwahl="Auswahl (1-3, Standard 1): "
if "%aktwahl%"=="2" (set "akt=move") else if "%aktwahl%"=="3" (set "akt=link") else (set "akt=copy")
%PYCMD% -m musikarchiv organize "%ziel%" --by %by% --aktion %akt%
echo.
pause
goto menu

:ende
endlocal
exit /b 0
