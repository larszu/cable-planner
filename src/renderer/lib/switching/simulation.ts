// ───────────────────────────────────────────────────────────────────────────
// Simulation des Mischers (#1240, Stufe 3): eine deterministische
// Zustandsmaschine ueber dem Modell aus Stufe 1.
//
// REIN: keine Uhr, kein Store, kein IO. Die Zeit kommt als Befehl
// (`tick` mit Millisekunden). So laeuft „Auto“ im Test genauso wie im Pult,
// wo `requestAnimationFrame` die Ticks liefert.
//
// Regeln wie in lz-vision-mixer: ein Uebergang folgt dem T-Bar; erreicht der
// Hebel das andere Ende, ist der Uebergang fertig, und dieses Ende ist der
// neue Anfang (`tbarInverted`). Fertig heisst: Vorschau und Programm tauschen.
// ───────────────────────────────────────────────────────────────────────────
import { DEFAULT_EASING, ease } from './easing'
import { runMacro, setKeyer } from './state'
import type { BoxState, SwitchingMacro, SwitchingState, TransitionSettings } from './types'

export const DEFAULT_RATE_MS = 1000

/** Laufender Uebergang einer M/E. Nicht im Projekt, nur in der Sitzung. */
export interface MeRun {
  /** Gekruemmter Fortschritt 0…1, den das Bild zeigt. */
  progress: number
  /** Laeuft „Auto“? */
  auto: boolean
  /** Bisherige Zeit des Auto-Laufs. */
  elapsedMs: number
  /** Wo der Hebel steht, 0…1. */
  tbar: number
  /** Hebel ruht unten: der naechste Uebergang laeuft nach oben. */
  tbarInverted: boolean
}

export interface SimState {
  switching: SwitchingState
  runs: Record<string, MeRun>
}

export type SimCommand =
  | { type: 'program'; me: string; source: string }
  | { type: 'preview'; me: string; source: string }
  | { type: 'cut'; me: string }
  | { type: 'auto'; me: string }
  | { type: 'tbar'; me: string; value: number }
  | { type: 'tick'; dtMs: number }
  | { type: 'keyer'; id: string; onAir: boolean }
  | { type: 'transition'; me: string; patch: TransitionSettings }
  | { type: 'box'; id: string; patch: BoxState }
  | { type: 'route'; dest: string; source: string | undefined }
  | { type: 'macro'; macro: SwitchingMacro }

const IDLE: MeRun = { progress: 0, auto: false, elapsedMs: 0, tbar: 0, tbarInverted: false }

export const simFrom = (switching: SwitchingState | undefined): SimState => ({ switching: switching ?? {}, runs: {} })

export const runOf = (sim: SimState, me: string): MeRun => sim.runs[me] ?? IDLE

/** Einstellungen mit Vorgaben aufgefuellt. */
export const transitionOf = (
  s: SwitchingState | undefined,
  me: string,
): Required<Omit<TransitionSettings, 'dipSource'>> & { dipSource: string } => {
  const t = s?.transitions?.[me] ?? {}
  return {
    style: t.style ?? 'mix',
    rateMs: t.rateMs && t.rateMs > 0 ? t.rateMs : DEFAULT_RATE_MS,
    easing: t.easing ?? DEFAULT_EASING,
    wipe: t.wipe ?? 'right',
    dipSource: t.dipSource ?? 'black',
  }
}

const withRoutes = (s: SwitchingState, patch: Record<string, string | undefined>): SwitchingState => {
  const routes = { ...(s.routes ?? {}) }
  for (const [k, v] of Object.entries(patch)) {
    if (v) routes[k] = v
    else delete routes[k]
  }
  return { ...s, routes }
}

/** Programm und Vorschau tauschen — das Ende jedes Uebergangs. */
const swap = (s: SwitchingState, me: string): SwitchingState =>
  withRoutes(s, { [`${me}/pgm`]: s.routes?.[`${me}/pvw`], [`${me}/pvw`]: s.routes?.[`${me}/pgm`] })

