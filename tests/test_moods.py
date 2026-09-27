from pathlib import Path

from musikarchiv import db, importer, moods, organizer


def test_looks_like_mood_erkennt_kurze_stimmungstexte():
    known = set(moods.SUGGESTED_MOODS)
    assert moods.looks_like_mood("Spannung", known)
    assert moods.looks_like_mood("leichte Spannung", known)
    assert moods.looks_like_mood("SPANNUNG", known)  # Gross-/Kleinschreibung egal
    assert not moods.looks_like_mood("Greatest Hits", known)
    assert not moods.looks_like_mood("Ein ganz langer Titel mit vier Woertern", known)
    assert not moods.looks_like_mood("", known)
    assert not moods.looks_like_mood(None, known)


def test_suggest_moods_for_genre():
    assert moods.suggest_moods_for_genre("Metal") == ["Wut", "Spannung"]
    assert moods.suggest_moods_for_genre("Hard Rock") == ["Spannung", "Motivation", "Wut"]
    assert moods.suggest_moods_for_genre("Voellig unbekanntes Genre") == []
    assert moods.suggest_moods_for_genre(None) == []
    assert moods.suggest_moods_for_genre("Rock/Ballade") == ["Spannung", "Motivation", "Liebeslieder", "Romantik"]


def test_fix_existing_album_moods_verschiebt_stimmung_aus_album(tmp_path):
    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel A", "Band", "Spannung", str(tmp_path / "a.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel B", "Band", "leichte Spannung", str(tmp_path / "b.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel C", "Band", "Greatest Hits", str(tmp_path / "c.mp3")),
        )

    with db.connect(db_path) as conn:
        aenderungen = moods.fix_existing_album_moods(conn)
        assert len(aenderungen) == 2

        row_a = conn.execute("SELECT * FROM songs WHERE title='Titel A'").fetchone()
        assert row_a["album"] is None
        assert organizer._mood_names(conn, row_a["id"]) == ["Spannung"]

        row_b = conn.execute("SELECT * FROM songs WHERE title='Titel B'").fetchone()
        assert row_b["album"] is None
        assert organizer._mood_names(conn, row_b["id"]) == ["leichte Spannung"]

        # Echter Albumtitel bleibt unangetastet
        row_c = conn.execute("SELECT * FROM songs WHERE title='Titel C'").fetchone()
        assert row_c["album"] == "Greatest Hits"
        assert organizer._mood_names(conn, row_c["id"]) == []


def test_import_directory_erkennt_stimmung_im_album_feld(tmp_path, monkeypatch):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    datei_spannung = musik_ordner / "song1.mp3"
    datei_normal = musik_ordner / "song2.mp3"
    datei_spannung.write_bytes(b"")
    datei_normal.write_bytes(b"")

    fake_tags = {
        str(datei_spannung.resolve()): {
            "title": "Song 1",
            "artist": "Band",
            "album": "Spannung",
            "genre": None,
            "year": None,
            "lc_nummer": None,
            "duration_sec": None,
        },
        str(datei_normal.resolve()): {
            "title": "Song 2",
            "artist": "Band",
            "album": "Echtes Album",
            "genre": "Metal",
            "year": 2005,
            "lc_nummer": "LC-06861",
            "duration_sec": None,
        },
    }

    def fake_read_tags(filepath: Path):
        return fake_tags[str(filepath.resolve())]

    monkeypatch.setattr(importer.scanner, "read_tags", fake_read_tags)
    # Dateien sind hier nur Platzhalter (leer) - die Echtheitspruefung ist
    # nicht Gegenstand dieses Tests und wird deshalb uebersprungen.
    monkeypatch.setattr(importer.scanner, "is_valid_audio", lambda filepath: True)

    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        ergebnis = importer.import_directory(conn, musik_ordner)
        assert ergebnis["added"] == 2
        assert ergebnis["album_fixed"] == 1
        assert ergebnis["genre_suggested"] == 1

        song1 = conn.execute("SELECT * FROM songs WHERE title='Song 1'").fetchone()
        assert song1["album"] is None
        assert organizer._mood_names(conn, song1["id"]) == ["Spannung"]

        song2 = conn.execute("SELECT * FROM songs WHERE title='Song 2'").fetchone()
        assert song2["album"] == "Echtes Album"
        assert song2["year"] == 2005
        assert song2["lc_nummer"] == "LC-06861"
        assert set(organizer._mood_names(conn, song2["id"])) == {"Wut", "Spannung"}


def test_import_directory_ignoriert_ungueltige_audiodateien(tmp_path, monkeypatch):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    echte_datei = musik_ordner / "echt.mp3"
    kaputte_datei = musik_ordner / "kaputt.mp3"
    echte_datei.write_bytes(b"")
    kaputte_datei.write_bytes(b"")

    def fake_read_tags(filepath: Path):
        return {
            "title": filepath.stem,
            "artist": None,
            "album": None,
            "genre": None,
            "year": None,
            "lc_nummer": None,
            "duration_sec": None,
        }

    def fake_is_valid_audio(filepath: Path):
        return filepath.name == "echt.mp3"

    monkeypatch.setattr(importer.scanner, "read_tags", fake_read_tags)
    monkeypatch.setattr(importer.scanner, "is_valid_audio", fake_is_valid_audio)

    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        ergebnis = importer.import_directory(conn, musik_ordner)
        assert ergebnis["added"] == 1
        assert ergebnis["ignoriert"] == 1
        titel = [r["title"] for r in conn.execute("SELECT title FROM songs").fetchall()]
        assert titel == ["echt"]


def test_datenbank_migration_ergaenzt_genre_spalte(tmp_path):
    db_path = tmp_path / "alt.db"
    # Alte Datenbank ohne 'genre'-Spalte simulieren
    import sqlite3

    conn = sqlite3.connect(db_path)
    conn.execute(
        """CREATE TABLE songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT,
            album TEXT,
            filepath TEXT UNIQUE NOT NULL,
            duration_sec INTEGER,
            added_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"""
    )
    conn.execute(
        "INSERT INTO songs (title, filepath) VALUES ('Alter Titel', '/pfad/alt.mp3')"
    )
    conn.commit()
    conn.close()

    with db.connect(db_path) as new_conn:
        columns = {r["name"] for r in new_conn.execute("PRAGMA table_info(songs)").fetchall()}
        assert "genre" in columns
        assert "year" in columns
        assert "lc_nummer" in columns
        row = new_conn.execute("SELECT * FROM songs WHERE title='Alter Titel'").fetchone()
        assert row["genre"] is None
        assert row["year"] is None
        assert row["lc_nummer"] is None
