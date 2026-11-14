# Konzept: Mischer und Kreuzschienen offline planen und simulieren

Stand 14.11.2026. Anlass: ein Anwendergespräch am 11.11.2026. Gewünscht war einen ATEM Constellation als virtuellen Mischer im cable-planner, an dem man den Job vorbereiten, testen und vor Ort nur noch aufspielen kann. Das Beispiel dazu: M/E 2 läuft in eine SuperSource, darüber liegt als Overlay ein USK, und dessen Quelle ist ein Mediaplayer. „Umständlich zu erklären, visuell viel einfacher zu verstehen.“

Dieses Konzept denkt größer als den ATEM: **ein Funktionsmodell für alle Mischer und Kreuzschienen**, gespeist aus dem Protokollwissen der eigenen Repos.

---

## 1. Grundgedanke

Kein Gerät wird als Sonderfall gebaut. Jeder Mischer und jede Kreuzschiene ist **eine Zusammensetzung weniger Funktionsbausteine**. Welche Bausteine ein Gerät hat, wie viele davon und mit welchen Grenzen, steht in einem **Geräteprofil**.

Klassische Tally- und Steuersysteme (TSL TallyMan) modellieren es genauso: Ein Mischer ist eine Kreuzschiene mit Programmlogik. Ein Videohub ist der kleinste Fall: eine Ebene, keine Logik.

```
 Geräteprofil (Daten)          Funktionsmodell (ein Code)        Adapter (je Hersteller)
 ───────────────────           ──────────────────────────        ───────────────────────
 ATEM Constellation 4K   ─┐    Matrix · M/E · Keyer · DSK    ┌─  ATEM-Profil-XML, ATEM UDP
 Ross Ultrix             ─┼──► SuperSource · Mediaplayer  ───┼─  RossTalk, SW-P-08
 Videohub 40×40          ─┤    Aux · Multiviewer · Audio     ├─  Videohub TCP 9990
 Sony XVS · GV K-Frame   ─┘    Makro · Snapshot · Salvo      └─  NMOS IS-05/IS-08/IS-12
```

Drei Schichten, drei Orte:

| Schicht | Wo | Aufgabe |
|---|---|---|
| **Plan** | cable-planner | Soll-Zustand: was wohin geroutet, gekeyt, geladen wird; offline, in der Projektdatei |
| **Simulation** | gemeinsames Paket, läuft im cable-planner | derselbe Soll-Zustand, aber bedienbar: Cut, Auto, Makro, Salvo; zeigt das Ergebnisbild |
| **Live** | lz-camera-bridge | spricht das echte Gerät, Beleg je Eingriff |

Damit wird die Simulation kein drittes Modell neben Plan und Bridge. Sie ist **dasselbe Modell mit einer Uhr**.

---

## 2. Die Funktionsbausteine

Die Liste ist aus dem abgeleitet, was in den LZ-Werkzeugen schon modelliert ist (LZ Camera Bridge, LZ Vision Mixer) und was das ATEM-Profil-XML enthält.

### 2.1 Kreuzschiene (Matrix)

Sie ist der Kern, auch im Mischer. Heute kennen Bridge und cable-planner nur `Map<Ziel, Quelle>` mit einer Ebene. Das reicht für einen Videohub, aber nicht für eine echte Kreuzschiene.

| Prinzip | Bedeutung | Vorbild im Bestand |
|---|---|---|
| **Ebenen (Levels)** | Video, Audio 1–16, Daten, Tally als getrennte Matrizen | SW-P-08 Matrix/Level, Ultrix `L:1,6,10-13`, Quartz-Pegelbuchstaben |
| **Breakaway** | Bild von Quelle A, Ton von Quelle B auf dasselbe Ziel | Extron `level` 0/1/2 |
| **Virtuelle Quellen/Ziele** | „Kamera 3“ = Bild + 4 Ton + Tally als ein Bündel | Association Router, Bridge `route.levels[]` |
| **Tie-Lines** | Weg über mehrere Schienen, mit Wegsuche und Reservierung | Bridge `docs/ressourcenmodell.md` §6 (nur Doku) |
| **Salvo** | benannte Menge von Kreuzpunkten, ein Auslöser | cable-planner `VideohubSalvo`, Bridge `salvo()` |
| **Take-Modus** | vormerken, dann gemeinsam schalten | Bridge `preset/take`, Videohub `takeMode` |
| **Lock/Protect** | Ziel gesperrt (alle) oder geschützt (nur der Besitzer schaltet) | Videohub `VIDEO OUTPUT LOCKS`, LW3 `lockDestination` |
| **Namen** | lang, kurz und UMD je Quelle und Ziel | TSL-UMD: drei Namen |
| **Kandidatenliste** | welche Quellen ein Ziel überhaupt bekommen darf | Steuersysteme |
| **Audio-Shuffling** | Kanal n der Quelle auf Kanal m des Ziels | NMOS IS-08, ATEM `AtemAudioConfig.matrix` |

