// ───────────────────────────────────────────────────────────────────────────
// Videohub-Routing: reine Logik (ADR-001, Inkrement 0).
//
// Kein React, kein Store, kein Electron — damit headless testbar, so wie es
// ADR-001 fuer die Ableitungsschicht verlangt: erst beweisen, dann verdrahten.
// ───────────────────────────────────────────────────────────────────────────
import type { VideohubCrosspoints, VideohubRouting, VideohubSalvo } from '../types/equipment'

/** Leerer, gueltiger Routing-Block. */
export const emptyVideohubRouting = (): VideohubRouting => ({ planned: {}, salvos: [] })

/**
 * Normalisiert unbekannte Daten zu einem gueltigen Kreuzpunkt-Satz.
 *
 * Robust gegen das, was in gewachsenen Projektfiles und altem localStorage
 * wirklich steht: String-Keys, Fliesskomma, negative Werte, null. Alles, was
 * kein Paar aus zwei nicht-negativen Ganzzahlen ergibt, faellt raus — still
 * zu raten waere schlimmer als die Route zu verlieren, weil ein falscher
 * Kreuzpunkt live auf Sendung geht.
 */
export const normaliseCrosspoints = (raw: unknown): VideohubCrosspoints => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: VideohubCrosspoints = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const out_i = Number(k)
    // Number(null) und Number('') sind 0 — beides waere ein gueltig aussehender
    // Kreuzpunkt auf Eingang 0, obwohl der Wert in Wahrheit fehlt. Nur echte
    // Zahlen und Zahl-Strings zaehlen.
    const in_i =
      typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
    if (!Number.isInteger(out_i) || out_i < 0) continue
    if (!Number.isInteger(in_i) || in_i < 0) continue
    out[out_i] = in_i
  }
  return out
}

/** Normalisiert einen Salvo; gibt null zurueck, wenn er unbrauchbar ist. */
export const normaliseSalvo = (raw: unknown, fallbackId: string): VideohubSalvo | null => {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!name) return null
  const createdAt =
    typeof r.createdAt === 'string'
      ? r.createdAt
      : typeof r.createdAt === 'number' && Number.isFinite(r.createdAt)
        ? new Date(r.createdAt).toISOString()
        : new Date(0).toISOString()
  return {
    id: typeof r.id === 'string' && r.id ? r.id : fallbackId,
    name,
    routing: normaliseCrosspoints(r.routing),
    createdAt,
  }
}

/** Normalisiert einen ganzen Routing-Block aus einem geladenen Projekt. */
export const normaliseVideohubRouting = (raw: unknown): VideohubRouting => {
  if (!raw || typeof raw !== 'object') return emptyVideohubRouting()
  const r = raw as Record<string, unknown>
  const salvos = Array.isArray(r.salvos)
    ? r.salvos
        .map((s, i) => normaliseSalvo(s, `salvo-${i}`))
        .filter((s): s is VideohubSalvo => s !== null)
    : []
  return { planned: normaliseCrosspoints(r.planned), salvos }
}

/**
 * Uebernimmt Salvos aus dem alten localStorage-Schluessel in das Projekt.
 *
 * Bewusst nicht destruktiv und bewusst nicht stillschweigend: bestehende
 * Projekt-Salvos gewinnen bei Namensgleichheit, und der Aufrufer erfaehrt ueber
 * `imported`, wie viele uebernommen wurden. Die Recherche nennt stillen
 * Datenverlust beim Import den schaedlichsten Integrationsfehler ueberhaupt
 * (COMPETITOR-PAIN-SYNTHESIS.md, Cluster E) — deshalb wird hier gemeldet
 * statt geschluckt.
 */
export const mergeLegacySalvos = (
  current: VideohubRouting,
  legacyRaw: unknown,
): { routing: VideohubRouting; imported: number } => {
  if (!Array.isArray(legacyRaw)) return { routing: current, imported: 0 }
  const have = new Set(current.salvos.map((s) => s.name))
  const add: VideohubSalvo[] = []
  legacyRaw.forEach((s, i) => {
    const n = normaliseSalvo(s, `legacy-${i}`)
    if (n && !have.has(n.name)) {
      have.add(n.name)
      add.push(n)
    }
  })
  if (!add.length) return { routing: current, imported: 0 }
  return { routing: { ...current, salvos: [...current.salvos, ...add] }, imported: add.length }
}

/** localStorage-Schluessel, unter dem Salvos vor ADR-001 lagen. */
export const legacySalvoKey = (deviceId: string): string =>
  `cable-planner.videohub.salvos.${deviceId || '_'}`

/**
 * Kreuzpunkte, die auf einen Ein- oder Ausgang ausserhalb des Geraets zeigen.
 *
 * Entsteht real, wenn ein Videohub im Plan verkleinert wird, nachdem geroutet
 * wurde. Wird als Befund gemeldet statt still korrigiert.
 */
export const danglingCrosspoints = (
  routing: VideohubCrosspoints,
  inputCount: number,
  outputCount: number,
): { output: number; input: number }[] =>
  Object.entries(routing)
    .map(([o, i]) => ({ output: Number(o), input: i }))
    .filter(({ output, input }) => output >= outputCount || input >= inputCount)
    .sort((a, b) => a.output - b.output)

export interface CrosspointDifference {
  /** 0-basierter Ausgang. */
  output: number
  /** Geplanter Eingang, oder undefined wenn der Plan dazu nichts sagt. */
  planned?: number
  /** Eingang laut Geraet, oder undefined wenn das Geraet ihn nicht meldet. */
  live?: number
}

/**
 * Initiative 10 — Unterschied zwischen Plan und Geraet, Kreuzpunkt fuer
 * Kreuzpunkt.
 *
 * Ein Status-Read darf den Plan NICHT ueberschreiben: Was der Hub gerade tut,
 * ist eine Beobachtung, was im Plan steht, eine Absicht. Beides in dieselbe
 * Variable zu schreiben macht die Absicht unauffindbar — und wenn die Variable
 * persistiert wird, ist sie weg. Diese Funktion macht aus dem stillen
 * Ueberschreiben eine sichtbare Differenz, ueber die ein Mensch entscheidet.
 *
 * Beruecksichtigt Ausgaenge, die nur eine der beiden Seiten kennt: Fehlen ist
 * ein Unterschied, kein Gleichstand.
 */
export const routingDifferences = (
  planned: VideohubCrosspoints,
  live: VideohubCrosspoints,
): CrosspointDifference[] => {
  const outputs = new Set<number>()
  for (const key of Object.keys(planned)) outputs.add(Number(key))
  for (const key of Object.keys(live)) outputs.add(Number(key))
  const out: CrosspointDifference[] = []
  for (const output of [...outputs].filter((o) => Number.isInteger(o)).sort((a, b) => a - b)) {
    const p = planned[output]
    const l = live[output]
    if (p === l) continue
    out.push({
      output,
      ...(p !== undefined ? { planned: p } : {}),
      ...(l !== undefined ? { live: l } : {}),
    })
  }
  return out
}
