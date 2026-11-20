# Vektor-Quest 🚀

Lern-App für **Analytische Geometrie & Lineare Algebra**, das dritte große Gebiet neben Analysis und Stochastik.
Sie stellt spielerisch Aufgaben, und wer nicht weiterkommt, bekommt die Hilfe in drei Stufen:

1. 💡 **Hinweis 1**: welche Idee oder Formel man braucht
2. 💡 **Hinweis 2**: der erste Rechenschritt mit den konkreten Zahlen
3. 📖 **Lösungsweg**: alles Schritt für Schritt, „für Dummies“

Jede Aufgabe wird zufällig neu erzeugt, die Übung geht also nie aus.

## Themen (8 Welten, 47 Aufgabentypen)

| Welt | Inhalte |
|---|---|
| ➡️ Vektoren – Grundlagen | Verbindungsvektor, Länge, Mittelpunkt, Schwerpunkt, Parallelogramm, Kollinearität |
| 📐 Skalarprodukt & Winkel | Skalarprodukt, Orthogonalität, fehlende Koordinate, Winkel, rechter Winkel im Dreieck |
| ✖️ Kreuzprodukt, Fläche & Volumen | Kreuzprodukt, Dreieck, Parallelogramm, Spat, Pyramide |
| 📏 Geraden | Punkt berechnen, Gerade durch 2 Punkte, Punktprobe, Spurpunkte, Lagebeziehung, Schnittpunkt |
| 🟦 Ebenen | Koordinatenform, Normalenvektor, Parameter- → Koordinatenform, Ebene durch 3 Punkte, Punktprobe, Spurpunkte |
| 🔀 Lage, Schnitte & Winkel | Gerade–Ebene (Lage, Schnittpunkt, Winkel), Ebene–Ebene (Lage, Winkel) |
| 📍 Abstände & Spiegelung | Punkt–Punkt, Punkt–Ebene (HNF), Lotfußpunkt, Spiegelpunkt, Punkt–Gerade, parallele Ebenen |
| 🧮 LGS & Matrizen | LGS 2×2, Gauß 3×3, Lösbarkeit, Determinanten (2×2, Sarrus), Matrix·Vektor, Matrixprodukt |

Jede Aufgabe hat einen Schwierigkeitsgrad von ● bis ●●●.

## Spiel-Elemente

- **XP & Level**: vom „Vektor-Neuling 🐣“ bis zum „Matrix-Meister 👑“. Weniger Hilfe bringt mehr XP (100 % / 70 % / 40 %, mit Lösungsweg 0).
- **Serien 🔥**: Bonus-XP für mehrere richtige Antworten ohne Hilfe hintereinander
- **Tages-Challenge 🏆**: jeden Tag 5 neue Aufgaben aus verschiedenen Themen, +50 XP Bonus
- **Blitzrunde ⚡**: 90 Sekunden, so viele Aufgaben wie möglich, mit Rekord
- **Sterne ★★★** pro Themenwelt, **17 Erfolge**, Lerntage-Serie
- Eigene Rechen-Tastatur mit −, Komma, Bruch (3/4) und Wurzel (√14)
- Teilweise richtige Vektoren werden komponentenweise grün/rot markiert
- Hell- und Dunkelmodus, läuft komplett offline

## Aufs Samsung/Android-Handy bringen

**Variante A: APK installieren**
1. `Vektor-Quest.apk` (in diesem Ordner) aufs Handy laden, z. B. über GitHub im Handy-Browser.
2. Antippen → bei der Nachfrage „Aus dieser Quelle installieren“ erlauben → Installieren.

**Variante B: Web-App (PWA)**
Den Ordner `web/` auf einen Webserver legen (z. B. GitHub Pages), in Chrome oder Samsung Internet öffnen und
„Zum Startbildschirm hinzufügen“ wählen.

## Entwickeln

```
web/            Die App (HTML/CSS/JS, keine Abhängigkeiten)
  aufgaben.js   Alle Aufgaben-Generatoren mit Hinweisen und Lösungswegen
  app.js        Oberfläche, XP, Level, Erfolge, Speichern
android/        Android-Hülle (WebView), packt web/ als Assets in die APK
test/           Automatischer Test aller Aufgabentypen
```

Tests: `node test/aufgaben.test.js` (erzeugt jeden Aufgabentyp 400-mal und prüft Antworten, Hinweise und Texte).

APK bauen (JDK 17+ und Android SDK nötig):

```
cd android
./gradlew assembleDebug
# -> app/build/outputs/apk/debug/app-debug.apk
```