Ein Videohub nutzt davon Ebene 1, Namen, Salvo, Lock und Take. Eine Ultrix oder ein NV9000 nutzt alles. **Das Profil schaltet frei, die Oberfläche zeigt nur, was das Gerät hat.**

### 2.2 Mischer-Bausteine

| Baustein | Inhalt | Notiz |
|---|---|---|
| **M/E** | PGM-, PVW- und Key-Busse; Übergang (Mix/Dip/Wipe/DVE/Stinger), Rate, T-Bar | n Stück je Profil |
| **Keyer (USK)** | Luma, Chroma, Pattern, DVE; Fill- und Key-Quelle | je M/E n Stück |
| **DSK** | Fill, Key, Tie, Rate | global |
| **SuperSource** | Boxen mit Position, Größe, Crop; Art-Fill/Art-Key, Vorder- oder Hintergrund | eigene Quelle |
| **Mediaplayer / Stills / Clips** | Plätze im Media-Pool, belegt mit PNG oder Clip | **hier lädt man Bilder** |
| **Farbgenerator, Schwarz, Bars** | interne Quellen | |
| **Aux** | Ausgangsbus, Quelle frei wählbar (auch PGM, Clean Feed, M/E n) | |
| **Multiviewer** | Layout + Fenster | gibt es schon: `AtemMvConfig` |
| **Audio** | Matrix + Mischer, AFV, Mix-Minus | gibt es teilweise: `AtemAudioConfig` |
| **Makro** | Schrittfolge aus Befehlen des Modells | lz-vision-mixer `{delayMs, command}` |
| **Snapshot / Show** | eingefrorener Gesamtzustand, benannt | lz-vision-mixer, Broadcast Pix |

**Die interne Signalführung eines Mischers ist ebenfalls eine Matrix.** Jede M/E, SuperSource, jeder Mediaplayer und Aux ist eine Quelle bzw. ein Ziel in der internen Matrix. Damit lässt sich „M/E 2 → SuperSource Box 1 → USK auf M/E 1 mit Mediaplayer 1 als Fill“ mit demselben Signalweg-Code (`signalChain.ts`) verfolgen wie ein Kabel im Plan.

### 2.3 Ressourcen und Betriebsarten

Für Medienserver gibt es schon Modi, die je Auflösung andere Ressourcen haben. Mischer verhalten sich genauso: Die Zahl verfügbarer M/Es, Keyer, Mediaplayer oder SuperSources hängt bei vielen Geräten von Format und Betriebsart ab.

Das Profil führt deshalb **Betriebsarten mit Grenzen**. Die Simulation prüft dagegen und meldet „In dieser Betriebsart hat das Gerät nur n …“ als Hinweis, nicht als Sperre. Alle Grenzwerte kommen aus dem Datenblatt, mit `manufacturerUrl`. Nichts wird geschätzt.

---

## 3. Bedienung: die zweite Ebene

Hier treffen zwei Wünsche aufeinander. Gewünscht war eine getrennte zweite App. Die Hausregel lautet dagegen: Steuerung gehört an das Gerät im Canvas, nicht in ein Extra-Tool. Beides lässt sich verbinden:

1. **Innenansicht am Gerät.** Doppelklick auf den Mischer bzw. Eintrag „Innenansicht“ im Kontextmenü. Der Canvas taucht eine Ebene tiefer, wie beim Öffnen einer Gruppe. Dort stehen die Bausteine als Knoten: Eingänge links, M/Es, SuperSources, Mediaplayer und Keyer in der Mitte, Aux, PGM und Multiviewer rechts. Die internen Wege sind Kanten. Eine Brotkrumenleiste „Plan › ATEM Constellation“ führt zurück. **Das ist das gewünschte Bild, und es ist dieselbe Datei.**
2. **Pult-Ansicht in derselben Innenansicht.** Ein Umschalter „Aufbau | Pult“. „Pult“ zeigt Programm/Vorschau-Reihen je M/E, Cut, Auto, T-Bar, Keyer an/aus, Makrotasten und daneben das **simulierte Ergebnisbild**. Das entspricht dem, was MixEffect am echten Gerät macht, nur gegen die Simulation.
3. **Eigenes Fenster auf Wunsch.** Die Innenansicht lässt sich in ein zweites Electron-Fenster lösen, etwa für einen zweiten Bildschirm. Es bleibt dieselbe App, dasselbe Projekt und derselbe Store, also keine zweite App mit Synchronisierproblem.

