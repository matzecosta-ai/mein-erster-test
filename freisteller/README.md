# Freisteller

Stellt ganze Videoclips frei und speichert sie mit Alphakanal, fertig für DaVinci Resolve, Premiere oder After Effects.
Alles läuft auf deinem PC, ohne Upload und ohne Kosten.

## Was rauskommt

Für jeden Clip ein Ordner `<Clip>_freigestellt` mit:

| Datei | Inhalt |
|---|---|
| `<Clip>_alpha.mov` | **ProRes 4444 mit Alphakanal**, Originalauflösung, Bildrate, Farbraum und Ton |
| `<Clip>_matte.mov` | optional: die Maske als Schwarzweiß-Clip (für eigene Keys oder Korrekturen) |
| `<Clip>_png\` | optional: 16-Bit-PNG-Sequenz mit Alpha |

## Voraussetzungen

- Windows 10/11 mit **NVIDIA-Grafikkarte** (ab ca. 8 GB Grafikspeicher für „Maximale Qualität“). Ohne NVIDIA läuft es auch, aber sehr langsam.
- **Python 3.12** von [python.org](https://www.python.org/downloads/). Beim Installieren „Add python.exe to PATH“ anhaken.

## Benutzung

1. Den Ordner `freisteller` auf den PC kopieren.
2. Doppelklick auf **`Freisteller starten.bat`**. Beim ersten Start wird alles eingerichtet (einige Minuten, ca. 3 GB).
   Beim ersten Freistellen wird außerdem einmalig das KI-Modell geladen (ca. 1 GB).
3. Im Fenster Clips hinzufügen, Einstellungen wählen und auf **Freistellen** klicken.

Alternativ Clips oder einen ganzen Ordner direkt auf `Freisteller starten.bat` ziehen, dann läuft es ohne Fenster mit maximaler Qualität.

## Einstellungen

- **Maximale Qualität (2048)**: Modell *BiRefNet_HR-matting*, für Haare, Fell und feine Details. Empfohlen.
- **Schneller (1024)**: Modell *BiRefNet-matting*, etwa 3- bis 4-mal schneller, etwas weniger Detail.
- **Flackern glätten**: Wo sich im Bild nichts bewegt, wird die Maske mit dem vorigen Bild abgeglichen. Das verhindert zitternde Kanten, ohne bei Bewegung nachzuziehen.
- **Farbsaum an Kanten entfernen**: Rechnet den alten Hintergrund aus halbtransparenten Kanten heraus (kein grüner oder heller Rand an Haaren auf dem neuen Hintergrund).

Bei Clips größer als 2048 Pixel (z. B. 4K) werden die Kanten zusätzlich mit dem Originalbild nachgeschärft.

## In DaVinci Resolve

Den `_alpha.mov` in den Media Pool ziehen. Resolve erkennt den Alphakanal normalerweise selbst.
Falls der Hintergrund schwarz statt transparent ist: Rechtsklick auf den Clip > **Clip Attributes** > **Alpha Mode: Straight**.

Die Farben bleiben wie im Original (10-Bit, Farbraum wird übernommen, auch HDR/HLG von Handys).

## Kommandozeile

```
.venv\Scripts\python freisteller.py clip.mp4 ordner_mit_clips --ziel D:\Freigestellt --matte --png
```

Weitere Schalter: `--schnell`, `--keine-glaettung`, `--keine-farbsaeuberung`.
