import type { Cable } from './cable'
import type { EquipmentItem } from './equipment'
import type { GreenGoConfig } from './greengo'
import type { LocationFrame } from './location'
import type { VideoFormatId } from './videoFormat'

/**
 * Auto-Kabelnummerierung — Schema fuer automatisch vergebene Kabel-IDs.
 * Wandert mit dem Projekt (in `ProjectMetadata`), damit "Neu nummerieren"
 * reproduzierbar bleibt und ein erneutes Oeffnen die gleiche Logik nutzt.
 *
 * Format der erzeugten Nummer:
 *   - ohne `perLayer`: `{prefix}{separator}{NNN}`  (z.B. "C-001")
 *   - mit `perLayer`:  `{prefix}{layerCode}{separator}{NNN}` (z.B. "V-001")
 * Bei leerem `prefix` faellt der Separator vor der Zahl weg.
 */
export interface CableNumberingScheme {
  /** Master-Schalter. Wenn false, werden beim Anlegen keine Nummern
   *  automatisch vergeben (manuelles "Neu nummerieren" geht trotzdem). */
  enabled: boolean
  /** Festes Praefix vor der Nummer, z.B. "C" oder "CBL". Leer erlaubt. */
  prefix: string
  /** Eigener, bei `start` beginnender Zaehler je Top-Level-Layer
   *  (video/audio/control/network/power) plus Layer-Kuerzel im Code. */
  perLayer: boolean
  /** Trennzeichen zwischen Praefix/Layer und laufender Nummer. Default "-". */
  separator: string
  /** Nullstellen-Breite der laufenden Nummer (3 -> 001). Default 3. */
  padding: number
  /** Start-Nummer des Zaehlers. Default 1. */
  start: number
}

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
  /**
   * Mapping from cable bucket (`${type}|${length}`) to the Rentman equipment
   * id that represents this cable in the Rentman master catalogue. Filled
   * automatically when cable quantities are imported from a Rentman project,
   * and manually when a bucket is mapped via the Rentman cable export dialog.
   * Also remembers the last quantity that was pushed to Rentman so the export
   * can compute deltas.
   */
  rentmanCableMap?: Record<string, { rentmanEquipmentId: string; lastSyncedQty?: number }>
  /** Rentman project ID currently linked to this cable planner project. */
  rentmanProjectId?: string
  /** Human-readable name of the linked Rentman project. */
  rentmanProjectName?: string
  /** Auto-Kabelnummerierungs-Schema. Undefined = noch nie konfiguriert
   *  (Defaults siehe `DEFAULT_CABLE_NUMBERING` in `lib/cableNumbering`). */
  cableNumbering?: CableNumberingScheme
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
  /** v7.9.3 — Aufbau-Status: welche Ports / Kabel der Field-Tech bereits
   *  physikalisch gesteckt hat. Wird vom Mobile-Viewer (handy.html) via
   *  POST /checks zurückgespielt und im Haupt-Canvas als kleines Häkchen
   *  am Port angezeigt. Port-Key: `${deviceId}|${portId}`, Cable-Key:
   *  Cable-ID. Optional damit alte Projekte beim Laden nicht crashen. */
  checkState?: {
    ports: Record<string, boolean>
    cables: Record<string, boolean>
  }
  /** v7.9.3 — Lock-Status des Projekts:
   *   - 'editing' (Default): voll bearbeitbar
   *   - 'finalized': "Planung abgeschlossen", Canvas read-only,
   *     kann vom Planer wieder auf 'editing' zurückgesetzt werden
   *   - 'viewer': permanent read-only (entstanden durch Import einer
   *     .cpviewer-Datei); nur Annotations können hinzugefügt werden */
  mode?: 'editing' | 'finalized' | 'viewer'
  /** v7.9.3 — Anmerkungen von externen Reviewern (z.B. Freelancer beim
   *  Aufbau). Werden im Viewer-Modus erstellt und können vom Planer
   *  zurück ins Original gemerged werden. */
  annotations?: ProjectAnnotation[]
  /** v7.9.3 — Im Viewer-Modus gespeicherter Reviewer-Name. Wird beim
   *  Öffnen der .cpviewer-Datei einmalig abgefragt und ist Author für
   *  alle in dieser Session erstellten Anmerkungen. */
  viewerSession?: {
    author: string
    startedAt: string
  }
}

/** v7.9.3 — Anmerkung eines Reviewers an einem Canvas-Element. */
export interface ProjectAnnotation {
  id: string
  author: string
  createdAt: string
  text: string
  status: 'open' | 'built' | 'resolved'
  anchor:
    | { type: 'device'; deviceId: string }
    | { type: 'port'; deviceId: string; portId: string }
    | { type: 'cable'; cableId: string }
    | { type: 'free'; x: number; y: number }
}
