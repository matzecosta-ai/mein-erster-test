import argparse
from pathlib import Path

from . import db, importer, lc_lookup, moods, organizer

SUGGESTED_MOODS = moods.SUGGESTED_MOODS


def cmd_import(args):
    def fortschritt(index, gesamt, dateiname):
        if gesamt and (index == gesamt or index % 500 == 0):
            print(f"  ... {index}/{gesamt} Dateien verarbeitet")

    with db.connect(args.db) as conn:
        ergebnis = importer.import_directory(
            conn,
            args.ordner,
            auto_suggest_by_genre=not args.kein_genre_vorschlag,
            on_progress=fortschritt,
        )
        print(f"{ergebnis['added']} Titel importiert, {ergebnis['skipped']} bereits vorhanden.")
        if ergebnis["ignoriert"]:
            print(
                f"  {ergebnis['ignoriert']} Datei(en) übersprungen - "
                "keine gültige Audiodatei (falsche Endung, beschädigt o.ä.)."
            )
        if ergebnis["album_fixed"]:
            print(
                f"  {ergebnis['album_fixed']} davon hatten eine Stimmung im Album-Feld "
                "- automatisch korrigiert."
            )
        if ergebnis["genre_suggested"]:
            print(
                f"  {ergebnis['genre_suggested']} davon bekamen anhand des Genre-Tags "
                "einen Stimmungs-Vorschlag."
            )
        if ergebnis["chart_hits"]:
            print(
                f"  {ergebnis['chart_hits']} davon als Chart-Hit erkannt "
                "(Stimmung 'Charts' vergeben)."
            )
        if ergebnis["instrumental"]:
            print(
                f"  {ergebnis['instrumental']} davon als Instrumental erkannt "
                "(Stimmung 'Instrumental' vergeben)."
            )


def cmd_fix_album_moods(args):
    with db.connect(args.db) as conn:
        aenderungen = moods.fix_existing_album_moods(conn)
        if not aenderungen:
            print("Keine betroffenen Titel gefunden.")
            return
        print(f"{len(aenderungen)} Titel korrigiert:")
        for _, titel, stimmung in aenderungen:
            print(f"  '{titel}': Album -> Stimmung '{stimmung}'")


def cmd_tag_charts(args):
    with db.connect(args.db) as conn:
        betroffen = moods.tag_existing_chart_hits(conn)
        if not betroffen:
            print("Keine Chart-Hits gefunden (oder bereits markiert).")
            return
        print(f"{len(betroffen)} Titel als Chart-Hit markiert:")
        for _, titel in betroffen:
            print(f"  '{titel}'")


def cmd_tag_instrumental(args):
    with db.connect(args.db) as conn:
        betroffen = moods.tag_existing_instrumentals(conn)
        if not betroffen:
            print("Keine Instrumental-Titel gefunden (oder bereits markiert).")
            return
        print(f"{len(betroffen)} Titel als Instrumental markiert:")
        for _, titel in betroffen:
            print(f"  '{titel}'")


