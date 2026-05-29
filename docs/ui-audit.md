# UI/UX-Audit & Härtungs-Inventur

> Erstellt in Phase 0 der UI/UX-Härtung. Dieses Dokument ist die
> Bestandsaufnahme (Recon) **und** der laufende TODO-Tracker für die
> großflächigen Migrationen, die bewusst nicht im Big-Bang erledigt
> werden.

## Baseline (vor Phase 0)

| Check         | Ergebnis                                   |
| ------------- | ------------------------------------------ |
| `npm run build` | ✅ grün (tsc main/preload + vite renderer) |
| `npm run lint`  | ❌ **127 errors, 18 warnings** (pre-existing) |

### Lint-Baseline im Detail (Fehler nach Regel)

```
 35  react-hooks/refs
 25  react-hooks/set-state-in-effect
 13  react-hooks/static-components
 12  react-refresh/only-export-components
 12  react-hooks/rules-of-hooks
 10  react-hooks/exhaustive-deps
  9  react-hooks/immutability
  4  react-hooks/preserve-manual-memoization
  2  typescript-eslint/no-unused-vars
  1  typescript-eslint/no-unused-expressions
  1  react-hooks/purity
```

**Wichtig — Interpretation von „lint grün":** Der Lint-Baseline ist
historisch *nicht* sauber (127 Fehler existieren bereits vor dieser
Arbeit, überwiegend `react-hooks/*`-Regeln des neuen ESLint-10-Setups).
Ein Big-Bang-Fix aller 127 Fehler ist nicht Teil dieser Aufgabe und
wäre selbst regressionsträchtig (z. B. erfordern die
`react-refresh/only-export-components`-Fehler strukturelle Datei-Splits).
Gemäß der CLAUDE.md-Konvention **„keine neuen einführen"** ist der Maßstab
nach jeder Phase deshalb: **kein Zuwachs an Lint-Problemen gegenüber dem
Baseline** + `npm run build` bleibt grün. Neu geschriebener Code ist
lint-sauber.

## Größte Komponenten (Dekompositions-Kandidaten, Phase 5)

| Datei                                              | Zeilen |
| -------------------------------------------------- | -----: |
| `components/Rack/RackBuilderDialog.tsx`            |   2862 |
| `lib/i18n.ts`                                      |   2781 |
| `components/Library/LibraryPanel.tsx`              |   2557 |
| `components/Canvas/CanvasArea.tsx`                 |   1977 |
| `components/Rentman/RentmanImportDialog.tsx`       |   1732 |
| `App.tsx`                                          |   1679 |
| `components/Canvas/CanvasToolbar.tsx`              |   1256 |
| `components/Export/VideohubExportDialog.tsx`       |   1246 |

## Phase 1 — Emoji-Icons (funktional)

Funktionale/zustandstragende Emojis, die durch echte Icons ersetzt
werden sollen. Rein dekorative Emojis (Onboarding-Schmuck, README) bleiben.

| Glyph     | Bedeutung            | Vorkommen (Dateien)                              |
| --------- | -------------------- | ------------------------------------------------ |
| `✕`       | Close-Button         | ~26 Dateien (u. a. `ModalShell`, alle Dialoge)   |
| `⇢` / `⇠` | Port-Richtung out/in | `App.tsx`, `Properties/CableProperties.tsx`      |
| `⚠`       | Warnung              | ~17 Dateien                                      |
| `✎`       | Bearbeiten           | ~7 Dateien (`MenuBar`, `CableProperties`, …)     |
| `✓`/`✅`   | Status/Erledigt      | ~24 Dateien                                      |
| `↻`,`🗑`,`📋`,`⚙` | ErrorBoundary-Aktionen | `ErrorBoundary.tsx`                        |

**Richtungs-Semantik kritisch:** `p._side === 'out' ? '⇢' : '⇠'` — out
zeigt nach rechts (raus), in nach links (rein). Muss exakt erhalten
bleiben (`ArrowRight` für out, `ArrowLeft` für in).

Gesamtzahl Unicode-Icon-Treffer im Scan: ~136 Dateien (inkl. Daten-Pfeile
`→` in Typ-Labels, die *keine* UI-Icons sind und bleiben dürfen).

