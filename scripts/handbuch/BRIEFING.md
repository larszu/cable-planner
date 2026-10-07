# Briefing: Handbuch-Kapitel (ein Kapitel je Agent)

Ziel: Das Benutzerhandbuch von LZ Cable Planner beschreibt **ausnahmslos jede
Funktion** deines Kapitels — jeden Menüeintrag, jeden Dialog, jeden Reiter,
jede Option, jedes Untermenü, jede Variante, jeden Schritt einer Handlung —
**mit einem Screenshot je Schritt**, auf Deutsch UND Englisch, so genau, dass
jemand ohne Vorwissen es nachmachen kann.

Repo: `/Users/larszumpe/Projekte/cable-planner` (App gebaut, `dist/` aktuell).
Nicht `npm run build`, kein git, keine Änderung am App-Quellcode. Du schreibst
nur: dein Aufnahmeskript, deine Kapitel, deine Bilder (siehe „Ausgaben“).

## Was schiefgelaufen ist (und nicht wieder passieren darf)

Eine frühere Fassung dieses Kapitels wurde von einem schwächeren Modell
geschrieben. Ein Prüflauf gegen den Code fand darin **Erfindungen**: Felder und
Knöpfe, die es nicht gibt (z. B. „Helligkeit“ bei der LED-Wand, ein
MCP-Passwortfeld), falsche Beschriftungen, falsche Menüpfade, erfundene
Abläufe, erfundene Zahlen. Dazu Bildverweise auf Dateien, die nicht existieren.
Die Befunde stehen als GitHub-Issues (siehe deinen Auftrag; `gh issue view N`).
**Schreibe dein Kapitel neu und hake jeden Befund ab.** Beschreibe nur, was du
(a) im Code gelesen UND (b) auf einem Bild oder im aufgenommenen Dialogtext
gesehen hast. Was du nicht belegen kannst, schreibst du nicht.

## Werkzeug

`scripts/handbuch/app.mjs` (lies es einmal ganz). Es startet die gebaute
Electron-App unsichtbar, mit Wegwerf-Profil, hellem Thema, gewählter Sprache,
**allen Modulen eingeschaltet** (Rentman, NetBox, Vermietung …) und dem
Beispielprojekt (Camera 1, Camera 2, Vision mixer, Multiviewer, Control room
monitor; 4 Kabel). Betriebssystem-Dateidialoge sind abgefangen (melden
„abgebrochen“), `openExternal` tut nichts. **Nur eine App-Instanz läuft
gleichzeitig**: `starte()` wartet, bis die Sperre frei ist — andere Agenten
nehmen gerade auf, das kann dauern.

```js
import { starte } from '../app.mjs'
const sprache = process.argv[2] ?? 'de'
const a = await starte({ sprache })
const f = a.folge('geraet-anlegen')          // Präfix der Bilddateien

// Ein Schritt = eine Handlung + ein Bild + der sichtbare Dialogtext danach
await f.schritt('menue-datei-offen', () => a.menue('app.menu.file'), { ziel: () => a.menueFeld() })
await f.schritt('dialog-offen', () => a.klick('library.create.title'), { ziel: () => a.dialog() })
await f.schritt('name-eingetippt', () => a.dialog().getByRole('textbox').first().fill('Test'), { ziel: () => a.dialog() })

f.speichern(new URL(`./geraet-anlegen.${sprache}.json`, import.meta.url))  // schritte[] mit nr, name, datei, text; fehler[]
await a.ende()
console.log('FERTIG')
```

Weitere Helfer: `a.text(key)` (Beschriftung in der Laufsprache), `a.klick(key)`
(Text nach i18n-Schlüssel), `a.klickText(/regex|Text/)` (für dynamische
Beschriftungen wie Reiter, Listeneinträge), `a.menue(...pfad)`, `a.palette(key)`
(Strg+K), `a.zu()` (alles schließen), `a.dialog()`, `a.menueFeld()`,
`a.dialogText()`, `a.bild(name, locator?)`, `a.win` (Playwright-Page für alles
andere: `locator`, `fill`, `selectOption`, `setInputFiles`, `hover`, `mouse`,
`keyboard`, `evaluate`).

