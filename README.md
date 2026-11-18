# Orb Smash

Ein kleines Arcade-Spiel für den Browser: Unten fährt eine Schwebe-Kanone hin und her und schießt nach oben. Leuchtende Kugeln springen durchs Bild, jede hat Trefferpunkte. Wird eine zerschossen, zerfällt sie in zwei kleinere. Berührt dich eine Kugel, ist das Level verloren.

**Spielen:** https://jdiller1144.github.io/orb-smash/

## So funktioniert's

- **Steuerung:** Finger auflegen und nach links oder rechts ziehen. Solange der Finger liegt, schießt die Kanone. Am PC: Maus gedrückt halten und ziehen oder Pfeiltasten.
- **Münzen:** Platzende Kugeln lassen Münzen fallen, die fliegen automatisch zur Kanone. Am Levelende gibt es einen Bonus.
- **Shop:** Feuerrate, Feuerkraft und Münzbonus aufrüsten. Nach 8 Feuerrate-Upgrades hat die Kanone zwei Rohre, nach 18 drei.
- **Boss:** Jedes 5. Level kommt ein Boss. Er spuckt kleine Kugeln aus und stampft ab und zu auf den Boden. Die rote Markierung zeigt, wo er landet.
- **Power-ups** (fallen manchmal aus großen Kugeln): Schild (fängt einen Treffer ab), Turbo (8 Sekunden fast doppelt so schnell schießen), Frost (5 Sekunden Zeitlupe für alle Kugeln).
- Fortschritt, Münzen und Upgrades bleiben auf dem Gerät gespeichert.

## Aufs iPhone (Homescreen, offline)

1. Den Link oben in **Safari** öffnen.
2. Unten auf **Teilen** tippen, dann **„Zum Home-Bildschirm“**.
3. Ab jetzt über das Icon starten. Nach dem ersten Öffnen läuft das Spiel auch ohne Internet.

## Technik

- Reines HTML, CSS und JavaScript, keine Bibliotheken, keine Build-Schritte.
- Grafik wird live auf ein `<canvas>` gezeichnet, Sounds entstehen per Web Audio. Es gibt keine Bild- oder Audiodateien außer den Icons.
- `sw.js` (Service Worker) legt alle Dateien beim ersten Besuch auf dem Gerät ab.
- Gehostet über GitHub Pages direkt aus dem `main`-Branch.

| Datei | Inhalt |
|---|---|
| `index.html` | Seitenaufbau: Spielfläche, Menü, Pause, Ergebnis |
| `style.css` | Aussehen der Menüs und Anzeigen |
| `js/game.js` | Spiellogik, Balancing (Level, Upgrades, Boss) und Zeichnen |
| `js/main.js` | Menü, Shop, Speicherstand |
| `js/audio.js` | Soundeffekte |
| `sw.js` | Offline-Speicher |
| `tools/make_icons.py` | Erzeugt die Icons (`python tools/make_icons.py`, braucht Pillow) |

## Änderungen veröffentlichen

1. Lokal testen: im Projektordner `python -m http.server 8765` starten und `http://localhost:8765` öffnen.
2. **In `sw.js` die `VERSION` hochzählen** (und in `js/main.js` die `APP_VERSION`). Sonst behalten installierte Geräte die alte Fassung.
3. Committen und pushen. GitHub Pages ist nach ca. einer Minute aktuell.
4. Auf dem iPhone kommt die neue Version nach dem nächsten Start (bei bestehender Internetverbindung), spätestens beim übernächsten.
