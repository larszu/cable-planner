import type { Cable } from './cable'
import type { EquipmentItem } from './equipment'
import type { GreenGoConfig } from './greengo'
import type { LocationFrame } from './location'
import type { VideoFormatId } from './videoFormat'

export interface ProjectMetadata {
  name: string
  description: string
  createdAt: string
  updatedAt: string
  /** Default SDI video format for the project (e.g. 1080p50). */
  defaultVideoFormat?: VideoFormatId
  /** Planner / author of the project file. */
  author?: string
  /** Client name (end customer). */
  client?: string
  /** Contractor / company executing the job. */
  contractor?: string
  /** Optional free-form project number / job code. */
  projectNumber?: string
  /** Company / contractor logo, stored as a data URI (PNG/JPEG) so it travels with the project. */
  companyLogo?: string
  /** Client / project logo, stored as a data URI. */
  clientLogo?: string
  /**
   * Planned cable quantities imported / manually tracked for Rentman.
   * Key format: `${type}|${length}` (e.g. "BNC|1" for SDI 1m cables).
   */
  rentmanCablePlan?: Record<string, number>
  /** Rentman project ID currently linked to this cable planner project. */
  rentmanProjectId?: string
  /** Human-readable name of the linked Rentman project. */
  rentmanProjectName?: string
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
  locations?: LocationFrame[]
  /** GreenGo intercom planning configuration (users, groups, system settings). */
  greengoConfig?: GreenGoConfig
}
