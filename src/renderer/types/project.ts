import type { Cable } from './cable'
import type { EquipmentItem } from './equipment'

export interface ProjectMetadata {
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface CanvasState {
  x: number
  y: number
  zoom: number
}

export interface CablePlannerProject {
  metadata: ProjectMetadata
  equipment: EquipmentItem[]
  cables: Cable[]
  canvasState: CanvasState
}
