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
der Standard-Windows-Installation von python.org bereits dabei.)

## Grafische Oberfläche (Windows)

Einfach `start_gui.bat` per Doppelklick starten. Es öffnet sich **ein**
Fenster mit:

- einer Liste aller importierten Titel (Titel, Interpret, Album, Dauer,
  Stimmungen) – erscheint automatisch, sobald ein Ordner importiert wurde
- einem Suchfeld oben, das die Liste beim Tippen sofort nach Titel filtert
- einem Stimmungs-Filter (Dropdown) daneben
- einem Detailbereich rechts: beim Anklicken eines Titels werden dort die
  Stimmungen angezeigt, hinzugefügt oder entfernt – direkt im selben Fenster
- einem Bereich "Auf Festplatte sortieren" (Stimmung/Interpret, Kopieren/
  Verschieben/Verknüpfen), der über einen Ordner-Auswahldialog sortiert

Für ein Icon auf dem Desktop: `Verknuepfung_erstellen.bat` einmal per
Doppelklick ausführen. Sie legt eine Verknüpfung "Musikarchiv" mit dem
Icon (`icon.ico`) auf dem Desktop an, die direkt `start_gui.bat` öffnet.

Die GUI lässt sich auch direkt starten mit:

```bash
python -m musikarchiv.gui
```

## Kommandozeile (Alternative)

Statt der GUI kann auch weiterhin die Kommandozeile benutzt werden –
entweder direkt mit `python -m musikarchiv ...` oder über das
Text-Menü `start.bat`.

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

### 4. Auf der Festplatte sortieren

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

## Tests

```bash
pytest
```
