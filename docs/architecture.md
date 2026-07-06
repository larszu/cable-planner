# Cable-Planner — Architektur

Diese Datei beschreibt die zentrale Architektur und die nicht-verhandelbaren
Invarianten der App. Sie ist die Pflicht-Lektüre, bevor strukturelle Änderungen
gemacht werden. Für die interaktive Modul-Übersicht siehe [`app-structure.html`](./app-structure.html),
für einen Wettbewerber-Vergleich [`comparison.html`](./comparison.html).

Stand: v8.2.1 · ~372 TS/TSX-Module · ~109.5k LOC

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
|  Express (ephemeral)  |
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
| `atem:*` | `atemIpc.ts` | `connect`, `disconnect`, `state`, `get-status`, `get-events`, `set-input-name`, `bulk-set-input-names`, `apply-mv-config`, `read-mv-config`, `apply-audio-config`, `discover`, plus `atem:event` (broadcast) |
| `videohub:*` | `videohubIpc.ts` | `send` (TCP zu Blackmagic Videohub) |
| `sync:*` | `syncIpc.ts` | `read-file`, `write-file`, `exists`, `acquire-lock`, `release-lock` |
| `mobileShare:*` | `mobileShareIpc.ts` | `start`, `stop`, `status`, `setProject`, Events: `checksUpdate`, `cableAdded` |
| `credentials:*` | `credentialsIpc.ts` | `get-token`, `save-token`, `delete-token`, `test-token` (via `keytar`) |
| `graphml:*` | `graphmlIpc.ts` | `open-file` |
| `print:*` | `printIpc.ts` | `pdf-bytes` |
| `logs:*` | `logIpc.ts` | `renderer-error` (Renderer → Main, one-way) |
| `signaling:*` | `signalingIpc.ts` | LAN-Signaling-Relay für die Yjs/WebRTC-Kollaboration (#413) |
| `collabDiscovery:*` | `collabDiscoveryIpc.ts` | Bonjour/mDNS-Discovery von Kollaborations-Peers im LAN |

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

`projectStore.ts` ist intern in **14 Slices** unter `src/renderer/store/slices/`
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

### 3.2 · Komponenten

`src/renderer/components/` ist in 24 Subdomänen aufgeteilt:

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
| Sync-Lock | `<shared-pfad>/.cable-planner-sync.lock` | JSON (TTL 2h) |
| Kategorie-Übersetzungen | `localStorage[categoryTranslations]` | JSON-Map |

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

### 6.3 · GraphML-Import (yEd)

`fast-xml-parser` parst yEd-XML. **Sicher gegen XXE** —
fast-xml-parser ignoriert DTDs/external entities per default.

### 6.4 · Videohub (Blackmagic Router)

`videohubIpc.ts` öffnet eine TCP-Verbindung zum Videohub und sendet
plain-text Routing-/Label-Blöcke. Smart-Routing erkennt Quellen anhand
ihrer Namen (Fuzzy-Match mit AI-Provider-Fallback bei niedriger
Score-Schwelle).

### 6.5 · NetBox / DCIM

`library.netbox.*`-Endpunkte importieren Device-Types aus einer NetBox-
Instanz (oder dem öffentlichen device-type-library-Repo). Konflikt-
Resolution bei vorhandenen Library-Einträgen über einen merge/replace/
keep-local Dialog.

### 6.6 · Mobile-Share

`mobileShareServer.ts` startet Express auf ephemerem Port,
liefert `src/mobile/` an Smartphones im LAN. Bidirektional:
- Main → Mobile: aktuelle Projekt-Snapshot (Pull-Endpunkt).
- Mobile → Main: Bauteam-Häkchen (POST `/checks`).

**Mobile ist heute Read/Check-only, kein Editor.** Wenn das mal Editor wird,
braucht es eine richtige API-Schicht statt File-Push.

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
- `keytar` — OS-Credentials (Rentman-Token).
- `@julusian/freetype2` (transitiv via Three) — GreenGo-PDF-Export-Fonts.
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
7. **Three.js-Imports nur in `components/Rack/`** — Bundle-Size-Schutz.
8. **Connection-Locks bei externen Services** (ATEM `connectInFlight`).
9. **Patch-Versionen bevorzugt** — keine großen Sprünge (Standing User Directive).
10. **Keine Emojis im Code** außer auf expliziten Wunsch.
11. **Version lebt nur in `package.json`** — überall sonst gelesen via
    `__APP_VERSION__` (Vite-Define).
12. **Deutsche Strings sind Quell-Sprache** — Fallback in `t(key, fallback)`
    immer deutsch, EN-Übersetzungen im `en`-Dict.

---

## 9 · Offene Architektur-Pfade

Diese Themen sind diskutiert, aber noch nicht entschieden / umgesetzt.

### 9.1 · Store-Slicing — **erledigt** ✓ (#308)

Implementiert. `projectStore.ts` von 2178 LOC auf ~1146 reduziert durch
14 Slices unter `store/slices/`. Siehe §3.1.1.

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
(`npm run test:drag`, treibt den Renderer via Playwright). Bei ~109.5k LOC
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
