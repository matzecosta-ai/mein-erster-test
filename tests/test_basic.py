import struct
import wave
from pathlib import Path

from musikarchiv.cli import main


def _make_song(path: Path, name: str) -> Path:
    """Erzeugt eine winzige, aber echte WAV-Datei (damit die
    Audio-Echtheitspruefung beim Import sie akzeptiert)."""
    f = path / name
    with wave.open(str(f), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(struct.pack("<10h", *([0] * 10)))
    return f


def test_import_search_und_organize(tmp_path, capsys):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    _make_song(musik_ordner, "Sonnenschein.wav")
    _make_song(musik_ordner, "Regentraenen.wav")

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

    assert (ziel / "Freude" / "Sonnenschein.wav").exists()
    assert (ziel / "Motivation" / "Sonnenschein.wav").exists()
    assert (ziel / "Drama" / "Regentraenen.wav").exists()


def test_import_ignoriert_ungueltige_audiodateien(tmp_path, capsys):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    _make_song(musik_ordner, "Echtes Lied.wav")
    (musik_ordner / "Fake.mp3").write_text("Das ist gar keine Musikdatei.")

    db_path = tmp_path / "test.db"
    main(["--db", str(db_path), "import", str(musik_ordner)])
    out = capsys.readouterr().out
    assert "1 Titel importiert" in out
    assert "1 Datei(en) übersprungen" in out

    main(["--db", str(db_path), "list"])
    out = capsys.readouterr().out
    assert "Echtes Lied" in out
    assert "Fake" not in out


def test_titelnummer_wird_beim_import_entfernt(tmp_path, capsys):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    _make_song(musik_ordner, "01 Sonnenschein.wav")
    _make_song(musik_ordner, "007 Agentenlied.wav")
    _make_song(musik_ordner, "50 Cent Style.wav")

    db_path = tmp_path / "test.db"
    main(["--db", str(db_path), "import", str(musik_ordner)])
    capsys.readouterr()

    main(["--db", str(db_path), "list"])
    out = capsys.readouterr().out
    titelzeilen = [z for z in out.splitlines() if z.startswith("[")]
    titel_text = "\n".join(titelzeilen)

    assert "Sonnenschein" in titel_text
    assert "01 Sonnenschein" not in titel_text
    assert "Agentenlied" in titel_text
    assert "007 Agentenlied" not in titel_text
    # Titel ohne Nullpolsterung/klares Trennzeichen bleiben unangetastet
    assert "50 Cent Style" in titel_text