Einfach bleiben:
- Das Modul ist in `lib/modules.ts` standardmäßig aus und erscheint nur an Geräten mit Mischer- oder Kreuzschienenprofil.
- Wer nur Kabel zeichnet, sieht nichts davon.
- Kreuzschienen bekommen eine eigene Innenansicht (Matrix, Ebenen, Salvos) und hängen nicht im Mischer: Kreuzschiene und Mischer sind getrennte Produkte.
- Ohne Profil zeigt die Innenansicht nur die Ports. Fehlende Bausteine kann man im Leerzustand ergänzen, gesperrt wird nichts.

### Das Ergebnisbild

Jeder Eingang zeigt sein Namensschild. Das Prüfbild mit Quellennamen gibt es schon (`testPattern.ts`). Ein geladenes PNG ersetzt es, etwa ein Kamerastandbild vom letzten Job.

Die Simulation setzt daraus PGM, Aux und die Multiviewer-Fenster zusammen: Boxen, Keys, DSK und Übergänge als 2D-Komposition im Browser (Canvas/WebGL). Bildqualität ist dafür nicht nötig, nur die richtige Anordnung. Deshalb ist kein GStreamer nötig. lz-vision-mixer bleibt der echte Mischer für echte Signale.

Damit wird auch der Prüfbild-Rundgang (Handbuch, Kapitel Prüfbild) anschaulicher: Der Soll-Weg durch den Mischer wird sichtbar statt nur errechnet.

---

## 4. Dateien: vorbereiten und aufspielen

Das Ziel lautet „vor Ort nur noch aufspielen und los“. Dafür braucht jeder Adapter eine **Ausgabe in das Format des Herstellers** und eine **Einlesung**, damit vorhandene Setups ins Modell kommen.

| Gerät | Ausgabe | Einlesung | Stand heute |
|---|---|---|---|
| ATEM | Profil-XML (ATEM Software Control „Restore“) | dieselbe Datei | nur der Audio-Teil wird gepatcht (`atemAudioMappingXml.ts`), der Rest bleibt byte-gleich; Vorlage des Formats: `pyAtemSim/default_config.xml` |
| ATEM Media-Pool | Bilder per Upload aus der Simulation | – | Swift-Atem kann den Media-Pool-Transfer, siehe `docs/atem-pruefstand.md` |
| Videohub | Labels + Routing-Dump | Dump | vorhanden (`exportVideohub.ts`) |
| SW-P-08 / Ultrix / Quartz | Salvo- und Namenslisten | Dump über die Bridge | Treiber in der Bridge, keine Dateiausgabe |
| Companion | Tastenseiten für Salvos und Makros | – | `companionControl.ts` als Ansatz |
| lz-vision-mixer | Show-JSON | Show-JSON | Format vorhanden |
| NMOS | IS-05-Bulk-Connections, IS-08-Maps | IS-04-Registry lesen | nicht vorhanden |

Grundregel wie beim Audio-Teil: **Was das Modell nicht kennt, bleibt in der Datei unverändert.** Beim Einlesen geht nie etwas verloren, beim Ausgeben wird nur überschrieben, was im Plan bearbeitet wurde.

---

## 5. Simulator nach außen: echte Software an der virtuellen Anlage

Der Schritt über MixEffect hinaus: Die Simulation **spricht das Protokoll des Geräts**. ATEM Software Control, Companion, ein Stream Deck oder die Bridge verbinden sich mit dem cable-planner, als wäre er der Constellation.

- **ATEM, UDP 9910.** `atem-connection` ist offen. Der Server bildet die Zustandsbefehle nach, die das Modell kennt. Was pyAtemSim (TVS HD) und Swift-Atem (nur Busse) nicht können, kommt schrittweise dazu: mehrere M/Es, Keyer, SuperSource und Mediaplayer.
- **Videohub, TCP 9990.** Das Protokoll ist Text und klein, die Gegenstellen aus den Bridge-Tests sind schon fast ein Server.
- **SW-P-08** für Kreuzschienen-Steuersysteme.

