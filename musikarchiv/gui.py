"""Grafische Oberfläche für das Musikarchiv (ein einziges Fenster)."""

import queue
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from . import db, importer, moods, organizer

APP_DIR = Path(__file__).resolve().parent.parent
ICON_ICO_PATH = APP_DIR / "icon.ico"
ICON_PNG_PATH = APP_DIR / "icon.png"
ALLE_STIMMUNGEN = "(alle Stimmungen)"

# Spalten, die per Klick auf die Ueberschrift sortierbar sind, und die
# SQL-Ausdruecke, nach denen dann sortiert wird.
SORTIERBARE_SPALTEN = {
    "titel": "s.title",
    "interpret": "s.artist",
    "album": "s.album",
    "stimmungen": "moods",
}
SPALTEN_BESCHRIFTUNG = {
    "titel": "Titel",
    "interpret": "Interpret",
    "album": "Album",
    "stimmungen": "Stimmungen",
}

# Dieselbe Idee fuer die Album-Ansicht (eine Zeile pro Album statt pro Titel).
ALBUM_SORTIERBARE_SPALTEN = {
    "album": "album_anzeige",
    "interpret": "artist",
    "stimmungen": "moods",
}
ALBUM_SPALTEN_BESCHRIFTUNG = {
    "album": "Album",
    "interpret": "Interpret",
    "stimmungen": "Stimmungen",
}
KEIN_ALBUM = "(kein Album)"

# Audiowiedergabe wird erst beim ersten Abspielen geladen, damit die App
# auch ohne installiertes 'pygame' startet (dann funktioniert nur Play/Stopp nicht).
_mixer = None
_mixer_versucht = False


def _get_mixer():
    global _mixer, _mixer_versucht
    if _mixer is not None:
        return _mixer
    if _mixer_versucht:
        return None
    _mixer_versucht = True
    try:
        import pygame

        pygame.mixer.init()
        _mixer = pygame.mixer
    except Exception:
        _mixer = None
    return _mixer


