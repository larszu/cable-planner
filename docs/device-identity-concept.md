# Geräte-Identität & der „Nichts erfinden"-Grundsatz

Status: Konzept + erster Implementierungsschritt (Kamera-Import).
Bezug: Suite-Fusion (cable-/multicam-/light-planner), `.avplan`-Austauschformat.

## 1. Das Problem: generische Fallbacks erfinden Fehler

Beim Import einer in MultiCam platzierten Kamera hat der Cable-Planner jedem
Modell ohne Datenblatt-Treffer einen **generischen „SDI Out"** angehängt. Das
ist der falsche Grundsatz: eine erfundene Belegung sieht im Plan genauso
autoritativ aus wie eine echte, wandert still in **BOM, Patchliste und
Verkabelung** und behauptet Fakten über Hardware, die wir gar nicht kennen.

- Eine Kamera könnte HDMI-only sein (FX3, C70, Pocket 4K/6K) → der erfundene
  BNC-Ausgang ist schlicht falsch.
- Sie könnte 2× 3G-SDI + TC-Out haben → der eine erfundene Port ist zu wenig.
- Der Stecker-Typ (BNC vs. HD-BNC vs. Micro-BNC), das Signal-Level (HD/3G/6G/
  12G), Gender, Genlock — alles geraten.

**Grundsatz:** Unbekanntes wird **explizit als unbekannt** geführt, nie geraten.
Lieber ein sichtbares „Ports aus Datenblatt ergänzen" als eine unsichtbare
Falschaussage. Das entspricht exakt dem MVR-Prinzip *„applications must not
alter data they don't understand"* — wir dehnen es aus auf *„applications must
not invent data they don't have"*.

## 2. Audit: wo wurde geraten? (safe vs. verboten)

