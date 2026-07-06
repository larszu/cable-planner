# Lager- & Inventar-Verwaltung — Readiness & Plan

Analyse: Was fehlt, um in Cable-Planner ein **Lagerstand-/Inventar-System**
für **Festinstallation** *und* **Rental** (Vermietung) zu integrieren —
inkl. der bei Rental üblichen Module *Lager* und *Material*.

Stand: 2026-06-15. Ergänzt `docs/architecture.md` und
`docs/festinstallation-readiness.md`.

---

## 1. Was heute existiert (solides Fundament)

Cable-Planner ist **projekt-zentrisch**: eine Datei = ein Plan (ein Event
bzw. eine Anlage). Auf dieser Basis ist bereits viel da:

| Baustein | Datei | Zweck |
|---|---|---|
| Asset-Register (CSV) | `lib/assetRegister.ts` | Übergabe an Betreiber |
| Seriennr./Asset-Tag/QR-ID | `types/equipment.ts` | Identität je Gerät |
| Garantie + Wartungsintervall + Service-Historie | `types/equipment.ts`, `lib/*` | Lebenszyklus |
| Betriebs-Status (`installStatus`) | `types/lifecycle.ts` | geplant…außer Betrieb |
| Änderungsprotokoll (MAC/IMACD) | `slices/lifecycleSlice.ts` | wer/was/wann |
| **Feld-Rückkanal** (pending changes) | `slices/pendingChangesSlice.ts` | Korrekturen aus dem Feld |
| **QR-Scan-Lookup** | `lib/qrPayload.ts`, Mobile | Etikett → Datensatz |
| Installateur-Listen + BOM | `lib/installerLists.ts` | Pull/Termination/Schedule |
| Rentman-Kopplung | `components/Rentman/*`, `lib/rentmanRack.ts` | Import/Export Katalog+Kabelmengen |
| Mietpreis je Gerät (`rentPricePerDay`) | `types/equipment.ts` | Kalkulationsfeld |
| Geräte-Kataloge/Templates | `lib/*Catalog.ts`, `lib/library.ts` | Geräte auf den Canvas ziehen |

**Wichtig:** Die Rentman-Integration ist **Daten-Import/-Export** (Katalog +
Kabelmengen-Abgleich), *kein* Inventar-Management. Bestände, Verfügbarkeit
und Buchungen leben in Rentman, nicht in Cable-Planner.

---

## 2. Was komplett fehlt (die eigentliche Lücke)

Ein Lager-/Rental-System ist **bestands-zentrisch** statt projekt-zentrisch.
Genau diese Achse fehlt:

1. **Zentraler, projektübergreifender Bestand.** Es gibt keine `projects[]`
   und keinen gemeinsamen Pool. „Wir haben 5 ATEM, 3 sind in Projekt A —
   wie viele sind frei?" ist heute nicht beantwortbar.
2. **Trennung Template ↔ Instanz ↔ Bestand.** Ein `EquipmentItem` ist eine
   *Plan-Instanz auf dem Canvas*. Es gibt kein „Lager-Artikel mit Menge N"
   und keine „physische Einheit mit Seriennr." als eigene Entität.
