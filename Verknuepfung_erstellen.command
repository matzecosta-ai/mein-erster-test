#!/bin/bash
# Legt auf dem macOS-Schreibtisch eine "Musikarchiv.app" mit eigenem Icon an,
# die beim Doppelklick start_gui.command in diesem Ordner startet.
cd "$(dirname "$0")" || exit 1
SCRIPT_DIR="$(pwd)"
APP_PATH="$HOME/Desktop/Musikarchiv.app"

if [ ! -f "$SCRIPT_DIR/start_gui.command" ]; then
    echo "Konnte start_gui.command nicht finden. Bitte dieses Skript im selben Ordner ausfuehren."
    read -r -p "Enter zum Beenden ..." _
    exit 1
fi

if [ -e "$APP_PATH" ]; then
    rm -rf "$APP_PATH"
fi

TMP_DIR="$(mktemp -d)"
TMP_SCRIPT="$TMP_DIR/launcher.applescript"
cat > "$TMP_SCRIPT" << EOF
on run
    do shell script "cd " & quoted form of "$SCRIPT_DIR" & " && ./start_gui.command > /tmp/musikarchiv_gui.log 2>&1 &"
end run
EOF

osacompile -o "$APP_PATH" "$TMP_SCRIPT"
rm -rf "$TMP_DIR"

if [ -f "$SCRIPT_DIR/icon.icns" ] && [ -d "$APP_PATH/Contents/Resources" ]; then
    cp "$SCRIPT_DIR/icon.icns" "$APP_PATH/Contents/Resources/applet.icns"
    touch "$APP_PATH"
fi

echo "Fertig! Auf dem Schreibtisch wurde 'Musikarchiv.app' angelegt."
echo "Falls macOS beim ersten Start warnt (unbekannter Entwickler):"
echo "Rechtsklick auf Musikarchiv.app -> Oeffnen -> Oeffnen bestaetigen."
read -r -p "Enter zum Beenden ..." _
