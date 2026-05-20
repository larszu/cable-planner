# Offene Tests

Liste aller Code-Änderungen die der User noch live verifizieren muss.
Wenn ein Punkt bestätigt funktioniert → nach unten zu "Bestätigt
funktioniert" verschieben oder ganz raus.

---

## Aktuell offen

### v7.9.125 — Cable Connector Type Inheritance

Branch: `claude/cable-connector-type-inheritance-V5VZu`
(noch nicht in main gemergt)

**Symptom vorher**: Cable.type wurde nur bei der Cable-Creation
aus dem Start-Port abgeleitet und blieb dann eingefroren. Wenn der
User in den Geräte-Eigenschaften den Connector-Typ eines Ports
änderte (z.B. BNC → XLR) oder ein Kabel auf einen Port mit anderem
Connector umsteckte, hing der alte Typ am Kabel weiter.

**Fix**: 6 Trigger-Punkte + UI:

1. `updateEquipment` — Port-Connector via Properties geändert
2. `reconnectCable` — Cable per Drag auf anderen Port gezogen
3. `updateCable` — Endpoint via CableProperties-Dropdown gewechselt
4. `setActiveDeviceMode` — Device-Mode-Switch
5. `placeGroupPreset` — Preset platziert (fixt 'unbekannt' von
   Snapshot-Presets)
6. `addCableFromMobile` — Mobile-Add ohne Type-String

Plus:
- Settings → Editing → "Kabel-Typ folgt Port-Connector" (default an)
- CableProperties zeigt Amber-Chip bei Mismatch + "→ X"-Button zum
  einmaligen Übernehmen

**Test-Plan**:
1. `git checkout claude/cable-connector-type-inheritance-V5VZu`
2. `npm install && npm run dev` neu starten
3. **Trigger 1 (updateEquipment)**:
   - Gerät mit ≥1 Input platzieren, Kabel dran
   - Properties-Panel: Port-Connector von BNC auf XLR umstellen
   - **Erwartet**: Kabel-Typ in CableProperties zeigt "XLR"
4. **Trigger 2 (reconnectCable)**:
   - Zweites Gerät mit XLR-Port platzieren
   - BNC-Cable per Drag-Endpunkt auf den XLR-Port ziehen
   - **Erwartet**: Cable wechselt zu XLR
5. **Trigger 3 (updateCable)**:
   - Cable anklicken → Properties → "Zu Port"-Dropdown auf anderen
     Port wechseln
   - **Erwartet**: Typ wandert mit
6. **Trigger 4 (setActiveDeviceMode)** — UNSICHER:
   - Modulares Gerät mit Modes (z.B. Pixelhue/Brompton-Template aus
     der Library)
   - Mode-Picker: anderen Mode wählen wo ein Port denselben ID hat
     aber anderen ConnectorType
   - **Erwartet**: Kabel an diesem Port adoptiert neuen Typ
   - **Risiko**: hängt davon ab dass beim Mode-Switch Port-IDs
     stabil bleiben (Templates kopieren neue IDs in Z.864ff —
     wenn Mode-Snapshots fresh-IDs erzeugen, ist der Cable danach
     orphaned und nicht "anders verbunden". Hab das nicht live
     verifiziert.)
7. **Trigger 5 (placeGroupPreset)**:
   - Im Rack-Builder eine kleine Konfiguration speichern als Preset
   - Preset platzieren
   - **Erwartet**: Cables haben echte Typen, kein 'unbekannt'
   - **Risiko**: greift nur wenn das Preset SNAPSHOT-erzeugt war
     (Library-Panel-Path Z.786). Manuell gebaute Presets haben
     ggf. schon korrekte Typen → da ist der Fix unsichtbar
8. **Trigger 6 (Mobile-Add)** — UNSICHER:
   - Mobile-Viewer öffnen (QR-Code-Flow)
   - Cable hinzufügen ohne Type explizit zu wählen (falls Mobile-UI
     das überhaupt erlaubt — manche Versionen erzwingen Type)
   - **Erwartet**: Cable kommt mit echtem Typ aus Port-Connectors
   - **Risiko**: Mobile-UI sendet evtl. immer einen Type-String,
     dann wird der Fallback nie getriggert
