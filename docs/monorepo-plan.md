# Monorepo-Plan: cable-planner · multicam-planner · light-planner

> Status: **Vorschlag / Konzept** — noch nichts migriert.
> Ziel: Die drei eigenständigen Broadcast-Planungs-Apps unter ein Dach bringen,
> ohne laufende Feature-Arbeit (aktuell multicam) zu blockieren.

## 1. Warum überhaupt

Die drei Apps stammen vom selben Autor, sind MIT-lizenziert, offline-first und
zielen auf dieselbe Domäne (Broadcast-Produktionsplanung) und dieselben
Plattformen (macOS/Windows). Der Stack ist nahezu deckungsgleich:

| | cable-planner | multicam-planner | light-planner |
|---|---|---|---|
| Stack | Electron + React 19 + Zustand 5 + Vite + TS | gleich | gleich |
| 3D | Three 0.184 / R3F 9 (nur in `Rack/`) | Three 0.184 / R3F 9 (Kern) | Three 0.184 (Kern) |
| Bundler / Builder | Vite 8 / electron-builder 26 | Vite 6 / electron-builder 26 | Vite 6 / electron-builder 26 |
| Größe | ~100k LOC | ~9k LOC | ~14k LOC |
| Reife | 3-Prozess-Modell, IPC-Domänen, 14 Slices, CRDT-Sync, Mobile-Share, Viewer | Single-Renderer + `electron/main.cjs` | Single-Renderer + `electron/main.cjs` |

**Inhaltliche Überlappung** ist der eigentliche Treiber:

- **multicam** und **light** haben ein quasi identisches Grundgerüst: 2D-Venue-Canvas
  mit Meter-Grid, **Floor-Plan-Import (JPG/PNG/PDF, beide via `pdfjs-dist`)**,
  Kalibrierung, 3D-Preview, Stage-Objekte, Drag-&-Drop-Platzierung. Heute zweimal
  getrennt gebaut.
- **cable-planner** liefert das fehlende Drittel: Equipment, SDI-Signalfluss,
  Verkabelung — die Infrastruktur, die Kameras und Lichter im selben Venue verbindet.
- light-planner besitzt bereits eine `HostAdapter`-Abstraktion
  (`src/integration/hostAdapter.ts`, `cablePlannerHost.ts`), die ausdrücklich dafür
  gebaut ist, in cable-planner als Host eingebettet zu werden. Diese Naht ist die
  Blaupause für die spätere Voll-Integration.

## 2. Zielbild (gestuft)

Drei Stufen, jede für sich nützlich und auslieferbar. Wir committen uns nur auf
**Stufe 1**; Stufe 2/3 sind Optionen, sobald Stufe 1 steht.

```
Stufe 1  Monorepo + Shared Libraries   ← hier starten (risikoarm)
Stufe 2  Eine Electron-Shell, drei Modi, gemeinsamer Venue-Layer
Stufe 3  Ein vereinheitlichtes Dokumentmodell (ein Projektfile)
```

## 3. Stufe 1 — Monorepo + Shared Libraries

### 3.1 Layout

npm-Workspaces (kein zusätzliches Tool nötig; pnpm/turbo optional später):

```
broadcast-planner/                 # neues Dach-Repo (oder cable-planner umbenannt)
├── package.json                   # { "workspaces": ["apps/*", "packages/*"] }
├── apps/
│   ├── cable-planner/             # heutige Repos, unverändert lauffähig
│   ├── multicam-planner/
│   └── light-planner/
└── packages/
    ├── floorplan/                 # PDF/Bild-Import + Kalibrierung
    ├── venue3d/                   # geteilte Three.js-Venue-/Stage-Primitives
    ├── geometry/                  # 2D/3D-Mathe (FOV, Winkel, Snap, Grid)
    ├── device-db/                 # Kamera-/Linsen-/Fixture-/Gel-Datenbanken
    ├── host-adapter/              # die HostAdapter-Naht aus light-planner, generalisiert
    └── ui-kit/                    # geteilte React-Primitives + Theme-Tokens (optional)
```

Die drei Apps bleiben **eigenständig lauffähig** und behalten ihre eigenen
`electron-builder`-Configs und Installer. Es entsteht zunächst **kein** kombiniertes
Produkt — nur geteilter Code.

### 3.2 Konkrete erste Shared-Packages (nach realem Aufwand/Nutzen sortiert)

1. **`@bp/floorplan`** — höchster Sofort-Nutzen, klarster Schnitt.
   Quelle: `light-planner/src/utils/floorPlanLoader.ts` + die Floor-Plan-/Kalibrier-Logik
   aus `multicam` (`Venue2D`) und light (`FloorPlanPanel`). Beide nutzen `pdfjs-dist`,
   beide machen Zwei-Punkt-Kalibrierung. **Halbiert** hier die Wartung.
2. **`@bp/geometry`** — `light-planner/src/core/geometry.ts` + `multicam/src/utils/fov.ts`,
   `camera.ts`. Reine Funktionen, keine UI, einfach zu testen, risikoarm.
3. **`@bp/device-db`** — `multicam/src/data/{cameras,lenses,templates}.ts` +
   `light/src/core/{fixtureLibrary,gelLibrary}.ts`. Reine Daten + Typen.
4. **`@bp/venue3d`** — Three.js-Stage-/Venue-/Grid-Primitives aus `multicam/Venue3D`
   und `light/Scene3D`. **Achtung Bundle-Grenze** (siehe 3.4).
