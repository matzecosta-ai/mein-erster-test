import sqlite3
from contextlib import contextmanager
from pathlib import Path

DEFAULT_DB_PATH = Path.home() / ".musikarchiv" / "musikarchiv.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    album TEXT,
    genre TEXT,
    year INTEGER,
    filepath TEXT UNIQUE NOT NULL,
    duration_sec INTEGER,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS moods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS song_moods (
    song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    mood_id INTEGER NOT NULL REFERENCES moods(id) ON DELETE CASCADE,
    PRIMARY KEY (song_id, mood_id)
);
"""


def _migrate(conn):
    """Ergaenzt Spalten, die in frueheren Versionen der Datenbank noch fehlen."""
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(songs)").fetchall()}
    if "genre" not in columns:
        conn.execute("ALTER TABLE songs ADD COLUMN genre TEXT")
    if "year" not in columns:
        conn.execute("ALTER TABLE songs ADD COLUMN year INTEGER")


@contextmanager
def connect(db_path=DEFAULT_DB_PATH):
    db_path = Path(db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
        yield conn
        conn.commit()
    finally:
        conn.close()
