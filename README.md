# Musikarchiv

Ein kleines Kommandozeilen-Programm, um die eigene Musiksammlung zu
katalogisieren, nach Titel oder Stimmung zu durchsuchen und die Dateien
auf der Festplatte automatisch in Ordner zu sortieren.

Katalogisierung, Suche und Sortierung sind bewusst **ein** Programm mit
einer gemeinsamen SQLite-Datenbank (`~/.musikarchiv/musikarchiv.db`),
damit Metadaten und die tatsächliche Dateiablage nicht auseinanderlaufen.

## Installation

```bash
pip install -r requirements.txt
```

(`mutagen` liest die ID3/Tag-Metadaten aus den Dateien; ohne diese
Bibliothek funktioniert das Programm trotzdem, verwendet dann aber nur
den Dateinamen als Titel.)

## Benutzung

### Windows: Startskript

Unter Windows kann statt der Kommandozeilenbefehle einfach die Datei
`start.bat` per Doppelklick gestartet werden. Sie prüft/installiert
Python-Abhängigkeiten automatisch und führt danach per Menü durch alle
Funktionen (Importieren, Stimmungen vergeben, Suchen, Sortieren).

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
