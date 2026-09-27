# Musikarchiv

Ein Programm, um die eigene Musiksammlung zu katalogisieren, nach Titel
oder Stimmung zu durchsuchen und die Dateien auf der Festplatte
automatisch in Ordner zu sortieren. Es gibt eine grafische Oberfläche
(ein einziges Fenster: Liste + Suche + Details) und wahlweise eine
Kommandozeilen-Bedienung.

Katalogisierung, Suche und Sortierung sind bewusst **ein** Programm mit
einer gemeinsamen SQLite-Datenbank (`~/.musikarchiv/musikarchiv.db`),
damit Metadaten und die tatsächliche Dateiablage nicht auseinanderlaufen.

## Installation

```bash
pip install -r requirements.txt
```

(`mutagen` liest die ID3/Tag-Metadaten aus den Dateien; ohne diese
Bibliothek funktioniert das Programm trotzdem, verwendet dann aber nur
den Dateinamen als Titel. `tkinter` für die grafische Oberfläche ist bei
der Standard-Windows-Installation von python.org bereits dabei. `pygame-ce`
wird nur für Abspielen/Stopp gebraucht; falls die Installation fehlschlägt
(z.B. "Failed to build wheel" bei sehr neuen Python-Versionen), funktioniert
der Rest der App trotzdem - `start_gui.bat` installiert jede Bibliothek
einzeln und startet auch, wenn eine davon nicht klappt.)

## Grafische Oberfläche

- **Windows:** `start_gui.bat` per Doppelklick starten.
- **macOS:** `start_gui.command` per Doppelklick starten. Falls macOS beim
  ersten Start "kann nicht geöffnet werden, da der Entwickler nicht
  verifiziert werden kann" meldet: Rechtsklick auf die Datei → "Öffnen" →
  im Dialog nochmal "Öffnen" bestätigen (nur beim allerersten Mal nötig).
  Falls Tkinter fehlt: `brew install python-tk` (bei Python von
  python.org ist es schon dabei).

Es öffnet sich **ein** Fenster mit:

- einer Liste aller importierten Titel (Titel, Interpret, Jahr, Album,
  Dauer, Stimmungen) – erscheint automatisch, sobald ein Ordner
  importiert wurde
- einem Suchfeld oben, das die Liste beim Tippen sofort nach Titel filtert
- einem Stimmungs-Filter (Dropdown) daneben
- **Sortierbare Spalten**: Klick auf "Titel", "Interpret", "Album" oder
  "Stimmungen" in der Kopfzeile sortiert die Liste danach; nochmaliger
  Klick auf dieselbe Spalte dreht die Reihenfolge um (▲/▼-Pfeil zeigt an,
  wonach gerade sortiert ist)
- **Mehrfachauswahl**: mehrere Titel mit Strg-Klick (macOS: Cmd-Klick)
  oder Umschalt-Klick auswählen, z.B. um sie gemeinsam zu löschen
- **Titel löschen**: markierte Titel per Button "Ausgewählte löschen"
  (oder Entf-Taste) aus dem Archiv entfernen – nach Bestätigung wird nur
  der Datenbank-Eintrag gelöscht, die Musikdatei auf der Festplatte
  bleibt unangetastet
- einem Detailbereich rechts: beim Anklicken eines Titels werden dort die
  Stimmungen angezeigt, hinzugefügt oder entfernt – direkt im selben Fenster
- einem Bereich "Auf Festplatte sortieren" (Stimmung/Interpret, Kopieren/
  Verschieben/Verknüpfen), der über einen Ordner-Auswahldialog sortiert
- **▶ Abspielen / ⏹ Stopp** zum Reinhören in den ausgewählten Titel
  (Doppelklick auf einen Titel startet die Wiedergabe ebenfalls);
  unterstützt mp3/wav/ogg/flac, benötigt die Bibliothek `pygame`
- **Automatische Stimmungs-Vorschläge**: beim Import wird anhand des
  Genre-Tags der Datei eine passende Stimmung vorgeschlagen und vergeben
  (z.B. "Metal" → Wut/Spannung, "Ballade" → Liebeslieder/Romantik) – lässt
  sich über die Checkbox "Stimmung nach Genre vorschlagen" abschalten.
  **Wichtig:** Das ist eine Genre-basierte Faustregel, keine echte
  Audio-Analyse – eine KI, die den Song wirklich "anhört" und die Stimmung
  erkennt, wäre ein eigenes, deutlich aufwendigeres Projekt (trainiertes
  Machine-Learning-Modell). Vorschläge lassen sich jederzeit über
  "Ausgewählte Stimmung entfernen" korrigieren.
