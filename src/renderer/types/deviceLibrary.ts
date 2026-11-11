import type {
  ConfirmInput,
  LibraryErrorCode,
  LibraryUser,
  ProposalCore,
  SyncDevice,
  SyncResult,
  UploadItem,
  UploadResult,
} from '../lib/deviceLibraryClient'
import type { EquipmentTemplate } from './equipment'

/** Fehlercodes des Clients plus die zwei, die erst der Planner kennt.
 *  `consent-missing`: es liegt keine Datenschutz-Zustimmung zum Hochladen
 *  vor (`lib/deviceLibraryConsent.ts`) — die Anfrage wird hier abgebrochen
 *  und nicht gesendet. */
export type DeviceLibraryErrorCode = LibraryErrorCode | 'invalid-url' | 'consent-missing'

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
  proposal?: number
  findings?: unknown[]
}

export interface DeviceLibraryApi {
  hasToken: () => Promise<boolean>
  signIn: (server: string, login: string, password: string) => Promise<DeviceLibrarySignIn>
  verifySecondFactor: (server: string, challenge: string, code: string) => Promise<DeviceLibrarySignIn>
  currentUser: (server: string) => Promise<DeviceLibraryResult<LibraryUser | null>>
  signOut: (server: string) => Promise<void>
  sync: (server: string, after: number) => Promise<DeviceLibraryResult<SyncResult>>
  /** Ohne `opts.slug` ein neues Geraet, mit Slug eine Aenderung an einem
   *  vorhandenen; `comment` ist dann Pflicht (mindestens drei Zeichen). */
  propose: (
    server: string,
    core: ProposalCore,
    facet: Record<string, unknown>,
    opts?: { slug?: string; comment?: string },
  ) => Promise<DeviceLibraryResult<DeviceLibraryProposalAck>>
  /** Bestaetigen gilt fuer die Version, nicht fuer das Geraet (`versionId`
   *  aus dem Abgleich). Nach einer Aenderung zaehlt neu. */
  confirm: (server: string, versionId: number, input: ConfirmInput) => Promise<DeviceLibraryResult<void>>
  unconfirm: (server: string, versionId: number) => Promise<DeviceLibraryResult<void>>
  /** Beanstanden ueberstimmt alle Bestaetigungen, bis es geklaert ist —
   *  deshalb mit Grund, mindestens zehn Zeichen. */
  dispute: (server: string, versionId: number, reason: string) => Promise<DeviceLibraryResult<void>>
  /** Eigene Vorlagen hochladen; der Client teilt in Stapel zu 100. */
  upload: (server: string, items: UploadItem[]) => Promise<DeviceLibraryResult<UploadResult[]>>
}

/** Ein Geraet aus der Bibliothek, wie es lokal liegt. */
export interface DeviceLibraryEntry {
  slug: string
  version: number
  /** Die Id genau dieser Version — die Adresse fuers Bestaetigen und
   *  Beanstanden. 0 bei einem Stand, der vor 11/2026 abgeglichen wurde oder
   *  von einem Server ohne dieses Feld kommt: dann kein Knopf, nur Anzeige. */
  versionId: number
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
  /** Der Server, von dem der Stand kommt. Jeder Server hat seinen eigenen
   *  Stand; ein Wechsel loescht den des anderen nicht (`saveCache`). */
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
