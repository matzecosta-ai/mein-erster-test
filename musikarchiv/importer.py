"""Gemeinsame Import-Logik fuer CLI und grafische Oberflaeche."""

from pathlib import Path

from . import moods, scanner


def import_directory(conn, directory, auto_suggest_by_genre=True):
    """Importiert alle Musikdateien aus 'directory'.

    Erkennt dabei automatisch, wenn im Album-Feld eigentlich eine Stimmung
    steht (z.B. "Spannung"), und ordnet sie stattdessen den Stimmungen zu.
    Optional werden zusaetzlich Stimmungs-Vorschlaege anhand des Genre-Tags
    vergeben.

    Gibt ein Dict mit Zaehlwerten zurueck: added, skipped, album_fixed,
    genre_suggested.
    """
    known_moods = moods.get_known_moods(conn)
    ergebnis = {"added": 0, "skipped": 0, "album_fixed": 0, "genre_suggested": 0}

    for filepath in scanner.find_audio_files(Path(directory)):
        filepath_str = str(filepath.resolve())
        exists = conn.execute(
            "SELECT 1 FROM songs WHERE filepath = ?", (filepath_str,)
        ).fetchone()
        if exists:
            ergebnis["skipped"] += 1
            continue

        tags = scanner.read_tags(filepath)
        album = tags["album"]
        stimmung_aus_album = None
        if album and moods.looks_like_mood(album, known_moods):
            stimmung_aus_album = album.strip()
            album = None

        cursor = conn.execute(
            "INSERT INTO songs (title, artist, album, genre, filepath, duration_sec) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (tags["title"], tags["artist"], album, tags["genre"], filepath_str, tags["duration_sec"]),
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

    return ergebnis
