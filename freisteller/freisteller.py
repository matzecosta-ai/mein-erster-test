"""
Freisteller: stellt ganze Videoclips frei und schreibt sie mit Alphakanal
(ProRes 4444) für DaVinci Resolve, Premiere, After Effects usw.

Freistellung: BiRefNet-Matting (KI-Modell, MIT-Lizenz), Bild für Bild auf der
Grafikkarte, plus
  - Kantenverfeinerung bei Clips, die größer sind als die Modellauflösung,
  - zeitliche Glättung gegen Flackern der Maske,
  - Farbsäuberung der Kanten (kein grüner/heller Saum vom alten Hintergrund).

Start ohne Argumente öffnet das Fenster. Kommandozeile:
  python freisteller.py clip1.mp4 clip2.mov [--ziel ORDNER] [--schnell]
         [--keine-glaettung] [--keine-farbsaeuberung] [--matte] [--png]
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from fractions import Fraction
from pathlib import Path

import numpy as np

MODELLE = {
    "maximal": ("ZhengPeng7/BiRefNet_HR-matting", 2048),
    "schnell": ("ZhengPeng7/BiRefNet-matting", 1024),
}

VIDEO_ENDUNGEN = {".mp4", ".mov", ".mkv", ".avi", ".mxf", ".m4v", ".webm", ".mts", ".m2ts", ".mpg", ".mpeg", ".wmv"}


# --------------------------------------------------------------------------
# ffmpeg
# --------------------------------------------------------------------------

def ffmpeg_exe() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


_NO_WINDOW = 0x08000000 if os.name == "nt" else 0  # kein schwarzes Konsolenfenster pro ffmpeg


@dataclass
class ClipInfo:
    breite: int
    hoehe: int
    fps: Fraction
    frames: int
    matrix: str      # für swscale: bt709 / bt601 / bt2020
    bereich: str     # tv / pc
    primaries: str
    trc: str
    colorspace_tag: str


_FPS_STANDARDS = [Fraction(24000, 1001), Fraction(30000, 1001), Fraction(60000, 1001),
                  Fraction(120000, 1001), Fraction(24), Fraction(25), Fraction(30),
                  Fraction(48), Fraction(50), Fraction(60), Fraction(100), Fraction(120)]


def _fps_aus_text(wert: str) -> Fraction:
    f = float(wert.rstrip("k")) * (1000 if wert.endswith("k") else 1)
    for s in _FPS_STANDARDS:
        if abs(float(s) - f) < 0.006:
            return s
    return Fraction(f).limit_denominator(1001)


def clip_analysieren(pfad: Path) -> ClipInfo:
    cmd = [ffmpeg_exe(), "-hide_banner", "-i", str(pfad), "-map", "0:v:0", "-frames:v", "1",
           "-pix_fmt", "rgb48le", "-f", "null", "-"]
    out = subprocess.run(cmd, capture_output=True, text=True, errors="replace",
                         creationflags=_NO_WINDOW).stderr
    if "Output #0" not in out:
        raise RuntimeError(f"Kein Video gefunden in {pfad.name}:\n{out[-800:]}")
    eingang, ausgang = out.split("Output #0", 1)

    vline = next((l for l in eingang.splitlines() if "Video:" in l), "")
    m = re.search(r",\s*(\d+)x(\d+)", next(l for l in ausgang.splitlines() if "Video:" in l))
    breite, hoehe = int(m.group(1)), int(m.group(2))

    m = re.search(r"([\d.]+k?) fps", vline) or re.search(r"([\d.]+k?) tbr", vline)
    fps = _fps_aus_text(m.group(1)) if m else Fraction(25)

    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", eingang)
    dauer = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3)) if m else 0.0
    frames = max(1, round(dauer * float(fps)))

    # Farbinfo, z. B. "yuv420p(tv, bt709, progressive)" oder "yuv420p10le(tv, bt2020nc/bt2020/arib-std-b67)"
    bereich, cs, prim, trc = "tv", "", "", ""
    m = re.search(r"Video: [^,]+?,\s*\w+\(([^)]*)\)", vline)
    if m:
        teile = [t.strip() for t in m.group(1).split(",")]
        if "pc" in teile:
            bereich = "pc"
        for t in teile:
            if "/" in t:
                cs, prim, trc = (t.split("/") + ["", ""])[:3]
            elif t.startswith(("bt", "smpte", "fcc")):
                cs = prim = trc = t
    if not cs or cs in ("unknown", "reserved"):
        cs = "bt709" if hoehe >= 720 or breite >= 1280 else "smpte170m"
    standard = "bt709" if cs == "bt709" else ("bt2020" if cs.startswith("bt2020") else "smpte170m")
    if not prim or prim in ("unknown", "reserved"):
        prim = standard
    if not trc or trc in ("unknown", "reserved"):
        trc = "bt709" if standard == "bt2020" else standard
    if cs.startswith("bt2020"):
        matrix = "bt2020"
    elif cs in ("bt470bg", "smpte170m", "bt601"):
        matrix = "bt601"
    else:
        matrix = "bt709"
    return ClipInfo(breite, hoehe, fps, frames, matrix, bereich, prim, trc, cs)


def _leser(pfad: Path, info: ClipInfo) -> subprocess.Popen:
    cmd = [ffmpeg_exe(), "-v", "error", "-i", str(pfad), "-map", "0:v:0",
           "-vf", f"scale=in_color_matrix={info.matrix}:in_range={info.bereich}:flags=accurate_rnd+full_chroma_int,format=rgb48le",
           "-fps_mode", "cfr", "-r", str(info.fps),
           "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            bufsize=info.breite * info.hoehe * 6 * 2, creationflags=_NO_WINDOW)


_PRORES_ERLAUBT = {
    "color_primaries": {"bt709", "bt470bg", "smpte170m", "bt2020", "smpte431", "smpte432"},
    "color_trc": {"bt709", "smpte2084", "arib-std-b67"},
    "colorspace": {"bt709", "smpte170m", "bt2020nc"},
}


def _farbtags(info: ClipInfo) -> list[str]:
    """Farbraum-Kennzeichnung, damit Resolve den Clip richtig interpretiert.
    ProRes speichert sie im Bild-Header, dafür braucht es den prores_metadata-Filter."""
    werte = {"color_primaries": info.primaries, "color_trc": info.trc,
             "colorspace": "smpte170m" if info.colorspace_tag == "bt470bg" else info.colorspace_tag}
    tags = ["-color_range", "tv"]
    bsf = []
    for name, wert in werte.items():
        if wert in _PRORES_ERLAUBT[name]:
            tags += [f"-{name}", wert]
            bsf.append(f"{name}={wert}")
    if bsf:
        tags += ["-bsf:v", "prores_metadata=" + ":".join(bsf)]
    return tags


def _schreiber(ziel: Path, info: ClipInfo, art: str, quelle: Path | None = None) -> subprocess.Popen:
    groesse = f"{info.breite}x{info.hoehe}"
    if art == "alpha":
        cmd = [ffmpeg_exe(), "-y", "-v", "error",
               "-f", "rawvideo", "-pix_fmt", "rgba64le", "-s", groesse, "-r", str(info.fps), "-i", "-"]
        if quelle is not None:
            cmd += ["-i", str(quelle), "-map", "0:v", "-map", "1:a:0?", "-c:a", "pcm_s24le", "-shortest"]
        cmd += ["-vf", f"scale=out_color_matrix={info.matrix}:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuva444p12le",
                "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le",
                "-alpha_bits", "16", "-vendor", "apl0", "-qscale:v", "4"]
        cmd += _farbtags(info) + [str(ziel)]
    elif art == "matte":
        cmd = [ffmpeg_exe(), "-y", "-v", "error",
               "-f", "rawvideo", "-pix_fmt", "gray16le", "-s", groesse, "-r", str(info.fps), "-i", "-",
               "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv444p10le",
               "-c:v", "prores_ks", "-profile:v", "4444", "-vendor", "apl0", "-qscale:v", "2",
               "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
               "-bsf:v", "prores_metadata=color_primaries=bt709:color_trc=bt709:colorspace=bt709", str(ziel)]
    elif art == "png":
        ziel.mkdir(parents=True, exist_ok=True)
        cmd = [ffmpeg_exe(), "-y", "-v", "error",
               "-f", "rawvideo", "-pix_fmt", "rgba64le", "-s", groesse, "-r", str(info.fps), "-i", "-",
               "-c:v", "png", "-pix_fmt", "rgba64be", str(ziel / f"{ziel.name}_%06d.png")]
    else:
        raise ValueError(art)
    return subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE, creationflags=_NO_WINDOW)


# --------------------------------------------------------------------------
# Bildverarbeitung (alles auf der GPU, Werte 0..1, Form [1,C,H,W])
# --------------------------------------------------------------------------

def _box(x, r: int):
    """Mittelwertfilter mit Fenster (2r+1)², separierbar, Rand gespiegelt."""
    import torch.nn.functional as F
    if r <= 0:
        return x
    k = 2 * r + 1
    x = F.pad(x, (r, r, 0, 0), mode="replicate")
    x = F.avg_pool2d(x, (1, k), stride=1)
    x = F.pad(x, (0, 0, r, r), mode="replicate")
    return F.avg_pool2d(x, (k, 1), stride=1)


def _guided_filter(fuehrung, p, r: int, eps: float):
    """Guided Filter (He et al.): übernimmt Kantendetails aus dem Originalbild in die Maske."""
    mI, mp = _box(fuehrung, r), _box(p, r)
    cov = _box(fuehrung * p, r) - mI * mp
    var = _box(fuehrung * fuehrung, r) - mI * mI
    a = cov / (var + eps)
    b = mp - a * mI
    return _box(a, r) * fuehrung + _box(b, r)


def _blur_fusion(bild, F_, B_, alpha, r: int, skalierung: int = 1):
    """Ein Schritt der 'Approximate Fast Foreground Colour Estimation' (Forte & Pitié 2021)."""
    import torch.nn.functional as Fn

    def unscharf(x):
        if skalierung == 1:
            return _box(x, r)
        klein = Fn.interpolate(x, scale_factor=1 / skalierung, mode="area")
        klein = _box(klein, max(1, r // skalierung))
        return Fn.interpolate(klein, size=x.shape[-2:], mode="bilinear", align_corners=False)

    ua = unscharf(alpha)
    uF = unscharf(F_ * alpha) / (ua + 1e-5)
    uB = unscharf(B_ * (1 - alpha)) / ((1 - ua) + 1e-5)
    F_neu = (uF + alpha * (bild - alpha * uF - (1 - alpha) * uB)).clamp(0, 1)
    return F_neu, uB


def vordergrund_farben(bild, alpha):
    """Entfernt den Farbsaum des alten Hintergrunds aus halbtransparenten Kanten (Haare usw.)."""
    kurz = min(bild.shape[-2:])
    r1 = max(8, round(90 * kurz / 1080))
    F_, uB = _blur_fusion(bild, bild, bild, alpha, r1, skalierung=4)
    F_, _ = _blur_fusion(bild, F_, uB, alpha, max(2, round(6 * kurz / 1080)))
    return F_


# --------------------------------------------------------------------------
# Freisteller
# --------------------------------------------------------------------------

@dataclass
class Optionen:
    qualitaet: str = "maximal"
    glaettung: bool = True
    farbsaeuberung: bool = True
    matte: bool = False
    png: bool = False
    ziel: Path | None = None


@dataclass
class Fortschritt:
    melde: callable = field(default=lambda text: print(text, flush=True))
    prozent: callable = field(default=lambda clip, frame, gesamt: None)
    abbrechen: threading.Event = field(default_factory=threading.Event)


class Freisteller:
    def __init__(self, qualitaet: str = "maximal", melde=print):
        import torch
        from transformers import AutoModelForImageSegmentation

        self.torch = torch
        repo, self.aufloesung = MODELLE[qualitaet]
        if torch.cuda.is_available():
            self.geraet = torch.device("cuda")
            melde(f"Grafikkarte: {torch.cuda.get_device_name(0)}")
        else:
            self.geraet = torch.device("cpu")
            melde("WARNUNG: Keine NVIDIA-Grafikkarte gefunden, es läuft auf dem Prozessor (sehr langsam).")
        self.halb = self.geraet.type == "cuda"

        melde(f"Lade Modell {repo} (beim ersten Mal wird es heruntergeladen, ca. 1 GB) ...")
        torch.set_float32_matmul_precision("high")
        self.modell = AutoModelForImageSegmentation.from_pretrained(repo, trust_remote_code=True)
        self.modell.to(self.geraet).eval()
        if self.halb:
            self.modell.half()
        self.mittel = torch.tensor([0.485, 0.456, 0.406], device=self.geraet).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225], device=self.geraet).view(1, 3, 1, 1)

    def maske(self, bild):
        """bild: [1,3,H,W] float32 0..1 auf dem Gerät -> Alpha [1,1,H,W]."""
        F = self.torch.nn.functional
        h, w = bild.shape[-2:]
        n = self.aufloesung
        x = F.interpolate(bild, size=(n, n), mode="bicubic", align_corners=False, antialias=True).clamp(0, 1)
        x = (x - self.mittel) / self.std
        if self.halb:
            x = x.half()
        with self.torch.inference_mode():
            a = self.modell(x)[-1].sigmoid().float()
        if max(h, w) > n * 1.1:
            # Clip ist größer als die Modellauflösung: hochskalieren und mit dem
            # Originalbild als Führung die feinen Kanten (Haare) wiederherstellen.
            a = F.interpolate(a, size=(h, w), mode="bilinear", align_corners=False)
            grau = (bild * self.torch.tensor([0.299, 0.587, 0.114], device=bild.device).view(1, 3, 1, 1)).sum(1, keepdim=True)
            r = max(2, round(max(h, w) / n * 2))
            verfeinert = _guided_filter(grau, a, r, 1e-4).clamp(0, 1)
            # Nur im Kantenbereich übernehmen, damit Flächen sauber 0/1 bleiben.
            kante = ((a > 0.002) & (a < 0.998)).float()
            kante = (_box(kante, r * 2) > 0).float()
            a = a * (1 - kante) + verfeinert * kante
        else:
            a = F.interpolate(a, size=(h, w), mode="bicubic", align_corners=False, antialias=True)
        return a.clamp(0, 1)

    def clip(self, quelle: Path, opt: Optionen, fp: Fortschritt, clip_nr: int = 0) -> Path:
        torch = self.torch
        info = clip_analysieren(quelle)
        zielordner = (opt.ziel or quelle.parent) / f"{quelle.stem}_freigestellt"
        zielordner.mkdir(parents=True, exist_ok=True)
        fp.melde(f"{quelle.name}: {info.breite}x{info.hoehe}, {float(info.fps):.3f} fps, ca. {info.frames} Bilder, "
                 f"Farbraum {info.colorspace_tag} ({info.bereich})")

        leser = _leser(quelle, info)
        ausgaben = {"alpha": _schreiber(zielordner / f"{quelle.stem}_alpha.mov", info, "alpha", quelle)}
        if opt.matte:
            ausgaben["matte"] = _schreiber(zielordner / f"{quelle.stem}_matte.mov", info, "matte")
        if opt.png:
            ausgaben["png"] = _schreiber(zielordner / f"{quelle.stem}_png", info, "png")

        bytes_pro_bild = info.breite * info.hoehe * 6
        vorher_bild = vorher_alpha = None
        nr, start = 0, time.time()
        try:
            while not fp.abbrechen.is_set():
                roh = leser.stdout.read(bytes_pro_bild)
                if len(roh) < bytes_pro_bild:
                    break
                rgb16 = np.frombuffer(roh, dtype=np.uint16).reshape(info.hoehe, info.breite, 3)
                bild = torch.from_numpy(rgb16.astype(np.float32)).to(self.geraet)
                bild = (bild / 65535.0).permute(2, 0, 1).unsqueeze(0)

                a = self.maske(bild)

                if opt.glaettung and vorher_alpha is not None:
                    # Wo sich das Bild kaum bewegt, Maske mit dem Vorgänger mitteln
                    # -> kein Flackern an ruhigen Kanten, keine Verzögerung bei Bewegung.
                    diff = (bild - vorher_bild).abs().mean(1, keepdim=True)
                    diff = _box(diff, 2)
                    gewicht = (1 - diff / 0.03).clamp(0, 1) * 0.6
                    a = a * (1 - gewicht) + vorher_alpha * gewicht
                vorher_bild, vorher_alpha = bild, a

                farbe = vordergrund_farben(bild, a) if opt.farbsaeuberung else bild

                rgba = torch.cat([farbe, a], 1)[0].permute(1, 2, 0)
                rgba16 = (rgba * 65535.0 + 0.5).clamp(0, 65535).to(torch.int32).cpu().numpy().astype("<u2")
                daten = rgba16.tobytes()
                ausgaben["alpha"].stdin.write(daten)
                if "png" in ausgaben:
                    ausgaben["png"].stdin.write(daten)
                if "matte" in ausgaben:
                    ausgaben["matte"].stdin.write(np.ascontiguousarray(rgba16[..., 3]).tobytes())

                nr += 1
                fp.prozent(clip_nr, nr, info.frames)
                if nr % 25 == 0:
                    tempo = nr / (time.time() - start)
                    rest = max(0, info.frames - nr) / max(tempo, 1e-6)
                    fp.melde(f"  {nr}/{info.frames} Bilder, {tempo:.1f} Bilder/s, noch ca. {int(rest // 60)}:{int(rest % 60):02d} min")
        finally:
            leser.stdout.close()
            leser.kill()
            fehler = []
            for name, p in ausgaben.items():
                try:
                    p.stdin.close()
                except OSError:
                    pass
                if p.wait() != 0:
                    fehler.append(f"{name}: {p.stderr.read().decode(errors='replace')[-500:]}")

        if fp.abbrechen.is_set():
            fp.melde("Abgebrochen.")
        elif fehler:
            raise RuntimeError("ffmpeg-Fehler beim Schreiben:\n" + "\n".join(fehler))
        elif nr == 0:
            raise RuntimeError(f"Konnte keine Bilder lesen: {leser.stderr.read().decode(errors='replace')[-500:]}")
        else:
            fp.melde(f"Fertig: {nr} Bilder in {time.time() - start:.0f} s -> {zielordner}")
        return zielordner


def alle_clips(opt: Optionen, dateien: list[Path], fp: Fortschritt):
    fs = Freisteller(opt.qualitaet, fp.melde)
    for i, d in enumerate(dateien):
        if fp.abbrechen.is_set():
            break
        try:
            fs.clip(d, opt, fp, i)
        except Exception as e:  # weiter mit dem nächsten Clip
            fp.melde(f"FEHLER bei {d.name}: {e}")


# --------------------------------------------------------------------------
# Fenster
# --------------------------------------------------------------------------

def fenster():
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk

    root = tk.Tk()
    root.title("Freisteller – Videos mit Alphakanal")
    root.geometry("720x560")
    root.minsize(600, 460)

    dateien: list[Path] = []
    ziel = tk.StringVar(value="")
    qualitaet = tk.StringVar(value="maximal")
    glaettung = tk.BooleanVar(value=True)
    farbe = tk.BooleanVar(value=True)
    matte = tk.BooleanVar(value=False)
    png = tk.BooleanVar(value=False)
    abbruch = threading.Event()

    rahmen = ttk.Frame(root, padding=12)
    rahmen.pack(fill="both", expand=True)

    ttk.Label(rahmen, text="Clips", font=("Segoe UI", 11, "bold")).pack(anchor="w")
    liste = tk.Listbox(rahmen, height=6)
    liste.pack(fill="x")

    def hinzufuegen():
        for p in filedialog.askopenfilenames(title="Clips auswählen",
                                             filetypes=[("Videos", " ".join(f"*{e}" for e in sorted(VIDEO_ENDUNGEN))),
                                                        ("Alle Dateien", "*.*")]):
            p = Path(p)
            if p not in dateien:
                dateien.append(p)
                liste.insert("end", str(p))

    def entfernen():
        for i in reversed(liste.curselection()):
            liste.delete(i)
            del dateien[i]

    knoepfe = ttk.Frame(rahmen)
    knoepfe.pack(fill="x", pady=(4, 10))
    ttk.Button(knoepfe, text="Clips hinzufügen …", command=hinzufuegen).pack(side="left")
    ttk.Button(knoepfe, text="Auswahl entfernen", command=entfernen).pack(side="left", padx=6)

    zielzeile = ttk.Frame(rahmen)
    zielzeile.pack(fill="x")
    ttk.Label(zielzeile, text="Zielordner:").pack(side="left")
    ttk.Entry(zielzeile, textvariable=ziel).pack(side="left", fill="x", expand=True, padx=6)
    ttk.Button(zielzeile, text="…", width=3,
               command=lambda: ziel.set(filedialog.askdirectory() or ziel.get())).pack(side="left")
    ttk.Label(rahmen, text="(leer = neben dem jeweiligen Clip)", foreground="#777").pack(anchor="w")

    opts = ttk.LabelFrame(rahmen, text="Einstellungen", padding=8)
    opts.pack(fill="x", pady=10)
    ttk.Radiobutton(opts, text="Maximale Qualität (2048, für Haare und feine Details)",
                    variable=qualitaet, value="maximal").grid(row=0, column=0, columnspan=2, sticky="w")
    ttk.Radiobutton(opts, text="Schneller (1024)", variable=qualitaet, value="schnell").grid(row=1, column=0, columnspan=2, sticky="w")
    ttk.Checkbutton(opts, text="Flackern glätten", variable=glaettung).grid(row=2, column=0, sticky="w", pady=(6, 0))
    ttk.Checkbutton(opts, text="Farbsaum an Kanten entfernen", variable=farbe).grid(row=2, column=1, sticky="w", pady=(6, 0))
    ttk.Checkbutton(opts, text="Zusätzlich Maske als Schwarzweiß-Clip", variable=matte).grid(row=3, column=0, sticky="w")
    ttk.Checkbutton(opts, text="Zusätzlich 16-Bit-PNG-Sequenz", variable=png).grid(row=3, column=1, sticky="w")

    balken = ttk.Progressbar(rahmen, maximum=1000)
    balken.pack(fill="x")
    log = tk.Text(rahmen, height=8, state="disabled", wrap="word")
    log.pack(fill="both", expand=True, pady=(6, 6))

    unten = ttk.Frame(rahmen)
    unten.pack(fill="x")
    start_knopf = ttk.Button(unten, text="Freistellen")
    start_knopf.pack(side="right")
    stop_knopf = ttk.Button(unten, text="Abbrechen", state="disabled", command=abbruch.set)
    stop_knopf.pack(side="right", padx=6)

    def melde(text):
        def f():
            log.configure(state="normal")
            log.insert("end", text + "\n")
            log.see("end")
            log.configure(state="disabled")
        root.after(0, f)

    def prozent(clip, frame, gesamt):
        wert = (clip + min(frame / max(gesamt, 1), 1)) / max(len(dateien), 1) * 1000
        root.after(0, lambda: balken.configure(value=wert))

    def starten():
        if not dateien:
            messagebox.showinfo("Freisteller", "Bitte zuerst Clips hinzufügen.")
            return
        abbruch.clear()
        opt = Optionen(qualitaet.get(), glaettung.get(), farbe.get(), matte.get(), png.get(),
                       Path(ziel.get()) if ziel.get().strip() else None)
        start_knopf.configure(state="disabled")
        stop_knopf.configure(state="normal")

        def arbeit():
            try:
                alle_clips(opt, list(dateien), Fortschritt(melde, prozent, abbruch))
                melde("Alles erledigt.")
            except Exception as e:
                melde(f"FEHLER: {e}")
            finally:
                root.after(0, lambda: (start_knopf.configure(state="normal"),
                                       stop_knopf.configure(state="disabled")))

        threading.Thread(target=arbeit, daemon=True).start()

    start_knopf.configure(command=starten)
    melde("Clips hinzufügen und auf „Freistellen“ klicken. Ergebnis: <Clip>_alpha.mov (ProRes 4444 mit Alpha).")
    root.mainloop()


def main():
    if len(sys.argv) == 1:
        fenster()
        return
    ap = argparse.ArgumentParser(description="Stellt Videoclips frei (ProRes 4444 mit Alpha).")
    ap.add_argument("clips", nargs="+", type=Path)
    ap.add_argument("--ziel", type=Path, help="Zielordner (Standard: neben dem Clip)")
    ap.add_argument("--schnell", action="store_true", help="Modell mit 1024 statt 2048 Pixeln")
    ap.add_argument("--keine-glaettung", action="store_true")
    ap.add_argument("--keine-farbsaeuberung", action="store_true")
    ap.add_argument("--matte", action="store_true", help="zusätzlich Schwarzweiß-Maske als Clip")
    ap.add_argument("--png", action="store_true", help="zusätzlich 16-Bit-PNG-Sequenz")
    a = ap.parse_args()
    clips = []
    for c in a.clips:
        clips += sorted(p for p in c.iterdir() if p.suffix.lower() in VIDEO_ENDUNGEN) if c.is_dir() else [c]
    opt = Optionen("schnell" if a.schnell else "maximal", not a.keine_glaettung,
                   not a.keine_farbsaeuberung, a.matte, a.png, a.ziel)
    alle_clips(opt, clips, Fortschritt())


if __name__ == "__main__":
    main()
