# Feature-Recherche: Community-Anforderungen, H2R Gear & ConnectCAD

> Stand: 2026-05 · Zusammenstellung aus AV-/Broadcast-/Event-Community-Quellen,
> H2R Gear und Vectorworks ConnectCAD — abgeglichen gegen den Ist-Stand von
> Cable-Planner (v8.0.10). Zweck: Welche von der Branche gewünschten Features
> fehlen Cable-Planner, und wie aufwändig wäre der Einbau?

## Methodik & Quellen-Caveat

- **Community-Anforderungen**: Recherche über Web-Suche. Reddit-Threads ließen
  sich im Recherche-Umfeld nicht direkt öffnen (403/Egress-Block), daher
  stammen die Aussagen primär aus den **funktional gleichwertigen Fach-Foren**
  (ControlBooth/techtheatre, HARMAN Pro Forums/AMX, Gearspace + ProSoundWeb,
  Vectorworks Community Board, Blackmagic Forum, Sound-on-Sound) plus
  Review-Plattformen (Capterra, G2, SourceForge, Slashdot). Zitate sind
  teils aus Such-Zusammenfassungen paraphrasiert — Original-URLs siehe unten.
- **H2R Gear** und **ConnectCAD**: offizielle Doku/Produktseiten + Foren
  (forum.vectorworks.net). Mehrere Vendor-Domains blockten den direkten Abruf;
  Aussagen dann aus Such-Extrakten derselben Seiten.

---

## Teil A — Was die Quellen sagen

### A.1 · Community (AV / Broadcast / Live-Event)

Die Branche zerfällt in zwei Lager, die beide unzufrieden sind:
**„generisch, billig, einfach"** (Visio, Excel, Lucidchart) vs.
**„AV-schlau, aber teuer/schwer/lock-in"** (D-Tools, ConnectCAD, WireCAD,
Lightwright). Der wiederkehrende Wunsch ist ein **diagram-first
Single-Source-of-Truth-Tool**, aus dem ein Modell automatisch Signalfluss +
Rack-Elevation + Kabelliste + Etiketten + BOM + Power/Wärme/Gewicht erzeugt —
zu einem Preis, den auch kleine Integratoren/Freelancer/Touring-Techniker
rechtfertigen können.

**Genutzte Tools & Kritik (Auszug):**