9. **UI: Mismatch-Chip in CableProperties**:
   - Settings: Inheritance-Toggle ausschalten
   - Cable manuell auf 'Custom' setzen (über CableEdit)
   - Properties → Amber-Chip sollte erscheinen mit "→ BNC" (oder
     was die Ports tatsächlich sagen)
   - Klick → Typ wird übernommen, Chip verschwindet
10. **Safety: needsConverter-Cables**:
    - Cable zwischen BNC und HDMI-Port erzeugen (Dialog meldet
      Konverter nötig → bestätigen)
    - Properties: Cable hat `needsConverter: true`
    - Beide Port-Connectoren ändern: Cable-Typ bleibt unverändert
    - Mismatch-Chip erscheint NICHT (per Design)
11. **Toggle off**:
    - Settings → Toggle aus
    - Port-Connector ändern → Cable-Typ ändert sich NICHT mehr
    - Aber: Chip in Properties zeigt weiterhin den Vorschlag
      (per-Cable Override bleibt verfügbar)

**Mögliche Folge-Bugs**:
- Wenn ein Mode-Switch Port-IDs neu generiert: Cables werden
  orphaned statt umgetypt (Trigger 4)
- CableContextMenu mutiert nur name/color/etc., keine Endpoints
  → muss nichts tun; aber falls dort später Endpoint-Editing
  reinkommt: läuft automatisch durch updateCable-Inheritance
- Custom Cable-Specs aus `uiStore.customCableSpecs`: deren
  connectorType wird respektiert; sollte stabil sein

---

### v7.9.124 — ATEM-Source-IDs aus Live-State (Bug-2 + Bug-3)

Jetzt in main.

**Symptom vorher**:
- Bug-2: Input-Liste war "1 verschoben" — IDs kamen aus
  `equipment.inputs.idx+1`, was nicht der echten ATEM-Quellen-
  Hierarchie entspricht
- Bug-3: AUX-Outputs (Source-IDs 8001+) waren im Picker nicht
  wählbar, obwohl ATEM-Hardware sie als MV-Source unterstützt

**Fix**:
- MV-Config-Dialog liest beim Öffnen `cablePlannerApi.atem.getState()`
- Wenn ATEM verbunden: echte Source-Liste aus `state.inputs` (inkl.
  AUX/Color/MediaPlayer/PGM/PVW) wird verwendet, mit echten IDs + Labels
- SourcePicker gruppiert nach `portType` (Inputs / AUX / ME Outputs /
  Media Player / Generators / SuperSource / ...) wenn Live-Daten da sind
- Offline-Fallback: weiter `equipment.inputs.idx+1`, aber jetzt mit
  optionalem `Port.atemSourceId`-Override pro Port (Schema-Field
  vorhanden, UI-Input noch nicht — JSON-editierbar)
- `atem.onEvent`-Subscription refresht Live-Inputs wenn ATEM-State
  sich ändert (z.B. user benennt Inputs in anderem Dialog um)

**Test**:
1. `git pull && npm run dev` komplett neu starten
2. ATEM via AtemDialog verbinden
3. MV-Config-Dialog öffnen
4. Source-Picker an einem MV-Window öffnen (Klick auf Cell)
5. **Erwartet**:
   - Liste zeigt die ECHTEN ATEM-Source-Labels (z.B. wenn Input 1 am
     ATEM "Cam Main" heißt, steht das hier — nicht "Input 1")
   - Gruppen oben: "Inputs", weiter unten "AUX" (1, 2, 3, ...), "ME
     Outputs" (PGM/PVW), "Media Player", "Generators"
   - AUX 1 (= Source-ID 8001) wählbar → Apply → ATEM zeigt im MV-Fenster
     das AUX-Signal

---

### v7.9.123 — ATEM-MV-Window-Index-Mapping (Bug-1)

Jetzt in main.

**Symptom vorher**: 16-Kachel-Multiview wird am ATEM falsch (z.B.
4 Kacheln).
**Fix**: Mapping CP-Quadranten-Schema → ATEM-native Indexes vor
`setMultiViewerWindowSource()`.

**Test**:
1. `git pull && npm run dev` (komplett neu starten — Main-Prozess muss
   frisch laden)
