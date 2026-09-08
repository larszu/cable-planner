# Cable-Planner — Architektur

Diese Datei beschreibt die zentrale Architektur und die nicht-verhandelbaren
Invarianten der App. Sie ist die Pflicht-Lektüre, bevor strukturelle Änderungen
gemacht werden. Für die interaktive Modul-Übersicht siehe [`app-structure.html`](./app-structure.html),
für einen Wettbewerber-Vergleich [`comparison.html`](./comparison.html).

Stand: v9.0.1 · ~577 TS/TSX-Module · ~169.1k LOC

---

## 1 · Prozessmodell

Cable-Planner ist eine Electron-App mit klassischer Drei-Prozess-Aufteilung,
plus einem optionalen HTTP-Renderer für Mobile-Geräte.

```
+-----------------------+    +-----------------------+    +-----------------------+
|     main (Node)       |    |   preload (Bridge)    |    |   renderer (React)    |
|                       |    |                       |    |                       |
|  - app lifecycle      |<-->|  contextBridge        |<-->|  src/renderer/        |
|  - window creation    |    |  preload.cjs (CJS)    |    |  React 19 + Zustand   |
|  - IPC handlers       |    |  exposes              |    |  ReactFlow + Three.js |
|  - file I/O           |    |  window.cablePlanner  |    |                       |
|  - native deps        |    |                       |    |                       |
+----------+------------+    +-----------------------+    +-----------------------+
           |
           |  HTTP (LAN)
           v
+-----------------------+
|  mobileShareServer    |
|  node:http (ephemeral)|
|  serves src/mobile/   |
+-----------------------+
```

**Wichtig**:
- `preload.cts` ist **CommonJS**, nicht ESM. `tsconfig.preload.json` zwingt das.
  Niemals auf ESM-Imports umstellen — Electron's contextBridge braucht CJS.
- `main/` und `renderer/` sind **ESM** (`"type": "module"` in `package.json`).
  Relative Imports in `main/` brauchen `.js`-Endung (node16 module resolution).
- Renderer hat **keinen Node-Zugriff**. Alles File-/Netzwerk-IO geht über IPC.

---

## 2 · IPC-Architektur

Alle IPC-Channels sind nach Domäne präfixiert. Definitionen in
`src/main/ipc/*.ts`, exponiert via `src/main/preload.cts` als
`window.cablePlanner.<domain>.<action>`.

