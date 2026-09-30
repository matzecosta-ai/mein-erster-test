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
  Musikrichtung, LC-Nummer, Dauer, Stimmungen) – erscheint automatisch,
  sobald ein Ordner importiert wurde. Sowohl senkrecht (bei vielen Titeln)
  als auch waagerecht (bei schmalerem Fenster, damit auch die hinteren
  Spalten wie Dauer/Stimmungen erreichbar bleiben) gibt es eine
  Scrollleiste.
- **Import läuft im Hintergrund** mit Fortschrittsbalken (Datei X von Y):
  friert bei sehr großen Sammlungen (mehrere zehntausend Dateien, egal wie
  viel GB) nicht ein, sondern zeigt live an, wie weit der Import ist
- einem Suchfeld oben, das die Liste beim Tippen sofort nach Titel filtert
- einem Stimmungs-Filter (Dropdown) daneben
- **Sortierbare Spalten**: Klick auf "Titel", "Interpret", "Album",
  "Musikrichtung" oder "Stimmungen" in der Kopfzeile sortiert die Liste
  danach; nochmaliger Klick auf dieselbe Spalte dreht die Reihenfolge um
  (▲/▼-Pfeil zeigt an, wonach gerade sortiert ist)
- **Ansicht umschalten: Titel / Alben** (Umschalter oben in der
  Werkzeugleiste): Die Album-Ansicht fasst alle Titel **desselben Albums**
  zu einer aufklappbaren Zeile zusammen (mit Interpret, Jahr, Anzahl
  Titel, Stimmungen) – gruppiert wird nach Albumname allein, nicht nach
  Interpret, damit z.B. Feature-Titel ("Bruno Mars feat. Cardi B") nicht
  aus dem Album herausfallen; haben die Titel eines Albums unterschied­
  liche Interpreten, steht dort "Verschiedene Interpreten". Auf den Pfeil
  bzw. das Album klicken klappt es auf und zeigt die enthaltenen Titel
  eingerückt darunter – die Alben bleiben standardmäßig zugeklappt, bis
  man draufklickt. Ein Titel darin lässt sich wie in der Titel-Ansicht
  anklicken (Details, Stimmungen bearbeiten) und per Doppelklick
  abspielen. Zusätzlich: Album auswählen und "Titel dieses Albums
  anzeigen" wechselt in die volle Titel-Ansicht, gefiltert auf genau
  dieses Album (z.B. um dort auch nach Jahr/LC-Nummer zu sortieren);
  "Filter aufheben" zeigt wieder alle Titel.
- **Mehrfachauswahl**: mehrere Titel mit Strg-Klick (macOS: Cmd-Klick)
  oder Umschalt-Klick auswählen, z.B. um sie gemeinsam zu löschen oder
  gemeinsam eine Stimmung/Musikrichtung zu setzen (siehe unten)
- **Titel löschen**: markierte Titel per Button "Ausgewählte löschen"
  (oder Entf-Taste) aus dem Archiv entfernen – nach Bestätigung wird nur
  der Datenbank-Eintrag gelöscht, die Musikdatei auf der Festplatte
  bleibt unangetastet
- einem Detailbereich rechts: beim Anklicken eines Titels werden dort die
  Stimmungen angezeigt, hinzugefügt oder entfernt – direkt im selben
  Fenster. Das funktioniert auch bei **mehreren gleichzeitig ausgewählten
  Titeln**: die neue Stimmung wird dann bei allen markierten Titeln
  eingetragen; zum Entfernen bei Mehrfachauswahl den Namen der Stimmung
  in das Eingabefeld tippen und auf "Stimmung entfernen" klicken (bei nur
  einem ausgewählten Titel reicht wie bisher ein Klick auf die Stimmung
  in der Liste, dann auf "Stimmung entfernen").
- **Musikrichtung selbst eintragen/ändern**: im Detailbereich neben der
  Musikrichtung ein Textfeld mit Knopf "Musikrichtung setzen" – trägt den
  eingegebenen Text für den ausgewählten Titel ein (überschreibt das aus
  dem Genre-Tag gelesene Genre). Funktioniert genauso bei **mehreren
  gleichzeitig ausgewählten Titeln**: alle markierten Titel bekommen
  dieselbe Musikrichtung. Leeres Feld + Knopf entfernt die Musikrichtung
  wieder.
- einem Bereich "Auf Festplatte sortieren" (Stimmung/Interpret, Kopieren/
  Verschieben/Verknüpfen), der über einen Ordner-Auswahldialog sortiert
