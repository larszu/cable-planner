# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cable Planner ist eine Electron-Desktop-App zum Planen und Visualisieren von
Broadcast-Verkabelung (SDI-Signalfluss, ATEM-Multiviewer, Blackmagic-Videohub).
React 19 + TypeScript + Zustand + ReactFlow + Three.js, offline-first.

## Befehle

```bash
npm install                              # Dependencies (rebuildet native Module: keytar, freetype2)
npm run dev                              # Vite + 3× tsc-watch (main/preload/renderer) + Electron, hot-reload
npm run dev:renderer                     # nur Renderer im Browser (localhost:5173) — Desktop-Features inert
npm run build                            # build:main + build:preload + build:renderer
npm run dist                             # build + electron-builder → Installer in release/
npm run lint                             # eslint .

# Type-Check — MUSS 0 Errors zeigen vor jedem Push (Baseline ist clean):
npx tsc -p tsconfig.app.json --noEmit

# Tests
npm test                                 # vitest run (Unit-Tests in tests/)
npm run test:watch                       # vitest watch
npx vitest run tests/versionCompare.test.ts   # einzelne Datei
npx vitest run -t "Teil des Test-Namens"      # einzelner Test per Name

# Gezielte Node-Checks (kein vitest):
npm run test:crdt                        # CRDT-Konvergenz (scripts/crdt-convergence-check.mjs)
npm run test:signaling                   # Signaling-Relay (baut main vorher)
npm run ui:smoke                         # UI-Smoke (scripts/ui-smoke.mjs)
npm run test:drag                        # Headless Drag-/Interaktions-Test (scripts/drag-test.mjs, braucht laufenden dev:renderer)
npm run docs:stats                       # Doku-Kennzahlen (Version/Module/LOC/Slices/Subdomänen) neu berechnen + in Doku schreiben
```

**Doku-Kennzahlen-Automatik:** `scripts/update-doc-stats.mjs` hält die
maschinell zählbaren Zahlen in `CLAUDE.md`, `docs/architecture.md`,
`docs/app-structure.html`, `docs/comparison.html` aktuell. Der Workflow
`.github/workflows/docs-stats.yml` führt es bei **jedem Merge auf main** aus und
committet Differenzen zurück. Prosa/Feature-Drift prüft zusätzlich der
wöchentliche KI-Auditor `docs-sync.yml`.

Es gibt **fünf tsconfigs** — pro Prozess eine: `tsconfig.main.json` (main, ESM
node16), `tsconfig.preload.json` (preload, **CommonJS**), `tsconfig.app.json`
(renderer, der für `--noEmit`-Check), `tsconfig.node.json` (vite/build-Tools),
`tsconfig.json` (Solution-Root).

## Architektur (Big Picture)

Vollständige Referenz + nicht-verhandelbare Invarianten:
[`docs/architecture.md`](docs/architecture.md) — **Pflicht-Lektüre vor
strukturellen Änderungen.** Hier nur das Nötigste zum schnellen Einstieg:

**Drei-Prozess-Modell (Electron):**
- `src/main/` — Node-Prozess: Lifecycle, Fenster, IPC-Handler, File-I/O, native
  Deps. **ESM**, relative Imports brauchen `.js`-Endung (node16-Resolution).
- `src/main/preload.cts` — contextBridge, exponiert `window.cablePlanner`.
  **Bleibt CommonJS** — niemals auf ESM umstellen.
- `src/renderer/` — React-App. **Kein Node-Zugriff**; alles File-/Netzwerk-IO
  läuft über IPC.
- `src/mobile/` — statische LAN-View, von `mobileShareServer` (Express) an
  Smartphones ausgeliefert (Read/Check-only).
- `src/viewer/` — eigener Vite-Entry (`viewer.html`) für read-only Web-Viewer,
  auf GitHub Pages deployt.

**IPC:** Alle Channels sind domain-präfixiert (`project:*`, `library:*`,
`atem:*`, `videohub:*`, `sync:*`, `mobileShare:*`, `credentials:*`, `rentman:*`,
`graphml:*`, `print:*`, `logs:*`, `signaling:*`, `collabDiscovery:*`). Definition in `src/main/ipc/<domain>Ipc.ts`,
Aufruf via `window.cablePlanner.<domain>.<action>`. Ein Channel = eine Domäne.
Pfad-Validierung passiert **immer in main**, nie im Renderer.

**State (Zustand, `src/renderer/store/`):**
- `projectStore.ts` — **Single Source of Truth** für alle Projekt-Daten. Intern
  in 14 Slices unter `store/slices/` komponiert. Komponenten dürfen Projekt-Daten
  nicht lokal duplizieren/cachen.
