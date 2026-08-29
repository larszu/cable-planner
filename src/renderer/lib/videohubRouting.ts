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
