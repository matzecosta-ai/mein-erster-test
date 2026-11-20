# Vektor-Quest 🚀

Lern-App für **Analytische Geometrie im Grundkurs**, dem dritten großen Gebiet neben Analysis und Stochastik.
Sie stellt spielerisch Aufgaben, und wer nicht weiterkommt, bekommt die Hilfe in drei Stufen:

1. 💡 **Hinweis 1**: welche Idee oder Formel man braucht
2. 💡 **Hinweis 2**: der erste Rechenschritt mit den konkreten Zahlen
3. 📖 **Lösungsweg**: alles Schritt für Schritt, „für Dummies“

Jede Aufgabe wird zufällig neu erzeugt, die Übung geht also nie aus.

## Themen: der komplette Grundkurs (6 Welten, 37 Aufgabentypen)

| Welt | Aufgaben |
|---|---|
| ➡️ Vektoren – Grundlagen | Addieren & Vervielfachen, Verbindungsvektor, Länge, Abstand zweier Punkte, Mittelpunkt, Schwerpunkt, Parallelogramm ergänzen, Kollinearität prüfen, Vielfaches bestimmen |
| 📐 Skalarprodukt & Winkel | Skalarprodukt, Orthogonalität prüfen, fehlende Koordinate, Winkel zwischen Vektoren, Innenwinkel im Dreieck, rechter Winkel im Dreieck |
| 🔺 Figuren & Körper | Dreieck untersuchen (gleichschenklig/rechtwinklig), Viereck bestimmen (Quadrat/Rechteck/Raute/Parallelogramm), Rechteck- und Dreiecksfläche, Umfang, Pyramidenvolumen, Kantenlänge |
| 📏 Geraden | Punkt berechnen, Gerade durch zwei Punkte, Punktprobe, Parameter bestimmen, Spurpunkt, Lagebeziehung (identisch/parallel/schneidend/windschief), Schnittpunkt, Schnittwinkel |
| 🟦 Ebenen (Parameterform) | Ebene durch drei Punkte, Punkt berechnen, Punktprobe, Parameter r und s bestimmen |
| 🧮 LGS lösen (Gauß) | LGS mit 2 und 3 Unbekannten, Anzahl der Lösungen |

Es gibt Rechenaufgaben und Entscheidungsfragen (z. B. „Wie liegen die Geraden zueinander?“), beide mit vollem Lösungsweg.
Bewusst **nicht** enthalten, weil Leistungskurs-Stoff: Kreuzprodukt, Koordinaten-/Normalenform, Lage Gerade–Ebene und Ebene–Ebene,
Abstände zu Geraden und Ebenen, Spiegelungen, Winkel mit Ebenen, Determinanten, Matrizen.

**🎓 Abi-Fortschritt:** Ein Aufgabentyp gilt als sicher, wenn er 3-mal gelöst wurde (ohne den kompletten Lösungsweg anzusehen).
Bei 100 % hat man jede Aufgabenart des Grundkurses selbst gerechnet.

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

## Aufs Handy bringen

### iPhone
Eine App-Store-App ist ohne Mac und Apple-Entwicklerkonto nicht möglich. Die App läuft aber vollständig in Safari:
1. Den Link zur App in **Safari** öffnen.
2. Unten auf das Teilen-Symbol (Quadrat mit Pfeil) tippen → **„Zum Home-Bildschirm“** → Hinzufügen.
3. Vektor-Quest liegt jetzt wie eine App auf dem Startbildschirm und öffnet sich im Vollbild.

Dauerhaft und offline geht das am besten über GitHub Pages: im Repository unter *Settings → Pages* den Branch auswählen;
die App ist dann unter `…github.io/<repo>/vektor-quest/web/` erreichbar.

### Samsung/Android

**APK installieren**
1. `Vektor-Quest.apk` (in diesem Ordner) aufs Handy laden, z. B. über GitHub im Handy-Browser.
2. Antippen → bei der Nachfrage „Aus dieser Quelle installieren“ erlauben → Installieren.

**Oder als Web-App:**
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
