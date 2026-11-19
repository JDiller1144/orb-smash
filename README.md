# Orb Smash

Ein kleines Arcade-Spiel für den Browser: Unten fährt eine Schwebe-Kanone hin und her und schießt nach oben. Leuchtende Kugeln springen durchs Bild, jede hat Trefferpunkte. Wird eine zerschossen, zerfällt sie in zwei kleinere. Berührt dich eine Kugel, ist das Level verloren.

**Spielen:** https://jdiller1144.github.io/orb-smash/

## So funktioniert's

- **Steuerung:** Finger auflegen und nach links oder rechts ziehen. Solange der Finger liegt, schießt die Kanone. Am PC: Maus gedrückt halten und ziehen oder Pfeiltasten.
- **Münzen:** Platzende Kugeln lassen Münzen fallen, die fliegen automatisch zur Kanone. Am Levelende gibt es einen Bonus.
- **Shop:** Feuerrate (6 bis 50 Schuss pro Sekunde), Feuerkraft (ohne Obergrenze) und Münzbonus (ohne Obergrenze: bis +200 % je 10 %, danach je 5 %). Nach 8 Feuerrate-Upgrades hat die Kanone zwei Rohre, nach 18 drei, nach 35 vier.
- **Bosse** (jedes 5. Level, drei Typen im Wechsel, jede Runde stärker). Ab halber Energie werden sie wütend und greifen schneller an:
  - **Prisma** (Level 5, 20, 35 …): stampft dort auf den Boden, wo du gerade stehst. Die rote Markierung zeigt, wo er landet. Wütend schleudert er dabei kleine Kugeln los.
  - **Zyklop** (Level 10, 25, 40 …): lädt kurz auf und schießt Salven auf dich, wütend 5 statt 3 Schuss.
  - **Wächter** (Level 15, 30, 45 …): zwei kreisende Schilde fangen Schüsse ab, Strahlen kommen von oben (erst Warnlinie, dann Strahl), wütend drei auf einmal.
- **Power-ups** (fallen manchmal aus großen Kugeln, Liste auch im Menü):

  | Power-up | Wirkung |
  |---|---|
  | Schild | fängt einen Treffer ab |
  | Turbo | 8 s fast doppelte Feuerrate |
  | Laser | 6 s Dauerstrahl, schneidet durch alles darüber |
  | Fächer | 8 s jeder Schuss dreifach im Fächer |
  | Drohnen | 10 s zwei Helfer, die mitschießen |
  | Raketen | 8 s zielsuchende Raketen mit kleiner Explosion |
  | Frost | 5 s Zeitlupe für Kugeln, Boss und Boss-Geschosse |
  | Goldrausch | 10 s doppelte Münzen |
  | Nova | Druckwelle, trifft sofort alle Kugeln |

- Fortschritt, Münzen und Upgrades bleiben auf dem Gerät gespeichert.

## Balancing

Wie stark ein Level ist, richtet sich nach einem simulierten Spieler, der jedes Level schafft und Feuerrate, Feuerkraft und Münzbonus kauft (`typicalDps` in `js/game.js`). Levels sind auf 75 % von dessen Schaden ausgelegt. Wer viel Münzbonus kauft oder öfter wiederholt, ist stärker und kommt leichter durch.

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