- **▶ Abspielen / ⏹ Stopp** zum Reinhören in den ausgewählten Titel
  (Doppelklick auf einen Titel startet die Wiedergabe ebenfalls);
  unterstützt mp3/wav/ogg/flac, benötigt die Bibliothek `pygame`
- **Suchleiste zum Spulen**: während der Wiedergabe läuft unter den
  Abspiel-Knöpfen ein Schieberegler mit, der die aktuelle Position im Song
  zeigt (Zeitangabe "1:23 / 3:45" darunter). Reinklicken oder den Regler
  ziehen springt direkt an diese Stelle im Song – so lassen sich gezielt
  interessante Stellen ansteuern. Zusätzlich gibt es die Knöpfe "⏪ 10s"
  und "10s ⏩" zum schnellen Vor-/Zurückspringen in 10-Sekunden-Schritten.
  Funktioniert nur, wenn die Dateidauer bekannt ist (steht normalerweise im
  Detailbereich); ist das nicht der Fall, bleibt die Leiste deaktiviert.
- **Automatische Stimmungs-Vorschläge**: beim Import wird anhand des
  Genre-Tags der Datei eine passende Stimmung vorgeschlagen und vergeben
  (z.B. "Metal" → Wut/Spannung, "Ballade" → Liebeslieder/Romantik) – lässt
  sich über die Checkbox "Stimmung nach Genre vorschlagen" abschalten.
  **Wichtig:** Das ist eine Genre-basierte Faustregel, keine echte
  Audio-Analyse – eine KI, die den Song wirklich "anhört" und die Stimmung
  erkennt, wäre ein eigenes, deutlich aufwendigeres Projekt (trainiertes
  Machine-Learning-Modell). Vorschläge lassen sich jederzeit über
  "Stimmung entfernen" korrigieren.
- **"Werkzeuge ▾" → "Album-Stimmungen korrigieren"**: behebt nachträglich Titel, bei denen
  eine Stimmung (z.B. "Spannung" oder "leichte Spannung") versehentlich im
  Album-Feld statt bei den Stimmungen gelandet ist – erkennt das an kurzen
  Album-Texten (max. 3 Wörter), die ein bekanntes Stimmungswort enthalten,
  und verschiebt sie automatisch zu den Stimmungen. Läuft ab sofort auch
  automatisch bei jedem neuen Import mit.
- **Erscheinungsjahr**: wird beim Import automatisch aus den Metadaten
  gelesen und in der Liste sowie im Detailbereich angezeigt (sofern die
  Datei ein Datums-Tag enthält).
- **Musikrichtung** (z.B. Pop, Rock, Klassik, Indie): wird beim Import
  automatisch aus dem Genre-Tag der Datei gelesen und in eigener Spalte
  sowie im Detailbereich angezeigt (sofern die Datei ein Genre-Tag
  enthält). Dasselbe Tag wird auch für die automatischen
  Stimmungs-Vorschläge genutzt. Lässt sich jederzeit manuell nachtragen
  oder korrigieren (siehe "Musikrichtung selbst eintragen/ändern" oben).
- **LC-Nummer** (Labelcode): wird beim Import automatisch erkannt und in
  Liste sowie Detailbereich angezeigt. Gelesen wird das Verlag/Publisher-
  Feld der Datei (und als Rückfallebene das Copyright-Feld) nach einem
  Muster wie "LC 06861" oder "LC-06861" durchsucht. Steht die LC-Nummer
  bei deinen Dateien in einem anderen Feld, sag Bescheid.
- **Nur echte Musikdateien**: Dateien mit passender Endung (.mp3 usw.),
  die sich nicht als echte Audiodatei lesen lassen (falsch benannt,
  beschädigt, o.ä.), werden beim Import übersprungen statt fälschlich
  als Titel angelegt zu werden.
