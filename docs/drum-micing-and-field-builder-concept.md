# Drum-Mikrofonierung, Mikrofon-Datenmodell & User-Feld-Builder

Status: **umgesetzt** (alle vier Bausteine live) — Konzept + Recherche unten dokumentiert.
Bezug: Audio-Domäne der Suite; baut auf `categorySchemas.ts` + `categoryProps` auf.

## Umsetzungs-Stand (2026-07)

Alle vier Konzept-Bausteine sind implementiert und getestet:

1. **Schema** — Kategorien `Mikrofone` + `Mischpult`; Mikrofon-Schema mit
   Wandlerprinzip, Richtcharakteristik (Kugel…Shotgun/Boundary/Multi), Speisung
   (48V/T-Power/Plug-in/Batterie), Kapsel, typ. Einsatz, Max SPL, Frequenzgang,
   Empfindlichkeit, Eigenrauschen, Pad/Low-Cut, Anschluss; Mischpult-Schema
   (Kanäle/Busse/Aux/Matrix/DCA/Motor-Fader/Szenen/Automix/Latenz/I/O-Slots).
2. **Mikrofon-Katalog** — `micCatalog.ts`, 36 datenblatt-recherchierte Mics mit
   GUID-Identität, Fachdaten in `categoryProps`, 1× XLR-Out.
3. **Feld-Builder** — Settings-Tab „Kategorien & Felder": EAV-Overlay in
   `settingsStore.userSchema`, `schemaForCategory` mischt Built-in + User-Felder,
   Feld-Editor + Key-Kollisions-Schutz; neue Kategorien über das echte
   Kategorie-System. `categoryProps` bleibt offener Beutel → kein Datenverlust.