def cmd_lookup_lc(args):
    if args.id is not None:
        with db.connect(args.db) as conn:
            try:
                status, lc = lc_lookup.lc_nummer_fuer_titel_nachschlagen(conn, args.id)
            except lc_lookup.LookupFehler as exc:
                print(f"Verbindungsfehler: {exc}")
                return
        texte = {
            "gesetzt": f"LC-Nummer eingetragen: {lc}",
            "schon_vorhanden": f"Titel hat bereits eine LC-Nummer: {lc}",
            "nicht_gefunden": "Kein sicherer Treffer bei MusicBrainz.",
            "unvollstaendig": "Interpret oder Album fehlt - Suche nicht möglich.",
            "unbekannt": f"Kein Titel mit ID {args.id} gefunden.",
        }
        print(texte[status])
        return

    print(
        "Suche LC-Nummern online bei MusicBrainz (musicbrainz.org) - "
        "experimentell, ca. 1 Anfrage/Sekunde, kann bei vielen Alben dauern.\n"
        "Bestehende LC-Nummern werden nie überschrieben."
    )

    def fortschritt(index, gesamt, bezeichnung):
        print(f"  ... ({index}/{gesamt}) {bezeichnung}")

    with db.connect(args.db) as conn:
        try:
            ergebnis = lc_lookup.fehlende_lc_nummern_nachschlagen(conn, on_progress=fortschritt)
        except Exception as exc:
            print(f"Abgebrochen wegen eines unerwarteten Fehlers: {exc}")
            return

    print()
    if ergebnis["gefunden"]:
        print(f"{len(ergebnis['gefunden'])} Album(en) gefunden:")
        for anzahl, artist, album, lc in ergebnis["gefunden"]:
            print(f"  '{album}' von {artist}: {lc} ({anzahl} Titel aktualisiert)")
    else:
        print("Keine LC-Nummern gefunden.")
    if ergebnis["nicht_gefunden"]:
        print(f"{len(ergebnis['nicht_gefunden'])} Album(en) ohne Treffer:")
        for artist, album in ergebnis["nicht_gefunden"]:
            print(f"  '{album}' von {artist}")
    if ergebnis["fehler"]:
        print(f"{len(ergebnis['fehler'])} Album(en) mit Verbindungsfehler:")
        for artist, album, fehler in ergebnis["fehler"]:
            print(f"  '{album}' von {artist}: {fehler}")


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


def cmd_delete(args):
    with db.connect(args.db) as conn:
        geloescht = []
        for identifier in args.songs:
            matches = _find_song(conn, identifier)
            if not matches:
                print(f"Kein Titel gefunden für '{identifier}'.")
                continue
            if len(matches) > 1:
                print(f"'{identifier}' ist mehrdeutig, bitte die ID verwenden:")
                for m in matches:
                    print(f"  [{m['id']}] {m['title']} - {m['artist'] or '?'}")
                continue
            song = matches[0]
            conn.execute("DELETE FROM songs WHERE id = ?", (song["id"],))
            geloescht.append(song["title"])
        if geloescht:
            print(f"{len(geloescht)} Titel gelöscht: {', '.join(geloescht)}")
        else:
            print("Keine Titel gelöscht.")


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
        song_moods = organizer._mood_names(conn, song["id"])
        mood_str = ", ".join(song_moods) or "-"
        jahr = f" ({song['year']})" if song["year"] else ""
        lc = f" [{song['lc_nummer']}]" if song["lc_nummer"] else ""
        print(
            f"[{song['id']}] {song['title']}{jahr}{lc} - {song['artist'] or '?'} | "
            f"Stimmungen: {mood_str}"
        )
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
    p.add_argument(
        "--kein-genre-vorschlag",
        action="store_true",
        help="Keine automatischen Stimmungs-Vorschlaege anhand des Genre-Tags",
    )
    p.set_defaults(func=cmd_import)

    p = sub.add_parser(
        "fix-album-moods",
        help="Bereits importierte Titel korrigieren, bei denen eine Stimmung im Album-Feld steht",
    )
    p.set_defaults(func=cmd_fix_album_moods)

    p = sub.add_parser(
        "tag-charts",
        help="Bereits importierte Titel mit Chart-Hinweis im Album-Feld als 'Charts' markieren",
    )
    p.set_defaults(func=cmd_tag_charts)

    p = sub.add_parser(
        "tag-instrumental",
        help="Bereits importierte Titel mit Instrumental-Hinweis als 'Instrumental' markieren",
    )
    p.set_defaults(func=cmd_tag_instrumental)

    p = sub.add_parser(
        "lookup-lc",
        help=(
            "Fehlende LC-Nummern online bei MusicBrainz nachschlagen "
            "(experimentell, braucht Internetverbindung)"
        ),
    )
    p.add_argument(
        "--id",
        type=int,
        default=None,
        help="Nur diesen einen Titel (ID wie in der Suche angezeigt) nachschlagen statt des ganzen Archivs",
    )
    p.set_defaults(func=cmd_lookup_lc)

    p = sub.add_parser(
        "delete",
        help="Titel aus dem Archiv löschen (nur Datenbank-Eintrag, Datei bleibt erhalten)",
    )
    p.add_argument("songs", nargs="+", help="Titel-ID(s) oder Teil des Titelnamens")
    p.set_defaults(func=cmd_delete)

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
