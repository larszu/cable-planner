// Phase 5 — Datenmodell + reine Helfer des RackBuilderDialog, aus der
// 2.8k-Zeilen-Komponente ausgelagert (reines Refactoring, kein Verhaltens-
// oder Markup-Wechsel). Enthält die Draft-Typen, die 19″-Rack-Konstanten
// und die puren Transform-Funktionen (Template→Placement, Normalisierung,
// Preset↔Draft-Roundtrip). Alles framework-frei und damit isoliert testbar.

import { v4 as uuidv4 } from 'uuid'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import { STORAGE_KEYS } from '../../lib/storageKeys'
import { LIMITS } from '../../lib/layoutConstants'

export interface RackPlacementDraft {
  id: string
  templateName: string
  name: string
  category: string
  startUnit: number
  rackUnits: number
  inputs: EquipmentTemplate['inputs']
  outputs: EquipmentTemplate['outputs']
  isRackDevice: boolean
  /** v7.9.14 — Optionale Position des Geräts im RackInternalCanvas
   *  (eigenständige 2D-Ansicht der Internal-Verkabelung). Wird wie
   *  beim normalen Canvas frei vom User gesetzt und persistiert mit
   *  dem GroupPreset; Default-Position aus startUnit. */
  canvasX?: number
  canvasY?: number
  frontPanelImageUrl?: string
  rearPanelImageUrl?: string
  frontPanelCrop?: EquipmentTemplate['frontPanelCrop']
  rearPanelCrop?: EquipmentTemplate['rearPanelCrop']
  /** v7.9.73 / #170 — Tiefe in mm (lokaler Override, sonst Template-Default).
   *  Beim Rendering in der 3D-Ansicht greift erst dieser, dann template.depthMm,
   *  dann 400 mm Standard. */
  depthMm?: number
  /** v7.9.73 / #170 — Front-/Rear-/Full-Mount. Default 'full'. */
  mountSide?: 'front' | 'rear' | 'full'
  /** v7.9.73 / #170 — Optional STL als data:base64 für die 3D-Geometrie. */
  stlDataUri?: string
  /** v7.9.75 / #170 — Patchblende-Marker, vererbt vom Template. */
  isPatchPanel?: boolean
  /** v7.9.75 / #170 — Rack-Shelf-Marker. */
  isRackShelf?: boolean
  /** v7.9.82 / #170 — Shelf-Device horizontal-Offset (mm von links). */
  shelfOffsetX?: number
  /** v7.9.82 / #170 — Shelf-Device depth-Offset (mm von vorne). */
  shelfOffsetZ?: number
}

export interface RackDraft {
  rackName: string
  totalUnits: number
  viewMode: 'front' | 'rear' | 'both' | 'side'
  /** v7.9.73 / #170 — Rack-Tiefe in mm. Default 800 mm. */
  depthMm?: number
  placements: RackPlacementDraft[]
  /** v7.8.5 — internal wiring between rack devices. Authored in the
   *  RackInternalWireDialog and persisted into the GroupPreset on save.
   *  References placements by `id` (not array index) so re-ordering
   *  placements doesn't invalidate cables. The save step maps ids back
   *  to indices when building the preset. */
  internalCables: InternalCableDraft[]
}

export interface InternalCableDraft {
  fromPlacementId: string
  fromPortName: string
  toPlacementId: string
  toPortName: string
  name: string
  type: string
  length: number
  color?: string
  standard?: string
  /** v7.9.115 / Issue #223 — User-Waypoints persistieren ueber den
   *  Save-Round-Trip. Optional. */
  waypoints?: Array<{ x: number; y: number }>
}

