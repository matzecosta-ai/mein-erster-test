from pathlib import Path

from musikarchiv.cli import main


def _make_song(path: Path, name: str) -> Path:
    f = path / name
    f.write_bytes(b"")  # keine echten Audiodaten, read_tags faellt auf Dateinamen zurueck
    return f


def test_import_search_und_organize(tmp_path, capsys):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    _make_song(musik_ordner, "Sonnenschein.mp3")
    _make_song(musik_ordner, "Regentraenen.mp3")

    db_path = tmp_path / "test.db"

    main(["--db", str(db_path), "import", str(musik_ordner)])
    out = capsys.readouterr().out
    assert "2 Titel importiert" in out

    # erneuter Import ueberspringt bereits vorhandene Titel
    main(["--db", str(db_path), "import", str(musik_ordner)])
    out = capsys.readouterr().out
    assert "0 Titel importiert, 2 bereits vorhanden" in out

    main(["--db", str(db_path), "mood-add", "Sonnenschein", "Freude", "Motivation"])
    main(["--db", str(db_path), "mood-add", "Regentraenen", "Drama"])
    capsys.readouterr()

    main(["--db", str(db_path), "search-title", "Sonnen"])
    out = capsys.readouterr().out
    assert "Sonnenschein" in out
    assert "Freude, Motivation" in out

    main(["--db", str(db_path), "search-mood", "Drama"])
    out = capsys.readouterr().out
    assert "Regentraenen" in out
    assert "Sonnenschein" not in out

    ziel = tmp_path / "sortiert"
    main(["--db", str(db_path), "organize", str(ziel), "--by", "mood", "--aktion", "copy"])
    out = capsys.readouterr().out
    assert "3 Datei(en) einsortiert" in out  # 2 Stimmungen + 1 Stimmung

    assert (ziel / "Freude" / "Sonnenschein.mp3").exists()
    assert (ziel / "Motivation" / "Sonnenschein.mp3").exists()
    assert (ziel / "Drama" / "Regentraenen.mp3").exists()
