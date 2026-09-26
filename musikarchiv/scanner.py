import re
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


def _load_mutagen(filepath):
    if not HAS_MUTAGEN:
        return None
    try:
        return MutagenFile(filepath, easy=True)
    except Exception:
        return None


def is_valid_audio(filepath: Path) -> bool:
    """Prueft, ob es sich wirklich um eine lesbare Audiodatei handelt (nicht
    nur um eine Datei mit passender Dateiendung). Ohne installiertes
    'mutagen' kann das nicht geprueft werden - dann gilt jede Datei mit
    passender Endung als gueltig, wie bisher."""
    if not HAS_MUTAGEN:
        return True
    audio = _load_mutagen(filepath)
    return audio is not None and getattr(audio, "info", None) is not None


_YEAR_RE = re.compile(r"(\d{4})")


def _extract_year(date_text):
    if not date_text:
        return None
    match = _YEAR_RE.search(date_text)
    if not match:
        return None
    year = int(match.group(1))
    return year if 1000 <= year <= 9999 else None


_TRACKNUMMER_RE = re.compile(r"^\s*\(?\[?(\d{1,3})\)?\]?(?P<sep>[\s._-]+)")


def strip_track_number(title):
    """Entfernt eine vorangestellte Titelnummer wie "01 ", "007. " oder
    "3 - " vom Titel. Um echte Titel wie "50 Cent" oder "1979" nicht zu
    verstuemmeln, wird nur gekuerzt, wenn die Nummer fuehrende Nullen hat
    (fast immer eine Titelnummer) oder ein eindeutiges Trennzeichen
    (Punkt/Bindestrich/Unterstrich) folgt - ein einzelnes Leerzeichen nach
    einer nicht-nullgepolsterten Zahl reicht dagegen nicht."""
    if not title:
        return title
    match = _TRACKNUMMER_RE.match(title)
    if not match:
        return title

    nummer = match.group(1)
    trenner = match.group("sep")
    rest = title[match.end():].strip()
    if not rest:
        return title

    fuehrende_null = len(nummer) > 1 and nummer[0] == "0"
    eindeutiges_trennzeichen = any(c in trenner for c in ".-_()[]")
    if fuehrende_null or eindeutiges_trennzeichen:
        return rest
    return title


def read_tags(filepath: Path):
    """Liest Titel/Interpret/Album/Genre/Jahr/Dauer aus den Metadaten;
    fällt auf den (bereinigten) Dateinamen zurück, falls mutagen fehlt
    oder die Datei keine Tags hat."""
    title = filepath.stem
    artist = None
    album = None
    genre = None
    year = None
    duration_sec = None

    audio = _load_mutagen(filepath)
    if audio is not None:
        if audio.tags:
            title = _first(audio.tags.get("title")) or title
            artist = _first(audio.tags.get("artist"))
            album = _first(audio.tags.get("album"))
            genre = _first(audio.tags.get("genre"))
            year = _extract_year(_first(audio.tags.get("date")))
        if audio.info is not None and hasattr(audio.info, "length"):
            duration_sec = int(audio.info.length)

    title = strip_track_number(title)

    return {
        "title": title,
        "artist": artist,
        "album": album,
        "genre": genre,
        "year": year,
        "duration_sec": duration_sec,
    }


def find_audio_files(directory: Path):
    directory = Path(directory)
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
            yield path
