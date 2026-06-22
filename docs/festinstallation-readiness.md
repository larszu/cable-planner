# Cable-Planner für Festinstallationen — Bedarfsanalyse & Roadmap

> Strategie-Dokument. Es beantwortet die Frage: *Was muss Cable-Planner
> können, damit es nicht nur Show-/Event-Verkabelung plant, sondern
> dauerhafte Festinstallationen dokumentiert, die nach der Erstinstallation
> durch einen Dienstleister weiter verändert werden und dynamisch wachsen?*
>
> Adressaten der Features: **Betreiber/Endkunden**, **Elektro-/AV-Installateure**,
> **Architekten/Planer** und der **wartende Dienstleister**.
>
> Stand: 2026-06 · Basis: Codebase v8.2.1 + Branchen-/Standard-Recherche
> (Quellen am Ende).

---

## 0 · Kernthese in drei Sätzen

Cable-Planner ist heute ein exzellentes Werkzeug für den **Projekt-Lebenszyklus
einer Show**: aufbauen, dokumentieren, abbauen — der Plan ist eine Momentaufnahme.
Eine Festinstallation hat einen **Betriebs-Lebenszyklus über Jahre**: der Plan
ist ein *lebendes Dokument*, das jede Move/Add/Change überlebt, von wechselnden
Personen gepflegt wird und am Ende einem fremden Dienstleister übergeben werden
können muss. Die App hat das technische Fundament dafür überraschend weit
(Revisionen, Annotations, Plan-Checks, Tie-Lines, Mobile-Sync), aber alle
Konzepte sind auf den Show-Lebenszyklus zugeschnitten — der Schritt zur
Festinstallation ist primär ein **Konzept- und Daten-Schritt, kein Rewrite**.

---

## 1 · Der fundamentale Unterschied: Projekt vs. Anlage

| Dimension | Event/Show (heute) | Festinstallation (Ziel) |
|---|---|---|
| Lebensdauer des Plans | Tage bis Wochen | Jahre bis Jahrzehnte |
| Wahrheitsbegriff | "wie geplant" (as-designed) | "wie gebaut", laufend aktuell (as-built / living) |
| Wer pflegt | dieselbe Person, die geplant hat | wechselnde Techniker, oft fremde Firma |
| Änderungsmodell | neuer Plan pro Job | inkrementelle MACs auf bestehender Anlage |
| Wichtigster Wert | schneller, korrekter Aufbau | *Auffindbarkeit* Jahre später ("Was ist dieses Kabel?") |
| Ortsbezug | Bühne/Locations frei platziert | echte Räume/Etagen, oft auf Gebäude-Grundriss |
| Abschluss | Abbau | **Abnahme + Übergabe-Paket** |
| Stückliste | Mietliste (Rentman) | Kaufteile + Reserve + Wartungsteile |

Daraus folgen vier Bedürfnis-Cluster, die den Rest des Dokuments strukturieren:
**(A)** mitwachsende Doku, **(B)** Installateur-Listen, **(C)** Architekten-Tauglichkeit,
**(D)** Betreiber-/Kunden-Übergabe.

---

## 2 · Relevante Branchen-Standards (das Vokabular der Zielbranche)

Festinstallation heißt: man bewegt sich in einem Feld mit etablierten Normen.
Wer hier mitspielen will, sollte deren Begriffe sprechen — das ist gleichzeitig
die beste Feature-Checkliste.

**AV-Dokumentation & Symbole**
- **ANSI/AVIXA D401.01:2023** — *Documentation Requirements for Audiovisual
  Systems* (vormals INFOCOMM 2M-2010). Definiert das **Minimum an Doku** für
  ein AV-Projekt: Deckblatt, Zeichnungsindex, Symbol-Legende, Abkürzungen,
  Projekt-Notizen, Geräte-Detailblätter (Pinbelegung, Plattenlayouts),
  Kabel-/Pfad-Informationen zwischen den Komponenten. → *Das ist die Norm, die
  ein Architekt/Betreiber zitieren kann, um ein vollständiges Doku-Paket zu
  verlangen.*
- **ANSI J-STD-710 (CEA/CEDIA-2039, 2015)** — der **AV-Symbol-Standard**: 84
  standardisierte Symbole für Grundriss- und Deckenspiegel-Zeichnungen
  (Audio/Video/Control). *(Korrektur zu einem verbreiteten Irrtum: nicht
  „F501“ — F501 ist Labeling.)*
- **ANSI/AVIXA F501.01:2015** — *Cable Labeling for Audiovisual Systems*:
  Label **an beiden Enden**, ≤ 2 Zoll vom Stecker, **gedrucktes
  selbstlaminierendes** Etikett, hierarchisch **Quelle → Ziel** (Beispiel aus
  der Norm: `VDA2 Out 3 to PROJ Input A`). Lebensdauer des Labels ≥ Lebensdauer
  des Kabels. Handschrift/Isoband ausdrücklich unzulässig.

**Strukturierte Verkabelung / Administration**
- **ANSI/TIA-606-D (2021)** — Administrationsstandard: vergibt **Identifier**
  für Räume, Racks (Grid-Koordinaten z. B. `AD02`), Patchpanels, **Ports**,
  Kabel, Pfade, Anschlussdosen, Erdung, Brandschotts; definiert **Records**
  (Felddefinitionen je Identifier), **Relationen** und **Reports**.
  Vier **Klassen** (1 = ein Raum … 4 = Multi-Campus/WAN). Empfohlenes
  **Farb-Code-Schema** (orange = Demarc, blau = Horizontal, grau/weiß =
  Backbone, …).