### Phase 1 — erledigt

- `lucide-react` als Dependency + `components/shared/Icon.tsx` (Wrapper mit
  Größen-Tokens `xs..xl`, `strokeWidth`, `currentColor`, Default `aria-hidden`).
- **Close `✕` → `X`**: `ModalShell` (deckt 11 Dialoge ab) + 21 Icon-only
  Close-Buttons in 18 Dateien.
- **Warnung `⚠` → `AlertTriangle`** (JSX-Glyphen): App.tsx (×4), CableDialog
  (×3 inkl. SDI/Length), CalculatorsDialog, ExportDialog, AtemAudioRouterDialog
  (×2), EquipmentNode, ModeEditorDialog, RentmanSyncBadge (×2), CanvasToolbar,
  RackBuilderDialog, CableLibraryPanel, GraphmlImportDialog, MobileApp (×3).
- **Status `✓` → `Check`**: StatusBar (gepackt), ExportDialog, CableDialog,
  CanvasToolbar (Gruppen-Speichern).
- **`infoDialog`-Tones → echte Icons** (Info/Check/AlertTriangle/XCircle) —
  zieht durch alle Info/Success/Warning/Error-Dialoge.
- **ErrorBoundary**-Aktions-Buttons (📋/↻/🗑) → `ClipboardCopy`/`RotateCcw`/`Trash2`.

### Phase 1 — bewusst verschoben (TODO)

- **Glyphen in `<option>`** (technisch unmöglich, SVG rendert dort nicht —
  als Text mit erhaltener Semantik belassen):
  - Port-Richtung `⇢`/`⇠` (out/in) in `App.tsx` (×2) + `CableProperties` (×2).
  - `CableDialog` Status-Ternary `✓/⚠/✕` (Z. 257) + `★ Custom Cable` (Z. 253).
- **Glyphen in `t()`-Fallback-Strings** → in **Phase 4** mit der i18n-Arbeit
  extrahieren (Glyph aus DE-Fallback **und** EN-Dict ziehen, Icon im JSX):
  `CableProperties` ⚠ (cable.warn.fromBusy/toBusy/connectorMismatch),
  `CableBomDialog` ⚠ (bom.cable.missingTypes), `ColorField`/`EquipmentColorsSection`
  „✕ Reset", `MultiviewerLayoutView` „✕ Schließen"/„↻ Aktualisieren",
  `RackBuilderDialog` „✕ Entfernen"-Label, `CableProperties` „✕ Ausblenden"-Label.
- **`CableContextMenu`**: internes String-`icon`-Menü (✎/📌/✗/＋/−/↺/🧭/↳/✓/→/←/↔/✕)
  braucht `Item`-API-Refactor (`icon: string` → `ReactNode`) — eigener Schritt.
- **String-gebaute Warnungen** (kein JSX, bleiben Text): `GreenGoExportDialog:153`
  (Export-Log-Zeile), `CanvasArea:557` (Node-Label-Konkatenation).
- **Long-Tail `✎`/`✓`** (Edit-Stifte / Häkchen) in `LibraryPanel`, `MenuBar`,
  `RacksTab`, `DeviceModePicker` u. a. — niedrigere Priorität.
- **ErrorBoundary-Banner `⚙`/`✅`**: dekorativer Schmuck im Recovery-Hinweis —
  bleibt (Task erlaubt dekorative Emojis).

## Phase 2 — Typo-/Spacing-Skala & Tokens

Hartkodierte Pixel-Schriftgrößen (Tailwind-Arbitrary-Values):

| Klasse        | Treffer |
| ------------- | ------: |
| `text-[10px]` |     336 |
| `text-[11px]` |     256 |
| `text-[9px]`  |      43 |
| `text-[8px]`  |       5 |
| `text-[12px]` |       4 |
| `text-[13px]` |       2 |

Top-Dateien mit Sub-12px-Schrift: `RackBuilderDialog` (56),
`GreenGoExportDialog` (43), `LibraryPanel` (42), `CableLibraryPanel` (21),
`MobileApp` (20), `RentmanCableExportDialog` (18), `CableProperties` (18),
`App.tsx` (16).