class MusikArchivApp(tk.Tk):
    def __init__(self, db_path=db.DEFAULT_DB_PATH):
        super().__init__()
        self.db_path = db_path
        self.title("Musikarchiv")
        self.geometry("1100x650")
        self.minsize(850, 500)
        self._set_icon()

        self.selected_song_id = None
        self.selected_song_ids = []
        self.detail_genre = None
        self.sort_column = "titel"
        self.sort_reverse = False
        self.sort_column_album = "album"
        self.sort_reverse_album = False
        self.album_filter = None  # (artist_or_None, album_or_None), aktiv nach "Titel anzeigen"
        self._build_widgets()
        self.refresh_moods()
        self.refresh_songs()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _set_icon(self):
        # Windows kennt .ico ueber iconbitmap; macOS/Linux brauchen ein
        # Pixelbild (.png) ueber iconphoto.
        try:
            if sys.platform.startswith("win"):
                self.iconbitmap(str(ICON_ICO_PATH))
            elif ICON_PNG_PATH.exists():
                self._icon_image = tk.PhotoImage(file=str(ICON_PNG_PATH))
                self.iconphoto(True, self._icon_image)
        except Exception:
            pass

    def _on_close(self):
        mixer = _get_mixer()
        if mixer is not None:
            mixer.music.stop()
        self.destroy()

    # ------------------------------------------------------------------ UI
    def _build_widgets(self):
        style = ttk.Style(self)
        try:
            style.theme_use("vista")
        except tk.TclError:
            pass

        toolbar = ttk.Frame(self, padding=8)
        toolbar.pack(side="top", fill="x")

        ttk.Button(toolbar, text="Ordner importieren", command=self.import_folder).pack(
            side="left", padx=(0, 8)
        )
        self.auto_genre_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            toolbar,
            text="Stimmung nach Genre vorschlagen",
            variable=self.auto_genre_var,
        ).pack(side="left", padx=(0, 8))

        werkzeuge_menu = tk.Menu(toolbar, tearoff=False)
        werkzeuge_menu.add_command(
            label="Album-Stimmungen korrigieren", command=self.fix_album_moods
        )
        werkzeuge_menu.add_command(
            label="Chart-Hits markieren", command=self.tag_chart_hits
        )
        ttk.Menubutton(toolbar, text="Werkzeuge ▾", menu=werkzeuge_menu).pack(
            side="left", padx=(0, 8)
        )

        ttk.Button(
            toolbar, text="Ausgewählte löschen", command=self.delete_selected
        ).pack(side="left", padx=(0, 16))

        ttk.Label(toolbar, text="Ansicht:").pack(side="left")
        self.view_mode_var = tk.StringVar(value="titel")
        ttk.Radiobutton(
            toolbar, text="Titel", value="titel", variable=self.view_mode_var,
            command=self.on_view_mode_changed,
        ).pack(side="left")
        ttk.Radiobutton(
            toolbar, text="Alben", value="alben", variable=self.view_mode_var,
            command=self.on_view_mode_changed,
        ).pack(side="left", padx=(0, 16))

        ttk.Label(toolbar, text="Suche:").pack(side="left")
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self._refresh_aktuelle_ansicht())
        search_entry = ttk.Entry(toolbar, textvariable=self.search_var, width=30)
        search_entry.pack(side="left", padx=(4, 16))
        search_entry.focus_set()

        ttk.Label(toolbar, text="Stimmung:").pack(side="left")
        self.mood_filter_var = tk.StringVar(value=ALLE_STIMMUNGEN)
        self.mood_filter_box = ttk.Combobox(
            toolbar, textvariable=self.mood_filter_var, state="readonly", width=20
        )
        self.mood_filter_box.pack(side="left", padx=(4, 0))
        self.mood_filter_box.bind(
            "<<ComboboxSelected>>", lambda *_: self._refresh_aktuelle_ansicht()
        )

        self.status_var = tk.StringVar(value="")
        ttk.Label(toolbar, textvariable=self.status_var, foreground="#555").pack(
            side="right"
        )

        self.filter_leiste = ttk.Frame(self, padding=(8, 0))
        self.filter_leiste_label = ttk.Label(self.filter_leiste, text="", foreground="#555")
        self.filter_leiste_label.pack(side="left")
        ttk.Button(
            self.filter_leiste, text="Filter aufheben ✕", command=self.album_filter_aufheben
        ).pack(side="left", padx=(8, 0))

        main = ttk.Panedwindow(self, orient="horizontal")
        self._panedwindow = main
        main.pack(side="top", fill="both", expand=True, padx=8, pady=(0, 8))

        # --- Liste (Titel-Ansicht und Album-Ansicht, nur eine davon sichtbar) ---
        list_container = ttk.Frame(main)

        self.title_list_frame = ttk.Frame(list_container)
        columns = ("titel", "interpret", "jahr", "album", "lc_nummer", "dauer", "stimmungen")
        self.tree = ttk.Treeview(
            self.title_list_frame, columns=columns, show="headings", selectmode="extended"
        )
        headings = {
            "titel": ("Titel", 220),
            "interpret": ("Interpret", 150),
            "jahr": ("Jahr", 60),
            "album": ("Album", 150),
            "lc_nummer": ("LC-Nummer", 90),
            "dauer": ("Dauer", 70),
            "stimmungen": ("Stimmungen", 220),
        }
        for col, (label, width) in headings.items():
            if col in SORTIERBARE_SPALTEN:
                self.tree.heading(col, text=label, command=lambda c=col: self.sort_by(c))
            else:
                self.tree.heading(col, text=label)
            self.tree.column(col, width=width, anchor="w")
        vsb = ttk.Scrollbar(self.title_list_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        self.tree.bind("<<TreeviewSelect>>", self.on_select_song)
        self.tree.bind("<Double-1>", lambda _e: self.play_selected())
        self.tree.bind("<Delete>", lambda _e: self.delete_selected())
        self.tree.bind("<BackSpace>", lambda _e: self.delete_selected())
        self.title_list_frame.pack(side="top", fill="both", expand=True)

        self.album_list_frame = ttk.Frame(list_container)
        album_button_row = ttk.Frame(self.album_list_frame)
        album_button_row.pack(side="top", fill="x", pady=(0, 4))
        ttk.Button(
            album_button_row,
            text="Titel dieses Albums anzeigen",
            command=self.album_titel_anzeigen,
        ).pack(side="left")

        album_tree_frame = ttk.Frame(self.album_list_frame)
        album_tree_frame.pack(side="top", fill="both", expand=True)
        album_columns = ("album", "interpret", "jahr", "anzahl", "stimmungen")
        self.album_tree = ttk.Treeview(
            album_tree_frame, columns=album_columns, show="headings", selectmode="browse"
        )
        album_headings = {
            "album": ("Album", 260),
            "interpret": ("Interpret", 180),
            "jahr": ("Jahr", 60),
            "anzahl": ("Titel", 60),
            "stimmungen": ("Stimmungen", 260),
        }
        for col, (label, width) in album_headings.items():
            if col in ALBUM_SORTIERBARE_SPALTEN:
                self.album_tree.heading(
                    col, text=label, command=lambda c=col: self.sort_by_album(c)
                )
            else:
                self.album_tree.heading(col, text=label)
            self.album_tree.column(col, width=width, anchor="w")
        album_vsb = ttk.Scrollbar(
            album_tree_frame, orient="vertical", command=self.album_tree.yview
        )
        self.album_tree.configure(yscrollcommand=album_vsb.set)
        self.album_tree.pack(side="left", fill="both", expand=True)
        album_vsb.pack(side="right", fill="y")
        self.album_tree.bind("<<TreeviewSelect>>", self.on_select_album)
        self.album_tree.bind("<Double-1>", lambda _e: self.album_titel_anzeigen())
        # album_list_frame wird erst bei Umschalten auf "Alben" gepackt

        main.add(list_container, weight=3)

        # --- Detailbereich ---
        detail_frame = ttk.Frame(main, padding=10)
        main.add(detail_frame, weight=1)

        ttk.Label(detail_frame, text="Ausgewählter Titel", font=("", 11, "bold")).pack(
            anchor="w"
        )
        self.detail_title_var = tk.StringVar(value="–")
        self.detail_artist_var = tk.StringVar(value="")
        self.detail_album_var = tk.StringVar(value="")
        self.detail_year_var = tk.StringVar(value="")
        self.detail_lc_var = tk.StringVar(value="")
        self.detail_path_var = tk.StringVar(value="")
        ttk.Label(detail_frame, textvariable=self.detail_title_var, font=("", 10, "bold")).pack(
            anchor="w", pady=(6, 0)
        )
        ttk.Label(detail_frame, textvariable=self.detail_artist_var).pack(anchor="w")
        ttk.Label(detail_frame, textvariable=self.detail_album_var).pack(anchor="w")
        ttk.Label(detail_frame, textvariable=self.detail_year_var).pack(anchor="w")
        ttk.Label(detail_frame, textvariable=self.detail_lc_var).pack(anchor="w")
        ttk.Label(
            detail_frame, textvariable=self.detail_path_var, wraplength=260, foreground="#666"
        ).pack(anchor="w", pady=(4, 4))

        playback_row = ttk.Frame(detail_frame)
        playback_row.pack(fill="x", pady=(0, 4))
        ttk.Button(playback_row, text="▶ Abspielen", command=self.play_selected).pack(
            side="left"
        )
        ttk.Button(playback_row, text="⏹ Stopp", command=self.stop_playback).pack(
            side="left", padx=(6, 0)
        )
        self.playback_status_var = tk.StringVar(value="")
        ttk.Label(detail_frame, textvariable=self.playback_status_var, foreground="#555").pack(
            anchor="w", pady=(0, 12)
        )

        ttk.Separator(detail_frame).pack(fill="x", pady=8)
        ttk.Label(detail_frame, text="Stimmungen", font=("", 10, "bold")).pack(anchor="w")

        self.mood_listbox = tk.Listbox(detail_frame, height=8, exportselection=False)
        self.mood_listbox.pack(fill="both", expand=True, pady=(4, 4))

        mood_edit_row = ttk.Frame(detail_frame)
        mood_edit_row.pack(fill="x")
        self.new_mood_var = tk.StringVar()
        mood_entry = ttk.Entry(mood_edit_row, textvariable=self.new_mood_var)
        mood_entry.pack(side="left", fill="x", expand=True)
        mood_entry.bind("<Return>", lambda *_: self.add_mood())
        ttk.Button(mood_edit_row, text="+", width=3, command=self.add_mood).pack(
            side="left", padx=(4, 0)
        )
        ttk.Button(
            detail_frame, text="Ausgewählte Stimmung entfernen", command=self.remove_mood
        ).pack(anchor="w", pady=(6, 0))
        ttk.Button(
            detail_frame, text="Stimmung anhand Genre vorschlagen", command=self.suggest_mood
        ).pack(anchor="w", pady=(2, 0), fill="x")

        ttk.Separator(detail_frame).pack(fill="x", pady=12)
        ttk.Label(detail_frame, text="Auf Festplatte sortieren", font=("", 10, "bold")).pack(
            anchor="w"
        )
        ttk.Label(
            detail_frame,
            text="Sortiert ALLE importierten Titel in Ordner.",
            foreground="#666",
        ).pack(anchor="w", pady=(0, 4))

        ttk.Label(detail_frame, text="Sortieren nach:").pack(anchor="w")
        self.organize_by_var = tk.StringVar(value="mood")
        for value, label in [
            ("mood", "Stimmung"),
            ("artist", "Interpret"),
            ("mood-artist", "Stimmung + Interpret"),
        ]:
            ttk.Radiobutton(
                detail_frame, text=label, value=value, variable=self.organize_by_var
            ).pack(anchor="w")

        ttk.Label(detail_frame, text="Aktion:").pack(anchor="w", pady=(6, 0))
        self.organize_action_var = tk.StringVar(value="copy")
        for value, label in [
            ("copy", "Kopieren"),
            ("move", "Verschieben"),
            ("link", "Verknüpfen"),
        ]:
            ttk.Radiobutton(
                detail_frame, text=label, value=value, variable=self.organize_action_var
            ).pack(anchor="w")

        ttk.Button(
            detail_frame, text="Zielordner wählen und sortieren", command=self.organize_now
        ).pack(anchor="w", pady=(10, 0), fill="x")

    # -------------------------------------------------------------- Daten
    def sort_by(self, column):
        if self.sort_column == column:
            self.sort_reverse = not self.sort_reverse
        else:
            self.sort_column = column
            self.sort_reverse = False
        self.refresh_songs()

    def _update_sort_indicator(self):
        pfeil = " ▼" if self.sort_reverse else " ▲"
        for col, label in SPALTEN_BESCHRIFTUNG.items():
            text = label + pfeil if col == self.sort_column else label
            self.tree.heading(col, text=text)

    def sort_by_album(self, column):
        if self.sort_column_album == column:
            self.sort_reverse_album = not self.sort_reverse_album
        else:
            self.sort_column_album = column
            self.sort_reverse_album = False
        self.refresh_albums()

    def _update_album_sort_indicator(self):
        pfeil = " ▼" if self.sort_reverse_album else " ▲"
        for col, label in ALBUM_SPALTEN_BESCHRIFTUNG.items():
            text = label + pfeil if col == self.sort_column_album else label
            self.album_tree.heading(col, text=text)

    def on_view_mode_changed(self):
        # Auswahl aus der jeweils anderen Ansicht verwerfen, damit Aktionen wie
        # "Ausgewählte löschen" nicht versehentlich auf eine veraltete Auswahl wirken.
        # Wichtig: auch die Treeview-Auswahl selbst leeren, nicht nur die
        # Python-Buchfuehrung - sonst kann ein noch ausstehendes
        # <<TreeviewSelect>>-Ereignis die Auswahl spaeter wiederherstellen.
        self.tree.selection_set(())
        self.album_tree.selection_set(())
        self._clear_detail()
        if self.view_mode_var.get() == "alben":
            self.title_list_frame.pack_forget()
            self.album_list_frame.pack(side="top", fill="both", expand=True)
            self.refresh_albums()
        else:
            self.album_list_frame.pack_forget()
            self.title_list_frame.pack(side="top", fill="both", expand=True)
            self.refresh_songs()

    def _refresh_aktuelle_ansicht(self):
        if self.view_mode_var.get() == "alben":
            self.refresh_albums()
        else:
            self.refresh_songs()

    def refresh_moods(self):
        with db.connect(self.db_path) as conn:
            rows = conn.execute("SELECT name FROM moods ORDER BY name").fetchall()
        values = [ALLE_STIMMUNGEN] + [r["name"] for r in rows]
        current = self.mood_filter_var.get()
        self.mood_filter_box["values"] = values
        if current not in values:
            self.mood_filter_var.set(ALLE_STIMMUNGEN)

    def refresh_songs(self):
        suchtext = self.search_var.get().strip()
        stimmung = self.mood_filter_var.get()

        query = """
            SELECT s.*, GROUP_CONCAT(m.name, ', ') AS moods
            FROM songs s
            LEFT JOIN song_moods sm ON sm.song_id = s.id
            LEFT JOIN moods m ON m.id = sm.mood_id
        """
        conditions = []
        params = []
        if suchtext:
            conditions.append("s.title LIKE ?")
            params.append(f"%{suchtext}%")
        if stimmung and stimmung != ALLE_STIMMUNGEN:
            conditions.append(
                "s.id IN (SELECT sm2.song_id FROM song_moods sm2 "
                "JOIN moods m2 ON m2.id = sm2.mood_id WHERE m2.name = ?)"
            )
            params.append(stimmung)
        if self.album_filter is not None:
            artist, album = self.album_filter
            if artist is None:
                conditions.append("s.artist IS NULL")
            else:
                conditions.append("s.artist = ?")
                params.append(artist)
            if album is None:
                conditions.append("s.album IS NULL")
            else:
                conditions.append("s.album = ?")
                params.append(album)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        sort_ausdruck = SORTIERBARE_SPALTEN.get(self.sort_column, "s.title")
        richtung = "DESC" if self.sort_reverse else "ASC"
        query += f" GROUP BY s.id ORDER BY {sort_ausdruck} COLLATE NOCASE {richtung}"

        with db.connect(self.db_path) as conn:
            rows = conn.execute(query, params).fetchall()

        self._update_sort_indicator()
        self.tree.delete(*self.tree.get_children())
        for row in rows:
            dauer = _format_dauer(row["duration_sec"])
            self.tree.insert(
                "",
                "end",
                iid=str(row["id"]),
                values=(
                    row["title"],
                    row["artist"] or "",
                    row["year"] or "",
                    row["album"] or "",
                    row["lc_nummer"] or "",
                    dauer,
                    row["moods"] or "",
                ),
            )

        if self.album_filter is not None:
            artist, album = self.album_filter
            self.filter_leiste_label.config(
                text=f"Gefiltert nach Album: '{album or KEIN_ALBUM}' von {artist or '?'}"
            )
            self.filter_leiste.pack(side="top", fill="x", before=self._panedwindow)
        else:
            self.filter_leiste.pack_forget()

        self.status_var.set(f"{len(rows)} Titel angezeigt")
        if self.selected_song_id is not None and str(self.selected_song_id) in self.tree.get_children():
            # Neuaufbau der Liste loescht die Treeview-Auswahl technisch;
            # hier wird sie wiederhergestellt, damit das Detailpanel bestehen bleibt.
            self.tree.selection_set(str(self.selected_song_id))
        else:
            self._clear_detail()

    def refresh_albums(self):
        suchtext = self.search_var.get().strip()
        stimmung = self.mood_filter_var.get()

        query = f"""
            SELECT
                s.artist AS artist,
                s.album AS album,
                COALESCE(s.album, '{KEIN_ALBUM}') AS album_anzeige,
                COUNT(*) AS anzahl,
                MIN(s.year) AS year,
                GROUP_CONCAT(DISTINCT m.name) AS moods
            FROM songs s
            LEFT JOIN song_moods sm ON sm.song_id = s.id
            LEFT JOIN moods m ON m.id = sm.mood_id
        """
        conditions = []
        params = []
        if suchtext:
            conditions.append("(COALESCE(s.album, '') LIKE ? OR COALESCE(s.artist, '') LIKE ?)")
            params.extend([f"%{suchtext}%", f"%{suchtext}%"])
        if stimmung and stimmung != ALLE_STIMMUNGEN:
            conditions.append(
                "s.id IN (SELECT sm2.song_id FROM song_moods sm2 "
                "JOIN moods m2 ON m2.id = sm2.mood_id WHERE m2.name = ?)"
            )
            params.append(stimmung)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        sort_ausdruck = ALBUM_SORTIERBARE_SPALTEN.get(self.sort_column_album, "album_anzeige")
        richtung = "DESC" if self.sort_reverse_album else "ASC"
        query += (
            f" GROUP BY s.artist, s.album ORDER BY {sort_ausdruck} COLLATE NOCASE {richtung}"
        )

        with db.connect(self.db_path) as conn:
            rows = conn.execute(query, params).fetchall()

        self._update_album_sort_indicator()
        self.album_tree.delete(*self.album_tree.get_children())
        for index, row in enumerate(rows):
            self.album_tree.insert(
                "",
                "end",
                iid=str(index),
                values=(
                    row["album_anzeige"],
                    row["artist"] or "",
                    row["year"] or "",
                    row["anzahl"],
                    row["moods"] or "",
                ),
            )
        self._album_rows = {str(i): (r["artist"], r["album"]) for i, r in enumerate(rows)}

        self.status_var.set(f"{len(rows)} Alben angezeigt")

    def on_select_album(self, _event=None):
        pass  # keine Detailanzeige fuer Alben - "Titel dieses Albums anzeigen" nutzen

    def album_titel_anzeigen(self):
        selection = self.album_tree.selection()
        if not selection:
            messagebox.showwarning(
                "Kein Album ausgewählt", "Bitte zuerst ein Album in der Liste wählen."
            )
            return
        artist, album = self._album_rows[selection[0]]
        self.album_filter = (artist, album)
        self.view_mode_var.set("titel")
        self.on_view_mode_changed()

    def album_filter_aufheben(self):
        self.album_filter = None
        self.refresh_songs()

    def on_select_song(self, _event=None):
        selection = self.tree.selection()
        self.selected_song_ids = [int(s) for s in selection]

        if not selection:
            self._clear_detail()
            return

        if len(selection) > 1:
            self.selected_song_id = None
            self.detail_title_var.set(f"{len(selection)} Titel ausgewählt")
            self.detail_artist_var.set("")
            self.detail_album_var.set("")
            self.detail_year_var.set("")
            self.detail_lc_var.set("")
            self.detail_path_var.set("")
            self.detail_genre = None
            self.mood_listbox.delete(0, "end")
            return

        song_id = int(selection[0])
        self.selected_song_id = song_id
        with db.connect(self.db_path) as conn:
            song = conn.execute("SELECT * FROM songs WHERE id = ?", (song_id,)).fetchone()
            if song is None:
                self._clear_detail()
                return
            song_moods = organizer._mood_names(conn, song_id)

        self.detail_title_var.set(song["title"])
        self.detail_artist_var.set(song["artist"] or "Interpret unbekannt")
        self.detail_album_var.set(song["album"] or "")
        self.detail_year_var.set(f"Jahr: {song['year']}" if song["year"] else "")
        self.detail_lc_var.set(f"LC-Nummer: {song['lc_nummer']}" if song["lc_nummer"] else "")
        self.detail_path_var.set(song["filepath"])
        self.detail_genre = song["genre"]
        self.mood_listbox.delete(0, "end")
        for mood in song_moods:
            self.mood_listbox.insert("end", mood)

    def _clear_detail(self):
        self.selected_song_id = None
        self.selected_song_ids = []
        self.detail_title_var.set("–")
        self.detail_artist_var.set("")
        self.detail_album_var.set("")
        self.detail_year_var.set("")
        self.detail_lc_var.set("")
        self.detail_path_var.set("")
        self.detail_genre = None
        self.mood_listbox.delete(0, "end")

    # ------------------------------------------------------------ Aktionen
    def import_folder(self):
        ordner = filedialog.askdirectory(title="Musik-Ordner wählen")
        if not ordner:
            return
        self._import_starten(ordner)

    def _import_starten(self, ordner):
        fenster = tk.Toplevel(self)
        fenster.title("Import läuft…")
        fenster.resizable(False, False)
        fenster.transient(self)
        fenster.protocol("WM_DELETE_WINDOW", lambda: None)  # kein Abbrechen mitten im Import

        ttk.Label(
            fenster, text="Musik wird importiert, bitte warten…", padding=(16, 16, 16, 4)
        ).pack()
        fortschritt_var = tk.DoubleVar(value=0)
        ttk.Progressbar(
            fenster, orient="horizontal", length=380, mode="determinate",
            variable=fortschritt_var, maximum=100,
        ).pack(padx=16, pady=(0, 6))
        status_var = tk.StringVar(value="Suche Musikdateien …")
        ttk.Label(fenster, textvariable=status_var, padding=(16, 0, 16, 16)).pack()

        fenster.update_idletasks()
        x = self.winfo_rootx() + (self.winfo_width() - fenster.winfo_width()) // 2
        y = self.winfo_rooty() + (self.winfo_height() - fenster.winfo_height()) // 2
        fenster.geometry(f"+{max(x, 0)}+{max(y, 0)}")
        fenster.grab_set()  # Hauptfenster waehrenddessen blockieren (verhindert parallele DB-Zugriffe)

        out_queue = queue.Queue()
        auto_genre = self.auto_genre_var.get()
        thread = threading.Thread(
            target=self._import_worker, args=(ordner, auto_genre, out_queue), daemon=True
        )
        thread.start()
        self.after(80, self._import_poll, fenster, fortschritt_var, status_var, out_queue)

    def _import_worker(self, ordner, auto_genre, out_queue):
        try:
            with db.connect(self.db_path) as conn:
                def fortschritt(index, gesamt, dateiname):
                    out_queue.put(("progress", index, gesamt, dateiname))

                ergebnis = importer.import_directory(
                    conn, Path(ordner), auto_suggest_by_genre=auto_genre, on_progress=fortschritt
                )
            out_queue.put(("done", ergebnis))
        except Exception as exc:
            out_queue.put(("error", str(exc)))

    def _import_poll(self, fenster, fortschritt_var, status_var, out_queue):
        try:
            while True:
                nachricht = out_queue.get_nowait()
                art = nachricht[0]
                if art == "progress":
                    _, index, gesamt, dateiname = nachricht
                    prozent = (index / gesamt * 100) if gesamt else 100
                    fortschritt_var.set(prozent)
                    status_var.set(f"{index} von {gesamt}: {dateiname}")
                elif art == "done":
                    fenster.grab_release()
                    fenster.destroy()
                    self._import_abgeschlossen(nachricht[1])
                    return
                elif art == "error":
                    fenster.grab_release()
                    fenster.destroy()
                    messagebox.showerror(
                        "Import fehlgeschlagen", f"Beim Import ist ein Fehler aufgetreten:\n{nachricht[1]}"
                    )
                    return
        except queue.Empty:
            pass
        self.after(80, self._import_poll, fenster, fortschritt_var, status_var, out_queue)

    def _import_abgeschlossen(self, ergebnis):
        self.refresh_moods()
        self._refresh_aktuelle_ansicht()

        text = (
            f"{ergebnis['added']} Titel importiert, "
            f"{ergebnis['skipped']} bereits vorhanden."
        )
        if ergebnis["ignoriert"]:
            text += (
                f"\n{ergebnis['ignoriert']} Datei(en) übersprungen - "
                "keine gültige Audiodatei (falsche Endung, beschädigt o.ä.)."
            )
        if ergebnis["album_fixed"]:
            text += (
                f"\n{ergebnis['album_fixed']} davon hatten eine Stimmung im Album-Feld "
                "- automatisch korrigiert."
            )
        if ergebnis["genre_suggested"]:
            text += (
                f"\n{ergebnis['genre_suggested']} davon bekamen anhand des Genre-Tags "
                "einen Stimmungs-Vorschlag."
            )
        if ergebnis["chart_hits"]:
            text += (
                f"\n{ergebnis['chart_hits']} davon als Chart-Hit erkannt "
                "(Stimmung 'Charts' vergeben)."
            )
        messagebox.showinfo("Import abgeschlossen", text)

    def delete_selected(self):
        song_ids = self.selected_song_ids
        if not song_ids:
            messagebox.showwarning(
                "Keine Auswahl", "Bitte mindestens einen Titel in der Liste auswählen."
            )
            return

        platzhalter = ",".join("?" * len(song_ids))
        with db.connect(self.db_path) as conn:
            rows = conn.execute(
                f"SELECT title FROM songs WHERE id IN ({platzhalter})", song_ids
            ).fetchall()
        titel_namen = [r["title"] for r in rows]
        if not titel_namen:
            return

        if len(titel_namen) > 15:
            vorschau = "\n".join(f"- {t}" for t in titel_namen[:15])
            vorschau += f"\n… und {len(titel_namen) - 15} weitere"
        else:
            vorschau = "\n".join(f"- {t}" for t in titel_namen)

        frage = (
            f"{len(titel_namen)} Titel wirklich aus dem Archiv löschen?\n\n{vorschau}\n\n"
            "Die Musikdateien auf der Festplatte bleiben unangetastet - nur der "
            "Eintrag im Musikarchiv wird entfernt."
        )
        if not messagebox.askyesno("Titel löschen", frage):
            return

        with db.connect(self.db_path) as conn:
            conn.executemany(
                "DELETE FROM songs WHERE id = ?", [(sid,) for sid in song_ids]
            )

        self.refresh_moods()
        self.refresh_songs()
        self._clear_detail()
        self.status_var.set(f"{len(titel_namen)} Titel gelöscht")

    def fix_album_moods(self):
        with db.connect(self.db_path) as conn:
            aenderungen = moods.fix_existing_album_moods(conn)
        self.refresh_moods()
        self._refresh_aktuelle_ansicht()
        if not aenderungen:
            messagebox.showinfo(
                "Nichts zu korrigieren", "Keine Titel mit einer Stimmung im Album-Feld gefunden."
            )
            return
        details = "\n".join(f"- '{titel}' -> {stimmung}" for _, titel, stimmung in aenderungen)
        messagebox.showinfo(
            "Korrektur abgeschlossen", f"{len(aenderungen)} Titel korrigiert:\n{details}"
        )

    def tag_chart_hits(self):
        with db.connect(self.db_path) as conn:
            betroffen = moods.tag_existing_chart_hits(conn)
        self.refresh_moods()
        self._refresh_aktuelle_ansicht()
        if not betroffen:
            messagebox.showinfo(
                "Nichts gefunden",
                "Keine Titel mit Chart-Hinweis im Album-Feld gefunden (oder bereits markiert).",
            )
            return
        titel_liste = "\n".join(f"- {titel}" for _, titel in betroffen)
        messagebox.showinfo(
            "Chart-Hits markiert", f"{len(betroffen)} Titel als 'Charts' markiert:\n{titel_liste}"
        )

    def suggest_mood(self):
        if self.selected_song_id is None:
            messagebox.showwarning("Kein Titel ausgewählt", "Bitte zuerst einen Titel in der Liste wählen.")
            return
        vorschlaege = moods.suggest_moods_for_genre(self.detail_genre)
        if not vorschlaege:
            messagebox.showinfo(
                "Kein Vorschlag möglich",
                "Für dieses Genre gibt es keine Zuordnung "
                f"(Genre: {self.detail_genre or 'unbekannt'}).\n"
                "Bitte die Stimmung manuell eintragen.",
            )
            return
        with db.connect(self.db_path) as conn:
            for mood_name in vorschlaege:
                moods.assign_mood(conn, self.selected_song_id, mood_name)
        self.refresh_moods()
        self.refresh_songs()
        self.on_select_song()

    # ----------------------------------------------------------- Wiedergabe
    def play_selected(self):
        if self.selected_song_id is None:
            messagebox.showwarning("Kein Titel ausgewählt", "Bitte zuerst einen Titel in der Liste wählen.")
            return
        mixer = _get_mixer()
        if mixer is None:
            messagebox.showerror(
                "Wiedergabe nicht verfügbar",
                "Für die Wiedergabe wird die Bibliothek 'pygame' benötigt.\n"
                "Bitte 'pip install -r requirements.txt' ausführen.",
            )
            return
        filepath = self.detail_path_var.get()
        if not filepath or not Path(filepath).exists():
            messagebox.showerror("Datei fehlt", "Die Audiodatei wurde auf der Festplatte nicht gefunden.")
            return
        try:
            mixer.music.stop()
            mixer.music.load(filepath)
            mixer.music.play()
            self.playback_status_var.set(f"▶ Spielt: {self.detail_title_var.get()}")
        except Exception as exc:
            self.playback_status_var.set("")
            messagebox.showerror(
                "Wiedergabe fehlgeschlagen",
                f"Konnte die Datei nicht abspielen (Format evtl. nicht unterstützt):\n{exc}",
            )

    def stop_playback(self):
        mixer = _get_mixer()
        if mixer is not None:
            mixer.music.stop()
        self.playback_status_var.set("")

    def add_mood(self):
        if self.selected_song_id is None:
            messagebox.showwarning("Kein Titel ausgewählt", "Bitte zuerst einen Titel in der Liste wählen.")
            return
        mood_name = self.new_mood_var.get().strip()
        if not mood_name:
            return
        with db.connect(self.db_path) as conn:
            conn.execute("INSERT OR IGNORE INTO moods (name) VALUES (?)", (mood_name,))
            mood = conn.execute("SELECT id FROM moods WHERE name = ?", (mood_name,)).fetchone()
            conn.execute(
                "INSERT OR IGNORE INTO song_moods (song_id, mood_id) VALUES (?, ?)",
                (self.selected_song_id, mood["id"]),
            )
        self.new_mood_var.set("")
        self.refresh_moods()
        self.refresh_songs()
        self.on_select_song()

    def remove_mood(self):
        if self.selected_song_id is None:
            return
        selection = self.mood_listbox.curselection()
        if not selection:
            messagebox.showwarning(
                "Keine Stimmung ausgewählt", "Bitte zuerst eine Stimmung in der Liste markieren."
            )
            return
        mood_name = self.mood_listbox.get(selection[0])
        with db.connect(self.db_path) as conn:
            conn.execute(
                """DELETE FROM song_moods WHERE song_id = ? AND mood_id = (
                       SELECT id FROM moods WHERE name = ?
                   )""",
                (self.selected_song_id, mood_name),
            )
        self.refresh_songs()
        self.on_select_song()

    def organize_now(self):
        ziel = filedialog.askdirectory(title="Zielordner für die Sortierung wählen")
        if not ziel:
            return
        by = self.organize_by_var.get()
        action = self.organize_action_var.get()
        with db.connect(self.db_path) as conn:
            results = organizer.organize(conn, Path(ziel), by=by, action=action)
        ok = sum(1 for _, _, status in results if status == "ok")
        fehler = [r for r in results if r[2] != "ok"]
        text = f"{ok} Datei(en) einsortiert nach:\n{ziel}"
        if fehler:
            text += "\n\nFehler:\n" + "\n".join(
                f"- {song['title']}: {status}" for song, _, status in fehler
            )
        messagebox.showinfo("Sortierung abgeschlossen", text)


def _format_dauer(duration_sec):
    if not duration_sec:
        return ""
    minuten, sekunden = divmod(int(duration_sec), 60)
    return f"{minuten}:{sekunden:02d}"


def main():
    app = MusikArchivApp()
    app.mainloop()


if __name__ == "__main__":
    main()