5. **`@bp/host-adapter`** — die bestehende Naht aus `light-planner/src/integration/`
   herausziehen und so verallgemeinern, dass auch multicam sie nutzen kann. Das ist
   der Wegbereiter für Stufe 2.

### 3.3 Versions-Angleichung (vor dem Hochziehen der Packages)

Geringe, überbrückbare Drifts — auf **eine** gemeinsame Version pro Tool:

| Tool | cable | multicam | light | Ziel |
|---|---|---|---|---|
| Vite | 8 | 6 | 6 | 8 (oder zunächst 6, cable zuletzt) |
| TypeScript | ~6.0 | ~5.9 | ~5.6 | 6.0 |
| Tailwind | v4 | v3 | — | v4 (multicam migrieren) |
| React / Zustand / Three | 19 / 5 / 0.184 | identisch | identisch | bereits gleich ✓ |

React, Zustand und Three sind schon synchron — der Hauptknackpunkt sind Tailwind v3→v4
(nur multicam) und Vite 6→8. Beide unabhängig voneinander machbar.
**Standing Directive beachten:** Patch-Versionen bevorzugen, keine großen Sprünge
ohne Grund.

### 3.4 Risiken / Stolpersteine

- **Three.js-Bundle-Grenze (cable-planner):** R3F läuft dort bewusst nur in `Rack/`,
  weil Imports außerhalb ~600 KB in den Hauptbundle ziehen. `@bp/venue3d` muss
  lazy-loadbar sein und darf nicht aus dem cable-Hauptpfad importiert werden.
- **Drei Dokumentmodelle:** `projectStore`-Slices (cable) vs `useStore` (multicam)
  vs `lightingDocument` (light). Stufe 1 fasst sie **nicht** an — erst Stufe 2/3.
- **preload bleibt CommonJS** in cable-planner — Shared-Packages müssen ESM-fähig
  sein, dürfen aber nichts annehmen, das den preload-Build bricht.
- **Tailwind v3/v4-Mischung** im selben Repo: getrennte Configs pro App halten,
  bis multicam migriert ist.

### 3.5 Reihenfolge der Arbeitsschritte

1. Dach-Repo + Workspaces anlegen, drei Apps als `apps/*` einhängen
   (Git-Historie via `git subtree`/`filter-repo` erhalten — siehe §6).
2. CI angleichen: ein Workflow, der pro App lint + `tsc --noEmit` + Tests fährt.
3. `@bp/geometry` und `@bp/device-db` zuerst (reine Funktionen/Daten, null UI-Risiko).
4. `@bp/floorplan` (höchster Nutzen, aber UI-nah — gründlich testen).
5. Versions-Angleichung (Tailwind, Vite) **inkrementell**, App für App.
6. `@bp/host-adapter` herausziehen → Übergang zu Stufe 2.

## 4. Stufe 2 — Eine Shell, drei Modi (Skizze)

cable-planner ist die Host-Plattform (mit Abstand reifste Architektur: IPC-Domänen,
atomic writes, Schema-Migration, Sync, Mobile-Share). multicam und light kommen als
neue Feature-Domänen rein, angedockt über `@bp/host-adapter`, und teilen sich einen
gemeinsamen **Venue-/Floor-Plan-Layer**. Ein Modus-Switch (Cabling / Cameras / Lighting)
statt drei Apps. Der light-`HostAdapter` zeigt bereits, wie Save/Open/Export an den
Host delegiert werden (Doc als JSON im `CablePlannerProject` eingebettet).

Neue IPC-Domänen würden dem bestehenden Muster folgen (`camera:*`, `lighting:*`),
Persistenz über `healProjectPositions` als Migrationsschicht.

## 5. Stufe 3 — Vereinheitlichtes Dokumentmodell (Skizze)

Ein Projektfile hält Venue + Floor-Plan + Kameras + Licht + Cabling. Erst sinnvoll,
wenn Stufe 2 sich bewährt hat. Größter Aufwand, größter Lohn (eine Produktion = eine Datei).

## 6. Historien-Erhalt beim Zusammenführen

Damit `git blame`/Historie der drei Repos erhalten bleibt, die Apps mit
`git subtree add --prefix=apps/<name>` oder `git filter-repo --to-subdirectory-filter`
einhängen, nicht per Copy-Paste.

## 7. Auswirkung auf laufende multicam-Arbeit

Stufe 1 ist bewusst so geschnitten, dass sie **deine laufenden multicam-Features nicht
blockiert**:

- Die Apps bleiben in Stufe 1 eigenständig lauffähig — du arbeitest weiter in
  `apps/multicam-planner` wie bisher.
- Das Herausziehen reiner Funktionen/Daten (`@bp/geometry`, `@bp/device-db`) kollidiert
  kaum mit Feature-Arbeit.
- **`@bp/floorplan`** berührt die Venue-UI — diesen Schritt erst **nach** deinem
  aktuellen multicam-Feature-Stand ziehen, um Merge-Konflikte im `Venue2D`-Bereich
  zu vermeiden.
- Die eigentliche Repo-Zusammenführung (§6) am besten an einem definierten Schnittpunkt
  machen, wenn multicam gerade einen sauberen Stand hat.

## 8. Empfehlung

Mit **Stufe 1** starten, dort zuerst `@bp/geometry` + `@bp/device-db` (risikolos),
dann `@bp/floorplan`. Das halbiert sofort die Doppelarbeit zwischen multicam und light
und legt über `@bp/host-adapter` das Fundament für die Voll-Integration in cable-planner.