**Theming-Schuld:** `index.css` remappt die komplette Tailwind-Slate-Rampe
(+ Dutzende Opacity-Varianten einzeln) für `[data-theme="light"]`. Fragil,
weil jede neue Opacity-Stufe manuell nachgezogen werden muss. `--cp-*`
existiert bisher nur als `--cp-bg`/`--cp-text` (nur im Light-Block + als
Inline-Fallback in `ErrorBoundary`). → Token-Schicht einführen.

### Phase 2 — erledigt

- **Token-Schicht** in `index.css`: `@theme`-Typo-Skala (`text-cp-xs`=12px,
  `-sm`=13px, `-base`=14px, `-lg`=16px) + Farb-Tokens (`--cp-surface-1/2/3`,
  `--cp-border`, `--cp-border-muted`, `--cp-text`, `--cp-text-secondary`,
  `--cp-text-muted`, `--cp-text-faint`, `--cp-accent`, `--cp-warn`,
  `--cp-danger`) + Spacing-Referenz (`--cp-space-*`). Dark = `:root`,
  Light-Overrides in `[data-theme="light"]` — **Werte exakt = bisheriger
  Slate-Remap**, daher appearance-neutral & keine dunklen Rest-Flächen.
- **Migrierte Shells** (Flächen/Border/Text auf `var(--cp-*)`, Schrift auf
  Typo-Skala, kleinste Fließtext-Größe jetzt 12px):
  `ModalShell`, `SettingsCard`, `StatusBar`, `FloatingPanelShell` (inkl.
  `📌`→`Pin`, `⋮⋮`→`GripVertical`), `MenuBar` (Header + Dropdown + Body-Typo).
- Verifiziert: `text-cp-*`-Utilities + `var(--cp-*)`-Utilities kompilieren;
  keine `<12px`-Fließtext-Klassen mehr in den migrierten Shells.

### TODO (großflächiger Rest, NICHT Big-Bang)

- [ ] `text-[10px]`/`text-[11px]`/`text-[9px]` flächendeckend auf
      Typo-Skala migrieren (zentrale Shells in Phase 2 erledigt, Rest
      offen — v. a. RackBuilderDialog/LibraryPanel/Export-Dialoge).
      Fließtext-Mindestgröße 12px. (Rein dekorative Micro-Glyphen wie
      MenuBar-Caret `▾` bleiben.)
- [ ] Translucente Glas-Flächen (`bg-slate-950/95`, `bg-slate-900/80`,
      `bg-slate-950/40`) auf Alpha-Tokens (z. B. `color-mix`) heben —
      aktuell bewusst als slate-Klassen belassen (Remap deckt Light ab).
- [ ] Slate-Remapping in `index.css` schrittweise durch `--cp-*`-Tokens
      ersetzen; Ziel: Opacity-Varianten-Liste schrumpfen.
- [ ] Inline-Style-Komponenten (`CableEdge`, `CanvasToolbar`,
      `EquipmentNode`) auf `var(--cp-*)` statt `canvasTheme`-Branching.

## Phase 3 — Accessibility

- `role="dialog"`: **nur 1 Datei** (`Annotations/AnnotationCanvasOverlay.tsx`).
- `ModalShell`: kein `aria-modal`, kein `aria-labelledby`, **keine
  Focus-Trap**, **kein Escape-to-close** (nur Backdrop-Klick), keine
  Fokus-Rückgabe.
- `aria-*` nur in **32 von 124** `.tsx`-Dateien.
- `:focus-visible` global vorhanden (`index.css` Z. 415 ff.) — gut.
- Dialog-artige Container (`fixed inset-0`): ~26 Dateien; 11 davon nutzen
  `ModalShell`, der Rest hat eigenes Boilerplate.

### Phase 3 — erledigt

- **`hooks/useDialogA11y.ts`** (wiederverwendbar): `role="dialog"` +
  `aria-modal`, Escape-schließt (optional/`closeOnEscape`), **Focus-Trap**
  (Tab/Shift+Tab zyklisch), Fokus auf erstes Element beim Öffnen,
  **Fokus-Rückgabe** an den Auslöser beim Schließen. Optionale externe
  Ref (für Drag-Container) ohne Ref-Mutation.
- **`ModalShell`** nutzt den Hook → alle **11** ModalShell-Dialoge sind
  jetzt voll tastaturbedienbar (Titel via `aria-labelledby`).
