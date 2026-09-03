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
import type { EquipmentItem, GroupPreset } from '../types/equipment'
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

// ───────────────────────────────────────────────────────────────────────────
// Die GEGENRICHTUNG: Equipment → GroupPreset.
//
// `presetFromDraft` oben ist die Hinrichtung. Es gibt aber zwei Wege, auf
// denen ein Rack-Preset NICHT aus einem Draft entsteht, sondern aus Geraeten,
// die schon im Plan liegen — beide standen als eigene Aufzaehlung im
// LibraryPanel, mitten in je einem `useEffect`:
//
//   1. „Rack Builder aus Auswahl" — der User markiert Geraete auf dem Canvas
//      und laesst daraus ein Rack bauen.
//   2. „Rack bearbeiten" auf einem platzierten Black-Box-Rack — der Inhalt
//      wird aus `rackInternalSnapshot` zurueckgebaut.
//
// ADR-005, Inkrement 4, Regel 1 — beide verloren, was sie nicht aufzaehlten,
// obwohl der Draft und `presetFromDraft` es tragen:
//
//   Weg 1 liess `depthMm`, `stlDataUri`, `isPatchPanel`, `isRackShelf` und
//   `rentmanId` liegen. Ein 800-mm-Geraet mit STL-Modell und Patchblenden-
//   Marker kam als tiefenloses Kaestchen ohne 3D-Geometrie im Rack an; die
//   3D-Ansicht kann dann nicht mehr pruefen, ob hinter dem Geraet noch etwas
//   passt (genau wofuer #170 die Felder eingefuehrt hat).
//
//   Weg 2 liess `rentmanId` liegen — sowohl die des Racks (Kombi-Id) als auch
//   die je Inhalt. Der Snapshot traegt sie ausdruecklich („#335 — Rentman-ID
//   des Inhalts mitschnappen (fuer spaeteren Sync/Export)"), und der Typ sagt
//   „Bleibt ueber Save/Reload erhalten". Genau der Save/Reload-Weg warf sie
//   weg: einmal „Rack bearbeiten" und speichern, und die Rentman-Herkunft des
//   ganzen Racks war aus dem Snapshot verschwunden.
//
// Warum hier und nicht dort: eine Aufzaehlung dieser Struktur an einer
// vierten Stelle im Code haette dasselbe Schicksal gehabt wie die dritte
// (#626). Hier stehen sie neben der Hinrichtung — wer ein Feld ergaenzt,
// sieht beide Seiten auf einem Bildschirm.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Felder des `RackPlacementDraft`, die NICHT aus dem Geraet kommen koennen —
 * sie beschreiben die Lage IM Rack, nicht das Geraet.
 *
 * Der Test `rackPresetFromEquipment` prueft diese Liste gegen den echten
 * Interface-Rumpf: kommt ein Feld dazu, das ein Geraet mitbringen koennte,
 * faellt er. Bewusst als AUSSCHLUSS-Liste (Subtraktion) — ein neues Feld
 * reist damit im Zweifel MIT, statt still liegen zu bleiben.
 */
export const RACK_DRAFT_FIELDS_NOT_FROM_EQUIPMENT = [
  'id',            // frisch vergeben
  'templateName',  // Herkunfts-Name im Builder
  'startUnit',     // Lage im Rack
  'canvasX',       // Position in der internen 2D-Ansicht
  'canvasY',
  'mountSide',     // Front/Rear/Full — im Rack gesetzt, nicht am Geraet
  'shelfOffsetX',  // Shelf-Position im Rack
  'shelfOffsetZ',
] as const

/** Die Geraete-Felder, die ein Rack-Inhalt vom Equipment erbt. */
const itemFromEquipment = (eq: EquipmentItem): GroupPreset['items'][number] => ({
  name: eq.name,
  category: eq.category ?? 'Sonstiges',
  inputs: eq.inputs,
  outputs: eq.outputs,
  isRackDevice: eq.isRackDevice ?? !!eq.rackUnits,
  rackUnits: Math.max(1, eq.rackUnits ?? 1),
  frontPanelImageUrl: eq.frontPanelImageUrl,
  rearPanelImageUrl: eq.rearPanelImageUrl,
  frontPanelCrop: eq.frontPanelCrop,
  rearPanelCrop: eq.rearPanelCrop,
  // v7.9.73 / #170 — Engineering-/3D-Daten. Ohne sie rendert das Rack das
  // Geraet ohne Tiefe und ohne Geometrie.
  depthMm: eq.depthMm,
  stlDataUri: eq.stlDataUri,
  // v7.9.75 / #170 — Patchblende/Shelf sind Eigenschaften des Geraets.
  isPatchPanel: eq.isPatchPanel,
  isRackShelf: eq.isRackShelf,
  width: eq.width ?? 240,
  height: eq.height ?? 80,
  offsetX: 0,
  offsetY: 0,
  // #335 — Rentman-Id des Inhalts erhalten (nur wenn gesetzt).
  ...(eq.rentmanId ? { rentmanId: eq.rentmanId } : {}),
})