- **Titelnummern werden automatisch entfernt**: aus "01 Sonnenschein"
  oder "007. Titelname" wird beim Import "Sonnenschein" bzw. "Titelname".
  Titel, die zufällig mit einer Zahl beginnen (z.B. "1979" oder "24K
  Magic"), bleiben unangetastet.
- **Chart-Hits erkennen**: enthält das Album-Feld einen Hinweis wie
  "... Charts" oder "Chart-Hit" (üblicherweise am Ende), wird automatisch
  zusätzlich die Stimmung "Charts" vergeben – das Album selbst bleibt
  unverändert erhalten. So lässt sich über den Stimmungs-Filter oder die
  Stimmungs-Suche gezielt nach Chart-Hits filtern. Für bereits importierte
  Titel: "Werkzeuge ▾" → "Chart-Hits markieren".
- **Instrumental-Versionen erkennen**: enthält Titel, Album oder Genre
  einen Hinweis wie "Instrumental" oder "Instrumentalversion" (z.B.
  "Sonnenschein (Instrumental)"), wird automatisch zusätzlich die
  Stimmung "Instrumental" vergeben – Titel/Album bleiben unverändert.
  Für bereits importierte Titel: "Werkzeuge ▾" → "Instrumental-Titel
  markieren".
- **LC-Nummern online nachschlagen** (experimentell), in drei Varianten:
  Alle suchen bei der freien Musikdatenbank
  [MusicBrainz](https://musicbrainz.org) nach dem passenden Labelcode. Das
  ist ein **Bestmöglicher-Versuch, keine Garantie**: MusicBrainz wird von
  Freiwilligen gepflegt, nicht jedes Album ist erfasst, und in
  Einzelfällen (mehrere Pressungen, Wiederveröffentlichungen auf anderen
  Labels) kann die Zuordnung danebenliegen – deshalb werden nur sehr
  sichere Treffer automatisch übernommen. **Bestehende LC-Nummern werden
  nie überschrieben.** Braucht in allen Fällen eine Internetverbindung.
  - **Für einen einzelnen Titel**: Titel in der Liste auswählen, dann im
    Detailbereich rechts neben der LC-Nummer auf "🔍 LC-Nummer(n) online
    suchen" klicken. Es wird ausschließlich dieser eine Titel durchsucht
    (nicht das ganze restliche Album). Auch über die Kommandozeile:
    `python -m musikarchiv lookup-lc-titel "Titelname"`.
  - **Für mehrere ausgewählte Titel**: mehrere Titel mit Strg-Klick
    (macOS: Cmd-Klick) oder Umschalt-Klick markieren, dann denselben
    Knopf "🔍 LC-Nummer(n) online suchen" klicken. Es werden nur die
    markierten Titel durchsucht – Titel desselben Albums, die nicht mit
    ausgewählt wurden, bleiben unangetastet. Teilen sich mehrere
    ausgewählte Titel Interpret und Album, wird dafür nur eine Anfrage
    gestellt.
  - **Für alle Titel im Archiv auf einmal**: "Werkzeuge ▾" → "LC-Nummern
    für alle Titel online nachschlagen …" sucht für alle Titel ohne
    LC-Nummer (mit Interpret **und** Album). Bei vielen verschiedenen
    Alben kann es etwas dauern (max. 1 Anfrage pro Sekunde, aus Rücksicht
    auf den kostenlosen Dienst), läuft aber im Hintergrund mit
    Fortschrittsanzeige, ohne das Programm zu blockieren. Am Ende zeigt
    eine Übersicht, welche Alben gefunden wurden, welche nicht, und ob es
    Verbindungsprobleme gab. Auch über die Kommandozeile:
    `python -m musikarchiv lookup-lc`.

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

Musikrichtung setzen (funktioniert für einen oder mehrere Titel auf einmal):

```bash
python -m musikarchiv genre-set Pop "Sonnenschein" "Regentraenen"
python -m musikarchiv genre-set "" "Sonnenschein"   # entfernt die Musikrichtung wieder
```

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

### 7. Chart-Hits nachträglich markieren

```bash
python -m musikarchiv tag-charts
```

Vergibt die Stimmung "Charts" an bereits importierte Titel, deren
Album-Feld einen Chart-Hinweis enthält (Album bleibt unverändert).

### 8. Instrumental-Titel nachträglich markieren

```bash
python -m musikarchiv tag-instrumental
```

Vergibt die Stimmung "Instrumental" an bereits importierte Titel, deren
Titel, Album oder Genre einen Instrumental-Hinweis enthält.

### 9. LC-Nummern online nachschlagen (experimentell)

Nur für einen einzelnen Titel:

```bash
python -m musikarchiv lookup-lc-titel "Titelname"
```

Für alle Titel ohne LC-Nummer im ganzen Archiv:

```bash
python -m musikarchiv lookup-lc
```

Beide suchen bei MusicBrainz (musicbrainz.org) nach dem Labelcode und
tragen ihn ein. Braucht Internet, dauert bei vielen Alben etwas (max. 1
Anfrage/Sekunde). Bestehende LC-Nummern werden nie überschrieben; nur
sehr sichere Treffer werden übernommen. Siehe Hinweis zur GUI-Variante
weiter oben – das ist ein Bestmöglicher-Versuch, keine Garantie.

## Tests

```bash
pytest
```
