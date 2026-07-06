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

**Datenmodell (`types/inventory.ts`):**
- `InventoryItem` erweitert um `code` + `codeType` (`qr` | `barcode`),
  `dimensions` (`PhysicalDimensions`: B/H/T in mm + Gewicht kg) und
  `materialKinds` (`rental` und/oder `consumable` — Vermiet-/Verbrauchsmaterial,
  bewusst als Menge, weil ein Artikel beides sein darf).
- `InventoryCase` — ein Flightcase mit eigenen Außenmaßen + Code, das Artikel
  über `contents: CasePackedItem[]` referenziert (Artikelmaße bleiben am
  Artikel, nicht dupliziert).

**Store (`store/inventoryStore.ts`):** Cases werden zusammen mit den Artikeln
in `cable-planner:inventory` persistiert. Neue Aktionen: `addCase`,
`updateCase`, `removeCase`, `packItem` (addiert Stückzahl), `unpackItem`.
`removeItem` räumt gelöschte Artikel aus allen Cases (keine toten Referenzen).
Die Persistenz-Heilung akzeptiert nur positive Maße und bekannte Codearten
(Grundsatz „nichts erfinden").

**UI (`components/Inventory/InventoryDialog.tsx`):** Zwei Tabs — *Artikel*
(mit Code-, Maß- und Material-Art-Feldern) und *Cases* (Case-CRUD + Packen von
Artikeln; das Packgewicht wird aus Leergewicht + Σ Artikelgewichte abgeleitet).

**Planer-Filter „nur eigenes Material" (`LocalEquipmentTab` +
`LibraryFiltersMenu`):** Ein Toggle im Filter-Menü der Equipment-Library zeigt
wahlweise nur Vorlagen, deren Modell als Eigentum (`ownership=owned`) im Lager
steht, oder — Toggle aus — die gesamte Datenbank. Der Abgleich läuft über den
Modellnamen (case-insensitive).

**Offen (spätere Phasen):** Scan-Auflösung eines Lager-Codes zum Artikel
(analog `lookupQrRef`, aber gegen den `inventoryStore`), MHD/Ablauf-Tracking
für Verbrauchsmaterial, Case-Etikettendruck.
