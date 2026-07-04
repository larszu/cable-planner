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

**Offen** (nächste Schritte): `guessVideohubPresetKey` über eine explizite
Preset-Referenz am Katalog-Eintrag statt Port-Zählung; GUID-Identität für
Light-Planner-Fixtures (dort via GDTF `FixtureTypeID` direkt); User-eigene
Templates optional mit selbst geminteter GUID.