| Ort | Was | Bewertung |
|---|---|---|
| `multicamCameraImport.ts` → `fallbackOut` | generischer „SDI Out"/BNC an jeder unbekannten Kamera | **verboten** — erfindet I/O → jetzt entfernt |
| `multicamCameraImport.ts` → `matchTemplate` (`.some()`) | ganzes Template bei **einem** Teilstring-Treffer („enthält sony") | **verboten** — falsches Modell → jetzt konservatives `matchCameraTemplate` (exakter Name, sonst Marke + **alle** Needles) |
| `deviceKind.ts` → `detectDeviceKind`/`detectNetworkDevice`/`guessVideohubPresetKey` | rät die Geräte-**Rolle**, um optionale UI (Export-Buttons, Config-Felder) einzublenden | **safe** — schreibt keine Port-/Spec-Daten ins Modell; nur UI-Affordanz, User handelt selbst |
| `venueExchange`-Defaults (Pose, Facing, Canvas-Position, Marker-Farbe) | geometrische/kosmetische Konventionen | **safe** — konventioneller Default, keine Hardware-Tatsache |

Die Trennlinie: **welche UI** man zeigt, darf man raten (reversibel, schreibt
nichts). **Fakten** (Ports, Stecker, Signal-Standard, DMX-Footprint, Gewicht,
Leistung), die in BOM/Patch/Verkabelung einfließen, dürfen **nicht** geraten
werden — sie sind explizit-unbekannt bis Datenblatt oder User sie liefert.

## 3. Implementierter erster Schritt

- `EquipmentItem.portsUnknown?: boolean` — expliziter Unbekannt-Marker.
- Kamera-Import: kein Match → `inputs: []`, `outputs: []`, `portsUnknown: true`
  statt erfundener Ports. Match → echte Datenblatt-Ports wie bisher.
- Plan-Check (`drawingChecks.ts`, Check 18): warnt pro `portsUnknown`-Gerät
  „Port-Belegung unbekannt — reale Anschlüsse aus dem Datenblatt ergänzen".
- Properties (`PortsSection`): Hinweis-Banner; sobald der User reale Ports
  ergänzt, entfernt sich der Marker selbst.
- Tests: `multicamCameraImport.test.ts`, `drawingChecksPortsUnknown.test.ts`.

## 4. DIN-Norm-Anker: GDTF / MVR

- **GDTF** = DIN SPEC 15800 (General Device Type Format).
- **MVR** = DIN SPEC 15801 (My Virtual Rig).

Übernommene Prinzipien:

1. **Identität über GUID, nicht über Namen** — *umgesetzt*. GDTF adressiert einen
   Gerätetyp über `FixtureTypeID` (GUID) + `RefFT`, nicht über den Modellnamen.
   Unser Namens-Substring-Matching war die Ursache des ganzen Fabrikations-
   Problems. Jetzt trägt jeder `CAMERA_CATALOG`-Eintrag eine stabile,
   versionsstabile `deviceTypeId` (GUID). Der Import (`matchTemplate`) löst in
   Vertrauens-Reihenfolge auf: **(1) GUID = autoritativ**, (2) exakter Name,
   (3) Marke + alle Needles, (4) sonst `portsUnknown`. Die **gleichen GUIDs**
   stehen in `multicam-planner/src/data/cameras.ts`; der MultiCam-Exporter gibt
   die `deviceTypeId` in die camera-list, sodass eine über App-Grenzen
   übergebene Kamera hier ohne Namensraten auf ihr echtes Datenblatt aufgelöst
   wird. Eine unbekannte GUID wird als Identität behalten (nicht verworfen),
   ohne Ports zu erfinden — Identität bekannt, Ports `portsUnknown`.
2. **Typ vs. Instanz trennen** (MVR). Der Typ (Modell, Ports, Datenblatt) ist
   die geteilte Quelle; die Instanz (Position, Patch, Seriennummer) ist
   projektspezifisch. Deckt sich mit unserer Template↔EquipmentItem-Trennung.
3. **Facettiertes Modell.** Ein physisches Gerät ist die Wirbelsäule; „Kamera",
   „Lampe", „Rack-Device" sind Facetten, verknüpft über eine gemeinsame ID.
   Das ist die Grundlage, damit dieselbe Kamera in allen drei Apps EIN Objekt
   bleibt statt drei lose Kopien.
4. **Unverstandene Daten unangetastet lassen** — bereits umgesetzt via
   `avForeign` (fremde `.avplan`-Domänen werden 1:1 durchgereicht).

## 5. Recherche: welche Eigenschaften Mitbewerber speichern

Abgeglichen mit WireCAD, D-Tools System Integrator, ConnectCAD, NetBox
Device-Type-Library und GDTF. **✓ vorhanden**, **+ sinnvoll ergänzen**,
**– bewusst außen vor**.

### Port-/Anschluss-Ebene
- ✓ Connector-Typ, Signal-Standard (`standard`), Gender (`gender`),
  Richtung (`direction`), SDI-Level (`sdiCaps`), Fiber-Klasse/-Stecker,
  Quad-/Dual-Link, Content-Label.
- + **Pin-/Belegung** (Pinout) pro Connector — WireCAD/ConnectCAD führen die
  Adernbelegung für Konfektion. Für uns optional pro Port.
- + **Port-Gruppe/Bank** (physische Blende/Karte) — bei modularen Geräten.

### Geräte-Ebene (Engineering)
- ✓ Gewicht, Leistung (W / V×A), Phase, HE (`rackUnits`), Tiefe/Breite/Höhe mm,
  Auflösung, Display-Größe, Front-/Rear-Panel-Bild, STL.
- + **Wärmelast (BTU/h)** — D-Tools/WireCAD führen sie für die Klima-/
  Rack-Planung; trivial aus Watt ableitbar, aber als Feld sinnvoll.
- + **Einschaltstrom / Absicherung (A)** — für die Stromverteilung.
- + **Hersteller + Modell als getrennte Felder** (aktuell nur `name`/
  `manufacturerUrl`) — erst das macht GUID-Katalog-Matching sauber.
- + **Datenblatt-/Manual-Referenz** (`manufacturerUrl` deckt Teil ab; ergänzen:
  lokale PDF-Referenz).

### Kaufmännisch / Asset (Festinstallation + Rental)
- ✓ Seriennummer, Asset-Tag, QR-ID, Eigentum (owned/rented/subhire),
  Miet-/Stückpreis, Kaufdatum, Lieferant, Lagerort, Install-Status, Garantie,
  Wartungsintervall, Service-Historie, Rentman-ID.
- + **Zustand/Grade** (A/B/C, defekt) — Rental-übliches Feld.
- – Abschreibungs-Buchhaltung: außerhalb des Scopes (ERP-Domäne).

### Fazit
Das Datenmodell ist bei den kaufmännischen und Engineering-Feldern bereits
konkurrenzfähig. Die echte Lücke war **nicht** ein fehlendes Feld, sondern die
**Identität**: solange Geräte über Namens-Substrings statt GUID gematcht wurden,
entstanden Fabrikations-Fehler.

**Umgesetzt:**
- Stabile `deviceTypeId` (GUID) auf **allen sechs** Katalogen (159 Einträge:
  Kameras, Blackmagic, GreenGo, Monitore, Ubiquiti, Misc); die `match*Template`-
  Funktionen stempeln die ID auf jedes gelieferte Template, Platzierung/Rentman-
  Match reichen sie automatisch auf das `EquipmentItem` durch.
- Kamera-GUIDs cross-App identisch mit dem MultiCam-Planner; autoritativer
  Import über die ID.
- `deviceTypeRegistry.ts`: zentrales GUID→(Template, Rolle)-Register.
  `detectDeviceKind`/`detectNetworkDevice` lösen **zuerst über die ID** auf —
  ATEM/Videohub-Rolle (Blackmagic-Katalog, per-Eintrag `kind`), Switch/Router
  (Ubiquiti-Katalog, per-Eintrag `networkKind`), GreenGo katalogweit. Eine
  bekannte ID ohne Spezial-Rolle liefert autoritativ „keine" (verhindert, dass
  die Struktur-Heuristik z. B. eine Kamera mit vielen BNCs zum Videohub erklärt).
  Namens-Heuristik bleibt nur Fallback für Geräte ohne ID.

