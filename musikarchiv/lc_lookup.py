"""Experimentelle Online-Suche nach LC-Nummern (Labelcodes) ueber die freie
MusicBrainz-Datenbank (https://musicbrainz.org).

WICHTIG: Das ist ein Bestmoeglicher-Versuch, keine Garantie. MusicBrainz ist
eine von Freiwilligen gepflegte Datenbank - nicht jedes Album ist erfasst,
und die automatische Zuordnung von Interpret+Album zu einer MusicBrainz-
Veroeffentlichung kann in Einzelfaellen daneben liegen (mehrere Pressungen,
Wiederveroeffentlichungen auf anderen Labels, o.ae.). Es werden deshalb nur
Treffer mit hoher Uebereinstimmung (Score) akzeptiert, und bestehende
LC-Nummern werden nie ueberschrieben.

Verwendet nur die Python-Standardbibliothek (kein zusaetzliches pip-Paket
noetig) und haelt sich an MusicBrainz' Fair-Use-Regel von maximal einer
Anfrage pro Sekunde.
"""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "Musikarchiv-Privatnutzung/1.0 ( kein-kontakt-hinterlegt )"
BASE_URL = "https://musicbrainz.org/ws/2"
MIN_SCORE = 90  # nur sehr sichere Treffer automatisch uebernehmen
_MIN_ABSTAND_SEKUNDEN = 1.05  # MusicBrainz: max. 1 Anfrage/Sekunde

_letzte_anfrage = 0.0


class LookupFehler(Exception):
    """Netzwerk- oder Serverfehler bei der Online-Suche."""


def _drosseln():
    global _letzte_anfrage
    wartezeit = _MIN_ABSTAND_SEKUNDEN - (time.time() - _letzte_anfrage)
    if wartezeit > 0:
        time.sleep(wartezeit)
    _letzte_anfrage = time.time()


def _anfrage(pfad, timeout=10):
    _drosseln()
    url = f"{BASE_URL}{pfad}"
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as antwort:
            return json.loads(antwort.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise LookupFehler(str(exc)) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        raise LookupFehler(f"Unerwartete Antwort von MusicBrainz: {exc}") from exc


def _release_suchen(artist, album):
    """Sucht die am besten passende Veroeffentlichung. Gibt die
    MusicBrainz-ID zurueck oder None, wenn kein sicherer Treffer da ist."""
    query = f'artist:"{artist}" AND release:"{album}"'
    pfad = f"/release/?query={urllib.parse.quote(query)}&fmt=json&limit=5"
    daten = _anfrage(pfad)
    releases = daten.get("releases") or []
    if not releases:
        return None

    bester = max(releases, key=lambda r: _score_von(r))
    if _score_von(bester) < MIN_SCORE:
        return None
    return bester.get("id")


def _score_von(release):
    try:
        return int(release.get("score", 0))
    except (TypeError, ValueError):
        return 0


def _label_code_von_release(release_id):
    """Holt die Veroeffentlichung mit Label-Infos und liefert die erste
    gefundene LC-Nummer (normalisiert als "LC-XXXXX") oder None."""
    pfad = f"/release/{release_id}?inc=labels&fmt=json"
    daten = _anfrage(pfad)
    for eintrag in daten.get("label-info") or []:
        label = eintrag.get("label") or {}
        code = label.get("label-code")
        if code:
            try:
                return f"LC-{int(code):05d}"
            except (TypeError, ValueError):
                continue
    return None


def lc_nummer_nachschlagen(artist, album):
    """Sucht die LC-Nummer fuer (artist, album) online nach.

    Gibt bei Erfolg die LC-Nummer als String zurueck (z.B. "LC-06861"),
    sonst None. Wirft LookupFehler bei Netzwerk-/Serverproblemen - so
    laesst sich "nichts gefunden" von "Verbindung fehlgeschlagen"
    unterscheiden.
    """
    if not artist or not album:
        return None
    release_id = _release_suchen(artist, album)
    if not release_id:
        return None
    return _label_code_von_release(release_id)


def lc_nummer_fuer_song_nachschlagen(conn, song_id):
    """Sucht die LC-Nummer fuer genau einen einzelnen Titel (per Datenbank-ID)
    online nach und traegt sie - falls gefunden - nur bei diesem einen Titel
    ein (andere Titel desselben Albums bleiben unangetastet).

    Gibt ein Tupel (status, wert) zurueck:
        ("gefunden", lc_nummer)       - neu gefunden und eingetragen
        ("bereits_vorhanden", lc_nummer) - Titel hatte schon eine LC-Nummer,
                                            es wurde nicht gesucht
        ("keine_angaben", None)       - Interpret oder Album fehlt am Titel
        ("nicht_gefunden", None)      - online keine passende LC-Nummer gefunden

    Wirft LookupFehler bei Netzwerk-/Serverproblemen.
    """
    row = conn.execute(
        "SELECT artist, album, lc_nummer FROM songs WHERE id = ?", (song_id,)
    ).fetchone()
    if row is None:
        raise ValueError(f"Kein Titel mit ID {song_id} gefunden")

    if row["lc_nummer"]:
        return ("bereits_vorhanden", row["lc_nummer"])

    artist, album = row["artist"], row["album"]
    if not artist or not album:
        return ("keine_angaben", None)

    lc = lc_nummer_nachschlagen(artist, album)
    if not lc:
        return ("nicht_gefunden", None)

    conn.execute(
        "UPDATE songs SET lc_nummer = ? WHERE id = ? AND (lc_nummer IS NULL OR lc_nummer = '')",
        (lc, song_id),
    )
    return ("gefunden", lc)


def fehlende_lc_nummern_nachschlagen(conn, on_progress=None):
    """Sucht online nach LC-Nummern fuer alle Titel, die noch keine haben
    (aber Interpret UND Album eingetragen haben) - eine Anfrage pro
    verschiedenem (Interpret, Album)-Paar, nicht pro Titel. Ueberschreibt
    niemals eine bereits vorhandene LC-Nummer.

    'on_progress', falls angegeben, wird vor jedem Album-Paar aufgerufen als
    on_progress(geprueft, gesamt, "Interpret - Album").

    Gibt ein Dict zurueck:
        gefunden: [(anzahl_titel, interpret, album, lc_nummer), ...]
        nicht_gefunden: [(interpret, album), ...]
        fehler: [(interpret, album, fehlermeldung), ...]
    """
    rows = conn.execute(
        """SELECT DISTINCT artist, album FROM songs
           WHERE (lc_nummer IS NULL OR lc_nummer = '')
             AND artist IS NOT NULL AND artist != ''
             AND album IS NOT NULL AND album != ''"""
    ).fetchall()

    ergebnis = {"gefunden": [], "nicht_gefunden": [], "fehler": []}
    gesamt = len(rows)
    for index, row in enumerate(rows, start=1):
        artist, album = row["artist"], row["album"]
        if on_progress is not None:
            on_progress(index, gesamt, f"{artist} - {album}")
        try:
            lc = lc_nummer_nachschlagen(artist, album)
        except LookupFehler as exc:
            ergebnis["fehler"].append((artist, album, str(exc)))
            continue
        if not lc:
            ergebnis["nicht_gefunden"].append((artist, album))
            continue
        cursor = conn.execute(
            """UPDATE songs SET lc_nummer = ?
               WHERE artist = ? AND album = ? AND (lc_nummer IS NULL OR lc_nummer = '')""",
            (lc, artist, album),
        )
        ergebnis["gefunden"].append((cursor.rowcount, artist, album, lc))

    return ergebnis
