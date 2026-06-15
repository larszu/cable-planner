// #468 — Reine Rack-Draft-Helfer + Konstanten aus RackBuilderDialog
// ausgelagert (kein React/JSX). Verhaltensneutral: identischer Code.
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from '../../lib/storageKeys'
import { LIMITS } from '../../lib/layoutConstants'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import type { RackDraft, RackPlacementDraft, InternalCableDraft } from './rackBuilderTypes'

export const RACK_PANEL_ASPECT_PER_1HE = 10.857
// v7.9.82 / #170 — geteilt mit Rack3DView.tsx: 19″ standardisierte
// Außenbreite. RACK_MOUNT_WIDTH_MM kommt aus rackBuilderTypes (auch von
// Sub-Komponenten geteilt).
export const RACK_OUTER_WIDTH_MM = 482.6
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
export const sanitizeTemplatePorts = <T extends { id?: string }>(ports: T[]): T[] => {
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
    // #521(b) — startUnit darf fraktional sein (Off-Grid-/Zwischen-HE-Position).
    // Kein Math.round mehr: nur NaN/≤0-Guard + Untergrenze 1. Ganzzahlige Werte
    // bleiben damit unverändert (Round war für sie ein No-op → Backward-Compat).
    // Die Höhe (rackUnits) bleibt ganzzahlig; 2D- und 3D-Rendering nutzen bereits
    // lineare (startUnit-1)·rowHeight- bzw. ·HE_HEIGHT_MM-Mathe → fraktional ok.
    startUnit: Math.max(1, Number.isFinite(p.startUnit) && p.startUnit > 0 ? p.startUnit : 1),
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
      // #335 — Rentman-ID des Inhalts über Reload erhalten.
      rentmanId: item.rentmanId,
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
    // #335 — Kombi-ID des Racks über Reload erhalten.
    rentmanId: preset.rack?.rentmanId,
    viewMode: 'front',
    placements,
    internalCables,
  }
}
