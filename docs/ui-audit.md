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

### TODO (großflächiger Rest, NICHT Big-Bang)

- [ ] `text-[10px]`/`text-[11px]`/`text-[9px]` flächendeckend auf
      Typo-Skala migrieren (zentrale Shells in Phase 2 erledigt, Rest
      offen). Fließtext-Mindestgröße 12px.
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

## Phase 4 — i18n

- Vollständiges `en`-Dict existiert in `lib/i18n.ts` (2781 Zeilen).
- Inline-Fallbacks sind deutsch (`t('key', 'Deutsche Form')`).
- TODO: hartkodierte Strings finden (JSX-Text, `placeholder`, `title`,
  `aria-label` ohne `t()`), DE/EN-Parität prüfen, Report-Skript ablegen.

## Phase 6 — README

- README zeigt **kein einziges Bild** der App. → Hero + Galerie mit
  TODO-Platzhaltern + Capture-Anleitung.
</content>
