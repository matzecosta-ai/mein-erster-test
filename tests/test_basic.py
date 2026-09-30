import json
import struct
import wave
from pathlib import Path

from musikarchiv import db, lc_lookup
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


def test_delete_entfernt_titel_aber_nicht_die_datei(tmp_path, capsys):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    datei = _make_song(musik_ordner, "Sonnenschein.wav")

    db_path = tmp_path / "test.db"
    main(["--db", str(db_path), "import", str(musik_ordner)])
    capsys.readouterr()

    main(["--db", str(db_path), "delete", "Sonnenschein"])
    out = capsys.readouterr().out
    assert "1 Titel gelöscht" in out
    assert datei.exists()  # die Musikdatei selbst bleibt unangetastet

    main(["--db", str(db_path), "list"])
    out = capsys.readouterr().out
    assert "Keine Titel gefunden" in out


def test_lookup_lc_titel_durchsucht_nur_den_einen_titel(tmp_path, capsys, monkeypatch):
    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("24K Magic", "Bruno Mars", "24K Magic", str(tmp_path / "1.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("That's What I Like", "Bruno Mars", "24K Magic", str(tmp_path / "2.mp3")),
        )

    antworten = [
        {"releases": [{"id": "abc", "score": "100"}]},
        {"label-info": [{"label": {"label-code": 6861}}]},
    ]

    class _FakeResponse:
        def __init__(self, payload):
            self._payload = json.dumps(payload).encode("utf-8")

        def read(self):
            return self._payload

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(
        lc_lookup.urllib.request, "urlopen", lambda *a, **k: _FakeResponse(antworten.pop(0))
    )
    monkeypatch.setattr(lc_lookup.time, "sleep", lambda _s: None)

    main(["--db", str(db_path), "lookup-lc-titel", "24K Magic"])
    out = capsys.readouterr().out
    assert "LC-06861" in out

    with db.connect(db_path) as conn:
        rows = {r["title"]: r["lc_nummer"] for r in conn.execute("SELECT title, lc_nummer FROM songs")}
    assert rows["24K Magic"] == "LC-06861"
    assert rows["That's What I Like"] in (None, "")  # nur der eine Titel wurde durchsucht


def test_delete_mehrere_titel_auf_einmal(tmp_path, capsys):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    _make_song(musik_ordner, "Sonnenschein.wav")
    _make_song(musik_ordner, "Regentraenen.wav")

    db_path = tmp_path / "test.db"
    main(["--db", str(db_path), "import", str(musik_ordner)])
    capsys.readouterr()

    main(["--db", str(db_path), "delete", "Sonnenschein", "Regentraenen"])
    out = capsys.readouterr().out
    assert "2 Titel gelöscht" in out

    main(["--db", str(db_path), "list"])
    out = capsys.readouterr().out
    assert "Keine Titel gefunden" in out