| Tool | Gelobt | Kritisiert |
|---|---|---|
| Visio | billig, jeder hat es, freie Middle-Atlantic-Rack-Stencils | „Sketching-Tool, kein Engineering"; keine AV-Intelligenz, kein Error-Check, keine Auto-Kabelliste |
| Excel/Sheets | universell, frei, anpassbar | „muss erst angepasst werden um irgendwas zu tun"; keine Automatik/Validierung; manuelle Nummerierung |
| WireCAD | keine CAD-Skills nötig, 100k+ Library, **Auto-Next-Kabelnummer** + DB-Error-Check, Auto-Racks/Labels/Reports | mäßige Public-Ratings; Kabel-Cap im günstigen Tier |
| D-Tools SI | End-to-End (Sales→Service), starke Kalkulation/Procurement, Cloud | **steile Lernkurve** („wie eine neue Sprache lernen") + **Kosten** (~$150/User/Mo) |
| ConnectCAD | native Rack-Elevations/Patchfelder/Signalfluss, Vectorworks-Integration | **teuer + abhängig** (~$183/Mo *plus* Spotlight-Basislizenz), Crashes, steil, „overkill für normale AV" |
| Lightwright | Industrie-Standard Lichtpapierkram, Eos-Integration, Label-Druck „spart Stunden" | Lernkurve, braucht meist Vectorworks dazu |
| Stardraw / AVSnap / XTEN-AV (X-DRAW) | X-DRAW: AV-nativ, Equipment-DB mit Maßen/Connectoren/**Power-Specs**, Auto-Kabellisten + I/O-Matrizen + BOM, **Auto-Power/Wärme**, PDU-Platzierung, **KI** („XAVIA") generiert Rack+Signalfluss aus Text-Prompt, Cloud | AVSnap: schlecht über mehrere Rechner zu syncen; Stardraw: Library-Lücken |
| PatchCAD | riesige Patchbay-Templates (Bantam, **Fibre**, GPO/B-Gauge, Trompeter, MIDI, Video), billig, guter Druck | desktop-only, nur Patchbay-Labeling |

**Top-Anforderungen (nach Häufigkeit gerankt):**

1. **Auto-Kabelnummerierung** mit DB-Integrität (kollisionsfrei, schema-bewusst) — meistgelobtes WireCAD-Feature, meistverfluchte Excel/Visio-Lücke
2. **Kabelliste/Cable-Schedule per Klick** (CSV/Excel/PDF) **aus dem Diagramm** statt abtippen
3. Drag-Drop-**Signalfluss** mit Smart-Connectoren (1:n / n:m, Auto-Route)
4. **Hersteller-Library** mit echten Connectoren & Maßen (Rückseiten, Port-Typen, HE-Größen) — generische Stencils sind Top-Beschwerde
5. **Etiketten-Druck/-Export** zu Label-Hardware (Brady, Dymo, Brother P-touch, TE, Silver Fox), serialisiert, **CSV-Import**, **Barcode/QR**
6. **Auto-Rack-Elevations** (Front/Rück) aus derselben Geräteliste
7. **Power + Wärme + Gewicht**-Berechnung, PDU-Sizing/-Platzierung, Airflow-Spacing, HE-Summe (AVIXA/IEC)
8. **Single-Source-of-Truth / Live-Sync**: Gerät einmal ändern → Signalfluss, Rack, Kabelliste, Etiketten, BOM aktualisieren sich
9. **Patch-/I/O-Liste + Stage-Plot** (Eingangslisten, Patch-Sheets, Tielines)
10. **Cloud-Kollaboration / Multi-User** Echtzeit
11. **Mobile/Tablet-Feldzugriff** — aktuellen Plan/Rack vor Ort am Handy
12. **QR-Codes** auf Etiketten/Plänen → Scan springt zu Spec/Doku/As-Built/Wartung
13. **Versions-/Revisionskontrolle** (Design-Revs A/B/C, As-Built 0/1/2, Revision-Clouds, eine autoritative Ausgabe)
14. **Fiber vs. Kupfer / Connector-Typ-Awareness** (Bantam, BNC/SDI, Trompeter, Fibre, Cat/RJ45, Dante/AES67)
15. **AV-over-IP / Netzwerk-Doku** (VLAN/Switch-Maps für Dante + NDI + ST2110; Dante-Naming ≤31 Zeichen, `channel@device`)
16. **BOM / Angebot / Procurement**-Integration (Diagramm → Geräteliste → Angebot, CRM/Buchhaltung)
17. **KI-gestützte Generierung** (Raum/System in Klartext → Rack + Signalfluss + Kabelmap + BOM)

**Pain-Points (übergreifend):** Preis-/Lizenz-Stacking; steile Lernkurven;
generische Tools ohne „AV-Hirn"; Library-Lücken; Doku-Rot/kein
Single-Source-of-Truth; Stabilität; Export-Reibung; Sync/Portabilität. Der
**viszeralste Schmerz** ist die *Abwesenheit* von Doku: geerbte Racks, in denen
„nichts beschriftet ist, Troubleshooting zur Hölle wird und alles überhitzt".

**Feld-Workflow:** Prep im Shop (Signalfluss → Rack-Elevation → Kabelliste →
Etiketten **vor** Abfahrt drucken); Flypacks/OB vorverkabelt mit Raceways;
Audio-Doku = Eingangsliste + Patch-Sheet + Stage-Plot; Beschriftung muss
„Crew-Wechsel überleben"; As-Built/Revision = Best-Practice, wird aber unter
Zeitdruck oft geskippt → genau der „undokumentierte-Rack"-Albtraum.

### A.2 · H2R Gear (von „Here To Record")

Browserbasiertes AV-Signalfluss-/Planungstool — die **leichtgewichtige
Cloud-Alternative zu ConnectCAD**, direkt mit Cable-Planner vergleichbar.
(Zu unterscheiden von der Schwester **H2R Graphics**, einem Broadcast-Grafik-
Tool — nicht für Verkabelung.)

- Canvas mit **Gear / Zones / Shapes / Text-Labels**; Kabel von Inputs (oben) zu
  Outputs (unten); **18+ Kabeltypen** inkl. Power/Dante/NDI/Fibre, **Custom-Kabel**
- **Patchlist** (Source↔Destination) + **CSV-Export**; **Packlist** (auto aus Plan)
- **Community-Library** + **Custom-Item-Builder** (Auto-Increment bei Duplikat)
- **Zones** (farbcodierte Räume/Stages/Racks)
- **Cloud-Echtzeit-Kollaboration**, Teams (Admin/Member), **Read-only-Share-Links**,
  Multi-Location — das **Alleinstellungsmerkmal**
- Web/Tablet (keine native App); Export PNG/JPG/PDF
- **Gating**: Zones, Patchlist, Bild/PDF-Export, mehr aktive Pläne = Bezahl-Tier;
  Free = 2 aktive Pläne
- **Bewusst kein CAD**: keine maßstäblichen Pläne, keine echten Kabelweg-Längen
  durchs Gebäude, kein Conduit-Sizing (das sind ConnectCAD-Stärken)

### A.3 · Vectorworks ConnectCAD

Reifes AV-/Broadcast-Signalfluss- & Kabel-CAD; läuft **nur** als Add-on auf
Vectorworks Spotlight/Design-Suite (nicht standalone).

**Feature-Set (Auszug):**
- Schematics mit **farbcodierten Signaltypen**; Devices = Blöcke mit Sockets;
  Connect-Tool baut Circuits mit Richtungspfeilen; Adapter-Tool
- **Cable-Path-Tool**: physischer Kabelweg als Netzwerk, **Auto-Längen** +
  **Conduit-Sizing** + Materialbedarf; Cable-Route-Override
- **Regelbasierte Kabelnummerierung** (Bedingungen aus Source/Dest/Socket/Device,
  Präfixe, `?`-Wildcard); Auto-Device-Numbering + Renumber
- **Etikettendruck**: Labels aus Worksheet-Daten, inkl. **Barcodes & QR**,
  pro Zeile variierend, Output PDF/Sheet
- **Reports**: Circuit-Reports, Device-Inventare, **Cable-Schedules**,
  Jackfield/Term-Panel-Reports, **As-Built-Doku**, Cable-Riser-Diagramme
- **3D-Rack-Workflow** (2024) + **Create-Rack-Elevation** (2D Front/Rück) +
  HE/Breiten-Management; Panel-Builder/-Styles für Patchfelder
- **Device-Builder** mit Make/Model-DB-Auto-Fill; **CSV-Device-Import**
- **Live-Error-Checking** („ConnectCAD Status": Sockets/Devices/Circuits/Signale
  prüfen; Error- & Notify-Markup, z.B. inkompatible Signale)
- **Power-Schematics** aus Lichtplot (2025); **Jetbuilt**-Integration fürs Quoting
- 2026: separate Geräte-DB abgeschafft → Daten hängen an 3D-Symbolen (Resource-Manager)

**Unerfüllte Feature-Wünsche (das Kern-Deliverable — gerankt):**

1. **Geteilte/synchrone Geräte- & Connector-Library im Team** (Workgroup/Cloud) — größte wiederkehrende Lücke; heute nur manuelles `.txt`-Kopieren
2. **Cloud/Web/Mobile + Echtzeit-Kollaboration** für verteilte Teams (strukturelle Schwäche vs. Cloud-Tools)
3. **Panels/Patchfelder, die in 3D-Racks einrasten** (der einzige explizite „Wishlist"-Forenpost) — erscheinen sonst nicht in Rack-Elevation
4. **Batch-Edit von Jackfield-/Term-Panel-Defaults** (heute jedes einzeln)
5. **Multicore/Fiber-Modellierung** (Breakouts, beidseitige Stecker, Strands)
6. **Natives Kosten/BOM/Quoting** (heute nur via externes Jetbuilt)
7. Custom-Signal-/Connection-Typen leichter ergänzen; user-erstellte Devices editieren
8. **Device-URL-Feld** zu Datenblatt/Hersteller (für Reports)
9. Anpassbares **Cable-Length-Dropdown** am Circuit-Tool
10. **Vektor-Grafik-Import** (heute nur Raster)
11. Cable-Numbering-Settings sollen Workgroup-Schemata zeigen
12. **Connector-Gender/-Richtung** sauber handhaben
13. Power-/Daten-Outlet ↔ Schematic ↔ Schedule enger verknüpfen

**Kritik/Limits:** ~$153–183/Mo **plus** Pflicht-Basislizenz; steile Lernkurve
(„Spezialisten-Tool, ohne Training schwer"); desktop-/Vectorworks-gebunden;
Connect-Tool-Bugs (Arrow-Style-Override, verlorene Verbindungen nach
Copy/Paste); Project-Sharing-Dateigröße (66 MB → Commit-Fehler);
2026-DB→Symbol-Migration als Übergangs-Reibung.

### A.4 · WireCAD (Holbrook Enterprises)

Etablierter **Windows-only .NET-Desktop**-Standard für Broadcast-/AV-Signaldoku
seit 2000; **standalone** (kein AutoCAD/Visio nötig) — der direkteste
Funktions-Konkurrent zu Cable-Planner.

- **Kern:** Single-Line-Blockdiagramme mit DB dahinter, „keine CAD-Kenntnisse
  nötig"; 1:1 / 1:n / n:1 / n:m-Kabel; v10 brachte Multi-Relational-Cables +
  Split/Pointer.
- **Stärken (genau unsere Themen):** **Auto-Kabelnummerierung** mit „next number +
  DB-Error-Check" (= unser neues #3-Feature), **Auto-Rack-Layouts** (Rack-Builder,
  location-aware „ripple"), Kabel-Etiketten, **Cable-Schedules/BOM/Reports**,
  **Excel-Round-Trip** (Grid→Excel→Reimport), **Community-Library 100.000+ Geräte**,
  **Plugin-/Scripting-SDK**, Visio-/DWG-/DXF-Export. Backend **VistaDB** (lokal,
  nicht SQLite) oder **SQL Server** (Multi-User, nur PRO+).
- **Editionen:** XLT (Single-User) / PRO (Multi-User + SQL) / CMS (formular-
  getriebenes Fiber-Management); separate Cloud-App **Simple Wires**; das alte
  freie **XL (2.000-Kabel-Cap)** ist faktisch eingestellt.
- **Preise (Snippet-Quellen, Ranges):** ~**$220/Mo** (XLT) bzw. **$440/Mo** (PRO);
  Perpetual bis ~**$2.400** (Standard), **CMS $4.800–$7.500**; Wartung „Assurance"
  = **60 % vom Listenpreis/Jahr**.
- **Schwächen/Wishlist:** historische Instabilität (älter, „much improved"),
  **kein Mac/Cloud/Mobile** im Desktop (Mac nur via CrossOver), **Library-Aufbau
  arbeitsintensiv** wenn ein Gerät fehlt, Preis-/„Convince-your-boss"-Hürde,
  **praktisch kein unabhängiger Review-Footprint** (nicht auf Capterra/G2/
  TrustRadius). „Dated UI / Lernkurve" plausibel, aber **in Quellen nicht belegt**.
- **Cable-Planner-Bezug:** WireCADs Vorzeige-Features (Auto-Nummer, Rack-Auto-
  Layout, Schedules, Library) sind genau unser Spielfeld; unsere Vorteile bleiben
  offenes Format, Cross-Platform, ATEM-Live-Control, 3D, kostenlos.

### A.5 · XTEN-AV — X-DRAW + XAVIA (KI)

**Cloud/Web-natives** AV-Design-Tool mit aggressivem KI-Marketing; positioniert
sich als D-Tools-Alternative. (Vendor-Domains blockten den Abruf → Snippet-basiert;
Capability-Zahlen sind Marketing, sofern nicht unabhängig markiert.)

- **Features:** Auto-Signalfluss + **Rack-Elevations** + Patch-Panel-Layouts,
  **Auto-Cable-Schedules/IO-Matrizen**, **BOM/Angebote**, **Auto-Power + Wärme +
  PDU-Platzierung/Load-Balancing**, Equipment-DB („1,5 Mio. Produkte" [VENDOR]),
  2D/3D-Floorplans, **Cloud-Kollaboration** (Team-Features ab Business), iOS-App,
  **CAD/Visio-Im-/Export** (DWG/DXF/VSD/SVG). **XAVIA**: Text-Prompt → Rack +
  Signalfluss + BOM.
- **Preise (mehrfach bestätigt):** **$139 / $149 / $169 pro User/Monat**
  (Basic/Business/Enterprise), ~25 % Jahresrabatt; **XAVIA-KI in allen Tiers
  inklusive**; PM-Add-on X-PRO **+$15/User/Mo**; 15-Tage-Trial. Capterra
  **4,7/5 (45 Reviews)**.
- **Schwächen (unabhängig — Capterra/Software Advice/Medium):** „**keine echten
  Linien/Maße** in X-Draw", neuer Tab bei jedem Klick, **Duplikate nach Reopen**,
  **Cable-Schedule-/eindeutige-Gerätenamen-Probleme**, „**viele Produkte ohne
  hinterlegte Connections**", Doku nicht auf Französisch, Lernkurve. **XAVIA-
  Praxistest:** „sehr beeindruckend" als Startpunkt, aber **fehlerhafte/ungewollte
  Stücklisten** → „in 12–24 Monaten" ernstzunehmen. Wishlist: BOM↔Areas live
  koppeln, schnellere Library-Updates.
- **Cable-Planner-Bezug:** X-DRAW vermarktet **Power/Wärme + PDU** und **Auto-
  Schedules** als Premium — Power/Wärme **haben wir schon**, Auto-Cable-Schedule-CSV
  **jetzt auch** (#4); PDU/Airflow ist Opportunity #7/E6, KI-Generierung #17/E14.

### A.6 · D-Tools — System Integrator (SI) + Cloud

**Business-Lifecycle**-Plattform (Sales → Design → Procurement → Install →
Service), kein reines Plan-Tool — **komplementär** statt direkter Konkurrent.

- **SI (Windows-Desktop + SQL Server):** Estimation/Angebote, **native Visio-/
  AutoCAD-Zeichnungen** (Line-Diagrams, Rack-Elevations, Schematics, mit BOM
  verlinkt), Procurement, PM (Gantt), Field/Service + **Mobile-App (offline)**,
  Accounting (QuickBooks/NetSuite/Sage/Solutions360).
- **Cloud (SaaS):** CRM + **Visual Quoting**, Multimedia-Angebote, E-Sign,
  Payments, Service-Management, **KI-Suche + Scope-Generierung** — **aber kein
  Visio/AutoCAD**; Line-/Plan-/Rack-Zeichnungen sind **Roadmap**.
- **Geteilt:** **Integrated Product Library ~1,6 Mio. Produkte / 1.200+ Marken**
  mit **Händler-Preisen**, täglich aktualisiert.
- **Preise:** **Cloud** transparent — **Solo $0**, **Single $89/Mo** (jährl.),
  **Duo $161/Mo**; Setup-Fee **$250**; Accounting-Add-on **+$50/Mo**. **SI**
  quote-basiert — ~**$150/User/Mo**, **Hosting $149/Mo**, **Services $200/h**,
  jährliche „Software Assurance".
- **Schwächen/Wishlist:** SI **steile Lernkurve** („wie eine neue Sprache lernen"),
  schwaches **Service/CRM + Scheduling** vs. starkem Estimation, Mobile internet-
  abhängig, **Windows+SQL**-Zwang, teuer für kleine Firmen. **Cloud:** **kein
  AutoCAD/Visio** („AutoCAD is a must"), Visual-Quoting „slow & clunky", Daten
  **nicht modulübergreifend zentralisiert**, Capability-Decke für komplexe Projekte
  (→ Migration zu SI).
- **Cable-Planner-Bezug:** D-Tools-Cloud-User vermissen genau **CAD-Zeichnungen/
  Cable-Schedules/Rack-Elevations** — Cable-Planners Kernstärke. D-Tools' Stärke
  (Procurement/Preise/CRM) ist bewusst **out of scope**; ein minimaler
  Brückenschlag wäre der Quoting-Layer #16/E11.

### A.7 · Preis-Übersicht (Richtwerte 2025/26)

| Tool | Modell | Richtpreis | Plattform | Offenes Format |
|---|---|---|---|---|
| **Cable-Planner** | selbst-gehostet | **0 €** | Win/macOS/Linux | **JSON, offen** |
| H2R Gear | Cloud-Abo | Free (2 Pläne) → Paid (Tier nicht öffentlich) | Web/Tablet | nein |
| ConnectCAD | Add-on-Abo | ~$153–183/Mo **+** Vectorworks-Basislizenz | Win/macOS (VW) | nein |
| WireCAD | Perpetual/Abo | ~$220–440/Mo · ~$2.400 perp. · CMS $4.800–7.500 | Windows | nein |
| XTEN-AV X-DRAW | Cloud-Abo | $139–169/User/Mo (XAVIA inkl.) | Web/iOS | nein |
| D-Tools Cloud | Cloud-Abo | $0 / $89 / $161 pro Mo (+ Setup $250) | Web/Mobile | nein |
| D-Tools SI | Abo/Quote | ~$150/User/Mo + $149/Mo Hosting + $200/h | Windows+SQL | nein |

> Wettbewerber-Preise sind Snippet-/Aggregator-Richtwerte (mehrere Vendor-Seiten
> blockten den direkten Abruf) — vor Entscheidungen live verifizieren.

---

## Teil B — Abgleich gegen Cable-Planner

Legende: ✅ vorhanden · 🟡 teilweise · ❌ fehlt. Aufwand grob: niedrig
(< 1 Tag), mittel (2–5 Tage), hoch (Woche+/strukturell).

| # | Feature | Quelle(n) | Cable-Planner heute | Aufwand | Andockpunkt |
|---|---|---|---|---|---|
| 1 | Drag-Drop-Signalfluss + Smart-Connectoren | Reddit#3, H2R, CCAD | ✅ ReactFlow-Canvas, Ports, Auto-Routing, **Layer-Auto-Detect** aus Connector | — | Canvas/ |
| 2 | Hersteller-Library mit echten Connectoren/Maßen | Reddit#4, H2R, CCAD | 🟡 Built-in-Kataloge (Blackmagic/Ubiquiti/Kameras/Monitore) + **NetBox**-Import + CSV-Import; keine 100k-Bibliothek | mittel (Library-Quellen ausbauen) | lib/*Catalog.ts, netboxImport.ts |
| 3 | **Auto-Kabelnummerierung mit Schema/DB-Integrität** | **Reddit#1**, CCAD (stark) | ❌ existiert nicht (nur Port-Labels via portNumbering) | mittel | neue lib/cableNumbering.ts + cableSlice + Settings |
| 4 | **Cable-Schedule-CSV** (from/to/Port/Länge/Nummer) | **Reddit#2** | 🟡 Kompakt-Patchliste (1 Zeile/Kabel) als **PDF/Print** + Kabel-BOM als **CSV**; reine Pro-Kabel-CSV fehlt | niedrig | Export/PatchListDialog + neue CSV-Serialisierung |
| 5 | **Etiketten zu Label-Printern (Brother/Brady/Dymo-CSV) + Barcode/QR** | Reddit#5,#12, CCAD | 🟡 PDF-Etiketten-Bogen (#349) vorhanden; **kein** Printer-CSV, **kein** Barcode/QR | niedrig–mittel | exportDevicePdf.ts (+ `qrcode`-Dep ist schon da; JsBarcode ergänzen) |
| 6 | Auto-Rack-Elevations Front/Rück | Reddit#6 | ✅ exportRack: front/rear/iso/top | — | lib/exportRack.ts |
| 7 | Power + Wärme + Gewicht; **PDU-Sizing/Airflow** | Reddit#7, X-DRAW | 🟡 Power 1/3-phasig, Phasenverteilung, Wärme (BTU/h), Gewicht/Kategorie ✅; PDU-Platzierung/Airflow ❌ | mittel | Calculators/ + Rack/ |
| 8 | Single-Source-of-Truth / Live-Sync | Reddit#8 | ✅ projectStore = SSOT; BOM/Patch/Labels/Analysen leiten alle daraus ab | — | store/ (Stärke!) |
| 9 | Patch-/I/O-Liste; **Stage-Plot** | Reddit#9 | ✅ PatchListDialog (Gewerk/Audio-Filter); Stage-Plot ❌ | mittel (Stage-Plot) | Patch/ |
| 10 | **Echtzeit-Kollaboration / Multi-User** | Reddit#10, **H2R (USP)**, **CCAD#2** | ❌ Single-File | hoch | arch.md §9.4 (Yjs-Pfad skizziert) |
| 11 | Mobile/Tablet-Feldzugriff | Reddit#11, H2R, CCAD | 🟡 **Mobile-Share read/check-only** — genau der Feld-Use-Case, aber nur lesen/abhaken | mittel–hoch (Editor) | MobileShare/, mobileShareServer.ts |
| 12 | **QR auf Etiketten/Plan → Spec/As-Built** | Reddit#12 | ❌ QR nur für Mobile-Connect | niedrig–mittel | exportDevicePdf + `qrcode`-Dep |
| 13 | Revisions-/Versionskontrolle | Reddit#13 | ❌ Undo nicht persistiert; kein Rev-Schema/Revision-Clouds | mittel | neuer Slice + Annotations (Clouds) |
| 14 | Fiber vs. Kupfer / Connector-Awareness | Reddit#14 | ✅ Connector-Typen inkl. Fiber/SFP+; Layer-Auto-Detect | — | types/cable.ts, cableLayers.ts |
| 15 | AV-over-IP-/Netzwerk-Doku (VLAN/Switch-Map, Dante-Naming) | Reddit#15 | 🟡 Analysis Netzwerk/IPAM + **Doppel-IP-Check**, MAC editierbar; keine Switch-/VLAN-Topologie, kein Dante-Naming-Helper | mittel | Analysis/ |
| 16 | BOM / **Quoting/Procurement** | Reddit#16, CCAD#10 | 🟡 BOM ✅; Preise/Angebot ❌; Rentman = Miet-Seite | mittel | Export/ + neue Preis-Felder |
| 17 | KI-Generierung (Text → Rack+Signalfluss+BOM) | Reddit#17, X-DRAW | 🟡 AI-Port-Vorschläge + Smart-Routing-Fuzzy; volle Generierung ❌ | mittel–hoch | lib/aiSuggestions.ts |
| 18 | **Geteilte/Workgroup-/Cloud-Library** | **CCAD#1** (größte Lücke), H2R | 🟡 → gut machbar: Library-Persist + **`sync:*` (read/write/exists/lock auf shared-Ordner) existiert schon** | niedrig–mittel | libraryPersist.ts + syncIpc.ts |
| 19 | **Live-„Plan-Check"-Palette** | CCAD (stark) | 🟡 Heuristiken da (Doppel-IP, RF-Konflikt, **Redundanz/Single-Power**); keine vereinte Status-Palette inkl. Connector-Kompatibilität/offene Ports/Doppel-Labels | mittel | Analysis/ + neue lib/drawingChecks.ts |
| 20 | Panels/Patchfelder rasten in 3D-Rack ein | CCAD#3 | 🟡 Rack-Builder vorhanden; Panel-Snap-in offen | mittel | Rack/ |
| 21 | Multicore/Fiber-Breakouts (beidseitig, Strands) | CCAD#5,#6 | ❌/🟡 | mittel | types/cable.ts + Canvas |
| 22 | Batch-Edit von Patchfeld-/Jackfield-Defaults | CCAD#4 | 🟡 (generisches Multi-Select-UX) | niedrig–mittel | Properties/ |
| 23 | **Device-URL → Datenblatt-Feld** | CCAD#8 | ❌ | **niedrig (trivial)** | types/equipment.ts + Properties/sections + Reports |
| 24 | Vektor-Grafik-Import (SVG) | CCAD#11 | ❌ (GraphML-Import ja; SVG nein) | niedrig–mittel | Import/ |
| 25 | Connector-Gender/-Richtung | CCAD#13 | 🟡 | niedrig | types/cable.ts |
| 26 | **Packlist / Pull-Liste pro Case/Location** | H2R | 🟡 BOM nah dran; keine Case/Location-Pull-Liste | niedrig–mittel | Export/ |
| 27 | Maßstäbliche Kabelweg-/Conduit-Längen | CCAD (stark) | 🟡 Längen-Feld + Waypoints + A*-Routing am Canvas; keine maßstäbliche Gebäude-Länge/Conduit | mittel–hoch | lib/cableRouting.ts |
| 28 | As-Built-Doku (Soll/Ist) | Reddit, CCAD | ❌ | mittel–hoch | neuer Slice + mode-Erweiterung |
| 29 | Read-only-Share-Links (Kunde/Freelancer) | H2R | 🟡 Viewer-Mode + viewerSession-Hash + export-viewer da; Web-Viewer (#143) geplant | niedrig–mittel | projectIpc export-viewer, arch.md §9.6 |

---

## Teil C — Priorisierte Einbau-Empfehlungen

### ✓ Umgesetzt (Branch `claude/clever-pasteur-L3JNC`, 2026-05)
- **#3 Auto-Kabelnummerierung mit Schema** — `c78eeaf` (Metadaten-Schema, Renumber-Action + Auto-Vergabe beim Anlegen, Anzeige auf Canvas + Patchliste)
- **#4 Cable-Schedule-CSV** — `e9855ad` (Kabelnummer + Layer als Spalten in Patchlisten-CSV/XLSX)
- **#5/#12 QR auf Etiketten-Bogen** — `5e807f5` (QR pro Kabel, kodiert Nummer + Strecke)
- **#23 Datenblatt-Link im Report** — `b6d1bb9` (klickbare Zeile im Geräte-PDF; das Feld gab es schon, fehlte nur im Export)

### Quick Wins (verbleibend)
- **#5 Label-Printer-CSV** — herstellerspezifisches Spaltenformat (Brother P-touch / Dymo / Brady) aus den vorhandenen Etiketten-Daten
- **#25 Connector-Gender-Flag** an den Connector-Typen

### Mittelfristig (hoher Differenzierungswert)
- **#19 Vereinte „Plan-Check"-Palette** — bündelt die schon vorhandenen Heuristiken (Doppel-IP, RF-Konflikt, Redundanz) + neue Checks (inkompatible Connectoren, offene/unverbundene Ports, doppelte Labels/Nummern, fehlende Längen) zu einem Live-Status-Panel à la „ConnectCAD Status". Hoher Nutzen, nutzt vorhandene Bausteine.
- **#18 Workgroup-/Shared-Library** über die **bereits existierenden `sync:*`-Primitive** (read/write/lock auf shared-Ordner) — schließt ConnectCADs größte Lücke mit überschaubarem Aufwand.
- **#13/#28 Revisions-/Snapshot-Verwaltung** — benannte Projekt-Stände + Revision-Clouds (über Annotations) adressieren Revision- *und* As-Built-Wünsche.
- **#7 PDU/Airflow im Rack**, **#26 Packlist pro Case/Location** — beides erweitert vorhandene Power-Calc bzw. BOM.
- **#9 Stage-Plot/Eingangslisten-Generator** (Live-Audio) und **#15 AV-over-IP-Topologie + Dante-Naming-Helper**.

### Strategisch / groß
- **#10 Echtzeit-Kollaboration (Yjs)** — der **größte strukturelle Wunsch über *alle* Quellen** (Reddit, H2Rs USP, ConnectCADs #2). Architektur ist mit dem Slice-Pattern (#308) vorbereitet; Pfad in arch.md §9.4.
- **#11 Mobile-Editor** statt nur Read-View
- **#17 KI-Plan-Generierung** (Text → Rack + Signalfluss + BOM) — baut auf aiSuggestions.ts auf
- **#27 Maßstäbliche Kabelweg-/Conduit-Längen**; **#16 Quoting/Pricing-Layer**; **#24 Vektor-(SVG)-Import**

---

## Teil D — Wo Cable-Planner bereits führt

Vieles, was die Community bei den teuren Tools vermisst, **kann Cable-Planner
schon** — das ist die Positionierung:

- **Offenes JSON-Format, kostenlos, Win/macOS/Linux** — gegen durchweg teure,
  meist Windows-only, proprietäre Konkurrenz
- **ATEM/Videohub-Live-Control** direkt aus der Plan-App — kann *kein* Konkurrent
- **3D-Racks + STL-Export** — selten in AV-Tools
- **Power (Phasen/EU-Farbcode/Unwucht) + Wärme + Gewicht** eingebaut — X-DRAW
  vermarktet genau das als Premium-Feature
- **RF-/Funk-Analyse** + **Sync-/Referenzsignal-Typen** (Blackburst/Tri-Level/
  Word-Clock/PTP)
- **Diagram-first Single-Source-of-Truth** — exakt der Workflow, den die
  Community fordert (#8)
- **Mobile-Share-Feldansicht** (read/check) — erfüllt den „Plan auf der
  Baustelle"-Wunsch (#11) bereits teilweise
- **Undo mit Transactions + Coalesce** — UX-Niveau über WireCAD/Visio

---

## Teil E — Konkrete GitHub-Issue-Vorschläge

Fertig formulierte Issues für die noch offenen Opportunities. Aufwand grob:
S = < 1 Tag, M = 2–5 Tage, L = Woche+/strukturell. Andockpunkt = Datei(en)
laut [`architecture.md`](architecture.md).

### E1 · `feat(patchlist): Etiketten-Export im Label-Printer-Format (CSV)` — S
- **Problem / Quelle:** Community Nr. 5 — Etiketten sollen an Brady/Dymo/Brother
  (P-touch / Cable Label Tool) gehen; gewünscht ist serialisierter CSV-Import.
  Cable-Planner hat den PDF-Bogen (+ QR), aber kein Drucker-CSV.
- **Lösung:** Zweiter Export-Knopf „Etiketten-CSV" neben „Etiketten + QR".
  Spaltenschema wählbar (Brother P-touch / Dymo / generisch): je Kabel zwei
  Zeilen (beide Enden) mit Nummer, Quell-/Ziel-Text, Typ, Länge, Farbe.
- **Akzeptanz:** CSV öffnet in P-touch Editor / Dymo Connect; Umlaute via
  `sanitizeForPdf`-Pendant ASCII-sicher; nutzt aktuelle Filter.
- **Andockpunkt:** `components/Patch/PatchListDialog.tsx` (neben `exportLabels`),
  `lib/exportFilename.ts`, i18n.
- **Labels:** `enhancement`, `export`, `patchlist`.

### E2 · `feat(ports): Connector-Gender (male/female) pro Port` — S
- **Problem / Quelle:** ConnectCAD-Wunsch #13 (Connector-Gender/-Richtung);
  Patchfeld-/Kabel-Konfektion braucht m/f-Info.
- **Lösung:** `Port.gender?: 'male' | 'female'` (+ optional am Kabelende).
  Anzeige als kleines ♂/♀ am Port-Handle; in Patchliste/CSV/Etikett.
- **Akzeptanz:** optional, heilt zu undefined; sichtbar in Properties +
  Patchliste; kein Bruch alter Projekte.
- **Andockpunkt:** `types/equipment.ts` (Port), `Properties/sections/PortList.tsx`,
  `Canvas/EquipmentNode.tsx`, Patch-Export.
- **Labels:** `enhancement`, `domain-model`.

### E3 · `feat(analysis): vereinte „Plan-Check"-Palette` — M
- **Problem / Quelle:** ConnectCAD-Stärke „Status"-Palette; Community-Pain
  „undokumentiert/fehlerträchtig". Cable-Planner hat Heuristiken verstreut
  (Doppel-IP, RF-Konflikt, Redundanz), aber kein Live-Gesamt-Status.
- **Lösung:** `lib/drawingChecks.ts` sammelt Findings (Severity error/warn/info):
  offene/unverbundene Ports, inkompatible Connector-Paare, doppelte
  Labels/Kabelnummern, fehlende Längen, Doppel-IP, RF-Konflikt, Single-Power.
  Panel mit Klick → Element selektieren/zentrieren; Badge in der StatusBar.
- **Akzeptanz:** Findings live aus dem Store; Klick selektiert; vorhandene
  Analysen werden wiederverwendet, nicht dupliziert.
- **Andockpunkt:** neu `lib/drawingChecks.ts`, `components/Analysis/`,
  StatusBar; Selektion über `setSelection`.
- **Labels:** `enhancement`, `analysis`, `differentiator`.

### E4 · `feat(library): Workgroup-/Shared-Library über sync-Ordner` — M
- **Problem / Quelle:** ConnectCADs **größte** Lücke (#1): Teams wollen geteilte
  Geräte-/Gruppen-Library statt manuellem Kopieren; H2R löst das per Cloud.
- **Lösung:** Library optional auf einen gemeinsamen Ordner (Dropbox/SMB)
  spiegeln — nutzt die vorhandenen `sync:*`-IPC (read/write/exists/lock).
  Beim Start mergen (merge-by-name, vorhandener `TemplateMergeDialog`),
  Konflikte über bestehende `librarySync`-Logik.
- **Akzeptanz:** Pfad in SyncTab konfigurierbar; zwei Instanzen sehen dieselben
  Templates; Lock verhindert Write-Races; lokale Edits werden nicht überschrieben.
- **Andockpunkt:** `store/libraryPersist.ts`, `lib/librarySync.ts`,
  `main/ipc/syncIpc.ts`, `Settings/tabs/SyncTab.tsx`, `Library/TemplateMergeDialog.tsx`.
- **Labels:** `enhancement`, `library`, `collaboration`.

### E5 · `feat(project): Revisionen/Snapshots + As-Built-Markierung` — M
- **Problem / Quelle:** Community #13/#28 — Rev-Schema (A/B/C, As-Built 0/1/2),
  Revision-Clouds, eine autoritative Ausgabe; As-Builts driften sonst weg.
- **Lösung:** `project.revisions: { id, label, note, createdAt, snapshot }[]`;
  „Revision festschreiben" speichert Snapshot + Label; Diff/Restore;
  Revision-Clouds als Annotation-Typ; Rev-Stempel im PDF-Titelblock.
- **Akzeptanz:** Snapshot wiederherstellbar; Heal-kompatibel; Rev erscheint im Export.
- **Andockpunkt:** `types/project.ts`, neuer Slice `store/slices/revisionSlice.ts`,
  `healProjectPositions`, `Annotations/`, PDF-Titelblock.
- **Labels:** `enhancement`, `project`, `as-built`.

### E6 · `feat(rack): PDU-Platzierung + Airflow-/Wärme-Check im Rack` — M
- **Problem / Quelle:** Community #7 / X-DRAW vermarktet Auto-Power+Heat+PDU.
  Cable-Planner rechnet Last/Wärme schon, aber ohne PDU-Objekt/Airflow-Abstände.
- **Lösung:** Geräte-Flag `isPdu` + Outlet-Zahl; Rack-Check „Last je PDU",
  „HE-Lücken für Airflow", Wärme-Summe je Rack (BTU/h, vorhanden) im 3D/2D-Rack.
- **Akzeptanz:** Überlast/zu wenig Airflow wird im Rack markiert; nutzt
  vorhandene `powerWatts`/Wärme-Berechnung.
- **Andockpunkt:** `components/Rack/`, `components/Calculators/`, `types/equipment.ts`.
- **Labels:** `enhancement`, `rack`, `power`.

### E7 · `feat(export): Packlist / Pull-Liste je Case & Location` — S/M
- **Problem / Quelle:** H2R-Feature „Packlist"; Feld-Workflow „im Shop packen".
  Cable-Planner hat BOM, aber keine Case-/Location-gruppierte Pull-Liste.
- **Lösung:** Gruppierte Geräte-/Kabel-Liste je Location bzw. `rackInstance`,
  mit Pack-Status (`packed` existiert) als PDF/CSV.
- **Akzeptanz:** eine Seite je Location/Case; Pack-Haken sichtbar; nutzt BOM-Logik.
- **Andokpunkt:** `components/Export/`, `lib/itemExport.ts`, `LocationBomDialog.tsx`.
- **Labels:** `enhancement`, `export`.

### E8 · `feat(patch): Stage-Plot- & Eingangslisten-Generator (Live-Audio)` — M
- **Problem / Quelle:** Community #9 — Eingangsliste + Patch-Sheet + Stage-Plot
  sind die Kern-Artefakte im Live-Sound (ProSoundWeb/Gearspace).
- **Lösung:** Aus Audio-Layer-Kabeln eine Eingangsliste (Kanal, Quelle, Mikro/DI,
  Stand, Phantom) ableiten; einfacher Bühnenplan mit Positions-Markern.
- **Akzeptanz:** Eingangsliste als PDF/CSV; Bühnenplan exportierbar.
- **Andockpunkt:** neu unter `components/Patch/` bzw. `Export/`; Audio-Layer-Filter vorhanden.
- **Labels:** `enhancement`, `audio`, `patchlist`.

### E9 · `feat(analysis): AV-over-IP-Topologie + Dante-Naming-Helper` — M
- **Problem / Quelle:** Community #15 — VLAN/Switch-Maps für Dante/NDI/ST2110,
  Dante-Naming (≤31 Zeichen, DNS-safe, `channel@device`).
- **Lösung:** Switch-/VLAN-Topologie-View (VLANs liegen schon am Gerät);
  Dante-Naming-Validator + Auto-Vorschläge.
- **Akzeptanz:** Topologie zeigt VLAN-Zugehörigkeit; Namensregeln werden geprüft.
- **Andockpunkt:** `components/Analysis/` (Netzwerk-Tab erweitern), `types/equipment.ts` (`vlans`).
- **Labels:** `enhancement`, `network`, `analysis`.

### E10 · `feat(cables): Multicore/Fiber-Bündel + Breakouts` — M
- **Problem / Quelle:** ConnectCAD-Wünsche #5/#6 — Multicore/Fiber mit Breakouts,
  beidseitigen Steckern, Strands.
- **Lösung:** `Cable.multicoreId` gruppiert Adern; Breakout-/Squid-Darstellung;
  Strand-Anzahl + beidseitige Connector-Typen.
- **Akzeptanz:** Bündel als ein Kabel führbar, Adern einzeln adressierbar; BOM zählt korrekt.
- **Andockpunkt:** `types/cable.ts`, `Canvas/CableEdge.tsx`, BOM.
- **Labels:** `enhancement`, `domain-model`, `fiber`.

### E11 · `feat(export): Quoting-/Preis-Layer (BOM → Angebot)` — M
- **Problem / Quelle:** Community #16 / ConnectCAD #10 — Diagramm → Geräteliste →
  Angebot; ConnectCAD lagert das an Jetbuilt aus.
- **Lösung:** Optionales `priceEUR`/`rentalRate` am Gerät/Kabel-Spec; Angebots-PDF
  aus BOM (Mengen × Preis, Summen, optional Rentman-Katalogpreise).
- **Akzeptanz:** Angebots-PDF mit Positionen + Summe; Preise optional, kein Pflichtfeld.
- **Andockpunkt:** `types/equipment.ts`/`cableSpec.ts`, `components/Export/`, Rentman-Client.
- **Labels:** `enhancement`, `export`, `bom`.

### E12 · `feat(routing): maßstäbliche Kabelweg-/Conduit-Längen` — L
- **Problem / Quelle:** ConnectCAD-Stärke (Cable-Path + Auto-Länge + Conduit).
  Cable-Planner hat Längen-Feld + A*-Canvas-Routing, aber keine reale Bauweg-Länge.
- **Lösung:** Maßstab je Location (mm/px) + Kabelweg-Pfade; Längen daraus +
  Reserve; optional Conduit-Füllgrad.
- **Akzeptanz:** Länge aus maßstäblichem Pfad statt manuell; Reserve-Aufschlag konfigurierbar.
- **Andockpunkt:** `lib/cableRouting.ts`, `types/project.ts` (Maßstab), `types/location.ts`.
- **Labels:** `enhancement`, `routing`.

### E13 · `feat(sync): Echtzeit-Kollaboration (Yjs) im LAN` — L
- **Problem / Quelle:** **Größter** struktureller Wunsch über alle Quellen
  (Community #10, H2R-USP, ConnectCAD #2).
- **Lösung:** Projekt-Daten als `Y.Doc`; Slice-Updates als CRDT-Adapter
  (Slice-Architektur #308 ist die Vorbereitung); `y-webrtc`/`y-websocket`.
- **Akzeptanz:** zwei Instanzen editieren live denselben Plan; Undo bleibt nutzbar.
- **Andockpunkt:** `store/slices/*`, neuer `main/services/`-Sync, arch.md §9.4.
- **Labels:** `enhancement`, `collaboration`, `architecture`.

### E14 · `feat(ai): KI-Plan-Generierung aus Text-Prompt` — L
- **Problem / Quelle:** Community #17 / X-DRAW „XAVIA": Raum/System in Klartext →
  Rack + Signalfluss + BOM.
- **Lösung:** `lib/aiSuggestions.ts` erweitern (Provider sind schon angebunden):
  Prompt → Geräte + Verbindungen + Auto-Layout; Review vor dem Einfügen.
- **Akzeptanz:** Prompt erzeugt platzierbare Geräte + Kabel; nichts wird ohne
  Bestätigung geschrieben.
- **Andockpunkt:** `lib/aiSuggestions.ts`, neuer Generator-Dialog, `equipmentLayout.ts`.
- **Labels:** `enhancement`, `ai`.

### E15 · `feat(import): Vektor-Grafik-(SVG)-Import` — S/M
- **Problem / Quelle:** ConnectCAD-Wunsch #11 (nur Raster importierbar).
- **Lösung:** SVG als Annotation/Hintergrund importieren (GraphML-Import existiert
  als Muster).
- **Akzeptanz:** SVG erscheint als Layer/Annotation; skaliert sauber.
- **Andockpunkt:** `components/Import/`, `Annotations/`.
- **Labels:** `enhancement`, `import`.

---

## Quellen (Auswahl)

**H2R Gear:** h2rgear.com (+ /use-cases/*, /docs/*), heretorecord.gitbook.io
(patchlist/zones), changelog v1.22, heretorecord.com/blog, aaronparecki.com,
beyondtellerrand.com. (H2R Graphics: h2r.graphics)

**ConnectCAD:** app-help.vectorworks.net (VW2023–2026 Guides: Creating_circuits,
Creating_cable_networks, Calculating_cable_lengths, Cable_numbering_rules,
Creating_labels_for_printing, Creating_ConnectCAD_reports, Checking_the_drawing,
Concept_Power_schematics), vectorworks.net/connectcad (+ /newsroom 2024/2025/2026),
jetbuilt.com/press, forum.vectorworks.net (Threads #111315, #116835, #81684,
#70205, #93182, #110298, #71922, #111053, #102172, #79085, #123283, #92666,
#109642, #101705), xtenav.com (pricing/alternatives).

**Community:** proforums.harman.com/amx (AV Drawing Software), controlbooth.com
(Lightwright-vs-Excel-Cluster), gearspace.com (Snake-Fanouts/Patchbay/Stage-Plot),
forums.prosoundweb.com (Patch-Sheet/Stage-Plot), forum.vectorworks.net
(ConnectCAD-Board), forum.blackmagicdesign.com (Flypack), wirecad.com,
patchcad.com, getdante.com/blog (Naming), Capterra/G2/SourceForge/Slashdot
(Reviews), avixa.org + chroma.fm (Commissioning/As-Built).

**WireCAD:** wirecad.com (+ /help100 Licensing-FAQ, Change-Log v10, Rack-Builder,
Export-to-Visio, System Requirements, Assurance-Beispiel), av-iq.com,
gearspace.com + discussions.apple.com + codeweavers.com (Stabilität/Mac),
soft112.com (Rating), hackaday.com (WireViz als Open-Source-Alternative).

**XTEN-AV / X-DRAW / XAVIA:** xtenav.com (/x-draw, /xavia, /pricing — [VENDOR]),
knowledgebase.xtenav.com, Capterra + softwareadvice.com (unabhängige Reviews
4,7/5), waxlyrical.medium.com (XAVIA-Hands-on), commercialintegrator.com,
softwarefinder.com + saasworthy.com (Preis-Korroboration).

**D-Tools (SI + Cloud):** d-tools.com (/system-integrator*, /cloud*,
/integrated-product-library, /system-integrator-pricing, /cloud-pricing),
docs.d-tools.com, dt.canny.io + portal.productboard.com (Cloud-Roadmap),
Capterra/G2/SoftwareAdvice/SourceForge/Slashdot (Kritik), commercialintegrator.com
+ cepro.com (Solo-Plan, SI v23).

> Caveat: Mehrere Vendor-/Reddit-/Forum-Seiten blockten den direkten Abruf im
> Recherche-Umfeld; Zitate teils aus Such-Zusammenfassungen paraphrasiert. Für
> wörtliche Zitate die URLs im Browser öffnen.