**Elektro / Pfad-Dimensionierung**
- **NEC Chapter 9, Tables 1/4/5/8** — Conduit-Füllgrad (1 Leiter 53 %, 2 = 31 %,
  ≥ 3 = 40 %); **NEC 392.22** — Kabeltrassen-Füllung (50 % Leiter, 40 %
  Vollboden). (US; EU-Pendant DIN VDE / Trassen-Belegung sinngemäß.)

**Test & Abnahme**
- **ANSI/TIA-568 + TIA-1152** (Kupfer, Permanent-Link/Channel: Wiremap, Länge,
  Insertion Loss, NEXT/PSNEXT, Return Loss, je mit Marge) und
  **TIA-568.3 / ISO/IEC 14763-3** (Glas: Tier 1 OLTS pflicht, Tier 2 OTDR
  optional). Test-Reports sind **Garantie-Voraussetzung** beim Hersteller.
- **ANSI/AVIXA 10:2013 → D402.02** — *AV Systems Performance Verification*:
  **160 Prüf-Items** in **13 Kategorien**; besonders relevant: **CABL**
  (Labeling/Termination), **DOC** (Doku-Vollständigkeit als prüfbares Item),
  **SERV** (Wartbarkeit).

**Lebenszyklus**
- **MAC / IMACD** (Moves, Adds, Changes [, Disposal]) — die Branchen-Sprache
  für „Anlage verändert sich"; jede MAC ist die dokumentierte Änderungs-Einheit.
