"""Grafische Oberfläche für das Musikarchiv (ein einziges Fenster)."""

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from . import db, organizer, scanner

ICON_PATH = Path(__file__).resolve().parent.parent / "icon.ico"
ALLE_STIMMUNGEN = "(alle Stimmungen)"


class MusikArchivApp(tk.Tk):
    def __init__(self, db_path=db.DEFAULT_DB_PATH):
        super().__init__()
        self.db_path = db_path
        self.title("Musikarchiv")
        self.geometry("1100x650")
        self.minsize(850, 500)
        try:
            self.iconbitmap(str(ICON_PATH))
        except Exception:
            pass

        self.selected_song_id = None
        self._build_widgets()
        self.refresh_moods()
        self.refresh_songs()

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
            side="left", padx=(0, 16)
        )

        ttk.Label(toolbar, text="Suche:").pack(side="left")
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *_: self.refresh_songs())
        search_entry = ttk.Entry(toolbar, textvariable=self.search_var, width=30)
        search_entry.pack(side="left", padx=(4, 16))
        search_entry.focus_set()

        ttk.Label(toolbar, text="Stimmung:").pack(side="left")
        self.mood_filter_var = tk.StringVar(value=ALLE_STIMMUNGEN)
        self.mood_filter_box = ttk.Combobox(
            toolbar, textvariable=self.mood_filter_var, state="readonly", width=20
        )
        self.mood_filter_box.pack(side="left", padx=(4, 0))
        self.mood_filter_box.bind("<<ComboboxSelected>>", lambda *_: self.refresh_songs())

        self.status_var = tk.StringVar(value="")
        ttk.Label(toolbar, textvariable=self.status_var, foreground="#555").pack(
            side="right"
        )

        main = ttk.Panedwindow(self, orient="horizontal")
        main.pack(side="top", fill="both", expand=True, padx=8, pady=(0, 8))

        # --- Liste ---
        list_frame = ttk.Frame(main)
        columns = ("titel", "interpret", "album", "dauer", "stimmungen")
        self.tree = ttk.Treeview(list_frame, columns=columns, show="headings", selectmode="browse")
        headings = {
            "titel": ("Titel", 220),
            "interpret": ("Interpret", 150),
            "album": ("Album", 150),
            "dauer": ("Dauer", 70),
            "stimmungen": ("Stimmungen", 220),
        }
        for col, (label, width) in headings.items():
            self.tree.heading(col, text=label)
            self.tree.column(col, width=width, anchor="w")
        vsb = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=vsb.set)
        self.tree.pack(side="left", fill="both", expand=True)
        vsb.pack(side="right", fill="y")
        self.tree.bind("<<TreeviewSelect>>", self.on_select_song)
        main.add(list_frame, weight=3)

        # --- Detailbereich ---
        detail_frame = ttk.Frame(main, padding=10)
        main.add(detail_frame, weight=1)

        ttk.Label(detail_frame, text="Ausgewählter Titel", font=("", 11, "bold")).pack(
            anchor="w"
        )
        self.detail_title_var = tk.StringVar(value="–")
        self.detail_artist_var = tk.StringVar(value="")
        self.detail_album_var = tk.StringVar(value="")
        self.detail_path_var = tk.StringVar(value="")
        ttk.Label(detail_frame, textvariable=self.detail_title_var, font=("", 10, "bold")).pack(
            anchor="w", pady=(6, 0)
        )
        ttk.Label(detail_frame, textvariable=self.detail_artist_var).pack(anchor="w")
        ttk.Label(detail_frame, textvariable=self.detail_album_var).pack(anchor="w")
        ttk.Label(
            detail_frame, textvariable=self.detail_path_var, wraplength=260, foreground="#666"
        ).pack(anchor="w", pady=(4, 12))

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
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " GROUP BY s.id ORDER BY s.title"

        with db.connect(self.db_path) as conn:
            rows = conn.execute(query, params).fetchall()

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
                    row["album"] or "",
                    dauer,
                    row["moods"] or "",
                ),
            )

        self.status_var.set(f"{len(rows)} Titel angezeigt")
        if self.selected_song_id is not None and str(self.selected_song_id) in self.tree.get_children():
            # Neuaufbau der Liste loescht die Treeview-Auswahl technisch;
            # hier wird sie wiederhergestellt, damit das Detailpanel bestehen bleibt.
            self.tree.selection_set(str(self.selected_song_id))
        else:
            self._clear_detail()

    def on_select_song(self, _event=None):
        selection = self.tree.selection()
        if not selection:
            self._clear_detail()
            return
        song_id = int(selection[0])
        self.selected_song_id = song_id
        with db.connect(self.db_path) as conn:
            song = conn.execute("SELECT * FROM songs WHERE id = ?", (song_id,)).fetchone()
            if song is None:
                self._clear_detail()
                return
            moods = organizer._mood_names(conn, song_id)

        self.detail_title_var.set(song["title"])
        self.detail_artist_var.set(song["artist"] or "Interpret unbekannt")
        self.detail_album_var.set(song["album"] or "")
        self.detail_path_var.set(song["filepath"])
        self.mood_listbox.delete(0, "end")
        for mood in moods:
            self.mood_listbox.insert("end", mood)

    def _clear_detail(self):
        self.selected_song_id = None
        self.detail_title_var.set("–")
        self.detail_artist_var.set("")
        self.detail_album_var.set("")
        self.detail_path_var.set("")
        self.mood_listbox.delete(0, "end")

    # ------------------------------------------------------------ Aktionen
    def import_folder(self):
        ordner = filedialog.askdirectory(title="Musik-Ordner wählen")
        if not ordner:
            return
        added, skipped = 0, 0
        with db.connect(self.db_path) as conn:
            for filepath in scanner.find_audio_files(Path(ordner)):
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
        self.refresh_moods()
        self.refresh_songs()
        messagebox.showinfo(
            "Import abgeschlossen", f"{added} Titel importiert, {skipped} bereits vorhanden."
        )

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