- **Standalone-Dialoge** auf den Hook umgestellt: `SettingsDialog`,
  `ExportDialog`, `CableDialog`.
- **Imperative Dialoge** (`confirmDialog`/`promptDialog`/`infoDialog`):
  `role="dialog"`+`aria-modal`+`aria-label`; Fokus-Rückgabe zentral in
  `mountModal` (Escape war bereits via `useModalKeyboard` da).
- **`MenuBar`**-Dropdowns: `aria-haspopup`+`aria-expanded`, Caret
  `aria-hidden`.
- Globaler `:focus-visible`-Ring war bereits vorhanden (`index.css`).
- Lint dadurch sogar verbessert (124 statt 127 Fehler).

### TODO (restliche Standalone-Dialoge → useDialogA11y adоptieren)

Diese rollen noch eigenes `fixed inset-0`-Boilerplate ohne Focus-Trap/
Escape — Hook analog `SettingsDialog`/`ExportDialog` anwenden:
`RentmanImportDialog`, `RentmanCableExportDialog`, `NewRentmanDeviceWizard`,
`AtemMvConfigDialog`, `AtemAudioRouterDialog`, `MultiviewerLayoutView`,
`VideohubExportDialog`, `GreenGoExportDialog`, `GraphmlImportDialog`,
`RackEditorDialog`, `RackImageCropDialog`, `NonRackAddDialog`,
`PatchPanelCreateDialog`, `RackShelfCreateDialog`, `MobileShareDialog`,
`LocationBomDialog`, `CableBomDialog`. (Panels `LibraryPanel`/
`CableLibraryPanel` sind keine Modals — separat behandeln.)

## Phase 4 — i18n

- Vollständiges `en`-Dict in `lib/i18n.ts`; Inline-Fallbacks deutsch
  (`t('key', 'Deutsche Form')`), `translations.de` bewusst leer.

### Fallback-Sprache (Entscheidung)

Die Aufgabe empfahl **Englisch** als Fallback, aber **CLAUDE.md** legt
verbindlich fest: *„Deutsche Strings = Quell-Sprache, immer als Fallback in
`t(key, 'Deutsche Form')`. EN-Übersetzung im `en`-Dict."* CLAUDE.md
überschreibt Defaults → **Deutsch bleibt einheitliche Fallback-Sprache**.
Ein Umstellen aller `t()`-Fallbacks auf Englisch wäre zudem ein massiver,
risikoreicher Eingriff entgegen der dokumentierten Projektkonvention.

### Phase 4 — erledigt

- **Report-Skript** `docs/i18n-check.mjs`: meldet (a) im Code benutzte,
  aber im `en`-Dict fehlende Keys (EN-Lücken) und (b) verwaiste/dynamische
  en-Keys. Exit 1 bei Lücken (CI-tauglich). `node docs/i18n-check.mjs`.
- **DE/EN-Parität hergestellt**: 105 fehlende EN-Keys ergänzt (Menü,
  Settings-Tabs Canvas-BG/Kategorien/Connector/Editing/GreenGo/Hotkeys/…,
  Short-Name-Feld, Rentman-/NetBox-Titles, ATEM-Audio). Report meldet jetzt
  **0** fehlende Keys.
- **Hartkodierte Strings migriert** in den berührten Bereichen:
  App-CableDialog-Warnungen (`cable.create.warn.*`), ExportDialog-Status
  (`export.installedCables/missingTypes/allCovered`).

### TODO (großflächiger Rest)

- [ ] Flächendeckende Suche nach restlichen hartkodierten JSX-Texten /
      `placeholder` / `title` ohne `t()` (z. B. Teile von App-CableDialog,
      CableDialog-Labels „Connector Type"/„Notizen", RackBuilder-Interna).
- [ ] In-`t()`-String-Glyphen aus Phase 1 (`⚠`/`✓`/`✕` in `cable.warn.*`,
      `bom.cable.missingTypes`, „✕ Reset" etc.) extrahieren + Icon im JSX.

## Phase 6 — README

- README zeigt **kein einziges Bild** der App. → Hero + Galerie mit
  TODO-Platzhaltern + Capture-Anleitung.
</content>