- `uiStore.ts` — Viewport, Panels, Editor-Defaults, Geräte-Farben. **Keine**
  Projekt-Daten.
- `projectHistory.ts` — Undo/Redo (max 100, 200ms-Coalesce), lauscht auf
  projectStore via `.subscribe`. Nicht persistiert.
- `settingsStore.ts` — App-Settings.

**Persistenz & Schema-Migration:**
- Schreibvorgänge für Userdaten **immer atomic** via
  `src/main/util/atomicWrite.ts` (tmp → .bak-Rotation → rename). Niemals direkt
  `fs.writeFile`.
- `healProjectPositions` (in `projectStore.ts`) läuft auf **jedes** geladene
  Projekt — neue optionale Felder mit Default gehören dort hin, das ist die
  Schema-Migrationsschicht.

**Canvas & 3D:**
- ReactFlow 11 mit Custom-Nodes/Edges in `src/renderer/components/Canvas/`.
- Three.js (`@react-three/fiber`) **nur in `components/Rack/`** — Imports
  außerhalb ziehen ~600 KB in den Hauptbundle.

**Domänen-Typen:** `src/renderer/types/` (`CablePlannerProject`, `EquipmentItem`,
`Cable`, `LocationFrame`, …). Berechnungen/Helper in `src/renderer/lib/`.

## Konventionen

- **Patch-Versionen bevorzugt** — keine großen Versionssprünge bei Deps (Standing
  User Directive).
- **Keine Emojis im Code** außer auf expliziten Wunsch.
- **Version lebt nur in `package.json`** — überall sonst via `__APP_VERSION__`
  (Vite-Define) gelesen, nirgends hardcoden.
- **i18n:** Deutsche Strings sind Quell-Sprache, immer als Fallback:
  `t(key, 'Deutsche Form')`. EN-Übersetzung im `en`-Dict in
  `src/renderer/lib/i18n.ts`. Class-Komponenten nutzen `translate(lang, key, fallback)`.
- **Theming (#449):** neue Komponenten nutzen die semantischen Farb-Utilities
  (`bg-cp-surface-1/2/3`, `bg-cp-bg`, `border-cp-border(-muted)`,
  `text-cp-text/-secondary/-muted/-faint`, `(bg|text|border)-cp-accent/-warn/-danger`),
  gebunden in `index.css` via `@theme inline`. Sie flippen automatisch im
  Light-Theme. Rohes `slate-*`/Inline-Hex nur noch in Canvas-/Print-Komponenten,
  die über einen `isLight`-Prop themen (EquipmentNode, Rack3DView …).
- **Externe Tokens** (Rentman) liegen im OS-Credential-Store via `keytar` —
  niemals loggen oder ins Projekt-File schreiben.

## Git-Workflow

### Commit-Messages
- **Sprache:** Deutsch ist OK (Codebase + Docs sind deutsch). Englisch nur wenn
  der Subject englische Begriffe braucht (z. B. `fix(canvas): ReactFlow drag-end race`).
- **Form:** Conventional-Commit-Prefix (`feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `i18n:`). Erste Zeile ≤ 72 Zeichen, Issue-Ref `(#NNN)` am Ende.
  Body als kurze Bullet-Liste: was passiert ist + warum.
- **Keine Trailer:** kein `https://claude.ai/code/session_...`, kein
  "Co-authored by Claude", keine "Generated with…"-Footnotes. Die machen das
  git-log unleserlich.

### Pull-Requests
- **PR-Titel = aussagekräftige Zusammenfassung des ganzen PRs**, nicht der
  Branch-Slug. Form: `<bereich>: <was sich ändert> (#issue)`.
  - Gut: `i18n: complete English coverage + bilingual categories (#321)`
  - Schlecht: `Claude/cable connector type inheritance v5 v zu` (GitHub-Default —
    niemals so lassen).
- **PR-Body:** kurze Übersicht der Sub-Änderungen + Liste geschlossener Issues
  (`Closes #X, #Y`).

### Author-Identität
Bot-Commits sind unter `Claude <noreply@anthropic.com>` authored (Harness setzt
das global). Änderbar nur via `git config user.name/email` im Container, nicht
über CLAUDE.md.

## Wo was hingehört (Quick Reference)

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
| Neue Berechnung (Length, Power, …) | `src/renderer/lib/` |
| Neue UI-Texte | `t('domain.key', 'Deutsche Fallback')` + EN-Entry in `lib/i18n.ts` |
| Neue Property-Section | `src/renderer/components/Properties/sections/` |
| Neuer Settings-Tab | `src/renderer/components/Settings/tabs/` |