- **Videohub-Export ohne Schätzung**: `guessVideohubPresetKey` (Port-Zähl-Raten)
  ist entfernt — es lieferte u. a. Keys, die es in `videohubPresets` gar nicht
  gab (`smart-40x40`, `universal-288x288`), worauf der Dialog still auf eine
  falsche 16x16-Matrix zurückfiel. Jetzt: expliziter `videohubPresetKey` am
  Katalog-Eintrag (Datenblatt-Fakt) → via ID aufgelöst; ohne ID wählt der
  Dialog `custom` mit den **echten** BNC-Port-Zahlen des Geräts (abgeleitet aus
  Projektdaten, nicht erfunden). Ein Test sichert ab, dass jeder Katalog-
  Videohub auf einen existierenden Preset-Key zeigt.
- Geprüft: `graphml/connectorInference.ts` ist KEIN Fabrikations-Fall — es
  übersetzt die eigenen Beschriftungen des Users ("SDI" → BNC), und der
  Nicht-Treffer-Fallback ist `Custom` mit niedriger Konfidenz (explizit
  unbekannt), kein erfundener Stecker.

- **Katalog-Ausbau Broadcast/AV-Netzwerk (2026-07)**: fünf neue Kataloge mit
  38 datenblatt-recherchierten Geräten (Quellen-URL je Eintrag im Code):
  `ajaCatalog` (KUMO-Router 3G+12G, FS-HDR, Ki Pro Ultra 12G, HELO Plus,
  U-TAP SDI), `rossCatalog` (Carbonite Black Plus/Ultra/Ultra 60, Graphite,
  Ultrix FR1/FR2/FR5, NK-3G72/16), `lynxCatalog` (yellobrik CDH/CHD/OTX/ORX/
  SPG/DVD, greenMachine callisto+), `switcherCatalog` (Panasonic AV-UHS500,
  For-A HVS-490, Roland V-8HD/V-60HD/V-160HD, Sony MCX-500, TriCaster 2 Elite),
  `avNetworkCatalog` (Netgear M4250, Luminex GigaCore 16Xt, BirdDog Flex 4K,
  Magewell Pro Convert; PoE-Budget als `categoryProps.poeBudgetW` → Plan-Check).
  Geräte mit nicht eindeutig belegbarer I/O wurden bewusst NICHT aufgenommen
  (z. B. TriCaster Mini 4K, greenMachine titan, Dante AVIO). Fremde Router
  (KUMO/Ultrix/NK) bekommen absichtlich KEINE `videohub`-Rolle — der Videohub-
  Export spricht das Blackmagic-Protokoll, das diese Geräte nicht verstehen.
