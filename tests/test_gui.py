import struct
import time
import wave
from pathlib import Path

import pytest

tk = pytest.importorskip("tkinter")

from musikarchiv import db, organizer  # noqa: E402

try:
    from musikarchiv import gui
except tk.TclError:
    pytest.skip("Keine grafische Oberflaeche verfuegbar", allow_module_level=True)


def _app_or_skip(db_path):
    try:
        return gui.MusikArchivApp(db_path=db_path)
    except tk.TclError:
        pytest.skip("Kein Display verfuegbar (z.B. headless ohne Xvfb)")


def _make_wav(path: Path, name: str) -> Path:
    f = path / name
    with wave.open(str(f), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(struct.pack("<10h", *([0] * 10)))
    return f


def _seed_songs(db_path, tmp_path):
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath, duration_sec) VALUES (?,?,?,?,?)",
            ("Sonnenschein", "Band A", "Album X", str(tmp_path / "sonnenschein.mp3"), 185),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath, duration_sec) VALUES (?,?,?,?,?)",
            ("Regentraenen", "Band B", "Album Y", str(tmp_path / "regentraenen.mp3"), 210),
        )


def test_liste_zeigt_importierte_titel(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        assert len(app.tree.get_children()) == 2
    finally:
        app.destroy()


def test_suche_filtert_live(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.search_var.set("Sonnen")
        app.update()
        children = app.tree.get_children()
        assert len(children) == 1
        assert app.tree.item(children[0], "values")[0] == "Sonnenschein"
    finally:
        app.destroy()


def test_stimmung_hinzufuegen_und_entfernen_behaelt_auswahl(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        first_id = app.tree.get_children()[0]
        app.tree.selection_set(first_id)
        app.on_select_song()

        app.new_mood_var.set("Freude")
        app.add_mood()
        app.update()

        # Detailpanel bleibt nach dem Neuladen der Liste erhalten (Regression:
        # Treeview-Neuaufbau loeschte zuvor die Auswahl und leerte das Panel).
        assert app.selected_song_id is not None
        assert "Freude" in app.mood_listbox.get(0, "end")

        with db.connect(db_path) as conn:
            moods = organizer._mood_names(conn, app.selected_song_id)
        assert moods == ["Freude"]

        app.mood_filter_var.set("Freude")
        app.refresh_songs()
        app.update()
        assert len(app.tree.get_children()) == 1
        assert app.selected_song_id is not None

        app.mood_listbox.selection_set(0)
        app.remove_mood()
        app.update()

        with db.connect(db_path) as conn:
            count = conn.execute("SELECT COUNT(*) as c FROM song_moods").fetchone()["c"]
        assert count == 0
    finally:
        app.destroy()


def test_suggest_mood_nutzt_genre(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, genre, filepath, duration_sec) "
            "VALUES (?,?,?,?,?,?)",
            ("Rockhymne", "Band A", None, "Metal", str(tmp_path / "rock.mp3"), 200),
        )

    monkeypatch.setattr(gui.messagebox, "showinfo", lambda *a, **k: None)
    monkeypatch.setattr(gui.messagebox, "showwarning", lambda *a, **k: None)

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.tree.selection_set(app.tree.get_children()[0])
        app.on_select_song()
        assert app.detail_genre == "Metal"

        app.suggest_mood()
        app.update()

        with db.connect(db_path) as conn:
            song_id = conn.execute("SELECT id FROM songs").fetchone()["id"]
            zugewiesen = set(organizer._mood_names(conn, song_id))
        assert zugewiesen == {"Wut", "Spannung"}
    finally:
        app.destroy()


def test_fix_album_moods_in_der_gui(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Testlied", "Band A", "Spannung", str(tmp_path / "t.mp3")),
        )

    monkeypatch.setattr(gui.messagebox, "showinfo", lambda *a, **k: None)

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.fix_album_moods()
        app.update()
        with db.connect(db_path) as conn:
            song = conn.execute("SELECT * FROM songs WHERE title='Testlied'").fetchone()
            assert song["album"] is None
            assert organizer._mood_names(conn, song["id"]) == ["Spannung"]
    finally:
        app.destroy()


def test_mehrfachauswahl_liefert_alle_ids(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        alle_ids = app.tree.get_children()
        assert len(alle_ids) == 2
        app.tree.selection_set(alle_ids)  # simuliert Strg/Umschalt-Mehrfachauswahl
        app.on_select_song()
        app.update()

        assert sorted(app.selected_song_ids) == sorted(int(i) for i in alle_ids)
        # Bei Mehrfachauswahl gibt es keinen "einen" ausgewaehlten Titel mehr
        assert app.selected_song_id is None
        assert "2 Titel ausgewählt" in app.detail_title_var.get()
    finally:
        app.destroy()


def test_delete_selected_entfernt_mehrere_titel(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    monkeypatch.setattr(gui.messagebox, "askyesno", lambda *a, **k: True)
    monkeypatch.setattr(gui.messagebox, "showwarning", lambda *a, **k: None)

    app = _app_or_skip(db_path)
    app.update()
    try:
        alle_ids = app.tree.get_children()
        app.tree.selection_set(alle_ids)
        app.on_select_song()
        app.update()

        app.delete_selected()
        app.update()

        with db.connect(db_path) as conn:
            anzahl = conn.execute("SELECT COUNT(*) as c FROM songs").fetchone()["c"]
        assert anzahl == 0
        assert len(app.tree.get_children()) == 0
        assert app.selected_song_id is None
        assert app.selected_song_ids == []
    finally:
        app.destroy()


def test_delete_selected_ohne_bestaetigung_loescht_nichts(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    monkeypatch.setattr(gui.messagebox, "askyesno", lambda *a, **k: False)

    app = _app_or_skip(db_path)
    app.update()
    try:
        first_id = app.tree.get_children()[0]
        app.tree.selection_set(first_id)
        app.on_select_song()
        app.update()

        app.delete_selected()
        app.update()

        with db.connect(db_path) as conn:
            anzahl = conn.execute("SELECT COUNT(*) as c FROM songs").fetchone()["c"]
        assert anzahl == 2
    finally:
        app.destroy()


def test_spalten_sortierung_per_klick_auf_kopfzeile(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        # Standard: nach Titel aufsteigend (Regentraenen vor Sonnenschein)
        titel = [app.tree.item(i, "values")[0] for i in app.tree.get_children()]
        assert titel == ["Regentraenen", "Sonnenschein"]

        # Klick auf "Interpret" sortiert danach (Band A vor Band B)
        app.sort_by("interpret")
        app.update()
        interpreten = [app.tree.item(i, "values")[1] for i in app.tree.get_children()]
        assert interpreten == ["Band A", "Band B"]

        # Erneuter Klick auf dieselbe Spalte dreht die Richtung um
        app.sort_by("interpret")
        app.update()
        interpreten = [app.tree.item(i, "values")[1] for i in app.tree.get_children()]
        assert interpreten == ["Band B", "Band A"]
    finally:
        app.destroy()


def test_import_folder_laeuft_im_hintergrund_mit_fortschritt(tmp_path, monkeypatch):
    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    for i in range(5):
        _make_wav(musik_ordner, f"Lied{i}.wav")

    db_path = tmp_path / "test.db"
    app = _app_or_skip(db_path)
    app.update()

    meldungen = []
    monkeypatch.setattr(
        gui.messagebox, "showinfo", lambda titel, text: meldungen.append(text)
    )

    try:
        app._import_starten(str(musik_ordner))

        # Solange der Hintergrund-Thread laeuft, muss die Oberflaeche
        # weiter auf Ereignisse reagieren (nicht eingefroren).
        deadline = time.time() + 10
        while time.time() < deadline and not meldungen:
            app.update()
            time.sleep(0.02)

        assert meldungen, "Import wurde nicht innerhalb der erwarteten Zeit abgeschlossen"
        assert "5 Titel importiert" in meldungen[0]

        with db.connect(db_path) as conn:
            anzahl = conn.execute("SELECT COUNT(*) as c FROM songs").fetchone()["c"]
        assert anzahl == 5
        assert len(app.tree.get_children()) == 5
    finally:
        app.destroy()


def test_import_folder_fortschritt_callback_bei_vielen_dateien(tmp_path):
    from musikarchiv import importer

    musik_ordner = tmp_path / "musik"
    musik_ordner.mkdir()
    for i in range(12):
        _make_wav(musik_ordner, f"Lied{i:02d}.wav")

    aufrufe = []
    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        importer.import_directory(
            conn, musik_ordner, on_progress=lambda i, g, name: aufrufe.append((i, g, name))
        )

    assert len(aufrufe) == 12
    assert aufrufe[0][0] == 1
    assert aufrufe[-1] == (12, 12, aufrufe[-1][2])
    assert all(gesamt == 12 for _, gesamt, _ in aufrufe)


def _seed_alben(db_path, tmp_path):
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, year, filepath) VALUES (?,?,?,?,?)",
            ("24K Magic", "Bruno Mars", "24K Magic", 2016, str(tmp_path / "1.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, year, filepath) VALUES (?,?,?,?,?)",
            ("That's What I Like", "Bruno Mars", "24K Magic", 2016, str(tmp_path / "2.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Solo-Track", "Ein Interpret", None, str(tmp_path / "3.mp3")),
        )


def test_album_ansicht_gruppiert_titel_zu_alben(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_alben(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.view_mode_var.set("alben")
        app.on_view_mode_changed()
        app.update()

        # Nur die zwei Alben ("24K Magic" + "(kein Album)") sind oben sichtbar,
        # die einzelnen Titel sind als Kinder eingeklappt.
        album_zeilen = app.album_tree.get_children()
        assert len(album_zeilen) == 2

        werte = {
            app.album_tree.item(i, "text"): app.album_tree.item(i, "values") for i in album_zeilen
        }
        assert "24K Magic" in werte
        assert werte["24K Magic"][0] == "Bruno Mars"
        assert werte["24K Magic"][2] == "2"  # Anzahl Titel

        assert gui.KEIN_ALBUM in werte
        assert werte[gui.KEIN_ALBUM][2] == "1"

        # Der Titel-Baum ist waehrenddessen unsichtbar, der Album-Baum sichtbar
        assert not app.title_list_frame.winfo_ismapped()
        assert app.album_list_frame.winfo_ismapped()
    finally:
        app.destroy()


def test_album_gruppierung_ignoriert_abweichende_schreibweise(tmp_path):
    """Regressionstest fuer den gemeldeten Fehler: Titel desselben Albums
    landeten jeweils in einer eigenen Album-Zeile, weil Interpret/Album bei
    echten Dateien oft minimal abweichen (Leerzeichen, Gross-/Klein-
    schreibung - je nachdem, womit sie mal getaggt wurden)."""
    db_path = tmp_path / "test.db"
    with db.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel 1", "Bruno Mars", "24K Magic", str(tmp_path / "1.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel 2", "Bruno Mars ", "24k magic", str(tmp_path / "2.mp3")),
        )
        conn.execute(
            "INSERT INTO songs (title, artist, album, filepath) VALUES (?,?,?,?)",
            ("Titel 3", " bruno mars", " 24K Magic ", str(tmp_path / "3.mp3")),
        )

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.view_mode_var.set("alben")
        app.on_view_mode_changed()
        app.update()

        album_zeilen = app.album_tree.get_children()
        assert len(album_zeilen) == 1  # alle drei gehoeren zu einem Album

        kinder = app.album_tree.get_children(album_zeilen[0])
        titel = sorted(app.album_tree.item(k, "text") for k in kinder)
        assert titel == ["Titel 1", "Titel 2", "Titel 3"]
        assert app.album_tree.item(album_zeilen[0], "values")[2] == "3"  # Anzahl

        # Drilldown ("Titel dieses Albums anzeigen") findet trotz
        # abweichender Schreibweise ebenfalls alle drei Titel.
        app.album_tree.selection_set(album_zeilen[0])
        app.album_titel_anzeigen()
        app.update()
        assert len(app.tree.get_children()) == 3
    finally:
        app.destroy()


def test_album_aufklappen_zeigt_enthaltene_titel(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_alben(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.view_mode_var.set("alben")
        app.on_view_mode_changed()
        app.update()

        album_iid = next(
            i for i in app.album_tree.get_children()
            if app.album_tree.item(i, "text") == "24K Magic"
        )
        # Die Titel sind als Kinder vorhanden, aber erst nach dem Aufklappen sichtbar.
        kinder = app.album_tree.get_children(album_iid)
        titel = sorted(app.album_tree.item(k, "text") for k in kinder)
        assert titel == ["24K Magic", "That's What I Like"]

        # Auswahl eines Titels darin fuellt das Detailpanel wie in der Titel-Ansicht.
        app.album_tree.item(album_iid, open=True)
        app.album_tree.selection_set(kinder[0])
        app.on_select_album()
        app.update()
        assert app.selected_song_id is not None
        assert app.detail_title_var.get() == app.album_tree.item(kinder[0], "text")
    finally:
        app.destroy()


def test_album_titel_anzeigen_filtert_titelansicht(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    _seed_alben(db_path, tmp_path)

    monkeypatch.setattr(gui.messagebox, "showwarning", lambda *a, **k: None)

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.view_mode_var.set("alben")
        app.on_view_mode_changed()
        app.update()

        # "24K Magic"-Zeile finden und auswaehlen
        ziel_iid = next(
            i for i in app.album_tree.get_children()
            if app.album_tree.item(i, "text") == "24K Magic"
        )
        app.album_tree.selection_set(ziel_iid)
        app.update()

        app.album_titel_anzeigen()
        app.update()

        assert app.view_mode_var.get() == "titel"
        assert app.album_filter == ("Bruno Mars", "24K Magic")
        titel = sorted(app.tree.item(i, "values")[0] for i in app.tree.get_children())
        assert titel == ["24K Magic", "That's What I Like"]

        # Filterleiste ist sichtbar und zeigt den Filter an
        assert app.filter_leiste.winfo_ismapped()
        assert "24K Magic" in app.filter_leiste_label.cget("text")

        # Filter aufheben zeigt wieder alle Titel
        app.album_filter_aufheben()
        app.update()
        assert len(app.tree.get_children()) == 3
        assert not app.filter_leiste.winfo_ismapped()
    finally:
        app.destroy()


def test_album_ansicht_sortierung_per_klick(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_alben(db_path, tmp_path)

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.view_mode_var.set("alben")
        app.on_view_mode_changed()
        app.update()

        app.sort_by_album("interpret")
        app.update()
        interpreten = [app.album_tree.item(i, "values")[0] for i in app.album_tree.get_children()]
        assert interpreten == sorted(interpreten, key=str.lower)

        app.sort_by_album("interpret")
        app.update()
        interpreten_umgekehrt = [
            app.album_tree.item(i, "values")[0] for i in app.album_tree.get_children()
        ]
        assert interpreten_umgekehrt == sorted(interpreten, key=str.lower, reverse=True)
    finally:
        app.destroy()


def test_ansicht_wechsel_verwirft_alte_titelauswahl(tmp_path, monkeypatch):
    """Regressionstest: nach dem Wechsel in die Album-Ansicht darf eine
    zuvor in der Titel-Ansicht getroffene Auswahl nicht mehr fuer
    'Ausgewaehlte loeschen' greifen."""
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)

    warnungen = []
    monkeypatch.setattr(gui.messagebox, "showwarning", lambda *a, **k: warnungen.append(1))

    app = _app_or_skip(db_path)
    app.update()
    try:
        app.tree.selection_set(app.tree.get_children())
        app.on_select_song()
        assert len(app.selected_song_ids) == 2

        app.view_mode_var.set("alben")
        app.on_view_mode_changed()
        app.update()

        assert app.selected_song_ids == []
        app.delete_selected()
        assert warnungen  # Warnung statt stillschweigendem Loeschen

        with db.connect(db_path) as conn:
            anzahl = conn.execute("SELECT COUNT(*) as c FROM songs").fetchone()["c"]
        assert anzahl == 2
    finally:
        app.destroy()


def test_organize_sortiert_dateien(tmp_path):
    db_path = tmp_path / "test.db"
    _seed_songs(db_path, tmp_path)
    (tmp_path / "sonnenschein.mp3").write_bytes(b"")
    (tmp_path / "regentraenen.mp3").write_bytes(b"")

    with db.connect(db_path) as conn:
        conn.execute("INSERT INTO moods (name) VALUES ('Drama')")
        mood_id = conn.execute("SELECT id FROM moods WHERE name='Drama'").fetchone()["id"]
        song_id = conn.execute(
            "SELECT id FROM songs WHERE title='Regentraenen'"
        ).fetchone()["id"]
        conn.execute(
            "INSERT INTO song_moods (song_id, mood_id) VALUES (?, ?)", (song_id, mood_id)
        )

    app = _app_or_skip(db_path)
    app.update()
    try:
        ziel = tmp_path / "sortiert"
        with db.connect(db_path) as conn:
            results = organizer.organize(conn, ziel, by="mood", action="copy")
        assert any(status == "ok" for _, _, status in results)
        assert (ziel / "Drama" / "regentraenen.mp3").exists()
    finally:
        app.destroy()