const setRun = (sim: SimState, me: string, run: MeRun): SimState => ({ ...sim, runs: { ...sim.runs, [me]: run } })

/** Uebergang abschliessen: tauschen, Hebel-Ende wird neuer Anfang. */
const finish = (sim: SimState, me: string, flipLever: boolean): SimState => {
  const r = runOf(sim, me)
  const inverted = flipLever ? !r.tbarInverted : r.tbarInverted
  return setRun({ ...sim, switching: swap(sim.switching, me) }, me, {
    progress: 0,
    auto: false,
    elapsedMs: 0,
    tbar: inverted ? 1 : 0,
    tbarInverted: inverted,
  })
}

const isRunning = (r: MeRun) => r.auto || r.progress > 0

export function simStep(sim: SimState, cmd: SimCommand): SimState {
  switch (cmd.type) {
    case 'program':
      return { ...sim, switching: withRoutes(sim.switching, { [`${cmd.me}/pgm`]: cmd.source }) }
    case 'preview':
      return { ...sim, switching: withRoutes(sim.switching, { [`${cmd.me}/pvw`]: cmd.source }) }
    case 'cut':
      // Ein Schnitt mitten im Uebergang schliesst ihn ab, der Hebel bleibt.
      return finish(sim, cmd.me, false)
    case 'auto': {
      const r = runOf(sim, cmd.me)
      if (r.auto) return sim
      const { rateMs } = transitionOf(sim.switching, cmd.me)
      // Vom T-Bar aus weiter: die schon gefahrene Strecke zaehlt.
      const done = r.tbarInverted ? 1 - r.tbar : r.tbar
      return setRun(sim, cmd.me, { ...r, auto: true, elapsedMs: done * rateMs })
    }
    case 'tbar': {
      const r = runOf(sim, cmd.me)
      if (r.auto) return sim
      const v = Math.min(1, Math.max(0, cmd.value))
      const lin = r.tbarInverted ? 1 - v : v
      if (lin >= 1) return finish(sim, cmd.me, true)
      const { easing } = transitionOf(sim.switching, cmd.me)
      return setRun(sim, cmd.me, { ...r, tbar: v, progress: ease(easing, lin) })
    }
    case 'tick': {
      let out = sim
      for (const [me, r] of Object.entries(sim.runs)) {
        if (!r.auto) continue
        const { rateMs, easing } = transitionOf(out.switching, me)
        const elapsedMs = r.elapsedMs + Math.max(0, cmd.dtMs)
        const lin = elapsedMs / rateMs
        if (lin >= 1) {
          out = finish(out, me, true)
          continue
        }
        out = setRun(out, me, {
          ...r,
          elapsedMs,
          progress: ease(easing, lin),
          tbar: r.tbarInverted ? 1 - lin : lin,
        })
      }
      return out
    }
    case 'keyer':
      return { ...sim, switching: setKeyer(sim.switching, cmd.id, { onAir: cmd.onAir }) }
    case 'transition': {
      const s = sim.switching
      const t = { ...(s.transitions?.[cmd.me] ?? {}), ...cmd.patch }
      return { ...sim, switching: { ...s, transitions: { ...(s.transitions ?? {}), [cmd.me]: t } } }
    }
    case 'box': {
      const s = sim.switching
      const b = { ...(s.boxes?.[cmd.id] ?? {}), ...cmd.patch }
      return { ...sim, switching: { ...s, boxes: { ...(s.boxes ?? {}), [cmd.id]: b } } }
    }
    case 'route':
      return { ...sim, switching: withRoutes(sim.switching, { [cmd.dest]: cmd.source }) }
    case 'macro':
      return { ...sim, switching: runMacro(sim.switching, cmd.macro) }
  }
}

/** Mehrere Befehle der Reihe nach. */
export const simRun = (sim: SimState, cmds: readonly SimCommand[]): SimState => cmds.reduce(simStep, sim)

/** Laeuft auf irgendeiner M/E noch ein Uebergang? */
export const anyRunning = (sim: SimState): boolean => Object.values(sim.runs).some(isRunning)
