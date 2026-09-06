// ───────────────────────────────────────────────────────────────────────────
// EIN Spektrum-Plan (Bedarf 95, P2). Alles, was im Plan funkt, in einer
// Liste — und die Intermodulation einmal darueber statt zweimal daneben.
//
//   > The comms plan lives in a spreadsheet: who carries beltpack 7, which
//   > antenna covers which corridor, which channel the followspot ops are on.
//
//   > The right boundary is ONE WIRELESS PLAN, not separate RF and comms
//   > features — they share spectrum, antennas and the person wearing them.
//
// ─── DER BEFUND IM EIGENEN HAUS (gemessen 2026-09-06) ──────────────────────
//
// Der cable-planner rechnete Intermodulation ZWEIMAL, und beide Male auf der
// halben Menge:
//
//   1. `deriveRig` (`wirelessRig.ts`) ruft `computeRfConflicts` auf — mit
//      `plan.channels`, also NUR den Mikrofon-Kanaelen des Rigs.
//   2. Der RF-Reiter der Analyse leitete seine Strecken aus den KABELN ab
//      (`c.wireless || c.frequency`) und rechnete die IM3-Schleife von Hand
//      nach, im Komponenten-Rumpf, mit einer eigenen Konstante
//      (`RF_MIN_SPACING_MHZ = 0.4`) statt mit `DEFAULT_RF_OPTIONS`.
//
// Eine Handmikrofon-Strecke auf 606,400 MHz und ein Kamera-Funklink auf
// 606,500 MHz begegneten sich damit in KEINER der beiden Rechnungen. Und die
// beiden Rechnungen waren sich nicht einmal einig, was ein Konflikt ist: die
// eine kennt ein Schutzband (`imdGuardMhz`), die andere nicht.
//
// **Intermodulation auf der halben Senderliste ist schlimmer als gar keine.**
// Keine Rechnung sagt nichts; eine halbe sagt „frei". Genau deshalb ist die
// Zusammenfuehrung kein Aufraeumen, sondern der Bedarf selbst.
//
// ─── WAS DIESE DATEI IST ───────────────────────────────────────────────────
//
// Die Engstelle, durch die JEDER geht, der wissen will, was im Raum funkt.
// Sie sammelt aus allen Quellen, die der Plan kennt, und ruft
// `computeRfConflicts` genau einmal auf. Wer eine dritte Quelle anlegt,
// traegt sie hier ein — und dann sehen beide Ansichten sie.
//
// ─── JEDER SENDER SAGT, WOHER ER KOMMT UND WER IHN TRAEGT ──────────────────
//
// Ein Konflikt zwischen zwei Zahlen ist unbrauchbar. Der Befund muss sagen,
// WELCHES GERAET und WELCHER MENSCH — „Lead Vox gegen Kamera 2 Rueckweg" ist
// eine Handlungsanweisung, „606.4 gegen 606.5" ist eine Zahlenkolonne. Der
// Bedarf verlangt das woertlich („who carries beltpack 7"), und der Plan
// weiss es: der Rig-Kanal traegt seine Rolle im Namen, die Funkstrecke ihre
// beiden Enden, und ein Geraet, das einem Intercom-Teilnehmer zugeordnet ist,
// traegt dessen Namen.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject } from '../types/project'
import type { CsvCell, CsvTable } from './csv'
import {
  DEFAULT_RF_OPTIONS,
  computeRfConflicts,
  type RfConflict,
  type RfCoordinationOptions,
  type RfFreq,
} from './rfCoordination'

/** Woher ein Sender kommt. */
export type SpectrumSource =
  /** Ein Kanal des Funkmikrofon-Rigs (`project.wirelessRig`). */
  | 'rig'
  /** Eine drahtlose Strecke im Kabelgraph (`cable.wireless` / `cable.frequency`). */
  | 'link'

export interface SpectrumEntry {
  id: string
  /** Was funkt — der Rollen-/Streckenname. */
  label: string
  mhz: number
  source: SpectrumSource
  /**
   * Wer es traegt oder wo es haengt, soweit der Plan es weiss.
   *
   * Beim Rig-Kanal ist der Name selbst schon die Rolle („Lead Vox"), also
   * bleibt das Feld leer statt sie zu wiederholen. Bei einer Strecke sind es
   * die beiden Enden, und bei einem Geraet mit Intercom-Zuordnung der Name
   * des Teilnehmers — das ist die Antwort auf „wer traegt Beltpack 7".
   */
  carrier?: string
}

export interface SpectrumPlan {
  entries: SpectrumEntry[]
  conflicts: RfConflict[]
  /**
   * Drahtlose Strecken und Rig-Kanaele OHNE Frequenz.
   *
   * Kein Konflikt — aber der wichtigste Teil der Auskunft: eine
   * Intermodulations-Rechnung, die drei von acht Sendern nicht kennt, sagt
   * „frei" und meint „ich habe nicht nachgesehen". Die Zahl steht deshalb
   * neben dem Ergebnis, nicht darunter.
   */
  withoutFrequency: string[]
}

