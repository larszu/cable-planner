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

### Quick Wins (niedriger Aufwand, sofortiger Nutzen)
- **#23 Device-Datenblatt-URL-Feld** — trivial, deckt einen konkreten ConnectCAD-Wunsch
- **#5 + #12 Barcode/QR auf Etiketten-Bogen** — `qrcode`-Dep ist schon da; QR/Barcode pro Etikett, QR linkt zu Spec/Mobile-View
- **#5 Label-Printer-CSV** (Brother P-touch / Dymo / Brady) aus den vorhandenen Etiketten-Daten
- **#4 Dedizierter Cable-Schedule-CSV** (from-Gerät/Port → to-Gerät/Port, Typ, Länge, Label) — baut auf Patchliste/Export auf
- **#25 Connector-Gender-Flag** an den Connector-Typen

### Mittelfristig (hoher Differenzierungswert)
- **#3 Auto-Kabelnummerierung mit Schema** — *die* Nr.-1-Community-Anforderung und ConnectCAD/WireCAD-Stärke, die Cable-Planner komplett fehlt. Regelbasiert (Präfix + Layer + laufende Nr.), kollisionsfrei, im Settings-Tab konfigurierbar.
- **#19 Vereinte „Plan-Check"-Palette** — bündelt die schon vorhandenen Heuristiken (Doppel-IP, RF-Konflikt, Redundanz) + neue Checks (inkompatible Connectoren, offene/unverbundene Ports, doppelte Labels, fehlende Längen) zu einem Live-Status-Panel à la „ConnectCAD Status". Hoher Nutzen, nutzt vorhandene Bausteine.
- **#18 Workgroup-/Shared-Library** über die **bereits existierenden `sync:*`-Primitive** (read/write/lock auf shared-Ordner) — schließt ConnectCADs größte Lücke mit überschaubarem Aufwand.
- **#13/#28 Revisions-/Snapshot-Verwaltung** — benannte Projekt-Stände + Revision-Clouds (über Annotations) adressieren Revision- *und* As-Built-Wünsche.
- **#7 PDU/Airflow im Rack**, **#26 Packlist pro Case/Location** — beides erweitert vorhandene Power-Calc bzw. BOM.

### Strategisch / groß
- **#10 Echtzeit-Kollaboration (Yjs)** — der **größte strukturelle Wunsch über *alle* Quellen** (Reddit, H2Rs USP, ConnectCADs #2). Architektur ist mit dem Slice-Pattern (#308) vorbereitet; Pfad in arch.md §9.4.
- **#11 Mobile-Editor** statt nur Read-View
- **#17 KI-Plan-Generierung** (Text → Rack + Signalfluss + BOM) — baut auf aiSuggestions.ts auf
- **#27 Maßstäbliche Kabelweg-/Conduit-Längen**

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

> Caveat: Mehrere Vendor-/Reddit-/Forum-Seiten blockten den direkten Abruf im
> Recherche-Umfeld; Zitate teils aus Such-Zusammenfassungen paraphrasiert. Für
> wörtliche Zitate die URLs im Browser öffnen.
