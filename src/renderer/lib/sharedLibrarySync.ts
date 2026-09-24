// #434 — Workgroup-/Shared-Library über einen gemeinsamen Sync-Ordner.
//
// Teams wollen EINE gemeinsame Geräte-/Gruppen-Bibliothek statt Templates
// manuell zwischen Arbeitsplätzen zu kopieren. Wir spiegeln die Library in
// eine einzelne JSON-Datei im konfigurierten Shared-Ordner (Dropbox / SMB /
// Netzlaufwerk) und mergen sie merge-by-name in beide Richtungen.
//
// Reuse statt neuem Server:
//   • `sync:*`-IPC-Primitive (readFile/writeFile/exists/acquireLock/
//     releaseLock) aus main/ipc/syncIpc.ts — über cablePlannerApi.sync.
//   • Shared-Pfad = settingsStore.sharedSyncPath (Einstellungen → Netzwerk-Sync).
//
// Non-destruktiv: Pull fügt nur FEHLENDE (nach Name) Items lokal hinzu —
// lokale Versionen werden NIE überschrieben. Push schreibt die Vereinigung
// (lokal gewinnt bei Namensgleichheit) zurück. Namens-Konflikte (gleicher
// Name, anderer Inhalt) werden gezählt + gemeldet, nie still überschrieben.

import { cablePlannerApi, hasDesktopBridge } from './bridge'
import { stripCredentials } from './credentialKeys'
import type { CredentialChoice } from './credentialChoiceDialog'
import { useSettingsStore } from '../store/settingsStore'
import { useProjectStore } from '../store/projectStore'
import { grabstein, useUiStore } from '../store/uiStore'
import { fehlendeStammdaten, vereinigteStammdaten } from './stammdaten'
import { ALL_CONNECTOR_TYPES } from '../types/equipment'
import { ALL_SIGNAL_STANDARDS } from '../types/cableSpec'
import { STANDARD_LAYERS } from './cableLayers'
import {
  SHARED_LIBRARY_FILE,
  joinSyncPath,
  diffByName,
  unionByName,
  type SharedLibraryFile,
} from './sharedLibraryMerge'

export { SHARED_LIBRARY_FILE } from './sharedLibraryMerge'

export interface LibrarySyncResult {
  ok: boolean
  /** Maschinenlesbarer Fehlercode bei ok=false. */
  error?: 'desktop-only' | 'no-path' | 'locked' | string
  lockedBy?: string
  pulledDevices: number
  pulledGroups: number
  pulledCategories: number
  pushedDevices: number
  pushedGroups: number
  conflicts: string[]
}

const empty = (error?: string, lockedBy?: string): LibrarySyncResult => ({
  ok: false,
  error,
  lockedBy,
  pulledDevices: 0,
  pulledGroups: 0,
  pulledCategories: 0,
  pushedDevices: 0,
  pushedGroups: 0,
  conflicts: [],
})

/**
 * Synchronisiert die lokale Library mit der geteilten Datei im Sync-Ordner:
 * Lock holen → geteilte Datei lesen → fehlende Items lokal ergänzen (Pull) →
 * Vereinigung zurückschreiben (Push) → Lock freigeben.
 */