// 19" rack standard: outer width 482.6 mm, 1U height 44.45 mm.
// width / height ratio per 1 HE = 482.6 / 44.45 ≈ 10.857 — used to derive
// rowHeight in pixels from the measured panel width so the on-screen rack is
// proportional to a real 19" rack, regardless of available screen space.
export const RACK_PANEL_ASPECT_PER_1HE = 10.857
// v7.9.82 / #170 — geteilt mit Rack3DView.tsx: 19″ standardisierte
// Außenbreite + Mounting-Raum (innen zwischen den Rails). Werden für
// die Shelf-Device Horizontal-Positionierung in 2D gebraucht.
export const RACK_OUTER_WIDTH_MM = 482.6
export const RACK_MOUNT_WIDTH_MM = 450
// v7.9.10 — MIN auf 6 px gesenkt damit bei kleinem Dialog + vielen HE
// (42 HE) der Rack noch in den sichtbaren Bereich passt. Wer Details
// sehen will dreht den Zoom hoch.
export const MIN_ROW_HEIGHT = 6
export const MAX_ROW_HEIGHT = 56
export const DEFAULT_ROW_HEIGHT = 22
export const DRAFT_KEY = STORAGE_KEYS.rackBuilderDraftV2

export const parseUnits = (template?: EquipmentTemplate): number => {
  const raw = template?.rackUnits
  if (!raw || Number.isNaN(raw)) return 1
  return Math.max(1, Math.round(raw))
}

// v7.9.13 — Port-IDs sanitisieren. Die Catalog-Templates (Blackmagic,
// Misc, Camera, …) emittieren ihre Ports mit `id: ''`. Wenn die Ports
// hier mit leerem ID in den RackPlacementDraft kopiert werden, sind die
// Internal-Cable-Refs (per Port-NAME) zwar stabil — aber bei Render-
// Wiederverwendung als ReactFlow-Nodes (z.B. im RackInternalCanvas)
// kollidieren die leeren IDs als React-Keys → "Ports gestapelt". Bonus:
// Old presets die schon mit leeren IDs in localStorage liegen, werden
// beim Laden ebenfalls über sanitizeTemplatePorts (s.u.) geheilt.
const sanitizeTemplatePorts = <T extends { id?: string }>(ports: T[]): T[] => {
  const seen = new Set<string>()
  return ports.map((p) => {
    let id = p.id ?? ''
    if (!id || seen.has(id)) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `port-${Math.random().toString(36).slice(2, 11)}`
    }
    seen.add(id)
    return { ...p, id }
  })
}

export const toPlacement = (template: EquipmentTemplate, startUnit: number): RackPlacementDraft => ({
  id: uuidv4(),
  templateName: template.name,
  name: template.name,
  category: template.category,
  startUnit,
  rackUnits: parseUnits(template),
  inputs: sanitizeTemplatePorts(template.inputs),
  outputs: sanitizeTemplatePorts(template.outputs),
  isRackDevice: template.isRackDevice ?? !!template.rackUnits,
  frontPanelImageUrl: template.frontPanelImageUrl,
  rearPanelImageUrl: template.rearPanelImageUrl,
  frontPanelCrop: template.frontPanelCrop,
  rearPanelCrop: template.rearPanelCrop,
  // v7.9.75 / #170 — Tiefe + STL aus dem Template (Patchblende kommt
  // bereits mit depthMm=50 aus dem Create-Dialog).
  depthMm: template.depthMm,
  stlDataUri: template.stlDataUri,
  isPatchPanel: template.isPatchPanel,
  isRackShelf: template.isRackShelf,
  // v7.9.82 / #170 — Shelf-Offsets initial 0 (= linke vordere Ecke der HE).
  shelfOffsetX: 0,
  shelfOffsetZ: 0,
})

export const normalizeDraft = (draft: RackDraft): RackDraft => {
  const normalizedPlacements = draft.placements.map((p) => ({
    ...p,
    startUnit: Math.max(1, Math.round(p.startUnit) || 1),
    rackUnits: Math.max(1, Math.round(p.rackUnits) || 1),
  }))
  // Drop internal cables that point at placements that no longer exist
  // (user removed a device after wiring it).
  const livePlacementIds = new Set(normalizedPlacements.map((p) => p.id))
  const normalizedCables = (draft.internalCables ?? []).filter(
    (c) => livePlacementIds.has(c.fromPlacementId) && livePlacementIds.has(c.toPlacementId),
  )
  return {
    ...draft,
    rackName: draft.rackName.trim() || 'Neues Rack',
    totalUnits: Math.max(1, Math.min(LIMITS.MAX_RACK_HEIGHT_HE, Math.round(draft.totalUnits) || 42)),
    placements: normalizedPlacements,
    internalCables: normalizedCables,
  }
}