- **Revisions-Disziplin**: Revisionsblock (Nr./Datum/Beschreibung/Autor),
  Issue-Status (P/T-Sets → „Issued for Construction" Rev 0 → As-Built),
  Schemata wie **R0 As-Designed / R2 As-Built / R3 As-Installed**.
  Normen: ASME Y14.35, ISO 7200 (Titelblock-Felder), ISO 19650 (Living BIM).

---

## 3 · Was Cable-Planner heute schon hat (das Fundament — nicht wegwerfen)

Wichtig für die Aufwandsschätzung: vieles ist da, nur anders gerahmt.

| Vorhandenes Feature | Datei/Typ | Wiederverwendbar für … |
|---|---|---|
| **Revisionen mit `asBuilt`-Flag** (#412) | `ProjectRevision`, `revisionSlice.ts` | Versionierung/Change-Log einer Anlage |
| **Annotations** mit Status `open/built/resolved` + Autor | `ProjectAnnotation`, `annotationSlice.ts` | Service-/Mängel-Tickets, Punch-List |
| **Plan-Checks** (~20 Regeln) (#411) | `lib/drawingChecks.ts` | Commissioning-Checkliste (10:2013) |
| **Tie-Line-Flag** (permanent vs. Show-Kabel) | `Cable.isTieLine` | Fest-Verkabelung vs. Patch unterscheiden |
| **LocationFrame mit `floor`** | `LocationFrame`, `locationSlice.ts` | Raum/Etagen-Bezug (TIA-606) |
| **Auto-Kabel-Nummerierung** | `lib/cableNumbering.ts`, `metadata.cableNumbering` | Label-IDs nach Schema |
| **BOM-Aggregation via `cableSpecId`** | `cableSpec.ts`, `LocationBomDialog` | Material-/Stückliste je Raum |
| **Längen-Schätzung** (geometrisch) | `metadata.lengthEstimation` | Pull-Listen mit Längen |
| **Patch-Sheets + Patch-Liste** | `Print/`, `Patch/` | Installateur-Arbeitsblätter |
| **DXF-Export (Layer-codiert)** | `lib/exportDxf.ts` | Übergabe an CAD |
| **Mobile-Share + Bauteam-Häkchen** | `mobileShareServer.ts`, `checkState` | Vor-Ort-Erfassung |
| **Read-only Viewer + Annotations-Merge** | `.cpviewer`, `project:import-annotations` | Übergabe an Kunde/Fremdfirma |
| **NetBox-Import** (DCIM) | `library.netbox.*` | Brücke in die Facility-/IT-Welt |
| **CRDT-Fundament** (Yjs, Konvergenz bewiesen) | `lib/crdt/projectCrdt.ts` | Mehr-Personen-Pflege |
| **Geräte-Metadaten** (Serien-Nr., IP/VLAN, Firmware, Power, Bilder, Notes, `categoryProps`) | `EquipmentItem` | Asset-Register |
| **`importSource` + stabile `graphmlId`** | `EquipmentItem` | Re-Import/Sync ohne Datenverlust |

**Lücke auf einen Blick:** kein Gebäude-Grundriss-Underlay, keine echte
Change-History „wer/was/wann" pro Edit, kein Übergabe-/Abnahme-Paket, kein
QR-Label-Lookup, keine standardisierten Symbole/Layer, keine Asset-
/Wartungs-Historie, keine Mehr-Personen-Live-Pflege im Produktivbetrieb.

---

## 4 · Bedarf nach Zielgruppe (Gap-Analyse + konkrete Features)

### 4.A · Mitwachsende Doku — das Herzstück (Betreiber + wartender Dienstleister)

Die Forderung aus dem Auftrag: *Die Vor-Ort-Doku darf nicht nur ein gedrucktes
DIN-A0-Schema vom Installationszeitpunkt sein; Anpassungen müssen leicht
nachtragbar sein, auch ohne den ganzen Plan in technischer Tiefe zu verstehen.*

Das braucht es:

1. **Echte Change-History pro Anlage** (nicht nur Snapshots).
   - Jede Änderung als Eintrag: *wer, wann, was, warum* (Branchen-Begriff: **MAC/IMACD**).
   - Diff-Ansicht zwischen zwei Revisionen („zwischen Rev 4 und Rev 7 wurden
     diese 3 Kabel ergänzt, 1 Gerät getauscht").
   - Aufbauen auf `ProjectRevision` (#412) → von „manueller Snapshot" zu
     automatischem, attribuiertem Change-Log. Voraussetzung: persistente
     Autor-Identität (heute fehlt sie — siehe 4.A-Punkt 5).

2. **„Quick-Edit"-Modus für Nicht-Planer.**
   - Ein vereinfachter Erfassungs-Fluss: „Ich habe vor Ort ein Kabel von Dose
     12 zu Switch-Port 8 gezogen" — ohne Canvas-Layout-Verständnis.
   - Realistisch der **Ausbau der Mobile-Ansicht vom Read/Check-only zum
     Light-Editor** (Architektur-Doku §6.6 nennt genau das als nächsten Schritt;
     braucht eine echte API-Schicht statt File-Push).
   - Erfassbar mit minimalem Wissen: Endpunkt A / Endpunkt B (per Label-Scan
     wählbar), Kabeltyp, Foto, Notiz. Der Eintrag landet als „pending change"
     im Haupt-Plan, der Planer bestätigt/platziert ihn später.

3. **Status-Lebenszyklus pro Kabel/Gerät** über den Show-Zustand hinaus.
   - Heute: `checkState` (gebaut/nicht). Für Festinstallation:
     `geplant → installiert → getestet → in Betrieb → außer Betrieb → entfernt`.
   - Damit bleibt Historie sichtbar statt Daten zu löschen (Heal-Invariante:
     Userdaten nie still löschen → „retired"-Status statt Delete).

4. **Foto-/Dokument-Anhänge an Geräten, Kabeln, Räumen.**
   - „Was ist das?" beantwortet ein Foto besser als jede Zeichnung.
   - Heute sind Bilder Data-URIs im Projekt-File (Größen-Problem bei Festanlagen
     mit hunderten Fotos). → **Asset-Ordner neben der Projektdatei** + Referenz
     statt Inline-Base64 (analog Library-Ordner). Wartungs-Handbücher (PDF),
     Mess-Protokolle, Garantiescheine als Anhang.

5. **Persistente Bearbeiter-Identität + Mehr-Personen-Pflege.**
   - Heute alle Edits anonym; nur Annotations haben Autor. Für ein lebendes
     Dokument unverzichtbar: jede Änderung einem Bearbeiter zuordnen.
   - Skalierungspfad steht in Architektur-Doku §9.4: CRDT-Fundament (#413)
     existiert; nächste Stufe Transport + Store-Bindung. Für reine
     *Nachvollziehbarkeit* reicht aber schon ein Bearbeiter-Name in den
     Revisions-/Change-Einträgen — das ist die günstige erste Stufe.

### 4.B · Elektro-/AV-Installateure — die Arbeitslisten

Installateure setzen *Teile* des Plans um und arbeiten **nicht am Canvas**,
sondern aus **Excel/CSV (editierbar, sortierbar, Status-trackbar) und PDF**
(ausgegeben/abgenommen). Cable-Planner kann diese Listen generieren — heute
fehlt der Großteil als strukturierter Export.

1. **Pull-Liste / Pull-Schedule** (die wichtigste fehlende Liste).
   Spalten (Branchen-Standard): `Kabel-ID/Label` · `Von → Nach`
   (Rack-Panel-Port ↔ Raum-Dose-Port) · `Kabeltyp` · `Länge` (as-built, nicht
   Luftlinie) · `Pfad/Trasse` · `Mantel/Brandklasse` (CM/CMR/CMP/LSZH) ·
   `Termination` (T568A/B, LC/SC/MPO) · `Trommel/Reel` ·
   `Status` (geplant/gezogen/aufgelegt/getestet) · `Testergebnis` · `Notiz`.
   → Datenbasis größtenteils vorhanden (`Cable.from/to`, `length`, `type`,
   `cableNumber`); fehlen Pfad/Trasse, Mantel-/Brandklasse, Reel, Status.

2. **Kabel-Schedule** (Design-Register) und **Termination-Liste**
   (welcher Leiter auf welche Klemme/Port, beide Enden) — TIA-606-Mapping
   Panel-Port ↔ Dose-Port.

3. **Anschlag-/Conduit-Fill-Hinweis pro Trasse** — Conduit-Größe/-Typ,
   Leiterzahl, Füllgrad-Check (NEC Ch. 9 / 392.22 bzw. DIN VDE). Passt
   konzeptionell zu den bestehenden Plan-Checks (`lib/drawingChecks.ts`).

4. **Cut-Liste / BOM mit Längen + Reserve** — heute BOM via `cableSpecId`
   vorhanden; ergänzen um Schnittlängen, ~10 % Reserve, Patchpanel-Ports in
   12er-Schritten, 90-m-Permanent-Link-Grenze als Check.

5. **Test-/Zertifikats-Erfassung** — pro Kabel Pass/Fail + Marge + Referenz
   auf die Fluke-/OLTS-Report-Datei (Garantie-Nachweis). Mindestens als
   Status-Feld + Datei-Anhang.

> Querschnitt: **Excel/CSV-Export mit Status-Spalten** ist für Installateure
> Pflicht (xlsx ist bereits Dependency: `xlsx-js-style`). Der PDF-Pfad existiert
> schon; CSV/Excel-Listen sind der größte Quick-Win für diese Gruppe.

### 4.C · Architekten / Planer — Tauglichkeit für den Bau-Kontext

Kernforderung: AV-/Kabel-Doku muss aussehen, benannt, skaliert, layered, nummeriert
und revisioniert sein **wie der Rest des Architektur-/MEP-Plansatzes** — sonst ist
sie im Bau-Workflow nicht koordinierbar.

1. **Grundriss-Underlay (DWG/PDF) als maßstäblicher Hintergrund.**
   Der mit Abstand größte Hebel und die größte Lücke. Geräte/Dosen/Trassen
   werden *auf den Gebäudeplan* gezeichnet, nicht ins Leere. Braucht:
   PDF/DWG-Import als nicht-editierbares Underlay, Kalibrierung auf bekannte
   Maße, maßstäbliche Platzierung (1:50/1:100). Erst damit werden
   Kabel-Längen vom Plan und Geräte-Positionen vertrauenswürdig.

2. **Standardisierte Symbole (J-STD-710) + Legende-Blatt.**
   84 Norm-Symbole statt Haus-Stil; automatische Legende. Heute hat die App
   `ConnectorSymbol` u. ä. — aber keine plan-view J-STD-710-Symbolbibliothek.

3. **AIA/NCS-Layer & Sheet-Nummerierung.** AV/Kabel gehört auf **T-Layer**
   (Telecom), Strom auf **E-**, Architektur auf **A-**; Blätter als
   `T-101` etc. im Zeichnungsindex. Der DXF-Export ist schon Layer-codiert —
   auf Norm-Layer-Namen mappen.

4. **Maßstäbliche, normgerechte Plansätze** mit Titelblock (ISO 7200-Felder:
   Eigentümer, Status, Revision, Datum, Freigabe) — Titelblock existiert im
   Export rudimentär, fehlende Felder ergänzen.

5. **Revisions-Disziplin auf Zeichnungen**: Revisionswolken + Delta-Dreiecke +
   Revisionstabelle, Issue-Status (Tender/Construction/As-Built). Knüpft an
   Revisionen (#412) und Annotations an.

6. **Riser-Diagramm & Deckenspiegel (RCP)** — vertikale Steig-Schemata
   zwischen Etagen (Bezug zu `LocationFrame.floor`); RCP für Decken-Geräte
   (Beamer, Lautsprecher, Kameras).

7. **Koordination mit anderen Gewerken** — pragmatisch: sauberer **IFC-/DWG-
   Austausch** und Pfad-/Trassen-Objekte mit Geometrie, damit AV-Pfade in die
   Navisworks/ACC-Clash-Welt einspeisbar sind. (Voll-BIM ist out of scope; das
   Ziel ist *interoperabel*, nicht *Revit-Ersatz*.)

### 4.D · Endkunden / Betreiber — Übergabe & Langzeit-Betrieb

1. **Übergabe-/Closeout-Paket als Ein-Klick-Export.** Die Branche hat dafür
   eine fertige Inhaltsliste — das ist eine konkrete Export-Spezifikation:
   As-built-Zeichnungen · O&M-Handbuch · Asset-Register · Commissioning-/
   Test-Zertifikate · Garantien · Ersatzteil-/Reserve-Liste · Schulungsnachweis.
   Vieles davon kann Cable-Planner aus vorhandenen Daten erzeugen.

2. **QR-Label → digitaler Datensatz** („Was ist dieses Kabel? Wo geht es hin?").
   Mainstream-Praxis aus der CMMS-Welt. Jedes Kabel/Gerät bekommt eine kurze
   stabile ID + QR; Scan öffnet den Datensatz (Endpunkte, Typ, Foto, Historie)
   im Read-only-Viewer/Mobile. Konventionen: kurze stabile ID, ≥ 1,6 cm,
   langlebiges Material. → Baut direkt auf `cableNumber` + Viewer/Mobile auf.

3. **Verständliche, nicht-technische As-built-Sicht.** Eine Betreiber-Ansicht,
   die „wo ist was / wo geht das hin" beantwortet, ohne Signalfluss-Tiefe.
   Read-only-Viewer ist die Basis; braucht einen „Laien-Modus".

4. **Asset-/Wartungs-Register.** Pro Gerät: Serien-Nr. (vorhanden), Standort,
   Garantie/Ablauf, Wartungsintervall, Service-Historie. Optional Export/Sync
   in ein CMMS. Felder größtenteils via `EquipmentItem` + `categoryProps`
   schon modellierbar; Wartungs-Historie ist neu.

5. **Kein Vendor-Lock-in.** Offenes, vollständiges Übergabe-Paket = jeder
   Folge-Dienstleister kann übernehmen. Das ist sogar ein Verkaufsargument
   *für* das Tool (der Erst-Installateur liefert saubere Doku als Differenzierung).

---

## 5 · Konkrete Datenmodell-Änderungen (gemappt auf die Architektur)

Alle neuen optionalen Felder gehören in `src/renderer/types/` + Default-Setzung
in `healProjectPositions` (Architektur-Invariante §5.2). Stichpunkte:

- **`Cable`**: `installStatus` (geplant…entfernt), `pathwayId`/`trasse`,
  `jacketRating` (CM/CMR/CMP/LSZH), `reel`, `terminationA/B`,
  `testResult` {pass, marginDb, reportRef}, `labelId` (TIA-606/F501-konform),
  `qrId`.
- **`EquipmentItem`**: `assetTag`/`qrId`, `warrantyUntil`, `maintenanceIntervalDays`,
  `serviceHistory[]`, `attachments[]` (Datei-Referenzen statt Inline),
  `installStatus`, `roomRef` (TIA-606 Raum-/Grid-ID).
- **Neuer Typ `ChangeLogEntry`** (`types/changelog.ts`): {id, ts, author, kind
  (move/add/change/dispose), targetRef, summary, revisionId}. Eigener
  **`changelogSlice.ts`**; speist Diff-Ansicht.
- **Neuer Typ `Pathway`/`Trasse`** (Conduit/Tray) mit Geometrie + Füllgrad —
  Canvas-Objekt analog `LocationFrame`.
- **`ProjectMetadata`**: `floorplanUnderlay` {fileRef, scale, calibration},
  Titelblock-Felder (ISO 7200), Standard-Doku-Profil (D401.01).
- **Asset-Storage**: Ordner neben `.cableplan` (analog `userData/library/`),
  atomic writes; Fotos/PDFs als Referenz. Vermeidet Projekt-File-Bloat.
- **Neuer IPC-Domain** `assets:*` (Datei-Anhänge) bzw. Ausbau `mobileShare:*`
  zum Light-Editor mit echter API (Architektur-Doku §6.6).
- **Export**: neue Generatoren in `components/Export/` — Pull-Liste (CSV/xlsx),
  Termination-Liste, Übergabe-Paket (ZIP/PDF-Bundle), Commissioning-Checkliste
  (10:2013-Stil aus `drawingChecks` ableitbar).

> Heal als Migrationsschicht trägt das: bestehende `.cableplan`-Dateien laden
> weiter, neue Felder bekommen Defaults, nichts wird gelöscht.

---

## 6 · Wettbewerb & Positionierung

Die Recherche bestätigt die Markt-These (schlechte Doku-Tools, hohe Preise) und
— wichtiger — zeigt eine **konkrete, unbesetzte Lücke**.

**Die nächsten Analoga zu Cable-Planner (direkteste Wettbewerber):**
- **WireCAD** — das am ehesten vergleichbare Tool: Punkt-zu-Punkt, Auto-Kabel-
  Nummerierung, Block-Diagramme aus DB, Rack-Layouts, Labels/BOM/Schedules.
  Aber: gealterter Windows-Desktop mit **SQL-Server-Pflicht** für Mehrbenutzer,
  **2D-only**, intransparente Preise, praktisch keine Community/Reviews. Stark
  bei Kabel-Daten, **schwach bei Grundriss-Integration und Übergabe**.
- **NetBox (DCIM, Open Source)** — bestes *maschinenlesbares* Kabel-Pfad-Tracing,
  API-first, gratis. Aber: **keine AV-Medien/Steckertypen** (HDMI/SDI/XLR-
  Erweiterung als „not planned" abgelehnt, Issue #11019), **kein 1-zu-N-Signal**
  (DA/Matrix/Splitter strukturell unmöglich, Disc. #21772), keine Zeichnungen,
  data-entry-lastig. → *Genau die zwei NetBox-Schwächen (AV-Signaltypen,
  1-zu-N-Verteilung) kann Cable-Planner heute schon* — relevant nur als
  Schnittstelle/Datenmodell-Vorbild, nicht als Wettbewerber.

**AV-Design-Plattformen (Cluster mit Doku-Anspruch):**
- **D-Tools SI** — Branchen-Schwergewicht; tiefste Engineering-Zeichnungen, aber
  **nur über externes Visio/AutoCAD** (Zusatzlizenz), steile Lernkurve,
  ~150 $/User/Monat + ~200 $/h Setup, Support-Klagen. **D-Tools Cloud** ist
  bewusst schwach bei Zeichnungen (nur Markup/„Visual Quoting").
- **XTEN-AV** — Cloud/AI-nativ, schnelle Auto-Schematics, riesige Library; aber
  **keine eindeutigen Geräte-Namen → manuelle Label-Nacharbeit**, keine echten
  Maße/Linien, Save/Reopen-Bugs, per-Seat teuer. Benennt selbst die Schmerzen:
  fehlende BOM-Verknüpfung, **Spreadsheet-Schedules brechen zusammen**, siloierte
  Tools, Daten fließen nicht über den Lebenszyklus.
- **Stardraw / Visio+Stencils / AutoCAD** — von „AV-nativ aber Legacy" (Stardraw,
  140k Symbole, J-STD-710) über „billig aber dumme Zeichnungen, alles manuell"
  (Visio) bis „Pflicht-Format DWG, aber keine AV-Intelligenz" (AutoCAD).

**Übergreifende Branchen-Klagen (mehrfach unabhängig belegt):**
1. As-builts veralten / Feldänderungen werden nie erfasst → Techniker
   „reverse-engineeren" die Anlage beim Service-Call.
2. Doku-Tools enden bei Design/Verkauf, **nichts überlebt in die
   Wartungs-/Betriebsphase**.
3. Kein brauchbares Übergabe-Paket für den Betreiber (NIST GCR 04-867:
   **~10,6 Mrd. $/Jahr** Betreiber-Last durch verlorene Projektdaten, größter
   Anteil in O&M).
4. Manuelles Labeling fehleranfällig; **Label ↔ Datensatz driften auseinander**.
5. Schematic ↔ Grundriss ↔ BOM driften (kein Single Source of Truth).
6. Tools zu teuer/komplex für kleine Integratoren; **Abo-Zwang-Frust**
   (Bluebeam, Vectorworks, AutoCAD).

**Lücke = Positionierung für Cable-Planner:** Kein einziges Tool vereint heute
*strukturierte Kabel-/Signal-Daten* **+** *gezeichnete Pläne* **+** *lebende,
mitwachsende As-built* **+** *übergebbares Betreiber-Paket*. WireCAD/NetBox haben
die Daten, aber keine Übergabe; D-Tools/XTEN-AV haben Design, aber Lebenszyklus-
Lücken und Lock-in. Cable-Planner ist als **bezahlbares, offline-fähiges,
Desktop-first Tool** positioniert, das die *Lücke zwischen Show-Tool und schwerem
CAD/CMMS* füllt — mit dem Killer-Feature, das alle vermissen: **durchgängige,
lebende, übergebbare Doku vom Plan bis zum Service-Call** (Label/QR → Datensatz →
Historie), standard-konform (D401.01, F501.01, J-STD-710, TIA-606), ohne
Abo-Falle. Die schon vorhandene **AV-Signal-Intelligenz + 1-zu-N-Verteilung +
3D-Rack** ist dabei genau das, woran NetBox scheitert und was WireCAD/Visio nicht
sauber können.

---

## 7 · Roadmap / Priorisierung

**Stufe 1 — „Festinstallation MVP" (höchster Wert, baut auf Vorhandenem)**
1. Bearbeiter-Identität + echtes Change-Log (`ChangeLogEntry`, attribuierte
   Revisionen, Diff-Ansicht). → 4.A
2. Installateur-Listen als CSV/xlsx: **Pull-Liste**, Termination-Liste, BOM mit
   Reserve. → 4.B
3. `installStatus` + Datei-Anhänge (Asset-Ordner statt Inline-Base64). → 4.A/D
4. **Übergabe-Paket-Export** (Bundle aus vorhandenen Daten). → 4.D

**Stufe 2 — „Plan auf dem Gebäude"**
5. Grundriss-Underlay (PDF/DWG) + Kalibrierung + Maßstab. → 4.C
6. QR-Label-Generierung + Scan-Lookup im Mobile/Viewer. → 4.D
7. J-STD-710-Symbole + Norm-Layer/Titelblock im Export. → 4.C

**Stufe 3 — „Lebende, gepflegte Anlage"**
8. Mobile Light-Editor (Read/Check → erfassen) mit echter API. → 4.A
9. Trassen/Conduit-Objekte + Füllgrad-Checks. → 4.B/C
10. Mehr-Personen-Pflege (CRDT-Transport, #413 weiterführen). → 4.A
11. Commissioning-Checkliste (10:2013) + Test-Erfassung. → 4.B/D
12. CMMS-/Asset-Register-Export. → 4.D

Reihenfolge folgt der Standing Directive „Patch-Versionen bevorzugt" — jede
Nummer ist als eigener, kleiner PR schneidbar; keine großen Sprünge.

---

## 8 · Quellen

**AV-Doku & Symbole**
- ANSI/AVIXA D401.01:2023 — https://www.avixa.org/resources/standards/documentation-requirements-for-audiovisual-systems
- ANSI J-STD-710 (Symbole, 84) — https://www.avixa.org/standards/audio-video-and-control-architectural-drawing-symbols · https://www.sdmmag.com/articles/91402
- ANSI/AVIXA F501.01:2015 (Labeling) — https://www.avixa.org/standards/cable-labeling-for-audiovisual-systems · https://standards.globalspec.com/std/10030464/F501.01
- AVIXA 10:2013 / D402.02 (Verification, 160 Items / 13 Kategorien) — https://www.avixa.org/standards/audiovisual-systems-performance-verification · https://www.ravepubs.com/infocomms-audiovisual-systems-performance-verification-guide/

**Strukturierte Verkabelung**
- TIA-606-C/D (Administration, Klassen, Identifier, Farbcode) — https://www.cablinginstall.com/cable/article/14035166 · https://www.tiafotc.org/tia-standards-update/tia-606-d/ · https://navepoint.com/blog/cable-color-codes-ansitiaeia606/

**Installateur-Dokumente**
- Pull-Schedule (TIA-568) — https://capitalbuildcon.com/cable-pull-schedule-tia-568-a-practical-template-based-guide/
- Kabel-/Termination-Schedule — https://automationforum.co/instrument-cable-schedule/ · https://docs.hexagonppm.com/r/en-US/CADWorx-Electrical-and-Instrumentation-Design-Suite/1367574
- NEC Ch. 9 Conduit Fill / 392.22 Tray — https://expertce.com/learn-articles/nec-chapter-9-table-1-conduit-fill/ · https://fasttraxsystem.com/nec-392-22b1c-explained-cable-tray-sizing-for-mixed-single-conductors/
- Test/Zertifizierung (TIA-1152 Kupfer / OLTS-OTDR Glas) — https://www.belden.com/blog/ansi-tia-1152-and-cat-6a-testing · https://www.belden.com/blog/olts-or-otdr-which-test-is-acceptable-for-fiber-certification

**Architekten / Planer**
- US National CAD Standard / AIA Layer Guidelines (Layer, Sheet-Nr.) — https://www.nationalcadstandard.org/ncs6/content.php · https://www.archtoolbox.com/construction-document-sheet-numbers/
- Maßstäbe — https://www.archdaily.com/904882/understanding-and-using-architectural-scales
- PDF/DWG-Underlay — https://novedge.com/blogs/design-news/autocad-tip-pdf-underlay-best-practices-for-autocad
- MEP-Koordination / Clash — https://bim-services.us/mep-coordination-guide/
- Revisions-Delta-Prozess — https://vdci.edu/learn/autocad/understanding-the-delta-ing-process-in-architectural-design-development

**Betreiber / Handover / Lifecycle**
- As-built / Record / O&M / Closeout — https://www.designingbuildings.co.uk/wiki/O&M%20Manuals · https://mclinestudios.com/understanding-as-built-drawings-in-architectural-documentation/ · https://www.documentcrunch.com/blog/construction-project-closeout
- QR / Asset-Tagging / CMMS — https://blog.invgate.com/qr-codes-for-asset-management · https://www.getmaintainx.com/blog/optimizing-maintenance-with-qr-codes-and-a-cmms · https://upkeep.com/blog/what-is-cmms/
- MAC / IMACD — https://www.techtarget.com/searchdatacenter/definition/moves-adds-and-changes-MAC
- Revisions-Standards (ASME Y14.35 / ISO 7200) — https://ndia.dtic.mil/wp-content/uploads/2008/technical/GastonEngineeringDrawingsY14_35.pdf
- Acceptance/SAT/Punch-List — https://flowdit.com/glossary/site-acceptance-test/ · https://en.wikipedia.org/wiki/Punch_list

**Wettbewerb**
- Vectorworks/ConnectCAD — https://www.vectorworks.net/en-US/connectcad/capabilities · https://xtenav.com/vectorworks-connectcad-pricing/
- Bluebeam Revu — https://www.bluebeam.com/product/ · https://www.bluebeam.com/pricing/
- Branchen-Doku-Lücken — https://xtenav.com/av-rack-cable-management-mistakes-that-delay-projects/ · https://vocal.media/fyi/top-5-av-design-software-tools-for-professionals-in-2025

> Methoden-Hinweis: Die zitierten Norm-Nummern wurden je gegen ≥ 2 Quellen
> geprüft. Einige Norm-Volltexte (AVIXA/ANSI/TIA) sind kostenpflichtig; die
> Detail-Feldlisten stammen aus den offiziellen Beschreibungen plus
> Sekundärquellen, nicht aus dem Norm-Volltext.

---

## 9 · Markt-Validierung — gelobte Features & unbesetzte Lücken

Ergänzende Recherche (Review-Portale, Vendor-Feature-Request-Boards, Fachpresse,
Foren): *Was loben Nutzer an anderer Software, und welche Wünsche erfüllt kaum
jemand?* Methoden-Hinweis: Capterra/G2/TrustRadius und die Canny-Boards
blockieren automatisches Abrufen (403); Zitate stammen aus Such-Index-Snippets
derselben Seiten plus Hersteller-/Help-Dokus. NetBox-GitHub-Issues sind direkt
verifiziert. **Reddit war hart blockiert** — verifizierte Reddit-Zitate fehlen.

### 9.1 · Top-5 Features, die Nutzer loben

1. **„Die Zeichnung ist die Datenbank"** — Schedule/Etiketten/BOM/Rack aus dem
   Plan generiert + auto-Kabelnummerierung mit Fehlerprüfung (WireCAD,
   ConnectCAD, XTEN-AV „~80 % Block-Diagramme automatisch", D-Tools).
   *CP heute: teilweise (Nummerierung, Patch-Liste, BOM, Installateur-Listen).*
2. **Riesige Hersteller-Bibliothek** mit echten Port-Daten/Preisen (Stardraw
   140k, D-Tools 2 Mio., XTEN-AV 1,5 Mio., SketchUp 3D-Warehouse).
   *CP heute: ~500 Templates + NetBox-Import.*
3. **Echtzeit-Multi-User-Kollaboration** (Lucidchart, Bluebeam Studio Sessions,
   Jetbuilt). *CP heute: nur CRDT-Fundament (#413).*
4. **Reaktiver Support + mitwachsende Bibliothek + niedrige Lernkurve**
   (XTEN-AV „Parts in 48 h", SketchUp, Jetbuilt-Onboarding, Q-SYS).
5. **Vor dem Bau validieren** (Q-SYS Emulate Mode; ConnectCAD/WireCAD
   Error-Checking; XTEN AI Connection Checker). *CP heute: stark —
   `drawingChecks.ts` (#411) mit ~20 Regeln.*

Sekundär oft gelobt: daten-verknüpfte Diagramme (Visio/Lucid), Maß-/Takeoff +
Dokument-Vergleich (Bluebeam), 3D-Client-Visualisierung (SketchUp),
Back-Office/QuickBooks + Mobile-Install mit Barcode (D-Tools), Auto-Kabellänge
aus skaliertem Grundriss (D-Tools Wirepath / ConnectCAD), Source-of-Truth +
Audit-Log + API (NetBox).

### 9.2 · Wünsche, die kaum/niemand erfüllt (Rang nach „wie offen")

| # | Wunsch | Verdikt | Bestes Tool heute |
|---|---|---|---|
| ① | Daten-Eigentum/Kontrolle, kein Vendor-Lock-in/still ablaufende Lizenzen | **offen** (im AV-Doku-Bereich) | — (alle Cloud-Abo) |
| ② | Bestehende „chaotische" Doku importieren (PDF/Scans/Alt-Bestand) | **offen** | Cable Pilot (nur CSV) |
| ③ | Lebendes As-built mit **Feld-Rückkanal** (Vor-Ort → kanonischer Datensatz) | **teilweise** (Design-Time ja, Feld-Loop nein) | WireCAD |
| ④ | Kabel-natives QR-Lookup (Scan → Kabel-Datensatz im selben Modell) | **teilweise** (generisch ja, kabel-nativ nein) | GoCodes u. a. (generisch) |
| ⑤ | Foto vom Rack → editierbare Doku (KI) | **offen** | RackScan (Startup, Android-only) |
| – | Auto-Kabellänge aus skaliertem Grundriss | **gelöst** (nicht Lücke) | D-Tools Wirepath, ConnectCAD |
| – | Doku **für Betreiber** statt Ingenieure (Laien-Sicht) | **offen** | — |
| – | Konfig-/Intent- & Steuerungs-Code-Übergabe („BOM ≠ working room") | **offen** | — |

**Wichtige Korrektur:** „Offline / kein Abo" ist als *Wunsch* schwächer belegt,
als zunächst angenommen. Der einzige unabhängige Artikel (Commercial Integrator,
„How AV Integrators Are Misreading Subscription Sales") rahmt den Widerstand als
**Kontrolle/Risiko, nicht Abo-Hass**; D-Tools hat den Offline-Mobile-Wunsch
inzwischen *bedient*. Daher ① als **Daten-Eigentum/Kontrolle** positionieren,
nicht als „kein Abo".

### 9.3 · Board-verifizierte, konkrete Wünsche (mit Quelle)

- **Auto-Kabel-ID = Quelle→Ziel nach AVIXA F501.01** — D-Tools-Request
  „Cable ID Format to include source and destination" („ohne jedes Kabel manuell
  zu labeln"). → *CP-Quick-Win: Geräte-/Port-Namen + `cableLabelId` sind da.*
  <https://d-tools.canny.io/feature-requests/p/cable-id-format-to-include-source-and-destination>
- **Living/Lifecycle-As-built nach Übergabe** — D-Tools „Client Sites" (Items
  „become assets, drawings continuously updated over the life of the system")
  + „end user portal". → *deckt sich mit unserem Lebenszyklus-/Asset-Pfad.*
  <https://d-tools.canny.io/feature-requests/p/client-sites>
- **Auto-Revisions-/Versionshistorie auf der Zeichnung** — D-Tools „Drawings
  Version/Revision History". → *deckt sich mit Revisionen (#412) + changelog.*
  <https://d-tools.canny.io/feature-requests/p/drawings-version-revision-history-visio>
- **„Drawing-Package"-Lücke** (Schedule + Floor-plan-Markup + Line-Drawings als
  *ein* Paket) — mehrfach von Tool-Wechslern gevotet.
  <https://dt.canny.io/drawings/p/cable-schedule>
- **BOM ↔ Items ↔ Label live in Sync** — XTEN-AV-Reviewer: „wish the initial BOM
  and Areas & Items were linked and updated simultaneously"; „no way to assign
  unique device names → extra time for cable labels".
  <https://www.softwareadvice.com/project-management/xten-av-profile/>
- **NetBox (voll verifiziert):** `cable_id`-Feld (#2271), Serien-Nr./Länge/Typ
  (#619), „cable groups" für strukturierte Verkabelung (#7976) — bestätigt die
  Kabel-Metadaten, die wir ergänzt haben (`qrId`, `jacketRating`, Termination …).
  <https://github.com/netbox-community/netbox/issues/7976>

### 9.4 · Schlussfolgerung

Die Schnittmenge ist günstig: **drei der größten offenen Lücken (①, ③, ④) liegen
dort, wo Cable-Planner bereits ein Fundament hat** — lokales Datei-/Daten-Modell
(①), Lebenszyklus/Änderungsprotokoll (③), QR-IDs (④). Empfohlene Reihenfolge:

1. **Positionierung „eigene Daten / kein Lock-in"** aktiv ausspielen (①, kostet
   fast nichts).
2. **Feld-Rückkanal** (Mobile-Light-Editor → pending changes ins
   Änderungsprotokoll) — schließt ③.
3. **QR-Scan-Lookup** im Viewer/Mobile (④, baut auf den neuen qrIds auf).
4. **Auto-Kabel-ID Quelle→Ziel (F501.01)** — kleiner, board-gevoteter Quick-Win.
5. **KI-Import von Alt-Doku (PDF/CSV)** (②) — größter „das-hat-keiner"-Effekt,
   höherer Aufwand.

Von den **gelobten** Features am ehesten ausbauen: „Auto-Doku/Etiketten aus einer
Quelle" (9.1-1) und die schon starke Plan-Validierung (9.1-5) sichtbarer machen.

### 9.5 · Zusätzliche Quellen (Markt-Validierung)

- D-Tools Canny (Boards) — <https://d-tools.canny.io/feature-requests> · <https://dt.canny.io/drawings>
- XTEN-AV Reviews — <https://www.capterra.com/p/10008832/XTEN-AV/reviews/> · <https://www.softwareadvice.com/project-management/xten-av-profile/>
- NetBox Issues — #2271, #619, #7976, #11019 (<https://github.com/netbox-community/netbox/issues>)
- As-built-Drift / Handover — <https://www.cablinginstall.com/design-install/article/16467178/turning-cabling-documentation-into-a-strategic-asset> · <https://www.avixa.org/explore/articles/multi-vendor-av-stack-ownership> · <https://integrio.app/seamless-handovers-creating-professional-av-project-documentation-that-wows-clients-and-saves-you-time/>
- Betreiber-Sicht / Commissioning — <https://www.avixa.org/pro-av-trends/articles/what-do-facility-managers-wish-av-specialists-knew> · <https://www.appa.org/facilities-manager/finishing-av-projects-ten-commissioning-tips-for-facilities-managers/>
- BOM ≠ Working Room / Code-Ownership — <https://www.ravepubs.com/the-av-bill-of-materials-bom/> · <https://www.ravepubs.com/who-owns-the-code/>
- Subscription-Nuance — <https://www.commercialintegrator.com/insights/how-av-integrators-are-misreading-subscription-sales/146404/>
- Foto→Doku (Startup) — <https://rackscan.app/>
- Lob-Quellen — <https://www.g2.com/products/lucid-software-inc-lucid-visual-collaboration-suite/reviews> · <https://www.trustradius.com/products/bluebeam-revu/reviews> · <https://help.qsys.com/Content/Q-SYS_Designer/003_Emulate_Mode.htm> · <https://www.capterra.com/p/149371/Jetbuilt/reviews/>

