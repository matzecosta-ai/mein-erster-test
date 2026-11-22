# Kurven-Quest

Lern-App für **Analysis** im Berliner Mathe-Grundkurs (Abitur 2026–2028). Gleiches Prinzip wie [Vektor-Quest](../vektor-quest/): Rechen-Challenges mit XP, Level, Serien und Erfolgen. Hilfe gibt es in drei Stufen: 💡 Hinweis 1, 💡 Hinweis 2, dann 📖 der komplette Lösungsweg Schritt für Schritt.

Die Aufgaben werden zufällig erzeugt, jede Runde ist anders. Inhalte nach den offiziellen Berliner Prüfungsschwerpunkten (nur Grundkurs).

## Themenwelten

- 🧩 **Funktionen & Gleichungen**: Nullstellen, e-Gleichungen, Symmetrie, Verschiebungen, sin/cos, Umkehrfunktion (11 Aufgabentypen)
- ✏️ **Ableiten**: Potenz-, Summen-, Produkt- und Kettenregel, e-Funktion, 2. Ableitung (7 Aufgabentypen)
- 📈 **Änderungsraten & Tangenten**: Mittlere und lokale Änderungsrate, Tangente, Normale, Schnittwinkel (6 Aufgabentypen)
- 🎢 **Kurvendiskussion**: Extrem-, Wende- und Sattelpunkte, Monotonie, Randextrema (7 Aufgabentypen)
- 🛠️ **Modellieren**: Steckbriefaufgaben, LGS, Extremalprobleme (6 Aufgabentypen)
- ∫ **Integrieren**: Stammfunktionen, bestimmtes Integral, Integralregeln (8 Aufgabentypen)
- 🟩 **Flächen & Bestand**: Flächen mit x-Achse und zwischen Graphen, rekonstruierter Bestand (6 Aufgabentypen)

Prüfungsteil B: Medikament im Blut, Speicherbecken, Tunneleinfahrt, Achterbahn

Abi-Training: Prüfungsteil A (hilfsmittelfrei, 5 Aufgaben) und Teil B (Sachaufgaben mit Bewertungseinheiten und Notenpunkten). Dazu Links zu echten Abituraufgaben mit Lösungen (IQB, Senatsverwaltung).

## Installieren

- **iPhone/iPad:** https://matzecosta-ai.github.io/mein-erster-test/analysis-quest/web/ in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Läuft danach auch offline.
- **Android:** `Kurven-Quest.apk` (in diesem Ordner) aufs Handy laden und installieren (Installation aus unbekannten Quellen erlauben) – oder die Web-Adresse in Chrome öffnen → „App installieren“.

## Entwickeln

- `web/`: die App (HTML/CSS/JS ohne Abhängigkeiten). `kern.js` ist der gemeinsame Rechenkern, `aufgaben.js` enthält alle Aufgaben-Generatoren, `app.js` Oberfläche und Spielmechanik.
- `test/aufgaben.test.js`: erzeugt jeden Aufgabentyp 400-mal und jede Prüfungsaufgabe 300-mal und prüft, dass die richtige Antwort akzeptiert wird: `node test/aufgaben.test.js`
- `android/`: WebView-Hülle, die `web/` als Assets einpackt: `cd android && ./gradlew assembleDebug`