/**
 * „Rack Builder aus Auswahl": markierte Canvas-Geraete zu einem Rack-Preset
 * stapeln, von oben nach unten nach HE-Groesse.
 *
 * Interne Kabel bleiben ausdruecklich leer — der User verkabelt im Sub-Canvas.
 * Das ist eine Entscheidung, kein Verlust: die Kabel zwischen den markierten
 * Geraeten liegen weiter im Plan.
 */
export const presetFromEquipmentSelection = (
  items: EquipmentItem[],
  presetId: string,
  name: string,
): GroupPreset | null => {
  if (items.length === 0) return null
  let cursorUnit = 1
  const placements = items.map((eq, index) => {
    const heightUnits = Math.max(1, eq.rackUnits ?? 1)
    const placement = { itemIndex: index, startUnit: cursorUnit, heightUnits }
    cursorUnit += heightUnits
    return placement
  })
  return {
    id: presetId,
    name,
    rack: {
      totalUnits: Math.max(cursorUnit + 3, 12),
      placements,
    },
    items: items.map(itemFromEquipment),
    cables: [],
  }
}

/**
 * „Rack bearbeiten" auf einem platzierten Black-Box-Rack: den Inhalt aus
 * `rackInternalSnapshot` zurueckbauen, die Ports aus den aussen liegenden
 * Ports des Racks (via `rackOriginDeviceIndex`).
 */
export const presetFromBlackBoxRack = (
  eq: EquipmentItem,
  presetId: string,
  name: string,
): GroupPreset | null => {
  const snap = eq.rackInternalSnapshot
  if (!snap) return null

  const portsByItem = (ports: EquipmentItem['inputs']): Map<number, EquipmentItem['inputs']> => {
    const byItem = new Map<number, EquipmentItem['inputs']>()
    for (const p of ports) {
      if (typeof p.rackOriginDeviceIndex !== 'number') continue
      const list = byItem.get(p.rackOriginDeviceIndex) ?? []
      list.push({ ...p, name: p.rackOriginPortName ?? p.name })
      byItem.set(p.rackOriginDeviceIndex, list)
    }
    return byItem
  }
  const inputsByItem = portsByItem(eq.inputs)
  const outputsByItem = portsByItem(eq.outputs)

  return {
    id: presetId,
    name,
    rack: {
      totalUnits: snap.totalUnits,
      // #335 — die Kombi-Id des Racks. Das Equipment traegt sie (siehe
      // insertBlackBoxRack), der Rueckbau liess sie bisher liegen.
      ...(eq.rentmanId ? { rentmanId: eq.rentmanId } : {}),
      placements: snap.items.map((it, idx) => ({
        itemIndex: idx,
        startUnit: it.startUnit,
        heightUnits: it.rackUnits,
      })),
    },
    items: snap.items.map((it, idx) => ({
      name: it.name,
      category: 'Sonstiges',
      inputs: inputsByItem.get(idx) ?? [],
      outputs: outputsByItem.get(idx) ?? [],
      isRackDevice: true,
      rackUnits: it.rackUnits,
      width: 240,
      height: 80,
      offsetX: 0,
      offsetY: 0,
      // #335 — Rentman-Id je Inhalt. Der Snapshot traegt sie ausdruecklich
      // „fuer spaeteren Sync/Export"; ohne diese Zeile war sie nach dem
      // ersten Bearbeiten weg.
      ...(it.rentmanId ? { rentmanId: it.rentmanId } : {}),
    })),
    cables: snap.cables.map((c) => ({
      fromItemIndex: c.fromItemIndex,
      fromPortName: c.fromPortName,
      toItemIndex: c.toItemIndex,
      toPortName: c.toPortName,
      name: '',
      type: 'unbekannt',
      length: 0,
      color: c.color,
      standard: 'unbekannt',
    })),
  }
}
