# BVG-Abfahrten als iPhone-Widget (Scriptable)

Eine native iPhone-App lässt sich ohne Mac und Apple-Entwicklerkonto nicht bauen.
Dieses Skript läuft in der kostenlosen App **Scriptable** und erzeugt ein echtes Widget für den Home-Bildschirm.

## Einrichten

1. **Scriptable** aus dem App Store installieren (kostenlos).
2. `BVG-Abfahrten.js` auf das iPhone holen und in Scriptable öffnen (Teilen-Menü → Scriptable), oder in Scriptable ein neues Skript anlegen (+) und den Inhalt der Datei einfügen. Das Skript soll „BVG-Abfahrten“ heißen.
3. Das Skript einmal in Scriptable antippen und den Standortzugriff erlauben.
4. Widget anlegen: Home-Bildschirm lange drücken → **+** → **Scriptable** → Größe wählen → Widget hinzufügen. Dann das Widget lange drücken → **Widget bearbeiten** → *Script*: „BVG-Abfahrten“.

## Bedienen

- **Im Widget:** zeigt die nächsten Abfahrten (klein 3, mittel 4, groß 9 Zeilen).
- **Widget antippen:** öffnet die Live-Liste in Scriptable. Dort:
  - **Haltestellen wählen** – nur diese Haltestellen zeigen (dann ohne Standort). Nichts gewählt = alle in der Nähe.
  - **Linien & Richtungen filtern** – z. B. nur „U2 → Pankow“. Nichts gewählt = alles zeigen.
- **Mehrere Widgets mit eigenen Einstellungen:** im Feld *Parameter* des Widgets einen Profilnamen eintragen (z. B. `arbeit`). Jedes Profil speichert Haltestellen und Filter getrennt. Ohne Parameter gilt das Profil `standard`.

## Grenzen

- iOS bestimmt, wann ein Widget neu lädt (meist alle paar Minuten bis Viertelstunden). Ein Tipp aufs Widget aktualisiert es nicht, sondern öffnet die Live-Liste.
- Zeigt das Widget „Standort nicht verfügbar“, in den iOS-Einstellungen → Scriptable → Standort auf „Immer“ stellen. Das Skript merkt sich außerdem den letzten Standort aus der App.