3. **Menge / Verfügbarkeit / Lager-Status.** Kein `quantity`, kein
   `available/reserved/in-repair`, kein Lagerort („Regal A3").
4. **Zeitraum-Buchungen.** Kein `projectStart/End`, keine Reservierung
   „Gerät X 10.–15.6. Projekt A". Damit kein Überbuchungs-/Konflikt-Check.
5. **Lager-Bewegungen / Inventur.** Kein Ein-/Ausgang, Versand, Kalibrier-
   Workflow, Cycle-Count.
6. **Verfügbarkeits-/Auslastungs-Reporting.** Kein „was ist wann frei",
   keine Mehr-Projekt-Kalkulation.

---

## 3. Architektur-Konsequenz

Das ist **keine Slice-Ergänzung**, sondern eine neue Top-Level-Achse. Es
braucht eine vom einzelnen Plan **unabhängige, persistente Bestands-DB**:

```
Inventory (neu, projektübergreifend, eigener Store + Persistenz)
 ├─ items[]        Lager-Artikel (Modell) — Hersteller/Modell/Kategorie/Menge/Mietpreis
 ├─ units[]        physische Einheiten (Seriennr., Lagerort, Zustand) — optional je Artikel
 ├─ allocations[]  Buchung: artikel/unit × projektId × von–bis × Menge
 └─ movements[]    Bewegungen: Eingang/Ausgang/Reparatur/Inventur
```

Jeder Plan (`CablePlannerProject`) bekommt einen optionalen Zeitraum
(`metadata.eventStart/eventEnd`) und referenziert Bestand über
`equipment[].inventoryItemId`. Verfügbarkeit = Bestandsmenge − Summe der
überlappenden Allocations.

Persistenz: eigener Store (`inventoryStore`) + IPC-Domäne `inventory:*`
(lokale JSON-DB im userData-Verzeichnis), unabhängig vom geöffneten Plan.
Optional später: NetBox-/Rentman-Sync als Quelle des Bestands.

---

## 4. Vorgeschlagene Phasen (inkrementell, je eigener PR)

**Phase 0 — Datenmodell-Felder am Gerät (klein, sofort nützlich). ✅ umgesetzt.**
Felder ergänzt, die schon innerhalb *eines* Plans Wert haben:
`ownership` (`owned`/`rented`/`subhire`), `stockLocation`, `purchaseDate`,
`supplier`. Reines Additiv, kein neuer Store. Editierbar in der Geräte-
Lebenszyklus-Section; im Asset-Register-CSV als Spalten.

**Phase 1 — Projekt-Zeitraum. ✅ umgesetzt.**
`metadata.eventStart/eventEnd` + UI im Projektdaten-Dialog. Voraussetzung für
jede Verfügbarkeits-Rechnung. Trivial, aber Türöffner.

**Phase 2 — Zentraler Bestand (Lager-Modul, MVP). ✅ umgesetzt (MVP).**
Neuer `inventoryStore` mit `items[]`-CRUD (Modell/Hersteller/Kategorie/Menge/
Mietpreis/Lagerort/Lieferant/Eigentum). Eigene plan-unabhängige „Lager"-Ansicht
(`components/Inventory/InventoryDialog.tsx`), erreichbar über *Werkzeuge → Lager
/ Bestand…* (gated durchs `rental`-Modul). Seed-Button übernimmt das Equipment
des aktuellen Plans gruppiert (Name+Kategorie → Menge), ohne vorhandene Artikel
zu duplizieren.

Bewusste MVP-Abgrenzung (Folge-Arbeit):
- **Persistenz:** localStorage (`cable-planner:inventory`) statt `inventory:*`
  IPC + JSON-DB — gleiche Strategie wie ui/settings/library, funktioniert in
  Web *und* Desktop. Migration auf eine IPC-DB ist möglich, ohne die Consumer
  zu ändern (sie reden nur mit dem Store).
- **Seed-Quelle:** aktueller Plan statt Rentman-Katalog. Plan-Seed ist immer
  verfügbar; ein Rentman-Katalog-Seed kann denselben `seedFromEquipment`-Pfad
  später wiederverwenden.
- `units[]`/`allocations[]`/`movements[]` bleiben Phase 3+.

**Phase 3 — Verknüpfung Plan ↔ Bestand + Verfügbarkeit.**
`equipment[].inventoryItemId`; beim Platzieren aus dem Lager wählen.
Verfügbarkeits-Badge im Plan („5 angefordert, 3 frei im Zeitraum"). Erzeugt
`allocations[]` aus den Plänen.

**Phase 4 — Material-Modul (Pick-/Packliste & Bewegungen).**
Pack-/Rückgabeliste je Projekt (baut auf BOM + Allocation), `movements[]`
für Ein-/Ausgang, Scan-Erfassung (nutzt bereits gebautes `lib/qrPayload.ts`
+ Mobile-Scanner!). Inventur/Cycle-Count.

**Phase 5 — Reporting.**
Verfügbarkeits-Kalender, Auslastungsmatrix, Überbuchungs-Warnung,
Mehr-Projekt-Mietkalkulation (Menge × Tage × `rentPricePerDay`).

---

## 5. Strategische Empfehlung

Drei gangbare Wege:

1. **Rentman bleibt Lager-Quelle** (kurzfristig): Integration vertiefen,
   Verfügbarkeit aus Rentman lesen statt eigener DB. Wenig Aufwand, aber
   Bestandshoheit bleibt extern und nur für Rentman-Nutzer.
2. **Eigenes Inventar-Modul** (mittelfristig, empfohlen): Phasen 0–4 oben.
   Macht Cable-Planner eigenständig lager-/rental-fähig, baut maximal auf
   Vorhandenem auf (QR-Scan, BOM, Service-Historie, Mietpreis).
3. **Voll-Split Planung/Lager** (langfristig): zwei Modi/Workspaces. Nur
   wenn das Lager zum Hauptprodukt wird.

**Pragmatischer Start:** Phase 0 + 1 sind klein, additiv und sofort
nützlich (auch ohne den großen Umbau). Sie sind die risikoarme Brücke zu
Phase 2.

---

## 6. Lager-Modul — umgesetzt (Stand 2026-07)

Aufbauend auf Phase 2 (`inventoryStore`, `InventoryItem`) ist das Lager-Modul
projektübergreifend nutzbar. Anders als die projektgebundenen QR-Codes auf
Kabeln/Geräten (`lib/qrPayload.ts`) trägt ein **Lager-Artikel** einen festen
Code, der über alle Projekte hinweg denselben Artikel meint (touring-tauglich).

**Artikel (`types/inventory.ts`):**
- `InventoryItem` erweitert um `code` + `codeType` (`qr` | `barcode`),
  `dimensions` (`PhysicalDimensions`: B/H/T in mm + Gewicht kg), `materialKinds`
  (`rental` und/oder `consumable` — bewusst als Menge, weil ein Artikel beides
  sein darf) und `locationId` (Referenz auf einen Lager-Knoten).

### LPN-Modell (License Plate Number) — Lagerorte + Container vereint

Recherche (Rentman Containers, Cheqroom Kits, HireHop Virtual Stock, Flex
Content Builder, Warehouse-LPN/Nested-LPN, Sortly „Ordner = Lagerort") zeigte
das professionelle Muster: **jede scanbare Einheit ist derselbe Knotentyp im
selben Baum** — Lagerplatz (Depot/Raum/Regal/Fach) UND Container
(Case/Transport-Case). Alles Weitere leitet sich aus dem Baum ab.

- `StorageNode { id, name, kind, parentId?, code?, codeType?, dimensions? }` —
  `kind ∈ depot|room|shelf|bin|case|transportCase`. Lagerplatz-Baum
  (Depot → Raum → Regal → Fach) und Container-Verschachtelung (Case in Case in
  Transport-Case) nutzen **dasselbe** `parentId`. Lagerplätze **und** Cases sind
  scanbar (Code).
- `InventoryItem.locationId` zeigt auf einen Knoten. Ist das ein Container, gilt
  der Artikel als **dort eingepackt** — „Case als Lagerort zuweisen" = einpacken.
  Kein separater Pack-Zustand: die Zugehörigkeit ergibt sich allein aus dem Baum.
- `InventorySet { components: {itemId, quantity}[] }` — logisches Kit; die
  Verfügbarkeit ergibt sich aus der knappsten Komponente (HireHop-Prinzip).

**Reine Resolver (`lib/storageTree.ts`, „nichts erfinden"):** `nodePath` /
`nodePathLabel` (Wurzel→Knoten), `rootLocation` (physischer Lagerort =
oberster Vorfahr → Kaskade beim Bewegen eines Transport-Cases), `descendantNodeIds`,
`itemsInNode(recursive)` (alle Artikel über alle Ebenen eines Cases),
`wouldCreateCycle` (Zyklus-Schutz), `availabilityOfSet`.

**Store (`store/inventoryStore.ts`):** persistiert `items` + `nodes` + `sets` in
`cable-planner:inventory`. Aktionen: `addNode/updateNode/moveNode` (mit
Zyklus-Schutz) `/removeNode` (Kinder rücken zum Parent hoch, betroffene Artikel
verlieren den Lagerort), `setItemLocation` (= ein-/auspacken), `addSet/updateSet/
removeSet`. **Migration** vom Alt-Format (`cases[]` mit `contents`) → Case-Knoten
+ `item.locationId` läuft automatisch beim Laden (idempotent). `removeItem` räumt
Set-Komponenten. Heilung akzeptiert nur positive Maße, bekannte Codearten/Kinds.

**UI (`components/Inventory/InventoryDialog.tsx`):** drei Tabs — *Artikel*
(Bestand + Code/Maße/Material-Art + **Lagerort-Dropdown** = Lagerplatz oder Case
zuweisen), *Lagerorte* (rekursiver LPN-Baum mit Codes; Unterknoten anlegen,
verschieben, löschen — Case in Case in Transport-Case), *Sets* (Kit-CRUD mit
live abgeleiteter „N× baubar"-Verfügbarkeit).

**Planer-Filter „nur eigenes Material" (`LocalEquipmentTab` +
`LibraryFiltersMenu`):** Toggle in der Equipment-Library — nur Eigentum
(`ownership=owned`, Modell-Abgleich) vs. gesamte Datenbank.

### Serialisierung, Scan, Packliste, Reporting (Stand 2026-07)

Umgesetzt nach Recherche der Kundenwünsche/-kritik an Rentman + protonic easyjob
(„Seriennr.-Tracking limitiert", „Reporting zu flach", Warehouse-Scan/Packlisten
als meistgelobter Nutzen):

- **Serialisierung** (`InventoryUnit`): neben dem Bulk-Modell (Artikel mit Menge)
  die einzelne physische Einheit — eigene Seriennr./Code, eigener Lagerort,
  **Zustand** (`ok`/`defect`/`inRepair`/`retired`) und **append-only Historie**
  (angelegt/bewegt/Zustandswechsel). Store-Aktionen `addUnit/updateUnit/removeUnit/
  moveUnit/setUnitCondition`; `removeItem` entfernt zugehörige Units mit.
- **Scan-Auflösung** (`lib/inventoryScan.ts`): `resolveInventoryCode` matcht einen
  Code gegen Einheit (Code **oder** Seriennr.), Lager-Knoten und Artikel — analog
  `qrPayload.ts`, aber gegen den projektübergreifenden Bestand. UI: Scan-Zeile im
  Dialog, springt zum Treffer.
- **Digitale Packliste** (`lib/packList.ts`): `derivePackList` sammelt den
  rekursiven Inhalt eines Containers (Sub-Cases + Bulk-Artikel + Einheiten,
  Tiefen-zuerst), `packListToText` als kopierbarer Text. UI: Packlisten-Button an
  Container-Knoten.
- **Reporting** (`lib/inventoryReport.ts`): `buildInventoryReport` — Summen
  (Positionen/Bulk/serialisiert/Tages-Mietvolumen) + Aufschlüsselung nach
  Kategorie/Eigentum/Material/Wurzel-Lagerort und Einheiten nach Zustand. UI:
  Auswertungs-Tab.

**Bewusst ausgelassen (gehört in andere Produkte):** Crew-Scheduling,
Rechnungswesen/CRM, Accounting-Integrationen, Angebots-/Buchungs-Workflow —
Cable-Planner ist ein Verkabelungs-/Signalfluss-Planer, kein ERP. MHD/Ablauf
ebenfalls bewusst nicht (nicht benötigt).

### Druck — Packlisten + QR-Etiketten (Stand 2026-07)

- **Packlisten-Druck** pro Case: Button am Container-Knoten druckt die rekursive
  Packliste als A4-HTML (`lib/inventoryPrint.ts` → `printHtml.ts` per iframe,
  funktioniert in Browser + Electron; der native Druckdialog übernimmt die
  `@page`-Größe).
- **QR-Etiketten-Druck** (Labels-Tab): Quelle wählen (Artikel/Lagerorte/Einheiten
  mit Code **oder** rekursiver Case-Inhalt), Format wählen und drucken —
  **A4-Bögen** in gängigen Avery/Zweckform-Rastern (3667/L7651 65×, 3489/L7160
  21×, 3425/L7159 24×, 3652/L7163 14×) **und Endlos-Rollen** für Labeldrucker
  (Brother DK-11209 62×29, Dymo 99012 89×36, u. a.). QR-Codes via `qrcode`;
  `lib/labelSheets.ts` liefert die mm-genaue Geometrie (mit Start-Offset für
  angebrochene Bögen), rein + getestet.

**Offen (mögliche nächste Schritte):** Scan-Kaskade beim Ein-/Ausbuchen eines
Transport-Cases, echte Barcode-Symbologie (Code128, aktuell QR für alle Codes),
Verfügbarkeits-/Buchungs-Zeiträume (Allocations).