Navigation **immer über i18n-Schlüssel oder sprachneutrale Selektoren**, damit
dasselbe Skript beide Sprachen aufnimmt. Schlüssel: im Code `t('schluessel',
'English')`, Deutsch in `src/renderer/lib/i18n/de.ts`. Dynamische Schlüssel
(`t(\`x.${id}\`, …)`) sind nicht im Wörterbuch → `klickText` mit beiden
Sprachen als Regex.

## Ein Bild je Schritt

Jede Handlung, die der Leser ausführt, bekommt ein Bild danach — jeder
Klick, der etwas Neues zeigt: Menü offen, Untermenü offen, Dialog offen, jeder
Reiter, jede ausgeklappte Auswahl, jedes ausgefüllte Feld, jedes Ergebnis. Bei
Formularen ein Bild nach jedem inhaltlich neuen Feld oder Block. „Zu jedem
Schritt“ heißt: im Text steht Schritt 1, 2, 3 …, und unter jedem Schritt das
zugehörige Bild.

**Bildgröße ist begrenzt** (das Repo wächst sonst um hunderte MB): Bilder auf
den relevanten Ausschnitt zuschneiden (`ziel:` = Dialog, Menü, Inspector,
Bibliothek …). Ganzes Fenster nur, wenn der Zusammenhang es braucht. Keine
Doppelbilder desselben Zustands.

Tiefe: Untermenüs, Auswahllisten (alle Werte einer Liste einmal aufklappen),
Reiter, Kontextmenüs (`click({ button: 'right' })`), Umschalter in beiden
Stellungen, Fehler- und Leerzustände, wo die App sie zeigt.

## Vorgehen

1. **Inventar aus dem Code** (Startpunkte im Auftrag): alle Funktionen,
   Optionen, Reiter, Varianten — auch hinter Bedingungen (Modul, Auswahl,
   Modus). Nicht die einzelnen Dialoge nur nennen, sondern jede Option.
2. Die Befund-Issues lesen und einarbeiten.
3. **Aufnahmeskript** `scripts/handbuch/bereiche/<kapitel>.mjs` (nimmt die
   Sprache als Argument). Jeder Schritt in `f.schritt(...)`, Fehler stoppen
   den Lauf nicht. Am Ende `console.log('FERTIG')`.
4. **Laufen lassen, beide Sprachen, nacheinander**: erst `de`, dann `en`. Ein
   Bash-Aufruf ist auf 10 Minuten begrenzt und `starte()` kann auf die Sperre
   warten. Starte deshalb im Hintergrund
   (`node … de > /tmp/…/x-de.log 2>&1 &`, Logs im Scratchpad) und warte mit
   einer Schleife (`until grep -q FERTIG log; do sleep 5; done`, höchstens
   ~9 Minuten je Aufruf, danach erneut). Schlägt ein Lauf fehl, Fehler lesen,
   Skript reparieren, neu laufen lassen.
5. **Bilder prüfen** (Read auf die Bilddatei): mindestens die Hälfte; jedes Bild
   muss zeigen, was der Schritt behauptet (kein leerer Canvas, kein falscher
   Dialog, kein verdecktes Menü). Falsche Bilder: Skript reparieren, neu
   aufnehmen. Kein Kapitel verweist auf ein Bild, das nicht existiert.
6. **Kapitel schreiben** (aus JSON-Dialogtexten, Bildern und Code).
7. Prüfe am Ende mit einem kleinen Skript, dass jeder `![](bilder/…)`-Verweis
   in beiden Kapiteldateien auf eine vorhandene Datei zeigt und dass DE und EN
   dieselben Bilder in derselben Reihenfolge verwenden.

## Nicht tun (Sicherheit)

- Nichts absenden, hochladen, anmelden, verbinden: keine Anmeldung an der
  Gerätebibliothek, kein Cloud-Speichern, kein Einreichen, keine echten
  Zugangsdaten, keine Verbindung zu ATEM/Videohub/Rentman/NetBox/KI-Anbietern
  im Netz. Dialoge öffnen und fotografieren: ja. Absende-Knopf: nein.
