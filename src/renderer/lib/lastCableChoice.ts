import type { Cable } from '../types/cable'
import type { CableSpec } from '../types/cableSpec'

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