So probiert man das ganze Pult-Setup aus, inklusive Companion-Seiten und Tally, bevor man vor Ort ist. Die Bridge schaltet dabei mit `ControlTarget = simulator`, das Feld gibt es schon, und der Beleg vermerkt es.

**Sicherheit:** Der Simulator lauscht standardmäßig nur auf 127.0.0.1 und unter einer eigenen, im Fenster angezeigten Adresse. Eine Verwechslung mit der echten Anlage darf nicht möglich sein .

---

## 6. NMOS als gemeinsame Sprache (IS-04, IS-05, IS-08, IS-12)

NMOS ist nicht ein weiteres Protokoll neben den anderen, sondern **die Form des Modells**:

| Modell | NMOS |
|---|---|
| Gerät, Baustein | IS-04 Node / Device |
| Quelle, Ziel (Port, Matrixeingang, M/E-Ausgang) | IS-04 Sender / Receiver mit Flow |
| Kreuzpunkt, Salvo | IS-05 Connection, Salvo = Bulk-Connection, Take = `activation` (`activate_immediate` / `activate_scheduled_absolute`) |
| Audio-Shuffling | IS-08 Channel Mapping |
| Baustein-Parameter (Keyer, Übergang, Box) | IS-12 / MS-05-02: Block und Worker, Eigenschaften mit Typ und Grenzen |
| Tally, GPI | IS-07 Events |

Für den Planner folgt daraus:
- **IS-04/IS-05 ausgeben.** Der Plan erzeugt für eine 2110-Anlage die Soll-Verbindungen als IS-05-Requests. Ein Broadcast-Controller oder die Bridge spielt sie ein. Das ist der „Job vorbereiten“-Fall für IP-Anlagen.
- **IS-04 einlesen.** Eine vorhandene Registry wird als Geräteliste in den Plan übernommen, als Bestandsaufnahme.
- **IS-12 als Beschreibungssprache für Profile.** Ein Geräteprofil ist ein MS-05-02-Blockbaum. Damit ist das Profilformat nicht selbst erfunden, und die Bridge kann es später als echten IS-12-Node anbieten (Bridge-Ziel, siehe `lz-camera-bridge/docs/architektur-dmf.md`, Schritt 6).

Die Bridge hat den NMOS-Wissensstand (`docs/wissen/nmos.md`), aber noch keinen Code. Das gemeinsame Paket aus §7 ist der Ort, an dem das Modell zum ersten Mal als Code entsteht. Es erfüllt damit den in der Bridge geplanten Schritt 1 („Modell intern“, `packages/model`).

---

## 7. Wo der Code liegt

Keine doppelten Implementierungen.

- **`@lz/switching-model`** als gemeinsames Paket. Es enthält das Funktionsmodell, die Profile, die Simulation (reine Zustandsmaschine, deterministisch, ohne IO) und die Dateiformate (ATEM-XML, Videohub-Dump, IS-05/IS-08-JSON). Es wird im cable-planner vendoriert, wie lz-scopes heute (`src/renderer/vendor/`). Die Bridge nutzt dasselbe Paket.
- **Öffentlich oder privat:**
  - Das Modell, die Simulation und die offen dokumentierten Formate (ATEM-XML, Videohub, NMOS) dürfen im öffentlichen cable-planner liegen.
  - Leitungsprotokolle aus nicht öffentlichen Unterlagen bleiben als Adapter in der privaten Bridge.
  - Profile entstehen aus Datenblättern. Steht ein Profil ohne öffentliche Quelle da, bleibt es privat.
- **Emulator-Server** (§5) laufen im Electron-Hauptprozess des cable-planner (`src/main/services/`), wie heute die ATEM-Sitzung. Im Browser-Build gibt es keine UDP-Server, die Simulation läuft dort trotzdem.
- **MCP:** Werkzeuge `list_switch_blocks`, `set_crosspoint`, `set_salvo` und `run_macro` gegen das Modell. Heute hat MCP für Mischer und Kreuzschienen nichts. So kann eine KI einen Job vorbereiten („Bau mir eine SuperSource mit den Kameras 1–4“).

---

## 8. Profile: wie aus dem Protokollwissen viele Geräte werden