- **Erfundene Zugangsdaten und Testdaten** (z. B. Token `demo-token`) dürfen
  eingetippt werden, um den Ablauf zu zeigen. Sind Adresse oder Basis-URL in
  der App einstellbar, darfst du einen **lokalen Scheinserver auf 127.0.0.1**
  starten, der feste Beispielantworten liefert (Rentman-Projektliste, KI-Antwort
  für „Anschlüsse vom Foto“), damit die Folgeschritte sichtbar werden. Dann in
  der Beschreibung ausdrücklich „Beispieldaten“. Läuft der Abruf im
  Hauptprozess und lässt sich nicht umlenken, beschreibe die Schritte bis zum
  Abruf mit Bildern und die Folgeschritte aus dem Code — und sage im Bericht
  genau, was nicht aufgenommen werden konnte.
- MCP-Server, Telefonzugang, Live-Sitzung: Dialog zeigen ja, einschalten nein
  (außer der Auftrag sagt es).
- Keine echten Kundendaten; das Beispielprojekt reicht.

## Texte: Form und Stil

- Datei beginnt mit `## <Kapiteltitel>` (keine Nummer), dann `###` je
  Funktion/Dialog, `####` je Unterpunkt/Reiter, `#####` nur wenn nötig. Nur
  diese Markdown-Elemente: Überschriften, Absätze, Listen (`-`, `1.`),
  Tabellen, Bilder, `**fett**`, `*kursiv*`, `` `code` ``, Codeblöcke. Kein HTML.
- Handlungsfolgen als nummerierte Liste, **jedes Bild unter seinem Schritt**:
  ```
  1. Öffnen Sie *Datei → Neues Projekt*.

     ![Menü Datei geöffnet](bilder/de/geraet-anlegen-01-menue.jpg)
  ```
  (Bild eingerückt unter dem Listenpunkt; in der englischen Datei `bilder/en/…`.)
- Jede Funktion: **wo** (Menüpfad kursiv mit ` → `, exakt die Beschriftungen
  der App in der jeweiligen Sprache), **wozu**, **jede Option/jedes Feld**
  (Tabelle: Feld | Werte | Wirkung), **Varianten**, **Grenzen** (was sie nicht
  tut, wenn die App es sagt), **Ergebnis**.
- Deutsch: Sie-Form, sachlich, kurze Hauptsätze. Englisch: gleiche Struktur,
  gleiche Bilder (aus `bilder/en/`).
- Nur Ist-Zustand: keine Versionsgeschichte, kein „neu/jetzt/nicht mehr/bisher“,
  keine Issue-Nummern, keine Entwickler-Interna. Keine Superlative, keine
  Werbesprache. Keine Emojis.
- Querverweise auf andere Kapitel als Link auf die Überschrift schreiben:
  `[Rack-Builder](#rack-builder)` (Anker wie GitHub: klein, Leerzeichen zu `-`).
  Eigene `###`-Überschriften müssen im ganzen Handbuch eindeutig sein — setze
  einen unterscheidenden Zusatz, wenn ein Name auch anderswo vorkommt.

## Ausgaben

- `scripts/handbuch/bereiche/<kapitel>.mjs` und `<kapitel>.<sprache>.json`
- `docs/manual/kapitel/<kapitel>.de.md` und `<kapitel>.en.md` (beide!)
- Bilder `docs/manual/bilder/{de,en}/<kapitel>-<nn>-<name>.jpg` (über `folge`)
- Keine Dateien anderer Kapitel ändern. Fehlt dir eine Funktion, die in kein
  Kapitel gehört, nenne sie im Bericht.

## Abschlussbericht (letzte Nachricht, knapp)

Zahl der Bilder je Sprache; Zahl der Schritte; Liste der abgehakten Befunde
(Issue-Nummer, wie viele von wie vielen); was **nicht** aufgenommen oder
belegt werden konnte und warum; Funktionen, die du gefunden hast und die in
kein Kapitel passen.
