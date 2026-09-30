import json
import urllib.error

import pytest

from musikarchiv import db, lc_lookup


class _FakeResponse:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


@pytest.fixture(autouse=True)
def _keine_wartezeit(monkeypatch):
    # Tests sollen nicht wirklich 1s/Anfrage warten muessen.
    monkeypatch.setattr(lc_lookup.time, "sleep", lambda _s: None)
    monkeypatch.setattr(lc_lookup, "_letzte_anfrage", 0.0)


def test_lc_nummer_nachschlagen_erfolgreich(monkeypatch):
    antworten = [
        {"releases": [{"id": "abc-123", "score": "100"}]},
        {"label-info": [{"label": {"label-code": 6861}}]},
    ]

    def fake_urlopen(request, timeout=10):
        return _FakeResponse(antworten.pop(0))

    monkeypatch.setattr(lc_lookup.urllib.request, "urlopen", fake_urlopen)

    ergebnis = lc_lookup.lc_nummer_nachschlagen("Bruno Mars", "24K Magic")
    assert ergebnis == "LC-06861"


def test_lc_nummer_nachschlagen_kein_treffer(monkeypatch):
    monkeypatch.setattr(
        lc_lookup.urllib.request, "urlopen", lambda *a, **k: _FakeResponse({"releases": []})
    )
    assert lc_lookup.lc_nummer_nachschlagen("Unbekannt", "Nichts") is None


def test_lc_nummer_nachschlagen_score_zu_niedrig(monkeypatch):
    monkeypatch.setattr(
        lc_lookup.urllib.request,
        "urlopen",
        lambda *a, **k: _FakeResponse({"releases": [{"id": "x", "score": "40"}]}),
    )
    assert lc_lookup.lc_nummer_nachschlagen("Band", "Album") is None


def test_lc_nummer_nachschlagen_release_ohne_label_code(monkeypatch):
    antworten = [
        {"releases": [{"id": "abc-123", "score": "100"}]},
        {"label-info": [{"label": {"name": "Ein Label ohne Code"}}]},
    ]
    monkeypatch.setattr(
        lc_lookup.urllib.request, "urlopen", lambda *a, **k: _FakeResponse(antworten.pop(0))
    )
    assert lc_lookup.lc_nummer_nachschlagen("Band", "Album") is None


def test_lc_nummer_nachschlagen_ohne_artist_oder_album_fragt_nicht_an(monkeypatch):
    def darf_nicht_aufgerufen_werden(*a, **k):
        raise AssertionError("Es haette keine Anfrage gestellt werden duerfen")

    monkeypatch.setattr(lc_lookup.urllib.request, "urlopen", darf_nicht_aufgerufen_werden)

    assert lc_lookup.lc_nummer_nachschlagen(None, "Album") is None
    assert lc_lookup.lc_nummer_nachschlagen("Band", "") is None


def test_netzwerkfehler_wirft_lookupfehler(monkeypatch):
    def fake_urlopen(*a, **k):
        raise urllib.error.URLError("Keine Verbindung")

    monkeypatch.setattr(lc_lookup.urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(lc_lookup.LookupFehler):
        lc_lookup.lc_nummer_nachschlagen("Band", "Album")


def test_fehlende_lc_nummern_nachschlagen_batch(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel 1", "Bruno Mars", "24K Magic", str(tmp_path / "1.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel 2", "Bruno Mars", "24K Magic", str(tmp_path / "2.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel 3", "Unbekannte Band", "Nirgendwo Gefunden", str(tmp_path / "3.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, lc_nummer, filepath) VALUES (?,?,?,?,?)",
            ("Titel 4", "Schon Markiert", "Album", "LC-99999", str(tmp_path / "4.mp3")),
        )

    antworten_pro_album = {
        "24K Magic": [
            {"releases": [{"id": "abc", "score": "100"}]},
            {"label-info": [{"label": {"label-code": 6861}}]},
        ],
        "Nirgendwo Gefunden": [{"releases": []}],
    }

    def fake_urlopen(request, timeout=10):
        url = request.full_url
        for album, antworten in antworten_pro_album.items():
            if lc_lookup.urllib.parse.quote(album) in url or "release/abc" in url:
                return _FakeResponse(antworten.pop(0))
        raise AssertionError(f"Unerwartete URL: {url}")

    monkeypatch.setattr(lc_lookup.urllib.request, "urlopen", fake_urlopen)

    fortschritt = []
    with db.connect(db_path) as conn:
        ergebnis = lc_lookup.fehlende_lc_nummern_nachschlagen(
            conn, on_progress=lambda i, g, txt: fortschritt.append((i, g, txt))
        )

        assert len(ergebnis["gefunden"]) == 1
        anzahl, artist, album, lc = ergebnis["gefunden"][0]
        assert (anzahl, artist, album, lc) == (2, "Bruno Mars", "24K Magic", "LC-06861")

        assert ergebnis["nicht_gefunden"] == [("Unbekannte Band", "Nirgendwo Gefunden")]
        assert ergebnis["fehler"] == []

        # Bereits markierter Titel wurde nicht angefasst, die beiden neuen schon
        song1 = conn.execute("SELECT lc_nummer FROM songs WHERE title='Titel 1'").fetchone()
        song4 = conn.execute("SELECT lc_nummer FROM songs WHERE title='Titel 4'").fetchone()
        assert song1["lc_nummer"] == "LC-06861"
        assert song4["lc_nummer"] == "LC-99999"

    assert len(fortschritt) == 2  # zwei verschiedene (Interpret, Album)-Paare geprueft


def test_drosselung_wartet_mindestens_eine_sekunde(monkeypatch):
    wartezeiten = []
    monkeypatch.setattr(lc_lookup.time, "sleep", lambda s: wartezeiten.append(s))
    monkeypatch.setattr(lc_lookup, "_letzte_anfrage", lc_lookup.time.time())
    monkeypatch.setattr(
        lc_lookup.urllib.request, "urlopen", lambda *a, **k: _FakeResponse({"releases": []})
    )

    lc_lookup.lc_nummer_nachschlagen("Band", "Album")
    assert wartezeiten and wartezeiten[0] > 1.0