4. **Drum-Kit** — `DrumMicingDialog` (Werkzeuge-Menü): SVG-Kit, Zonen, Mic-
   Platzierung, Technik-Presets (Minimal/Glyn Johns/Recorderman/Full Close),
   Live-Ableitung Kanalliste + Phantom-Bedarf (aus echten Katalog-Daten) +
   Stereo-Paare; `drumKit`-Facette verlustfrei im Projekt + `.avplan`.
   **Individuell zusammenstellbar** („Kit bearbeiten"): Zonen per Drag
   verschieben, hinzufügen/umbenennen/löschen, beliebige Kessel/Becken/Perc.

### Runde 2 (2026-07) — DPA-Wissen + Katalog-Ausbau

- **DPA Mic-University** ausgewertet (Polar-Muster, Proximity/Naheffekt,
  Off-Axis-„curtain effect", Specs-Lesehilfe, How-to-mic-Guides). Umgesetzt als
  Schema-Felder: breite Niere (sub/wide), **Klangfarbe/Timbre**, **Off-Axis-Klang**,
  **Naheffekt**, Präsenz-Anhebung, Dynamikumfang, Klang-Notiz. Der Naheffekt wird
  aus dem Polar-Muster abgeleitet (DPA-Physik: Acht > Hyper/Super > Niere >
  breite Niere; Kugel keiner) — Fakt, kein Raten.
- **Mic-Katalog 36 → 184** (148 neu). Bestehende GUIDs unverändert.
- **Max-SPL-Warnung** im Drum-Kit: Kick/Snare mit bekanntem Max SPL < 140 dB
  werden markiert (DPA: ein Snare-Schlag kann 156 dB SPL überschreiten). Nur bei
  bekanntem Wert — kein Raten.

---

## 0. Kernbefund vorweg: „Sind die Elemente alle gleich aufgebaut?" — Ja.

Der Cable-Planner hat **eine** Geräte-Struktur und **ein** generisches Fachdaten-System.
Genau das macht sowohl das Mikrofon-Feature als auch den Feld-Builder klein:

- **Jedes** Gerät ist ein `EquipmentItem` (types/equipment.ts). Kamera, Switch,
  Mischpult, Mikrofon — dieselbe Struktur, unterschiedliche `category`.
- **Jeder** Anschluss ist ein `Port` (gleiche Struktur überall).
- **Fachdaten** liegen als `categoryProps: Record<string, string|number|boolean>`
  am Gerät — ein neutraler Werte-Beutel, der mit Projektdatei und Library-Template
  mitwandert.
- **Welche** Fachfelder eine Kategorie hat, steht in `CATEGORY_SCHEMAS`
  (`categorySchemas.ts`) als Liste von `CategoryFieldDef` (Schlüssel, bilinguales
  Label, Typ `text|number|select|boolean`, Einheit, Select-Optionen).
- Gerendert wird das generisch von `CategoryPropsSection` — **kein** Einzelfall-Code
  pro Feld. Ausgegeben (BOM/Print) von `formatCategoryProps`.

Die Audio-Kategorie führt **heute schon**: `polarPattern` (Kugel/Niere/Superniere/
Acht), `transducer` (Kondensator/Dynamisch/Bändchen), `powering` (**48V Phantom**/
T-Power/Plug-in/keine), `impedanceOhm`, `channels`, `sampleRate`.

Damit ist die Frage beantwortet: Der „Builder" muss keine neue Objekt-Welt bauen —
er muss `CATEGORY_SCHEMAS` **von hartkodiert auf user-editierbar** heben. Das ist
ein klassisches **EAV-/Dynamic-Schema-Pattern** (Entity-Attribute-Value): das
Schema (Attribut-Definitionen) wird zur Laufzeit-Daten, die Werte hängen schon
heute pro Gerät dran.

---

## 1. Drum-Mikrofonierung

### 1.1 Marktrecherche — gibt es das schon?

Kurz: **Kein dediziertes interaktives Drum-Mic-Placement-Tool** ist verbreitet.
Was existiert, ist ausschließlich **statisches Lehrmaterial**:

- Shure „Microphone Techniques for Drums" (PDF-Guide mit Diagrammen)
- DPA „How to mic a drum kit" (Mic-University-Artikel)
- AKG/Harman, Sweetwater, Berklee Online, Produce Like A Pro — Bebilderte Guides
- Benannte Techniken: **Glyn Johns**, **Recorderman**, XY/ORTF-Overheads

→ **Lücke = Chance.** Ein Tool, das (a) ein visuelles Drumset zeigt, (b) Mics per
Drag platzieren lässt, (c) Preset-Techniken (Glyn Johns …) als Startpunkt anbietet
und (d) direkt die **Kanalliste/Stagebox-Patch/Phantom-Bedarf** ableitet, gibt es
so nicht. Das passt exakt zur Suite-Idee „Planung statt Zettel".

### 1.2 Was das Feature liefert

1. **Visuelles Drumset** (2D-Draufsicht, wie die MultiCam-Venue-Canvas — Konva/
   SVG): Kessel als benannte Zonen (Kick, Snare Top/Bottom, HiHat, Tom 1–n,
   Ride, Crash L/R, Overhead L/R, Room L/R, Hi-Hat).
2. **Mic-Platzierung** per Drag aus der Mikrofon-Bibliothek auf eine Zone. Jede
   Platzierung = `{ micId (deviceTypeId), zone, position?, technique? }`.
3. **Techniken als Presets**: „Glyn Johns (4 Mics)", „Recorderman", „Full Close
   Micing (8–12)", „Minimal (Kick+OH)". Preset = Liste von Zonen + empfohlener
   Mic-Klasse (nicht erzwungen — der User wählt konkrete Modelle).
4. **Ableitungen (der eigentliche Nutzen, kein Raten):**
   - **Kanalliste**: pro Mic ein Input-Kanal, mit Zonen-Label („Kick In", „SN
     Top" …). Direkt an eine Stagebox/Pult aus dem `audioCatalog` patchbar.
   - **Phantom-Bedarf**: Summe der Mics mit `powering = p48` → Warnung, wenn die
     gewählte Stagebox/Pult nicht genug 48V-fähige Preamps hat.
   - **Stereo-Paare**: Overheads/Rooms als L/R-Paar markiert (analog Quad-/
     Dual-Link bei SDI).
   - **BOM**: Mics + benötigte Kabel (XLR-Längen), Stative/Clamps.

### 1.3 Datenmodell-Anbindung

- Neue Domänen-Facette `drumKit?: { zones: DrumZone[]; mics: DrumMicPlacement[] }`
  am Projekt (analog `avForeign`/Location-Frames). **Verlustfrei** in `.avplan`
  mitgeführt.
- `DrumMicPlacement.micId` referenziert die **stabile deviceTypeId** aus der neuen
  Mikrofon-Bibliothek (Abschnitt 2) — dieselbe GUID-Identität wie überall, kein
  Namensraten.
- Grundsatz „nichts erfinden": Ein Mic ohne Datenblatt-Match hat keine erfundenen
  Specs — es bleibt `portsUnknown`/spec-unknown und der Plan-Check mahnt.

---

## 2. Mikrofon-Datenmodell (alle bekannten Typen anlegen)

### 2.1 Recherche — welche Felder Datenblätter/Mitbewerber führen

Abgeglichen mit DPA „How to read microphone specifications", Shure „Mic Basics",
mynewmicrophone.com „Full List of Microphone Specifications", B&H eXplora. Die
**Pflicht-/Kernfelder** eines Mic-Datenblatts:

| Feld | Beispielwerte | im Schema heute? |
|---|---|---|
| **Wandlerprinzip** (transducer) | Kondensator / Dynamisch / Bändchen | ✓ `transducer` |
| **Richtcharakteristik** (polar pattern) | Kugel / Niere / Superniere / Hyperniere / Acht / Keule (Shotgun) | ✓ `polarPattern` (erweitern) |
| **Speisung** (powering) | 48V Phantom / T-Power (12V) / Plug-in / keine (dynamisch) | ✓ `powering` |
| **Umschaltbare Charakteristik** | Multipattern ja/nein | + neu |
| **Frequenzgang** | 20 Hz – 20 kHz | + neu `freqResponse` |
| **Max. Schalldruck (Max SPL)** | 130 / 140 / 150 dB SPL | + neu `maxSplDb` (wichtig für Kick/Snare!) |
| **Empfindlichkeit** (sensitivity) | -54 dBV/Pa … | + neu `sensitivity` |
| **Impedanz** | 50–600 Ω | ✓ `impedanceOhm` |
| **Eigenrauschen** (self-noise) | 7–20 dB-A (nur Kondensator) | + neu `selfNoiseDb` |
| **Anschluss** | XLR-3 / Mini-XLR / TA4 / fest | → `Port.connectorType` |
| **Kapsel/Bauform** | Großmembran / Kleinmembran / Clip / Grenzfläche / Shotgun | + neu `capsule` |
| **Pad / Low-Cut** | -10/-20 dB, 80/120 Hz | + neu (boolean/text) |
| **typ. Einsatz** | Kick / Snare / Overhead / Gesang / Instrument | + neu `micApplication` (hilft dem Drum-Preset) |

Grundsatz: **Max SPL** und **Speisung** sind die zwei Felder, die im Drum-Kontext
echte Fehler verhindern (Kondensator ohne Phantom = tot; Mic mit zu niedrigem Max
SPL an der Kick = Verzerrung). Sie gehören ins Schema, nicht ins Raten.

### 2.2 Mikrofon-Bibliothek (`micCatalog`)

Neue Kategorie **„Mikrofone"** + Katalog analog zu den bisherigen (GUID je Eintrag,
Datenblatt-Quelle, konservative Needles). Kandidaten (Broadcast/Live/Studio-Standard):

- **Dynamisch (Drum/Instrument)**: Shure SM57, SM58, Beta 52A, Beta 91A, Beta 57A,
  SM7B; Sennheiser MD421, e604, e602, e906; Audix D6, i5, D2/D4; Beyerdynamic M88/M201
- **Kondensator Kleinmembran (Overheads/HiHat/Ride)**: Neumann KM184, AKG C451,
  Rode NT5, sE8, DPA 4011/2011, Shure SM81
- **Kondensator Großmembran (Room/Vocal/Broadcast)**: Neumann U87, TLM103, AKG C414,
  Rode NT1, Shure SM7B (dyn., s.o.)
- **Bändchen (Room/Gitarre)**: Royer R-121, AEA R84, Coles 4038
- **Grenzflächen/Boundary (Kick In, Konferenz)**: Shure Beta 91A, Crown PZM
- **Broadcast/Reportage (Shotgun/Lav)**: Sennheiser MKH416, Rode NTG, DPA 4060/6060
  Lav, Sennheiser MKE2

Jeder Eintrag trägt: transducer, polarPattern, powering, maxSplDb, capsule,
micApplication + `Port` (meist 1× XLR-Out male). Unsichere Modelle → nicht rein.

---

## 3. Der User-Feld- & Kategorie-Builder (das Kernstück)

### 3.1 Anforderung (O-Ton)

> „…dass man als User nicht nur neue Geräte-Kategorien anlegen können muss,
> sondern auch neue Felder wie z. B. pickup patterns. Da braucht man dann ja einen
> Builder für in der UI."

### 3.2 Warum das klein ist

Das Schema ist heute eine TS-Konstante (`CATEGORY_SCHEMAS`). Der Builder macht
daraus **Daten**, die im Projekt/den App-Settings liegen und zur Laufzeit die
gebauten Schemas **überlagern/ergänzen**. Das ist das dokumentierte EAV-/
Dynamic-Form-Pattern: „das Schema als Zeilen statt Spalten". `CategoryFieldDef`
ist bereits exakt die dafür nötige Struktur (Typ-Tag `text|number|select|boolean`
= „control type", `options` = Auswahl, `unit`, bilinguales Label).

### 3.3 Architektur

```
Effektives Schema(Kategorie) =
    BUILT_IN_SCHEMAS[kat]              // hartkodiert, versioniert (heute)
  + userFieldDefs[kat]                // NEU: user-definierte Felder
  + customCategories[]                // NEU: ganz neue Kategorien
```

- **Speicherort**: `settingsStore` (app-weit, gilt für alle Projekte des Users) —
  optional zusätzlich pro Projekt (`project.customSchema`) für projektspezifische
  Felder, verlustfrei in `.avplan`. Empfehlung: beides, App-weit als Default,
  Projekt-Overlay für Sonderfälle.
- **Migration**: greift `healProjectPositions`-Muster — unbekannte `categoryProps`-
  Keys werden **nie verworfen** (der Werte-Beutel ist offen), auch wenn ein
  Feld-Def fehlt. So gehen Daten nie verloren, selbst wenn ein User-Feld gelöscht
  wird (MVR-Prinzip „don't alter what you don't understand").
- **Kollision**: User-Feld-Key darf einen Built-in-Key nicht überschreiben →
  Builder validiert Keys (kebab/camel, eindeutig je Kategorie), warnt laut.

### 3.4 Der Builder-UI (neuer Settings-Tab „Kategorien & Felder")

Reihen-Editor, weil „alle Elemente gleich aufgebaut" sind — eine Feld-Zeile =
ein `CategoryFieldDef`:

1. **Kategorie wählen/anlegen** (Dropdown + „+ Neue Kategorie"). Neue Kategorie =
   Name (DE/EN) + optional Icon + Basis (leer oder von bestehender kopiert).
2. **Feld-Liste** der Kategorie (Built-ins read-only/grau, User-Felder editierbar,
   Drag-Sort).
3. **„+ Feld"** öffnet den Feld-Editor:
   - Label (DE/EN), Schlüssel (auto aus Label, editierbar)
   - Typ: `text | number | select | boolean` (+ perspektivisch `multiselect`,
     `range`, `polar-pattern` als spezialisierter Select mit Icons)
   - Einheit (bei number/text), Platzhalter
   - bei `select`: Options-Liste (value + DE/EN-Label), Zeilen-Editor
4. **Live-Vorschau**: rechts wird `CategoryPropsSection` mit dem Entwurf gerendert
   — WYSIWYG, weil derselbe generische Renderer.

Neue Typen (z. B. `polar-pattern`) sind additive Erweiterungen von
`CategoryFieldType` — der Renderer bekommt pro Typ genau eine Render-Zweig-Ergänzung.
Für „pickup patterns" reicht faktisch schon `select` mit Icon-Optionen; ein
dedizierter `polar-pattern`-Typ ist Kür (zeigt die Polar-Diagramm-Grafik).

### 3.5 Nicht-Ziele / Leitplanken

- Der Builder ändert **nur UI + Fachdaten-Schema**, nie die Kern-Invarianten
  (Ports, Kabel-Logik, GUID-Identität). Analog zum Modul-Toggle-Grundsatz:
  „ohne Funktionen zu löschen".
- Built-in-Schemas bleiben Code (versioniert, testbar); User-Felder sind Overlay.
  So kann ein App-Update Built-in-Felder ergänzen, ohne User-Definitionen zu
  zerstören.

---

## 4. Mischpult-Eigenschaften jenseits von Inputs/Outputs

Recherche (Sweetwater „Digital Mixers Compared", ProSoundWeb „Large-Format Digital
Consoles", B&H Digital Mixer Roundup, Hersteller-Specs). Relevante Differenzierungs-
Felder, die **nicht** in der Port-Liste stecken — Kandidaten für ein
`Mischpult`-Kategorie-Schema:

| Feld | Beispiel | Warum relevant |
|---|---|---|
| **Verarbeitungs-Kanäle** (mix channels) | X32: 40 · SQ-7: 96 · StudioLive 64S: 76 | Kapazitätsplanung ≠ physische Inputs |
| **Busse** (mix buses) | X32: 25 · dLive: 64 | wie viele Mixe/Sends |
| **Aux/Sends** | 16 | Monitor-/FX-Wege |
| **Matrix** | 6×8 | Zonen-/Delay-Verteilung |
| **DCA/VCA-Gruppen** | 8 | Steuerungs-Gruppen |
| **Abtastrate** | 48 / 96 kHz | ✓ `sampleRate` (vorhanden) |
| **Latenz** | < 0.7 ms | Monitoring-tauglich |
| **Motor-Fader** | 25 × 100 mm | Szenen-Recall mit Feedback |
| **Fader-Anzahl gesamt** | 26 | Bedienoberfläche |
| **Szenen-/Snapshot-Speicher** | 100 Szenen | Show-Recall |
| **Automix** | Dugan / Dan Dugan | Konferenz/Talk |
| **Onboard-FX** | 8 Racks / 99 | wie viele FX gleichzeitig |
| **DSP-Engine** | XCVI / SHARC | Verarbeitungs-Reserve |
| **Audio-Netzwerk-Karten-Slots** | 2× (Dante/MADI/Waves) | Erweiterbarkeit (ergänzt Ports) |
| **Bit-Tiefe** | 24 bit | Signalqualität |
| **Steuer-Protokolle** | OSC / MIDI / MCU | Fernsteuerung/Integration |

Empfehlung: neues Schema **`Mischpult`** (oder Erweiterung von `Audio` für
`audioType=mixer`) mit den obersten ~8 Feldern (Kanäle, Busse, Aux, Matrix, DCA,
Motor-Fader, Szenen, Automix). Samplerate/Impedanz bestehen schon. Das ist zugleich
der erste **echte Anwendungsfall des Feld-Builders**: Diese Felder könnte ein User
sich auch selbst anlegen — wir liefern sie als sinnvollen Built-in-Default.

---

## 5. Umsetzungs-Reihenfolge (Vorschlag, gestaffelt)

1. **Schema erweitern (klein, sofort)**: Mic-Felder (maxSplDb, capsule,
   micApplication, freqResponse, selfNoise) + Mischpult-Felder ins `CATEGORY_SCHEMAS`;
   `polarPattern` um Hyperniere/Keule ergänzen. Rein additiv, testbar.
2. **`micCatalog`** (Datenblatt-Recherche wie gehabt, GUID-Identität) + Kategorie
   „Mikrofone".
3. **Feld-Builder** (Settings-Tab): User-`CategoryFieldDef`-Overlay in
   `settingsStore`, generischer Renderer + Live-Vorschau, Key-Validierung,
   verlustfreie `categoryProps`.
4. **Drum-Kit-Canvas**: 2D-Drumset + Mic-Platzierung + Technik-Presets, Ableitung
   Kanalliste/Phantom-Bedarf/BOM; `drumKit`-Facette verlustfrei in `.avplan`.

Schritt 1 ist unabhängig sofort lieferbar; 2–4 bauen aufeinander auf. Vor 3/4
Scope-Abstimmung, da UI-Umfang.

---

## 6. Quellen (Recherche 2026-07)

- Drum-Micing: [Shure Drums PDF](https://content-files.shure.com/Pubs/microphone-techniques-for-drums/microphone_techniques_for_drums_english.pdf),
  [DPA](https://www.dpamicrophones.com/mic-university/how-to-mic/how-to-mic-a-drum-kit/),
  [Sweetwater](https://www.sweetwater.com/insync/mic-drum-kit/)
- Mic-Specs: [DPA reading specs](https://www.dpamicrophones.com/mic-university/technology/how-to-read-microphone-specifications/),
  [Shure Mic Basics](https://www.shure.com/en-US/insights/microphone-basics-transducers-polar-patterns-frequency-response),
  [mynewmicrophone full list](https://mynewmicrophone.com/full-list-of-microphone-specifications-how-to-read-a-spec-sheet/)
- EAV/Feld-Builder: [database-modelling.com EAV blueprints](https://database-modelling.com/article/modelling-dynamic-attributes-blueprints-for-the-entity-attribute-value-model-eav),
  [wq.io EAV vs relational](https://wq.io/guides/eav-vs-relational)
- Konsolen: [Sweetwater Digital Mixers Compared](https://www.sweetwater.com/insync/live-sound-month-2025-digital-mixers-compared/),
  [ProSoundWeb Large-Format](https://www.prosoundweb.com/real-world-gear-large-format-digital-consoles-2023/)