| Domäne | Datei | Hauptkanäle |
|---|---|---|
| `project:*` | `projectIpc.ts` | `new`, `open`, `save`, `save-as`, `get-recent`, `export-viewer`, `import-annotations` |
| `library:*` | `libraryIpc.ts` | `get-folder-path`, `reveal-folder`, `scan`, `write`, `delete` |
| `rentman:*` | `rentmanIpc.ts` | `get-projects`, `get-project-equipment`, `get-equipment`, `add-project-equipment`, `add-project-file` |
| `netbox:*` | `netboxIpc.ts` | `save-token`, `has-token`, `delete-token`, `normalize-url`, `test-connection`, `get-sites`, `get-racks`, `fetch-snapshot` |
| `atem:*` | `atemIpc.ts` | `connect`, `disconnect`, `state`, `get-status`, `get-events`, `set-input-name`, `bulk-set-input-names`, `apply-mv-config`, `read-mv-config`, `apply-audio-config`, `discover`, plus `atem:event` (broadcast) |
| `videohub:*` | `videohubIpc.ts` | `send` (TCP zu Blackmagic Videohub) |
| `sync:*` | `syncIpc.ts` | `read-file`, `write-file`, `exists`, `acquire-lock`, `release-lock` |
| `mobileShare:*` | `mobileShareIpc.ts` | `start`, `stop`, `status`, `setProject`, Events: `checksUpdate`, `cableAdded` |
| `credentials:*` | `credentialsIpc.ts` | `get-token`, `save-token`, `delete-token`, `test-token` (via `keytar`) |
| `streamKey:*` | `credentialsIpc.ts` | `get`, `has`, `save`, `delete` je Ausspielziel (Initiative 9). Eigener Namensraum neben `credentials:*`, weil ein Kanal eine Domäne ist: dort wohnen die Integrationen (Rentman, NetBox), hier die Ziele des Projekts. Ein Account je Ziel (`stream-key:<id>`) — ein gemeinsamer Blob nähme beim Löschen eines Ziels entweder alle Keys mit oder keinen. |
| `graphml:*` | `graphmlIpc.ts` | `open-file` |
| `print:*` | `printIpc.ts` | `pdf-bytes` |
| `logs:*` | `logIpc.ts` | `renderer-error` (Renderer → Main, one-way) |
| `signaling:*` | `signalingIpc.ts` | LAN-Signaling-Relay für die Yjs/WebRTC-Kollaboration (#413) |
| `collabDiscovery:*` | `collabDiscoveryIpc.ts` | Bonjour/mDNS-Discovery von Kollaborations-Peers im LAN |
| `receipt:*` | `receiptIpc.ts` | `pick`, `attach`, `read`, `reveal` — die Belegdatei einer Auslagenzeile (Bedarf 97). Die Datei liegt in `Belege/` **neben** dem Projekt und nicht im Projekt-File: ein Foto von zwei Megabyte in jeder `.avplan` verteuerte jede Speicherung und jeden Versand. Gespeichert wird unter dem SHA-256 des Inhalts, damit derselbe Beleg nur einmal liegt. Der Dateidialog läuft in main, der gewählte absolute Pfad erreicht den Renderer gar nicht; `reveal` zeigt den Ordner (`showItemInFolder`) statt die Datei zu öffnen — sie kommt von außen. |
| `documentLog:*` | `documentLogIpc.ts` | `append`, `read`, `clear` — das Register der ausgegebenen Dokumente (ADR-004). Es überdauert die Sitzung und gehört damit auf die Platte. |

**Invarianten**:
1. **Ein Channel = eine Domäne**. Niemals einen Channel quer durch Domänen
   benutzen. Wenn eine neue Funktion zu keiner Domäne passt, eine neue Domäne
   anlegen.
2. **Alle Pfade auf der Main-Seite validieren**. Renderer ist
   nicht vertrauenswürdig — kein Renderer-Pfad darf ungeprüft an `fs` gehen.
3. **Schreibende Operationen sind atomic** (siehe §5).

---

## 3 · Renderer-Architektur

### 3.1 · State (Zustand)

Vier Stores in `src/renderer/store/`. Jeder hat einen klar abgegrenzten Concern.

| Store | LOC | Concern | Persist |
|---|---|---|---|
| `projectStore.ts` | ~1146 | Projekt-Daten + composeite slices (siehe §3.1.1), Autosave, Healing, Rentman-Sync | `localStorage[STORAGE_KEYS.projectAutosave]` + Disk via `project:save` |
| `uiStore.ts` | ~1370 | Canvas-Viewport, Panel-Breiten, Edge-Routing-Defaults, Grid/Snap, Geräte-Farben, Device-Config-Library | `localStorage[STORAGE_KEYS.ui]` |
| `projectHistory.ts` | ~200 | Undo/Redo-Stack (max 100), Transactions, 200ms-Coalesce | **Nicht persistiert** — geht beim Reload verloren |
| `settingsStore.ts` | ~90 | Autosave-Intervall, Sync-Pfad/User, Token-Status | `localStorage[STORAGE_KEYS.settings]` |

#### 3.1.1 · Slice-Komposition (#308)

`projectStore.ts` ist intern in **19 Slices** unter `src/renderer/store/slices/`
zerlegt, die alle in den Haupt-Store komponiert werden:

```
annotationSlice          cableSlice          categorySlice
equipmentSlice           groupPresetSlice    groupPresetSpawnSlice
lifecycleSlice           locationSlice       metaSlice
mobileSyncSlice          pendingChangesSlice revisionSlice
selectionLifecycleSlice  templateSlice
```

Jeder Slice ist ein `StateCreator<ProjectState, [], [], Slice>` und bekommt
das `set`/`get`/`store`-Tripel vom Haupt-Store. So bleibt `projectStore.ts`
selbst klein (~1146 LOC, war 2178), während die Domain-spezifische Logik
isoliert testbar ist.

**Invarianten**:
1. **`projectStore` ist Single Source of Truth** für alle Projekt-Daten.
   Komponenten dürfen Projekt-Daten **nicht** lokal duplizieren oder cachen.
2. **`uiStore` enthält keine Projekt-Daten**. Wenn etwas mit dem Projekt
   gespeichert werden muss, gehört es in `projectStore`.
3. **`projectHistory` lauscht auf `projectStore`-Änderungen** via
   `useProjectStore.subscribe`. Niemals direkt im History-Store mutieren.
4. **Coalesce-Window 200ms**: schnelle Bursts (z. B. Drag-Updates) werden zu
   einer Undo-Stufe zusammengefasst. Für explizit größere Operationen
   (Multi-Delete, Paste, Drag-End-Batch) gibt es `projectHistory.transact(fn)`.
5. **Slices mutieren über `set(state => ...)`** — niemals lokal cachen oder
   Side-Effects am Render-Pfad triggern.

#### 3.1b · `liveStore` — die BEOBACHTUNGS-Spur des Canvas

Seit 2026-09-08 gibt es neben `projectStore` (Absicht) einen zweiten,
**nicht persistierten** Store für das, was Mischer und Router gerade tun.
Er ist die Renderer-Seite derselben Trennung, die `lib/asBuilt.ts` seit E-4
für die Dokumente führt.

**Warum nicht im `projectStore`.** Dort liefe eine Ablesung durch Undo/Redo,
durch die Autospeicherung und in die `.cableplan`-Datei. Eine Beobachtung,
die als Absicht gespeichert wird, ist genau der Fehler, den ADR-003 benennt
— und `cable#647` hat gezeigt, wie er sich anfühlt: ein Status-Read hat die
geplante Kreuzschiene still durch das ersetzt, was der Hub im Moment tat.

**Die Regel, die daran hängt** (`lib/signalAnimation.ts`): der Canvas kennt
zwei Betriebsarten und keine dritte.

| Lage | Anzeige |
|---|---|
| kein Kontakt | Schema |
| Kontakt älter als 5 s | Schema |
| Kontakt frisch, über DIESE Strecke nichts bekannt | Schema — **nicht** „aus" |
| Meldung frisch | der gemeldete Zustand |

Der dritte Fall ist der, den man beim Bauen übersieht. Eine Kante als tot zu
zeichnen, weil niemand sie gemessen hat, ist eine Aussage über ein
ungemessenes Kabel.

**Was die Bewegung bedeutet, und was nicht.** Der Zustand ändert nicht die
Farbe — die gehört dem Layer und ist die Legende, nach der der Plan gedruckt
wird. Der Zustand trägt die Bewegung. Einzige Ausnahme ist `down`
(gedämpft), und die gibt es nur mit Beleg.

**Zwei Einspeiser, zwei Hälften.** `useAtemTallyFeed` meldet Tally (1 s,
über die offene IPC-Verbindung), `useVideohubLinkFeed` meldet Kreuzpunkte
(2 s, weil `videohub:read-state` je Aufruf eine TCP-Verbindung zu einem
Gerät im Signalweg öffnet). Fällt einer aus, räumt er **nur seine eigene
Hälfte** — ein toter Router ist kein toter Mischer, und wer alles leerte,
schickte den Nutzer zum falschen Gerät.

**Die Grenze des Routers, ausdrücklich:** ein Videohub meldet Kreuzpunkte
und **nichts** über anliegendes Signal. Deshalb gibt es `routed` als eigenen
Zustand neben `carrying`. Der Kreuzpunkt steht auch dann, wenn upstream die
Kamera aus ist; ihn als „Signal liegt an" zu zeigen machte aus einer
Router-Einstellung eine Aussage über die Anlage.

#### 3.1c · `circuitStore` — die PROBIER-Spur des Schaltbilds

Dieselbe Trennung ein zweites Mal, aus einem anderen Anlass. Seit
2026-09-08 rechnet `lib/circuitSolver.ts`, welche Leuchte bei welcher
Schalterstellung brennt. Dafür braucht er zwei Sorten Angaben, und sie
gehören an verschiedene Orte:

| Was | Wo | Warum |
|---|---|---|
| Die **Verdrahtung**: welches Gerät ein Wechselschalter ist (`EquipmentItem.circuitKind`), an welcher Klemme welcher Anschluss hängt (`Port.circuitTerminal`) | `projectStore`, gespeichert | Das ist der Plan. Er steht auf dem Blatt und geht durch Undo/Redo |
| Die **Schalterstellung** und der Dimmerwert | `circuitStore`, **nicht persistiert** | Umlegen ist Ausprobieren, kein Planen |

**Warum die Stellung nicht ins Projekt darf.** Wer am Schaltbild einen
Schalter umlegt, fragt „was passiert dann". Läge die Stellung im
`projectStore`, wäre jedes Umlegen ein Undo-Schritt, ein Autospeichern und
eine Änderung an der Projektdatei: zwei Minuten Ausprobieren fräsen die
Undo-Historie leer, und die Datei trüge hinterher eine Schalterstellung,
die niemand entschieden hat. Dieselbe Wurzel wie beim `liveStore`
(`cable#647`).

**Die Bauart wird angegeben, nie geraten.** Sie aus der Kategorie zu
schliessen („Leuchte" → `lamp`) wäre der Namensabgleich, gegen den ADR-001
und ADR-002 stehen — und hier fällt er in die gefährliche Richtung: ein
Gerät namens „Wandleuchte" bekäme keinen Knoten, und der Rechner sagte
„brennt nicht". Das sieht aus wie eine Antwort. Ohne `circuitKind` ist ein
Gerät für das Schaltbild **nicht vorhanden**, und der `CircuitChip` nennt
die Zahl derer, die an einem Strom-Kabel hängen und keine tragen.

**Die Klemme hängt am Port, nicht an seiner Position.** Eine
Wechselschaltung unterscheidet Klemme 1 von Klemme 2 — vertauscht man sie,
brennt die Leuchte bei genau den umgekehrten Stellungen. Aus der
Port-Reihenfolge abgeleitet wäre sie eine stille Umverdrahtung bei jedem
Umsortieren (derselbe Befund wie B-33).

**Was der Rechner NICHT ist:** eine elektrotechnische Berechnung oder ein
Sicherheitsnachweis. Der Rückleiter fehlt absichtlich — ein
Wechselschaltungs-Plan zeigt den geschalteten Außenleiter.

#### 3.1d · `patternStore` — die PRÜFBILD-Erwartung

Die dritte nicht persistierte Spur, und sie beantwortet die Frage, die bei
jeder Inbetriebnahme zuerst kommt: **wo kommt was an?**

Der Ablauf ist der aus der Praxis: eine Quelle bekommt ein Prüfbild, jemand
geht die Monitore ab. Was diese App dazu beiträgt, sind zwei Dinge — und die
Grenze dazwischen ist die ganze Entscheidung:

| | |
|---|---|
| **SOLL** | Was der Plan vorsieht: `lib/patternRouting.ts` rechnet ab der Quelle über Blenden, Verteiler und den GEPLANTEN Kreuzpunkt der Kreuzschiene. Braucht keine Anlage, keine Verbindung, keinen Strom |
| **IST** | Was jemand vor dem Monitor gesehen hat. Steht hier **nicht** und wird nicht behauptet |

**Die App hat keinen Videoeingang.** Sie sieht kein Bild und kann keines
sehen. Das Feld auf der Geräte-Karte ist deshalb die **Erwartung** und
ausdrücklich beschriftet: „Erwartung laut Plan". Ein Mini-Monitor, der so
täte, wäre die teuerste Sorte Falschaussage — man erkennt Farbbalken, hält
sie für eine Rückmeldung und hat in Wahrheit den Plan zweimal gelesen.

**Warum der NAME auf dem Bild der eigentliche Inhalt ist.** Farbbalken allein
beantworten nichts: zwei vertauschte Kreuzpunkte sehen mit Balken auf beiden
Wegen völlig richtig aus. Steht auf dem Monitor „KAMERA 3", wo der Plan
„KAMERA 1" vorsieht, ist die Vertauschung in dem Moment gefunden, in dem
jemand hinsieht — ohne Messgerät und ohne zweiten Techniker am Funk.
`lib/testPattern.ts` erzeugt das Bild, `patternRouting` sagt, wo es stehen
müsste.

**Gerechnet wird mit `signalChains`** — derselben Traversierung, die die
Patchliste und die Mehr-Ebenen-Ansicht benutzen. Ein zweiter Weg durch
dieselbe Kreuzschiene wäre die Defektform `zwei-rechnungen`: er liefe beim
nächsten Sonderfall auseinander, und dann widersprächen sich zwei Ansichten
desselben Plans.

**Die offenen Wege stehen gleichberechtigt daneben.** „Von hier weiss der
Plan nicht weiter" ist bei einer Inbetriebnahme die nützlichere Auskunft als
eine kurze Liste, die vollständig aussieht — genau dort steht der Monitor,
an dem später niemand versteht, warum kein Bild kommt.

**Noch nicht gebaut, und mit Absicht getrennt:** die Rückmeldung („stimmt" /
„falsches Bild, es steht X drauf" / „kein Bild"). Sie ist eine Beobachtung
mit Zeitpunkt und gehört damit ins Projekt — wie `TallyCheck` und anders als
die Wahl der Quelle.

### 3.2 · Komponenten

`src/renderer/components/` ist in 27 Subdomänen aufgeteilt:

```
About/         Analysis/      Annotations/   Atem/          Cable/
Calculators/   Canvas/        Export/        Import/        Inventory/
Layout/        Library/       MobileShare/   Onboarding/    Patch/
Print/         Project/       Properties/    Rack/          Rentman/
Settings/      Sync/          shared/
```

Jede Subdomäne ist ein Feature-Cluster. **Cross-Subdomain-Imports sind
erlaubt, aber bewusst halten** — bevor ein neuer Cross-Import kommt, kurz
prüfen, ob das gemeinsame Konzept nach `shared/` gehört.

**Komponenten-Splits abgeschlossen** (#306/#307):
- `EquipmentProperties.tsx` (2314 → ~178 LOC) zerlegt in 25 Sub-Sections
  unter `Properties/sections/` — DragSortable, jede Section eigen-
  ständig persisited Reihenfolge.
- `SettingsDialog.tsx` (2392 → ~60 LOC) zerlegt in 9 Tab-Komponenten
  unter `Settings/tabs/` — ProjectTab, AppearanceTab, EditingTab,
  HotkeysTab, IntegrationsTab, ConfigsTab, ModulesTab, SyncTab, AdvancedTab.

**Top-Files heute (>1500 LOC, weitere Refactor-Kandidaten)**:
- `CanvasArea.tsx` (~1980), `RackBuilderDialog.tsx` (~1800),
  `RentmanImportDialog.tsx` (~1780). Knapp darunter:
  `LibraryPanel.tsx` (~1430), `VideohubExportDialog.tsx` (~1390),
  `AtemMvConfigDialog.tsx` (~1320), `CanvasToolbar.tsx` (~1270).

### 3.3 · Canvas

`ReactFlow 11` ist die Engine. Eigene Erweiterungen:
- `EquipmentNode.tsx` (Custom-Node mit Port-Handles)
- `CableEdge.tsx` (Custom-Edge mit Waypoints, Auto-Routing, Label-Slider)
- `LocationNode.tsx` (Rahmen mit Move-Contents-Logik)
- `LayerVisibilityChips.tsx` (Layer-Filter mit Count-Badges)
- `pathfinding.ts` (Orthogonal-Routing zwischen Ports)

### 3.4 · 3D

`@react-three/fiber` (R3F) + `three.js` für die 3D-Rack-Ansicht in `Rack/`.
STL-Export via `three-stdlib`. **Keine Three-Imports außerhalb von `Rack/`**
— sonst zieht es die ~600 KB Three-Library in den Hauptbundle.

### 3.5 · Internationalisierung

Zentral in `src/renderer/lib/i18n.ts`. Hook `useTranslation()` gibt
`t(key, fallback)`, `format(template, values)` interpoliert `{name}`.

**Konventionen**:
- **Deutsche Strings sind die Quell-Sprache** — Fallback in jedem `t()`-Call
  ist deutsch. Englisch-Übersetzungen liegen im `en`-Dict.
- **~2000 Keys** decken die UI ab (Settings, Dialoge, Properties, Export,
  Patch-Liste, ATEM/Videohub, Rentman-Sync, Onboarding, Inspector).
- Class-Komponenten (ErrorBoundary) nutzen `translate(lang, key, fallback)`
  mit `useUiStore.getState().language` statt Hook.
- Sub-Komponenten innerhalb einer Datei brauchen eigene `const t =
  useTranslation()`-Zeile.

**Bilinguale Kategorien (#309)**:
- `lib/categoryTranslations.ts` verwaltet eine Map vom canonical-
  Kategorie-Key (= `knownCategories[]`-Eintrag) auf `{de, en}` Anzeige-
  Labels.
- `lib/bilingualCategoryDialog.tsx` ist der Prompt mit zwei Sprach-Feldern
  (aktive UI-Sprache oben), wird in `CategorySelect.tsx` und
  `AdvancedTab.tsx` / `LibraryPanel.tsx` als Rename-Dialog genutzt.
- `categoryDisplay(canonical, lang, map)` resolved den Anzeigenamen — mit
  Built-in-Übersetzungen für die 13 DEFAULT_CATEGORIES als Out-of-the-
  Box-Fallback.

---

## 4 · Domänen-Modell

Definiert in `src/renderer/types/`.

```
CablePlannerProject
├── metadata: ProjectMetadata           # Name, Author, Client, Logos, Defaults
├── equipment: EquipmentItem[]          # Geräte mit Ports
├── cables: Cable[]                     # Verbindungen zwischen Ports
├── locations: LocationFrame[]          # Räume / Bereiche (Rahmen mit Inhalt)
├── canvasState: { viewport, ... }      # Pan/Zoom
├── annotations: ProjectAnnotation[]    # Notizen / Markups
├── greengoConfig?: GreenGoConfig       # Intercom-Setup
├── checkState?                         # Mobile-View-Häkchen
├── mode: 'editing' | 'finalized' | 'viewer'
├── sourceIdentities?: SourceIdentity[] # ADR-001 — Rollen („Kamera 1")
├── deliveryDestinations?: DeliveryDestination[]  # Initiative 9 — OHNE Stream-Keys
└── viewerSession?                      # Read-only-Hash
```

**EquipmentItem** (Auszug):
- `id`, `templateId?` (Library-Verweis), `category` (camera, switcher, monitor, ...)
- `inputs[], outputs[]` als `Port[]` mit `connectorType`
  (XLR, BNC, HDMI, Fiber, SFP+, Ethernet, ...)
- `position`, `size`, `nodeColor?`, `rackMode?`, `rackInternalSnapshot?`
- `modes?: DeviceMode[]` (#113) — verschiedene Port-Layouts pro Gerät
- `atemMvConfig?`, `atemAudioConfig?` (ATEM-Mischer spezifisch)

**Cable** (Auszug):
- `from/toEquipmentId`, `from/toPortId`, `type` (Connector-Typ)
- `length`, `routing`, `waypoints[]`, `arrow*`, `bidirectional`
- `layer` (auto-detected aus `type` falls leer), `labelT`, `labelHidden`
- `wireless`, `frequency`, `maxRange` (für Funk-Strecken)
- `cableSpecId?` (Verweis auf eine eindeutige Kabel-Definition aus der
  Library für BOM-Aggregation)

**DeliveryDestination** (Initiative 9, `types/delivery.ts`):
- `platform`, `transport` (SRT/RTMP/HLS), `ingestUrl?`, `account?`
- `encoding: EncodingProfile` — die sechs Felder, die zwischen Primär- und
  Backup-Weg übereinstimmen **müssen**: Auflösung, Video-Codec, Bitrate,
  Bildrate, Keyframe-Abstand, Audio-Abtastrate. Belegt bei YouTube und Castr;
  driften sie auseinander, bricht der Failover.
- `backupOfId?` — zeigt auf das Ziel, dessen Ausweichweg dieses ist. Die
  Richtung ist Absicht: ein `backupId` am Primärziel liesse zwei Backups nicht
  zu und würde bei gelöschtem Backup zum Fehlzeiger.
- `hasStreamKey?` — eine **Tatsache über diesen Rechner**, kein Wert. Der Key
  selbst liegt via `keytar` unter `stream-key:<id>`; er steht **nie** im
  Projekt, weil eine `.avplan` per Mail wandert, in Dropbox liegt und in den
  Mobile-/Web-Viewer geht. Beim Laden wird das Häkchen nachgefragt, nicht
  geglaubt.
- `encoderEquipmentId?` (Bedarf 32) — **die einzige Naht zwischen Ziel-Register
  und Plan.** Zeigt auf das `EquipmentItem`, das dieses Ziel beliefert. Alles
  Weitere ist abgeleitet und wird nicht gespeichert: der Programm-Eingang des
  Encoders kommt aus seinen Anschlüssen, die Quelle aus der Rückwärtssuche im
  Kabelgraph (`labelDerivation.resolveSignalSource`, ADR-001). Die Ableitung
  steht in `lib/deliveryPath.ts` und erzeugt das Blatt `ausspielweg`.
  - **Optional, und das bleibt es.** Ohne Angabe meldet die Kette `no-encoder`
    statt sich einen Encoder auszusuchen. Ein Zeiger auf ein gelöschtes Gerät
    wird beim Laden **nicht** stillschweigend geleert — `encoder-gone` ist die
    ehrlichere Antwort als ein Feld, das kommentarlos leer wird.
  - Die Encoder-Machbarkeit (`lib/encoderFeasibility.ts`) zählt seither **je
    Gerät** statt über den ganzen Plan. Vier Ziele auf zwei Maschinen sind je
    Maschine zwei; die frühere Summe meldete „vier gleichzeitige Ziele, vMix
    führt drei" auf einem korrekten Aufbau.

**NetworkInterface** (Bedarf 19, `types/network.ts`):
- `role` (`media-primary` | `media-secondary` | `control` | `management` |
  `unspecified`), `ipAddress?`, `subnetMask?`, `gateway?`, `macAddress?`,
  `vlanId?`, `switchEquipmentId?`, `switchPort?`, `portId?`
- **Die vier Netz-Felder am Gerät SIND Schnittstelle 0**; `networkInterfaces`
  hält 1..n. Es gibt also je Adresse genau ein Zuhause — keine Spiegelung. Wer
  ALLE Schnittstellen braucht, nimmt die Engstelle
  `lib/networkInterfaces.ts#deviceInterfaces`, nicht `item.ipAddress`.
  Der Grund für die Bauform steht in `types/network.ts`: `ipAddress` steht an
  95 Stellen in 36 Dateien, und ein Umzug in einem Schritt hätte jede
  übersehene Stelle still `undefined` lesen lassen.
- `role` ist ohne Angabe `unspecified` — geraten wird nicht: ob die eine IP
  einer Kamera ihre Steuerung oder ihr Medienweg ist, weiss der Plan nicht.

**LocationFrame**:
- `id`, `name`, `x`, `y`, `width`, `height`, `color`
- `moveContents?` — wenn `false`, bewegt sich Inhalt nicht beim Drag.
  Default ist `true` (heal setzt fehlende Werte auf `true`).

---

## 5 · File-I/O und Persistenz

### 5.1 · Atomic Writes

**Pflicht-Pattern für jeden Schreibvorgang** in `src/main/util/atomicWrite.ts`:

1. Existiert In-Flight-Lock für `targetPath`? → Fehler.
2. Schreibe in `<targetPath>.<random>.tmp`.
3. Wenn `targetPath` existiert: rotiere `<targetPath>.bak`.
4. `rename(tmpPath, targetPath)` (atomic auf POSIX).
5. Bei Fehler: tmp aufräumen, Lock immer freigeben.

**Nutzer**: `project:save`, `library:write`, `sync:write-file`.
**Niemals direkt `fs.writeFile`** für persistente Daten — Crash-Mid-Write
würde sonst das Projekt zerstören.

### 5.2 · Heal beim Laden

`projectStore.loadProject()` → `healProjectPositions(project)`:
- Runden alle Positionen auf Integer (kein Float-Drift).
- Fehlende `layer` auf Cables → Auto-Detect aus `connectorType`.
- Fehlende `moveContents` auf Locations → `true`.
- Fehlende Arrays (`cables`, `locations`, `annotations`) → leeres Array.
- Ungültige Port-IDs werden ge-loggt, aber nicht entfernt
  (User-Daten nicht stillschweigend löschen).

**Heal ist die Schema-Migrationsschicht**. Neue optionale Felder mit Default
gehören hier rein, nicht in einzelne Komponenten.

### 5.3 · Persistenz-Tiers

| Daten | Wo | Format |
|---|---|---|
| Projekt-Datei | User-gewählter Pfad | `.cableplan` (JSON, atomic + .bak) |
| Autosave | `localStorage[projectAutosave]` | JSON |
| Library | `userData/library/{devices,groups}/*.cpdevice\|.cpgroup` | JSON |
| UI-State | `localStorage[ui]` | JSON |
| Settings | `localStorage[settings]` | JSON |
| Window-Geometrie | `userData/window-geometry.json` | JSON |
| Rentman-Token | OS-Credential-Store via `keytar` | OS-eigen |
| Stream-Keys der Ausspielziele | OS-Credential-Store via `keytar`, Account `stream-key:<ziel-id>` | OS-eigen |
| Sync-Lock | `<shared-pfad>/.cable-planner-sync.lock` | JSON (TTL 2h) |
| Kategorie-Übersetzungen | `localStorage[categoryTranslations]` | JSON-Map |
| **Beobachtungen (Tally, Kreuzpunkte)** | **nirgends — `liveStore`, nur im Speicher** | — |
| **Schalterstellungen im Schaltbild** | **nirgends — `circuitStore`, nur im Speicher** | — |
| **Gewählte Prüfbild-Quelle** | **nirgends — `patternStore`, nur im Speicher** | — |

Die letzten beiden Zeilen stehen hier, weil sie Entscheidungen sind und
keine Versäumnisse. Was die Anlage vor einer Stunde tat, weiß diese App nach
einem Neustart nicht mehr, und das ist die richtige Aussage — ein
persistierter Beobachtungsstand sähe beim nächsten Öffnen aus wie ein
aktueller. Und wie die Schalter beim letzten Ausprobieren standen, will
niemand wiederhaben; gespeichert wäre es eine Angabe, die niemand
entschieden hat.

---

## 6 · Externe Integrationen

### 6.1 · ATEM (Blackmagic Switcher)

`atem-connection` npm-Package · UDP-Protokoll im LAN.

**Invarianten in `atemIpc.ts`**:
1. **`connectInFlight`-Lock**: parallele `atem:connect`-Calls werden serialisiert.
   Niemals zwei `new Atem()` parallel — UDP-Packets kreuzen sich sonst.
2. **`removeAllListeners()` vor `disconnect()`** in `ensureDisconnected`.
3. **Promise-Handshake** mit 5s-Timeout statt Polling-Schleife.

**Audio-Routing (#258)**: Profile-XML in/out + Direct-Send via
`atem:apply-audio-config`. Crosspoint-Matrix oder klassischer Mixer im
gleichen XML; Mixer-Sektion wird Round-Trip-erhalten.

**Multiviewer (#288)**: `atem:read-mv-config` holt den Live-Stand vom
verbundenen Switcher, `apply-mv-config` schreibt zurück.

### 6.2 · Rentman (Mietsoftware)

HTTP-API in `services/rentmanApiClient.ts`. Token im OS-Credential-Store.
**Niemals Token loggen oder ins Projekt-File schreiben.**

### 6.3 · NetBox (DCIM, selbst gehostet, #597)

Lesende REST-Anbindung an eine **eigene** NetBox-Instanz, um eine dort
geplante Site oder ein Rack als Kabelplan zu übernehmen
(`services/netboxApiClient.ts`, Referenz unter
`<instanz>/api/schema/swagger-ui/`).

Anders als bei Rentman gibt es keine feste Cloud-URL. Die Basis-URL lebt
deshalb in den App-Settings (`settingsStore.netboxUrl`) und wird bei jedem
IPC-Aufruf mitgegeben; **validiert wird sie immer in main**
(`normalizeNetboxBaseUrl`: nur http/https, `/api…`-Suffix und Query werden
abgeschnitten). Der Main-Prozess bleibt damit zustandslos. Das API-Token
liegt via `keytar` unter dem Account `netbox-api-token` und wird — anders
als der Rentman-Token — **nie an den Renderer zurückgegeben**; der fragt
nur `has-token`.

Genutzte Endpoints (alle nur lesend): `/api/status/`, `/api/dcim/sites/`,
`/api/dcim/racks/`, `/api/dcim/devices/`, die sieben Komponenten-Endpoints
(`interfaces`, `front-ports`, `rear-ports`, `console-ports`,
`console-server-ports`, `power-ports`, `power-outlets`) und
`/api/dcim/cables/`. Paginiert wird über `limit`/`offset` statt über die
`next`-URL — hinter einem Reverse-Proxy zeigt die auf interne Hostnamen.

**Mapping** (`lib/netboxMapping.ts`, rein und unit-getestet):
- NetBox-Komponente → Cable-Planner-Port. Richtungslose Interfaces werden
  als **gespiegeltes In/Out-Paar** angelegt (beide Ports tragen dieselbe
  `netboxId`), damit jedes Kabel als Ausgang→Eingang zeichenbar bleibt.
  Strom/Konsole/Patchfeld haben in NetBox eine echte Richtung und bekommen
  genau einen Port.
- Default `onlyConnectedPorts: true` — ein 48-Port-Switch brächte sonst 96
  Handles auf den Knoten, von denen im Rack eine Handvoll gepatcht ist.
- Layout: eine Spalte je Rack, innerhalb der Spalte nach Höheneinheit
  absteigend gestapelt, optional ein `LocationFrame` je Rack. Der Block
  landet rechts vom Bestand, überdeckt also nie einen vorhandenen Plan.

**Der Abgleich ist per Konstruktion additiv.** NetBox ist die Wahrheit über
die Verkabelung, der Cable Planner über die Darstellung (Positionen,
Farben, Wegpunkte, Labels, Multicore-Bündel). Ein erneuter Lauf legt nur
an, was über `netboxId` noch nicht im Plan ist, und ergänzt an bestehenden
Geräten ausschliesslich neu hinzugekommene Ports. In NetBox gelöschte
Elemente werden als `staleDeviceIds`/`staleCableIds` **gemeldet, nicht
entfernt** — das Aufräumen bleibt beim Planer. Angewendet wird der Plan
atomar über `applyNetboxImport` (`slices/netboxImportSlice.ts`), damit der
Undo-Stack einen Import als einen Schritt sieht.

Nicht zu verwechseln mit `lib/netboxImport.ts` — das ist der ältere
Import einzelner Gerätetypen aus der öffentlichen
`netbox-community/devicetype-library` auf GitHub (statische YAML), ohne
eigene Instanz.

### 6.4 · GraphML-Import (yEd)

`fast-xml-parser` parst yEd-XML. **Sicher gegen XXE** —
fast-xml-parser ignoriert DTDs/external entities per default.

### 6.5 · Videohub (Blackmagic Router)

`videohubIpc.ts` öffnet eine TCP-Verbindung zum Videohub und sendet
plain-text Routing-/Label-Blöcke. Smart-Routing erkennt Quellen anhand
ihrer Namen (Fuzzy-Match mit AI-Provider-Fallback bei niedriger
Score-Schwelle).

### 6.5b · Gerätekonfigurationen tragen ihre Herkunft daneben (Bedarf 43)

Jede Datei, die dieses Programm an ein **fremdes Gerät** ausgibt — Videohub
(Routing und Beschriftungen), Green-GO `.gg5`, ATEM-Audio-XML, die Geräteliste
für `tally-pi` — geht über `lib/deviceConfigExport.ts#exportDeviceConfig` und
bekommt ein zweites File daneben: `<datei>.herkunft.txt` mit Projekt, Stand,
Dokument-Stempel (ADR-004), App-Version und einer Prüfsumme über den Inhalt
der Konfigurationsdatei.

**Die Gerätedatei selbst wird nicht angefasst.** Ob Blackmagics Videohub Setup
eine `#`-Zeile überliest, ob der Green-GO-Editor ein unbekanntes JSON-Feld
durchlässt, ob der ATEM-Importer ein zusätzliches Kommentar akzeptiert — das
steht ohne die Hersteller-Spezifikation nicht fest, und die liegt hier nicht
vor. Dass *unser* Parser (`parseVideohubLabelsTxt`) `#`-Zeilen überspringt,
sagt nichts über das Gerät: die Datei geht dorthin, nicht zu uns zurück. Eine
Konfiguration, die das Pult beim Laden zurückweist, ist beim Load-in schlimmer
als eine ohne Herkunft.

Das Blatt geht **zuerst** raus, die Konfiguration danach: bricht der Browser
die zweite Ausgabe ab, fehlt das Blatt und nicht die Datei, die die Show
braucht.

`deviceConfigProvenance.ts` ist rein (keine Uhr, kein Store);
`deviceConfigExport.ts` setzt Stempel, Uhr und Version zusammen und ist die
einzige unreine Zeile des Wegs.

### 6.6 · Mobile-Share

`mobileShareServer.ts` startet einen `node:http`-Server auf ephemerem Port
(kein Express — die App hat kein Web-Framework als Abhängigkeit),
liefert `src/mobile/` an Smartphones im LAN. Bidirektional:
- Main → Mobile: aktuelle Projekt-Snapshot (Pull-Endpunkt), Passwörter und
  Schlüssel vorher via `stripSecrets` entfernt.
- Mobile → Main: **drei** Schreibwege, nicht einer —
  Bauteam-Häkchen (POST `/checks`), neu angelegte Kabel (POST `/cables`,
  v7.9.54) und Feld-Rückmeldungen (POST `/pending-changes`).
  Alle drei sind token-gated (`authed`, Token aus der QR-Code-URL).

**Mobile ist kein Editor** — aber auch nicht read-only: die drei Wege oben
ändern das Projekt am Desktop. Wer das anders formuliert findet, korrigiert
es; der Dialog-Hinweis sagte bis v7.9.x fälschlich „kann nur lesen, nichts
schreiben", was für eine Sicherheits-Entscheidung des Nutzers die falsche
Grundlage war. Wenn Mobile echter Editor wird, braucht es eine richtige
API-Schicht statt File-Push.

### 6.7 · AI-Provider (optional)

`lib/aiSuggestions.ts` unterstützt **Gemini**, **Claude** und **OpenAI**
Keys (user-supplied, persistiert pro-Provider in localStorage). Wird für
Port-Vorschläge bei neuen Geräten und Smart-Routing-Fuzzy-Matching genutzt.

---

## 7 · Build und Distribution

**Scripts** (`package.json`):
- `dev` — `concurrently` startet Vite + 3× tsc-watch (main/preload/renderer) + Electron.
- `build` — `tsc -p tsconfig.main.json && tsc -p tsconfig.preload.json && vite build`.
- `dist` — `build` + `electron-builder` → Installer in `release/`.

**Versions-Quelle**: einziger Eintrag in `package.json` → `version`.
Vite injiziert ihn build-time als `__APP_VERSION__` in den Renderer.
About-Dialog, StatusBar, ErrorBoundary, main.tsx lesen alle daraus —
nirgendwo hardcoded.

**`electron-builder.js`**:
- macOS: Universal DMG (x64 + arm64), ad-hoc signiert.
- Windows: NSIS-Installer + portable EXE (x64).
- `npmRebuild: true` rebuildet `keytar` und `@julusian/freetype2` für Electron-ABI.

**Release-Workflow** (manuell):
1. `package.json` `version` bumpen.
2. Commit + Tag `vX.Y.Z` + Push (Tag triggert CI-Build).
3. GitHub Release mit Auto-Generated Notes + Installer-Artefakte.

**Native Deps** (achten!):
- `keytar` — OS-Credentials (Rentman-Token, NetBox-Token, Stream-Keys).
- `@julusian/freetype2` — **transitiv via `atem-connection`**, nicht via Three
  und nirgends direkt importiert (`grep -rn freetype src/` ist leer). Er steht
  hier trotzdem, weil `npmRebuild` ihn für die Electron-ABI neu bauen muss.
- `electron-rebuild` muss nach jedem Electron-Update laufen.

---

## 8 · Nicht-verhandelbare Invarianten

Das Wichtigste in Listenform. Niemals brechen ohne expliziten Architektur-Review.

1. **Atomic Writes via `atomicWriteFile`** — niemals direkt `fs.writeFile` für Userdaten.
2. **`healProjectPositions` läuft auf jedes geladene Projekt** — Schema-Migration immer dort.
3. **IPC-Channels sind domain-präfixiert** und in `src/main/ipc/<domain>Ipc.ts` definiert.
4. **`preload.cts` bleibt CommonJS** — Electron's contextBridge braucht das.
5. **Pfad-Validierung passiert in `main`**, nie im Renderer.
6. **`projectStore` ist Single Source of Truth** für Projekt-Daten.
7. **Three.js bleibt hinter der Lazy-Grenze** — Bundle-Size-Schutz. Der
   Import-*Ort* ist dabei nicht das Kriterium: solange ein statisch
   importiertes Modul nach `Rack/` hineinreicht, liegt Three im Haupt-Chunk,
   egal wie diszipliniert die Importe sind. Genau so war es — bis auf
   `lib/exportRack.ts` standen alle Three-Importe brav in `Rack/`, und
   `LibraryPanel` zog den `RackBuilderDialog` statisch herein. Die beiden
   Eintritte (`RackBuilderDialog`, `RackEditorDialog`) sind deshalb `lazy` und
   werden nur gemountet, wenn sie offen sind; gemessen 4.193 → 2.938 kB (gzip
   1.165 → 822). `tests/threeBundleGrenze.test.ts` hält das fest.
8. **Connection-Locks bei externen Services** (ATEM `connectInFlight`).
9. **Patch-Versionen bevorzugt** — keine großen Sprünge (Standing User Directive).
10. **Keine Emojis im Code** außer auf expliziten Wunsch.
11. **Version lebt nur in `package.json`** — überall sonst gelesen via
    `__APP_VERSION__` (Vite-Define).
12. **Deutsche Strings sind Quell-Sprache** — Fallback in `t(key, fallback)`
    immer deutsch, EN-Übersetzungen im `en`-Dict.
13. **Geheimnisse stehen nie im Projekt** — Rentman-Token, NetBox-Token und
    die Stream-Keys der Ausspielziele liegen im OS-Credential-Store via
    `keytar`. Das Projekt trägt höchstens die **Tatsache**, dass eines
    hinterlegt ist, und die gilt für den Rechner, auf dem sie gelesen wird:
    beim Laden wird sie nachgefragt, nicht aus der Datei geglaubt. Der Grund
    ist der Weg der Datei — eine `.avplan` wandert per Mail, liegt in Dropbox
    und geht in den Mobile- wie in den Web-Viewer.
14. **Der Canvas behauptet keinen Anlagenzustand ohne frischen Beleg.** Eine
    Animation, die aussieht wie fließendes Signal, IST eine Aussage über die
    Anlage; niemand liest daneben eine Zahl. Ohne frische Beobachtung zeigt
    der Canvas das **Schema** und sagt das auch (`FlowModeChip`) — und
    „nichts bekannt" ist ausdrücklich nicht dasselbe wie „aus". Beobachtungen
    liegen im `liveStore` und nie im Projekt. Wer eine dritte Quelle
    anschließt, hält sich an dieselbe Grenze: melden, was das Gerät WIRKLICH
    sagt (`routed` ist nicht `carrying`), mit Zeitstempel, und beim Ausfall
    nur die eigene Hälfte räumen.
15. **Was der Nutzer ausprobiert, ist keine Planänderung.** Die
    Schalterstellungen des Schaltbilds liegen im `circuitStore` und nie im
    Projekt; ein Klick auf einen Schalter erzeugt keinen Undo-Schritt, keine
    Autospeicherung und keine Änderung an der Datei. Die VERDRAHTUNG dagegen
    ist Plan und steht im Projekt (`circuitKind`, `circuitTerminal`). Wer
    eine weitere Probier-Ansicht baut — eine zweite Ausspiel-Variante, ein
    „was wäre wenn" auf der Kreuzschiene — trennt genauso: das Ergebnis darf
    gerechnet und gezeigt werden, die Eingabe dafür wird nicht gespeichert,
    und die Ansicht sagt, dass sie gerechnet ist.
16. **Ein BILD auf dem Plan ist die gefährlichste Behauptung von allen.** Ein
    Vorschaufeld auf einer Geräte-Karte sieht aus wie eine Rückmeldung von
    diesem Gerät, und Farbbalken sehen überzeugend nach „Signal ist da" aus.
    Diese App hat **keinen Videoeingang** — was sie zeigt, ist die Erwartung
    aus dem Plan und trägt diese Beschriftung am Feld selbst, nicht nur im
    Streifen. Wer ein weiteres Vorschaufeld baut, hält sich daran: entweder
    es kommt aus einer belegten Quelle mit Zeitstempel, oder es ist als
    Erwartung beschriftet. Es gibt keine dritte Möglichkeit, und „sieht man
    doch" ist keine — die ganze Schwierigkeit ist, dass man es eben nicht
    sieht.

---

## 9 · Offene Architektur-Pfade

Diese Themen sind diskutiert, aber noch nicht entschieden / umgesetzt.

### 9.1 · Store-Slicing — **erledigt** ✓ (#308)

Implementiert. `projectStore.ts` von 2178 LOC auf ~1146 reduziert durch
19 Slices unter `store/slices/`. Siehe §3.1.1.

### 9.2 · Komponenten-Splits — **teilweise** ✓ (#306, #307)

- `EquipmentProperties` → 25 Sub-Sections ✓
- `SettingsDialog` → 8 Tabs ✓
- **Noch offen**: `LibraryPanel`, `RackBuilderDialog`, `CanvasArea`,
  `RentmanImportDialog`.

### 9.3 · Plugin-API

Heute: Erweiterungen brauchen Code-Fork. Ein schmaler Plugin-Slot für
Reports und Library-Loader wäre eine günstige Investition gegen
Bus-Faktor-1.

### 9.4 · Kollaborative Bearbeitung

Drei Optionen mit sehr unterschiedlichem Aufwand:
- **Multi-Mobile-View**: bestehende Mobile-Share-View für mehrere Clients
  ausbauen, Editor bleibt single-user. 1–2 Tage, niedrige Risiken.
- **Yjs-CRDT P2P im LAN**: `yjs` + `y-webrtc`, Projekt-Daten als `Y.Doc`,
  Sync zwischen Electron-Instanzen. ~1–2 Wochen, Store-Schema muss
  CRDT-tauglich werden.
- **Cloud-Backend mit `y-websocket`**: Yjs-Server, Auth, Permissions.
  Mehrere Wochen plus dauerhafte Betriebskosten.

Slice-Architektur (#308) ist die Vorbereitung — jeder Slice macht
immutable Updates, Yjs-Mapping wäre ein Adapter.

**Stand (#413, #471 — weitgehend umgesetzt):** Die Yjs-CRDT-P2P-Variante
ist real implementiert, nicht mehr nur Fundament. Vorhanden unter
`src/renderer/lib/crdt/`:
- `projectCrdt.ts` — Projekt-Collections als `Y.Doc`, Konvergenz bewiesen
  (`npm run test:crdt`, `scripts/crdt-convergence-check.mjs`).
- `storeBinding.ts` — Live-Bindung projectStore ⇄ `Y.Doc`.
- `webrtcProvider.ts` + `broadcastTransport.ts` + `syncTransport.ts` /
  `syncManager.ts` — Transport (`y-webrtc`, dep `^10.3.0`) inkl.
  Broadcast-Fallback.
- `presence.ts` — Presence/Awareness; `collab.ts` + `collabStore.ts` +
  `components/Sync/CollabPanel.tsx` + `lib/collabInvite.ts` — Session,
  UI, Einladungs-Code.
- Main-Seite: `src/main/signalingServer.ts`, `ipc/signalingIpc.ts`
  (LAN-Signaling-Relay), `ipc/collabDiscoveryIpc.ts` (mDNS-Peer-Discovery).

**Noch offen / Reifegrad:** vollständige CRDT-Abdeckung aller Collections
im Live-Betrieb, robuste Undo-Integration über mehrere Clients und ein
optionales Cloud-Backend (`y-websocket`, Auth/Permissions) bleiben offen.

### 9.5 · Tests

`vitest` ist eingerichtet (`npm test` / `npm run test:watch`); dazu kommen
gezielte Node-Checks (`npm run test:crdt`, `npm run test:signaling`), ein
UI-Smoke-Skript (`npm run ui:smoke`) und ein headless Drag-/Interaktions-Test
(`npm run test:drag`, treibt den Renderer via Playwright). Bei ~169.1k LOC
bleibt der Ausbau der Abdeckung wichtig — empfohlene Schwerpunkte:
- Snapshot-Tests auf `healProjectPositions` mit echten
  Beispiel-Projekt-JSONs.
- Property-Tests auf `projectHistory` (Undo-Redo-Invarianten).
- Smoke-Tests auf IPC-Channels (Mock-`fs`).

### 9.6 · Web-Viewer (Issue #143) — **umgesetzt** ✓

Read-only Web-Renderer als eigener Vite-Entry `viewer.html`
(`src/viewer/ViewerApp.tsx`, in `vite.config.ts` als `viewer`-Input) für
Reviewer ohne Desktop-App — rendert ein geladenes `.cpviewer`/`.json`
standalone, keine Edits. Wird über `.github/workflows/pages.yml`
(`npm run build:renderer` → `dist/renderer`) auf GitHub Pages deployt.

---

## 10 · Wo was hingehört (Quick Reference)

| Aufgabe | Hierhin |
|---|---|
| Neue IPC-Funktion | `src/main/ipc/<domain>Ipc.ts` + `src/main/preload.cts` |
| Neuer Service (HTTP, DB, Native) | `src/main/services/` |
| File-I/O-Helper | `src/main/util/` |
| Neuer Renderer-State-Concern | eigener Slice in `src/renderer/store/slices/` |
| Neuer Canvas-Knoten/-Edge | `src/renderer/components/Canvas/` |
| Neue 3D-Visualisierung | `src/renderer/components/Rack/` (Three.js-Grenze) |
| Neuer Domänen-Typ | `src/renderer/types/<thema>.ts` |
| Neue Schema-Migration | `healProjectPositions` in `projectStore.ts` |
| Neues Export-Format | `src/renderer/components/Export/` |
| Neue Berechnung (Length, Power, ...) | `src/renderer/lib/` |
| Neue UI-Texte | `t('domain.key', 'Deutsche Fallback')` + EN-Entry in `lib/i18n.ts` |
| Neue Property-Section | `src/renderer/components/Properties/sections/` + Eintrag in `EquipmentProperties.tsx` Reihenfolge |
| Neuer Settings-Tab | `src/renderer/components/Settings/tabs/` + Eintrag in `SettingsDialog.tsx` Sidebar |
| Neues Geheimnis (Token, Key) | `credentialsService.ts` (`keytar`) + eigener IPC-Namensraum — **niemals** ein Feld im Projekt |
| Neues gestempeltes Dokument | Tabelle in `lib/`, Eintrag in `DOCUMENT_STANDS` (`documentRegistry.ts`), Export via `csvFromTable(..., stamp, docId)` |
| Neue **Gerätekonfiguration** (Datei, die an ein fremdes Gerät geht) | `lib/deviceConfigExport.ts#exportDeviceConfig` — **nicht** `downloadBlob` direkt: sonst geht die Datei ohne Herkunfts-Blatt raus (Bedarf 43) |
| Alle Adressen eines Geräts lesen | `lib/networkInterfaces.ts#deviceInterfaces` — **nicht** `item.ipAddress` (das ist nur Schnittstelle 0) |
| CSV lesen | `lib/csvParse.ts#parseCsv` — die eine Stelle; ein zweiter Parser antwortet beim ersten Semikolon im Feld anders |