export const syncSharedLibrary = async (
  /**
   * Design-Frage 5 — was mit Geraete-Zugangsdaten passiert, die in den
   * Vorlagen stehen. BEWUSST ein Pflicht-Parameter ohne Default: der alte
   * Zustand war „geht stillschweigend mit", und ein Default haette genau den
   * wiederhergestellt, sobald ein Aufrufer ihn weglaesst. Wer diese Funktion
   * ruft, muss die Frage beantwortet haben.
   */
  credentials: CredentialChoice,
): Promise<LibrarySyncResult> => {
  if (!hasDesktopBridge) return empty('desktop-only')
  const dir = useSettingsStore.getState().sharedSyncPath?.trim()
  if (!dir) return empty('no-path')
  const user = useSettingsStore.getState().sharedSyncUser?.trim() || 'unknown'
  const filePath = joinSyncPath(dir, SHARED_LIBRARY_FILE)
  const api = cablePlannerApi.sync

  const lock = await api.acquireLock(dir, user).catch(() => ({ ok: false } as { ok: boolean }))
  if (!lock.ok) return empty('locked', (lock as { lockedBy?: string }).lockedBy)

  try {
    const store = useProjectStore.getState()
    const localDevices = store.customLibrary
    const localGroups = store.groupPresets
    const localCats = store.knownCategories

    // Geteilte Datei lesen (falls vorhanden).
    let shared: Partial<SharedLibraryFile> = {}
    if (await api.exists(filePath)) {
      try {
        shared = JSON.parse(await api.readFile(filePath)) as SharedLibraryFile
      } catch {
        shared = {}
      }
    }
    const sDevices = Array.isArray(shared.devices) ? shared.devices : []
    const sGroups = Array.isArray(shared.groups) ? shared.groups : []
    const sCats = Array.isArray(shared.categories) ? shared.categories : []

    // ── Pull: nur fehlende Items lokal ergänzen (non-destruktiv) ──
    const dDiff = diffByName(localDevices, sDevices)
    const gDiff = diffByName(localGroups, sGroups)
    const newCats = sCats.filter((c) => !localCats.includes(c))
    if (dDiff.add.length) store.addCustomTemplates(dDiff.add)
    if (gDiff.add.length) store.setGroupPresets(unionByName(localGroups, gDiff.add))
    if (newCats.length) store.addKnownCategories(newCats)
    // #917 — eigene Steckertypen, Signalstandards und Ebenen: ebenfalls nur
    // ergaenzen. Sie liegen im uiStore und nicht im Projekt — sie sind
    // Wortschatz des Rechners, nicht Inhalt eines Plans.
    const ui = useUiStore.getState()
    const lokalStamm = {
      connectorTypes: ui.customConnectorTypes,
      signalStandards: ui.customSignalStandards,
      cableLayers: ui.customLayers,
    }
    const fehlend = fehlendeStammdaten(lokalStamm, shared, {
      connectorTypes: [...ALL_CONNECTOR_TYPES],
      signalStandards: [...ALL_SIGNAL_STANDARDS],
      cableLayers: [...STANDARD_LAYERS],
    })
    // Was hier jemand entfernt hat, kommt nicht still zurueck.
    const entfernt = new Set(ui.stammdatenEntfernt)
    fehlend.connectorTypes.filter((n) => !entfernt.has(grabstein('stecker', n))).forEach((n) => ui.addCustomConnectorType(n))
    fehlend.signalStandards.filter((n) => !entfernt.has(grabstein('standard', n))).forEach((n) => ui.addCustomSignalStandard(n))
    fehlend.cableLayers.filter((n) => !entfernt.has(grabstein('ebene', n))).forEach((n) => ui.addCustomLayer(n))

    // ── Push: Vereinigung (lokal gewinnt) zurückschreiben ──
    const after = useProjectStore.getState()
    const merged = unionByName(after.customLibrary, sDevices)
    // Gestrippt wird NUR, was hinausgeht. Die lokale Bibliothek behaelt ihre
    // Zugangsdaten — sonst kostete ein einziger Sync sie dem Nutzer dauerhaft.
    const writeDevices =
      credentials === 'strip' ? stripCredentials(merged) : merged
    // Gruppen-Presets gingen bis 2026-09-04 UNGESTRIPPT hinaus, obwohl sie
    // dieselben Geraete tragen wie die Bibliothek. App-intern faellt es nicht
    // auf (`rackPreset.itemFromEquipment` schreibt keine Zugangsdaten), aber
    // ein von aussen importiertes `.cpgroup` bringt sie mit — und dann trug
    // genau der Weg sie hinaus, dessen Rueckfrage der Nutzer gerade
    // beantwortet hat.
    const mergedGroups = unionByName(after.groupPresets, sGroups)
    const writeGroups =
      credentials === 'strip' ? stripCredentials(mergedGroups) : mergedGroups
    const writeCats = [...new Set([...after.knownCategories, ...sCats])]
    const uiNach = useUiStore.getState()
    const stamm = vereinigteStammdaten(
      {
        connectorTypes: uiNach.customConnectorTypes,
        signalStandards: uiNach.customSignalStandards,
        cableLayers: uiNach.customLayers,
      },
      shared,
    )
    const out: SharedLibraryFile = {
      type: 'cable-planner-shared-library',
      version: 1,
      updatedAt: new Date().toISOString(),
      devices: writeDevices,
      groups: writeGroups,
      categories: writeCats,
      connectorTypes: stamm.connectorTypes,
      signalStandards: stamm.signalStandards,
      cableLayers: stamm.cableLayers,
    }
    await api.writeFile(filePath, JSON.stringify(out, null, 2))

    return {
      ok: true,
      pulledDevices: dDiff.add.length,
      pulledGroups: gDiff.add.length,
      pulledCategories: newCats.length,
      pushedDevices: Math.max(0, writeDevices.length - sDevices.length),
      pushedGroups: Math.max(0, writeGroups.length - sGroups.length),
      conflicts: [...dDiff.conflicts, ...gDiff.conflicts],
    }
  } catch (e) {
    return empty(e instanceof Error ? e.message : String(e))
  } finally {
    await api.releaseLock(dir, user).catch(() => {})
  }
}
