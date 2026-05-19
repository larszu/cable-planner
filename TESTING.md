# Offene Tests

Liste der Code-Änderungen die der User noch live verifizieren muss.
Wenn ein Punkt bestätigt funktioniert → hier raus, sonst hier dran bleiben.

## Aktuell offen

### v7.9.124 — ATEM-Source-IDs aus Live-State (Bug-2 + Bug-3)

**Symptom vorher**:
- Bug-2: Input-Liste war "1 verschoben" — IDs kamen aus `equipment.inputs.idx+1`,
  was nicht der echten ATEM-Quellen-Hierarchie entspricht
- Bug-3: AUX-Outputs (Source-IDs 8001+) waren im Picker nicht waehlbar,
  obwohl ATEM-Hardware sie als MV-Source unterstuetzt

**Fix**:
- MV-Config-Dialog liest beim Oeffnen `cablePlannerApi.atem.getState()`
- Wenn ATEM verbunden: echte Source-Liste aus `state.inputs` (inkl.
  AUX/Color/MediaPlayer/PGM/PVW) wird verwendet, mit echten IDs + Labels
- SourcePicker gruppiert nach `portType` (Inputs / AUX / ME Outputs /
  Media Player / Generators / SuperSource / ...) wenn Live-Daten da sind
- Offline-Fallback: weiter `equipment.inputs.idx+1`, aber jetzt mit
  optionalem `Port.atemSourceId`-Override pro Port (Schema-Field
  vorhanden, UI-Input noch nicht — JSON-editierbar)
- atem.onEvent-Subscription refresht Live-Inputs wenn ATEM-State sich
  aendert (z.B. user benennt Inputs in anderem Dialog um)

**Test**:
1. `git pull && npm run dev` komplett neu starten
2. ATEM via AtemDialog verbinden
3. MV-Config-Dialog oeffnen
4. Source-Picker an einem MV-Window oeffnen (Klick auf Cell)
5. **Erwartet**:
   - Liste zeigt die ECHTEN ATEM-Source-Labels (z.B. wenn Input 1 am
     ATEM "Cam Main" heisst, steht das hier — nicht "Input 1")
   - Gruppen oben: "Inputs", weiter unten "AUX" (1, 2, 3, ...), "ME
     Outputs" (PGM/PVW), "Media Player", "Generators"
   - AUX 1 (= Source-ID 8001) waehlbar → Apply → ATEM zeigt im MV-Fenster
     das AUX-Signal

### v7.9.123 — ATEM-MV-Window-Index-Mapping (Bug-1)

**Symptom vorher**: 16-Kachel-Multiview wird am ATEM falsch (z.B. 4 Kacheln).
**Fix**: Mapping CP-Quadranten-Schema → ATEM-native Indexes vor `setMultiViewerWindowSource()`.

**Test**:
1. `git pull && npm run dev` (komplett neu starten — Main-Prozess muss frisch laden)
2. ATEM Constellation verbinden via AtemDialog
3. MV-Config-Dialog öffnen
4. Alle 4 Quadranten auf "small" klicken (= 16 Kacheln)
5. Sources zuweisen (auch in den kleinen Cells, damit Window-Mapping greift)
6. "An ATEM übertragen" klicken

**Erwartet**:
- ATEM zeigt physisch alle 16 Kacheln
- Source-Zuweisung kommt am richtigen Slot an
- Im `[dev:electron]`-Log: `Applied MV config: N window assignments` (kein
  / wenig "uebersprungen" wenn Layout passt)

**Mögliche Folge-Bugs falls's nicht 100% passt**:
- Source-IDs sind off (siehe Bug-2/3 in Wave B)
- Layout-Code 16 wird vom Constellation nicht akzeptiert (kann nur User
  am Hardware-Status bestätigen)

### v7.9.120 / v7.9.121 / v7.9.122 — Rentman-Token & Body-Format

**Symptom vorher**: Export → "Token hat keine Schreibrechte" → 403 mit
"Invalid key=value pair in Authorization header"
**Stand**: Token-Sanitization aggressiver gemacht, IDs als Zahlen
gesendet. Token-Test-Probe in `credentials:test-token` macht jetzt
Read+Write-Probe.

**Test**:
1. `git pull && npm run dev` komplett neu starten
2. Token frisch in Settings → Rentman einfügen (löst beim Save
   Sanitization aus)
3. Settings → Rentman → "Token testen" klicken
4. Resultate möglich:
   - "...gueltig fuer LESEN und SCHREIBEN" → alles OK, Export sollte gehen
   - "...gueltig zum LESEN, aber Schreibrechte fehlen" → Rentman-Admin/
     Plan-Problem, keine Code-Sache
5. Falls 1. → einen Equipment-Add aus Katalog probieren

**Wenn POST weiter 403**: Server-Log-Hash + Body schicken — gibt Rentman-Support
ein Diagnose-Tool

### v7.9.115 / v7.9.118 — Rack-internes Routing

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
4. **Erwartet**: keine Modals, Kabel sind A*-geroutet, Positionen erhalten

## Bestätigt funktioniert

— noch nichts in dieser Session