- **Rentman-Fallback entschärft**: unbekannte Rentman-Geräte bekamen bisher
  erfundene Ports („Input 1"/„Output 1") — jetzt leere Ports + `portsUnknown`
  (PortsSection bietet den Port-Vorschlag-Flow, Plan-Check mahnt Datenblatt an).

- **Katalog-Runde 2 (2026-07)**: +9 Geräte. Neu `broadcastToolsCatalog`
  (Decimator DMON-6S/DMON-12S/MD-HX, Teradek Bolt 4K 750 TX/RX mit
  `Wireless/RF`-Link-Port, Riedel MediorNet MicroN mit 8× 10G-SFP+ und
  optischen MADI-Ports); `switcherCatalog` += Barco E2 Gen 2
  (Standardbestückung 12×HDMI/12×DP/4×SDI → 13×HDMI/1×DP/4×SDI, als modular
  markiert); `avNetworkCatalog` += Luminex GigaCore 10t + 26i. Kuratierte
  Match-Needles + GUIDs leben jetzt versionsstabil in den Recherche-JSONs
  (Regenerieren mintet nur für NEUE Einträge).

- **Katalog-Runde 3 (2026-07) — Audio-Domäne**: +22 Geräte in zwei neuen
  Katalogen. `audioCatalog` (15): Digitalpulte Behringer X32/Wing, Midas M32
  Live, A&H SQ-5/Avantis/dLive CDM32, Yamaha CL5/QL5/DM3-D, DiGiCo S21 +
  Stageboxen Behringer S16/S32, Midas DL32, Yamaha Rio3224-D2, A&H DX168 —
  AES50/Dante/SLink/DX-Links als bidirektionale RJ45-Ports modelliert.
  `wirelessAudioCatalog` (7, Kategorie „Funkstrecke"): Sennheiser EW IEM G4,
  EW 500 G4, EW-DX EM 2 Dante, Digital 6000 (EM 6000); Shure QLXD4, ULXD4Q,
  PSM 1000 (P10T) — Antennen als BNC-Ports, IEM-Sender mit Loop-Outs.
  Needle-Präzisionstest für die "m32"-Substring-Falle (Midas M32 ↔ dLive
  CDM32).

**Umgesetzt (2026-07):** Der Light-Planner-MVR-Export gibt jetzt pro
Fixture-*Typ* eine stabile, 1-basierte `<FixtureTypeId>` aus (Schlüssel = Library-`id`,
z. B. `etc-s4-26`), statt der alten konstanten `0`, die das ganze Rig auf einen
anonymen Typ zusammenfallen ließ. Instanzen desselben Typs teilen die Id,
verschiedene Typen unterscheiden sich — so falten grandMA3/Capture/Vectorworks
identische Fixtures korrekt zu einem Patch-Typ. Headless verifiziert per
`npm run mvr:check` (light-planner). Jede Fixture-Instanz trägt weiterhin ein
eindeutiges `uuid`.

**Offen** (nächste Schritte): echte GDTF-`FixtureTypeID`-GUIDs, sobald
Light-Planner GDTF-Profile einbettet (heute per Name relinked); User-eigene
Templates optional mit selbst geminteter GUID; Katalog-Nachzügler mit geklärter I/O (TriCaster Mini 4K,
greenMachine titan, AJA FS4/FS2, Analog Way Aquilon, Clear-Com FreeSpeak,
Riedel Bolero, Grass Valley, Datavideo, Antennen-Splitter Shure UA844+/
Sennheiser ASA 214, Shure AD4D/Axient).
