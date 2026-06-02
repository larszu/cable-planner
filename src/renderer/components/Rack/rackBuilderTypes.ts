import type { EquipmentTemplate } from '../../types/equipment'

/** v7.8.5+ — Draft-Typen fuer den RackBuilderDialog. Aus der Hauptdatei
 *  ausgelagert (Issue #310), damit auch Sub-Komponenten
 *  (RackPlacementProperties, RackBuilderDialogExportMenu, …) ohne
 *  Zyklus-Import auf denselben Typen arbeiten koennen. */

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
  /** #335 — Rentman-ID dieses Geräts (wenn es aus einer Rentman-Kombination
   *  als Rack-Inhalt importiert wurde). Bleibt über Save/Reload erhalten und
   *  landet beim Platzieren auf dem EquipmentItem. */
  rentmanId?: string
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

export interface RackDraft {
  rackName: string
  totalUnits: number
  /** #335 — Rentman-Equipment-ID der Kombination, falls dieses Rack aus einer
   *  Rentman-Kombination importiert wurde. Round-trips über das GroupPreset
   *  (preset.rack.rentmanId). */
  rentmanId?: string
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

/** v7.9.82 / #170 — geteilt mit Rack3DView.tsx: 19″ standardisierte
 *  Mounting-Raum (innen zwischen den Rails). Wird fuer
 *  die Shelf-Device Horizontal-Positionierung in 2D gebraucht. */
export const RACK_MOUNT_WIDTH_MM = 450
