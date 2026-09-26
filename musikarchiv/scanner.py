from pathlib import Path

AUDIO_EXTENSIONS = {".mp3", ".flac", ".wav", ".m4a", ".ogg", ".wma", ".aac"}

try:
    from mutagen import File as MutagenFile

    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False


def _first(values):
    if not values:
        return None
    return str(values[0])


def read_tags(filepath: Path):
    """Liest Titel/Interpret/Album/Dauer aus den Metadaten; fällt auf den
    Dateinamen zurück, falls mutagen fehlt oder die Datei keine Tags hat."""
    title = filepath.stem
    artist = None
    album = None
    duration_sec = None

    if HAS_MUTAGEN:
        try:
            audio = MutagenFile(filepath, easy=True)
            if audio is not None:
                if audio.tags:
                    title = _first(audio.tags.get("title")) or title
                    artist = _first(audio.tags.get("artist"))
                    album = _first(audio.tags.get("album"))
                if audio.info is not None and hasattr(audio.info, "length"):
                    duration_sec = int(audio.info.length)
        except Exception:
            pass

    return {
        "title": title,
        "artist": artist,
        "album": album,
        "duration_sec": duration_sec,
    }


def find_audio_files(directory: Path):
    directory = Path(directory)
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
            yield path
