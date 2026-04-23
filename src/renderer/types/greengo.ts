/**
 * GreenGo intercom system planning data stored inside the cable-planner project.
 *
 * This mirrors the logical structure of a .gg5 configuration file:
 *  - Users  → stations / roles (Regie, Kamera 1, …)
 *  - Groups → communication channels / talk groups (CAM, PGM, …)
 */

export interface GreenGoUser {
  /** 1-based user slot number (1–12 for standard 12-user systems). */
  id: number
  name: string
  displayName?: string
  /** GreenGo color index (0 = default white). */
  color?: number
  /** IDs of groups this user can talk/listen to. */
  groupIds: number[]
  /** Cable-planner equipment ID of the assigned physical device (optional). */
  equipmentId?: string
}

export interface GreenGoGroup {
  /** 1-based group number (up to 9 in standard systems). */
  id: number
  name: string
  /** GreenGo color index (0 = default). */
  color?: number
}

export interface GreenGoConfig {
  systemName: string
  description?: string
  /** IP multicast address the system uses. Default: "239.1.160.1" */
  multicastAddress: string
  /** Audio sample rate in Hz. */
  sampleRate: 32000 | 48000
  users: GreenGoUser[]
  groups: GreenGoGroup[]
}

export const defaultGreenGoConfig = (): GreenGoConfig => ({
  systemName: 'Produktion',
  description: '',
  multicastAddress: '239.1.160.1',
  sampleRate: 32000,
  users: [],
  groups: [],
})