2. ATEM Constellation verbinden via AtemDialog
3. MV-Config-Dialog öffnen
4. Alle 4 Quadranten auf "small" klicken (= 16 Kacheln)
5. Sources zuweisen (auch in den kleinen Cells, damit Window-Mapping
   greift)
6. "An ATEM übertragen" klicken

**Erwartet**:
- ATEM zeigt physisch alle 16 Kacheln
- Source-Zuweisung kommt am richtigen Slot an
- Im `[dev:electron]`-Log: `Applied MV config: N window assignments`
  (kein / wenig "übersprungen" wenn Layout passt)

**Mögliche Folge-Bugs** — UNSICHER:
- Source-IDs sind off (siehe Bug-2/3 in v7.9.124 → sollten gefixt
  sein, aber nur live verifizierbar)
- Layout-Code 16 wird vom Constellation-Modell nicht akzeptiert
  (kann nur User am Hardware-Status bestätigen — kein Code-Issue
  möglich)

---

### v7.9.120 / v7.9.121 / v7.9.122 — Rentman-Token & Body-Format

Jetzt in main.

**Symptom vorher**: Export → "Token hat keine Schreibrechte" → 403
mit "Invalid key=value pair in Authorization header"
**Stand**: Token-Sanitization aggressiver gemacht, IDs als Zahlen
gesendet. Token-Test-Probe in `credentials:test-token` macht jetzt
Read+Write-Probe.

**Test**:
1. `git pull && npm run dev` komplett neu starten
2. Token frisch in Settings → Rentman einfügen (löst beim Save
   Sanitization aus)
3. Settings → Rentman → "Token testen" klicken
4. Resultate möglich:
   - "...gültig für LESEN und SCHREIBEN" → alles OK, Export sollte
     gehen
   - "...gültig zum LESEN, aber Schreibrechte fehlen" → Rentman-
     Admin/Plan-Problem, keine Code-Sache
5. Falls 1. → einen Equipment-Add aus Katalog probieren

**Wenn POST weiter 403**: Server-Log-Hash + Body schicken — gibt
Rentman-Support ein Diagnose-Tool.

**Unsicher**: Ob das Token-Sanitization wirklich alle Edge-Cases
(Zero-Width-Spaces, Bidi-Marks, NBSP-Varianten) erwischt — die
Regex `[^!-~]` ist zwar streng, aber ohne ein "schmutziges" Token
zum Testen kann das nur der User mit echten Daten verifizieren.

---

### v7.9.115 / v7.9.118 — Rack-internes Routing

Jetzt in main.

**Symptom vorher** (Issue #223):
- A*-Routing-Modal "Kein Pfad gefunden"
- Kabel verlieren ihre Position bei Save/Reload
- Geräte und Kabel "durcheinander"

**Stand**:
- A*-Fallback statt Modal (v7.9.115)
- `groupPreset.cables[].waypoints` in Schema (v7.9.115)
- `obstaclePadCells: 0` in Rack-Mode (v7.9.118)
- Auto-A* nach Cable-Create im Rack (v7.9.118)

**Test**:
1. Rack mit ≥4 Geräten neu bauen
2. Mehrere Kabel ziehen die durch enge Korridore müssen
3. Save (Cancel-Dialog ok, dann Save), Rack neu öffnen
4. **Erwartet**: keine Modals, Kabel sind A*-geroutet, Positionen
   erhalten

---

## Noch nicht angefangen / unsicher ob nötig

### Wave C — Videohub Non-SDI-Filter + Fullscreen-Mode

**Status**: NICHT umgesetzt. Im vorigen Session-Verlauf als nächster
Schritt geplant, aber durch Branch-Wechsel auf
`cable-connector-type-inheritance` unterbrochen.

**Wenn gewünscht**:
- VideohubExportDialog: nur Ports mit `connectorType === 'BNC'` als
  Matrix-Slots zählen, Rest filtern (Issue: nicht-SDI-Ports tauchen
  fälschlich in der Matrix auf)
- Fullscreen-Toggle neben "Routing-Matrix"-Toggle — soll für ALLE
  Hub-Größen funktionieren (12 / 20 / 40 / 72 / 288), nicht nur 72/288

Sag Bescheid, ob das auf diesem Branch oder einem neuen weitergeht.

---

## Bestätigt funktioniert

— noch nichts in dieser Session
