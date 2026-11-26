// ───────────────────────────────────────────────────────────────────────────
// Media-Pool: welches Bild auf welchem Platz liegt und welcher Mediaplayer
// welchen Platz spielt (#1240). REIN: kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import { setMediaSlot } from './state'
import type { MediaSlotState, SwitchingBlockCounts, SwitchingState } from './types'

/** Nummer des Platzes `still:n`, sonst `undefined`. */
export const stillSlotNumber = (id: string | undefined): number | undefined => {
  const m = id ? /^still:(\d+)$/.exec(id) : null
  return m ? Number(m[1]) : undefined
}

/** Was auf dem Platz liegt — `undefined`, wenn er leer ist. */
export const stillRef = (state: SwitchingState | undefined, slot: number): MediaSlotState | undefined => {
  const m = state?.media?.[`still:${slot}`]
  return m && (m.fotoId || m.anhangId) ? m : undefined
}

/**
 * Der Platz, in den „Bild laden…“ am Mediaplayer schreibt: der, den er schon
 * spielt, sonst der erste freie, sonst Platz 1.
 */
export const playerSlot = (
  state: SwitchingState | undefined,
  counts: Pick<SwitchingBlockCounts, 'stills'>,
  mp: number,
): number => {
  const jetzt = stillSlotNumber(state?.routes?.[`mp:${mp}/still`])
  if (jetzt) return jetzt
  const n = Math.max(1, counts.stills ?? 1)
  for (let s = 1; s <= n; s++) if (!stillRef(state, s)) return s
  return 1
}

/** Bild auf den Platz legen und den Mediaplayer auf diesen Platz stellen. */
export const loadIntoPlayer = (
  state: SwitchingState | undefined,
  mp: number,
  slot: number,
  ref: MediaSlotState,
): SwitchingState => {
  const s = setMediaSlot(state, slot, ref)
  return { ...s, routes: { ...(s.routes ?? {}), [`mp:${mp}/still`]: `still:${slot}` } }
}

/** Fotos, die irgendein Platz noch braucht. */
export const fotosInUse = (state: SwitchingState | undefined): Set<string> =>
  new Set(Object.values(state?.media ?? {}).flatMap((m) => (m.fotoId ? [m.fotoId] : [])))
