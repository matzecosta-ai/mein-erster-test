#!/bin/bash
# Musikarchiv - Textmenue starten (macOS, Alternative zur grafischen Oberflaeche)
cd "$(dirname "$0")" || exit 1

PYCMD=""
if command -v python3 >/dev/null 2>&1; then
    PYCMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYCMD="python"
fi

if [ -z "$PYCMD" ]; then
    echo "Python wurde nicht gefunden."
    echo "Bitte installiere Python von https://www.python.org/downloads/"
    read -r -p "Enter zum Beenden ..." _
    exit 1
fi

if ! "$PYCMD" -c "import mutagen" >/dev/null 2>&1; then
    echo "Installiere benoetigte Bibliothek 'mutagen' ..."
    "$PYCMD" -m pip install --user mutagen >/dev/null 2>&1 \
        || "$PYCMD" -m pip install --user --break-system-packages mutagen >/dev/null 2>&1
fi

menu() {
    clear
    echo "============================"
    echo "        Musikarchiv"
    echo "============================"
    echo "1. Musik-Ordner importieren"
    echo "2. Stimmung(en) zu einem Titel hinzufuegen"
    echo "3. Stimmung von einem Titel entfernen"
    echo "4. Alle Stimmungen anzeigen"
    echo "5. Nach Titel suchen"
    echo "6. Nach Stimmung suchen"
    echo "7. Alle Titel auflisten"
    echo "8. Musik auf der Festplatte sortieren"
    echo "9. Beenden"
    echo ""
    read -r -p "Auswahl (1-9): " wahl

    case "$wahl" in
        1)
            echo ""
            read -r -p "Pfad zum Musik-Ordner (z.B. ~/Music): " ordner
            ordner="${ordner/#\~/$HOME}"
            "$PYCMD" -m musikarchiv import "$ordner"
            ;;
        2)
            echo ""
            read -r -p "Titel (oder ID, siehe Menuepunkt 7): " titel
            read -r -p "Stimmung(en), durch Leerzeichen getrennt (z.B. Freude Motivation): " stimmungen
            "$PYCMD" -m musikarchiv mood-add "$titel" $stimmungen
            ;;
        3)
            echo ""
            read -r -p "Titel (oder ID): " titel
            read -r -p "Zu entfernende Stimmung: " stimmung
            "$PYCMD" -m musikarchiv mood-remove "$titel" "$stimmung"
            ;;
        4)
            echo ""
            "$PYCMD" -m musikarchiv mood-list
            ;;
        5)
            echo ""
            read -r -p "Suchtext: " suchtext
            "$PYCMD" -m musikarchiv search-title "$suchtext"
            ;;
        6)
            echo ""
            read -r -p "Stimmung: " stimmung
            "$PYCMD" -m musikarchiv search-mood "$stimmung"
            ;;
        7)
            echo ""
            "$PYCMD" -m musikarchiv list
            ;;
        8)
            echo ""
            read -r -p "Zielordner (wird ggf. angelegt): " ziel
            ziel="${ziel/#\~/$HOME}"
            echo "Sortieren nach:  1) Stimmung   2) Interpret   3) Stimmung/Interpret"
            read -r -p "Auswahl (1-3, Standard 1): " bywahl
            case "$bywahl" in
                2) by="artist" ;;
                3) by="mood-artist" ;;
                *) by="mood" ;;
            esac
            echo "Aktion:  1) Kopieren   2) Verschieben   3) Verknuepfen"
            read -r -p "Auswahl (1-3, Standard 1): " aktwahl
            case "$aktwahl" in
                2) aktion="move" ;;
                3) aktion="link" ;;
                *) aktion="copy" ;;
            esac
            "$PYCMD" -m musikarchiv organize "$ziel" --by "$by" --aktion "$aktion"
            ;;
        9)
            exit 0
            ;;
        *)
            menu
            return
            ;;
    esac
    echo ""
    read -r -p "Enter zum Fortfahren ..." _
    menu
}

menu
