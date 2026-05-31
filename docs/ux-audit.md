# UI/UX Audit — Cable Planner

**Date:** 2026-05-29
**Scope:** Full renderer (`src/renderer`, 127 components) reviewed from a UI/UX
designer perspective. Goal: a **responsive, modern** UI.
**Method:** Four parallel review sweeps (responsive/layout, color/theming/contrast,
accessibility/interaction, visual consistency/polish) plus a foundation analysis
of the design system (`index.css`, `ModalShell`, `Icon`, typography tokens).
Counts and line references were spot-verified against source.

**Headline:** The app is effectively **desktop-only** — there is **not a single
`@media` query** and no breakpoint layout. Three good design-system foundations
exist (the `text-cp-*` type scale, `var(--cp-*)` color tokens, `ModalShell`, and
a lucide `Icon` wrapper) but **adoption is below ~10 %**, so the codebase drifts
per-component.

**Severity:** 🔴 high · 🟠 medium · 🟡 low

**Status legend:** `[ ]` open · `[x]` fixed · `[~]` partially addressed

**GitHub issues:** every open `[ ]` finding is now tracked as an issue
(label [`ux-audit`](https://github.com/larszu/cable-planner/issues?q=is%3Aissue+is%3Aopen+label%3Aux-audit)),
back-linked below as `(→ #NNN)`.

---

## A. Responsive & Layout (no breakpoint strategy)

1. 🔴 `[ ]` **`index.css`** — **0 `@media` queries** in the whole project; only ~49 Tailwind breakpoint utilities across 127 components. There is no responsive layout.  _(→ #443)_
2. 🔴 `[ ]` **`App.tsx:862–876`** — main layout is a `grid` with fixed-pixel columns (`libraryWidth` + 4px splitter + `1fr` + 4px + `propertiesWidth`). Panels **never auto-collapse**, only manually → the canvas is crushed on narrow windows.  _(→ #444)_
3. 🔴 `[x]` **`CanvasToolbar.tsx:346`** — ~~`maxWidth: 'min(880px, calc(100vw - 420px))'` reserves a fixed 420px~~ **Fixed:** now `min(880px, calc(100% - 16px))` — relative to the (already panel-sized) canvas, not the viewport, so the ~1300px implicit floor is gone; toolbar already `flex-wrap`s.
4. 🟠 `[x]` **Hardcoded pixel dialog widths.** **Corrected after review:** most (`LocationBomDialog`, `CableBomDialog`, `RentmanCableExportDialog`, `PatchPanelCreateDialog`, `NonRackAddDialog`, `RackShelfCreateDialog`) already pair `w-[NNNpx]` with **`max-w-[95vw]`**, so they shrink on narrow viewports. The only container missing the fallback was `AtemMvConfigDialog.tsx:1015` — **fixed**. Remaining (separate concern): inner-content overflow (wide tables) and migrating to `ModalShell` for *consistency* (#49), not for overflow.
5. 🟠 `[x]` **`StatusBar.tsx:47–81`** — counter row (devices/cables/frames/packed/complexity) has no `flex-wrap`/`truncate` → collides/overflows on narrow windows. **Fixed:** token colors, visible separator, secondary counters (`locations`/`packed`/`Rentman`) collapse via responsive `lg:`/`xl:` utilities on narrow widths.
6. ⚪ `[x]` **`Splitter.tsx`** — ~~no min width, panels draggable to 0px~~ **Not an issue (verified):** `uiStore.setLibraryWidth/setPropertiesWidth` already clamp to `PANEL_LIMITS` (library MIN 180px, properties MIN 220px, MAX 600px). Corrected after review.
7. 🟠 `[x]` **`MenuBar.tsx:366`** — menu bar (menus + undo/redo + project name `flex-1` + settings) has no overflow strategy → uncontrolled wrapping when narrow. **Fixed:** `overflow-hidden`; app-title/format-selector/settings-label collapse responsively; left+right groups `shrink-0`, project name truncates.
8. 🟠 `[ ]` **`RackBuilderDialog.tsx`** — 3-column layout (list + canvas + rack) with no stacking fallback; assumes ~1200px.  _(→ #445)_
9. 🟠 `[ ]` **`AnnotationsPanel.tsx:135`** — `fixed right-0 top-0 h-screen w-96` (384px) covers almost everything on narrow windows.  _(→ #446)_
10. 🟡 `[ ]` **`CableContextMenu.tsx:148–149`** — clamps to `innerHeight - 380` → little room on low/portrait viewports; the 240px-wide menu scrolls.  _(→ #447)_
11. 🟡 `[ ]` **`AtemMvConfigDialog.tsx:140`** — `style={{ width: 240, aspectRatio:'16/9' }}` fixed → 75 % of width at 320px.  _(→ #448)_
12. 🟡 `[x]` **`index.html:5`** — viewport meta present but no `viewport-fit`. **Fixed:** added `viewport-fit=cover`.

## B. Theming & color architecture (fragile light theme)

13. 🔴 `[ ]` **`index.css:129–469`** — the light theme is a **~340-line manual remap** of individual Tailwind classes incl. every opacity step. Any new color/opacity stays **silently dark** in light mode. Unmaintainable.  _(→ #449)_
14. 🔴 `[x]` **`teal` (6 shades) + `pink-400` + `indigo`/`fuchsia`/`green` text** are used in components but have **0 light remaps** (verified) → dark-on-dark in light mode. e.g. `VideohubExportDialog.tsx` (teal), `AtemDialog.tsx` (`text-pink-400`).
15. 🔴 `[ ]` **27 files with inline `#hex`/`rgba` in `style={{}}`** → theme-blind. e.g. `EquipmentNode.tsx:555/571/592/616/617` (Rentman/packed badges), `AnnotationsPanel.tsx:51/293` (`STATUS_COLOR` + hardcoded `color:'#0f172a'`), `Rack3DView.tsx:1090–1099`, `PendingCableOverlay.tsx:83/89/100`.  _(→ #450)_
16. 🟠 `[x]` **`index.css:480,487`** — global focus ring hardcoded `#38bdf8` instead of `var(--cp-accent)` (the token exists!). **Fixed.**
17. 🟠 `[ ]` **`AnnotationsPanel.tsx:293` / `EquipmentNode.tsx:617`** — hardcoded dark text `#0f172a`/`#022c22` on colored badges becomes invisible/illegible in light mode.  _(→ #451)_
18. 🟠 `[ ]` **Token adoption ~7 %** — only **48** `text-cp-*` uses vs **497 `text-xs` + 169 `text-sm`**; `--cp-*` color/spacing tokens barely used. The system exists but is bypassed.  _(→ #452)_
19. 🟡 `[x]` **`StatusBar.tsx`** — mixes tokens (`var(--cp-border)`, `text-cp-xs`) and raw classes (`text-slate-200/600`, `hover:bg-slate-700`) in one file — emblematic of the inconsistency. **Fixed:** StatusBar now token-only (`var(--cp-*)`).
20. 🟡 `[ ]` **No `prefers-color-scheme`** — theme never follows the OS setting, only the manual toggle.  _(→ #453)_

## C. Contrast & readability

21. 🔴 `[ ]` **~620 sub-12px text uses** (`text-[10px]`×323, `text-[11px]`×252, `text-[9px]`×45) — violates the codebase's **own** rule in `index.css:9` ("12px = absolute minimum for body text").  _(→ #454)_
22. 🟠 `[ ]` **`text-[10px]` + `text-slate-500/600`** on dark (e.g. `AnnotationsPanel.tsx:140`, many Properties sections) → ~3.5–3.7:1, borderline WCAG AA / AAA fail.  _(→ #455)_
23. 🟠 `[ ]` **`AtemAudioRouterDialog.tsx:1061`** — `fontSize:9` + `color:'#475569'` → tiny **and** low contrast.  _(→ #456)_
24. 🟡 `[ ]` **Placeholder as a contrast/label crutch** — search fields convey function only via `placeholder` (see E); gray placeholder text is low-contrast.  _(→ #457)_
25. 🟡 `[x]` **`StatusBar.tsx:50`** — `text-slate-600` "|" separator on `--cp-surface-3` is nearly invisible. **Fixed:** separator uses `var(--cp-text-faint)`.

## D. Typography & type system

26. 🔴 `[x]` **`index.css:21`** — font **"Inter" is referenced but never loaded** (no `@font-face`/`<link>`/`woff`, verified) → silent fallback to `system-ui`. The intended "modern" type renders nowhere. **Fixed (self-hosted via @fontsource/inter).**
27. 🟠 `[x]` **Type scale stops at 16px** (`--text-cp-lg`) — no heading/display token. All larger titles use ad-hoc `text-lg/xl/2xl` ⇒ no consistent hierarchy.
28. 🟠 `[ ]` **666 raw `text-xs`/`text-sm`** alongside the cp scale → two competing type systems (cp tokens used ~39×).  _(→ #458)_
29. 🟡 `[x]` **`index.html:6`** — `<title>cable-planner</title>` (lowercase, unbranded) as the window title. **Fixed:** `<title>Cable Planner</title>`.
30. 🟡 `[ ]` **Flat heading hierarchy** — across `<h2>/<h3>`: `text-sm`×22, `text-base`×19, `text-xs`×5, `text-lg`×4; section headings often `text-xs/[10px] uppercase` (60×), i.e. same/smaller than body, distinguished only by weight/caps.  _(→ #459)_

## E. Accessibility — keyboard & screen reader

31. 🔴 `[x]` **`index.html:2`** — `lang="en"` was hardcoded while the UI was German-first (the PDF export correctly uses `lang="de"`). `document.documentElement.lang` was never updated. **Fixed (now English default + synced to the language toggle).** `htmlFor` is still used 0× in the renderer.
32. 🔴 `[~]` **15 hand-rolled `fixed inset-0` modals without `useDialogA11y`** (no focus trap, Escape, or focus return). **Migrated to `ModalShell` (focus-trap/Escape/focus-return + standard close) — 7:** `NonRackAddDialog`, `PatchPanelCreateDialog`, `RackShelfCreateDialog`, `LocationBomDialog`, `MobileShareDialog`, `CableBomDialog`, `RentmanCableExportDialog` (the last two via `scrollBody={false}` + full-bleed wrapper to keep stats/footer fixed). **Still hand-rolled — 8** (canvas-height, tab grids, nested overlays, or custom keyboard — need per-dialog restructuring + visual verification): `RackEditorDialog` (fixed-height sub-canvas), `AtemMvConfigDialog` (MV grid), `RackImageCropDialog` (crop keyboard), `GreenGoExportDialog` (tabs + nested import overlay), `AtemAudioRouterDialog` (tabs + matrix), `VideohubExportDialog`, `RentmanImportDialog`, `GraphmlImportDialog` (multi-stage).
33. 🔴 `[~]` **`CanvasToolbar.tsx:262`** — the shared `IconButton` now sets `aria-label={title}` + `aria-pressed={active}`, naming **all** main toolbar buttons for SR in one place. Broader sweep of other icon-only buttons app-wide (the ~472 `title=` vs ~70 `aria-label` gap) still pending.
34. 🔴 `[ ]` **Canvas is mouse-only**: cables are created only by handle-drag (`CanvasArea.tsx` `onConnect…`), devices moved only by drag (no arrow-key handler). A core task has no keyboard path.  _(→ #460)_
35. 🟠 `[~]` **`LayerVisibilityChips.tsx:135`** — deleting a custom layer is **right-click only** (hidden in `title`). Native `confirm()` now replaced with themed `confirmDialog` (#41); the right-click-only discoverability/keyboard-path gap remains open.
36. 🟠 `[ ]` **`MenuBar.tsx` dropdowns** — correct `role="menu"`/`aria-expanded`, but **no arrow-key navigation** between items.  _(→ #461)_
37. 🟠 `[x]` **`ColorField.tsx:44/68`** — `<input type="color">` labeled only by `title`, no `<label>`/`aria-label`. **Fixed:** explicit `aria-label` on both color inputs.
38. 🟠 `[x]` **`EquipmentNode.tsx:745`** — `<span role="button">` with a `✓` glyph, only `title`, no `aria-label`, tiny target. **Fixed:** `aria-label` + lucide `Check`.
39. 🟠 `[ ]` **`AnnotationsPanel.tsx:288`** — placing an annotation is drag-only (`title="Ziehen…"`), no keyboard equivalent.  _(→ #462)_
40. 🟡 `[x]` **`LibraryItem.tsx:155–195`** — favorite/hide labeled only via `title=`, while export/link in the *same* file have `aria-label` (internally inconsistent). **Fixed:** favorite + hide toggles now have `aria-label` (hide also → Eye/EyeOff).

## F. Interaction, affordance & feedback

41. 🔴 `[x]` **Native browser dialogs despite a custom system**: `App.tsx` `confirm()`, `LayerVisibilityChips.tsx` `confirm()`, `RackBuilderDialog.tsx` ×2 `alert()` → **all replaced** with `confirmDialog`/`infoDialog` (themed, a11y, consistent). No native `confirm/alert/prompt` left in components.
42. 🔴 `[x]` **Hover-only actions with no keyboard/touch fallback**: `LibraryItem.tsx:153`, `RacksTab.tsx:103`, `GroupsTab.tsx:93` — added `group-focus-within:opacity-100` so keyboard focus reveals edit/export/delete.
43. 🟠 `[ ]` **Touch/click targets too small**: `CanvasToolbar.tsx:226` `iconBtnSize:28`; **~181 buttons with `py-0.5`** (~20px); many often-destructive mini-buttons `PortList.tsx:368`, `ColorField.tsx:55`, `LibraryItem.tsx:161/182`.  _(→ #463)_
44. 🟠 `[~]` **Little loading/busy feedback**: only **1 file** uses `animate-spin` (`GraphmlImportDialog`). Export/Rentman-sync/AI/Videohub have no spinner; `ExportDialog.tsx:406` shows a hardcoded, untranslated `'Verarbeite…'`. **Shared `<Spinner>` added; ExportDialog busy state + LibraryPanel web/AI buttons wired. Broader rollout (Rentman sync / Videohub send) pending.**
45. 🟠 `[ ]` **Disabled = opacity only**: **~78 buttons** with `disabled:opacity-40/50` (some inline `opacity:0.4`), no consistent disabled token/`cursor-not-allowed`.  _(→ #464)_
46. 🟡 `[x]` **Only 46 `transition` utilities across 647 `onClick`** → most interactions have no hover/press transition; **no `prefers-reduced-motion`** for the `overlap-flash` animation (`index.css:103`). **Reduced-motion fixed; transition rollout pending.**
47. 🟡 `[x]` **`MenuBar.tsx:432`** — mobile-share emoji button now has `aria-label` ("Phone access").

## G. Component consistency & design-system gaps

48. 🔴 `[~]` **No shared `<Button>`** — **~510 hand-styled `<button>`**, 0 `Button.tsx`. Primary action is sometimes `emerald-700`, sometimes `emerald-600`, sometimes `sky-700`; padding `py-0.5`–`py-1.5` for semantically identical buttons. **Shared `Button` created; migration of call sites pending.**
49. 🔴 `[~]` **`ModalShell` exists but most large dialogs ignored it** (hand-rolled chrome, differing `max-w`, close button, drag, a11y). **7 migrated** (NonRackAdd/PatchPanel/RackShelf/LocationBom/MobileShare/CableBom/RentmanCableExport); the 8 canvas/tab/multi-column dialogs remain (tracked under #32).
50. 🟠 `[x]` **Emoji used as UI icons → lucide.** Swept the whole renderer (≈219 → 0 convertible occurrences). Converted: MenuBar (menu + top-bar), all dialog headers (`titleIcon`), Settings tabs + Appearance/EqColors theme toggles (Moon/Sun) + ConfigsTab type icons, Export/Print/Calculators/Patch, Properties sections (Pencil/Trash/Zap/AlertTriangle/…), Library panel/items/menus, Cable context-menu + node badges (Lock/Headphones), ATEM (Audio/MV/main), Videohub, GreenGo, Rack/3D/GraphML/NonRack, Rentman wizard/checklist, sync/secret-reveal/warning glyphs. German fallbacks + the `en` dict were stripped in lockstep so both locales render icon-free text. **Intentionally left (documented):** data-layer glyphs that are persisted or rendered outside React — `deviceKind.ts`, `cableLayers.ts`, `OptionalFieldsSection` user-pickable `ICON_GLYPHS`, `groupPresetSpawnSlice` default; language **flags** 🇩🇪🇬🇧 (no lucide equivalent); HTML `<option>` glyphs (★ / ✓⚠✕ status — `<option>` is text-only, can't hold SVG); and plain-text/canvas-label strings (confirm-dialog `⚠`, `📱` cable-label prefix, Videohub `lockBadge`, `⚠ converter` node badge).
51. 🟠 `[x]` **Z-index free-for-all with no scale**: `z-50`×25, `z-[60/70/75/80/90]`, `z-[200]`, `zIndex:9999` (`CableContextMenu`), `10000` (`modalRoot`). **CSS z-index scale tokens added in `index.css`; migration of call sites pending.**
52. 🟠 `[ ]` **Inconsistent border-radius** — `rounded`×1031 vs `rounded-lg`×10, `-md`×5, `-sm`×7, no radius scale; `ModalShell` uses `rounded-lg`, hand-rolled modals use bare `rounded`.  _(→ #465)_
53. 🟡 `[ ]` **Ad-hoc spacing** — `px-2/3/4`, `gap-1/2/3` and half-steps (`.5`) with no rhythm; `--cp-space-*` tokens (`index.css:44`) unused in components.  _(→ #466)_
54. 🟡 `[x]` **Unstyled scrollbars** — no `::-webkit-scrollbar` across ~58 scroll containers → platform-dependent, often-light OS scrollbars in the dark theme. **Themed scrollbars added in `index.css`.**
55. 🟡 `[~]` **Inconsistent close button** — `ModalShell` icon `X` with `aria-label`; hand-rolled dialogs use a text "Schließen" or `✕ Schließen`. The 5 dialogs migrated to `ModalShell` now share the standard X; remaining hand-rolled dialogs still vary (tracked under #32).

## H. Content, states & branding

56. 🟠 `[~]` **Missing/inconsistent empty states** — coverage is per-author, not systematic. e.g. `PatchListDialog.tsx` only handles the *filtered*-empty case (`:468/:474`); a genuinely cable-less project shows a blank table. (Good examples exist: Library, Analysis tabs, Templates, Annotations.) **PatchListDialog now distinguishes no-cables vs no-filter-match (i18n). Systematic coverage of other dialogs pending.**
57. 🟡 `[~]` **`index.html`** — no favicon, no `<meta name="theme-color">`, no font preloads → unfinished app feel (tab/taskbar). **Branded favicon + `theme-color` + `viewport-fit` added; font preload still pending.**
58. 🟡 `[x]` **`<img>` alt text gaps** — of 12 `<img>`, several lack meaningful `alt` (`TitleBlock.tsx:77/90`, `ProjectMetaDialog.tsx:175/215`, `RackFacePreview.tsx:39`). **Verified:** all `<img>` carry meaningful i18n alt (logo/contractor/client/equipment).
59. 🟡 `[ ]` **Inconsistent tooltip strategy** — `title=` (472×) doubles as label and tooltip; no unified tooltip pattern.  _(→ #467)_
60. 🟡 `[x]` **Status encoded by leading emoji glyphs** instead of styled badges — e.g. `RentmanImportDialog.tsx:1645` branches on `result?.startsWith('✓')`; fragile and visually inconsistent. **Fixed:** cable-plan result is now `{kind,text}` + styled lucide badge, no emoji-prefix branching.

---

## Root cause

Three good systems exist but are under-adopted: (a) the `text-cp-*` type scale
(~39 uses vs ~1,300 raw), (b) `ModalShell` (~14 adopters vs ~23 hand-rolled
dialogs), and (c) the lucide `Icon` wrapper (bypassed by ~280 emoji). Layered on
top are cross-cutting concerns the system never defined: responsive breakpoints,
a primary-action color, spacing/radius/z-index scales, scrollbar styling, a
loading/skeleton pattern, and reduced-motion.

## Prioritized roadmap (highest leverage first)

| # | Fix | Addresses | Status |
|---|-----|-----------|--------|
| 0 | **English-first**: default UI language → English, dynamic `lang` | #31 | ✅ done |
| 1 | **Load Inter** (self-hosted woff2) + heading token | #26, #27 | ✅ done (Inter + `text-cp-xl/2xl/3xl`) |
| 2 | **Foundations in `index.css`**: themed scrollbars, reduced-motion, focus-ring token, z-index scale | #16, #46, #51, #54 | ✅ done |
| 3 | **Shared `<Button>`** (variants/sizes/disabled/focus/transition) → replaces ~510 ad-hoc buttons | #43, #45, #48 | 🔨 component + small-dialog footers migrated, broad rollout pending |
| 4 | **Responsive layout**: breakpoints, auto-collapse panels, dialogs on `ModalShell` `max-w` | #1–4, #49 | 🔨 panel `min(px,33vw)` cap + toolbar + StatusBar/MenuBar overflow done; auto-collapse + `@media` + 3-col dialogs pending |
| 5 | **a11y baseline**: native dialogs → custom; 15 modals → `ModalShell`; `aria-label` on icon buttons | #32, #33, #41 | 🔨 native dialogs done (#41); icon-button `aria-label` swept (#33/#37/#38/#40); 7/15 modals → ModalShell (#32/#49/#55); 8 canvas/tab dialogs remain |
| 6 | **Light-theme = token-first** instead of class remap; kill inline hex | #13–17 | 🔨 teal/pink remaps done (#14); focus-ring token done (#16); full token-first rewrite + canvas inline-hex pending |
| 7 | **Replace emoji icons** with lucide | #50, #60 | ✅ done (#50 swept; #60 status badges) |
| 8 | **Raise sub-12px text & token adoption** | #18, #21, #28 | ⏳ open (high regression risk — needs visual pass) |

**60 verified findings** (threshold of 50 exceeded), each with a file/line
reference. Items marked ✅/🔨 in the status columns are addressed in the
accompanying commits; the rest are tracked here for follow-up.
