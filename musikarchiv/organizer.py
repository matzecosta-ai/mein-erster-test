import shutil
from pathlib import Path

INVALID_CHARS = '<>:"/\\|?*'


def sanitize(name: str) -> str:
    cleaned = "".join(c for c in name if c not in INVALID_CHARS).strip()
    return cleaned or "Unbekannt"


def _mood_names(conn, song_id):
    rows = conn.execute(
        """SELECT m.name FROM moods m
           JOIN song_moods sm ON sm.mood_id = m.id
           WHERE sm.song_id = ?
           ORDER BY m.name""",
        (song_id,),
    ).fetchall()
    return [r["name"] for r in rows]


def _folders_for(conn, song, by):
    if by == "artist":
        return [song["artist"] or "Unbekannter Interpret"]
    if by == "mood":
        return _mood_names(conn, song["id"]) or ["Ohne Stimmung"]
    if by == "mood-artist":
        artist = song["artist"] or "Unbekannter Interpret"
        moods = _mood_names(conn, song["id"]) or ["Ohne Stimmung"]
        return [f"{mood}/{artist}" for mood in moods]
    raise ValueError(f"Unbekannte Sortierung: {by}")


def _place(src: Path, dest: Path, action: str):
    if dest.exists():
        return
    if action == "copy":
        shutil.copy2(src, dest)
    elif action == "move":
        shutil.move(str(src), str(dest))
    elif action == "link":
        dest.symlink_to(src.resolve())
    else:
        raise ValueError(f"Unbekannte Aktion: {action}")


def organize(conn, target_dir: Path, by="mood", action="copy"):
    """Legt Musikdateien in einer Ordnerstruktur unter target_dir ab.

    Gibt eine Liste von (song, zielpfad_oder_None, status) zurück.
    """
    target_dir = Path(target_dir)
    songs = conn.execute("SELECT * FROM songs").fetchall()
    results = []

    for song in songs:
        src = Path(song["filepath"])
        if not src.exists():
            results.append((song, None, "Datei nicht gefunden"))
            continue

        for folder_name in _folders_for(conn, song, by):
            dest_dir = target_dir
            for part in folder_name.split("/"):
                dest_dir = dest_dir / sanitize(part)
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / src.name
            _place(src, dest, action)
            results.append((song, dest, "ok"))

    return results
