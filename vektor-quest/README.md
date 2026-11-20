# Vektor-Quest 🚀

Lern-App zum **Vektorrechnen** (Analytische Geometrie, Grundkurs), dem dritten großen Gebiet neben Analysis und Stochastik.
Sie stellt spielerisch Rechenaufgaben, und wer nicht weiterkommt, bekommt die Hilfe in drei Stufen:

1. 💡 **Hinweis 1**: welche Idee oder Formel man braucht
2. 💡 **Hinweis 2**: der erste Rechenschritt mit den konkreten Zahlen
3. 📖 **Lösungsweg**: alles Schritt für Schritt, „für Dummies“

Jede Aufgabe wird zufällig neu erzeugt, die Übung geht also nie aus.

## Themen: nur Grundkurs, nur Rechenaufgaben (5 Welten, 23 Aufgabentypen)

| Welt | Inhalte |
|---|---|
| ➡️ Vektoren rechnen | Addieren & Vervielfachen, Verbindungsvektor, Länge, Abstand zweier Punkte, Mittelpunkt, Schwerpunkt, Parallelogramm ergänzen, Vielfaches bestimmen |
| 📐 Skalarprodukt & Winkel | Skalarprodukt, fehlende Koordinate für senkrechte Vektoren, Winkel zwischen Vektoren, Innenwinkel im Dreieck |
| 📏 Geraden | Punkt berechnen, Richtungsvektor aus zwei Punkten, Punktprobe (Parameter bestimmen), Spurpunkt, Schnittpunkt, Schnittwinkel |
| 🟦 Ebenen (Parameterform) | Punkt berechnen, Punktprobe (r und s bestimmen), Schnittpunkt Gerade–Ebene |
| 🧮 LGS lösen (Gauß) | LGS mit 2 und 3 Unbekannten |

Nicht enthalten, weil Leistungskurs-Stoff: Kreuzprodukt, Koordinaten-/Normalenform, Abstände zu Geraden und Ebenen,
Spiegelungen, Winkel mit Ebenen, Determinanten, Matrizen. Es gibt keine Ja/Nein- oder Auswahlfragen, jede Aufgabe wird gerechnet.

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
