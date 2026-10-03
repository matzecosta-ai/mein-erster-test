#!/bin/bash
# Musikarchiv - grafische Oberflaeche starten (macOS)
cd "$(dirname "$0")" || exit 1

PYCMD=""
if command -v python3 >/dev/null 2>&1; then
    PYCMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYCMD="python"
fi

if [ -z "$PYCMD" ]; then
    osascript -e 'display dialog "Python wurde nicht gefunden.\n\nBitte installiere Python von https://www.python.org/downloads/ und starte diese Datei danach erneut." buttons {"OK"} with icon caution with title "Musikarchiv"'
    exit 1
fi

install_pkg() {
    "$PYCMD" -m pip install --user "$1" >/dev/null 2>&1 && return 0
    "$PYCMD" -m pip install --user --break-system-packages "$1" >/dev/null 2>&1 && return 0
    return 1
}

WARNUNG=0

if ! "$PYCMD" -c "import mutagen" >/dev/null 2>&1; then
    echo "Installiere 'mutagen' (fuer Titel/Interpret/Album aus den Dateien) ..."
    if ! install_pkg mutagen || ! "$PYCMD" -c "import mutagen" >/dev/null 2>&1; then
        echo "Warnung: 'mutagen' konnte nicht installiert werden."
        echo "Titel werden dann nur anhand des Dateinamens erkannt."
        WARNUNG=1
    fi
fi

if ! "$PYCMD" -c "import pygame" >/dev/null 2>&1; then
    echo "Installiere 'pygame-ce' (fuer Abspielen/Stopp) ..."
    if ! install_pkg pygame-ce || ! "$PYCMD" -c "import pygame" >/dev/null 2>&1; then
        echo "Warnung: 'pygame-ce' konnte nicht installiert werden."
        echo "Abspielen/Stopp ist dann nicht verfuegbar, der Rest der App funktioniert trotzdem."
        WARNUNG=1
    fi
fi

if ! "$PYCMD" -c "import tkinter" >/dev/null 2>&1; then
    osascript -e 'display dialog "Tkinter (die grafische Oberflaeche) fehlt in dieser Python-Installation.\n\nMit Homebrew beheben: brew install python-tk\n\nOder Python direkt von https://www.python.org/downloads/ installieren, dort ist Tkinter bereits dabei." buttons {"OK"} with icon caution with title "Musikarchiv"'
    exit 1
fi

if [ "$WARNUNG" = "1" ]; then
    echo ""
    echo "Die App startet trotzdem gleich - dies ist nur eine Information."
    echo "Zum Fortfahren Enter druecken ..."
    read -r _
fi

"$PYCMD" -m musikarchiv.gui