- **"Album-Stimmungen korrigieren"**: behebt nachträglich Titel, bei denen
  eine Stimmung (z.B. "Spannung" oder "leichte Spannung") versehentlich im
  Album-Feld statt bei den Stimmungen gelandet ist – erkennt das an kurzen
  Album-Texten (max. 3 Wörter), die ein bekanntes Stimmungswort enthalten,
  und verschiebt sie automatisch zu den Stimmungen. Läuft ab sofort auch
  automatisch bei jedem neuen Import mit.
- **Erscheinungsjahr**: wird beim Import automatisch aus den Metadaten
  gelesen und in der Liste sowie im Detailbereich angezeigt (sofern die
  Datei ein Datums-Tag enthält).
- **Nur echte Musikdateien**: Dateien mit passender Endung (.mp3 usw.),
  die sich nicht als echte Audiodatei lesen lassen (falsch benannt,
  beschädigt, o.ä.), werden beim Import übersprungen statt fälschlich
  als Titel angelegt zu werden.
- **Titelnummern werden automatisch entfernt**: aus "01 Sonnenschein"
  oder "007. Titelname" wird beim Import "Sonnenschein" bzw. "Titelname".
  Titel, die zufällig mit einer Zahl beginnen (z.B. "1979" oder "24K
  Magic"), bleiben unangetastet.

Für ein Icon auf dem Desktop:
- **Windows:** `Verknuepfung_erstellen.bat` einmal per Doppelklick
  ausführen. Legt eine Verknüpfung "Musikarchiv" mit Icon (`icon.ico`) auf
  dem Desktop an, die direkt `start_gui.bat` öffnet.
- **macOS:** `Verknuepfung_erstellen.command` einmal per Doppelklick
  ausführen. Legt "Musikarchiv.app" mit Icon (`icon.icns`) auf dem
  Schreibtisch an, die direkt `start_gui.command` öffnet.

Die GUI lässt sich auch direkt starten mit:

```bash
python -m musikarchiv.gui
```

## Kommandozeile (Alternative)

Statt der GUI kann auch weiterhin die Kommandozeile benutzt werden –
entweder direkt mit `python -m musikarchiv ...` oder über das Text-Menü
(`start.bat` unter Windows, `start.command` unter macOS).

### 1. Musik importieren

```bash
python -m musikarchiv import /pfad/zu/deiner/musik
```

Durchsucht den Ordner rekursiv nach mp3/flac/wav/m4a/ogg/wma/aac-Dateien
und legt sie in der Datenbank an (Titel/Interpret/Album aus den Tags,
sonst aus dem Dateinamen). Bereits importierte Dateien werden übersprungen.

### 2. Stimmungen vergeben

Stimmungen sind frei wählbar, ein paar Vorschläge:
Freude, Spannung, Liebeslieder, Drama, Trauer, Wut, Entspannung, Party,
Nostalgie, Motivation, Melancholie, Romantik, Hoffnung, Wehmut ...

```bash
python -m musikarchiv mood-add "Sonnenschein" Freude Motivation
python -m musikarchiv mood-remove "Sonnenschein" Motivation
python -m musikarchiv mood-list
```

Bei mehrdeutigem Titel-Suchtext listet der Befehl die Treffer mit ID auf;
dann kann die ID statt des Titels übergeben werden.

### 3. Suchen

```bash
python -m musikarchiv search-title "Sonnen"
python -m musikarchiv search-mood "Freude"
python -m musikarchiv list
```

### 4. Titel löschen

```bash
python -m musikarchiv delete "Sonnenschein" "Regentraenen"
```

Entfernt nur den Datenbank-Eintrag, die Musikdatei bleibt erhalten.
Mehrere Titel-IDs oder Titelnamen können auf einmal angegeben werden.

### 5. Auf der Festplatte sortieren

```bash
python -m musikarchiv organize /pfad/zum/zielordner --by mood --aktion copy
```

- `--by`: `mood` (Ordner pro Stimmung), `artist` (Ordner pro Interpret)
  oder `mood-artist` (Stimmung/Interpret)
- `--aktion`: `copy` (Standard, Original bleibt erhalten), `move`
  (verschiebt die Originaldatei) oder `link` (Symlink statt Kopie)

Hat ein Titel mehrere Stimmungen, landet er (Kopie oder Symlink) in
jedem passenden Stimmungsordner.

Eine eigene Datenbankdatei kann mit `--db /pfad/zur/datei.db` vor dem
jeweiligen Befehl angegeben werden.

### 6. Album-Stimmungen korrigieren

Falls schon vor dieser Funktion Titel importiert wurden, bei denen eine
Stimmung im Album-Feld statt bei den Stimmungen gelandet ist:

```bash
python -m musikarchiv fix-album-moods
```

(`import` fügt bei jedem Aufruf `--kein-genre-vorschlag` hinzu, um die
automatischen Genre-Vorschläge für diesen Import abzuschalten.)

## Tests

```bash
pytest
```