export const formatRackUnits = (value: number): string => `${value} HE`

// Reverse of saveRack: rebuild a draft from a previously stored GroupPreset.
// Used when opening the dialog in edit mode so the user can refine an existing
// rack instead of starting empty.
export const draftFromPreset = (preset: GroupPreset): RackDraft => {
  const placementsByIndex = new Map<number, { startUnit: number; heightUnits: number }>()
  for (const placement of preset.rack?.placements ?? []) {
    placementsByIndex.set(placement.itemIndex, {
      startUnit: placement.startUnit,
      heightUnits: placement.heightUnits,
    })
  }
  // v7.9.14 — Hydrate Canvas-Positionen aus gespeichertem Preset.
  const savedPositions = preset.rack?.internalCanvasPositions ?? {}
  // v7.9.73 / #170 — mountSide aus preset.rack.placements[].mountSide hydraten
  const mountSideByIndex = new Map<number, 'front' | 'rear' | 'full' | undefined>()
  // v7.9.82 / #170 — Shelf-Offsets dito.
  const shelfOffsetByIndex = new Map<number, { x?: number; z?: number }>()
  for (const p of preset.rack?.placements ?? []) {
    if (p.mountSide) mountSideByIndex.set(p.itemIndex, p.mountSide)
    if (p.shelfOffsetX != null || p.shelfOffsetZ != null) {
      shelfOffsetByIndex.set(p.itemIndex, { x: p.shelfOffsetX, z: p.shelfOffsetZ })
    }
  }
  const placements: RackPlacementDraft[] = preset.items.map((item, index) => {
    const meta = placementsByIndex.get(index)
    const pos = savedPositions[index]
    return {
      id: uuidv4(),
      templateName: item.name,
      name: item.name,
      category: item.category,
      startUnit: meta?.startUnit ?? 1,
      rackUnits: meta?.heightUnits ?? Math.max(1, item.rackUnits ?? 1),
      inputs: item.inputs,
      outputs: item.outputs,
      isRackDevice: item.isRackDevice ?? !!item.rackUnits,
      canvasX: pos?.x,
      canvasY: pos?.y,
      frontPanelImageUrl: item.frontPanelImageUrl,
      rearPanelImageUrl: item.rearPanelImageUrl,
      frontPanelCrop: item.frontPanelCrop,
      rearPanelCrop: item.rearPanelCrop,
      // v7.9.73 / #170 — Engineering-/3D-Felder.
      depthMm: item.depthMm,
      mountSide: mountSideByIndex.get(index),
      stlDataUri: item.stlDataUri,
      isPatchPanel: item.isPatchPanel,
      isRackShelf: item.isRackShelf,
      shelfOffsetX: shelfOffsetByIndex.get(index)?.x,
      shelfOffsetZ: shelfOffsetByIndex.get(index)?.z,
    }
  })
  // Hydrate internal cables: cables in the stored preset reference items
  // by INDEX; the new placements have fresh ids, so we map index → id.
  const indexToPlacementId = new Map<number, string>()
  placements.forEach((p, idx) => indexToPlacementId.set(idx, p.id))
  const internalCables: InternalCableDraft[] = []
  for (const c of preset.cables ?? []) {
    const fromId = indexToPlacementId.get(c.fromItemIndex)
    const toId = indexToPlacementId.get(c.toItemIndex)
    if (!fromId || !toId) continue
    const entry: InternalCableDraft = {
      fromPlacementId: fromId,
      fromPortName: c.fromPortName,
      toPlacementId: toId,
      toPortName: c.toPortName,
      name: c.name,
      type: c.type,
      length: c.length,
    }
    if (c.color != null) entry.color = c.color
    if (c.standard != null) entry.standard = c.standard
    // v7.9.115 / Issue #223 — Waypoints aus dem Preset wieder herstellen.
    if (c.waypoints && c.waypoints.length > 0) {
      entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
    }
    internalCables.push(entry)
  }
  return {
    rackName: preset.name,
    totalUnits: preset.rack?.totalUnits ?? 42,
    depthMm: preset.rack?.depthMm,
    viewMode: 'front',
    placements,
    internalCables,
  }
}
