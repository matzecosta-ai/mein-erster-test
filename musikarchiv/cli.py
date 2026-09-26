import argparse
from pathlib import Path

from . import db, organizer, scanner

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


def cmd_import(args):
    with db.connect(args.db) as conn:
        added, skipped = 0, 0
        for filepath in scanner.find_audio_files(args.ordner):
            filepath_str = str(filepath.resolve())
            exists = conn.execute(
                "SELECT 1 FROM songs WHERE filepath = ?", (filepath_str,)
            ).fetchone()
            if exists:
                skipped += 1
                continue
            tags = scanner.read_tags(filepath)
            conn.execute(
                "INSERT INTO songs (title, artist, album, filepath, duration_sec) "
                "VALUES (?, ?, ?, ?, ?)",
                (tags["title"], tags["artist"], tags["album"], filepath_str, tags["duration_sec"]),
            )
            added += 1
        print(f"{added} Titel importiert, {skipped} bereits vorhanden.")


def _find_song(conn, identifier):
    if identifier.isdigit():
        row = conn.execute("SELECT * FROM songs WHERE id = ?", (int(identifier),)).fetchone()
        return [row] if row else []
    return conn.execute(
        "SELECT * FROM songs WHERE title LIKE ? ORDER BY title", (f"%{identifier}%",)
    ).fetchall()


def cmd_mood_add(args):
    with db.connect(args.db) as conn:
        matches = _find_song(conn, args.song)
        if not matches:
            print(f"Kein Titel gefunden für '{args.song}'.")
            return
        if len(matches) > 1:
            print("Mehrere Titel gefunden, bitte die ID verwenden:")
            for m in matches:
                print(f"  [{m['id']}] {m['title']} - {m['artist'] or '?'}")
            return
        song = matches[0]
        for mood_name in args.stimmungen:
            conn.execute("INSERT OR IGNORE INTO moods (name) VALUES (?)", (mood_name,))
            mood = conn.execute("SELECT id FROM moods WHERE name = ?", (mood_name,)).fetchone()
            conn.execute(
                "INSERT OR IGNORE INTO song_moods (song_id, mood_id) VALUES (?, ?)",
                (song["id"], mood["id"]),
            )
        print(f"Stimmungen [{', '.join(args.stimmungen)}] zu '{song['title']}' hinzugefügt.")


def cmd_mood_remove(args):
    with db.connect(args.db) as conn:
        matches = _find_song(conn, args.song)
        if len(matches) != 1:
            print("Titel nicht eindeutig gefunden, bitte die ID verwenden.")
            return
        song = matches[0]
        conn.execute(
            """DELETE FROM song_moods WHERE song_id = ? AND mood_id = (
                   SELECT id FROM moods WHERE name = ?
               )""",
            (song["id"], args.stimmung),
        )
        print(f"Stimmung '{args.stimmung}' von '{song['title']}' entfernt.")


def cmd_mood_list(args):
    with db.connect(args.db) as conn:
        rows = conn.execute(
            """SELECT m.name, COUNT(sm.song_id) as anzahl
               FROM moods m LEFT JOIN song_moods sm ON sm.mood_id = m.id
               GROUP BY m.id ORDER BY m.name"""
        ).fetchall()
        if not rows:
            print("Noch keine Stimmungen vergeben.")
            print("Vorschläge:", ", ".join(SUGGESTED_MOODS))
            return
        for r in rows:
            print(f"{r['name']}: {r['anzahl']} Titel")


def _print_songs(conn, rows):
    if not rows:
        print("Keine Titel gefunden.")
        return
    for song in rows:
        moods = organizer._mood_names(conn, song["id"])
        mood_str = ", ".join(moods) or "-"
        print(f"[{song['id']}] {song['title']} - {song['artist'] or '?'} | Stimmungen: {mood_str}")
        print(f"      Datei: {song['filepath']}")


def cmd_search_title(args):
    with db.connect(args.db) as conn:
        rows = conn.execute(
            "SELECT * FROM songs WHERE title LIKE ? ORDER BY title", (f"%{args.suchtext}%",)
        ).fetchall()
        _print_songs(conn, rows)


def cmd_search_mood(args):
    with db.connect(args.db) as conn:
        rows = conn.execute(
            """SELECT s.* FROM songs s
               JOIN song_moods sm ON sm.song_id = s.id
               JOIN moods m ON m.id = sm.mood_id
               WHERE m.name LIKE ? ORDER BY s.title""",
            (f"%{args.stimmung}%",),
        ).fetchall()
        _print_songs(conn, rows)


def cmd_list(args):
    with db.connect(args.db) as conn:
        rows = conn.execute("SELECT * FROM songs ORDER BY title").fetchall()
        _print_songs(conn, rows)


def cmd_organize(args):
    with db.connect(args.db) as conn:
        results = organizer.organize(conn, args.zielordner, by=args.by, action=args.aktion)
        ok = sum(1 for _, _, status in results if status == "ok")
        fehler = [r for r in results if r[2] != "ok"]
        print(
            f"{ok} Datei(en) einsortiert nach '{args.zielordner}' "
            f"(Modus: {args.by}, Aktion: {args.aktion})."
        )
        for song, _, status in fehler:
            print(f"  Fehler bei '{song['title']}': {status}")


def build_parser():
    parser = argparse.ArgumentParser(
        prog="musikarchiv",
        description="Archivierung, Suche und Sortierung der eigenen Musiksammlung",
    )
    parser.add_argument(
        "--db", default=str(db.DEFAULT_DB_PATH), help="Pfad zur Datenbankdatei"
    )
    sub = parser.add_subparsers(dest="befehl", required=True)

    p = sub.add_parser("import", help="Ordner nach Musikdateien durchsuchen und importieren")
    p.add_argument("ordner", type=Path)
    p.set_defaults(func=cmd_import)

    p = sub.add_parser("mood-add", help="Stimmung(en) einem Titel zuweisen")
    p.add_argument("song", help="Titel-ID oder Teil des Titelnamens")
    p.add_argument(
        "stimmungen", nargs="+", help=f"z.B. {', '.join(SUGGESTED_MOODS[:4])}, ... (frei wählbar)"
    )
    p.set_defaults(func=cmd_mood_add)

    p = sub.add_parser("mood-remove", help="Stimmung von einem Titel entfernen")
    p.add_argument("song", help="Titel-ID oder Teil des Titelnamens")
    p.add_argument("stimmung")
    p.set_defaults(func=cmd_mood_remove)

    p = sub.add_parser("mood-list", help="Alle vergebenen Stimmungen anzeigen")
    p.set_defaults(func=cmd_mood_list)

    p = sub.add_parser("search-title", help="Nach Titel suchen")
    p.add_argument("suchtext")
    p.set_defaults(func=cmd_search_title)

    p = sub.add_parser("search-mood", help="Nach Stimmung suchen")
    p.add_argument("stimmung")
    p.set_defaults(func=cmd_search_mood)

    p = sub.add_parser("list", help="Alle Titel auflisten")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("organize", help="Musikdateien auf der Festplatte sortieren")
    p.add_argument("zielordner", type=Path)
    p.add_argument("--by", choices=["mood", "artist", "mood-artist"], default="mood")
    p.add_argument("--aktion", choices=["copy", "move", "link"], default="copy")
    p.set_defaults(func=cmd_organize)

    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
