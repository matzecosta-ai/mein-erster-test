import struct
import wave

import pytest

from musikarchiv import scanner


def _make_wav(path, name="lied.wav"):
    f = path / name
    with wave.open(str(f), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(struct.pack("<10h", *([0] * 10)))
    return f


@pytest.mark.skipif(not scanner.HAS_MUTAGEN, reason="mutagen nicht installiert")
def test_is_valid_audio_erkennt_echte_und_falsche_dateien(tmp_path):
    echte_datei = _make_wav(tmp_path)
    assert scanner.is_valid_audio(echte_datei) is True

    fake_datei = tmp_path / "fake.mp3"
    fake_datei.write_text("Das hier ist nur Text, keine Musik.")
    assert scanner.is_valid_audio(fake_datei) is False

    leere_datei = tmp_path / "leer.wav"
    leere_datei.write_bytes(b"")
    assert scanner.is_valid_audio(leere_datei) is False


@pytest.mark.parametrize(
    "eingabe,erwartet",
    [
        ("01 Sonnenschein", "Sonnenschein"),
        ("007 Agentenlied", "Agentenlied"),
        ("03. Titelname", "Titelname"),
        ("3 - Titelname", "Titelname"),
        ("(02) Titelname", "Titelname"),
        ("50 Cent Style", "50 Cent Style"),  # keine fuehrende Null, kein klares Trennzeichen
        ("1979", "1979"),  # nichts wuerde uebrig bleiben - Original behalten
        ("24K Magic", "24K Magic"),  # keine Zahl gefolgt von Trennzeichen
        ("", ""),
        (None, None),
    ],
)
def test_strip_track_number(eingabe, erwartet):
    assert scanner.strip_track_number(eingabe) == erwartet


def test_extract_year_liest_jahr_aus_datumsfeld():
    assert scanner._extract_year("2005") == 2005
    assert scanner._extract_year("2005-06-01T00:00:00") == 2005
    assert scanner._extract_year("") is None
    assert scanner._extract_year(None) is None
    assert scanner._extract_year("keine Zahl hier") is None


@pytest.mark.skipif(not scanner.HAS_MUTAGEN, reason="mutagen nicht installiert")
def test_read_tags_bereinigt_titel_aus_dateinamen(tmp_path):
    datei = _make_wav(tmp_path, "01 Sonnenschein.wav")
    tags = scanner.read_tags(datei)
    assert tags["title"] == "Sonnenschein"
