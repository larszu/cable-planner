# Issue-Verifikation — sind alle geschlossenen Issues umgesetzt?

Stand: 2026-06-22 · geprüft gegen Quellcode v8.2.1 · 320 geschlossene Issues, 0 offene

## Methodik

Die Git-History des lokalen Klons ist squash-gemergt (nur 87 Commits, die in
den Issue-Bodies zitierten Commit-Hashes wie `0e6d068`/`5e8eefb` existieren
nicht mehr). Verifikation daher **per Code-Presence**: Existiert das im Issue
beschriebene Feature/der Fix tatsächlich im aktuellen `src/`-Baum? Geprüft über
7 thematische Suchläufe plus gezielte Gegenproben bei Verdachtsfällen.

Auffällig positiv: Sehr viele Stellen tragen explizite `#NNN`-Kommentare
(z. B. `// #515 — Letzter bekannter HE-Stand`, `// #410 — Steckverbinder-
Geschlecht`), d. h. die Umsetzung ist im Code direkt rückverfolgbar.

## Gesamtergebnis

**Praktisch alle geschlossenen Issues sind umgesetzt.** Die wenigen Ausnahmen
sind vom Maintainer bewusst dokumentiert (wontfix / „bleibt offen") oder als
Teil-Umsetzung im Issue-Body selbst beschrieben.

| Kategorie | Verdikt |
|---|---|
| Vollständig umgesetzt (Code-Beleg) | ~95 % der geprüften Substanz-Issues |
| Teilweise umgesetzt | 5 Issues (siehe unten) |
| Bewusst nicht umgesetzt (wontfix / offen) | 2 Issues |

## Nicht / nur teilweise umgesetzt — die echten Lücken

| Issue | Titel | Status | Detail |
|---|---|---|---|
| #118 | Inline/Floating Selection-Toolbar | **Nicht umgesetzt** | Es gibt nur die feste obere `CanvasToolbar`, keine schwebende Selektions-Toolbar. Issue-Body sagt selbst „bleibt offen bis dafür Zeit ist". |
| #121 | Tabs / Sub-Projekt-Konzept | **Wontfix** | Bewusst als `wontfix` geschlossen; Rack-Editor ist Modal, keine persistenten Tabs. |
| #151 | Einzelne Racks/Gruppen exportieren | **Teilweise** | Einzel-Geräte-Export via `exportDevicePdf.ts` vorhanden; eigenständiger Rack-/Gruppen-PDF-Export fehlt (`exportRack.ts` deckt nur Teil ab). |
| #124 | Geräte-Ressourcen pro Modus | **Teilweise** | Modi-Editor (#113) deckt Port-Layout-Wechsel ab; numerische „Ressourcen-Budget"-Logik ist laut Issue-Body bewusst nicht eingebaut. |
| #16 | Export hell/dunkel | **Teilweise** | PDF-Theme-Toggle unabhängig vom Canvas vorhanden; volle Canvas-Theme-Entkopplung nur teilweise. |
| #32 | PDF-Komprimierung | **Teilweise** | FAST-Kompression nur für JPEG; kein genereller Deflate-Flag für Vektor-PDF. |
| #62 | Standard-Kabel-Pflichtauswahl | **Teilweise** | Farben pro Steckertyp/Kategorie umgesetzt (`colorPortsByType`, `DEFAULT_CONNECTOR_TYPE_COLORS`); 3-pin-XLR-Fallback-Prompt nicht eindeutig. |

## Stichprobe der bestätigten Umsetzungen (mit Code-Beleg)

- **#413 CRDT-Kollaboration** — `lib/crdt/projectCrdt.ts`, `syncManager.ts`, `syncTransport.ts`
- **#516 Einladung kopieren** — `lib/collabInvite.ts`, `components/Sync/CollabPanel.tsx`
- **#410 Steckverbinder-Geschlecht** — `Port.gender` in `types/equipment.ts:164`
- **#390 Impedanz-Mismatch** — `checkImpedanceMismatch` in `types/cableSpec.ts`
- **#380 Symmetrisch/Unsymmetrisch** — `checkBalanceMismatch` in `types/cableSpec.ts:786`
- **#372 Verteilverstärker** — `isDistributionAmp` + Check in `drawingChecks.ts:287`
- **#370 Dual-Link SDI** — `dualLinkGroup`, `DualLink-HD` in `types/videoFormat.ts`
- **#373 Kategorie-Property-Schemata** — `lib/categorySchemas.ts` (Kamera/Objektiv/Licht/Audio/Monitor/Strom/Netzwerk/Stativ/Rigging)
- **#113 Betriebsmodi-Editor** — `ModeEditorDialog.tsx`, `DeviceMode` in `types/equipment.ts`
- **#521 Freie Rack-Positionierung** — `shelfOffsetX/Z` in `rackBuilderModel.ts` (Y noch HE-gerastert)
- **#499 Category-Mapping** — `loadRentmanCatMap/saveRentmanCatMap`
- **#434 Workgroup-Library** — `lib/sharedLibrarySync.ts`, `sharedLibraryMerge.ts`
- **#502 Videohub Control Labels** — `lib/exportVideohubLabels.ts`
- **#55 ATEM-MVW Klick-Toggle** — `AtemMvConfigDialog.tsx:164-189`
- **#480/#481 Projektions-/Screen-Rechner** — `ProjectionCalculatorDialog.tsx`

## Hinweis zu Fehlalarmen

Die automatisierten Suchläufe meldeten zunächst einige Issues als „nicht
gefunden" (#42, #43, #36, #50, #138, #108, #5, #516, #184, #370, #372, #380),
die sich bei gezielter Gegenprobe **alle als umgesetzt** herausstellten — nur
unter anderer Benennung im Code. Bei künftigen Audits also auf abweichende
Symbol-Namen achten, nicht nur auf den Issue-Wortlaut.
