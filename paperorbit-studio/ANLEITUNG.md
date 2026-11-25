# paperorbit Studio – Webseite

Statische Seite (HTML, CSS, JavaScript). Keine Datenbank, kein PHP, keine Cookies, keine externen Dienste.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite: Showreel, Projekte, Leistungen, Studio, Ablauf, Kontakt |
| `impressum.html`, `datenschutz.html` | Pflichtseiten (gelb markierte `[Platzhalter]` ausfüllen) |
| `style.css` | Gestaltung (Farben ganz oben unter `:root`) |
| `script.js` | Projektliste (`PROJEKTE`, ganz oben) und Funktionen |
| `media/` | Eigene Videos und Bilder |

## Eigene Inhalte einsetzen

- **Showreel:** `media/showreel.mp4` ablegen (H.264, möglichst unter 50 MB).
  Optional eine kurze, stumme Vorschau als `media/showreel-vorschau.mp4` (5–10 s, unter 3 MB), sie läuft dann in der Karte oben.
- **Projekte:** in `script.js` die Liste `PROJEKTE` bearbeiten, z. B.
  `{ titel: "Nachtfahrt", kunde: "Musikvideo", kategorie: "schnitt", bild: "media/nachtfahrt.jpg", video: "media/nachtfahrt.mp4" }`
- **Studiofoto:** in `index.html` das Platzhalter-SVG im Abschnitt „Über uns“ durch `<img src="media/studio.jpg" alt="…">` ersetzen.
- **Alles Gelbmarkierte** (`class="todo"`) durch echte Angaben ersetzen und danach die Markierung entfernen. E-Mail und Telefon stehen auch in den `mailto:`/`tel:`-Links.

## Hochladen zu Strato (SFTP)

1. Im Strato-Kundenlogin unter **Hosting → SFTP/SSH** die Zugangsdaten nachsehen (Server meist `ssh.strato.de`, Benutzer = deine Domain oder die angezeigte Nummer).
2. Ein SFTP-Programm öffnen, z. B. **FileZilla** (kostenlos) oder Cyberduck.
   Verbindung: Protokoll **SFTP**, Server `ssh.strato.de`, Port **22**, Benutzer und Passwort aus Schritt 1.
3. Den **Inhalt** dieses Ordners (nicht den Ordner selbst) in das Verzeichnis kopieren, auf das deine Domain zeigt (oft das Hauptverzeichnis `/`). Welches Verzeichnis das ist, steht bei Strato unter **Domains → Domainverwaltung → Ziel**.
4. Domain im Browser aufrufen. SSL/HTTPS bei Strato unter **Domains → SSL-Verwaltung** aktivieren, falls noch nicht geschehen.

`ANLEITUNG.md` muss nicht mit hochgeladen werden.
