"""Alles rund um Stimmungen: Vorschlagslisten, Genre-Heuristik und die
Erkennung von Stimmungswoertern, die versehentlich im Album-Feld stehen."""

SUGGESTED_MOODS = [
    "Freude",
    "Spannung",
    "Liebeslieder",
    "Drama",
    "Trauer",
    "Wut",
    "Entspannung",
    "Party",
    "Nostalgie",
    "Motivation",
    "Melancholie",
    "Romantik",
    "Hoffnung",
    "Wehmut",
]

# Grobe Heuristik: Genre-Schlagwort (kleingeschrieben) -> passende Stimmung(en).
# Kein Ersatz fuer echtes Zuhoeren, aber ein brauchbarer erster Vorschlag.
GENRE_MOOD_MAP = {
    "party": ["Party"],
    "dance": ["Party"],
    "disco": ["Party", "Freude"],
    "electronic": ["Party", "Spannung"],
    "edm": ["Party", "Spannung"],
    "house": ["Party"],
    "techno": ["Spannung"],
    "pop": ["Freude"],
    "rock": ["Spannung", "Motivation"],
    "hard rock": ["Motivation", "Wut"],
    "metal": ["Wut", "Spannung"],
    "punk": ["Wut"],
    "ballad": ["Liebeslieder", "Romantik"],
    "ballade": ["Liebeslieder", "Romantik"],
    "love": ["Liebeslieder", "Romantik"],
    "romance": ["Romantik"],
    "sad": ["Trauer", "Melancholie"],
    "blues": ["Melancholie", "Trauer"],
    "classical": ["Entspannung"],
    "klassik": ["Entspannung"],
    "ambient": ["Entspannung"],
    "chill": ["Entspannung"],
    "lounge": ["Entspannung"],
    "jazz": ["Entspannung", "Romantik"],
    "hip hop": ["Motivation", "Party"],
    "hip-hop": ["Motivation", "Party"],
    "rap": ["Motivation"],
    "soundtrack": ["Drama", "Spannung"],
    "score": ["Drama", "Spannung"],
    "children": ["Freude"],
    "kinder": ["Freude"],
    "christmas": ["Freude", "Nostalgie"],
    "weihnachten": ["Freude", "Nostalgie"],
    "folk": ["Nostalgie"],
    "volksmusik": ["Nostalgie"],
    "reggae": ["Entspannung", "Freude"],
    "gospel": ["Hoffnung"],
}


def suggest_moods_for_genre(genre_text):
    """Liefert Stimmungs-Vorschlaege basierend auf einem Genre-Tag."""
    if not genre_text:
        return []
    tokens = [t.strip().lower() for t in genre_text.replace("/", ",").replace(";", ",").split(",")]
    tokens = [t for t in tokens if t]

    vorschlaege = []
    for token in tokens:
        for keyword, moods in GENRE_MOOD_MAP.items():
            if keyword in token:
                for mood in moods:
                    if mood not in vorschlaege:
                        vorschlaege.append(mood)
    return vorschlaege


def get_known_moods(conn):
    """Alle bereits bekannten Stimmungen: Vorschlagsliste + selbst angelegte."""
    rows = conn.execute("SELECT name FROM moods").fetchall()
    return set(SUGGESTED_MOODS) | {r["name"] for r in rows}


def ensure_mood(conn, name):
    conn.execute("INSERT OR IGNORE INTO moods (name) VALUES (?)", (name,))
    return conn.execute("SELECT id FROM moods WHERE name = ?", (name,)).fetchone()["id"]


def assign_mood(conn, song_id, mood_name):
    mood_id = ensure_mood(conn, mood_name)
    conn.execute(
        "INSERT OR IGNORE INTO song_moods (song_id, mood_id) VALUES (?, ?)",
        (song_id, mood_id),
    )


def looks_like_mood(text, known_moods):
    """Erkennt, ob ein Text (typischerweise aus dem Album-Feld) eher eine
    Stimmung als ein echter Albumtitel ist: kurz (max. 3 Woerter) und
    enthaelt ein bekanntes Stimmungswort - z.B. "Spannung" oder
    "leichte Spannung"."""
    if not text:
        return False
    text = text.strip()
    if not text:
        return False
    words = text.split()
    if len(words) > 3:
        return False
    known_lower = {m.lower() for m in known_moods}
    if text.lower() in known_lower:
        return True
    return any(w.lower() in known_lower for w in words)


def fix_existing_album_moods(conn):
    """Korrigiert bereits importierte Titel, bei denen eine Stimmung
    faelschlich im Album-Feld gelandet ist: verschiebt den Text zu den
    Stimmungen und leert das Album-Feld. Gibt die Liste der Aenderungen
    zurueck [(song_id, titel, erkannte_stimmung), ...]."""
    known_moods = get_known_moods(conn)
    rows = conn.execute(
        "SELECT id, title, album FROM songs WHERE album IS NOT NULL AND album != ''"
    ).fetchall()

    aenderungen = []
    for row in rows:
        if looks_like_mood(row["album"], known_moods):
            mood_name = row["album"].strip()
            assign_mood(conn, row["id"], mood_name)
            conn.execute("UPDATE songs SET album = NULL WHERE id = ?", (row["id"],))
            known_moods.add(mood_name)
            aenderungen.append((row["id"], row["title"], mood_name))

    return aenderungen