/**
 * Frequenz-Zeichenkette („5.8 GHz", „600 MHz", „614") → MHz.
 *
 * Stand bis 2026-09-06 im Rumpf des Analyse-Dialogs und war damit fuer jede
 * andere Stelle unerreichbar — genau der Grund, aus dem es zwei Rechnungen
 * gab. Ohne Einheit gilt MHz: so schreiben es Funk-Datenblaetter, und eine
 * nackte 614 ist in diesem Feld nie 614 Hz.
 */
export const parseFreqMhz = (s: string | undefined): number | null => {
  if (!s) return null
  const m = s.match(/([\d.]+)\s*(g|m|k)?hz/i) ?? s.match(/^\s*([\d.]+)\s*$/)
  if (!m) return null
  const value = parseFloat(m[1])
  if (!Number.isFinite(value)) return null
  const unit = (m[2] ?? 'm').toLowerCase()
  return unit === 'g' ? value * 1000 : unit === 'k' ? value / 1000 : value
}

/**
 * Alles, was im Plan funkt — aus jeder Quelle, die der Plan kennt.
 *
 * Reihenfolge: erst das Rig, dann die Strecken. Sie ist stabil, damit der
 * Dokument-Stand es auch ist.
 */
export function collectTransmitters(project: CablePlannerProject): {
  entries: SpectrumEntry[]
  withoutFrequency: string[]
} {
  const entries: SpectrumEntry[] = []
  const withoutFrequency: string[] = []

  const nameOf = new Map(project.equipment.map((e) => [e.id, e.name]))
  // „Wer traegt Beltpack 7" — die Intercom-Teilnehmer sind ueber `equipmentId`
  // an Geraete gebunden. Ein Geraet kann mehreren zugeordnet sein; dann
  // stehen beide da, statt einen zu waehlen.
  const traegerOf = new Map<string, string[]>()
  for (const u of project.greengoConfig?.users ?? []) {
    if (!u.equipmentId) continue
    const name = (u.displayName || u.name || '').trim()
    if (!name) continue
    traegerOf.set(u.equipmentId, [...(traegerOf.get(u.equipmentId) ?? []), name])
  }

  for (const c of project.wirelessRig?.channels ?? []) {
    const label = c.label?.trim() || 'Kanal'
    const mhz = typeof c.frequencyMhz === 'number' && c.frequencyMhz > 0 ? c.frequencyMhz : null
    if (mhz === null) {
      withoutFrequency.push(label)
      continue
    }
    // Kein `carrier`: der Kanalname IST die Rolle.
    entries.push({ id: `rig:${c.id}`, label, mhz, source: 'rig' })
  }

  for (const c of project.cables) {
    const mhz = parseFreqMhz(c.frequency)
    if (!c.wireless && mhz === null) continue
    const label = c.name?.trim() || '—'
    if (mhz === null) {
      withoutFrequency.push(label)
      continue
    }
    const enden = [c.fromEquipmentId, c.toEquipmentId]
    const traeger = [
      ...new Set(enden.flatMap((id) => traegerOf.get(id) ?? [])),
    ]
    const carrier = traeger.length
      ? traeger.join(', ')
      : enden.map((id) => nameOf.get(id) ?? '?').join(' → ')
    entries.push({ id: `link:${c.id}`, label, mhz, source: 'link', carrier })
  }

  return { entries, withoutFrequency }
}

/** Der ganze Spektrum-Plan: sammeln, einmal rechnen. */
export function buildSpectrumPlan(
  project: CablePlannerProject,
  opts: RfCoordinationOptions = DEFAULT_RF_OPTIONS,
): SpectrumPlan {
  const { entries, withoutFrequency } = collectTransmitters(project)
  const freqs: RfFreq[] = entries.map((e) => ({ id: e.id, label: e.label, mhz: e.mhz }))
  return { entries, conflicts: computeRfConflicts(freqs, opts), withoutFrequency }
}

export const SPECTRUM_SOURCE_LABEL: Record<SpectrumSource, string> = {
  rig: 'Funkmikrofon-Rig',
  link: 'Funkstrecke',
}

/**
 * Ein Konflikt in Worten, mit den Geraeten statt der Ids.
 *
 * `computeRfConflicts` kennt nur Id, Beschriftung und Zahl — es soll auch
 * nichts weiter kennen. Die Zuordnung zurueck auf Herkunft und Traeger
 * passiert hier, wo beides bekannt ist.
 */
export function conflictParticipants(
  plan: SpectrumPlan,
  conflict: RfConflict,
): SpectrumEntry[] {
  const byId = new Map(plan.entries.map((e) => [e.id, e]))
  return conflict.ids.map((id) => byId.get(id)).filter(Boolean) as SpectrumEntry[]
}

/** Das Blatt: eine Zeile je Sender, kanonisches Deutsch. */
export function spectrumTable(plan: SpectrumPlan): CsvTable {
  return {
    headers: ['Frequenz (MHz)', 'Was', 'Herkunft', 'Wer / wo'],
    rows: [...plan.entries]
      .sort((a, b) => a.mhz - b.mhz)
      .map((e): CsvCell[] => [e.mhz, e.label, SPECTRUM_SOURCE_LABEL[e.source], e.carrier ?? '']),
  }
}

/** Fuer das Dokument-Register. */
export const spectrumTableForProject = (project: CablePlannerProject): CsvTable =>
  spectrumTable(buildSpectrumPlan(project))
