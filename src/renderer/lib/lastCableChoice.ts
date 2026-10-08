import type { Cable } from '../types/cable'
import { checkCableCompatibility, type CableSpec, type CompatibilityResult } from '../types/cableSpec'
import type { ConnectorType } from '../types/equipment'
import {
  DEFAULT_VIDEO_FORMAT,
  pickCableStandardForFormat,
  videoFormatById,
  type SdiCapabilities,
  type VideoFormatId,
} from '../types/videoFormat'

/** #1036 — what the cable dialog remembers per connector pair. */
export interface LastCableChoice {
  specId: string
  length: number
}

/** Order-independent: BNC→XLR and XLR→BNC are the same plug pair. */
export const cableChoiceKey = (from?: string, to?: string): string | undefined => {
  if (!from && !to) return undefined
  return [from ?? '', to ?? ''].sort().join('|')
}

/** Remembered spec only if it is still offered and not a hard mismatch
 *  (a deleted custom spec or an override that changed the connector). */
export const rememberedSpecId = (
  choice: LastCableChoice | undefined,
  ranked: ReadonlyArray<{ cable: { id: string }; level: string }>,
): string | undefined =>
  choice && ranked.some((r) => r.cable.id === choice.specId && r.level !== 'error')
    ? choice.specId
    : undefined

export const rememberedLength = (choice: LastCableChoice | undefined): number =>
  choice && Number.isFinite(choice.length) && choice.length >= 0 ? choice.length : 1

/** The dialog leaves the name empty; the canvas label then shows the
 *  cable type it was created from, as it did when the name repeated it. */
export const cableLabelName = (
  cable: Pick<Cable, 'name' | 'cableSpecId' | 'type'>,
  specs: ReadonlyArray<Pick<CableSpec, 'id' | 'name'>>,
): string =>
  cable.name?.trim() ||
  (cable.cableSpecId ? specs.find((s) => s.id === cable.cableSpecId)?.name : undefined) ||
  cable.type

/** Catalogue ranked for one plug pair: fitting cables first, mismatches last. */
export const rankCablesForPorts = <S extends CableSpec>(
  catalog: readonly S[],
  from: ConnectorType,
  to: ConnectorType,
): Array<{ cable: S } & CompatibilityResult> =>
  catalog
    .map((cable) => ({ cable, ...checkCableCompatibility(from, to, cable) }))
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])

const LEVEL_ORDER = { ok: 0, warn: 1, error: 2 } as const

/**
 * The spec the cable dialog preselects: the remembered one (#1036), else for
 * SDI↔SDI the one matching the project format and both devices' SDI caps,
 * else the first that fits. `undefined` when nothing fits — the dialog then
 * offers its custom cable. The MCP connect tools use the same choice.
 */
export const defaultCableSpecId = (
  ranked: ReadonlyArray<{ cable: Pick<CableSpec, 'id' | 'standards'>; level: string }>,
  choice: LastCableChoice | undefined,
  ends?: {
    from: ConnectorType
    to: ConnectorType
    fromCaps?: SdiCapabilities
    toCaps?: SdiCapabilities
    videoFormat?: VideoFormatId
  },
): string | undefined => {
  const remembered = rememberedSpecId(choice, ranked)
  if (remembered) return remembered
  const firstUsable = ranked.find((item) => item.level !== 'error')
  if (!firstUsable) return undefined
  if (!ends || ends.from !== 'BNC' || ends.to !== 'BNC') return firstUsable.cable.id
  const format = videoFormatById(ends.videoFormat ?? DEFAULT_VIDEO_FORMAT)
  if (!format) return firstUsable.cable.id
  const target = pickCableStandardForFormat(format, ends.fromCaps, ends.toCaps)
  const match = ranked.find((item) => item.level !== 'error' && item.cable.standards.includes(target))
  return match?.cable.id ?? firstUsable.cable.id
}
