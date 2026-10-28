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
  - **Ziel eingeben** – Verbindung vom aktuellen Standort zu einer Haltestelle (z. B. „Hermannstr."): Ziel eintippen, aus den Treffern wählen. Das Widget zeigt dann die nächsten Fahrten mit Linien, Umstiegen und Ankunft. „Kein Ziel" bringt die normale Abfahrtsliste zurück. Tippst du auf eine Verbindung, siehst du den **ganzen Verlauf**: Fußwege, jede Fahrt mit Haltestelle, Gleis und Zeit sowie die Umstiege mit Bahnhof, Wartezeit und Anschlussgleis.
  - **Alles zurücksetzen** – steht ganz oben in der Liste, sobald etwas ausgewählt ist (Haltestellen, Filter oder Ziel), und löscht alles auf einmal.
- **Mehrere Widgets mit eigenen Einstellungen:** im Feld *Parameter* des Widgets einen Profilnamen eintragen (z. B. `arbeit`). Jedes Profil speichert Haltestellen und Filter getrennt. Ohne Parameter gilt das Profil `standard`.

## Grenzen

- iOS bestimmt, wann ein Widget neu lädt (meist alle paar Minuten bis Viertelstunden). Ein Tipp aufs Widget aktualisiert es nicht, sondern öffnet die Live-Liste.
- Zeigt das Widget „Standort nicht verfügbar“, in den iOS-Einstellungen → Scriptable → Standort auf „Immer“ stellen. Das Skript merkt sich außerdem den letzten Standort aus der App.