Die Zahl der Profile ist der Maßstab für „universell“. Die Quellen liegen schon vor:

| Quelle | Inhalt | Nutzen für Profile |
|---|---|---|
| Gerätekatalog klassischer Tally-Systeme | rund 40 Kreuzschienen- und 24 Mischerfamilien | Liste, **welche** Geräte; Maßstab „vollständig“ |
| Bridge-Treiber (`router/`, `switcher/`) | 19 Router-Protokolle, 11 Mischer-Treiber | **wie** man sie anspricht und welche Prinzipien das Protokoll kennt (Ebenen, Salvo, Lock) |
| ATEM-Profil-XML | vollständiger Zustandsbaum | Bausteine und Felder für ATEM |
| Broadcast Pix, lz-vision-mixer | Show-, Makro- und Snapshot-Modelle | Makro und Snapshot allgemein |
| Datenblätter | Mengen und Grenzen je Betriebsart | **die Zahlen**, immer mit Beleg |

Ein Profil ist klein. Es nennt die Bausteine mit Anzahl, die Betriebsarten mit Grenzen, die Namen der Quellen-IDs (z. B. ATEM 8000+n für Aux, 10010 für PGM, aus `atemPortSources.ts`) und den Adapter. Die M/E-Zahl, die heute nur im Gerätenamen steht, wird damit ein Feld.

---

## 9. Umsetzung in Stufen

Jede Stufe ist für sich nützlich und einzeln auslieferbar.

| Stufe | Ergebnis | Nutzen ohne die nächste |
|---|---|---|
| **1 Modell + Profilfeld** | Paket mit Bausteinen, Kreuzschiene mit Ebenen; Profilfeld im Katalog; ATEM Constellation (alle Größen) und Videohub als erste Profile | Kreuzpunkte mit Ebenen und Breakaway planbar; Fähigkeiten als Feld statt im Namen |
| **2 Innenansicht „Aufbau“** | zweite Ebene im Canvas, Bausteine als Knoten, interne Wege, PNG in Mediaplayer laden | **die gewünschte Visualisierung**; Doku und Übergabe |
| **3 Simulation + „Pult“** | Cut, Auto, T-Bar, Keyer, Makro, Salvo; Ergebnisbild aus Namensschildern/PNGs | Job testen ohne Gerät |
| **4 ATEM-Profil-XML voll** | Einlesen und Ausgeben aller Abschnitte, Rest byte-gleich; Media-Pool-Upload | „Vor Ort aufspielen und los“ |
| **5 Emulator-Server** | ATEM UDP 9910, Videohub 9990 | ATEM Software Control, Companion und Bridge an der virtuellen Anlage |
| **6 NMOS** | IS-05/IS-08 ausgeben, IS-04 einlesen, Profile als MS-05-02-Blockbaum | 2110-Jobs vorbereiten; Brücke zur DMF-Architektur der Bridge |
| **7 Profile in der Breite** | Ross, Sony, GV, Panasonic, For-A, Ultrix, NV9000, Quartz … nach dem Gerätekatalog | universell |

Abnahme für Stufe 2/3 ist **das Beispiel aus dem Gespräch**:

> M/E 2 läuft in SuperSource Box 1. Auf M/E 1 liegt ein USK mit Mediaplayer 1 (geladenes PNG) als Fill. Die Innenansicht zeigt diesen Weg ohne Erklärung, und PGM zeigt nach „Auto“ das richtige Bild.

---

## 10. Offen, vor dem Bau zu klären

1. **Wer liefert die Datenblattzahlen** für die Constellation-Betriebsarten (M/E, Keyer, SuperSource, Mediaplayer je Format)? Ein echtes Profil-XML aus einem laufenden Job wäre die beste Vorlage für Stufe 4.
2. **Wo liegt das Paket:** eigenes Repo (öffentlich) oder ein Ordner im cable-planner, aus dem die Bridge vendoriert? Empfehlung: zuerst im cable-planner (`src/shared/switching/`), ein eigenes Repo erst, wenn die Bridge es tatsächlich einbindet.
3. **Zweites Fenster** in Stufe 2 oder erst später? Empfehlung: später. Erst die Innenansicht im Canvas, dann sehen, ob sie auf einem Bildschirm reicht.
4. **Anwendertest:** Testversion vor Stufe 4, damit das XML gegen echte Constellation-Setups geprüft wird.
