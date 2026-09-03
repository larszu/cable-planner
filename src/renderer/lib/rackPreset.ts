// ───────────────────────────────────────────────────────────────────────────
// Draft → GroupPreset: die Hinrichtung des Rack-Roundtrips.
//
// WARUM ES DAS GIBT. Diese Umwandlung stand ZWEIMAL von Hand im Code: einmal
// im Speichern-Pfad des RackBuilderDialog, einmal im Export-Menue daneben.
// Zwei Aufzaehlungen derselben Struktur laufen auseinander, und genau das war
// passiert — das Export-Menue schrieb:
//
//   - `cables: []`, also die KOMPLETTE interne Verkabelung des Racks nicht,
//     obwohl der Menuepunkt „Komplettes Rack inkl. STL + Fotos" verspricht
//     und das Format sie ausdruecklich traegt (itemExport.ts: „.cpgroup →
//     ein GroupPreset (inkl. interne Kabel)"),
//   - keine `internalCanvasPositions` (die selbst gesetzten Positionen der
//     Geraete in der internen 2D-Ansicht),
//   - kein `rack.rentmanId` und kein `rentmanId` je Geraet — die kamen mit
//     #335 dazu, aber nur im Speichern-Pfad. Die zweite Aufzaehlung wurde
//     nicht nachgezogen; niemand hatte einen Grund, dort zu suchen.
//
// Der Nutzer nahm sein Rack per USB-Stick mit und packte es am Zielrechner
// ohne eine einzige interne Verbindung wieder aus.
//
// ADR-005, Regel 1 und 4 in einem: der Verlust war vermeidbar (die Daten
// lagen im selben Dialog), und die Zusage stand ungeprueft daneben.
//
// Die Abhilfe ist nicht, die zweite Aufzaehlung zu ergaenzen — dann laufen
// beim naechsten Feld wieder beide auseinander. Sie ist, sie zu LOESCHEN und
// beide Wege durch diese eine Funktion zu schicken. Framework-frei, damit
// headless testbar; `rackBuilderModel.ts` fuehrt mit `draftFromPreset` die
// Gegenrichtung (ist allerdings verwaist, siehe dort).
// ───────────────────────────────────────────────────────────────────────────
import { v4 as uuidv4 } from 'uuid'
import type { GroupPreset } from '../types/equipment'
import type { RackPlacementDraft, InternalCableDraft } from '../components/Rack/rackBuilderTypes'

export interface RackPresetDraft {
  rackName: string
  totalUnits: number
  depthMm?: number
  /** #335 — Rentman-Kombi-Id des Racks selbst. */
  rentmanId?: string
  placements: RackPlacementDraft[]
  internalCables: InternalCableDraft[]
}

/** Zeilenhoehe eines Geraets auf dem Canvas — aus der Portzahl abgeleitet. */
const itemHeight = (placement: RackPlacementDraft): number =>
  80 + Math.max(placement.inputs.length, placement.outputs.length, 3) * 22

/**
 * Baut aus dem Draft das persistierbare `GroupPreset`.
 *
 * Sortiert nach `startUnit` — die Kabel referenzieren Geraete per INDEX in
 * `items`, also muss die Reihenfolge feststehen, bevor die Indizes vergeben
 * werden.
 */
