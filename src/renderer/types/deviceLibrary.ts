import type {
  LibraryErrorCode,
  LibraryUser,
  ProposalCore,
  SyncDevice,
  SyncResponse,
} from '../lib/deviceLibraryClient'
import type { EquipmentTemplate } from './equipment'

/** Fehlercodes des Clients plus der eine, den erst der Planner kennt. */
export type DeviceLibraryErrorCode = LibraryErrorCode | 'invalid-url'

/**
 * Antwort ueber die Bruecke. Kein geworfener Fehler: ein `Error` verliert auf
 * dem IPC-Weg alles ausser der Nachricht, und die Oberflaeche braucht den Code.
 */
export type DeviceLibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: DeviceLibraryErrorCode; status?: number; message?: string }

/** Wie `SignInResult` des Clients, nur ohne Token — das bleibt beim Speicher. */
export type DeviceLibrarySignIn =
  | { kind: 'ok'; user: LibraryUser }
  | { kind: 'second-factor'; challenge: string }
  | { kind: 'error'; code: DeviceLibraryErrorCode; message?: string }

export interface DeviceLibraryProposalAck {
  slug: string
  state: string
  findings?: unknown[]
}

export interface DeviceLibraryApi {
  hasToken: () => Promise<boolean>
  signIn: (server: string, login: string, password: string) => Promise<DeviceLibrarySignIn>
  verifySecondFactor: (server: string, challenge: string, code: string) => Promise<DeviceLibrarySignIn>
  currentUser: (server: string) => Promise<DeviceLibraryResult<LibraryUser | null>>
  signOut: (server: string) => Promise<void>
  sync: (server: string, after: number) => Promise<DeviceLibraryResult<SyncResponse>>
  propose: (
    server: string,
    core: ProposalCore,
    facet: Record<string, unknown>,
  ) => Promise<DeviceLibraryResult<DeviceLibraryProposalAck>>
}

/** Ein Geraet aus der Bibliothek, wie es lokal liegt. */
export interface DeviceLibraryEntry {
  slug: string
  version: number
  seq: number
  status: SyncDevice['status']
  confirmations: number
  manufacturer: string
  model: string
  template: EquipmentTemplate
}

export interface DeviceLibraryCache {
  format: 'cable-planner-device-library-cache'
  version: 1
  /** Der Server, von dem der Stand kommt. Ein anderer Server heisst: neu anfangen. */
  server: string
  latestSeq: number
  syncedAt?: string
  entries: DeviceLibraryEntry[]
}

export interface DeviceLibrarySyncStats {
  added: number
  updated: number
  removed: number
  /** Eintraege, die die App-eigene Vorlagenpruefung nicht bestanden haben. */
  invalid: number
  invalidNames: string[]
  /** Der Server kannte weniger als wir: der Stand wurde komplett neu geholt. */
  reset: boolean
}
