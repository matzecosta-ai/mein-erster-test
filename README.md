# mein-erster-test

BVG-Abfahrten in meiner Nähe, per GPS.

- **Web-App** (`index.html`, `manifest.webmanifest`, `sw.js`, `icons/`): läuft im Browser, installierbar als PWA.
- **Android-Widget** (`android/`): echte App mit Startbildschirm-Widget. Tippen auf das Widget holt Standort und Abfahrten, die Titelzeile öffnet die Einstellungen (Haltestellen, Linien und Richtungen).
- **iPhone-Widget** (`ios/`): Skript für die App Scriptable mit denselben Funktionen, siehe `ios/README.md`.

APK bauen (JDK 17+ und Android SDK nötig):

```
cd android
./gradlew assembleDebug
# -> app/build/outputs/apk/debug/app-debug.apk
```

Daten: [v6.bvg.transport.rest](https://v6.bvg.transport.rest)