export const presetFromDraft = (
  draft: RackPresetDraft,
  editingId?: string,
): GroupPreset => {
  const sorted = draft.placements.slice().sort((a, b) => a.startUnit - b.startUnit)

  const items: GroupPreset['items'] = sorted.map((placement) => ({
    name: placement.name,
    category: placement.category,
    inputs: placement.inputs,
    outputs: placement.outputs,
    isRackDevice: placement.isRackDevice,
    rackUnits: placement.rackUnits,
    frontPanelImageUrl: placement.frontPanelImageUrl,
    rearPanelImageUrl: placement.rearPanelImageUrl,
    frontPanelCrop: placement.frontPanelCrop,
    rearPanelCrop: placement.rearPanelCrop,
    // v7.9.73 / #170 — Engineering-Daten ans Item-Record durchreichen.
    depthMm: placement.depthMm,
    stlDataUri: placement.stlDataUri,
    // v7.9.75 / #170 — Patchblende-/Shelf-Marker persistieren.
    isPatchPanel: placement.isPatchPanel,
    isRackShelf: placement.isRackShelf,
    // #335 — Rentman-Id des Inhalts erhalten (nur wenn gesetzt).
    ...(placement.rentmanId ? { rentmanId: placement.rentmanId } : {}),
    width: 240,
    height: itemHeight(placement),
    offsetX: 0,
    offsetY: (placement.startUnit - 1) * 44,
  }))

  const placements = sorted.map((placement, index) => ({
    itemIndex: index,
    startUnit: placement.startUnit,
    heightUnits: placement.rackUnits,
    // v7.9.73 / #170 — mountSide nur persistieren wenn explizit gesetzt.
    ...(placement.mountSide ? { mountSide: placement.mountSide } : {}),
    // #521 — Shelf-Offsets persistieren wenn GESETZT (auch 0!). Ein
    // truthy-Check verwarf den gueltigen Wert 0 (linke Kante / Front).
    ...(placement.shelfOffsetX != null ? { shelfOffsetX: placement.shelfOffsetX } : {}),
    ...(placement.shelfOffsetZ != null ? { shelfOffsetZ: placement.shelfOffsetZ } : {}),
  }))

  // v7.8.5 — Interne Kabel referenzieren Geraete per Placement-Id; hier auf
  // die Indizes NACH der Sortierung abgebildet. Kabel an geloeschte Geraete
  // fallen raus — sie haetten keinen Endpunkt mehr.
  const idToIndex = new Map<string, number>()
  sorted.forEach((p, idx) => idToIndex.set(p.id, idx))
  const cables: GroupPreset['cables'] = []
  for (const c of draft.internalCables) {
    const fromIdx = idToIndex.get(c.fromPlacementId)
    const toIdx = idToIndex.get(c.toPlacementId)
    if (fromIdx == null || toIdx == null) continue
    const entry: GroupPreset['cables'][number] = {
      fromItemIndex: fromIdx,
      fromPortName: c.fromPortName,
      toItemIndex: toIdx,
      toPortName: c.toPortName,
      name: c.name,
      type: c.type,
      length: c.length,
    }
    if (c.color != null) entry.color = c.color
    if (c.standard != null) entry.standard = c.standard
    // v7.9.115 / #223 — User-Waypoints erhalten, sonst springen die Kabel
    // beim naechsten Oeffnen auf die berechnete Bahn zurueck.
    if (c.waypoints && c.waypoints.length > 0) {
      entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
    }
    cables.push(entry)
  }

  // v7.9.14 — Nur Geraete mit selbst gesetzter Position; die uebrigen sollen
  // beim Oeffnen wieder aus `startUnit` abgeleitet werden.
  const internalCanvasPositions: Record<number, { x: number; y: number }> = {}
  sorted.forEach((placement, index) => {
    if (placement.canvasX != null && placement.canvasY != null) {
      internalCanvasPositions[index] = { x: placement.canvasX, y: placement.canvasY }
    }
  })
  const hasPositions = Object.keys(internalCanvasPositions).length > 0

  return {
    id: editingId ?? uuidv4(),
    name: draft.rackName.trim() || 'rack',
    rack: {
      totalUnits: draft.totalUnits,
      // #335 — Kombi-Id des Racks erhalten (nur wenn aus Rentman-Import).
      ...(draft.rentmanId ? { rentmanId: draft.rentmanId } : {}),
      // v7.9.73 / #170 — Rack-Tiefe nur persistieren wenn vom User gesetzt.
      ...(draft.depthMm ? { depthMm: draft.depthMm } : {}),
      placements,
      ...(hasPositions ? { internalCanvasPositions } : {}),
    },
    items,
    cables,
  }
}
