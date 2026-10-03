"""Gemeinsame Import-Logik fuer CLI und grafische Oberflaeche."""

from pathlib import Path

from . import moods, scanner


def import_directory(conn, directory, auto_suggest_by_genre=True, on_progress=None):
    """Importiert alle Musikdateien aus 'directory'.

    Dateien mit passender Endung, die sich nicht als echte Audiodatei lesen
    lassen (z.B. falsch benannte oder beschaedigte Dateien), werden
    uebersprungen und nicht importiert.

    Erkennt dabei automatisch, wenn im Album-Feld eigentlich eine Stimmung
    steht (z.B. "Spannung"), und ordnet sie stattdessen den Stimmungen zu.
    Optional werden zusaetzlich Stimmungs-Vorschlaege anhand des Genre-Tags
    vergeben.

    'on_progress', falls angegeben, wird nach jeder Datei aufgerufen als
    on_progress(bearbeitet, gesamt, dateiname) - fuer Fortschrittsanzeigen
    bei sehr grossen Musiksammlungen.

    Erkennt ausserdem Chart-Hinweise im Album-Feld (z.B. "... Charts",
    "Chart-Hit") und vergibt dafuer zusaetzlich die Stimmung "Charts", sowie
    Instrumental-Hinweise in Titel/Album/Genre fuer die Stimmung
    "Instrumental".

    Gibt ein Dict mit Zaehlwerten zurueck: added, skipped, ignoriert
    (keine echte Audiodatei), album_fixed, genre_suggested, chart_hits,
    instrumental.
    """
    known_moods = moods.get_known_moods(conn)
    ergebnis = {
        "added": 0,
        "skipped": 0,
        "ignoriert": 0,
        "album_fixed": 0,
        "genre_suggested": 0,
        "chart_hits": 0,
        "instrumental": 0,
    }

    dateien = list(scanner.find_audio_files(Path(directory)))
    gesamt = len(dateien)

    for index, filepath in enumerate(dateien, start=1):
        if on_progress is not None:
            on_progress(index, gesamt, filepath.name)

        filepath_str = str(filepath.resolve())
        exists = conn.execute(
            "SELECT 1 FROM songs WHERE filepath = ?", (filepath_str,)
        ).fetchone()
        if exists:
            ergebnis["skipped"] += 1
            continue

        if not scanner.is_valid_audio(filepath):
            ergebnis["ignoriert"] += 1
            continue

        tags = scanner.read_tags(filepath)
        album = tags["album"]
        ist_chart_hit = moods.looks_like_chart_hit(album)
        ist_sonderhinweis = ist_chart_hit or moods.looks_like_instrumental(album)
        stimmung_aus_album = None
        if album and not ist_sonderhinweis and moods.looks_like_mood(album, known_moods):
            # Nur pruefen, wenn es KEIN Chart-/Instrumental-Hinweis ist: sonst
            # wuerde ein echter (kurzer) Albumtitel wie "24K Magic Charts"
            # faelschlich komplett als Stimmung verschluckt statt nur den
            # Hinweis zusaetzlich zu vergeben.
            stimmung_aus_album = album.strip()
            album = None
        elif ist_chart_hit and moods.is_pure_chart_label(album):
            # Album-Feld enthaelt nur den Chart-Hinweis, keinen echten Titel.
            album = None

        cursor = conn.execute(
            "INSERT INTO songs (title, artist, album, genre, year, lc_nummer, filepath, duration_sec) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                tags["title"],
                tags["artist"],
                album,
                tags["genre"],
                tags["year"],
                tags["lc_nummer"],
                filepath_str,
                tags["duration_sec"],
            ),
        )
        song_id = cursor.lastrowid
        ergebnis["added"] += 1

        if stimmung_aus_album:
            moods.assign_mood(conn, song_id, stimmung_aus_album)
            known_moods.add(stimmung_aus_album)
            ergebnis["album_fixed"] += 1
        elif auto_suggest_by_genre and tags["genre"]:
            vorschlaege = moods.suggest_moods_for_genre(tags["genre"])
            for mood_name in vorschlaege:
                moods.assign_mood(conn, song_id, mood_name)
                known_moods.add(mood_name)
            if vorschlaege:
                ergebnis["genre_suggested"] += 1

        if moods.looks_like_chart_hit(tags["album"]):
            moods.assign_mood(conn, song_id, moods.CHART_MOOD_NAME)
            ergebnis["chart_hits"] += 1

        if moods.looks_like_instrumental(tags["title"], tags["album"], tags["genre"]):
            moods.assign_mood(conn, song_id, moods.INSTRUMENTAL_MOOD_NAME)
            ergebnis["instrumental"] += 1

    return ergebnis
