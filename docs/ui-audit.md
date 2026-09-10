# UI/UX-Audit & Härtungs-Inventur

> Erstellt in Phase 0 der UI/UX-Härtung. Dieses Dokument ist die
> Bestandsaufnahme (Recon) **und** der laufende TODO-Tracker für die
> großflächigen Migrationen, die bewusst nicht im Big-Bang erledigt
> werden.

## Nebenbefund 2026-09-10: die Mobile-Ansicht war weiss

Beim Nachmessen der Typo-Skala im Browser (`dist/renderer/mobile.html`, echtes
Chromium, 390x844) warf die Seite beim Laden eines Projekts einen
`ReferenceError: writeMode is not defined` und rendert gar nichts mehr.

**Der Defekt:** `ProjectView` in `src/mobile/MobileApp.tsx` las `writeMode` an
vier Stellen als freien Bezeichner. Der Zustand dazu lag in `MobileApp` und
wurde nie als Prop durchgereicht. Drin seit Bedarf 109 (`d3ca31c`) — die ganze
Schreibrechte-Anzeige des Handys („Nur lesen"-Hinweis, Meldung, + Kabel) hat
seitdem nie funktioniert, weil die Ansicht vorher abstuerzte.

**Warum es niemand gesehen hat, und das ist der eigentliche Befund:**
`src/mobile` stand in **keinem der fuenf tsconfigs**. `tsconfig.app.json`
nannte `src/renderer` und `src/viewer`; `build:renderer` ist `vite build`, und
Vite transpiliert TypeScript ohne Typpruefung. Die Pruefung, die CLAUDE.md vor
jedem Push verlangt, war also gruen — sie sah den Ordner nicht an. Eine
Pruefung, die weniger prueft als ihr Name sagt, ist schlimmer als keine: sie
wird geglaubt.

**Behoben:** `writeMode` ist Prop, `src/mobile` steht in `tsconfig.app.json`,
und `tests/typpruefungDecktSrc.test.ts` fragt `tsc --listFilesOnly` fuer jedes
tsconfig, ob noch eine Quelldatei unter `src/` durchfaellt. Der Waechter liest
die `include`-Muster ausdruecklich NICHT nach — die erste Fassung tat das und
lag falsch (`src/main*.ts` deckt entgegen der Dokumentation auch
`src/main/ipc/*.ts` mit ab, nachgemessen mit einer Wegwerfdatei). Wer die
Regel nachbaut, prueft am Ende seine eigene Lesart.

## Nebenbefund 2026-09-10 (dritter): vier Light-Regeln standen doppelt da

`index.css` deklarierte vier Regeln **zweimal**, mit unterschiedlichen Werten:

```
Zeile 333:  .bg-slate-950\/30 { background-color: rgba(240,244,248,0.7); }
Zeile 480:  .bg-slate-950\/30 { background-color: rgba(240,244,248,0.3); }
```

dazu `/40`, `/50` und `/60` in derselben Form. Gleiche Spezifität, also gewann
die spätere; der Minifier hat die frühere aus dem Build sogar ganz entfernt
(nachgesehen in `dist/renderer/assets/*.css`), und im Fenster gemessen rendert
`bg-slate-950/50` tatsächlich `rgba(240,244,248,0.5)`.

**Die schlimmere Hälfte war nicht der Wert, sondern wo die tote Fassung
stand:** genau unter dem Kommentar, der erklärt, *warum* es diese Regeln gibt
(„damit die Context-Menüs, Modal-Overlays und Sub-Karten im Light-Mode nicht
dunkel bleiben"). Wer eine Glasfläche nachjustieren wollte, las dort die
Begründung, änderte die Zeile darunter — und sah nichts passieren.

Behoben: die Regeln stehen jetzt an **einer** Stelle, bei ihrer Begründung.
Übernommen wurden die **wirksamen** Werte, nicht die kommentierten — was die
App seit Monaten zeigt, ist der Ist-Zustand; ihn nebenbei zu ändern wäre eine
unbestellte Änderung am Aussehen. Nachgemessen: die vier Klassen rendern nach
dem Umbau byte-gleich wie vorher.

Dazu drei Regeln für Klassen, die im ganzen Baum nicht vorkommen
(`bg-sky-950/50`, `border-amber-400`, `border-orange-700/60`) — jeweils eine
Ziffer neben einer, die es gibt. Ein Eintrag ohne Nutzer ist nicht bloß
ungenutzt: er sieht beim Lesen aus wie eine Deckung, die es nicht gibt.

`tests/themeRemapEindeutig.test.ts` hält beides fest.

## Nebenbefund 2026-09-10 (zweiter): drei Reiter fielen aus dem Analysen-Dialog

Der Analysen-Dialog legt **dreizehn Reiter** in eine `flex`-Zeile, die nicht
umbricht. Die letzten drei — „Kabelwege", „Signalwege", „Blatt prüfen" — lagen
**164 px, 98 px und 5 px über der rechten Kante**, bei 1280×800 wie bei
1500×950. Nicht sichtbar, nicht anklickbar: drei Auswertungen, die es für den
Nutzer nicht gab.

Das ist wörtlich derselbe Befund, aus dem `scripts/ui-overflow.mjs` entstanden
ist („da kann man Equipment lesen, aber Cable schon nicht mehr") — nur eine
Ebene tiefer. **Der Wächter stand an der Tür:** er misst die stehende
Oberfläche und die Menüs, aber ein Dialog ist zu, bis jemand ihn öffnet. Der
Defekt war Monate alt (nachgemessen gegen `776ed7c`, identische Zahlen) und
hat jede CI-Runde überlebt.

Behoben mit `flex-wrap` — und nicht mit `overflow-x-auto`: eine waagerecht
scrollende Reiterleiste versteckt die hinteren Reiter hinter einer Geste, die
niemand sucht.

**Der Wächter geht jetzt durch die Tür.** `ui-overflow.mjs` läuft die
Befehlspalette Eintrag für Eintrag durch, öffnet jeden Dialog und misst ihn
(heute 15 Dialoge, 0 Befunde). Die Liste führt die App: wer einen Dialog anlegt
und in die Palette hängt, wird gemessen, ohne dass jemand eine zweite Liste
pflegt — dieselbe Lehre wie bei `tests/dialogTastaturbedienung.test.ts`.

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

> Als GitHub-Issue erfasst: **#468** (`refactor(tech-debt): decompose oversized components`).

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

| Klasse        | Audit-Start<br>2026-06-15 | vor der Migration<br>2026-09-10 | heute |
| ------------- | ------------------------: | ------------------------------: | ----: |
| `text-[10px]` |                       336 |                             423 |     0 |
| `text-[11px]` |                       256 |                             390 |     4 |
| `text-[9px]`  |                        43 |                              10 |     2 |
| `text-[8px]`  |                         5 |                               5 |     0 |
| `text-[12px]` |                         4 |                              20 |    20 |
| `text-[13px]` |                         2 |                               2 |     2 |

**Die mittlere Spalte ist der eigentliche Befund.** Unter 12px waren es beim
ersten Commit dieses Audits 743 Stellen — und drei Monate spaeter 881, also
138 MEHR, nachdem hier aufgeschrieben stand, dass es weniger werden sollen.

Das ist keine Nachlaessigkeit einzelner Aenderungen, sondern die vorhersehbare
Folge davon, dass die Grenze nur in Prosa stand: ein TODO in einer Datei
bremst nichts, weil niemand es beim Schreiben einer neuen Komponente liest.
Seit `tests/schriftgroesseUntergrenze.test.ts` ist es eine Ratsche — die Zahl
darf sinken, nie steigen. Der Weg zurück lief in vier Schritten:
**881 → 828** (`src/mobile`) **→ 705** (die drei größten Einzeldateien)
**→ 515** (die nächsten neun) **→ 0**.

**Die sechs verbliebenen Stellen sind genau die Ausnahme, die dieses TODO
selbst nennt** — rein dekorative Micro-Glyphen: vier Carets (`▾`/`▴` in
`MenuBar`, `LibraryMenus` ×2, `PanelWindowMenu`), ein Sortier-Dreieck (`▲` in
`PatchListDialog`) und die Pin-Markierung (`📌` im Rechner). Ein Pfeil hat
keine Lesbarkeitsuntergrenze, ein Wort hat eine.

**Damit ist aus der Ratsche eine Regel geworden.** Solange hunderte Stellen
offen waren, stand im Wächter eine Zahl — die richtige Form für eine laufende
Migration und die falsche für eine fertige: eine Zahl sagt nicht, *warum* eine
Stelle bleiben darf, und wer eine neue anlegt, könnte sie mit einer Migration
anderswo verrechnen. Geprüft wird jetzt, dass **jede** Stelle unter 12px ein
Glyph ist: der sichtbare Text der Zeile darf keinen Buchstaben und keine
Ziffer tragen. Wer morgen einen Caret braucht, bleibt grün; wer eine
Beschriftung auf 10px setzt, wird sofort rot.

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

- [x] `text-[10px]`/`text-[11px]`/`text-[9px]` flächendeckend auf
      Typo-Skala migrieren. Fließtext-Mindestgröße 12px. **Erledigt
      2026-09-10** in vier Schritten (881 → 828 → 705 → 515 → 0);
      die sechs verbliebenen Stellen sind dekorative Micro-Glyphen,
      siehe oben. **Gehalten** von
      `tests/schriftgroesseUntergrenze.test.ts` — nicht mehr als Zahl,
      sondern als Regel: jede Stelle unter 12px muss ein Glyph sein.
      **Im echten Fenster nachgemessen** (Electron unter xvfb): alle vier
      UI-Skripte grün, `ui:overflow` prüft dabei 15 Dialoge. Der Sprung
      10 → 12px in dichten Tabellen ist der Punkt, an dem eine Migration
      Layout bricht — `npm test` sieht das nicht.
- [x] Translucente Glas-Flächen auf Alpha-Tokens heben — **erledigt
      2026-09-10.** Die im TODO genannten Beispiele (`bg-slate-950/95`,
      `bg-slate-900/80`) gab es beim Nachmessen gar nicht mehr; übrig waren
      neun klassenbasierte Stellen in `AtemAudioRouterDialog` (3),
      `RackLivePreview` (3), `CableContextMenu` (2) und
      `VideohubRoutingMatrix` (1).
      **Kein `color-mix` von Hand nötig:** der Opacity-Modifier wirkt auf den
      semantischen Utilities, `bg-cp-surface-3/40` kompiliert zu
      `color-mix(in oklab, var(--cp-surface-3) 40%, transparent)`. Die
      Migration ist damit ein Eins-zu-eins-Tausch mit **exakt gleicher
      Deckung** — nur die Basisfarbe wechselt von Schiefer auf die
      Marken-Palette.
      `CableContextMenu` verliert dabei seinen `isLight`-Zweig ganz (vier
      Stellen); die Datei führt keine eigene Farbtabelle mehr.
      **Nicht migriert, mit Grund:** die Kreuzpunkt-Füllung der
      Videohub-Matrix (`bg-slate-400/50`) ist eine Zustands-Farbe — sie sagt
      „diese Verbindung ist geschaltet" und darf mit dem Theme nicht kippen.
      Ebenso die dunklen Overlays in `Rack3DView` und das Amber-Banner in
      `PendingCableOverlay`: beide liegen über einer eigenen dunklen Szene
      bzw. sind Warnfarbe, nicht Fläche.
- [x] Slate-Remapping in `index.css` schrittweise durch `--cp-*`-Tokens
      ersetzen; Ziel: Opacity-Varianten-Liste schrumpfen. **Erledigt
      2026-09-10, soweit es die Liste betrifft.**
      **Nachgemessen: die Liste war nicht das Problem, für das der TODO sie
      hielt.** 207 Regeln, davon 204 mit echten Nutzern — der Remap ist
      längst das Legacy-Sicherheitsnetz, das sein Kopfkommentar beschreibt.
      Die drei ohne Nutzer sind entfernt, und mit der Glas-Migration oben
      fielen fünf weitere Regeln von selbst weg: `bg-slate-950/30|40|50|60`
      und `bg-slate-900/98` hatten keinen Nutzer mehr.
      **Der Wächter hat das gemeldet, nicht ein Mensch** — genau so soll er
      sich verhalten: die Liste schrumpft mit der Migration mit, statt
      Karteileichen anzusammeln.
      Was stattdessen gefunden wurde, steht als eigener Nebenbefund oben:
      vier Regeln waren doppelt deklariert, mit widersprüchlichen Werten.
      **Gehalten** von `tests/themeRemapEindeutig.test.ts`.
      **Was bleibt, ist kein Rest, sondern der Zweck:** die verbliebenen
      Regeln decken die `isLight`-Canvas-/Print-Komponenten ab, die pro
      Theme **manuell** unterschiedliche Shades wählen (`EquipmentNode`
      liest dafür sogar Nutzer-Einstellungen, siehe unten). Sie lassen sich
      nicht auf einen auto-kippenden Token abbilden — das ist der Grund,
      warum es das Sicherheitsnetz gibt, und nicht der Grund, es weiter
      abzutragen.
- [x] Inline-Style-Komponenten auf `var(--cp-*)` statt
      `canvasTheme`-Branching — **erledigt 2026-09-10 für `CanvasToolbar`
      und `CableEdge`.** Die Werkzeugleiste lief als einzige Fläche noch auf
      Tailwind-Schiefer (`#0f172a`, `#1e293b`, `#cbd5e1`), während die App
      seit ADR-007 auf Zumpe Navy läuft; jede Farbänderung am Haus ging an
      ihr vorbei. `isLight`-Verzweigungen: `CanvasToolbar` 18 → 2 (Deklaration
      + Schlagschatten, der pro Theme legitim anders ist), `CableEdge` 11 → 5
      (nur noch Durchreichen an Unterkomponenten).
      Nachgemessen im echten Fenster in **beiden** Themes: dunkel
      `#182948`/92 % auf `#e1ecef`, hell `#ffffff`/92 % auf `#1d324f`.
      `color-mix` löst in Electron 42 (Chromium 140) auf, und `var(--cp-*)`
      gilt auch beim PDF-Export, weil `App.tsx`
      `document.documentElement.dataset.theme` auf
      `pdfExportThemeOverride ?? canvasTheme` setzt.
      **Zwei Sorten Farbe bleiben fest, und das ist keine Restarbeit:**
      Zustands-Farben (`btnActiveBg` blau, der Lila-Rand „vom Handy
      dazugekommen") sagen *was ist*, nicht *worauf es liegt* — sie dürfen
      mit dem Theme nicht kippen. `--cp-accent` ist im Dunkel-Theme
      Off-White; ein aktiver Knopf würde damit weiß statt blau.

      **`EquipmentNode` gehört NICHT auf diese Liste — der TODO war falsch.**
      Seine Farben sind keine Theme-Tokens, sondern **Nutzer-Daten**: #307
      gibt in Einstellungen → Darstellung je Theme Body/Header/Border/Text/
      Subtext frei, `uiStore.equipmentColors.{light,dark}` hält sie, und
      einzelne Geräte haben zusätzlich ihre eigene Farbe aus den Properties.
      `var(--cp-*)` kann das nicht ausdrücken; wer diesen Punkt „abarbeitet",
      löscht ein Feature. Dass die Zeile hier als offenes Kästchen stand,
      hat genau diesen Griff eingeladen.

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

### ~~TODO (restliche Standalone-Dialoge → useDialogA11y adoptieren)~~ — erledigt 2026-09-08

**Alle selbstgebauten Dialoge gehen jetzt über `useDialogA11y`**, und ein
Wächter hält das fest: `tests/dialogTastaturbedienung.test.ts`.

Die Liste, die hier stand, war an **beiden** Enden falsch — und beide Fehler
kommen daher, dass sie von Hand geführt wurde:

* **Sieben der siebzehn brauchten gar nichts mehr.** `RentmanCableExportDialog`,
  `NonRackAddDialog`, `PatchPanelCreateDialog`, `RackShelfCreateDialog`,
  `MobileShareDialog`, `LocationBomDialog` und `CableBomDialog` gehen längst
  über `ModalShell` — und die hat den Hook seit derselben Phase.
* **Neun Dialoge fehlten ganz.** Sie sind nach dem Audit entstanden und
  niemand hat sie nachgetragen: `ReconcileDialog`, `DeliveryDialog`,
  `DrumMicingDialog`, `WirelessRigDialog`, `RackInternalWireOverlay`,
  `RackBuilderDialog`, `CommandPalette` und die vier Überlagerungen in
  `LibraryPanel`/`CableLibraryPanel` — die beiden Panels sind zwar keine
  Modals, die Dialoge **in** ihnen aber schon.

**Deshalb ist der Wächter kein Listenabgleich, sondern ein Lauf über den
Ordner:** er findet jede Datei unter `src/renderer/components`, die ein
eigenes `fixed inset-0` aufspannt, und verlangt für sie den Hook (oder
`ModalShell`). Wer morgen einen Dialog anlegt, wird rot, ohne dass jemand
eine Liste pflegt. Dieselbe Lehre wie beim Lager-Vertrag in ADR-006: **die
Domäne ist der Ordner, nicht eine Liste im Wächter.**

Zwei Dialoge bekommen den Hook bewusst **ohne** sein Escape
(`closeOnEscape: false`), weil sie eine eigene, klügere Behandlung haben:
der `RackBuilderDialog` fragt bei ungesicherten Änderungen nach, die
`CommandPalette` hat ihre eigene Tastensteuerung. Beide nehmen vom Hook nur
Fokus-Falle und Fokus-Rückgabe — ein zweites Escape daneben würde an der
Rückfrage vorbei schließen.

## Phase 4 — i18n

- Vollständiges `en`-Dict in `lib/i18n.ts`; Inline-Fallbacks deutsch
  (`t('key', 'Deutsche Form')`), `translations.de` bewusst leer.

### Fallback-Sprache (Entscheidung) — ÜBERHOLT SEIT E-28

Dieser Abschnitt stand bis 2026-09-10 im Präsens da und sagte das Gegenteil
der geltenden Konvention. **Er wird nicht gelöscht, sondern richtiggestellt**:
gelöscht wäre nicht nachvollziehbar, warum die Fallbacks im Code aussehen, wie
sie aussehen.

**Was hier stand (Stand Phase 4):** Die Aufgabe empfahl Englisch als Fallback,
aber CLAUDE.md lege verbindlich Deutsch als Quell-Sprache fest; ein Umstellen
aller `t()`-Fallbacks wäre ein massiver, risikoreicher Eingriff entgegen der
dokumentierten Projektkonvention.

**Was heute gilt:** **E-28 (2026-09-09, vom Eigentümer entschieden) hebt
E-17/E-20 auf.** Quellsprache ist `en` — für ALLE Repos der Suite, nicht mehr
je Repo. Deutsch ist die erste Übersetzung. Der Eingriff, der hier als „massiv
und riskant" abgelehnt wurde, ist gemacht: `t(key, 'English text')`,
Übersetzungen je Sprache in `src/renderer/lib/i18n/`, gemessen von
`npm run lang:check` (heute: 0 deutsche, 1281 englische Zeichenketten in
`src/renderer`).

**Die Lehre steht hier, nicht nur die Korrektur.** Ein Dokument, das eine
Entscheidung mit „CLAUDE.md sagt X" begründet, wird falsch, wenn CLAUDE.md
X ändert — und zwar lautlos, weil es weiter so aussieht wie eine gültige
Begründung. Wer hier nachschlug, hätte deutsche Fallbacks eingetragen und
den Wächter gegen sich gehabt, ohne zu verstehen warum. Begründungen, die
auf eine andere Datei zeigen, gehören deshalb datiert.

**Erledigt am 2026-09-10:** `lang:check` prüft jetzt alle drei Ordner, die
im Browser laufen — `src/renderer`, `src/mobile`, `src/viewer`. Gemessen:
0 deutsche Fallbacks, 0 ungewickelte Zeichenketten in der jeweils anderen
Sprache, in allen dreien.

Die Lücke war real und groß: **63 deutsche Zeichenketten in `src/mobile`,
12 in `src/viewer`** — beide Ordner ohne jede `t()`-Verdrahtung, beide von
keiner Prüfung angefasst. Der Wächter stand an einer Tür von dreien und
meldete „0 Verstöße"; dieselbe Form wie bei der Typprüfung, die `src/mobile`
nicht ansah.

**Der Umfang ist jetzt keine Liste mehr, sondern eine Regel.**
`tests/i18nEintrittspunkte.test.ts` liest die Browser-Ordner aus
`tsconfig.app.json` und besteht darauf, dass jeder davon im `lang:check`-
Skript vorkommt. Wer einen vierten Eintrittspunkt anlegt, wird dort rot —
nicht erst, wenn jemand eine halb übersetzte Seite meldet.

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

- [x] Flächendeckende Suche nach restlichen hartkodierten JSX-Texten /
      `placeholder` / `title` ohne `t()`.
      **2026-09-10, erster Schnitt: `src/renderer` ist sauber.** Der
      CableDialog trug fünf deutsche Roh-Beschriftungen („Kabel bearbeiten",
      „+ Neuer Stecker-Typ…", „+ Neuer Signal-Standard…", „Verbindung",
      „Notizen") — mitten in einem Repo mit Quellsprache `en`. Sie sind
      gewickelt und übersetzt.
      **Warum der Wächter sie nicht meldete:** `quellsprache.mjs` LIEST rohen
      JSX-Text längst (`sichtbareTexte`), aber seine Wortliste bestand aus
      Bindewörtern — und die kommen in kurzen Beschriftungen nicht vor. Er
      hatte die Zeilen gesehen und als „unklar" abgelegt. Die Liste trägt
      jetzt auch Inhaltswörter, gemessen gegen alle 4622 englischen Fallbacks:
      **kein einziger** würde durch sie fälschlich als deutsch gelten.
      **2026-09-10, zweiter Schnitt: `src/mobile` und `src/viewer` sind
      ebenfalls sauber.** Gemessen waren es nicht 34 und 7, sondern **63 und
      12** — die frühere Zahl stammte aus einer Suche über Umlaute, die
      kurze Beschriftungen ohne Umlaut („Von Port", „Plan read-only") nicht
      sah. Beide Ordner sind verdrahtet und übersetzt; `lang:check` deckt sie
      jetzt ab (siehe Phase 3).

      **Sie bekommen ein eigenes, kleines Wörterbuch — mit Grund.**
      `renderer/lib/i18n.ts` importiert `de.ts` statisch: 316 KB, 5276
      Schlüssel. Der Mobile-Chunk ist 57 KB groß und wird über das
      Hallen-WLAN auf ein Telefon geladen. Ein Import von dort hätte die
      Seite vervierfacht, damit ein Handy Zeichenketten lädt, die es nie
      zeigt. Das Werk (`spracheAusBrowser`, `format`) steht deshalb einmal in
      `renderer/lib/i18nLite.ts`, die Wörterbücher je Seite in
      `src/mobile/i18n.ts` (169 Schlüssel) und `src/viewer/i18n.ts` (33).
      Gemessene Kosten: Mobile-Chunk 57 → 72 kB, Viewer 15,8 kB.
      `tests/i18nEintrittspunkte.test.ts` folgt den Importen beider Seiten
      durch den ganzen Baum und fällt, wenn `lib/i18n` wieder hereinkommt —
      auch mittelbar über ein Hilfsmodul.

      **Was `lang:check` NICHT sehen kann, und was deshalb dazukam:** ein
      fehlender Schlüssel im Wörterbuch zeigt den englischen Fallback, und
      der ist eine regelkonforme Zeichenkette. Gefunden wurde genau so ein
      Fall nur, weil die gebaute Seite mit deutscher Spracheinstellung im
      Browser offen war: „.cpviewer or .json" zwischen lauter deutschen
      Zeilen, weil ich beim Eintragen geschätzt hatte, die Zeile sei in
      beiden Sprachen gleich. Derselbe Test besteht jetzt darauf, dass jeder
      benutzte Schlüssel entweder übersetzt oder in einer kurzen Liste
      ausdrücklich als „in beiden Sprachen gleich" erklärt ist (heute sechs
      Einträge: „Plan", „Name", „Problem", „optional…", „Name (optional)",
      „📶 Remote").
- [x] In-`t()`-String-Glyphen aus Phase 1 (`⚠`/`✓`/`✕` in `cable.warn.*`,
      `bom.cable.missingTypes`, „✕ Reset" etc.) extrahieren + Icon im JSX.
      **2026-09-10 erledigt: 71 → 6.** Gemessen waren es 71 Fallbacks, die mit
      einem Symbol anfingen oder aufhörten — „✕ Reset", „↻ Refresh",
      „✓ linked", „Apply →", „📂 Choose a file…", „🏷 Labels PDF". Sie sind
      jetzt `<Icon icon={…} />` im JSX; das Symbol ist aus dem Fallback **und**
      aus jedem Wörterbuch verschwunden.

      **Der Grund steht in `Icon.tsx` selbst** („Emojis rendern je
      Plattform/Font inkonsistent") und gilt für eine Zeichenkette genauso wie
      für ein JSX-Kind. Dazu kommt einer, der nur Übersetzungen betrifft: das
      Symbol stand in jedem Wörterbuch noch einmal. Wer das Icon ändert, hätte
      es in jeder Sprache ändern müssen — ein Icon ist keine Sprache.

      **Sechs Stellen bleiben, mit Begründung je Eintrag** in
      `tests/glyphenNichtImText.test.ts`: `♂`/`♀` an der Steckerbauart (die
      Kennzeichnung am Stecker selbst), `◄`/`►` in der Pfeilspitzen-Auswahl und
      `↓`/`↑` in der Sortier-Auswahl — dort ist das Symbol der **Wert**, nicht
      seine Verzierung. Symbole mitten im Satz („from source → destination",
      „Settings → Rentman") bleiben ebenfalls: der Pfeil ist dort ein Wort, und
      ihn herauszulösen hieße, den Satz aus zwei `t()`-Aufrufen zusammenzusetzen.

      **Zwei Funde nebenbei, die kein TODO genannt hatte:**
      (a) `RentmanCableExportDialog` färbte seine Fehlerzeile über
      `status.startsWith('Fehler')` — eine Verzweigung auf **übersetzten Text**.
      Seit E-28 steht dort `Error: …`, die Fehlerzeile rendete also für jeden,
      der die Oberfläche nicht auf Deutsch stellt, in der ruhigen Textfarbe
      statt in Rot. Der Ton ist jetzt ein eigenes Feld im Zustand.
      (b) `StatusBar` rendete `<Icon icon={checkIcon} />` **und** ein `⚠` im
      Text daneben — dieselbe Aussage zweimal.
- [x] **Der Sprachmix-Zähler brach an der geschweiften Klammer ab** —
      2026-09-10 gefunden und behoben. `JSX_TEXT` in `scripts/quellsprache.mjs`
      lautete `[^<>{}]{4,}`: ein Textknoten, in dem **irgendwo** eine Einsetzung
      steht, war für den Zähler nicht vorhanden. Das ist nicht der Randfall, als
      der es aussieht — es ist die häufigste Form, in der eine Beschriftung
      geschrieben wird, sobald eine Zahl darin vorkommt.

      **Der Schaden war die Null.** `lang:check` meldete für alle drei
      Browser-Ordner „0 ungewickelte Zeichenkette(n) in der anderen Sprache",
      und diese Null las sich wie ein Beleg. Gemessen mit dem geöffneten Muster:
      **vier deutsche Beschriftungen** standen roh im JSX eines Repos mit
      Quellsprache `en` — `An Videohub senden (TCP) …` und `Gefunden ({n}) —
      Klick übernimmt IP/Port` (`VideohubExportDialog`), `· {n} ohne Bauart`
      (`CircuitChip`), `· {n} Wände · {n} Personen · {n} Bühne` (`MenuBar`).
      Drei weitere fand erst das Auge, weil sie kein Wort der Wortlisten tragen
      (`Seitenansicht (Tiefe)`, `Vorne ◀ {n} mm ▶ Hinten`, `Kameras ({n})`).

      **Drei Formen waren blind, nicht eine:**
      (a) Einsetzung *im* Satz (`Gefunden ({discovered.length}) — …`);
      (b) Einsetzung *hinter* dem Satz — bei `An Videohub senden …` folgt in
      der nächsten Zeile bloß ein `{cond && (`, und das brach den Lauf ab,
      bevor das schließende `<` erreicht war. Ein Wächter, der an der Klammer
      **hinter** dem Text scheitert, ist schlimmer als keiner;
      (c) der reine Ausdruck als Kind (`` {`· ${n} ohne Bauart`} ``) — kein
      Textknoten, also auch mit geöffnetem Muster unsichtbar. Dafür gibt es
      jetzt `JSX_LITERAL`, und zwar nur für die **reine** Form: was um die
      Zeichenkette herum noch gerechnet wird, ist Code.

      **Nachtrag desselben Tages: das Fragment ist auch ein Tag.**
      `[^\s=<!>]` verbot vor dem `>` ausdrücklich ein `<` — damit `<=` und
      `<Foo>` nicht als Tag-Ende durchgehen. Es verbot damit aber auch `<>`,
      und das ist das **JSX-Fragment**: ein vollwertiges Element, dessen
      Kinder auf dem Bildschirm stehen wie die jedes anderen. Gefunden an der
      Stelle, an der es am meisten weh tut — `ErrorBoundary`, der Text, den
      jemand liest, wenn die App schon abgestürzt ist: „Zusätzlich wurde eine
      Sicherheitskopie des Autosaves angelegt (…)". `<>` kommt in TypeScript
      sonst nicht vor (`=>` fängt das `=`, ein Generic trägt vor dem `>`
      einen Bezeichner, `a < b > c` hat Leerzeichen), die Öffnung ist also
      eng. Der Satz ist jetzt **ein** Schlüssel mit Platzhalter statt eines
      Satzes plus eingebettetem `<code>`.

      **Der Preis ist benannt:** ein Lauf, der über `{` hinweggeht, endet öfter
      mitten im Ausdruck. `NACH_CODE` hat deshalb `return`, `null`, `typeof`,
      `??` und `if (` dazubekommen — `if` steht auf der **englischen**
      Wortliste, ein Bruchstück wie `(null) if (!hasDesktopBridge)` wäre in
      einem deutsch-quelligen Repo als englische Beschriftung gemeldet worden.
      Die feste Probe im CLI-Teil trägt die drei neuen Formen jetzt mit; ohne
      sie fällt genau diese Härte beim nächsten Aufräumen still wieder heraus.

- [x] **Rohe Symbole im JSX: 180 → 138 Stellen, 61 → 50 Dateien**
      (2026-09-10, gemessen über dieselbe Baumsuche wie der Glyph-Wächter).
      Zwei Klassen sind durch, und zwar die zwei, für die `Icon.tsx` genau
      seinen Grund nennt („Emojis rendern je Plattform/Font inkonsistent"):

      **(a) Alle 24 Aufklapp-Carets.** `{open ? '▾' : '▸'}`,
      `{collapsed ? '▶' : '▼'}`, `{offen ? '▴' : '▾'}` und die
      freistehenden `▾` in `MenuBar`, `LibraryMenus`, `RackAddSplitButton` —
      jetzt `<Icon icon={open ? ChevronDown : ChevronRight} />`. Es waren
      **fünf verschiedene Glyph-Paare für dieselbe Geste**; das allein ist der
      Grund, warum ein Aufklapper je nach Dialog anders aussah.

      **(b) 17 freistehende Emoji/Symbol-Kinder**: `🔄` (drei Mal, dieselbe
      Aktualisieren-Aktion), `📦`, `🔍`, `📁` (zwei Mal), `▥` (zwei Mal),
      `🪑`, `⏬`/`⏫` (fünf Mal), `✅`, `📌`, `◆`, `➕`.

      **Ein Wächter ist dabei umgefallen, und das war richtig so.**
      `tests/schriftgroesseUntergrenze.test.ts` sicherte zu, dass die
      Baumsuche „mindestens eine" Stelle unter 12px findet — die sechs
      dekorativen Micro-Glyphen, die es damals noch gab. Die sind jetzt
      `<Icon />` und tragen ihre Größe als Zahl statt als CSS-Klasse, also
      fand sie null. Der Kommentar dort hatte den Fall vorhergesehen und
      benannt. Eine Zusicherung, die am Bestand hängt, geht mit dem letzten
      Fund verloren: „keine Stelle unter 12px" wäre ab dann auch bei kaputtem
      Muster erfüllt. Sie steht jetzt auf einer **festen Probe** — dieselbe
      Form wie im Sprachmix-Zähler.
- [ ] **Offen: 138 Stellen in 50 Dateien**, und der Rest ist keine
      Fleißarbeit mehr, sondern Urteilsarbeit — drei Gruppen mit je eigenem
      Grund:

      **(1) Pfeile im Satz oder im Datensatz** (40× `→`, 11× `←`, 8× `↔`):
      `${from} → ${to}` in einer Stückliste, ein Achsen-Label der
      Routing-Matrix, der Zielhinweis einer Zeile. Das sind **Daten**, keine
      Verzierung, und sie landen in CSV/PDF, wo kein SVG hinkann.

      **(2) `<option>`-Kinder** (`◆ {l}` in `CableProperties`, `📦 ` in
      `InventoryDialog`, `▼` im Videohub-Dialog): `<option>` nimmt nur Text.
      Ein Icon dort ist technisch unmöglich, nicht bloß unerwünscht — wer die
      Zeile „aufräumt", bekommt `[object Object]` in der Auswahlliste.

      **(3) Symbole, die der Wert sind**: `♂`/`♀` an der Steckerbauart,
      `◄`/`►` in der Pfeilspitzen-Auswahl, `▲` des Polardiagramms und die
      elf `ICON_GLYPHS` in `OptionalFieldsSection` — Letztere stehen **im
      Projekt-File**, sind also Nutzerdaten und nicht Darstellung.

      Was danach noch bleibt (`✓ ✕ ✗ ⚠ ● ○ ↺`, ~40 Stellen), ist echter
      Kandidat für Icons, aber jeweils mit Zustandsbedeutung im umgebenden
      Markup — das ist der nächste Schnitt, nicht dieser.

## Phase 5 — Komponenten-Dekomposition (RISIKO)

### Erledigt

- **`RackBuilderDialog`** (2864 → 2614 Zeilen): Datenmodell + reine Helfer
  nach **`rackBuilderModel.ts`** ausgelagert — Draft-Typen
  (`RackPlacementDraft`/`RackDraft`/`InternalCableDraft`), 19″-Konstanten
  und die puren Transform-Funktionen (`parseUnits`, `sanitizeTemplatePorts`,
  `toPlacement`, `normalizeDraft`, `formatRackUnits`, `draftFromPreset`).
  **Reines Verschieben — Markup & Verhalten unverändert** (tsc verifiziert,
  build grün). Das Modell ist jetzt framework-frei und isoliert testbar.

### TODO (bewusst NICHT ohne Laufzeit-Verifikation)

Die eigentliche **JSX-/Hook-Zerlegung** der Mega-Komponenten (präsentationale
Sub-Komponenten aus `RackBuilderDialog` carven, Draft-State-Hook
`useRackBuilderDraft`, dann `LibraryPanel`/`CanvasArea`/`App.tsx`) ist hier
**bewusst aufgeschoben**: Sie verschiebt Closures über lokalen State/Handler
und ist ohne interaktives Durchklicken regressionsträchtig — das verletzt
die Hart-Regel „keine ungewollten Regressionen". Empfohlen als eigener,
mit laufender GUI verifizierter Schritt. `LibraryPanel` hat einen kleinen
sicheren Modell-Block (`PortGroupDraft`/`defaultGroup`/`buildPorts`,
Z. 49–84) als nächsten einfachen Kandidaten.

## Phase 6 — README

### Erledigt

- **Hero-Bild-Sektion** im README (`docs/screenshots/hero.png`) + **Feature-
  Galerie** (2-spaltige Tabelle): `canvas.gif`, `rack-3d.png`,
  `atem-multiview.png`, `export.png`, `patch-sheets.png`, `patch-pdf.png`,
  `bom.png`, `properties.png`.
- **`docs/screenshots/README.md`**: Aufnahme-Anleitung (Slot, Auflösung,
  Format) + verpflichtende Kundendaten-Schwärzungs-Checkliste + Liefer-
  Workflow + GIF-Tipps.
- **`docs/redact-screenshots.mjs`**: lokales sharp-Skript, das den Projekt-/
  Show-Namen (App-Kopfzeile) schwärzt und Statusleiste + OS-Taskleiste unten
  abschneidet — auflösungsunabhängig (Bruchteil-Koordinaten), pro Datei
  justierbar.
- **6 Slots mit echten, geschwärzten/gecroppten Screenshots gefüllt**:
  `hero.png` (Canvas-Gesamtüberblick), `atem-multiview.png`,
  `export.png` (Export-Hub), `patch-sheets.png`, `bom.png` (Stückliste),
  `properties.png` (Rahmen-Eigenschaften). Schwärzung: Projektname in der
  Kopfzeile übermalt, Statusleiste + OS-Taskleiste / Download-Hinweis
  weggeschnitten; Dialoge sinnvoll auf ihren Inhalt gecroppt.
- **Kundennamen aus allen Doku-/Quelltexten entfernt** (dieser Audit,
  Screenshot-Guide, `exportFilename`-JSDoc-Beispiel) — generische Platzhalter.
  Repo-weiter Grep nach Klarnamen = 0.
- Alle gelieferten Roh-Screenshots (`Screenshot (NNN).png`) nach der
  Verarbeitung aus dem Branch-Tree entfernt.

### 2026-09-10 — die Aufnahme ist kein Mensch-Schritt mehr

`npm run docs:shots` (`scripts/screenshots.mjs`) startet die App unter
`xvfb-run`, lädt das eingebaute Beispielprojekt, stellt Sprache und Thema
**fest** ein und nimmt die Slots auf. Aus dem Beispielprojekt heißt: keine
Kundendaten, also **nichts zu schwärzen** — die sicherste Schwärzung ist die,
die nicht nötig ist.

Der Guide behauptete das Gegenteil („können nicht automatisch erzeugt
werden"). Ein Satz, der eine Arbeit für unmöglich erklärt, sorgt zuverlässig
dafür, dass sie liegenbleibt — **gemessen:** die eingecheckten Bilder stammen
aus `v8.1.0-101`, die App steht bei `v9.0.1`. Dazwischen liegen die
Sprachdrehung (E-28) und der Icon-Durchgang; auf `properties.png` ist deshalb
eine deutsche Oberfläche mit Knöpfen zu sehen („Configure multiviewer layout
→", „↻ auto"), die es so nicht mehr gibt.

**Die Bilder sind trotzdem noch die alten — mit Grund.** Eine frische
Aufnahme wurde gemacht und wieder verworfen: das Beispielprojekt ist deutsch
benannt („Kamera 1", „Bildmischer", „Regie-Monitor"), und 12 der 64
ausgelieferten Gerätekategorien ebenfalls („Funkstrecke", „Stromverteilung",
„Sync/Referenz" …). Eine englische Oberfläche mit deutschen Inhalten ist
nicht besser als ein altes Bild, nur anders falsch — und ein Titelbild
schlechter zu machen, ist keine Verbesserung. Der Sprachmix in den
ausgelieferten **Daten** ist als eigenes Issue erfasst (er hängt an einer
Eigentümer-Entscheidung und an einer Schema-Migration, weil
`equipment.category` in den Projektdateien der Nutzer steht). Danach
`npm run docs:shots`.

### TODO (manueller Mensch-Schritt)

- [ ] `canvas.gif` (animierte Canvas-Demo): braucht einen GIF-Encoder, den
      dieser Container nicht hat (kein `ffmpeg`/`gifski`). Einzelbilder kann
      `docs:shots` liefern, das Zusammensetzen nicht.
- [ ] `rack-3d.png`: das Beispielprojekt enthält kein Rack („No rack layout
      saved yet"), die 3D-Ansicht ist also nicht ohne vorheriges Bauen zu
      zeigen. Entweder ein Rack ins Beispielprojekt oder ein zweites,
      neutrales Demo-Projekt für die Aufnahme.
- [ ] `patch-pdf.png`: der gelieferte Shot enthält einen Personennamen im
      Routing-Text. Aus dem Beispielprojekt neu erzeugen, sobald dessen
      Sprachmix behoben ist.
- [ ] **Rohbilder aus `main`/Branch-History bereinigen**:
      `Screenshot (573).png` liegt in `main` (Commit `f5279e9`), die übrigen
      Rohbilder in der Branch-History (`a670c71`) — bei öffentlichem Repo ggf.
      History scrubben (die ungeschwärzten Bilder sind sonst über alte
      Commits abrufbar).

## Abschluss — Gesamtstatus

Alle 6 Phasen abgeschlossen, je ein Commit, gepusht auf
`claude/busy-gates-efLNh` (Phasen 0–3 via PR #333/#334 bereits in `main`).

| Phase | Ergebnis | Status |
| ----- | -------- | ------ |
| 0 Recon/Baseline | `ui-audit.md` + Baseline festgehalten | ✅ |
| 1 Icon-System | `lucide-react` + `Icon`-Wrapper; Close/Warn/Status-Emojis ersetzt | ✅ (Long-tail-Glyphen als TODO) |
| 2 Design-Tokens | `@theme`-Typo-Skala + `--cp-*`-Farb-Tokens; 5 Shells migriert | ✅ (Flächen-Rest als TODO) |
| 3 Accessibility | `useDialogA11y` (role/aria-modal/Escape/Focus-Trap/Rückgabe); ModalShell + 3 Standalone + modalRoot + MenuBar | ✅ (restl. Dialoge als TODO) |
| 4 i18n | `i18n-check.mjs` + 105 fehlende EN-Keys + String-Migration; DE/EN deckungsgleich | ✅ |
| 5 Dekomposition | `RackBuilderDialog`-Modell → `rackBuilderModel.ts` (−250 Zeilen) | ✅ (tiefere JSX-Zerlegung als verifizierter Folgeschritt) |
| 6 README | Hero + Galerie (6/9 Slots) + Capture-/Redact-Tooling + **automatische Aufnahme** (`npm run docs:shots`) | ✅ (canvas.gif/rack-3d/patch-pdf offen; Bilder aus v8.1.0 — Auffrischen hängt am Sprachmix in den Demo-Daten) |

**Verifikations-Endstand:** `npx tsc -p tsconfig.app.json --noEmit` = 0,
`npm run build` grün, `npm run lint` = 124 Fehler / 18 Warnungen
(**3 Fehler unter** dem 127er-Baseline, **0 neu eingeführt**),
`node docs/i18n-check.mjs` = 0 fehlende Keys.

**Offene Hauptpunkte (manuell):** restliche Screenshots (`canvas.gif`,
`rack-3d.png`, `patch-pdf.png`), History-Scrub der Rohbilder, sowie die je
Phase dokumentierten großflächigen Migrations-TODOs (Typo/Token-Rest,
restliche Dialog-a11y, in-`t()`-Glyphen).

## Integrations-Runde — Issues #339–#355

Aus dem strukturierten UI-/Branchen-Bedarfs-Audit (Mai 2026) entstanden 17
Issues. Sie wurden „nacheinander, sinnvoll und non-destruktiv" abgearbeitet
(Branch `claude/busy-gates-efLNh`). Jede Änderung ist additiv — kein Feld,
keine Sektion und keine BOM-Logik wurde destruktiv verändert.

| # | Thema | Umsetzung | Status |
| - | ----- | --------- | ------ |
| 339 | Netzwerk-Felder konsolidieren | Überlappung war durch #306 bereits weg; `macAddress` als einziges feldloses Attribut in Network&Access ergänzt | ✅ (klargestellt) |
| 340 | Bearbeiten-Menü | Undo/Redo/Löschen/Auswahl im neuen Menü | ✅ |
| 341 | Ansicht-Menü | Canvas-Theme, Snap, Labels, Farbmodus, Annotations-Panel | ✅ |
| 342 | Werkzeuge-Menü | Rack-Builder, ATEM-MV/-Audio/-Labels, Videohub, GreenGo, Patch-Liste, Rentman, Analysen, CSV-Import | ✅ |
| 343 | Neu aus Vorlage | Datei-Menü → Vorlagen-Galerie (5 Built-ins + eigene), localStorage | ✅ |
| 344 | RF/Funkstrecken-Analyse | Analysen-Dialog: Wireless-Links + Konflikt-Heuristik | ✅ |
| 345 | Strom/3-Phasen | war vorhanden; um BTU + CSV-Export erweitert | ✅ |
| 346 | Netzwerk-Analyse | Analysen-Dialog: IP/VLAN-Tabelle + Doppel-IP-Erkennung | ✅ |
| 347 | IP-Media-Signale | NDI, NDI-HX, Dante, AES67, ST2110-20/-30/-40 als Signal-Standards | ✅ |
| 348 | Sync-Signale | Blackburst, Tri-Level, Word-Clock, PTP | ✅ |
| 349 | Patch-Liste Etiketten | jsPDF-Etiketten-Export (A4, 2 Labels/Kabel) | ✅ |
| 350 | Auto-Kabellänge | **zurückgestellt** — Canvas ist schematisch, nicht maßstäblich; Geometrie-Schätzung würde BOM verfälschen (Begründung am Issue) | ⏸ dokumentiert |
| 351 | Gewicht/Wärme | Analysen-Dialog: kg + BTU/h pro Kategorie | ✅ |
| 352 | Redundanz | Analysen-Dialog: Single-Power-Feed-Heuristik | ✅ |
| 353 | Audio-/Gewerk-Inputliste | Patch-Liste: Layer-Filter | ✅ |
| 354 | Generischer CSV-Import | Equipment-CSV → Library-Templates (DE/EN-Spalten-Aliase) | ✅ |
| 355 | SVG-Export | Vektor-Export des Canvas neben PNG/JPEG | ✅ |

**16 umgesetzt, 1 bewusst zurückgestellt** (#350 — ein eigenständiges
Feature, das echte Inter-Standort-Distanzen braucht, kein Quick-Win).

**Verifikations-Endstand der Runde:** `tsc` = 0, `build` grün,
`lint` = 142 Probleme (124/18 — Baseline, **0 neu**),
`i18n-check` = 0 fehlende EN-Keys.
