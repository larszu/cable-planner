// v7.9.31 — Einzelne Library-Items als portable Dateien.
//
// Anders als der Library-Bulk-Export (Settings → Library Export/Import)
// schreibt das hier *ein* Gerät oder *eine* Gruppe pro Datei. Use-Case:
// einzelne Geräte/Racks/Gruppen per USB-Stick / E-Mail / Filesharing
// auf ein anderes System kopieren.
//
// Dateiformate (self-describing JSON):
//   .cpdevice  → ein EquipmentTemplate
//   .cpgroup   → ein GroupPreset (inkl. interne Kabel; Racks via
//                preset.rack-Feld)
//
// GroupPreset.cables referenzieren Ports per `itemIndex:portName`, nicht
// per UUID — d.h. die Datei ist auf jedem Zielsystem direkt instanziierbar
// ohne ID-Mapping.

import type { EquipmentTemplate, GroupPreset } from '../types/equipment'
import { downloadBlob } from './downloadBlob'
import { countCredentialBearers, stripCredentials } from './credentialKeys'
import { credentialChoiceDialog } from './credentialChoiceDialog'
// Kein Hook: diese Datei ist keine Komponente. `translate` liest die Sprache
// aus dem Store, genau wie die Class-Komponenten es tun.
import { translate } from './i18n'
import { useUiStore } from '../store/uiStore'

/**
 * Zugangsdaten-Rueckfrage fuer die Einzeldatei-Ausgaenge.
 *
 * WARUM DIESE BEIDEN AUSGAENGE SIE BRAUCHEN (gefunden 2026-09-04 von
 * `tests/credentialExits.test.ts`, nicht von Hand). `EquipmentTemplate` ist
 * `Omit<EquipmentItem, 'id'|'x'|'y'>` (types/equipment.ts:831) und traegt
 * damit `username`, `password` und `ipAddress`; `GroupPreset.items` ist
 * `EquipmentTemplate & {...}` (:889). Der Kopfkommentar dieser Datei nennt
 * als Zweck woertlich "per USB-Stick / E-Mail / Filesharing auf ein anderes
 * System kopieren" — also den direktesten Weg nach draussen, den es hier
 * gibt, und er ging bis heute ungefragt und ungefiltert.
 *
 * Gefragt wird nur, wenn wirklich Zugangsdaten dranhaengen; eine Rueckfrage
 * bei jedem Export waere in zwei Wochen eine Klickgewohnheit.
 *
 * `null` heisst: der Nutzer hat abgebrochen, es wird gar nichts geschrieben.
 */
const nachZugangsdatenFragen = async <T>(
  werte: readonly T[],
  zielKey: string,
  zielDe: string,
): Promise<'ab' | 'roh' | 'strip'> => {
  const traeger = countCredentialBearers(werte)
  if (traeger === 0) return 'roh'
  const antwort = await credentialChoiceDialog(
    traeger,
    translate(useUiStore.getState().language, zielKey, zielDe),
  )
  if (antwort === null) return 'ab'
  return antwort === 'strip' ? 'strip' : 'roh'
}

export const DEVICE_FILE_EXT = '.cpdevice'
export const GROUP_FILE_EXT = '.cpgroup'

export const DEVICE_FILE_TYPE = 'cable-planner-device'
export const GROUP_FILE_TYPE = 'cable-planner-group'

export interface DeviceFileV1 {
  type: typeof DEVICE_FILE_TYPE
  version: 1
  exportedAt: string
  template: EquipmentTemplate
}

export interface GroupFileV1 {
  type: typeof GROUP_FILE_TYPE
  version: 1
  exportedAt: string
  preset: GroupPreset
}

const sanitizeFileBase = (raw: string): string => {
  const cleaned = (raw || '').trim().replace(/[<>:"/\\|?*\p{Cc}]/gu, '_').replace(/\.+$/, '')
  return cleaned || 'export'
}

/**
 * Die Nutzlast als reine Funktion — damit die Zusicherung „gestrippt heisst
 * gestrippt" mit einem Kanarienvogel-Wert pruefbar ist und nicht nur als
 * Textmuster im Guard steht. Genau diese Schwaeche hatte die erste Fassung
 * der Pruefung: sie sah, DASS die Datei den Filter kennt, nicht, dass der
 * Schreibvorgang durch ihn laeuft.
 */
export const deviceFilePayload = (
  template: EquipmentTemplate,
  strip: boolean,
  exportedAt: string,
): DeviceFileV1 => ({
  type: DEVICE_FILE_TYPE,
  version: 1,
  exportedAt,
  template: strip ? stripCredentials(template) : template,
})

export const groupFilePayload = (
  preset: GroupPreset,
  strip: boolean,
  exportedAt: string,
): GroupFileV1 => ({
  type: GROUP_FILE_TYPE,
  version: 1,
  exportedAt,
  preset: strip ? stripCredentials(preset) : preset,
})

export const exportTemplateToFile = async (template: EquipmentTemplate): Promise<void> => {
  const wahl = await nachZugangsdatenFragen(
    [template],
    'cred.dest.cpdevice',
    'als .cpdevice-Datei — gedacht für USB-Stick, E-Mail oder Filesharing.',
  )
  if (wahl === 'ab') return
  const payload = deviceFilePayload(template, wahl === 'strip', new Date().toISOString())
  const fileName = `${sanitizeFileBase(template.name)}${DEVICE_FILE_EXT}`
  downloadBlob(fileName, JSON.stringify(payload, null, 2), 'application/json')
}

export const exportPresetToFile = async (preset: GroupPreset): Promise<void> => {
  // Gezaehlt wird ueber die Inhalte, nicht ueber das Preset als Ganzes: ein
  // Rack mit zwoelf Geraeten, von denen drei Zugangsdaten tragen, soll "3"
  // im Text stehen haben und nicht "1".
  const wahl = await nachZugangsdatenFragen(
    preset.items ?? [preset],
    'cred.dest.cpgroup',
    'als .cpgroup-Datei — gedacht für USB-Stick, E-Mail oder Filesharing.',
  )
  if (wahl === 'ab') return
  const payload = groupFilePayload(preset, wahl === 'strip', new Date().toISOString())
  const fileName = `${sanitizeFileBase(preset.name)}${GROUP_FILE_EXT}`
  downloadBlob(fileName, JSON.stringify(payload, null, 2), 'application/json')
}

export type ParsedImport =
  | { kind: 'device'; template: EquipmentTemplate }
  | { kind: 'group'; preset: GroupPreset }

/** Parse a `.cpdevice` or `.cpgroup` file. Returns null if the content
 *  isn't a valid single-item export. Bulk-library files (`type:
 *  cable-planner-library`) are intentionally rejected here — those go
 *  through Settings → Library Import. */
export const parseLibraryItemFile = (text: string): ParsedImport | null => {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  if (record.type === DEVICE_FILE_TYPE && record.version === 1) {
    const template = record.template
    if (template && typeof template === 'object') {
      return { kind: 'device', template: template as EquipmentTemplate }
    }
  }
  if (record.type === GROUP_FILE_TYPE && record.version === 1) {
    const preset = record.preset
    if (preset && typeof preset === 'object') {
      return { kind: 'group', preset: preset as GroupPreset }
    }
  }
  return null
}
