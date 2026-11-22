# Zufalls-Quest

Lern-App für **Stochastik** im Berliner Mathe-Grundkurs (Abitur 2026–2028). Gleiches Prinzip wie [Vektor-Quest](../vektor-quest/): Rechen-Challenges mit XP, Level, Serien und Erfolgen. Hilfe gibt es in drei Stufen: 💡 Hinweis 1, 💡 Hinweis 2, dann 📖 der komplette Lösungsweg Schritt für Schritt.

Die Aufgaben werden zufällig erzeugt, jede Runde ist anders. Inhalte nach den offiziellen Berliner Prüfungsschwerpunkten (nur Grundkurs).

## Themenwelten

- 🎲 **Grundbegriffe & Laplace**: Ereignisse, Mengen, Gegenereignis, Additionssatz, relative Häufigkeit (6 Aufgabentypen)
- 🏺 **Kombinatorik & Urnen**: Abzählen, Ziehen mit und ohne Zurücklegen, Lotto-Modell (5 Aufgabentypen)
- 🌳 **Baumdiagramm & Vierfeldertafel**: Pfadregeln, totale Wahrscheinlichkeit, Tafeln ergänzen (4 Aufgabentypen)
- 🔍 **Bedingte Wahrscheinlichkeit**: P_A(B), Bayes mit Tafel oder Baum, Unabhängigkeit (5 Aufgabentypen)
- 🎰 **Zufallsgrößen**: Verteilung, Erwartungswert, Varianz, faire Spiele (5 Aufgabentypen)
- 📊 **Kenngrößen von Daten**: Mittelwert, Median, Modalwert, Spannweite, Streuung (4 Aufgabentypen)
- 🎯 **Binomialverteilung**: Bernoulli-Ketten, P(X = k), kumuliert, μ und σ, Mindestanzahl (7 Aufgabentypen)

Prüfungsteil B: Schokolinsen, Schnelltest, Glücksrad, Freiwürfe

Abi-Training: Prüfungsteil A (hilfsmittelfrei, 5 Aufgaben) und Teil B (Sachaufgaben mit Bewertungseinheiten und Notenpunkten). Dazu Links zu echten Abituraufgaben mit Lösungen (IQB, Senatsverwaltung).

## Installieren

- **iPhone/iPad:** https://matzecosta-ai.github.io/mein-erster-test/stochastik-quest/web/ in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Läuft danach auch offline.
- **Android:** `Zufalls-Quest.apk` (in diesem Ordner) aufs Handy laden und installieren (Installation aus unbekannten Quellen erlauben) – oder die Web-Adresse in Chrome öffnen → „App installieren“.

## Entwickeln

- `web/`: die App (HTML/CSS/JS ohne Abhängigkeiten). `kern.js` ist der gemeinsame Rechenkern, `aufgaben.js` enthält alle Aufgaben-Generatoren, `app.js` Oberfläche und Spielmechanik.
- `test/aufgaben.test.js`: erzeugt jeden Aufgabentyp 400-mal und jede Prüfungsaufgabe 300-mal und prüft, dass die richtige Antwort akzeptiert wird: `node test/aufgaben.test.js`
- `android/`: WebView-Hülle, die `web/` als Assets einpackt: `cd android && ./gradlew assembleDebug`
