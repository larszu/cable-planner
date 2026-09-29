# Briefing: Handbuch-Durchlauf (ein Bereich je Agent)

Ziel: Das Benutzerhandbuch von LZ Cable Planner beschreibt **ausnahmslos jede
Funktion** deines Bereichs — jeden Menüeintrag, jeden Dialog, jeden Reiter,
jede Option, jedes Untermenü, jede Variante — mit Screenshots, auf Deutsch UND
Englisch.

Repo: `/Users/larszumpe/Projekte/cable-planner` (App ist gebaut, `dist/` aktuell).
Nicht `npm run build` ausführen, kein git, keine Dateien außerhalb deiner
eigenen Ausgaben ändern (siehe unten). Keinen Quellcode der App ändern.

## Werkzeug

`scripts/handbuch/app.mjs` startet die gebaute Electron-App unsichtbar mit
eigenem Wegwerf-Profil, hellem Thema, gewählter Sprache und dem Beispielprojekt
(5 Geräte: Camera 1, Camera 2, Vision mixer, Multiviewer, Control room monitor;
4 Kabel). Lies die Datei einmal. API:

```js
import { starte } from '../app.mjs'
const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache })
a.text('app.menu.tools')                 // Beschriftung in der Laufsprache
await a.menue('app.menu.file', 'app.menu.file.export')   // Menüpfad (i18n-Schlüssel)
await a.klick('settings.tab.stammdaten') // Element mit diesem Text anklicken (Schlüssel oder Klartext)
await a.palette('app.menu.tools.ledWall')// über Strg+K
await a.bild('<bereich>-<name>')         // ganzes Fenster → docs/manual/bilder/<sprache>/<bereich>-<name>.jpg
await a.bild('<bereich>-<name>', a.dialog())  // nur der oberste Dialog
console.log(await a.dialogText())        // sichtbarer Text des Dialogs — Grundlage für die Beschreibung
await a.zu()                             // Dialoge/Menüs schließen (Escape)
a.win                                    // Playwright-Page für alles andere (hover, fill, selectOption, locator …)
await a.ende()
```

Navigiere **immer über i18n-Schlüssel** (`a.text`, `a.klick('schluessel')`),
nie über fest geschriebenen deutschen oder englischen Text — dasselbe Skript
läuft für beide Sprachen. Schlüssel findest du im Code: `t('schluessel', 'English text')`;
die deutsche Übersetzung steht in `src/renderer/lib/i18n/de.ts`.
Rollen/Selektoren (`[role="dialog"]`, `getByRole('tab')`) sind sprachneutral.

## Vorgehen

1. **Inventar aus dem Code**: Lies die Komponenten deines Bereichs (Startpunkte
   stehen in deinem Auftrag) und liste JEDE Funktion, Option, Reiter, Untermenü,
   Kontextmenüeintrag, Schalter und Variante auf. Der Code ist die Wahrheit —
   was die App kann, steht dort.
2. **Aufnahme-Skript** `scripts/handbuch/bereiche/<bereich>.mjs`: öffnet jede
   Ansicht, jeden Reiter, jedes Untermenü und nimmt ein Bild auf. Ein Bild je
   eigenständiger Ansicht; bei Dialogen mit Reitern je Reiter ein Bild. Gerät
   oder Kabel auswählen, wo nötig (auf den Knoten auf dem Canvas klicken).
   Jede Aktion in `try/catch`, damit ein Fehler nicht den Lauf beendet; Fehler
   sammeln und am Ende ausgeben. Dialogtexte (`dialogText()`) in eine
   JSON-Datei `scripts/handbuch/bereiche/<bereich>.<sprache>.json` schreiben.
3. Laufen lassen: `node scripts/handbuch/bereiche/<bereich>.mjs de`, danach
   `… en` (nacheinander, nicht gleichzeitig). Timeout großzügig (bis 10 min).
4. **Bilder prüfen**: Sieh dir mit dem Read-Werkzeug stichprobenartig Bilder
   an (mindestens ein Drittel). Zeigt ein Bild das Falsche (leer, falscher
   Dialog, Menü verdeckt), Skript korrigieren und neu laufen lassen.
5. **Texte schreiben**: `docs/manual/kapitel/<bereich>.de.md` und
   `docs/manual/kapitel/<bereich>.en.md`.

## Nicht tun (Sicherheit)

- Nichts absenden, hochladen, anmelden oder verbinden: keine Anmeldung an der
  Gerätebibliothek, kein „In die Cloud speichern", kein Einreichen, kein
  Rentman-/NetBox-Abruf mit echten Daten, keine Verbindung zu ATEM/Videohub.
  Den Dialog öffnen und fotografieren: ja. Den Absende-Knopf drücken: nein.
- MCP-Server, Telefonzugang, Live-Sitzung: Dialog zeigen ja, einschalten nein.
- Keine Datei-Dialoge des Betriebssystems erwarten — sie sind abgefangen und
  melden „abgebrochen".

## Texte: Form und Stil

- Beginne mit `## <Kapiteltitel>` (keine Nummer). Darunter `###` je Menü/Dialog,
  `####` je Reiter/Unterbereich. Nur diese Markdown-Elemente: Überschriften
  `##`–`####`, Absätze, Listen mit `-` oder `1.`, Tabellen, Bilder, `**fett**`,
  `*kursiv*`, `` `code` ``, Codeblöcke. Kein HTML.
- Bild einbinden, relativ zu `docs/manual/`:
  `![Kurze Beschreibung](bilder/de/<bereich>-<name>.jpg)` bzw. `bilder/en/…` in
  der englischen Datei. Bild direkt unter die Überschrift des Beschriebenen.
- Jede Funktion: **wo** (Menüpfad in *kursiv* mit ` → `, genau die
  Beschriftungen der App in der jeweiligen Sprache), **was sie tut**, **jede
  Option/Feld** mit Wirkung, **Varianten** (z. B. Formate, Modi), und was sie
  **nicht** tut, wenn die App das sagt. Tabellen für Feldlisten sind gut.
- Deutsch: sachlich, kurze Hauptsätze, Infinitiv- oder Sie-Form
  („Datei wählen", „Sie sehen …"). Englisch: gleiche Struktur, gleiche Bilder
  aus `bilder/en/`.
- Nur der Ist-Zustand. Keine Versionsgeschichte, kein „neu", „jetzt", „nicht
  mehr", „bisher", keine Issue-Nummern (#123), keine Entwickler-Interna.
- Keine Superlative, keine Werbesprache. Nichts erfinden: was du im Code oder
  auf dem Bild nicht siehst, schreibst du nicht.

## Abschlussbericht (deine letzte Nachricht)

Kurz: Anzahl Bilder je Sprache, Liste der beschriebenen Funktionen (eine Zeile
je Funktion), und **was nicht aufgenommen werden konnte und warum**.
